import { supabase } from './supabase';

export type TaskRecurrence =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'weekdays'
  | null;

export type WeekdayCode =
  | 'sun'
  | 'mon'
  | 'tue'
  | 'wed'
  | 'thu'
  | 'fri'
  | 'sat';

const WEEKDAY_LABELS: Record<WeekdayCode, string> = {
  sun: 'Sun',
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
};

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

function addDays(dateString: string, days: number) {
  const date = fromYMD(dateString);
  date.setDate(date.getDate() + days);
  return toYMD(date);
}

function addMonths(dateString: string, months: number) {
  const date = fromYMD(dateString);
  date.setMonth(date.getMonth() + months);
  return toYMD(date);
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
  recurrenceInterval?: number | null;
}) {
  const { dueDate, recurrence, recurrenceDays, recurrenceInterval } = params;
  const interval =
    recurrenceInterval && recurrenceInterval > 0 ? recurrenceInterval : 1;

  if (recurrence === 'daily') {
    return addDays(dueDate, interval);
  }

  if (recurrence === 'weekly') {
    return addDays(dueDate, 7 * interval);
  }

  if (recurrence === 'monthly') {
    return addMonths(dueDate, interval);
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

export function formatRecurrenceLabel(params: {
  recurrence: TaskRecurrence;
  recurrenceDays?: WeekdayCode[] | null;
  recurrenceInterval?: number | null;
}) {
  const { recurrence, recurrenceDays, recurrenceInterval } = params;
  const interval =
    recurrenceInterval && recurrenceInterval > 0 ? recurrenceInterval : 1;

  if (!recurrence) return 'Does not repeat';

  if (recurrence === 'daily') {
    return interval === 1 ? 'Daily' : `Every ${interval} days`;
  }

  if (recurrence === 'weekly') {
    return interval === 1 ? 'Weekly' : `Every ${interval} weeks`;
  }

  if (recurrence === 'monthly') {
    return interval === 1 ? 'Monthly' : `Every ${interval} months`;
  }

  if (recurrence === 'weekdays') {
    const validDays =
      recurrenceDays && recurrenceDays.length > 0
        ? recurrenceDays
        : (['mon', 'tue', 'wed', 'thu', 'fri'] as WeekdayCode[]);

    const weekdayOnly =
      validDays.length === 5 &&
      ['mon', 'tue', 'wed', 'thu', 'fri'].every((day) =>
        validDays.includes(day as WeekdayCode)
      );

    if (weekdayOnly) {
      return 'Weekdays';
    }

    return validDays.map((day) => WEEKDAY_LABELS[day]).join(', ');
  }

  return 'Does not repeat';
}

export function getTaskSeriesRootId(task: {
  id: string;
  parent_task_id?: string | null;
}) {
  return task.parent_task_id || task.id;
}

export function collapseTaskSeriesToNextOpen<T extends {
  id: string;
  due_date: string | null;
  is_completed: boolean;
  recurrence: TaskRecurrence;
  parent_task_id?: string | null;
}>(tasks: T[]) {
  const nonRecurring = tasks.filter((task) => !task.recurrence);
  const recurring = tasks.filter((task) => !!task.recurrence);

  const recurringGroups = new Map<string, T[]>();

  for (const task of recurring) {
    const seriesKey = getTaskSeriesRootId(task);
    const existing = recurringGroups.get(seriesKey) ?? [];
    existing.push(task);
    recurringGroups.set(seriesKey, existing);
  }

  const collapsedRecurring = [...recurringGroups.values()]
    .map((group) =>
      [...group]
        .filter((task) => !task.is_completed)
        .sort((a, b) => {
          const aDate = a.due_date ?? '9999-12-31';
          const bDate = b.due_date ?? '9999-12-31';
          return aDate.localeCompare(bDate);
        })[0]
    )
    .filter(Boolean) as T[];

  return [...nonRecurring, ...collapsedRecurring].sort((a, b) => {
    const aDate = a.due_date ?? '9999-12-31';
    const bDate = b.due_date ?? '9999-12-31';
    if (aDate !== bDate) return aDate.localeCompare(bDate);
    return 0;
  });
}

function getHorizonEndDate(task: {
  due_date: string;
  recurrence: Exclude<TaskRecurrence, null>;
}) {
  if (task.recurrence === 'daily') {
    return addDays(task.due_date, 90);
  }

  return addMonths(task.due_date, 12);
}

async function getExistingSeriesDates(params: {
  householdId: string;
  seriesRootId: string;
}) {
  const { householdId, seriesRootId } = params;

  const { data, error } = await supabase
    .from('tasks')
    .select('id, due_date, parent_task_id')
    .eq('household_id', householdId)
    .or(`id.eq.${seriesRootId},parent_task_id.eq.${seriesRootId}`)
    .not('due_date', 'is', null);

  if (error) {
    throw new Error(error.message);
  }

  return new Set(
    ((data ?? []) as { due_date: string | null }[])
      .map((row) => row.due_date)
      .filter(Boolean) as string[]
  );
}

export async function ensureRecurringTaskHorizon(task: {
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
  recurrence_interval?: number | null;
  parent_task_id?: string | null;
}) {
  if (!task.recurrence || !task.due_date) {
    return;
  }

  const seriesRootId = getTaskSeriesRootId(task);
  const horizonEndDate = getHorizonEndDate({
    due_date: task.due_date,
    recurrence: task.recurrence,
  });

  const existingDates = await getExistingSeriesDates({
    householdId: task.household_id,
    seriesRootId,
  });

  const inserts: Array<Record<string, unknown>> = [];
  let cursor = task.due_date;

  while (true) {
    const nextDate = getNextRecurringDate({
      dueDate: cursor,
      recurrence: task.recurrence,
      recurrenceDays: task.recurrence_days ?? null,
      recurrenceInterval: task.recurrence_interval ?? 1,
    });

    if (nextDate > horizonEndDate) {
      break;
    }

    if (!existingDates.has(nextDate)) {
      inserts.push({
        household_id: task.household_id,
        title: task.title,
        category: task.category,
        due_date: nextDate,
        is_completed: false,
        assigned_to: task.assigned_to,
        created_by: task.created_by ?? null,
        recurrence: task.recurrence,
        recurrence_days: task.recurrence_days ?? null,
        recurrence_interval: task.recurrence_interval ?? 1,
        parent_task_id: seriesRootId,
      });

      existingDates.add(nextDate);
    }

    cursor = nextDate;
  }

  if (inserts.length === 0) {
    return;
  }

  const { error } = await supabase.from('tasks').insert(inserts);

  if (error) {
    throw new Error(error.message);
  }
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
  recurrence_interval?: number | null;
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

  await ensureRecurringTaskHorizon(task);
}