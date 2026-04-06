import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect, type Href } from 'expo-router';

import { Screen } from '../../components/screen';
import { supabase } from '../../lib/supabase';
import { getCurrentHouseholdId } from '../../lib/household';
import { getNoHouseholdRoute } from '../../lib/no-household-route';
import {
  formatRecurrenceLabel,
  WeekdayCode,
} from '../../lib/task-recurrence';
import { formatQuantity } from '../../lib/shopping';
import { isLowStock } from '../../lib/shopping-phase3';
import {
  getHouseholdActivity,
  type HouseholdActivityItem,
} from '../../lib/household-activity';

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

type ShoppingItem = {
  id: string;
  household_id: string;
  list_id: string;
  title: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  notes: string | null;
  is_completed: boolean;
  is_favorite: boolean;
  created_by: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  last_purchased_at?: string | null;
  created_by_name?: string | null;
  assigned_to_name?: string | null;
};

type PantryItem = {
  id: string;
  household_id: string;
  title: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  notes: string | null;
  low_stock_threshold: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type HouseholdActivityFeedItem = HouseholdActivityItem & {
  actor_name?: string;
  target_name?: string | null;
};

function shouldHideFromDefaultList(task: Task) {
  return task.is_completed && !!task.recurrence;
}

function formatActivityTime(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function getActivityPrimaryLabel(item: HouseholdActivityFeedItem) {
  const actor = item.actor_name || 'System';
  const target = item.target_name || 'someone';

  if (item.action === 'task_created') return `${actor} created a task`;
  if (item.action === 'task_completed') return `${actor} completed a task`;
  if (item.action === 'task_assigned') return `${actor} assigned a task to ${target}`;
  if (item.action === 'shopping_item_added') return `${actor} added a shopping item`;
  if (item.action === 'shopping_item_completed') return `${actor} completed a shopping item`;
  if (item.action === 'shopping_item_deleted') return `${actor} deleted a shopping item`;
  if (item.action === 'pantry_item_added') return `${actor} added a pantry item`;
  if (item.action === 'pantry_item_updated') return `${actor} updated a pantry item`;
  if (item.action === 'provider_added') return `${actor} added a provider`;
  if (item.action === 'service_record_added') return `${actor} added a service record`;
  if (item.action === 'member_invited') return `${actor} invited ${target}`;
  if (item.action === 'member_joined') return `${actor} joined the household`;

  return `${actor} ${item.action.replaceAll('_', ' ')}`;
}

function getStringDetail(
  details: Record<string, unknown> | null,
  keys: string[]
) {
  if (!details) return null;

  for (const key of keys) {
    const value = details[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  return null;
}

function getActivitySecondaryLabel(item: HouseholdActivityFeedItem) {
  const details = item.details ?? null;

  const title = getStringDetail(details, [
    'title',
    'task_title',
    'shopping_title',
    'item_title',
    'provider_name',
    'service_title',
    'name',
  ]);

  const category = getStringDetail(details, ['category']);
  const listName = getStringDetail(details, ['list_name']);
  const providerName = getStringDetail(details, ['provider_name']);
  const note = getStringDetail(details, ['note', 'notes']);

  if (item.action.startsWith('task_')) {
    if (title && category) return `${title} • ${category}`;
    if (title) return title;
  }

  if (item.action.startsWith('shopping_')) {
    if (title && listName) return `${title} • ${listName}`;
    if (title) return title;
  }

  if (item.action.startsWith('pantry_')) {
    if (title && category) return `${title} • ${category}`;
    if (title) return title;
  }

  if (item.action === 'service_record_added') {
    if (title && providerName) return `${title} • ${providerName}`;
    if (title) return title;
  }

  if (item.action === 'provider_added' && title) {
    return title;
  }

  if (note) return note;

  return null;
}

function getActivityTarget(item: HouseholdActivityFeedItem): Href | null {
  const details = item.details ?? null;
  if (!details) return null;

  const getId = (keys: string[]) => getStringDetail(details, keys);

  const taskId = getId(['task_id', 'id']);
  if (taskId && item.action.startsWith('task_')) {
    return {
      pathname: '/tasks/[id]',
      params: {
        id: taskId,
        returnTo: '/(tabs)',
      },
    } as Href;
  }

  const shoppingId = getId(['shopping_item_id', 'item_id', 'id']);
  if (
    shoppingId &&
    (item.action.startsWith('shopping_') ||
      item.action === 'shopping_item_added')
  ) {
    return {
      pathname: '/shopping/[id]',
      params: {
        id: shoppingId,
        returnTo: '/(tabs)/shopping',
      },
    } as Href;
  }

  const pantryId = getId(['pantry_item_id', 'item_id', 'id']);
  if (pantryId && item.action.startsWith('pantry_')) {
    return {
      pathname: '/shopping/pantry/[id]',
      params: {
        id: pantryId,
        returnTo: '/shopping/pantry',
      },
    } as Href;
  }

  const serviceRecordId = getId(['service_record_id', 'record_id', 'id']);
  if (serviceRecordId && item.action === 'service_record_added') {
    return {
      pathname: '/records/service-records/[id]',
      params: {
        id: serviceRecordId,
        returnTo: '/records/providers',
      },
    } as Href;
  }

  const providerId = getId(['provider_id', 'id']);
  if (providerId && item.action === 'provider_added') {
    return {
      pathname: '/records/providers/[id]',
      params: {
        id: providerId,
        returnTo: '/records/providers',
      },
    } as Href;
  }

  return null;
}

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [household, setHousehold] = useState<Household | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([]);
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [activityItems, setActivityItems] = useState<HouseholdActivityFeedItem[]>(
    []
  );
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

      const [
        { data: householdData, error: householdError },
        { data: tasksData, error: tasksError },
        { data: shoppingData, error: shoppingError },
        { data: pantryData, error: pantryError },
        { data: namesData, error: namesError },
        activityData,
      ] = await Promise.all([
        supabase
          .from('households')
          .select('id, name, home_type')
          .eq('id', householdId)
          .single(),
        supabase
          .from('tasks')
          .select(
            'id, title, category, due_date, is_completed, created_at, assigned_to, recurrence, recurrence_days, recurrence_interval'
          )
          .eq('household_id', householdId)
          .order('created_at', { ascending: false }),
        supabase
          .from('shopping_list_items')
          .select(
            'id, household_id, list_id, title, quantity, unit, category, notes, is_completed, is_favorite, created_by, assigned_to, created_at, updated_at, last_purchased_at'
          )
          .eq('household_id', householdId)
          .order('created_at', { ascending: false }),
        supabase
          .from('pantry_items')
          .select(
            'id, household_id, title, quantity, unit, category, notes, low_stock_threshold, created_by, created_at, updated_at'
          )
          .eq('household_id', householdId)
          .order('title', { ascending: true }),
        supabase.rpc('get_shared_household_member_names'),
        getHouseholdActivity(),
      ]);

      if (householdError) {
        console.error(householdError.message);
        return;
      }
      if (tasksError) {
        console.error(tasksError.message);
        return;
      }
      if (shoppingError) {
        console.error(shoppingError.message);
        return;
      }
      if (pantryError) {
        console.error(pantryError.message);
        return;
      }
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

      const taskRows = ((tasksData ?? []) as Task[]).filter(
        (task) => !shouldHideFromDefaultList(task)
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

      setShoppingItems(
        ((shoppingData ?? []) as ShoppingItem[]).map((item) => ({
          ...item,
          created_by_name: item.created_by
            ? (nameMap.get(item.created_by) ?? null)
            : null,
          assigned_to_name: item.assigned_to
            ? (nameMap.get(item.assigned_to) ?? null)
            : null,
        }))
      );

      setPantryItems((pantryData ?? []) as PantryItem[]);
      setActivityItems((activityData ?? []) as HouseholdActivityFeedItem[]);
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

  const overdueTasks = useMemo(
    () =>
      tasks.filter(
        (task) => !task.is_completed && !!task.due_date && task.due_date < today
      ),
    [tasks, today]
  );

  const dueTodayTasks = useMemo(
    () => tasks.filter((task) => !task.is_completed && task.due_date === today),
    [tasks, today]
  );

  const assignedToMeTasks = useMemo(
    () =>
      currentUserId
        ? tasks.filter(
            (task) => task.assigned_to === currentUserId && !task.is_completed
          )
        : [],
    [tasks, currentUserId]
  );

  const shoppingForMe = useMemo(
    () =>
      currentUserId
        ? shoppingItems.filter(
            (item) => item.assigned_to === currentUserId && !item.is_completed
          )
        : [],
    [shoppingItems, currentUserId]
  );

  const lowStockItems = useMemo(
    () => pantryItems.filter(isLowStock),
    [pantryItems]
  );

  const completedCount = tasks.filter((task) => task.is_completed).length;

  function renderTaskCard(task: Task) {
    const overdue =
      !task.is_completed && !!task.due_date && task.due_date < today;

    return (
      <Pressable
        key={task.id}
        onPress={() =>
          router.push({
            pathname: '/tasks/[id]',
            params: {
              id: task.id,
              returnTo: '/(tabs)',
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

  function renderShoppingCard(item: ShoppingItem) {
    return (
      <Pressable
        key={item.id}
        onPress={() =>
          router.push({
            pathname: '/shopping/[id]',
            params: {
              id: item.id,
              returnTo: '/(tabs)/shopping',
            },
          })
        }
        style={styles.infoCard}
      >
        <Text style={styles.infoCardTitle}>{item.title}</Text>

        {formatQuantity(item.quantity, item.unit) ? (
          <Text style={styles.infoCardMeta}>
            Qty: {formatQuantity(item.quantity, item.unit)}
          </Text>
        ) : null}

        <Text style={styles.infoCardMeta}>
          Assigned to: {item.assigned_to_name || 'Unassigned'}
        </Text>

        {!!item.notes ? (
          <Text style={styles.infoCardMeta}>Notes: {item.notes}</Text>
        ) : null}
      </Pressable>
    );
  }

  function renderPantryCard(item: PantryItem) {
    return (
      <Pressable
        key={item.id}
        onPress={() =>
          router.push({
            pathname: '/shopping/pantry/[id]',
            params: {
              id: item.id,
              returnTo: '/shopping/pantry',
            },
          })
        }
        style={[styles.infoCard, styles.lowStockCard]}
      >
        <View style={styles.taskTopRow}>
          <Text style={styles.infoCardTitle}>{item.title}</Text>
          <View style={[styles.statusBadge, styles.statusBadgeOverdue]}>
            <Text style={[styles.statusBadgeText, styles.statusBadgeTextOverdue]}>
              Low
            </Text>
          </View>
        </View>

        <Text style={styles.infoCardMeta}>
          Qty: {formatQuantity(item.quantity, item.unit) || 'Unknown'}
        </Text>

        <Text style={styles.infoCardMeta}>
          Threshold: {item.low_stock_threshold ?? 'Not set'}
        </Text>

        {!!item.category ? (
          <Text style={styles.infoCardMeta}>Category: {item.category}</Text>
        ) : null}
      </Pressable>
    );
  }

  function renderActivityCard(item: HouseholdActivityFeedItem) {
    const secondary = getActivitySecondaryLabel(item);
    const target = getActivityTarget(item);

    const content = (
      <>
        <Text style={styles.infoCardTitle}>{getActivityPrimaryLabel(item)}</Text>
        {secondary ? <Text style={styles.infoCardMeta}>{secondary}</Text> : null}
        <Text style={styles.activityTime}>{formatActivityTime(item.created_at)}</Text>
      </>
    );

    if (!target) {
      return (
        <View key={item.id} style={styles.infoCard}>
          {content}
        </View>
      );
    }

    return (
      <Pressable
        key={item.id}
        style={[styles.infoCard, styles.activityCardPressable]}
        onPress={() => router.push(target)}
      >
        {content}
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

        <Pressable
          style={styles.searchBarButton}
          onPress={() => router.push('/search')}
        >
          <Text style={styles.searchBarButtonText}>
            Search tasks, shopping, records...
          </Text>
        </Pressable>

        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Today at a glance</Text>
          <Text style={styles.heroText}>
            See what needs attention around the house right now.
          </Text>

          {!!household?.home_type && (
            <Text style={styles.heroSubtext}>{household.home_type} home</Text>
          )}

          <View style={styles.heroButtons}>
            <Pressable
              style={styles.primaryHeroButton}
              onPress={() => router.push('/tasks/new')}
            >
              <Text style={styles.primaryHeroButtonText}>Add Task</Text>
            </Pressable>

            <Pressable
              style={styles.secondaryHeroButton}
              onPress={() => router.push('/(tabs)/shopping')}
            >
              <Text style={styles.secondaryHeroButtonText}>Open Shopping</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <Pressable
            style={[styles.statCard, overdueTasks.length > 0 && styles.statCardOverdue]}
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
                overdueTasks.length > 0 && styles.statNumberOverdue,
              ]}
            >
              {overdueTasks.length}
            </Text>
            <Text
              style={[
                styles.statLabel,
                overdueTasks.length > 0 && styles.statLabelOverdue,
              ]}
            >
              Overdue
            </Text>
          </Pressable>

          <Pressable
            style={styles.statCard}
            onPress={() =>
              router.push({
                pathname: '/(tabs)/calendar',
                params: { filter: 'today' },
              })
            }
          >
            <Text style={styles.statNumber}>{dueTodayTasks.length}</Text>
            <Text style={styles.statLabel}>Due Today</Text>
          </Pressable>

          <Pressable
            style={styles.statCard}
            onPress={() =>
              router.push({
                pathname: '/(tabs)/shopping',
                params: { filter: 'assigned' },
              })
            }
          >
            <Text style={styles.statNumber}>{shoppingForMe.length}</Text>
            <Text style={styles.statLabel}>Shopping</Text>
          </Pressable>

          <Pressable
            style={styles.statCard}
            onPress={() => router.push('/shopping/pantry')}
          >
            <Text style={styles.statNumber}>{lowStockItems.length}</Text>
            <Text style={styles.statLabel}>Low Stock</Text>
          </Pressable>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Overdue Tasks</Text>
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/(tabs)/calendar',
                params: { filter: 'overdue' },
              })
            }
          >
            <Text style={styles.sectionLink}>See all</Text>
          </Pressable>
        </View>

        {overdueTasks.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No overdue tasks</Text>
            <Text style={styles.emptyText}>You’re caught up right now.</Text>
          </View>
        ) : (
          overdueTasks.slice(0, 3).map(renderTaskCard)
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Due Today</Text>
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/(tabs)/calendar',
                params: { filter: 'today' },
              })
            }
          >
            <Text style={styles.sectionLink}>See all</Text>
          </Pressable>
        </View>

        {dueTodayTasks.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nothing due today</Text>
            <Text style={styles.emptyText}>
              You do not have any tasks due today.
            </Text>
          </View>
        ) : (
          dueTodayTasks.slice(0, 3).map(renderTaskCard)
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Assigned to Me</Text>
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

        {assignedToMeTasks.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nothing assigned to you</Text>
            <Text style={styles.emptyText}>
              Tasks assigned to you will show up here.
            </Text>
          </View>
        ) : (
          assignedToMeTasks.slice(0, 3).map(renderTaskCard)
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Shopping for You</Text>
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/(tabs)/shopping',
                params: { filter: 'assigned' },
              })
            }
          >
            <Text style={styles.sectionLink}>See all</Text>
          </Pressable>
        </View>

        {shoppingForMe.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No shopping items assigned</Text>
            <Text style={styles.emptyText}>
              Assigned shopping items will show up here.
            </Text>
          </View>
        ) : (
          shoppingForMe.slice(0, 3).map(renderShoppingCard)
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Low Stock Pantry</Text>
          <Pressable onPress={() => router.push('/shopping/pantry')}>
            <Text style={styles.sectionLink}>See all</Text>
          </Pressable>
        </View>

        {lowStockItems.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Pantry looks good</Text>
            <Text style={styles.emptyText}>
              Nothing is below its low-stock threshold right now.
            </Text>
          </View>
        ) : (
          lowStockItems.slice(0, 3).map(renderPantryCard)
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
        </View>

        {activityItems.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No recent activity</Text>
            <Text style={styles.emptyText}>
              Household updates will show up here.
            </Text>
          </View>
        ) : (
          activityItems.slice(0, 5).map(renderActivityCard)
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Completed</Text>
          <Pressable onPress={() => router.push('/(tabs)/tasks')}>
            <Text style={styles.sectionLink}>See all</Text>
          </Pressable>
        </View>

        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{completedCount}</Text>
          <Text style={styles.emptyText}>
            completed tasks currently tracked in your household.
          </Text>
        </View>
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
  primaryHeroButton: {
    flex: 1,
    backgroundColor: '#1F3D47',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryHeroButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryHeroButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryHeroButtonText: {
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
    marginBottom: 0,
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
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  activityCardPressable: {
    borderWidth: 1,
    borderColor: '#E8E3DA',
  },
  lowStockCard: {
    backgroundColor: '#FFF8F3',
    borderWidth: 1,
    borderColor: '#F5D1B3',
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
  infoCardTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#1F1F1F',
    marginBottom: 8,
  },
  taskMeta: {
    fontSize: 14,
    color: '#5F6368',
    marginBottom: 4,
  },
  taskMetaOverdue: {
    color: '#B42318',
  },
  infoCardMeta: {
    fontSize: 14,
    color: '#5F6368',
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 13,
    color: '#8A8F98',
    marginTop: 6,
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
  searchBarButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E3DA',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  searchBarButtonText: {
    fontSize: 15,
    color: '#8A8F98',
  },
});