import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  router,
  useLocalSearchParams,
  useNavigation,
} from 'expo-router';

import { supabase } from '../../lib/supabase';
import { AppScreen } from '../../components/app-screen';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';
import { getActiveHouseholdPermissions } from '../../lib/permissions';
import { refreshTaskNotifications } from '../../lib/notification-polish';
import {
  completeTaskWithRecurrence,
  formatRecurrenceLabel,
  WeekdayCode,
} from '../../lib/task-recurrence';
import { smartBack } from '../../lib/navigation';

type TaskDetail = {
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
  assigned_name?: string | null;
};

type SharedMemberName = {
  id: string;
  full_name: string | null;
};

export default function TaskDetailScreen() {
  const { id, returnTo } = useLocalSearchParams<{
    id: string;
    returnTo?: string;
  }>();
  const navigation = useNavigation();

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [role, setRole] = useState<'owner' | 'member' | 'child' | null>(null);
  const [updating, setUpdating] = useState(false);
  const [stoppingRepeat, setStoppingRepeat] = useState(false);

  const recurrenceLabel = useMemo(() => {
    if (!task?.recurrence) return null;

    return formatRecurrenceLabel({
      recurrence: task.recurrence,
      recurrenceDays: task.recurrence_days,
      recurrenceInterval: task.recurrence_interval,
    });
  }, [task]);

  function handleBack() {
    smartBack({
      navigation,
      returnTo: returnTo ?? '/tasks',
      fallback: '/tasks',
    });
  }

  async function loadTask() {
    try {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const userId = session?.user?.id ?? null;
      setCurrentUserId(userId);

      const permissions = await getActiveHouseholdPermissions();
      setRole(permissions.role);

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

      const taskRow = data as TaskDetail;

      if (permissions.role === 'child' && taskRow.assigned_to !== userId) {
        Alert.alert('Restricted', 'You can only view tasks assigned to you.');
        router.replace('/tasks');
        return;
      }

      let assignedName: string | null = null;

      if (taskRow.assigned_to) {
        const { data: namesData, error: namesError } = await supabase.rpc(
          'get_shared_household_member_names'
        );

        if (!namesError) {
          const nameMap = new Map(
            ((namesData ?? []) as SharedMemberName[]).map((row) => [
              row.id,
              row.full_name,
            ])
          );

          assignedName = nameMap.get(taskRow.assigned_to) ?? null;
        }
      }

      setTask({
        ...taskRow,
        assigned_name: assignedName,
      });
    } catch (error) {
      console.error(error);
      Alert.alert('Load failed', 'Could not load task details.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) {
      loadTask();
    }
  }, [id]);

  async function handleDelete() {
    if (!task) return;

    if (role === 'child') {
      Alert.alert('Restricted', 'You cannot delete tasks.');
      return;
    }

    Alert.alert('Delete task?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase
            .from('tasks')
            .delete()
            .eq('id', task.id);

          if (error) {
            Alert.alert('Delete failed', error.message);
            return;
          }

          await refreshTaskNotifications();
          router.replace('/tasks');
        },
      },
    ]);
  }

  async function handleToggleComplete() {
    if (!task) return;

    try {
      setUpdating(true);

      if (role === 'child') {
        if (task.assigned_to !== currentUserId) {
          Alert.alert('Restricted', 'You can only complete tasks assigned to you.');
          return;
        }

        if (task.is_completed) {
          Alert.alert('Restricted', 'You cannot reopen tasks.');
          return;
        }

        const { error } = await supabase.rpc('mark_my_task_done', {
          task_id: task.id,
        });

        if (error) {
          Alert.alert('Update failed', error.message);
          return;
        }

        if (task.recurrence) {
          Alert.alert('Completed', 'This task will appear again later.');
        }

        await refreshTaskNotifications();
        await loadTask();
        return;
      }

      if (!task.is_completed) {
        await completeTaskWithRecurrence(task);

        if (task.recurrence) {
          Alert.alert('Completed', 'This task will appear again later.');
        }

        await refreshTaskNotifications();
        await loadTask();
        return;
      }

      const { error } = await supabase
        .from('tasks')
        .update({ is_completed: false })
        .eq('id', task.id);

      if (error) {
        Alert.alert('Update failed', error.message);
        return;
      }

      await refreshTaskNotifications();
      await loadTask();
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error ? error.message : 'Could not update task.';
      Alert.alert('Update failed', message);
    } finally {
      setUpdating(false);
    }
  }

  async function handleStopRepeating() {
    if (!task) return;

    Alert.alert(
      'Stop repeating?',
      'This task will stay in your history, but it will no longer repeat.',
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

              await refreshTaskNotifications();
              await loadTask();
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
          <Text style={styles.emptyTitle}>Could not load this task.</Text>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <Pressable onPress={handleBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>Back</Text>
      </Pressable>

      <View style={styles.headerCard}>
        <Text style={styles.title}>{task.title}</Text>

        <View style={styles.headerMetaWrap}>
          {recurrenceLabel ? (
            <View style={styles.repeatBadge}>
              <Text style={styles.repeatBadgeText}>
                Repeats: {recurrenceLabel}
              </Text>
            </View>
          ) : null}

          {task.is_completed ? (
            <View style={styles.doneBadge}>
              <Text style={styles.doneBadgeText}>Completed</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.card}>
        {task.category ? (
          <Text style={styles.meta}>Category: {task.category}</Text>
        ) : null}

        {task.due_date ? (
          <Text style={styles.meta}>Due: {task.due_date}</Text>
        ) : null}

        <Text style={styles.meta}>
          Assigned to: {task.assigned_name || 'Unassigned'}
        </Text>
      </View>

      {role !== 'child' ? (
        <Pressable
          style={styles.editButton}
          onPress={() =>
            router.push({
              pathname: '/tasks/edit/[id]',
              params: {
                id: task.id,
                returnTo: `/tasks/${task.id}`,
              },
            })
          }
        >
          <Text style={styles.editButtonText}>Edit Task</Text>
        </Pressable>
      ) : null}

      {task.recurrence && role !== 'child' ? (
        <Pressable
          style={[
            styles.stopRepeatingButton,
            stoppingRepeat && styles.buttonDisabled,
          ]}
          onPress={handleStopRepeating}
          disabled={stoppingRepeat}
        >
          <Text style={styles.stopRepeatingButtonText}>
            {stoppingRepeat ? 'Updating...' : 'Stop Repeating'}
          </Text>
        </Pressable>
      ) : null}

      <Pressable
        style={[styles.primaryButton, updating && styles.buttonDisabled]}
        onPress={handleToggleComplete}
        disabled={updating}
      >
        <Text style={styles.primaryButtonText}>
          {updating
            ? 'Saving...'
            : task.is_completed
            ? 'Mark Active'
            : task.recurrence
            ? 'Mark Completed (Repeats)'
            : 'Mark Completed'}
        </Text>
      </Pressable>

      {role !== 'child' ? (
        <Pressable style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>Delete Task</Text>
        </Pressable>
      ) : null}
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
  headerMetaWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
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
  doneBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.accentSoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  doneBadgeText: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  meta: {
    color: COLORS.muted,
    fontSize: 15,
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  editButton: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  editButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
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
    marginBottom: SPACING.sm,
  },
  primaryButtonText: {
    color: COLORS.primaryText,
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: COLORS.dangerSoft,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: COLORS.danger,
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});