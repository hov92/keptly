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
import { getActiveHouseholdPermissions } from '../../lib/permissions';

type TaskDetail = {
  id: string;
  title: string;
  category: string | null;
  due_date: string | null;
  is_completed: boolean;
  assigned_to: string | null;
  assigned_name?: string | null;
};

type SharedMemberName = {
  id: string;
  full_name: string | null;
};

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [role, setRole] = useState<'owner' | 'member' | 'child' | null>(null);

  useEffect(() => {
    async function loadTask() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const userId = session?.user?.id ?? null;
        setCurrentUserId(userId);

        const permissions = await getActiveHouseholdPermissions();
        setRole(permissions.role);

        const { data, error } = await supabase
          .from('tasks')
          .select('id, title, category, due_date, is_completed, assigned_to')
          .eq('id', id)
          .single();

        if (error) {
          Alert.alert('Load failed', error.message);
          setLoading(false);
          return;
        }

        const taskRow = data as TaskDetail;

        if (permissions.role === 'child' && taskRow.assigned_to !== userId) {
          Alert.alert('Restricted', 'You can only view tasks assigned to you.');
          router.replace('/(tabs)/tasks');
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

  async function handleToggleComplete() {
    if (!task) return;

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

      setTask({
        ...task,
        is_completed: true,
      });
      return;
    }

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
      <AppScreen>
        <FormScreenHeader
          title="Task details"
          subtitle="Could not load this task."
        />
      </AppScreen>
    );
  }

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
          Assigned to: {task.assigned_name || 'Unassigned'}
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
          {task.is_completed ? 'Done' : 'Mark Done'}
        </Text>
      </Pressable>

      {role !== 'child' ? (
        <>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => router.push(`/tasks/edit/${task.id}`)}
          >
            <Text style={styles.secondaryButtonText}>Edit Task</Text>
          </Pressable>

          <Pressable style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>Delete Task</Text>
          </Pressable>
        </>
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