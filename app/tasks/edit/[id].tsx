import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';

import { getNoHouseholdRoute } from '../../../lib/no-household-route';
import { supabase } from '../../../lib/supabase';
import { getCurrentHouseholdId } from '../../../lib/household';
import { CategoryPicker } from '../../../components/category-picker';
import { AssigneePicker } from '../../../components/assignee-picker';
import { WeekdayPicker, WeekdayCode } from '../../../components/weekday-picker';
import { TASK_CATEGORIES } from '../../../constants/categories';
import {
  getMergedTaskCategories,
  saveCustomTaskCategory,
} from '../../../lib/categories';
import { getHouseholdMemberOptions } from '../../../lib/household-members';
import { AppScreen } from '../../../components/app-screen';
import { FormInput } from '../../../components/form-input';
import { DateField } from '../../../components/date-field';
import { FormScreenHeader } from '../../../components/form-screen-header';
import { COLORS, RADIUS } from '../../../constants/theme';

type AssigneeOption = {
  label: string;
  value: string;
};

type LoadedTask = {
  id: string;
  household_id: string;
  title: string;
  category: string | null;
  due_date: string | null;
  assigned_to: string | null;
  recurrence: 'daily' | 'weekly' | 'monthly' | 'weekdays' | null;
  recurrence_days: WeekdayCode[] | null;
  recurrence_interval: number | null;
};

const RECURRENCE_OPTIONS = [
  'None',
  'daily',
  'weekly',
  'monthly',
  'weekdays',
] as const;

type RecurrenceValue = (typeof RECURRENCE_OPTIONS)[number];

export default function EditTaskScreen() {
  const { id, returnTo } = useLocalSearchParams<{ id: string; returnTo?: string }>();

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isOther = category === 'Other';
  const isWeekdays = recurrence === 'weekdays';
  const showInterval =
    recurrence === 'daily' || recurrence === 'weekly' || recurrence === 'monthly';

  useEffect(() => {
    getMergedTaskCategories(TASK_CATEGORIES).then(setCategoryOptions);
    getHouseholdMemberOptions().then(setAssigneeOptions).catch(console.error);
  }, []);

  useEffect(() => {
    async function loadTask() {
      try {
        setLoading(true);

        const householdId = await getCurrentHouseholdId();
        if (!householdId || householdId === 'null' || householdId === 'undefined') {
          const route = await getNoHouseholdRoute();
          router.replace(route);
          return;
        }

        const { data, error } = await supabase
          .from('tasks')
          .select(
            'id, household_id, title, category, due_date, assigned_to, recurrence, recurrence_days, recurrence_interval'
          )
          .eq('id', id)
          .single();

        if (error) {
          Alert.alert('Load failed', error.message);
          return;
        }

        const task = data as LoadedTask;

        const mergedCategories = await getMergedTaskCategories(TASK_CATEGORIES);
        const inPreset = task.category ? mergedCategories.includes(task.category) : false;

        setTitle(task.title ?? '');
        setCategory(task.category && !inPreset ? 'Other' : task.category ?? '');
        setCustomCategory(task.category && !inPreset ? task.category : '');
        setDueDate(task.due_date ?? null);
        setAssignedTo(task.assigned_to ?? '');
        setRecurrence((task.recurrence ?? 'None') as RecurrenceValue);
        setRecurrenceInterval(String(task.recurrence_interval ?? 1));
        setRecurrenceDays(
          task.recurrence_days && task.recurrence_days.length > 0
            ? task.recurrence_days
            : ['mon', 'tue', 'wed', 'thu', 'fri']
        );
      } catch (error) {
        console.error(error);
        Alert.alert('Load failed', 'Could not load task.');
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      loadTask();
    }
  }, [id]);

  async function handleSave() {
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
      setSaving(true);

      const finalCategory = isOther ? customCategory.trim() : category || null;

      const { error } = await supabase
        .from('tasks')
        .update({
          title: title.trim(),
          category: finalCategory,
          due_date: dueDate,
          assigned_to: assignedTo || null,
          recurrence: recurrence === 'None' ? null : recurrence,
          recurrence_days: isWeekdays ? recurrenceDays : null,
          recurrence_interval:
            recurrence === 'None' || isWeekdays ? 1 : finalInterval,
        })
        .eq('id', id);

      if (error) {
        Alert.alert('Save failed', error.message);
        return;
      }

      if (isOther && finalCategory) {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user?.id) {
          await saveCustomTaskCategory(finalCategory, session.user.id);
        }
      }

      router.replace(returnTo as Href || '/tasks');
    } catch (error) {
      console.error(error);
      Alert.alert('Save failed', 'Could not update task.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppScreen>
        <FormScreenHeader
          title="Edit task"
          subtitle="Loading task details..."
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <FormScreenHeader
        title="Edit task"
        subtitle="Update the task details and recurrence."
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

      <Pressable style={styles.button} onPress={handleSave} disabled={saving}>
        <Text style={styles.buttonText}>
          {saving ? 'Saving...' : 'Save Task'}
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