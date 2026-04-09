import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';

import { AppScreen } from '../../../components/app-screen';
import { FormInput } from '../../../components/form-input';
import { CategoryPicker } from '../../../components/category-picker';
import { COLORS, RADIUS, SPACING } from '../../../constants/theme';
import { supabase } from '../../../lib/supabase';
import { smartBack } from '../../../lib/navigation';
import {
  formatRecurrenceLabel,
  TaskRecurrence,
  WeekdayCode,
} from '../../../lib/task-recurrence';

type TaskRow = {
  id: string;
  household_id: string;
  title: string;
  category: string | null;
  due_date: string | null;
  is_completed: boolean;
  assigned_to: string | null;
  created_by: string | null;
  recurrence: TaskRecurrence;
  recurrence_days: WeekdayCode[] | null;
  recurrence_interval: number | null;
  parent_task_id: string | null;
};

type SharedMemberName = {
  id: string;
  full_name: string | null;
};

const TASK_CATEGORIES = [
  'Cleaning',
  'Kitchen',
  'Laundry',
  'Bathroom',
  'Bedroom',
  'Yard',
  'Maintenance',
  'Pets',
  'Kids',
  'Shopping',
  'Bills',
  'Other',
] as const;

const RECURRENCE_OPTIONS: Exclude<TaskRecurrence, null>[] = [
  'daily',
  'weekly',
  'monthly',
  'weekdays',
];

const RECURRENCE_LABELS: Record<Exclude<TaskRecurrence, null>, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  weekdays: 'Weekdays',
};

export default function EditTaskScreen() {
  const { id, returnTo } = useLocalSearchParams<{
    id: string;
    returnTo?: string;
  }>();
  const navigation = useNavigation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stoppingRepeat, setStoppingRepeat] = useState(false);

  const [task, setTask] = useState<TaskRow | null>(null);
  const [memberOptions, setMemberOptions] = useState<SharedMemberName[]>([]);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Other');
  const [dueDate, setDueDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [recurrence, setRecurrence] = useState<TaskRecurrence>(null);
  const [recurrenceInterval, setRecurrenceInterval] = useState('1');

  function handleBack() {
    smartBack({
      navigation,
      returnTo,
      fallback: '/tasks',
    });
  }

  useEffect(() => {
    async function loadTask() {
      try {
        setLoading(true);

        const { data, error } = await supabase
          .from('tasks')
          .select(
            'id, household_id, title, category, due_date, is_completed, assigned_to, created_by, recurrence, recurrence_days, recurrence_interval, parent_task_id'
          )
          .eq('id', id)
          .single();

        if (error) {
          Alert.alert('Load failed', error.message);
          return;
        }

        const taskRow = data as TaskRow;
        setTask(taskRow);
        setTitle(taskRow.title ?? '');
        setCategory(taskRow.category ?? 'Other');
        setDueDate(taskRow.due_date ?? '');
        setAssignedTo(taskRow.assigned_to ?? '');
        setRecurrence(taskRow.recurrence ?? null);
        setRecurrenceInterval(
          taskRow.recurrence_interval ? String(taskRow.recurrence_interval) : '1'
        );

        const { data: namesData, error: namesError } = await supabase.rpc(
          'get_shared_household_member_names'
        );

        if (namesError) {
          Alert.alert('Load failed', namesError.message);
          return;
        }

        setMemberOptions((namesData ?? []) as SharedMemberName[]);
      } catch (error) {
        console.error(error);
        Alert.alert('Load failed', 'Could not load this task.');
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      loadTask();
    }
  }, [id]);

  async function handleSave() {
    if (!task) return;

    if (!title.trim()) {
      Alert.alert('Missing info', 'Enter a task title.');
      return;
    }

    const interval =
      recurrence && recurrence !== 'weekdays'
        ? Number.parseInt(recurrenceInterval || '1', 10)
        : 1;

    if (recurrence && recurrence !== 'weekdays') {
      if (Number.isNaN(interval) || interval < 1) {
        Alert.alert('Invalid recurrence', 'Enter a valid repeat interval.');
        return;
      }
    }

    try {
      setSaving(true);

      const seriesRootId = task.parent_task_id || task.id;

      const updatePayload = {
        title: title.trim(),
        category: category || null,
        due_date: dueDate || null,
        assigned_to: assignedTo || null,
        recurrence,
        recurrence_days:
          recurrence === 'weekdays'
            ? (['mon', 'tue', 'wed', 'thu', 'fri'] as WeekdayCode[])
            : null,
        recurrence_interval: recurrence ? interval : null,
      };

      const { error } = await supabase
        .from('tasks')
        .update(updatePayload)
        .or(`id.eq.${seriesRootId},parent_task_id.eq.${seriesRootId}`);

      if (error) {
        Alert.alert('Save failed', error.message);
        return;
      }

      handleBack();
    } catch (error) {
      console.error(error);
      Alert.alert('Save failed', 'Could not save this task.');
    } finally {
      setSaving(false);
    }
  }

  async function handleStopRepeating() {
    if (!task) return;

    Alert.alert(
      'Stop repeating?',
      'This task will stay in history, but it will no longer repeat.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop repeating',
          style: 'destructive',
          onPress: async () => {
            try {
              setStoppingRepeat(true);

              const seriesRootId = task.parent_task_id || task.id;

              const { error } = await supabase
                .from('tasks')
                .update({
                  recurrence: null,
                  recurrence_days: null,
                  recurrence_interval: null,
                  parent_task_id: null,
                })
                .or(`id.eq.${seriesRootId},parent_task_id.eq.${seriesRootId}`);

              if (error) {
                Alert.alert('Update failed', error.message);
                return;
              }

              setRecurrence(null);
              setRecurrenceInterval('1');
              Alert.alert('Updated', 'This task will no longer repeat.');
            } catch (error) {
              console.error(error);
              Alert.alert('Update failed', 'Could not stop repeating.');
            } finally {
              setStoppingRepeat(false);
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!task) {
    return (
      <AppScreen>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <View style={styles.card}>
          <Text style={styles.emptyText}>Task not found.</Text>
        </View>
      </AppScreen>
    );
  }

  const recurrenceLabel = recurrence
    ? formatRecurrenceLabel({
        recurrence,
        recurrenceInterval:
          recurrence !== 'weekdays'
            ? Number.parseInt(recurrenceInterval || '1', 10)
            : 1,
        recurrenceDays:
          recurrence === 'weekdays'
            ? (['mon', 'tue', 'wed', 'thu', 'fri'] as WeekdayCode[])
            : null,
      })
    : null;

  return (
    <AppScreen>
      <Pressable onPress={handleBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>Back</Text>
      </Pressable>

      <View style={styles.headerCard}>
        <Text style={styles.headerTitle}>Edit Task</Text>
        {recurrenceLabel ? (
          <View style={styles.repeatBadge}>
            <Text style={styles.repeatBadgeText}>Repeats: {recurrenceLabel}</Text>
          </View>
        ) : null}
      </View>

      <FormInput
        placeholder="Task title"
        value={title}
        onChangeText={setTitle}
        returnKeyType="done"
      />

      <CategoryPicker
        label="Category"
        value={category}
        onChange={(value) => setCategory(value || 'Other')}
        options={[...TASK_CATEGORIES]}
        placeholder="Select category"
      />

      <FormInput
        placeholder="Due date (YYYY-MM-DD)"
        value={dueDate}
        onChangeText={setDueDate}
        returnKeyType="done"
      />

      <CategoryPicker
        label="Assigned to"
        value={assignedTo}
        onChange={(value) => setAssignedTo(value || '')}
        options={memberOptions.map((member) => member.id)}
        optionLabels={Object.fromEntries(
          memberOptions.map((member) => [
            member.id,
            member.full_name || 'Household member',
          ])
        )}
        placeholder="Unassigned"
      />

      <CategoryPicker
        label="Repeat"
        value={recurrence || ''}
        onChange={(value) =>
          setRecurrence((value as Exclude<TaskRecurrence, null> | '') || null)
        }
        options={[...RECURRENCE_OPTIONS]}
        optionLabels={RECURRENCE_LABELS}
        placeholder="Does not repeat"
      />

      {recurrence && recurrence !== 'weekdays' ? (
        <FormInput
          placeholder="Repeat interval"
          value={recurrenceInterval}
          onChangeText={setRecurrenceInterval}
          keyboardType="number-pad"
          returnKeyType="done"
        />
      ) : null}

      {recurrence ? (
        <Pressable
          style={[styles.stopRepeatingButton, stoppingRepeat && styles.buttonDisabled]}
          onPress={handleStopRepeating}
          disabled={stoppingRepeat}
        >
          <Text style={styles.stopRepeatingButtonText}>
            {stoppingRepeat ? 'Updating...' : 'Stop Repeating'}
          </Text>
        </Pressable>
      ) : null}

      <Pressable
        style={[styles.primaryButton, saving && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.primaryButtonText}>
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
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: SPACING.md,
  },
  backButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  headerCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  repeatBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EAF3F5',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  repeatBadgeText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  emptyText: {
    color: COLORS.muted,
    fontSize: 15,
  },
  stopRepeatingButton: {
    backgroundColor: '#FFF4E5',
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  stopRepeatingButtonText: {
    color: '#B45309',
    fontSize: 15,
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: COLORS.primaryText,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});