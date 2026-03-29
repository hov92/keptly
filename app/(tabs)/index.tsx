import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { Screen } from '../../components/screen';
import { supabase } from '../../lib/supabase';
import { getCurrentHouseholdId } from '../../lib/household';
import { getNoHouseholdRoute } from '../../lib/no-household-route';
import {
  formatRecurrenceLabel,
  WeekdayCode,
} from '../../lib/task-recurrence';

type Task = {
  id: string;
  title: string;
  category: string | null;
  due_date: string | null;
  is_completed: boolean;
  created_at: string;
  assigned_to: string | null;
  recurrence: 'daily' | 'weekly' | 'monthly' | 'weekdays' | null;
  recurrence_days: WeekdayCode[] | null;
  recurrence_interval: number | null;
  assigned_name?: string | null;
};

type Household = {
  id: string;
  name: string;
  home_type: string | null;
};

type SharedMemberName = {
  id: string;
  full_name: string | null;
};

function shouldHideFromDefaultList(task: Task) {
  return task.is_completed && !!task.recurrence;
}

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [household, setHousehold] = useState<Household | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const loadDashboard = async () => {
    try {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const userId = session?.user?.id ?? null;
      setCurrentUserId(userId);

      const householdId = await getCurrentHouseholdId();

      if (!householdId || householdId === 'null' || householdId === 'undefined') {
        const route = await getNoHouseholdRoute();
        router.replace(route);
        return;
      }

      const { data: householdData, error: householdError } = await supabase
        .from('households')
        .select('id, name, home_type')
        .eq('id', householdId)
        .single();

      if (householdError) {
        console.error(householdError.message);
        return;
      }

      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select(
          'id, title, category, due_date, is_completed, created_at, assigned_to, recurrence, recurrence_days, recurrence_interval'
        )
        .eq('household_id', householdId)
        .order('created_at', { ascending: false });

      if (tasksError) {
        console.error(tasksError.message);
        return;
      }

      const taskRows = ((tasksData ?? []) as Task[]).filter(
        (task) => !shouldHideFromDefaultList(task)
      );

      const { data: namesData, error: namesError } = await supabase.rpc(
        'get_shared_household_member_names'
      );

      if (namesError) {
        console.error(namesError.message);
        return;
      }

      const nameMap = new Map(
        ((namesData ?? []) as SharedMemberName[]).map((row) => [
          row.id,
          row.full_name,
        ])
      );

      setHousehold(householdData as Household);
      setTasks(
        taskRows.map((task) => ({
          ...task,
          assigned_name: task.assigned_to
            ? (nameMap.get(task.assigned_to) ?? null)
            : null,
        }))
      );
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [])
  );

  const today = new Date().toISOString().slice(0, 10);

  const dueTodayCount = tasks.filter(
    (task) => !task.is_completed && task.due_date === today
  ).length;

  const upcomingCount = tasks.filter(
    (task) => !task.is_completed && !!task.due_date && task.due_date > today
  ).length;

  const overdueCount = tasks.filter(
    (task) => !task.is_completed && !!task.due_date && task.due_date < today
  ).length;

  const completedCount = tasks.filter((task) => task.is_completed).length;

  const recentTasks = tasks.slice(0, 4);

  const assignedToMe = currentUserId
    ? tasks.filter((task) => task.assigned_to === currentUserId && !task.is_completed)
    : [];

  const assignedToMePreview = assignedToMe.slice(0, 3);

  function isOverdue(task: Task) {
    return !task.is_completed && !!task.due_date && task.due_date < today;
  }

  function renderTaskCard(task: Task) {
    const overdue = isOverdue(task);

    return (
      <Pressable
        key={task.id}
        onPress={() =>
          router.push({
  pathname: '/tasks/[id]',
  params: {
    id: task.id,
    returnTo: '/(tabs)/tasks',
  },
})
        }
        style={[styles.taskCard, overdue && styles.taskCardOverdue]}
      >
        <View style={styles.taskTopRow}>
          <Text
            style={[
              styles.taskTitle,
              task.is_completed && styles.taskTitleCompleted,
              overdue && styles.taskTitleOverdue,
            ]}
          >
            {task.title}
          </Text>

          <View
            style={[
              styles.statusBadge,
              task.is_completed
                ? styles.statusBadgeDone
                : overdue
                ? styles.statusBadgeOverdue
                : styles.statusBadgeOpen,
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                task.is_completed
                  ? styles.statusBadgeTextDone
                  : overdue
                  ? styles.statusBadgeTextOverdue
                  : styles.statusBadgeTextOpen,
              ]}
            >
              {task.is_completed ? 'Done' : overdue ? 'Overdue' : 'Open'}
            </Text>
          </View>
        </View>

        {!!task.category && (
          <Text style={[styles.taskMeta, overdue && styles.taskMetaOverdue]}>
            Category: {task.category}
          </Text>
        )}

        <Text style={[styles.taskMeta, overdue && styles.taskMetaOverdue]}>
          {task.due_date ? `Due: ${task.due_date}` : 'No due date'}
        </Text>

        {task.recurrence ? (
          <Text style={[styles.taskMeta, overdue && styles.taskMetaOverdue]}>
            Repeats:{' '}
            {formatRecurrenceLabel({
              recurrence: task.recurrence,
              recurrenceDays: task.recurrence_days,
              recurrenceInterval: task.recurrence_interval,
            })}
          </Text>
        ) : null}

        <Text style={[styles.taskMeta, overdue && styles.taskMetaOverdue]}>
          Assigned to: {task.assigned_name || 'Unassigned'}
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
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>Dashboard</Text>

        <View style={styles.headerRow}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>Home</Text>
            <Text style={styles.subtitle}>Your household dashboard</Text>
          </View>

          {household?.name ? (
            <View style={styles.householdPill}>
              <Text style={styles.householdPillLabel}>Active household</Text>
              <Text style={styles.householdPillText}>{household.name}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Today at a glance</Text>
          <Text style={styles.heroText}>
            Stay on top of what needs attention around the house.
          </Text>

          {!!household?.home_type && (
            <Text style={styles.heroSubtext}>{household.home_type} home</Text>
          )}

          <View style={styles.heroButtons}>
            <Pressable
              style={styles.primaryButton}
              onPress={() => router.push('/tasks/new')}
            >
              <Text style={styles.primaryButtonText}>Add Task</Text>
            </Pressable>

            <Pressable
              style={styles.secondaryButton}
              onPress={() => router.push('/(tabs)/tasks')}
            >
              <Text style={styles.secondaryButtonText}>View Tasks</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <Pressable
            style={styles.statCard}
            onPress={() =>
              router.push({
                pathname: '/(tabs)/calendar',
                params: { filter: 'today' },
              })
            }
          >
            <Text style={styles.statNumber}>{dueTodayCount}</Text>
            <Text style={styles.statLabel}>Due Today</Text>
          </Pressable>

          <Pressable
            style={styles.statCard}
            onPress={() =>
              router.push({
                pathname: '/(tabs)/calendar',
                params: { filter: 'next7' },
              })
            }
          >
            <Text style={styles.statNumber}>{upcomingCount}</Text>
            <Text style={styles.statLabel}>Upcoming</Text>
          </Pressable>

          <Pressable
            style={[styles.statCard, overdueCount > 0 && styles.statCardOverdue]}
            onPress={() =>
              router.push({
                pathname: '/(tabs)/calendar',
                params: { filter: 'overdue' },
              })
            }
          >
            <Text
              style={[
                styles.statNumber,
                overdueCount > 0 && styles.statNumberOverdue,
              ]}
            >
              {overdueCount}
            </Text>
            <Text
              style={[
                styles.statLabel,
                overdueCount > 0 && styles.statLabelOverdue,
              ]}
            >
              Overdue
            </Text>
          </Pressable>

          <Pressable
            style={styles.statCard}
            onPress={() => router.push('/(tabs)/tasks')}
          >
            <Text style={styles.statNumber}>{completedCount}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </Pressable>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Assigned to me</Text>
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/(tabs)/tasks',
                params: { filter: 'assigned' },
              })
            }
          >
            <Text style={styles.sectionLink}>See all</Text>
          </Pressable>
        </View>

        {assignedToMePreview.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nothing assigned to you</Text>
            <Text style={styles.emptyText}>
              Tasks assigned to you will show up here.
            </Text>
          </View>
        ) : (
          assignedToMePreview.map(renderTaskCard)
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent tasks</Text>
          <Pressable onPress={() => router.push('/(tabs)/tasks')}>
            <Text style={styles.sectionLink}>See all</Text>
          </Pressable>
        </View>

        {recentTasks.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No tasks yet</Text>
            <Text style={styles.emptyText}>
              Add your first household task to get started.
            </Text>

            <Pressable
              style={styles.primaryButton}
              onPress={() => router.push('/tasks/new')}
            >
              <Text style={styles.primaryButtonText}>Create Task</Text>
            </Pressable>
          </View>
        ) : (
          recentTasks.map(renderTaskCard)
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F6F2',
  },
  eyebrow: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2A9D8F',
    marginBottom: 8,
  },
  headerRow: {
    marginBottom: 20,
  },
  headerTextWrap: {
    marginBottom: 12,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    color: '#5F6368',
  },
  householdPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F5F3',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  householdPillLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2A9D8F',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  householdPillText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#264653',
  },
  heroCard: {
    backgroundColor: '#264653',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  heroText: {
    color: '#E8EEF0',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 10,
  },
  heroSubtext: {
    color: '#BFD3D8',
    fontSize: 13,
    marginBottom: 16,
  },
  heroButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#264653',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#264653',
    fontSize: 15,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
  },
  statCardOverdue: {
    backgroundColor: '#FFF1F1',
    borderWidth: 1,
    borderColor: '#E59A9A',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 6,
  },
  statNumberOverdue: {
    color: '#B42318',
  },
  statLabel: {
    fontSize: 14,
    color: '#5F6368',
  },
  statLabelOverdue: {
    color: '#B42318',
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  sectionLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2A9D8F',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#5F6368',
    marginBottom: 16,
    lineHeight: 22,
  },
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  taskCardOverdue: {
    backgroundColor: '#FFF7F7',
    borderWidth: 1,
    borderColor: '#F2B8B5',
  },
  taskTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  taskTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  taskTitleCompleted: {
    color: '#5F6368',
    textDecorationLine: 'line-through',
  },
  taskTitleOverdue: {
    color: '#B42318',
  },
  taskMeta: {
    fontSize: 14,
    color: '#5F6368',
    marginBottom: 4,
  },
  taskMetaOverdue: {
    color: '#B42318',
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  statusBadgeOpen: {
    backgroundColor: '#E8F5F3',
  },
  statusBadgeOverdue: {
    backgroundColor: '#FEE4E2',
  },
  statusBadgeDone: {
    backgroundColor: '#264653',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusBadgeTextOpen: {
    color: '#2A9D8F',
  },
  statusBadgeTextOverdue: {
    color: '#B42318',
  },
  statusBadgeTextDone: {
    color: '#FFFFFF',
  },
});