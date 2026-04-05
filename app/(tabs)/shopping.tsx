import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
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
  recurrenceLabel,
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
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [clearingCompleted, setClearingCompleted] = useState(false);

  async function loadItems() {
    try {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const userId = session?.user?.id ?? null;
      setCurrentUserId(userId);

      const nextHouseholdId = await getCurrentHouseholdId();
      setHouseholdId(nextHouseholdId);

      if (
        !nextHouseholdId ||
        nextHouseholdId === 'null' ||
        nextHouseholdId === 'undefined'
      ) {
        const route = await getNoHouseholdRoute();
        router.replace(route);
        return;
      }

      const { data, error } = await supabase
        .from('shopping_list_items')
        .select(
          'id, household_id, title, quantity, unit, category, notes, is_completed, is_favorite, is_in_pantry, created_by, assigned_to, created_at, updated_at, last_purchased_at, recurrence_type, recurrence_interval, next_recurrence_date'
        )
        .eq('household_id', nextHouseholdId)
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
    const updates: Record<string, unknown> = {
      is_completed: !item.is_completed,
    };

    if (!item.is_completed) {
      updates.last_purchased_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('shopping_list_items')
      .update(updates)
      .eq('id', item.id);

    if (error) {
      Alert.alert('Update failed', error.message);
      return;
    }

    loadItems();
  }

  async function handleToggleFavorite(item: ShoppingListItem) {
    const { error } = await supabase
      .from('shopping_list_items')
      .update({ is_favorite: !item.is_favorite })
      .eq('id', item.id);

    if (error) {
      Alert.alert('Update failed', error.message);
      return;
    }

    loadItems();
  }

  async function handleTogglePantry(item: ShoppingListItem) {
    const { error } = await supabase
      .from('shopping_list_items')
      .update({ is_in_pantry: !item.is_in_pantry })
      .eq('id', item.id);

    if (error) {
      Alert.alert('Update failed', error.message);
      return;
    }

    loadItems();
  }

  async function handleAddAgain(item: ShoppingListItem) {
    if (!householdId) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const { error } = await supabase.from('shopping_list_items').insert({
      household_id: householdId,
      title: item.title,
      quantity: item.quantity,
      unit: item.unit,
      category: item.category,
      notes: item.notes,
      is_completed: false,
      is_favorite: item.is_favorite,
      is_in_pantry: item.is_in_pantry,
      created_by: session?.user?.id ?? null,
      assigned_to: item.assigned_to,
      recurrence_type: item.recurrence_type ?? null,
      recurrence_interval: item.recurrence_interval ?? null,
      next_recurrence_date: item.next_recurrence_date ?? null,
    });

    if (error) {
      Alert.alert('Add again failed', error.message);
      return;
    }

    loadItems();
  }

  async function handleQuickAddFavorite(item: ShoppingListItem) {
    if (!householdId) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const { error } = await supabase.from('shopping_list_items').insert({
      household_id: householdId,
      title: item.title,
      quantity: item.quantity,
      unit: item.unit,
      category: item.category,
      notes: item.notes,
      is_completed: false,
      is_favorite: true,
      is_in_pantry: item.is_in_pantry,
      created_by: session?.user?.id ?? null,
      assigned_to: item.assigned_to,
      recurrence_type: item.recurrence_type ?? null,
      recurrence_interval: item.recurrence_interval ?? null,
      next_recurrence_date: item.next_recurrence_date ?? null,
    });

    if (error) {
      Alert.alert('Quick add failed', error.message);
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

  async function handleClearCompleted() {
    if (!householdId) return;

    Alert.alert(
      'Clear completed?',
      'This will delete all completed shopping items.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              setClearingCompleted(true);

              const { error } = await supabase
                .from('shopping_list_items')
                .delete()
                .eq('household_id', householdId)
                .eq('is_completed', true);

              if (error) {
                Alert.alert('Clear failed', error.message);
                return;
              }

              loadItems();
            } catch (error) {
              console.error(error);
              Alert.alert('Clear failed', 'Could not clear completed items.');
            } finally {
              setClearingCompleted(false);
            }
          },
        },
      ]
    );
  }

  const favorites = useMemo(
    () =>
      items
        .filter((item) => item.is_favorite)
        .sort((a, b) => a.title.localeCompare(b.title))
        .slice(0, 10),
    [items]
  );

  const recentItems = useMemo(
    () =>
      [...items]
        .filter((item) => !!item.last_purchased_at)
        .sort((a, b) => {
          const aTime = new Date(a.last_purchased_at || '').getTime();
          const bTime = new Date(b.last_purchased_at || '').getTime();
          return bTime - aTime;
        })
        .slice(0, 10),
    [items]
  );

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

    if (activeFilter === 'favorites') {
      return items.filter((item) => item.is_favorite);
    }

    if (activeFilter === 'pantry') {
      return items.filter((item) => item.is_in_pantry);
    }

    return items;
  }, [items, activeFilter, currentUserId]);

  const completedCount = useMemo(
    () => items.filter((item) => item.is_completed).length,
    [items]
  );

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
              <View style={styles.headerTextWrap}>
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

            {favorites.length > 0 ? (
              <View style={styles.quickBlock}>
                <Text style={styles.quickTitle}>Favorite quick add</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.quickRow}
                >
                  {favorites.map((item) => (
                    <Pressable
                      key={item.id}
                      style={styles.quickChip}
                      onPress={() => handleQuickAddFavorite(item)}
                    >
                      <Text style={styles.quickChipText}>{item.title}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {recentItems.length > 0 ? (
              <View style={styles.quickBlock}>
                <Text style={styles.quickTitle}>Buy again</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.quickRow}
                >
                  {recentItems.map((item) => (
                    <Pressable
                      key={item.id}
                      style={styles.quickChip}
                      onPress={() => handleAddAgain(item)}
                    >
                      <Text style={styles.quickChipText}>{item.title}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <View style={styles.filterRow}>
              {[
                ['all', 'All'],
                ['active', 'Active'],
                ['completed', 'Completed'],
                ['assigned', 'Assigned to me'],
                ['favorites', 'Favorites'],
                ['pantry', 'Pantry'],
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

            {completedCount > 0 ? (
              <Pressable
                style={styles.clearButton}
                onPress={handleClearCompleted}
                disabled={clearingCompleted}
              >
                <Text style={styles.clearButtonText}>
                  {clearingCompleted ? 'Clearing...' : 'Clear Completed'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => {
          const quantityLabel = formatQuantity(item.quantity, item.unit);
          const recurrence = recurrenceLabel(
            item.recurrence_type,
            item.recurrence_interval
          );

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

                <View style={styles.topActions}>
                  <Pressable
                    style={[
                      styles.favoriteButton,
                      item.is_favorite && styles.favoriteButtonActive,
                    ]}
                    onPress={() => handleToggleFavorite(item)}
                  >
                    <Text
                      style={[
                        styles.favoriteButtonText,
                        item.is_favorite && styles.favoriteButtonTextActive,
                      ]}
                    >
                      {item.is_favorite ? '★ Favorite' : '☆ Favorite'}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.pantryButton,
                      item.is_in_pantry && styles.pantryButtonActive,
                    ]}
                    onPress={() => handleTogglePantry(item)}
                  >
                    <Text
                      style={[
                        styles.pantryButtonText,
                        item.is_in_pantry && styles.pantryButtonTextActive,
                      ]}
                    >
                      {item.is_in_pantry ? 'Pantry' : 'Set Pantry'}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={styles.deleteButton}
                    onPress={() => handleDelete(item)}
                  >
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </Pressable>
                </View>
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

              {item.last_purchased_at ? (
                <Text style={styles.meta}>
                  Last purchased: {new Date(item.last_purchased_at).toLocaleDateString()}
                </Text>
              ) : null}

              {recurrence ? <Text style={styles.meta}>{recurrence}</Text> : null}

              <View style={styles.bottomActions}>
                <Pressable
                  style={styles.smallActionButton}
                  onPress={() => handleAddAgain(item)}
                >
                  <Text style={styles.smallActionText}>Add Again</Text>
                </Pressable>
              </View>
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
    gap: SPACING.sm,
  },
  headerTextWrap: {
    flex: 1,
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
  quickBlock: {
    marginBottom: SPACING.md,
  },
  quickTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  quickRow: {
    gap: SPACING.sm,
    paddingRight: SPACING.md,
  },
  quickChip: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  quickChipText: {
    color: COLORS.primary,
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
  clearButton: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.dangerSoft,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: SPACING.md,
  },
  clearButtonText: {
    color: COLORS.danger,
    fontWeight: '700',
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
    gap: SPACING.sm,
  },
  topActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
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
  favoriteButton: {
    backgroundColor: COLORS.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  favoriteButtonActive: {
    backgroundColor: '#FFF1DB',
    borderColor: '#F2C36B',
  },
  favoriteButtonText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
  },
  favoriteButtonTextActive: {
    color: '#9A5B00',
  },
  pantryButton: {
    backgroundColor: COLORS.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pantryButtonActive: {
    backgroundColor: COLORS.accentSoft,
    borderColor: COLORS.accent,
  },
  pantryButtonText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
  },
  pantryButtonTextActive: {
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
  bottomActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  smallActionButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  smallActionText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 12,
  },
});