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

type Task = {
  id: string;
  title: string;
  category: string | null;
  due_date: string | null;
  is_completed: boolean;
  created_at: string;
};

type Household = {
  id: string;
  name: string;
  home_type: string | null;
};

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [household, setHousehold] = useState<Household | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);

  const loadDashboard = async () => {
    try {
      setLoading(true);

      const householdId = await getCurrentHouseholdId();

      if (!householdId) {
        router.replace('/household/create');
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
        .select('id, title, category, due_date, is_completed, created_at')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false });

      if (tasksError) {
        console.error(tasksError.message);
        return;
      }

      setHousehold(householdData as Household);
      setTasks((tasksData ?? []) as Task[]);
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

  function isOverdue(task: Task) {
    return !task.is_completed && !!task.due_date && task.due_date < today;
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
        <Text style={styles.title}>{household?.name ?? 'Keptly'}</Text>
        <Text style={styles.subtitle}>
          {household?.home_type
            ? `${household.home_type} household overview`
            : 'Keep your home on track'}
        </Text>

        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Today at a glance</Text>
          <Text style={styles.heroText}>
            Stay on top of what needs attention around the house.
          </Text>

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
          recentTasks.map((task) => {
            const overdue = isOverdue(task);

            return (
              <View
                key={task.id}
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
              </View>
            );
          })
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
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    color: '#5F6368',
    marginBottom: 20,
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
    marginBottom: 16,
  },
  heroButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    backgroundColor: '#264653',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
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