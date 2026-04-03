import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS, RADIUS, SPACING } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { getCurrentHouseholdId } from '../../lib/household';
import { getNoHouseholdRoute } from '../../lib/no-household-route';
import {
  formatQuantity,
  type ShoppingFilter,
  type ShoppingListItem,
} from '../../lib/shopping';

type SharedMemberName = {
  id: string;
  full_name: string | null;
};

type SectionRow = {
  title: string;
  data: ShoppingListItem[];
};

export default function ShoppingScreen() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<ShoppingFilter>('active');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  async function loadItems() {
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

      const { data, error } = await supabase
        .from('shopping_list_items')
        .select(
          'id, household_id, title, quantity, unit, category, notes, is_completed, created_by, assigned_to, created_at, updated_at'
        )
        .eq('household_id', householdId)
        .order('is_completed', { ascending: true })
        .order('category', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) {
        Alert.alert('Load failed', error.message);
        return;
      }

      const { data: namesData, error: namesError } = await supabase.rpc(
        'get_shared_household_member_names'
      );

      if (namesError) {
        Alert.alert('Load failed', namesError.message);
        return;
      }

      const nameMap = new Map(
        ((namesData ?? []) as SharedMemberName[]).map((row) => [
          row.id,
          row.full_name,
        ])
      );

      const rows = ((data ?? []) as ShoppingListItem[]).map((item) => ({
        ...item,
        created_by_name: item.created_by
          ? (nameMap.get(item.created_by) ?? null)
          : null,
        assigned_to_name: item.assigned_to
          ? (nameMap.get(item.assigned_to) ?? null)
          : null,
      }));

      setItems(rows);
    } catch (error) {
      console.error(error);
      Alert.alert('Load failed', 'Could not load shopping list.');
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [])
  );

  async function handleToggleComplete(item: ShoppingListItem) {
    const { error } = await supabase
      .from('shopping_list_items')
      .update({ is_completed: !item.is_completed })
      .eq('id', item.id);

    if (error) {
      Alert.alert('Update failed', error.message);
      return;
    }

    loadItems();
  }

  async function handleDelete(item: ShoppingListItem) {
    Alert.alert('Delete item?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase
            .from('shopping_list_items')
            .delete()
            .eq('id', item.id);

          if (error) {
            Alert.alert('Delete failed', error.message);
            return;
          }

          loadItems();
        },
      },
    ]);
  }

  const filteredItems = useMemo(() => {
    if (activeFilter === 'active') {
      return items.filter((item) => !item.is_completed);
    }

    if (activeFilter === 'completed') {
      return items.filter((item) => item.is_completed);
    }

    if (activeFilter === 'assigned') {
      return items.filter((item) => item.assigned_to === currentUserId);
    }

    return items;
  }, [items, activeFilter, currentUserId]);

  const sections = useMemo<SectionRow[]>(() => {
    const groups = new Map<string, ShoppingListItem[]>();

    for (const item of filteredItems) {
      const key = item.category?.trim() || 'Other';
      const existing = groups.get(key) ?? [];
      existing.push(item);
      groups.set(key, existing);
    }

    return [...groups.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([title, data]) => ({
        title,
        data,
      }));
  }, [filteredItems]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.title}>Shopping List</Text>
                <Text style={styles.subtitle}>
                  Shared grocery and household list.
                </Text>
              </View>

              <Pressable
                style={styles.addButton}
                onPress={() => router.push('/shopping/new')}
              >
                <Text style={styles.addButtonText}>Add</Text>
              </Pressable>
            </View>

            <View style={styles.filterRow}>
              {[
                ['all', 'All'],
                ['active', 'Active'],
                ['completed', 'Completed'],
                ['assigned', 'Assigned to me'],
              ].map(([value, label]) => (
                <Pressable
                  key={value}
                  style={[
                    styles.filterChip,
                    activeFilter === value && styles.filterChipActive,
                  ]}
                  onPress={() => setActiveFilter(value as ShoppingFilter)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      activeFilter === value && styles.filterChipTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => {
          const quantityLabel = formatQuantity(item.quantity, item.unit);

          return (
            <Pressable
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: '/shopping/[id]',
                  params: { id: item.id, returnTo: '/(tabs)/shopping' },
                })
              }
            >
              <View style={styles.cardTop}>
                <Pressable
                  style={[
                    styles.checkButton,
                    item.is_completed && styles.checkButtonDone,
                  ]}
                  onPress={() => handleToggleComplete(item)}
                >
                  <Text
                    style={[
                      styles.checkButtonText,
                      item.is_completed && styles.checkButtonTextDone,
                    ]}
                  >
                    {item.is_completed ? 'Done' : 'Open'}
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.deleteButton}
                  onPress={() => handleDelete(item)}
                >
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </Pressable>
              </View>

              <Text
                style={[
                  styles.itemTitle,
                  item.is_completed && styles.itemTitleDone,
                ]}
              >
                {item.title}
              </Text>

              {quantityLabel ? (
                <Text style={styles.meta}>Qty: {quantityLabel}</Text>
              ) : null}

              {item.notes ? <Text style={styles.meta}>Notes: {item.notes}</Text> : null}

              <Text style={styles.meta}>
                Added by: {item.created_by_name || 'Unknown'}
              </Text>

              {item.assigned_to_name ? (
                <Text style={styles.meta}>
                  Assigned to: {item.assigned_to_name}
                </Text>
              ) : null}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.card}>
            <Text style={styles.meta}>No items in this list yet.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },
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
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  filterChip: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 13,
  },
  filterChipTextActive: {
    color: COLORS.primaryText,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
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
    marginBottom: 10,
  },
  checkButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  checkButtonDone: {
    backgroundColor: COLORS.accentSoft,
    borderColor: COLORS.accentSoft,
  },
  checkButtonText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
  },
  checkButtonTextDone: {
    color: COLORS.accent,
  },
  deleteButton: {
    backgroundColor: COLORS.dangerSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  deleteButtonText: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  itemTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  itemTitleDone: {
    color: COLORS.muted,
    textDecorationLine: 'line-through',
  },
  meta: {
    fontSize: 14,
    color: COLORS.muted,
    marginBottom: 4,
  },
});