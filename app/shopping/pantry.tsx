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

import { AppScreen } from '../../components/app-screen';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { getCurrentHouseholdId } from '../../lib/household';
import { formatQuantity } from '../../lib/shopping';
import { isLowStock, type PantryItem } from '../../lib/shopping-phase3';

export default function PantryScreen() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PantryItem[]>([]);

  async function loadPantry() {
    try {
      setLoading(true);

      const householdId = await getCurrentHouseholdId();
      if (!householdId) {
        setItems([]);
        return;
      }

      const { data, error } = await supabase
        .from('pantry_items')
        .select(
          'id, household_id, title, quantity, unit, category, notes, low_stock_threshold, created_by, created_at, updated_at'
        )
        .eq('household_id', householdId)
        .order('title', { ascending: true });

      if (error) {
        Alert.alert('Load failed', error.message);
        return;
      }

      setItems((data ?? []) as PantryItem[]);
    } catch (error) {
      console.error(error);
      Alert.alert('Load failed', 'Could not load pantry.');
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadPantry();
    }, [])
  );

  async function handleAddToShopping(item: PantryItem) {
    const householdId = await getCurrentHouseholdId();
    if (!householdId) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const { error } = await supabase.from('shopping_list_items').insert({
      household_id: householdId,
      title: item.title,
      quantity: null,
      unit: item.unit,
      category: item.category,
      notes: item.notes,
      is_completed: false,
      source_type: 'pantry',
      created_by: session?.user?.id ?? null,
    });

    if (error) {
      Alert.alert('Add failed', error.message);
      return;
    }

    Alert.alert('Added', 'Item added to shopping list.');
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
        <Text style={styles.title}>Pantry</Text>

        <Pressable
          style={styles.addButton}
          onPress={() => router.push('/shopping/pantry-new')}
        >
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.meta}>
              Qty: {formatQuantity(item.quantity, item.unit) || 'None'}
            </Text>
            <Text style={styles.meta}>Category: {item.category || 'Other'}</Text>
            <Text style={styles.meta}>
              Low stock at: {item.low_stock_threshold ?? 'Not set'}
            </Text>
            {isLowStock(item) ? (
              <Text style={styles.lowStockText}>Low stock</Text>
            ) : null}

            <Pressable
              style={styles.secondaryButton}
              onPress={() => handleAddToShopping(item)}
            >
              <Text style={styles.secondaryButtonText}>Add to Shopping</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.card}>
            <Text style={styles.meta}>No pantry items yet.</Text>
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
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.text,
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
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  meta: {
    fontSize: 14,
    color: COLORS.muted,
    marginBottom: 4,
  },
  lowStockText: {
    color: COLORS.danger,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 8,
  },
  secondaryButton: {
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontWeight: '700',
  },
});