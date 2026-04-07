import * as Notifications from 'expo-notifications';

import { supabase } from './supabase';
import { getCurrentHouseholdId } from './household';
import { isLowStock, type PantryItem } from './shopping-phase3';
import type { ShoppingRecurringTemplate } from './shopping-phase3';

type TaskRow = {
  id: string;
  title: string;
  due_date: string | null;
  is_completed: boolean;
  recurrence: 'daily' | 'weekly' | 'monthly' | 'weekdays' | null;
};

function toLocalDateAtHour(dateStr: string, hour: number, minute = 0) {
  const source = new Date(dateStr);

  return new Date(
    source.getFullYear(),
    source.getMonth(),
    source.getDate(),
    hour,
    minute,
    0,
    0
  );
}

function isFuture(date: Date) {
  return date.getTime() > Date.now();
}

function getNextLocalNineAM() {
  const now = new Date();
  const next = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    9,
    0,
    0,
    0
  );

  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

async function cancelScheduledByPrefix(prefix: string) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();

  const ids = scheduled
    .filter((item) => {
      const key =
        typeof item.content.data?.key === 'string' ? item.content.data.key : '';
      return key.startsWith(prefix);
    })
    .map((item) => item.identifier);

  await Promise.all(
    ids.map((id) =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)
    )
  );
}

export async function scheduleDueSoonTaskReminder(task: {
  id: string;
  title: string;
  due_date: string | null;
  householdId: string;
}) {
  if (!task.due_date) return null;

  const triggerDate = toLocalDateAtHour(task.due_date, 9, 0);
  if (!isFuture(triggerDate)) return null;

  const key = `task_due:${task.householdId}:${task.id}`;

  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Task due today',
      body: task.title,
      data: {
        key,
        type: 'task_due',
        taskId: task.id,
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });
}

export async function scheduleOverdueTaskReminder(task: {
  id: string;
  title: string;
  due_date: string | null;
  householdId: string;
}) {
  if (!task.due_date) return null;

  const triggerDate = toLocalDateAtHour(task.due_date, 18, 0);
  if (!isFuture(triggerDate)) return null;

  const key = `task_overdue:${task.householdId}:${task.id}`;

  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Task overdue',
      body: `${task.title} still needs attention.`,
      data: {
        key,
        type: 'task_overdue',
        taskId: task.id,
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });
}

export async function scheduleLowStockReminder(
  item: PantryItem & { household_id: string }
) {
  if (!isLowStock(item)) return null;

  const triggerDate = new Date(Date.now() + 5 * 60 * 1000);
  const key = `pantry_low_stock:${item.household_id}:${item.id}`;

  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Low stock reminder',
      body: `${item.title} is running low.`,
      data: {
        key,
        type: 'pantry_low_stock',
        pantryItemId: item.id,
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });
}

export async function scheduleRecurringShoppingReminder(
  template: ShoppingRecurringTemplate
) {
  if (!template.is_active) return null;

  const triggerDate = getNextLocalNineAM();
  const key = `shopping_recurring:${template.household_id}:${template.id}`;

  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Recurring shopping reminder',
      body: template.title,
      data: {
        key,
        type: 'shopping_recurring',
        templateId: template.id,
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });
}

export async function refreshTaskNotifications() {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  await cancelScheduledByPrefix(`task_due:${householdId}:`);
  await cancelScheduledByPrefix(`task_overdue:${householdId}:`);

  const { data, error } = await supabase
    .from('tasks')
    .select('id, title, due_date, is_completed, recurrence')
    .eq('household_id', householdId)
    .eq('is_completed', false);

  if (error) {
    throw new Error(error.message);
  }

  const tasks = (data ?? []) as TaskRow[];

  for (const task of tasks) {
    await scheduleDueSoonTaskReminder({
      id: task.id,
      title: task.title,
      due_date: task.due_date,
      householdId,
    });

    await scheduleOverdueTaskReminder({
      id: task.id,
      title: task.title,
      due_date: task.due_date,
      householdId,
    });
  }
}

export async function refreshPantryLowStockNotifications() {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  await cancelScheduledByPrefix(`pantry_low_stock:${householdId}:`);

  const { data, error } = await supabase
    .from('pantry_items')
    .select(
      'id, household_id, title, quantity, unit, category, notes, low_stock_threshold, created_by, created_at, updated_at'
    )
    .eq('household_id', householdId);

  if (error) {
    throw new Error(error.message);
  }

  const items = (data ?? []) as PantryItem[];

  for (const item of items) {
    if (isLowStock(item)) {
      await scheduleLowStockReminder(item as PantryItem & { household_id: string });
    }
  }
}

export async function refreshRecurringShoppingNotifications() {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  await cancelScheduledByPrefix(`shopping_recurring:${householdId}:`);

  const { data, error } = await supabase
    .from('shopping_recurring_templates')
    .select(
      'id, household_id, title, quantity, unit, category, notes, assigned_to, is_favorite, is_active, created_by, created_at, updated_at'
    )
    .eq('household_id', householdId)
    .eq('is_active', true);

  if (error) {
    throw new Error(error.message);
  }

  const templates = (data ?? []) as ShoppingRecurringTemplate[];

  for (const template of templates) {
    await scheduleRecurringShoppingReminder(template);
  }
}

export async function refreshAllHouseholdNotifications() {
  await refreshTaskNotifications();
  await refreshPantryLowStockNotifications();
  await refreshRecurringShoppingNotifications();
}