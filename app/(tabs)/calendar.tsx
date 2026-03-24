import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { Screen } from '../../components/screen';
import { supabase } from '../../lib/supabase';
import { getCurrentHouseholdId } from '../../lib/household';
import { getNoHouseholdRoute } from '../../lib/no-household-route';

type Task = {
  id: string;
  title: string;
  category: string | null;
  due_date: string | null;
  is_completed: boolean;
  created_at: string;
};

type FilterKey = 'today' | 'tomorrow' | 'next7' | 'overdue';

function toYMD(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDateLabel(dateString: string) {
  const date = new Date(`${dateString}T12:00:00`);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function shiftDate(dateString: string, days: number) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toYMD(date);
}

export default function CalendarScreen() {
  const params = useLocalSearchParams<{ filter?: string }>();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [activeFilter, setActiveFilter] = useState<FilterKey>('today');

  async function loadTasks() {
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
        .select('id, title, category, due_date, is_completed, created_at')
        .eq('household_id', householdId)
        .not('due_date', 'is', null)
        .order('due_date', { ascending: true });

      if (error) {
        console.error(error.message);
        return;
      }

      setTasks((data ?? []) as Task[]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [])
  );

  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = shiftDate(today, 1);
  const next7End = shiftDate(today, 7);

  function isOverdue(task: Task) {
    return !task.is_completed && !!task.due_date && task.due_date < today;
  }

  function applyFilter(filter: FilterKey) {
    setActiveFilter(filter);

    if (filter === 'today') {
      setSelectedDate(today);
      return;
    }

    if (filter === 'tomorrow') {
      setSelectedDate(tomorrow);
      return;
    }

    if (filter === 'next7') {
      setSelectedDate(today);
      return;
    }

    setSelectedDate(today);
  }

  useEffect(() => {
    if (params.filter === 'today') applyFilter('today');
    if (params.filter === 'tomorrow') applyFilter('tomorrow');
    if (params.filter === 'next7') applyFilter('next7');
    if (params.filter === 'overdue') applyFilter('overdue');
  }, [params.filter]);

  const filterDates = useMemo(() => {
    if (activeFilter === 'today') return [today];
    if (activeFilter === 'tomorrow') return [tomorrow];
    if (activeFilter === 'overdue') return [];

    const dates: string[] = [];
    for (let i = 0; i <= 7; i += 1) {
      dates.push(shiftDate(today, i));
    }
    return dates;
  }, [activeFilter, today, tomorrow]);

  const filteredTasks = useMemo(() => {
    if (activeFilter === 'overdue') {
      return tasks.filter(isOverdue);
    }

    return tasks.filter(
      (task) => !!task.due_date && filterDates.includes(task.due_date)
    );
  }, [tasks, filterDates, activeFilter]);

  const tasksForSelectedDate = useMemo(() => {
    return tasks.filter((task) => task.due_date === selectedDate);
  }, [tasks, selectedDate]);

  function renderTask(item: Task) {
    const overdue = isOverdue(item);

    return (
      <Pressable
        key={item.id}
        onPress={() => router.push(`/tasks/${item.id}`)}
        style={[styles.card, item.is_completed && styles.cardCompleted, overdue && styles.cardOverdue]}
      >
        <Text
          style={[
            styles.taskTitle,
            item.is_completed && styles.taskTitleCompleted,
            overdue && styles.taskTitleOverdue,
          ]}
        >
          {item.title}
        </Text>

        <Text style={[styles.metaText, overdue && styles.metaTextOverdue]}>
          Due: {item.due_date ? formatDateLabel(item.due_date) : '—'}
        </Text>

        {!!item.category && (
          <Text style={[styles.metaText, overdue && styles.metaTextOverdue]}>
            Category: {item.category}
          </Text>
        )}

        <View
          style={[
            styles.badge,
            item.is_completed
              ? styles.badgeDone
              : overdue
              ? styles.badgeOverdue
              : styles.badgeOpen,
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              item.is_completed
                ? styles.badgeTextDone
                : overdue
                ? styles.badgeTextOverdue
                : styles.badgeTextOpen,
            ]}
          >
            {item.is_completed ? 'Completed' : overdue ? 'Overdue' : 'Open'}
          </Text>
        </View>
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
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Calendar</Text>
          <Text style={styles.subtitle}>Tasks by date</Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        <Pressable
          style={[
            styles.filterChip,
            activeFilter === 'today' && styles.filterChipActive,
          ]}
          onPress={() => applyFilter('today')}
        >
          <Text
            style={[
              styles.filterChipText,
              activeFilter === 'today' && styles.filterChipTextActive,
            ]}
          >
            Today
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.filterChip,
            activeFilter === 'tomorrow' && styles.filterChipActive,
          ]}
          onPress={() => applyFilter('tomorrow')}
        >
          <Text
            style={[
              styles.filterChipText,
              activeFilter === 'tomorrow' && styles.filterChipTextActive,
            ]}
          >
            Tomorrow
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.filterChip,
            activeFilter === 'next7' && styles.filterChipActive,
          ]}
          onPress={() => applyFilter('next7')}
        >
          <Text
            style={[
              styles.filterChipText,
              activeFilter === 'next7' && styles.filterChipTextActive,
            ]}
          >
            Next 7 days
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.filterChip,
            activeFilter === 'overdue' && styles.filterChipOverdue,
          ]}
          onPress={() => applyFilter('overdue')}
        >
          <Text
            style={[
              styles.filterChipText,
              activeFilter === 'overdue' && styles.filterChipTextOverdue,
            ]}
          >
            Overdue
          </Text>
        </Pressable>
      </View>

      <View style={styles.datePickerCard}>
        <Pressable
          style={styles.dateNavButton}
          onPress={() => setSelectedDate((prev) => shiftDate(prev, -1))}
        >
          <Text style={styles.dateNavButtonText}>Prev</Text>
        </Pressable>

        <View style={styles.dateCenter}>
          <Text style={styles.dateLabel}>{formatDateLabel(selectedDate)}</Text>
          <Text style={styles.dateSubLabel}>Selected date</Text>
        </View>

        <Pressable
          style={styles.dateNavButton}
          onPress={() => setSelectedDate((prev) => shiftDate(prev, 1))}
        >
          <Text style={styles.dateNavButtonText}>Next</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>
        {activeFilter === 'today'
          ? 'Today'
          : activeFilter === 'tomorrow'
          ? 'Tomorrow'
          : activeFilter === 'overdue'
          ? 'Overdue'
          : `Next 7 days (${formatDateLabel(today)} - ${formatDateLabel(
              next7End
            )})`}
      </Text>

      {filteredTasks.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No tasks in this range</Text>
          <Text style={styles.emptyText}>
            Add due dates to tasks to see them here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredTasks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => renderTask(item)}
          scrollEnabled={false}
          contentContainerStyle={{ paddingBottom: 12 }}
        />
      )}

      <Text style={styles.sectionTitle}>Selected date details</Text>

      {tasksForSelectedDate.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Nothing due</Text>
          <Text style={styles.emptyText}>
            No tasks are due on {formatDateLabel(selectedDate)}.
          </Text>
        </View>
      ) : (
        <FlatList
          data={tasksForSelectedDate}
          keyExtractor={(item) => `${item.id}-selected`}
          renderItem={({ item }) => renderTask(item)}
          scrollEnabled={false}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
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
  headerRow: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#5F6368',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  filterChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6E0D8',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  filterChipActive: {
    backgroundColor: '#264653',
    borderColor: '#264653',
  },
  filterChipOverdue: {
    backgroundColor: '#FEE4E2',
    borderColor: '#F2B8B5',
  },
  filterChipText: {
    color: '#1F1F1F',
    fontWeight: '600',
    fontSize: 14,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  filterChipTextOverdue: {
    color: '#B42318',
  },
  datePickerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateNavButton: {
    backgroundColor: '#264653',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dateNavButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  dateCenter: {
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  dateSubLabel: {
    fontSize: 13,
    color: '#5F6368',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 12,
    marginTop: 4,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: '#5F6368',
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardCompleted: {
    opacity: 0.7,
  },
  cardOverdue: {
    backgroundColor: '#FFF7F7',
    borderWidth: 1,
    borderColor: '#F2B8B5',
  },
  taskTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F1F1F',
    marginBottom: 6,
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#5F6368',
  },
  taskTitleOverdue: {
    color: '#B42318',
  },
  metaText: {
    fontSize: 14,
    color: '#5F6368',
    marginBottom: 6,
  },
  metaTextOverdue: {
    color: '#B42318',
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  badgeOpen: {
    backgroundColor: '#E8F5F3',
  },
  badgeOverdue: {
    backgroundColor: '#FEE4E2',
  },
  badgeDone: {
    backgroundColor: '#264653',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  badgeTextOpen: {
    color: '#2A9D8F',
  },
  badgeTextOverdue: {
    color: '#B42318',
  },
  badgeTextDone: {
    color: '#FFFFFF',
  },
});