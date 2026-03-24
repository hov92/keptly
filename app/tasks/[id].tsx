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

import { supabase } from '../../lib/supabase';
import { AppScreen } from '../../components/app-screen';
import { FormScreenHeader } from '../../components/form-screen-header';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';

type TaskDetail = {
  id: string;
  title: string;
  category: string | null;
  due_date: string | null;
  is_completed: boolean;
  assigned_to: string | null;
  profiles?: {
    full_name: string | null;
  } | null;
};

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTask() {
      const { data, error } = await supabase
        .from('tasks')
        .select(
          'id, title, category, due_date, is_completed, assigned_to, profiles!tasks_assigned_to_fkey(full_name)'
        )
        .eq('id', id)
        .single();

      if (error) {
        Alert.alert('Load failed', error.message);
        router.back();
        return;
      }

      setTask(data as unknown as TaskDetail);
      setLoading(false);
    }

    if (id) {
      loadTask();
    }
  }, [id]);

  async function handleDelete() {
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

          router.replace('/tasks');
        },
      },
    ]);
  }

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

    setTask({
      ...task,
      is_completed: !task.is_completed,
    });
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

  const assignee = task.profiles?.full_name || null;

  return (
    <AppScreen>
      <FormScreenHeader
        title="Task details"
        subtitle="Review and update this household task."
      />

      <View style={styles.card}>
        <Text style={styles.title}>{task.title}</Text>

        <Text style={styles.meta}>
          Status: {task.is_completed ? 'Done' : 'Open'}
        </Text>

        <Text style={styles.meta}>
          Assigned to: {assignee || 'Unassigned'}
        </Text>

        <Text style={styles.meta}>
          Category: {task.category || 'None'}
        </Text>

        <Text style={styles.meta}>
          Due date: {task.due_date || 'No date selected'}
        </Text>
      </View>

      <Pressable style={styles.primaryButton} onPress={handleToggleComplete}>
        <Text style={styles.primaryButtonText}>
          {task.is_completed ? 'Mark Open' : 'Mark Done'}
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
  emptyText: {
    color: COLORS.muted,
    fontSize: 16,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  meta: {
    fontSize: 15,
    color: COLORS.muted,
    marginBottom: 8,
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
  secondaryButton: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  secondaryButtonText: {
    color: COLORS.primary,
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
});