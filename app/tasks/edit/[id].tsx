import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { supabase } from '../../../lib/supabase';
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
import { getActiveHouseholdPermissions } from '../../../lib/permissions';
import { ensureRecurringTaskHorizon } from '../../../lib/task-recurrence';

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

type SavedTask = {
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

export default function EditTaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

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
  const [role, setRole] = useState<'owner' | 'member' | 'child' | null>(null);

  const isOther = category === 'Other';
  const isWeekdays = recurrence === 'weekdays';
  const showInterval =
    recurrence === 'daily' || recurrence === 'weekly' || recurrence === 'monthly';

  useEffect(() => {
    async function loadData() {
      try {
        const permissions = await getActiveHouseholdPermissions();
        setRole(permissions.role);

        if (permissions.role === 'child') {
          Alert.alert('Restricted', 'You cannot edit tasks.');
          router.replace('/(tabs)/tasks');
          return;
        }

        const [mergedCategories, memberOptions] = await Promise.all([
          getMergedTaskCategories(TASK_CATEGORIES),
          getHouseholdMemberOptions(),
        ]);

        setCategoryOptions(mergedCategories);
        setAssigneeOptions(memberOptions);

        const { data, error } = await supabase
          .from('tasks')
          .select(
            'title, category, due_date, assigned_to, recurrence, recurrence_days, recurrence_interval'
          )
          .eq('id', id)
          .single();

        if (error) {
          Alert.alert('Load failed', error.message);
          router.back();
          return;
        }

        const loadedCategory = data.category ?? '';

        if (loadedCategory && !mergedCategories.includes(loadedCategory)) {
          setCategory('Other');
          setCustomCategory(loadedCategory);
        } else {
          setCategory(loadedCategory);
          setCustomCategory('');
        }

        setTitle(data.title ?? '');
        setDueDate(data.due_date ?? null);
        setAssignedTo(data.assigned_to ?? '');
        setRecurrence((data.recurrence ?? 'None') as RecurrenceValue);
        setRecurrenceInterval(String(data.recurrence_interval ?? 1));

        const loadedDays = Array.isArray(data.recurrence_days)
          ? (data.recurrence_days as WeekdayCode[])
          : [];

        setRecurrenceDays(
          loadedDays.length > 0
            ? loadedDays
            : ['mon', 'tue', 'wed', 'thu', 'fri']
        );
      } catch (error) {
        console.error(error);
        Alert.alert('Load failed', 'Could not load task.');
        router.back();
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      loadData();
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

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const userId = session?.user?.id ?? null;
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

      const { data: savedTask, error: savedTaskError } = await supabase
        .from('tasks')
        .select(
          'id, household_id, title, category, due_date, is_completed, assigned_to, created_by, recurrence, recurrence_days, recurrence_interval, parent_task_id'
        )
        .eq('id', id)
        .single();

      if (savedTaskError) {
        Alert.alert('Save failed', savedTaskError.message);
        return;
      }

      if (savedTask?.recurrence) {
        await ensureRecurringTaskHorizon(savedTask as SavedTask);
      }

      if (isOther && finalCategory && userId) {
        await saveCustomTaskCategory(finalCategory, userId);
      }

      router.replace(`/tasks/${id}`);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Something went wrong saving the task.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (role === 'child') {
    return null;
  }

  return (
    <AppScreen>
      <FormScreenHeader
        title="Edit task"
        subtitle="Update this household task."
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
          {saving ? 'Saving...' : 'Save Changes'}
        </Text>
      </Pressable>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
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