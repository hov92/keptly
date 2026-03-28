import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';

import { getNoHouseholdRoute } from '../../lib/no-household-route';
import { supabase } from '../../lib/supabase';
import { getCurrentHouseholdId } from '../../lib/household';
import { CategoryPicker } from '../../components/category-picker';
import { AssigneePicker } from '../../components/assignee-picker';
import { WeekdayPicker, WeekdayCode } from '../../components/weekday-picker';
import { TASK_CATEGORIES } from '../../constants/categories';
import {
  getMergedTaskCategories,
  saveCustomTaskCategory,
} from '../../lib/categories';
import { getHouseholdMemberOptions } from '../../lib/household-members';
import { AppScreen } from '../../components/app-screen';
import { FormInput } from '../../components/form-input';
import { DateField } from '../../components/date-field';
import { FormScreenHeader } from '../../components/form-screen-header';
import { COLORS, RADIUS } from '../../constants/theme';
import { ensureRecurringTaskHorizon } from '../../lib/task-recurrence';

type AssigneeOption = {
  label: string;
  value: string;
};

const RECURRENCE_OPTIONS = [
  'None',
  'daily',
  'weekly',
  'monthly',
  'weekdays',
] as const;

type RecurrenceValue = (typeof RECURRENCE_OPTIONS)[number];

type InsertedTask = {
  id: string;
  household_id: string;
  title: string;
  category: string | null;
  due_date: string | null;
  is_completed: boolean;
  assigned_to: string | null;
  created_by: string | null;
  recurrence: 'daily' | 'weekly' | 'monthly' | 'weekdays' | null;
  recurrence_days: WeekdayCode[] | null;
  recurrence_interval: number | null;
  parent_task_id: string | null;
};

export default function NewTaskScreen() {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [categoryOptions, setCategoryOptions] = useState<string[]>([
    ...TASK_CATEGORIES,
  ]);
  const [assigneeOptions, setAssigneeOptions] = useState<AssigneeOption[]>([]);
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [recurrence, setRecurrence] = useState<RecurrenceValue>('None');
  const [recurrenceInterval, setRecurrenceInterval] = useState('1');
  const [recurrenceDays, setRecurrenceDays] = useState<WeekdayCode[]>([
    'mon',
    'tue',
    'wed',
    'thu',
    'fri',
  ]);
  const [loading, setLoading] = useState(false);

  const isOther = category === 'Other';
  const isWeekdays = recurrence === 'weekdays';
  const showInterval =
    recurrence === 'daily' || recurrence === 'weekly' || recurrence === 'monthly';

  useEffect(() => {
    getMergedTaskCategories(TASK_CATEGORIES).then(setCategoryOptions);
    getHouseholdMemberOptions().then(setAssigneeOptions).catch(console.error);
  }, []);

  async function handleCreateTask() {
    if (!title.trim()) {
      Alert.alert('Missing info', 'Enter a task title.');
      return;
    }

    if (isOther && !customCategory.trim()) {
      Alert.alert('Missing info', 'Enter a custom category.');
      return;
    }

    if (isWeekdays && recurrenceDays.length === 0) {
      Alert.alert('Missing info', 'Select at least one weekday.');
      return;
    }

    const parsedInterval = Number.parseInt(recurrenceInterval.trim(), 10);
    const finalInterval =
      Number.isNaN(parsedInterval) || parsedInterval < 1 ? 1 : parsedInterval;

    try {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user;
      if (!user) {
        Alert.alert('Auth error', 'You are not signed in.');
        router.replace('/login');
        return;
      }

      const householdId = await getCurrentHouseholdId();

      if (!householdId || householdId === 'null' || householdId === 'undefined') {
        const route = await getNoHouseholdRoute();
        router.replace(route);
        return;
      }

      const finalCategory = isOther ? customCategory.trim() : category || null;

      const taskPayload = {
        household_id: householdId,
        title: title.trim(),
        category: finalCategory,
        due_date: dueDate,
        assigned_to: assignedTo || null,
        created_by: user.id,
        recurrence: recurrence === 'None' ? null : recurrence,
        recurrence_days: isWeekdays ? recurrenceDays : null,
        recurrence_interval:
          recurrence === 'None' || isWeekdays ? 1 : finalInterval,
      };

      const { data: insertedTask, error } = await supabase
        .from('tasks')
        .insert(taskPayload)
        .select(
          'id, household_id, title, category, due_date, is_completed, assigned_to, created_by, recurrence, recurrence_days, recurrence_interval, parent_task_id'
        )
        .single();

      if (error) {
        Alert.alert('Create failed', error.message);
        return;
      }

      if (insertedTask?.recurrence) {
        await ensureRecurringTaskHorizon(insertedTask as InsertedTask);
      }

      if (isOther && finalCategory) {
        await saveCustomTaskCategory(finalCategory, user.id);
      }

      router.back();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Something went wrong creating the task.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppScreen>
      <FormScreenHeader
        title="Add task"
        subtitle="Create a task for your household."
      />

      <FormInput
        placeholder="Task title"
        value={title}
        onChangeText={setTitle}
        returnKeyType="done"
      />

      <CategoryPicker
        label="Category"
        value={category}
        onChange={(value) => {
          setCategory(value);
          if (value !== 'Other') setCustomCategory('');
        }}
        options={categoryOptions}
        placeholder="Select a category"
      />

      {isOther ? (
        <FormInput
          placeholder="Enter custom category"
          value={customCategory}
          onChangeText={setCustomCategory}
          returnKeyType="done"
        />
      ) : null}

      <AssigneePicker
        label="Assign to"
        value={assignedTo}
        onChange={setAssignedTo}
        options={assigneeOptions}
        placeholder="Unassigned"
      />

      <DateField label="Due date" value={dueDate} onChange={setDueDate} />

      <CategoryPicker
        label="Repeats"
        value={recurrence}
        onChange={(value) => setRecurrence((value || 'None') as RecurrenceValue)}
        options={[...RECURRENCE_OPTIONS]}
        placeholder="Select recurrence"
      />

      {showInterval ? (
        <FormInput
          placeholder="Repeat interval (example: 2)"
          value={recurrenceInterval}
          onChangeText={setRecurrenceInterval}
          keyboardType="number-pad"
          returnKeyType="done"
        />
      ) : null}

      {isWeekdays ? (
        <WeekdayPicker value={recurrenceDays} onChange={setRecurrenceDays} />
      ) : null}

      <Pressable
        style={styles.button}
        onPress={handleCreateTask}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Saving...' : 'Save Task'}
        </Text>
      </Pressable>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: COLORS.primaryText,
    fontSize: 16,
    fontWeight: '600',
  },
});