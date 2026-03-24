import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
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
  return date.toISOString().slice(0, 10);
}

export default function CalendarScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  async function loadTasks() {
    try {
      setLoading(true);

      const householdId = await getCurrentHouseholdId();

      if (!householdId) {
        setTasks([]);
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

  const tasksForSelectedDate = useMemo(() => {
    return tasks.filter((task) => task.due_date === selectedDate);
  }, [tasks, selectedDate]);

  const upcomingTasks = useMemo(() => {
    return tasks.filter(
      (task) =>
        !!task.due_date &&
        task.due_date > selectedDate &&
        !task.is_completed
    );
  }, [tasks, selectedDate]);

  function renderTask(item: Task) {
    return (
      <Pressable
        key={item.id}
        onPress={() => router.push(`/tasks/${item.id}`)}
        style={[styles.card, item.is_completed && styles.cardCompleted]}
      >
        <Text
          style={[
            styles.taskTitle,
            item.is_completed && styles.taskTitleCompleted,
          ]}
        >
          {item.title}
        </Text>

        {!!item.category && (
          <Text style={styles.metaText}>Category: {item.category}</Text>
        )}

        <Text style={styles.metaText}>
          {item.is_completed ? 'Completed' : 'Open'}
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
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Calendar</Text>
          <Text style={styles.subtitle}>Tasks by date</Text>
        </View>
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

      <Text style={styles.sectionTitle}>Due on this date</Text>

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
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => renderTask(item)}
          scrollEnabled={false}
          contentContainerStyle={{ paddingBottom: 12 }}
        />
      )}

      <Text style={styles.sectionTitle}>Upcoming</Text>

      {upcomingTasks.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No upcoming tasks</Text>
          <Text style={styles.emptyText}>
            Add due dates to tasks to see them here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={upcomingTasks.slice(0, 6)}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/tasks/${item.id}`)}
              style={styles.card}
            >
              <Text style={styles.taskTitle}>{item.title}</Text>
              <Text style={styles.metaText}>
                Due: {item.due_date ? formatDateLabel(item.due_date) : '—'}
              </Text>
              {!!item.category && (
                <Text style={styles.metaText}>Category: {item.category}</Text>
              )}
            </Pressable>
          )}
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
  metaText: {
    fontSize: 14,
    color: '#5F6368',
    marginBottom: 2,
  },
});