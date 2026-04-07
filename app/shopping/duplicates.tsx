import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS, RADIUS, SPACING } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { formatQuantity, type ShoppingListItem } from '../../lib/shopping';
import { getCurrentHouseholdId } from '../../lib/household';

type DuplicateGroup = {
  key: string;
  title: string;
  items: ShoppingListItem[];
};

function normalizeDuplicateKey(
  item: Pick<ShoppingListItem, 'title' | 'unit' | 'category'>
) {
  return [
    item.title.trim().toLowerCase(),
    item.unit?.trim().toLowerCase() || '',
    item.category?.trim().toLowerCase() || '',
  ].join('::');
}

export default function ShoppingDuplicatesScreen() {
  const { listId, returnTo } = useLocalSearchParams<{
    listId?: string;
    returnTo?: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [workingGroupKey, setWorkingGroupKey] = useState<string | null>(null);

  async function loadDuplicates() {
    try {
      setLoading(true);

      const householdId = await getCurrentHouseholdId();
      if (!householdId) {
        setItems([]);
        return;
      }

      let query = supabase
        .from('shopping_list_items')
        .select(
          'id, household_id, list_id, title, quantity, unit, category, notes, is_completed, is_favorite, created_by, assigned_to, created_at, updated_at, last_purchased_at'
        )
        .eq('household_id', householdId)
        .eq('is_completed', false)
        .order('title', { ascending: true })
        .order('created_at', { ascending: true });

      if (listId) {
        query = query.eq('list_id', listId);
      }

      const { data, error } = await query;

      if (error) {
        Alert.alert('Load failed', error.message);
        return;
      }

      setItems((data ?? []) as ShoppingListItem[]);
    } catch (error) {
      console.error(error);
      Alert.alert('Load failed', 'Could not load duplicate items.');
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadDuplicates();
    }, [listId])
  );

  const duplicateGroups = useMemo<DuplicateGroup[]>(() => {
    const groups = new Map<string, ShoppingListItem[]>();

    for (const item of items) {
      const key = normalizeDuplicateKey(item);
      const existing = groups.get(key) ?? [];
      existing.push(item);
      groups.set(key, existing);
    }

    return [...groups.entries()]
      .filter(([, group]) => group.length > 1)
      .sort(
        (a, b) =>
          b[1].length - a[1].length || a[1][0].title.localeCompare(b[1][0].title)
      )
      .map(([key, group]) => ({
        key,
        title: group[0].title,
        items: group,
      }));
  }, [items]);

  async function handleKeepOneDeleteRest(group: DuplicateGroup, keepId: string) {
    try {
      setWorkingGroupKey(group.key);

      const deleteIds = group.items
        .filter((item) => item.id !== keepId)
        .map((item) => item.id);

      if (deleteIds.length === 0) return;

      const { error } = await supabase
        .from('shopping_list_items')
        .delete()
        .in('id', deleteIds);

      if (error) {
        Alert.alert('Resolve failed', error.message);
        return;
      }

      await loadDuplicates();
    } catch (error) {
      console.error(error);
      Alert.alert('Resolve failed', 'Could not remove duplicates.');
    } finally {
      setWorkingGroupKey(null);
    }
  }

  async function handleMergeInto(group: DuplicateGroup, keepId: string) {
    try {
      setWorkingGroupKey(group.key);

      const keepItem = group.items.find((item) => item.id === keepId);
      if (!keepItem) return;

      const otherItems = group.items.filter((item) => item.id !== keepId);

      const mergedQuantityValues = group.items
        .map((item) => item.quantity)
        .filter((value): value is number => typeof value === 'number');

      const mergedQuantity =
        mergedQuantityValues.length > 0
          ? mergedQuantityValues.reduce((sum, value) => sum + value, 0)
          : keepItem.quantity ?? null;

      const mergedNotes = [
        keepItem.notes?.trim(),
        ...otherItems.map((item) => item.notes?.trim()),
      ]
        .filter((value): value is string => !!value)
        .filter((value, index, arr) => arr.indexOf(value) === index)
        .join(' | ');

      const shouldFavorite = group.items.some((item) => item.is_favorite);

      const { error: updateError } = await supabase
        .from('shopping_list_items')
        .update({
          quantity: mergedQuantity,
          notes: mergedNotes || null,
          is_favorite: shouldFavorite,
        })
        .eq('id', keepId);

      if (updateError) {
        Alert.alert('Merge failed', updateError.message);
        return;
      }

      const deleteIds = otherItems.map((item) => item.id);
      if (deleteIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('shopping_list_items')
          .delete()
          .in('id', deleteIds);

        if (deleteError) {
          Alert.alert('Merge failed', deleteError.message);
          return;
        }
      }

      await loadDuplicates();
    } catch (error) {
      console.error(error);
      Alert.alert('Merge failed', 'Could not merge duplicates.');
    } finally {
      setWorkingGroupKey(null);
    }
  }

  function handleDone() {
    const nextRoute: Href = (returnTo as Href) || '/(tabs)/shopping';
    router.replace(nextRoute);
  }

  function renderGroup(group: DuplicateGroup) {
    const isWorking = workingGroupKey === group.key;

    return (
      <View style={styles.groupCard}>
        <View style={styles.groupHeader}>
          <Text style={styles.groupTitle}>{group.title}</Text>
          <View style={styles.groupBadge}>
            <Text style={styles.groupBadgeText}>{group.items.length} items</Text>
          </View>
        </View>

        {group.items.map((item, index) => (
          <View key={item.id} style={styles.itemCard}>
            <Text style={styles.itemIndex}>Option {index + 1}</Text>

            {formatQuantity(item.quantity, item.unit) ? (
              <Text style={styles.itemMeta}>
                Qty: {formatQuantity(item.quantity, item.unit)}
              </Text>
            ) : null}

            {item.category ? (
              <Text style={styles.itemMeta}>Category: {item.category}</Text>
            ) : null}

            {item.notes ? (
              <Text style={styles.itemMeta}>Notes: {item.notes}</Text>
            ) : null}

            {item.is_favorite ? (
              <Text style={styles.favoriteMeta}>Favorite</Text>
            ) : null}

            <View style={styles.actionRow}>
              <Pressable
                style={[
                  styles.actionButton,
                  isWorking && styles.actionButtonDisabled,
                ]}
                onPress={() => handleKeepOneDeleteRest(group, item.id)}
                disabled={isWorking}
              >
                <Text style={styles.actionButtonText}>
                  {isWorking ? 'Working...' : 'Keep This'}
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.mergeButton,
                  isWorking && styles.actionButtonDisabled,
                ]}
                onPress={() => handleMergeInto(group, item.id)}
                disabled={isWorking}
              >
                <Text style={styles.mergeButtonText}>Merge Into This</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>
    );
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
      <FlatList
        data={duplicateGroups}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.headerRow}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>Resolve Duplicates</Text>
              <Text style={styles.subtitle}>
                Review repeated items and clean up your list.
              </Text>
            </View>

            <Pressable style={styles.doneButton} onPress={handleDone}>
              <Text style={styles.doneButtonText}>Done</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => renderGroup(item)}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No duplicates left</Text>
            <Text style={styles.emptyText}>
              This list looks clean right now.
            </Text>
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
  center: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
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
    lineHeight: 22,
  },
  doneButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  doneButtonText: {
    color: COLORS.primaryText,
    fontWeight: '700',
  },
  groupCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  groupTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  groupBadge: {
    backgroundColor: '#FFF7ED',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  groupBadgeText: {
    color: '#9A4D00',
    fontWeight: '700',
    fontSize: 12,
  },
  itemCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  itemIndex: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 6,
  },
  itemMeta: {
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
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  actionButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionButtonText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  mergeButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  mergeButtonText: {
    color: COLORS.primaryText,
    fontWeight: '700',
    fontSize: 13,
  },
  actionButtonDisabled: {
    opacity: 0.55,
  },
  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.muted,
  },
});