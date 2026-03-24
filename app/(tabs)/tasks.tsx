import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { getNoHouseholdRoute } from '../../lib/no-household-route';
import { supabase } from '../../lib/supabase';
import { getCurrentHouseholdId } from '../../lib/household';
import { AppScreen } from '../../components/app-screen';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';

type Task = {
  id: string;
  title: string;
  category: string | null;
  due_date: string | null;
  is_completed: boolean;
  assigned_to: string | null;
  assigned_name?: string | null;
};

export default function TasksScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

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
        .select('id, title, category, due_date, is_completed, assigned_to')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false });

      if (error) {
        Alert.alert('Load failed', error.message);
        return;
      }

      const taskRows = (data ?? []) as Task[];

      const assignedIds = Array.from(
        new Set(taskRows.map((task) => task.assigned_to).filter(Boolean))
      ) as string[];

      let nameMap = new Map<string, string | null>();

      if (assignedIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', assignedIds);

        if (profilesError) {
          Alert.alert('Load failed', profilesError.message);
          return;
        }

        nameMap = new Map(
          (profilesData ?? []).map((profile) => [
            profile.id as string,
            profile.full_name as string | null,
          ])
        );
      }

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
      Alert.alert('Update failed', error.message);
      return;
    }

    loadTasks();
  }

  function renderItem({ item }: { item: Task }) {
    return (
      <Pressable
        style={styles.card}
        onPress={() => router.push(`/tasks/${item.id}`)}
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
            ]}
            onPress={() => toggleComplete(item)}
          >
            <Text
              style={[
                styles.statusText,
                item.is_completed ? styles.doneText : styles.openText,
              ]}
            >
              {item.is_completed ? 'Done' : 'Open'}
            </Text>
          </Pressable>
        </View>

        {item.category ? (
          <Text style={styles.meta}>Category: {item.category}</Text>
        ) : null}

        {item.due_date ? (
          <Text style={styles.meta}>Due: {item.due_date}</Text>
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

        <Pressable
          style={styles.addButton}
          onPress={() => router.push('/tasks/new')}
        >
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        scrollEnabled={false}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No tasks yet.</Text>
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