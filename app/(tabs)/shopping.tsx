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
  type ShoppingFilter,
  type ShoppingListItem,
} from '../../lib/shopping';
import type { ShoppingList } from '../../lib/shopping-lists';

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
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<ShoppingFilter>('all');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [clearingCompleted, setClearingCompleted] = useState(false);

  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkWorking, setBulkWorking] = useState(false);

  async function loadData() {
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

      const [
        { data: listData, error: listError },
        { data: itemData, error: itemError },
        { data: namesData, error: namesError },
      ] = await Promise.all([
        supabase
          .from('shopping_lists')
          .select(
            'id, household_id, name, color, icon, is_default, created_by, created_at, updated_at'
          )
          .eq('household_id', nextHouseholdId)
          .order('created_at', { ascending: true }),
        supabase
          .from('shopping_list_items')
          .select(
            'id, household_id, list_id, title, quantity, unit, category, notes, is_completed, is_favorite, created_by, assigned_to, created_at, updated_at, last_purchased_at'
          )
          .eq('household_id', nextHouseholdId)
          .order('is_completed', { ascending: true })
          .order('category', { ascending: true })
          .order('created_at', { ascending: false }),
        supabase.rpc('get_shared_household_member_names'),
      ]);

      if (listError) {
        Alert.alert('Load failed', listError.message);
        return;
      }

      if (itemError) {
        Alert.alert('Load failed', itemError.message);
        return;
      }

      if (namesError) {
        Alert.alert('Load failed', namesError.message);
        return;
      }

      const listRows = (listData ?? []) as ShoppingList[];
      setLists(listRows);

      if (!activeListId) {
        const defaultList =
          listRows.find((list) => list.is_default) ?? listRows[0] ?? null;
        setActiveListId(defaultList?.id ?? null);
      } else if (!listRows.some((list) => list.id === activeListId)) {
        const fallback =
          listRows.find((list) => list.is_default) ?? listRows[0] ?? null;
        setActiveListId(fallback?.id ?? null);
      }

      const nameMap = new Map(
        ((namesData ?? []) as SharedMemberName[]).map((row) => [
          row.id,
          row.full_name,
        ])
      );

      const rows = ((itemData ?? []) as ShoppingListItem[]).map((item) => ({
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
      loadData();
    }, [])
  );

  async function handleToggleComplete(item: ShoppingListItem) {
    const updates: Record<string, unknown> = {
      is_completed: !item.is_completed,
    };

    if (!item.is_completed) {
      updates.last_purchased_at = new Date().toISOString();
    } else {
      updates.last_purchased_at = null;
    }

    const { error } = await supabase
      .from('shopping_list_items')
      .update(updates)
      .eq('id', item.id);

    if (error) {
      Alert.alert('Update failed', error.message);
      return;
    }

    loadData();
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

          loadData();
        },
      },
    ]);
  }

  async function handleClearCompleted() {
    if (!householdId || !activeListId) return;

    Alert.alert(
      'Clear completed?',
      'This will delete completed items from this list.',
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
                .eq('list_id', activeListId)
                .eq('is_completed', true);

              if (error) {
                Alert.alert('Clear failed', error.message);
                return;
              }

              loadData();
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

  const activeList = useMemo(
    () => lists.find((list) => list.id === activeListId) ?? null,
    [lists, activeListId]
  );

  const listScopedItems = useMemo(() => {
    if (!activeListId) return [];
    return items.filter((item) => item.list_id === activeListId);
  }, [items, activeListId]);

  const filteredItems = useMemo(() => {
    if (activeFilter === 'active') {
      return listScopedItems.filter((item) => !item.is_completed);
    }

    if (activeFilter === 'completed') {
      return listScopedItems.filter((item) => item.is_completed);
    }

    if (activeFilter === 'assigned') {
      return listScopedItems.filter((item) => item.assigned_to === currentUserId);
    }

    if (activeFilter === 'favorites') {
      return listScopedItems.filter((item) => item.is_favorite);
    }

    return listScopedItems;
  }, [listScopedItems, activeFilter, currentUserId]);

  const completedCount = useMemo(
    () => listScopedItems.filter((item) => item.is_completed).length,
    [listScopedItems]
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

  const visibleItemIds = useMemo(
    () => filteredItems.map((item) => item.id),
    [filteredItems]
  );

  const selectedItems = useMemo(
    () => filteredItems.filter((item) => selectedIds.includes(item.id)),
    [filteredItems, selectedIds]
  );

  const selectedCount = selectedIds.length;

  function enterSelectMode(initialId?: string) {
    setIsSelecting(true);
    if (initialId) {
      setSelectedIds((prev) =>
        prev.includes(initialId) ? prev : [...prev, initialId]
      );
    }
  }

  function exitSelectMode() {
    setIsSelecting(false);
    setSelectedIds([]);
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    );
  }

  function handleSelectAllVisible() {
    setSelectedIds(visibleItemIds);
  }

  function handleClearSelection() {
    setSelectedIds([]);
  }

  async function handleBulkComplete() {
    if (selectedCount === 0) return;

    try {
      setBulkWorking(true);

      const now = new Date().toISOString();
      const updates = selectedItems.map((item) =>
        supabase
          .from('shopping_list_items')
          .update({
            is_completed: true,
            last_purchased_at: item.is_completed ? item.last_purchased_at ?? null : now,
          })
          .eq('id', item.id)
      );

      const results = await Promise.all(updates);
      const failed = results.find((result) => result.error);

      if (failed?.error) {
        Alert.alert('Bulk update failed', failed.error.message);
        return;
      }

      exitSelectMode();
      loadData();
    } catch (error) {
      console.error(error);
      Alert.alert('Bulk update failed', 'Could not complete selected items.');
    } finally {
      setBulkWorking(false);
    }
  }

  async function handleBulkFavorite() {
    if (selectedCount === 0) return;

    try {
      setBulkWorking(true);

      const updates = selectedItems.map((item) =>
        supabase
          .from('shopping_list_items')
          .update({ is_favorite: true })
          .eq('id', item.id)
      );

      const results = await Promise.all(updates);
      const failed = results.find((result) => result.error);

      if (failed?.error) {
        Alert.alert('Bulk update failed', failed.error.message);
        return;
      }

      exitSelectMode();
      loadData();
    } catch (error) {
      console.error(error);
      Alert.alert('Bulk update failed', 'Could not favorite selected items.');
    } finally {
      setBulkWorking(false);
    }
  }

  async function handleBulkDeleteConfirmed() {
    try {
      setBulkWorking(true);

      const { error } = await supabase
        .from('shopping_list_items')
        .delete()
        .in('id', selectedIds);

      if (error) {
        Alert.alert('Bulk delete failed', error.message);
        return;
      }

      exitSelectMode();
      loadData();
    } catch (error) {
      console.error(error);
      Alert.alert('Bulk delete failed', 'Could not delete selected items.');
    } finally {
      setBulkWorking(false);
    }
  }

  function handleBulkDelete() {
    if (selectedCount === 0) return;

    Alert.alert(
      `Delete ${selectedCount} item${selectedCount === 1 ? '' : 's'}?`,
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: handleBulkDeleteConfirmed,
        },
      ]
    );
  }

  function handleBulkMove() {
    if (selectedCount === 0) return;

    const moveTargets = lists.filter((list) => list.id !== activeListId);
    if (moveTargets.length === 0) {
      Alert.alert('No other lists', 'Create another list first.');
      return;
    }

    Alert.alert('Move selected items', 'Choose a destination list.', [
      ...moveTargets.map((list) => ({
        text: list.name,
        onPress: async () => {
          try {
            setBulkWorking(true);

            const { error } = await supabase
              .from('shopping_list_items')
              .update({ list_id: list.id })
              .in('id', selectedIds);

            if (error) {
              Alert.alert('Move failed', error.message);
              return;
            }

            exitSelectMode();
            loadData();
          } catch (error) {
            console.error(error);
            Alert.alert('Move failed', 'Could not move selected items.');
          } finally {
            setBulkWorking(false);
          }
        },
      })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

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
          <View style={styles.headerWrap}>
            <View style={styles.titleRow}>
              <View style={styles.titleTextWrap}>
                <Text style={styles.title}>Shopping List</Text>
                <Text style={styles.subtitle}>
                  Shared grocery and household list.
                </Text>
              </View>

              {isSelecting ? (
                <Pressable style={styles.cancelButton} onPress={exitSelectMode}>
                  <Text style={styles.cancelButtonText}>Done</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={styles.addButton}
                  onPress={() =>
                    router.push({
                      pathname: '/shopping/new',
                      params: {
                        listId: activeListId ?? '',
                        returnTo: '/(tabs)/shopping',
                      },
                    })
                  }
                >
                  <Text style={styles.addButtonText}>Add</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.listHeaderRow}>
              <View style={styles.listScrollWrap}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.listScrollContent}
                >
                  <View style={styles.listChipWrap}>
                    {lists.map((list) => {
                      const isActive = activeListId === list.id;

                      return (
                        <Pressable
                          key={list.id}
                          style={[
                            styles.listChip,
                            isActive && styles.listChipActive,
                          ]}
                          onPress={() => {
                            setActiveListId(list.id);
                            exitSelectMode();
                          }}
                        >
                          <View
                            style={[
                              styles.listColorDot,
                              { backgroundColor: list.color || COLORS.primary },
                            ]}
                          />
                          <Text
                            style={[
                              styles.listChipText,
                              isActive && styles.listChipTextActive,
                            ]}
                          >
                            {list.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>

              <Pressable
                style={styles.manageListsButton}
                onPress={() => router.push('/shopping/lists')}
              >
                <Text style={styles.manageListsButtonText}>Lists</Text>
              </Pressable>
            </View>

            <View style={styles.filterRow}>
              {[
                ['all', 'All'],
                ['active', 'Active'],
                ['completed', 'Completed'],
                ['assigned', 'Assigned to me'],
                ['favorites', 'Favorites'],
              ].map(([value, label]) => (
                <Pressable
                  key={value}
                  style={[
                    styles.filterChip,
                    activeFilter === value && styles.filterChipActive,
                  ]}
                  onPress={() => {
                    setActiveFilter(value as ShoppingFilter);
                    exitSelectMode();
                  }}
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

            <View style={styles.summaryRow}>
              <Text style={styles.summaryText}>
                {activeList?.name || 'Current list'} • {filteredItems.length} visible
              </Text>

              {completedCount > 0 && !isSelecting ? (
                <Text style={styles.summaryText}>
                  {completedCount} completed
                </Text>
              ) : null}
            </View>

            {isSelecting ? (
              <View style={styles.bulkPanel}>
                <View style={styles.bulkHeaderRow}>
                  <Text style={styles.bulkTitle}>
                    {selectedCount} selected
                  </Text>

                  <View style={styles.bulkMiniActions}>
                    <Pressable
                      style={styles.bulkMiniButton}
                      onPress={handleSelectAllVisible}
                    >
                      <Text style={styles.bulkMiniButtonText}>Select All</Text>
                    </Pressable>

                    <Pressable
                      style={styles.bulkMiniButton}
                      onPress={handleClearSelection}
                    >
                      <Text style={styles.bulkMiniButtonText}>Clear</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.bulkActionsWrap}>
                  <Pressable
                    style={[
                      styles.bulkActionButton,
                      (selectedCount === 0 || bulkWorking) &&
                        styles.bulkActionButtonDisabled,
                    ]}
                    disabled={selectedCount === 0 || bulkWorking}
                    onPress={handleBulkComplete}
                  >
                    <Text style={styles.bulkActionButtonText}>
                      {bulkWorking ? 'Working...' : 'Complete'}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.bulkActionButton,
                      (selectedCount === 0 || bulkWorking) &&
                        styles.bulkActionButtonDisabled,
                    ]}
                    disabled={selectedCount === 0 || bulkWorking}
                    onPress={handleBulkFavorite}
                  >
                    <Text style={styles.bulkActionButtonText}>Favorite</Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.bulkActionButton,
                      (selectedCount === 0 || bulkWorking) &&
                        styles.bulkActionButtonDisabled,
                    ]}
                    disabled={selectedCount === 0 || bulkWorking}
                    onPress={handleBulkMove}
                  >
                    <Text style={styles.bulkActionButtonText}>Move</Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.bulkDeleteButton,
                      (selectedCount === 0 || bulkWorking) &&
                        styles.bulkActionButtonDisabled,
                    ]}
                    disabled={selectedCount === 0 || bulkWorking}
                    onPress={handleBulkDelete}
                  >
                    <Text style={styles.bulkDeleteButtonText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.topActionRow}>
                <Pressable
                  style={styles.selectModeButton}
                  onPress={() => enterSelectMode()}
                >
                  <Text style={styles.selectModeButtonText}>Select</Text>
                </Pressable>

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
            )}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => {
          const quantityLabel = formatQuantity(item.quantity, item.unit);
          const isSelected = selectedIds.includes(item.id);

          return (
            <Pressable
              style={[styles.card, isSelected && styles.cardSelected]}
              onLongPress={() => enterSelectMode(item.id)}
              onPress={() => {
                if (isSelecting) {
                  toggleSelected(item.id);
                  return;
                }

                router.push({
                  pathname: '/shopping/[id]',
                  params: {
                    id: item.id,
                    listId: activeListId ?? '',
                    returnTo: '/(tabs)/shopping',
                  },
                });
              }}
            >
              <View style={styles.cardTop}>
                <Pressable
                  style={[
                    styles.checkButton,
                    item.is_completed && styles.checkButtonDone,
                    isSelected && styles.checkButtonSelected,
                  ]}
                  onPress={() => {
                    if (isSelecting) {
                      toggleSelected(item.id);
                      return;
                    }
                    handleToggleComplete(item);
                  }}
                >
                  <Text
                    style={[
                      styles.checkButtonText,
                      item.is_completed && styles.checkButtonTextDone,
                      isSelected && styles.checkButtonTextSelected,
                    ]}
                  >
                    {isSelecting
                      ? isSelected
                        ? 'Selected'
                        : 'Select'
                      : item.is_completed
                      ? 'Done'
                      : 'Open'}
                  </Text>
                </Pressable>

                {!isSelecting ? (
                  <Pressable
                    style={styles.deleteButton}
                    onPress={() => handleDelete(item)}
                  >
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </Pressable>
                ) : null}
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

              {item.notes ? (
                <Text style={styles.meta}>Notes: {item.notes}</Text>
              ) : null}

              <Text style={styles.meta}>
                Added by: {item.created_by_name || 'Unknown'}
              </Text>

              {item.assigned_to_name ? (
                <Text style={styles.meta}>
                  Assigned to: {item.assigned_to_name}
                </Text>
              ) : null}

              {item.is_favorite ? (
                <Text style={styles.favoriteMeta}>Favorite</Text>
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
  headerWrap: {
    marginBottom: SPACING.md,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  titleTextWrap: {
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
    lineHeight: 22,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 18,
    paddingVertical: 12,
    minWidth: 92,
    alignItems: 'center',
  },
  addButtonText: {
    color: COLORS.primaryText,
    fontWeight: '700',
    fontSize: 16,
  },
  cancelButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 18,
    paddingVertical: 12,
    minWidth: 92,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 16,
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  listScrollWrap: {
    flex: 1,
  },
  listScrollContent: {
    paddingRight: 4,
  },
  listChipWrap: {
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'center',
  },
  listChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  listChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  listColorDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  listChipText: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 13,
  },
  listChipTextActive: {
    color: COLORS.primaryText,
  },
  manageListsButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageListsButtonText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  filterChip: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
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
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  summaryText: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  topActionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'center',
  },
  selectModeButton: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  selectModeButtonText: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  clearButton: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.dangerSoft,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  clearButtonText: {
    color: COLORS.danger,
    fontWeight: '700',
  },
  bulkPanel: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
  },
  bulkHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  bulkTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  bulkMiniActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  bulkMiniButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  bulkMiniButtonText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  bulkActionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  bulkActionButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bulkActionButtonText: {
    color: COLORS.primaryText,
    fontWeight: '700',
    fontSize: 13,
  },
  bulkDeleteButton: {
    backgroundColor: COLORS.dangerSoft,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bulkDeleteButtonText: {
    color: COLORS.danger,
    fontWeight: '700',
    fontSize: 13,
  },
  bulkActionButtonDisabled: {
    opacity: 0.55,
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
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#F2FAF8',
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
  checkButtonSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkButtonText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
  },
  checkButtonTextDone: {
    color: COLORS.accent,
  },
  checkButtonTextSelected: {
    color: COLORS.primaryText,
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
  favoriteMeta: {
    fontSize: 13,
    color: COLORS.accent,
    fontWeight: '700',
    marginTop: 4,
  },
});