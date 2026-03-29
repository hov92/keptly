import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Calendar } from 'react-native-calendars';

import { Screen } from '../../components/screen';
import { supabase } from '../../lib/supabase';
import { getCurrentHouseholdId } from '../../lib/household';
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
  recurrence: 'daily' | 'weekly' | 'monthly' | 'weekdays' | null;
  recurrence_days: WeekdayCode[] | null;
  recurrence_interval: number | null;
};

type FilterKey = 'calendar' | 'today' | 'week' | 'recurring' | 'overdue';

function toYMD(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shiftDate(dateString: string, days: number) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toYMD(date);
}

function formatDateLabel(dateString: string) {
  const date = new Date(`${dateString}T12:00:00`);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatSectionHeader(dateString: string, today: string) {
  if (dateString === today) return `Today • ${formatDateLabel(dateString)}`;

  const tomorrow = shiftDate(today, 1);
  if (dateString === tomorrow) {
    return `Tomorrow • ${formatDateLabel(dateString)}`;
  }

  const date = new Date(`${dateString}T12:00:00`);
  const weekday = date.toLocaleDateString(undefined, { weekday: 'long' });
  return `${weekday} • ${formatDateLabel(dateString)}`;
}

export default function CalendarScreen() {
  const params = useLocalSearchParams<{ filter?: string }>();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('calendar');
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
        .select(
          'id, title, category, due_date, is_completed, created_at, recurrence, recurrence_days, recurrence_interval'
        )
        .eq('household_id', householdId)
        .not('due_date', 'is', null)
        .order('due_date', { ascending: true })
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

  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = shiftDate(today, 6);

  function isOverdue(task: Task) {
    return !task.is_completed && !!task.due_date && task.due_date < today;
  }

  function applyFilter(filter: FilterKey) {
    setActiveFilter(filter);

    if (filter === 'today') {
      setSelectedDate(today);
    }
  }

  useMemo(() => {
    if (params.filter === 'today') applyFilter('today');
    if (params.filter === 'next7') applyFilter('week');
    if (params.filter === 'overdue') applyFilter('overdue');
  }, [params.filter]);

  const markedDates = useMemo(() => {
    const marked: Record<string, any> = {};

    tasks.forEach((task) => {
      if (!task.due_date) return;

      const existing = marked[task.due_date] ?? {
        marked: true,
        dots: [],
      };

      let color = '#2A9D8F';

      if (task.is_completed) {
        color = '#264653';
      } else if (isOverdue(task)) {
        color = '#B42318';
      } else if (task.recurrence) {
        color = '#7C3AED';
      }

      const hasDot = existing.dots?.some((dot: any) => dot.color === color);

      marked[task.due_date] = {
        ...existing,
        marked: true,
        dots: hasDot
          ? existing.dots
          : [...(existing.dots ?? []), { key: `${task.id}-${color}`, color }],
      };
    });

    marked[selectedDate] = {
      ...(marked[selectedDate] ?? {}),
      selected: true,
      selectedColor: '#264653',
    };

    return marked;
  }, [tasks, selectedDate]);

  const selectedDateTasks = useMemo(() => {
    return tasks.filter((task) => task.due_date === selectedDate);
  }, [tasks, selectedDate]);

  const filteredTasks = useMemo(() => {
    if (activeFilter === 'today') {
      return tasks.filter((task) => task.due_date === today);
    }

    if (activeFilter === 'week') {
      return tasks.filter(
        (task) =>
          !!task.due_date &&
          task.due_date >= today &&
          task.due_date <= weekEnd
      );
    }

    if (activeFilter === 'recurring') {
      return tasks.filter((task) => !!task.recurrence);
    }

    if (activeFilter === 'overdue') {
      return tasks.filter(isOverdue);
    }

    return [];
  }, [tasks, activeFilter, today, weekEnd]);

  const groupedFilteredTasks = useMemo(() => {
    const groups = new Map<string, Task[]>();

    filteredTasks.forEach((task) => {
      const key = task.due_date ?? 'No date';
      const current = groups.get(key) ?? [];
      current.push(task);
      groups.set(key, current);
    });

    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, items]) => ({
        date,
        title: formatSectionHeader(date, today),
        items,
      }));
  }, [filteredTasks, today]);

  function renderTask(item: Task) {
    const overdue = isOverdue(item);

    return (
      <Pressable
        key={item.id}
        onPress={() =>
          router.push({
  pathname: '/tasks/[id]',
  params: {
    id: item.id,
    returnTo: '/(tabs)/calendar',
  },
})
        }
        style={[
          styles.card,
          item.is_completed && styles.cardCompleted,
          overdue && styles.cardOverdue,
        ]}
      >
        <View style={styles.cardTopRow}>
          <Text
            style={[
              styles.taskTitle,
              item.is_completed && styles.taskTitleCompleted,
              overdue && styles.taskTitleOverdue,
            ]}
          >
            {item.title}
          </Text>

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
        </View>

        {!!item.category && (
          <Text style={[styles.metaText, overdue && styles.metaTextOverdue]}>
            Category: {item.category}
          </Text>
        )}

        <Text style={[styles.metaText, overdue && styles.metaTextOverdue]}>
          Due: {item.due_date ? formatDateLabel(item.due_date) : '—'}
        </Text>

        {item.recurrence ? (
          <Text style={[styles.metaText, overdue && styles.metaTextOverdue]}>
            Repeats:{' '}
            {formatRecurrenceLabel({
              recurrence: item.recurrence,
              recurrenceDays: item.recurrence_days,
              recurrenceInterval: item.recurrence_interval,
            })}
          </Text>
        ) : null}
      </Pressable>
    );
  }

  function getRangeTitle() {
    if (activeFilter === 'today') return 'Today';
    if (activeFilter === 'week') {
      return `This week (${formatDateLabel(today)} - ${formatDateLabel(weekEnd)})`;
    }
    if (activeFilter === 'recurring') return 'Recurring tasks';
    if (activeFilter === 'overdue') return 'Overdue tasks';
    return formatSectionHeader(selectedDate, today);
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
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Calendar</Text>
            <Text style={styles.subtitle}>View tasks by date</Text>
          </View>
        </View>

        <View style={styles.filterRow}>
          <Pressable
            style={[
              styles.filterChip,
              activeFilter === 'calendar' && styles.filterChipActive,
            ]}
            onPress={() => applyFilter('calendar')}
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === 'calendar' && styles.filterChipTextActive,
              ]}
            >
              Calendar
            </Text>
          </Pressable>

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
              activeFilter === 'week' && styles.filterChipActive,
            ]}
            onPress={() => applyFilter('week')}
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === 'week' && styles.filterChipTextActive,
              ]}
            >
              This Week
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.filterChip,
              activeFilter === 'recurring' && styles.filterChipActive,
            ]}
            onPress={() => applyFilter('recurring')}
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === 'recurring' && styles.filterChipTextActive,
              ]}
            >
              Recurring
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

        {activeFilter === 'calendar' ? (
          <>
            <View style={styles.calendarCard}>
              <Calendar
                markingType="multi-dot"
                markedDates={markedDates}
                onDayPress={(day) => setSelectedDate(day.dateString)}
                theme={{
                  backgroundColor: '#FFFFFF',
                  calendarBackground: '#FFFFFF',
                  textSectionTitleColor: '#5F6368',
                  selectedDayBackgroundColor: '#264653',
                  selectedDayTextColor: '#FFFFFF',
                  todayTextColor: '#2A9D8F',
                  dayTextColor: '#1F1F1F',
                  textDisabledColor: '#C5C8CE',
                  monthTextColor: '#1F1F1F',
                  arrowColor: '#264653',
                  textDayFontWeight: '500',
                  textMonthFontWeight: '700',
                  textDayHeaderFontWeight: '600',
                }}
              />
            </View>

            <Text style={styles.sectionTitle}>{getRangeTitle()}</Text>

            {selectedDateTasks.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No tasks for this day</Text>
                <Text style={styles.emptyText}>
                  No tasks are due on {formatDateLabel(selectedDate)}.
                </Text>
              </View>
            ) : (
              selectedDateTasks.map(renderTask)
            )}
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>{getRangeTitle()}</Text>

            {groupedFilteredTasks.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No tasks found</Text>
                <Text style={styles.emptyText}>
                  {activeFilter === 'recurring'
                    ? 'Recurring tasks will show up here.'
                    : 'No tasks match this filter right now.'}
                </Text>
              </View>
            ) : (
              groupedFilteredTasks.map((group) => (
                <View key={group.date} style={styles.groupSection}>
                  <Text style={styles.groupHeader}>{group.title}</Text>
                  {group.items.map(renderTask)}
                </View>
              ))
            )}
          </>
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
  calendarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 10,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 12,
  },
  groupSection: {
    marginBottom: 20,
  },
  groupHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#264653',
    marginBottom: 10,
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
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  taskTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#1F1F1F',
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
    marginTop: 2,
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