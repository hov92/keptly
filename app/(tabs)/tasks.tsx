import { useCallback, useState } from 'react';
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

export default function TasksScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

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
        .order('created_at', { ascending: false });

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

  async function toggleComplete(task: Task) {
    const { error } = await supabase
      .from('tasks')
      .update({ is_completed: !task.is_completed })
      .eq('id', task.id);

    if (error) {
      console.error(error.message);
      return;
    }

    loadTasks();
  }

  const openTasks = tasks.filter((task) => !task.is_completed);
  const completedTasks = tasks.filter((task) => task.is_completed);

  function renderTask({ item }: { item: Task }) {
    return (
      <Pressable
        onPress={() => router.push(`/tasks/${item.id}`)}
        style={[styles.card, item.is_completed && styles.cardCompleted]}
      >
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
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
              {item.due_date ? `Due: ${item.due_date}` : 'No due date'}
            </Text>
          </View>

          <Pressable
            style={[
              styles.statusButton,
              item.is_completed && styles.statusButtonDone,
            ]}
            onPress={() => toggleComplete(item)}
          >
            <Text
              style={[
                styles.statusButtonText,
                item.is_completed && styles.statusButtonTextDone,
              ]}
            >
              {item.is_completed ? 'Undo' : 'Done'}
            </Text>
          </Pressable>
        </View>
      </Pressable>
    );
  }

  return (
    <Screen>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Tasks</Text>
          <Text style={styles.subtitle}>Your household task list</Text>
        </View>

        <Pressable
          style={styles.addButton}
          onPress={() => router.push('/tasks/new')}
        >
          <Text style={styles.addButtonText}>+ Add</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : tasks.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>No tasks yet</Text>
          <Text style={styles.emptyText}>
            Add your first household task to get started.
          </Text>

          <Pressable
            style={styles.primaryButton}
            onPress={() => router.push('/tasks/new')}
          >
            <Text style={styles.primaryButtonText}>Add Task</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={[{ type: 'open' }, ...openTasks, { type: 'completed' }, ...completedTasks]}
          keyExtractor={(item, index) =>
            'type' in item ? `${item.type}-${index}` : item.id
          }
          renderItem={({ item }) => {
            if ('type' in item) {
              return (
                <Text style={styles.sectionTitle}>
                  {item.type === 'open' ? 'Open Tasks' : 'Completed Tasks'}
                </Text>
              );
            }

            return renderTask({ item });
          }}
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  addButton: {
    backgroundColor: '#264653',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: '#5F6368',
    marginBottom: 18,
    fontSize: 15,
  },
  primaryButton: {
    backgroundColor: '#264653',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 10,
    marginTop: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardCompleted: {
    opacity: 0.75,
  },
  cardTop: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  taskTitle: {
    fontSize: 18,
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
  statusButton: {
    borderWidth: 1,
    borderColor: '#264653',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  statusButtonDone: {
    backgroundColor: '#264653',
  },
  statusButtonText: {
    color: '#264653',
    fontWeight: '600',
    fontSize: 13,
  },
  statusButtonTextDone: {
    color: '#FFFFFF',
  },
});