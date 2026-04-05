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
import type { ShoppingRecurringTemplate } from '../../lib/shopping-phase3';

export default function RecurringTemplatesScreen() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ShoppingRecurringTemplate[]>([]);

  async function loadTemplates() {
    try {
      setLoading(true);

      const householdId = await getCurrentHouseholdId();
      if (!householdId) {
        setItems([]);
        return;
      }

      const { data, error } = await supabase
        .from('shopping_recurring_templates')
        .select(
          'id, household_id, title, quantity, unit, category, notes, assigned_to, is_favorite, is_active, created_by, created_at, updated_at'
        )
        .eq('household_id', householdId)
        .order('title', { ascending: true });

      if (error) {
        Alert.alert('Load failed', error.message);
        return;
      }

      setItems((data ?? []) as ShoppingRecurringTemplate[]);
    } catch (error) {
      console.error(error);
      Alert.alert('Load failed', 'Could not load recurring items.');
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadTemplates();
    }, [])
  );

  async function handleToggleActive(item: ShoppingRecurringTemplate) {
    const { error } = await supabase
      .from('shopping_recurring_templates')
      .update({ is_active: !item.is_active })
      .eq('id', item.id);

    if (error) {
      Alert.alert('Update failed', error.message);
      return;
    }

    loadTemplates();
  }

  async function handleDelete(item: ShoppingRecurringTemplate) {
    Alert.alert('Delete recurring item?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase
            .from('shopping_recurring_templates')
            .delete()
            .eq('id', item.id);

          if (error) {
            Alert.alert('Delete failed', error.message);
            return;
          }

          loadTemplates();
        },
      },
    ]);
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
        <Text style={styles.title}>Recurring Items</Text>

        <Pressable
          style={styles.addButton}
          onPress={() => router.push('/shopping/recurring-new')}
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
              Favorite: {item.is_favorite ? 'Yes' : 'No'}
            </Text>
            <Text style={styles.meta}>
              Active: {item.is_active ? 'Yes' : 'No'}
            </Text>

            <View style={styles.actionRow}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => handleToggleActive(item)}
              >
                <Text style={styles.secondaryButtonText}>
                  {item.is_active ? 'Deactivate' : 'Activate'}
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
        )}
        ListEmptyComponent={
          <View style={styles.card}>
            <Text style={styles.meta}>No recurring items yet.</Text>
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
  actionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  secondaryButton: {
    flex: 1,
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
  deleteButton: {
    flex: 1,
    backgroundColor: COLORS.dangerSoft,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: COLORS.danger,
    fontWeight: '700',
  },
});