import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { AppScreen } from '../../components/app-screen';
import { getNoHouseholdRoute } from '../../lib/no-household-route';
import { refreshTaskNotifications } from '../../lib/notification-polish';
import { supabase } from '../../lib/supabase';
import { getCurrentHouseholdId } from '../../lib/household';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';
import { getActiveHouseholdPermissions } from '../../lib/permissions';
import {
  completeTaskWithRecurrence,
  formatRecurrenceLabel,
  WeekdayCode,
} from '../../lib/task-recurrence';

type Task = {
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

type TaskFilter = 'all' | 'assigned';

type SharedMemberName = {
  id: string;
  full_name: string | null;
};

function shouldHideFromDefaultList(task: Task) {
  return task.is_completed && !!task.recurrence;
}

function sortTasksByDueDate(a: Task, b: Task) {
  const aDate = a.due_date ?? '9999-12-31';
  const bDate = b.due_date ?? '9999-12-31';

  if (aDate !== bDate) {
    return aDate.localeCompare(bDate);
  }

  return a.title.localeCompare(b.title);
}

function collapseRecurringTasks(tasks: Task[]) {
  const nonRecurring = tasks.filter((task) => !task.recurrence);
  const recurring = tasks.filter((task) => !!task.recurrence);

  const recurringGroups = new Map<string, Task[]>();

  for (const task of recurring) {
    const seriesKey = task.parent_task_id || task.id;
    const existing = recurringGroups.get(seriesKey) ?? [];
    existing.push(task);
    recurringGroups.set(seriesKey, existing);
  }

  const collapsedRecurring = [...recurringGroups.values()]
    .map((group) =>
      [...group]
        .filter((task) => !task.is_completed)
        .sort(sortTasksByDueDate)[0]
    )
    .filter(Boolean) as Task[];

  return [...nonRecurring, ...collapsedRecurring].sort(sortTasksByDueDate);
}

export default function TasksScreen() {
  const params = useLocalSearchParams<{ filter?: string }>();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<TaskFilter>('all');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [role, setRole] = useState<'owner' | 'member' | 'child' | null>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (params.filter === 'assigned') {
      setActiveFilter('assigned');
    } else {
      setActiveFilter('all');
    }
  }, [params.filter]);

  async function loadTasks() {
    try {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const userId = session?.user?.id ?? null;
      setCurrentUserId(userId);

      const permissions = await getActiveHouseholdPermissions();
      setRole(permissions.role);

      const householdId = await getCurrentHouseholdId();

      if (!householdId || householdId === 'null' || householdId === 'undefined') {
        const route = await getNoHouseholdRoute();
        router.replace(route);
        return;
      }

      const { data, error } = await supabase
        .from('tasks')
        .select(
          'id, household_id, title, category, due_date, is_completed, assigned_to, created_by, recurrence, recurrence_days, recurrence_interval, parent_task_id'
        )
        .eq('household_id', householdId)
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) {
        Alert.alert('Load failed', error.message);
        return;
      }

      const rows = ((data ?? []) as Task[]).filter(
        permissions.role === 'child'
          ? (task) => task.assigned_to === userId && !shouldHideFromDefaultList(task)
          : (task) => !shouldHideFromDefaultList(task)
      );

      const { data: namesData, error: namesError } = await supabase.rpc(
        'get_shared_household_member_names'
      );

      if (namesError) {
        Alert.alert('Load failed', namesError.message);
        return;
      }

      const nameMap = new Map(
        ((namesData ?? []) as SharedMemberName[]).map((row) => [
          row.id,
          row.full_name,
        ])
      );

      setTasks(
        rows.map((task) => ({
          ...task,
          assigned_name: task.assigned_to
            ? (nameMap.get(task.assigned_to) ?? null)
            : null,
        }))
      );
    } catch (error) {
      console.error(error);
      Alert.alert('Load failed', 'Could not load tasks.');
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [])
  );

  const visibleTasks = useMemo(() => {
    let nextTasks = tasks;

    if (role !== 'child' && activeFilter === 'assigned' && currentUserId) {
      nextTasks = tasks.filter((task) => task.assigned_to === currentUserId);
    }

    return collapseRecurringTasks(nextTasks);
  }, [tasks, activeFilter, currentUserId, role]);

  async function handleToggleComplete(task: Task) {
    try {
      setUpdatingTaskId(task.id);

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
        await loadTasks();
        return;
      }

      if (!task.is_completed) {
        await completeTaskWithRecurrence(task);

        if (task.recurrence) {
          Alert.alert('Completed', 'This task will appear again later.');
        }

        await refreshTaskNotifications();
        await loadTasks();
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
      await loadTasks();
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error ? error.message : 'Could not update task.';
      Alert.alert('Update failed', message);
    } finally {
      setUpdatingTaskId(null);
    }
  }

  function renderItem({ item }: { item: Task }) {
    const isUpdating = updatingTaskId === item.id;
    const recurrenceLabel = item.recurrence
      ? formatRecurrenceLabel({
          recurrence: item.recurrence,
          recurrenceDays: item.recurrence_days,
          recurrenceInterval: item.recurrence_interval,
        })
      : null;

    return (
      <Pressable
        style={styles.card}
        onPress={() =>
          router.push({
            pathname: '/tasks/[id]',
            params: {
              id: item.id,
              returnTo: '/tasks',
            },
          })
        }
      >
        <View style={styles.cardTop}>
          <Text
            style={[
              styles.taskTitle,
              item.is_completed && styles.taskTitleDone,
            ]}
          >
            {item.title}
          </Text>

          <Pressable
            style={[
              styles.statusPill,
              item.is_completed ? styles.donePill : styles.openPill,
              isUpdating && styles.statusDisabled,
            ]}
            onPress={() => handleToggleComplete(item)}
            disabled={isUpdating}
          >
            <Text
              style={[
                styles.statusText,
                item.is_completed ? styles.doneText : styles.openText,
              ]}
            >
              {isUpdating ? 'Saving...' : item.is_completed ? 'Done' : 'Open'}
            </Text>
          </Pressable>
        </View>

        {item.category ? (
          <Text style={styles.meta}>Category: {item.category}</Text>
        ) : null}

        {item.due_date ? (
          <Text style={styles.meta}>Due: {item.due_date}</Text>
        ) : null}

        {recurrenceLabel ? (
          <Text style={styles.repeatMeta}>Repeats: {recurrenceLabel}</Text>
        ) : null}

        <Text style={styles.meta}>
          Assigned to: {item.assigned_name || 'Unassigned'}
        </Text>
      </Pressable>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <AppScreen>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Tasks</Text>
          <Text style={styles.subtitle}>Manage household tasks.</Text>
        </View>

        {role !== 'child' ? (
          <Pressable
            style={styles.addButton}
            onPress={() => router.push('/tasks/new')}
          >
            <Text style={styles.addButtonText}>Add</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.filterRow}>
        {role !== 'child' ? (
          <Pressable
            style={[
              styles.filterChip,
              activeFilter === 'all' && styles.filterChipActive,
            ]}
            onPress={() => setActiveFilter('all')}
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === 'all' && styles.filterChipTextActive,
              ]}
            >
              All
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          style={[
            styles.filterChip,
            activeFilter === 'assigned' && styles.filterChipActive,
          ]}
          onPress={() => setActiveFilter('assigned')}
        >
          <Text
            style={[
              styles.filterChipText,
              activeFilter === 'assigned' && styles.filterChipTextActive,
            ]}
          >
            Assigned to me
          </Text>
        </Pressable>
      </View>

      <FlatList
        data={visibleTasks}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        scrollEnabled={false}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {activeFilter === 'assigned' || role === 'child'
                ? 'No tasks assigned to you.'
                : 'No tasks yet.'}
            </Text>
          </View>
        }
      />
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.muted,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  addButtonText: {
    color: COLORS.primaryText,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  filterChip: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 14,
  },
  filterChipTextActive: {
    color: COLORS.primaryText,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  taskTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  taskTitleDone: {
    color: COLORS.muted,
    textDecorationLine: 'line-through',
  },
  meta: {
    fontSize: 14,
    color: COLORS.muted,
    marginBottom: 4,
  },
  repeatMeta: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
    marginBottom: 4,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  donePill: {
    backgroundColor: COLORS.accentSoft,
  },
  openPill: {
    backgroundColor: '#EEF2F6',
  },
  statusDisabled: {
    opacity: 0.6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  doneText: {
    color: COLORS.accent,
  },
  openText: {
    color: COLORS.text,
  },
  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  emptyText: {
    color: COLORS.muted,
    fontSize: 15,
  },
});