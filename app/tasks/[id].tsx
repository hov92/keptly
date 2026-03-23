import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { supabase } from '../../lib/supabase';

type Task = {
  id: string;
  title: string;
  category: string | null;
  due_date: string | null;
  is_completed: boolean;
  created_at: string;
};

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadTask() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, category, due_date, is_completed, created_at')
        .eq('id', id)
        .single();

      if (error) {
        Alert.alert('Load failed', error.message);
        router.back();
        return;
      }

      setTask(data as Task);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      if (id) {
        loadTask();
      }
    }, [id])
  );

  async function handleToggleComplete() {
    if (!task) return;

    const { error } = await supabase
      .from('tasks')
      .update({ is_completed: !task.is_completed })
      .eq('id', task.id);

    if (error) {
      Alert.alert('Update failed', error.message);
      return;
    }

    loadTask();
  }

  function handleDelete() {
    if (!task) return;

    Alert.alert('Delete task?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('tasks').delete().eq('id', task.id);

          if (error) {
            Alert.alert('Delete failed', error.message);
            return;
          }

          router.replace('/(tabs)/tasks');
        },
      },
    ]);
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
      <View style={styles.center}>
        <Text style={styles.emptyText}>Task not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <Text style={styles.title}>{task.title}</Text>
      <Text style={styles.statusText}>
        {task.is_completed ? 'Completed' : 'Open'}
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>Category</Text>
        <Text style={styles.value}>{task.category || 'No category'}</Text>

        <Text style={styles.label}>Due date</Text>
        <Text style={styles.value}>{task.due_date || 'No due date'}</Text>

        <Text style={styles.label}>Created</Text>
        <Text style={styles.value}>
          {new Date(task.created_at).toLocaleDateString()}
        </Text>
      </View>

      <Pressable style={styles.primaryButton} onPress={handleToggleComplete}>
        <Text style={styles.primaryButtonText}>
          {task.is_completed ? 'Mark as Open' : 'Mark as Done'}
        </Text>
      </Pressable>

      <Pressable
        style={styles.secondaryButton}
        onPress={() => router.push(`/tasks/edit/${task.id}`)}
      >
        <Text style={styles.secondaryButtonText}>Edit Task</Text>
      </Pressable>

      <Pressable style={styles.deleteButton} onPress={handleDelete}>
        <Text style={styles.deleteButtonText}>Delete Task</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F6F2',
    padding: 24,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F6F2',
  },
  backButton: {
    marginBottom: 20,
    marginTop: 20,
  },
  backText: {
    color: '#2A9D8F',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 15,
    color: '#5F6368',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: '#5F6368',
    marginTop: 12,
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  primaryButton: {
    backgroundColor: '#264653',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#264653',
  },
  secondaryButtonText: {
    color: '#264653',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#C95A5A',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 16,
    color: '#5F6368',
  },
});