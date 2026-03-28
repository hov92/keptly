import { supabase } from './supabase';

export type TaskRecurrence = 'daily' | 'weekly' | 'monthly' | 'weekdays' | null;
export type WeekdayCode = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

function fromYMD(value: string) {
  return new Date(`${value}T12:00:00`);
}

function toYMD(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getWeekdayCode(date: Date): WeekdayCode {
  const day = date.getDay();
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][day] as WeekdayCode;
}

function getNextDateForWeekdays(
  dueDate: string,
  recurrenceDays: WeekdayCode[]
) {
  const start = fromYMD(dueDate);

  for (let i = 1; i <= 14; i += 1) {
    const next = new Date(start);
    next.setDate(start.getDate() + i);

    if (recurrenceDays.includes(getWeekdayCode(next))) {
      return toYMD(next);
    }
  }

  const fallback = new Date(start);
  fallback.setDate(start.getDate() + 7);
  return toYMD(fallback);
}

export function getNextRecurringDate(params: {
  dueDate: string;
  recurrence: Exclude<TaskRecurrence, null>;
  recurrenceDays?: WeekdayCode[] | null;
}) {
  const { dueDate, recurrence, recurrenceDays } = params;
  const next = fromYMD(dueDate);

  if (recurrence === 'daily') {
    next.setDate(next.getDate() + 1);
    return toYMD(next);
  }

  if (recurrence === 'weekly') {
    next.setDate(next.getDate() + 7);
    return toYMD(next);
  }

  if (recurrence === 'monthly') {
    next.setMonth(next.getMonth() + 1);
    return toYMD(next);
  }

  if (recurrence === 'weekdays') {
    const validDays =
      recurrenceDays && recurrenceDays.length > 0
        ? recurrenceDays
        : (['mon', 'tue', 'wed', 'thu', 'fri'] as WeekdayCode[]);

    return getNextDateForWeekdays(dueDate, validDays);
  }

  return dueDate;
}

export async function completeTaskWithRecurrence(task: {
  id: string;
  household_id: string;
  title: string;
  category: string | null;
  due_date: string | null;
  is_completed: boolean;
  assigned_to: string | null;
  created_by?: string | null;
  recurrence: TaskRecurrence;
  recurrence_days?: WeekdayCode[] | null;
  parent_task_id?: string | null;
}) {
  const { error: completeError } = await supabase
    .from('tasks')
    .update({ is_completed: true })
    .eq('id', task.id);

  if (completeError) {
    throw new Error(completeError.message);
  }

  if (!task.recurrence || !task.due_date) {
    return;
  }

  const nextDueDate = getNextRecurringDate({
    dueDate: task.due_date,
    recurrence: task.recurrence,
    recurrenceDays: task.recurrence_days ?? null,
  });

  const { error: insertError } = await supabase.from('tasks').insert({
    household_id: task.household_id,
    title: task.title,
    category: task.category,
    due_date: nextDueDate,
    is_completed: false,
    assigned_to: task.assigned_to,
    created_by: task.created_by ?? null,
    recurrence: task.recurrence,
    recurrence_days: task.recurrence_days ?? null,
    parent_task_id: task.parent_task_id || task.id,
  });

  if (insertError) {
    throw new Error(insertError.message);
  }
}