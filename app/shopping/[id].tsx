import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';

import { AppScreen } from '../../components/app-screen';
import { FormInput } from '../../components/form-input';
import { CategoryPicker } from '../../components/category-picker';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { smartBack } from '../../lib/navigation';
import { SHOPPING_CATEGORIES } from '../../lib/shopping';
import type { ShoppingList } from '../../lib/shopping-lists';
import {
  type ShoppingRepeatRule,
  formatRepeatRuleLabel,
  markRecurringTemplateCompletedFromItem,
  stopRecurringTemplateFromItem,
  upsertRecurringTemplateFromShoppingItem,
} from '../../lib/shopping-recurring';

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
  assigned_to: string | null;
  created_by: string | null;
  generated_by_recurring?: boolean | null;
};

const REPEAT_OPTIONS: ShoppingRepeatRule[] = ['weekly', 'biweekly', 'monthly'];

export default function ShoppingItemDetailScreen() {
  const { id, returnTo } = useLocalSearchParams<{
    id: string;
    returnTo?: string;
  }>();
  const navigation = useNavigation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [item, setItem] = useState<ShoppingItem | null>(null);
  const [lists, setLists] = useState<ShoppingList[]>([]);

  const [title, setTitle] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [category, setCategory] = useState('Other');
  const [notes, setNotes] = useState('');
  const [selectedListId, setSelectedListId] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [repeatRule, setRepeatRule] = useState<ShoppingRepeatRule | ''>('');

  const repeatLabel = formatRepeatRuleLabel(repeatRule || null);

  function handleBack() {
    smartBack({
      navigation,
      returnTo,
      fallback: '/(tabs)/shopping',
    });
  }

  useEffect(() => {
    async function loadItem() {
      try {
        setLoading(true);

        const { data, error } = await supabase
          .from('shopping_list_items')
          .select(
            'id, household_id, list_id, title, quantity, unit, category, notes, is_completed, is_favorite, assigned_to, created_by, generated_by_recurring'
          )
          .eq('id', id)
          .single();

        if (error) {
          Alert.alert('Load failed', error.message);
          return;
        }

        const nextItem = data as ShoppingItem;
        setItem(nextItem);
        setTitle(nextItem.title ?? '');
        setQuantity(nextItem.quantity != null ? String(nextItem.quantity) : '');
        setUnit(nextItem.unit ?? '');
        setCategory(nextItem.category ?? 'Other');
        setNotes(nextItem.notes ?? '');
        setSelectedListId(nextItem.list_id);
        setIsFavorite(nextItem.is_favorite ?? false);

        const { data: listData, error: listError } = await supabase
          .from('shopping_lists')
          .select(
            'id, household_id, name, color, icon, is_default, created_by, created_at, updated_at'
          )
          .eq('household_id', nextItem.household_id)
          .order('created_at', { ascending: true });

        if (listError) {
          Alert.alert('Load failed', listError.message);
          return;
        }

        setLists((listData ?? []) as ShoppingList[]);

        const { data: recurringTemplate, error: recurringError } = await supabase
          .from('shopping_recurring_templates')
          .select('repeat_rule')
          .eq('source_item_id', id)
          .maybeSingle();

        if (recurringError) {
          Alert.alert('Load failed', recurringError.message);
          return;
        }

        setRepeatRule(
          (recurringTemplate?.repeat_rule as ShoppingRepeatRule | null) ?? ''
        );
      } catch (error) {
        console.error(error);
        Alert.alert('Load failed', 'Could not load this item.');
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      loadItem();
    }
  }, [id]);

  async function handleSave() {
    if (!item) return;

    if (!title.trim()) {
      Alert.alert('Missing info', 'Enter an item name.');
      return;
    }

    if (!selectedListId) {
      Alert.alert('Missing info', 'Choose a list.');
      return;
    }

    const parsedQuantity =
      quantity.trim() === '' ? null : Number.parseFloat(quantity.trim());

    if (quantity.trim() !== '' && Number.isNaN(parsedQuantity as number)) {
      Alert.alert('Invalid quantity', 'Enter a valid quantity.');
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from('shopping_list_items')
        .update({
          title: title.trim(),
          list_id: selectedListId,
          quantity: parsedQuantity,
          unit: unit.trim() || null,
          category,
          notes: notes.trim() || null,
          is_favorite: isFavorite,
          generated_by_recurring: false,
        })
        .eq('id', id);

      if (error) {
        Alert.alert('Save failed', error.message);
        return;
      }

      await upsertRecurringTemplateFromShoppingItem({
        householdId: item.household_id,
        listId: selectedListId,
        itemId: item.id,
        title: title.trim(),
        quantity: parsedQuantity,
        unit: unit.trim() || null,
        category,
        notes: notes.trim() || null,
        isFavorite,
        repeatRule: repeatRule || null,
        createdBy: item.created_by ?? null,
      });

      handleBack();
    } catch (error) {
      console.error(error);
      Alert.alert('Save failed', 'Could not save this item.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleComplete() {
    if (!item) return;

    const isBecomingComplete = !item.is_completed;

    const { error } = await supabase
      .from('shopping_list_items')
      .update({
        is_completed: isBecomingComplete,
        last_purchased_at: isBecomingComplete ? new Date().toISOString() : null,
      })
      .eq('id', item.id);

    if (error) {
      Alert.alert('Update failed', error.message);
      return;
    }

    if (isBecomingComplete && repeatRule) {
      await markRecurringTemplateCompletedFromItem(item.id).catch(console.error);
      Alert.alert('Saved', 'This item will be added back later.');
    }

    setItem({
      ...item,
      is_completed: isBecomingComplete,
    });
  }

  async function handleStopRepeating() {
    if (!item) return;

    Alert.alert(
      'Stop repeating?',
      'This item will stay on your list history, but it will no longer repeat.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop repeating',
          style: 'destructive',
          onPress: async () => {
            try {
              await stopRecurringTemplateFromItem(item.id);
              setRepeatRule('');
              Alert.alert('Updated', 'This item will no longer repeat.');
            } catch (error) {
              console.error(error);
              Alert.alert('Update failed', 'Could not stop repeating.');
            }
          },
        },
      ]
    );
  }

  async function handleDelete() {
    if (!item) return;

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

          router.replace('/(tabs)/shopping');
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

  if (!item) {
    return (
      <AppScreen>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.emptyText}>Item not found.</Text>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <Pressable onPress={handleBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>Back</Text>
      </Pressable>

      <View style={styles.headerCard}>
        <Text style={styles.headerTitle}>{title || 'Item details'}</Text>

        <View style={styles.headerMetaWrap}>
          {repeatLabel ? (
            <View style={styles.repeatBadge}>
              <Text style={styles.repeatBadgeText}>Repeats: {repeatLabel}</Text>
            </View>
          ) : null}

          {item.generated_by_recurring ? (
            <View style={styles.generatedBadge}>
              <Text style={styles.generatedBadgeText}>Added automatically</Text>
            </View>
          ) : null}
        </View>
      </View>

      <FormInput
        placeholder="Item name"
        value={title}
        onChangeText={setTitle}
        returnKeyType="done"
      />

      <FormInput
        placeholder="Quantity"
        value={quantity}
        onChangeText={setQuantity}
        keyboardType="decimal-pad"
        returnKeyType="done"
      />

      <FormInput
        placeholder="Unit (optional)"
        value={unit}
        onChangeText={setUnit}
        returnKeyType="done"
      />

      <CategoryPicker
        label="Category"
        value={category}
        onChange={(value) => setCategory(value || 'Other')}
        options={[...SHOPPING_CATEGORIES]}
        placeholder="Select category"
      />

      <CategoryPicker
        label="List"
        value={selectedListId}
        onChange={(value) => setSelectedListId(value || '')}
        options={lists.map((list) => list.id)}
        optionLabels={Object.fromEntries(
          lists.map((list) => [list.id, list.name])
        )}
        placeholder="Select list"
      />

      <CategoryPicker
        label="Repeat"
        value={repeatRule}
        onChange={(value) =>
          setRepeatRule((value as ShoppingRepeatRule | '') || '')
        }
        options={[...REPEAT_OPTIONS]}
        placeholder="Don't repeat"
      />

      <FormInput
        placeholder="Notes (optional)"
        value={notes}
        onChangeText={setNotes}
        multiline
      />

      <Pressable
        style={[styles.toggleButton, isFavorite && styles.toggleButtonActive]}
        onPress={() => setIsFavorite((prev) => !prev)}
      >
        <Text
          style={[
            styles.toggleButtonText,
            isFavorite && styles.toggleButtonTextActive,
          ]}
        >
          {isFavorite ? 'Favorite: Yes' : 'Favorite: No'}
        </Text>
      </Pressable>

      {repeatRule ? (
        <Pressable
          style={styles.stopRepeatingButton}
          onPress={handleStopRepeating}
        >
          <Text style={styles.stopRepeatingButtonText}>Stop Repeating</Text>
        </Pressable>
      ) : null}

      <Pressable
        style={styles.primaryButton}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.primaryButtonText}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Text>
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={handleToggleComplete}>
        <Text style={styles.secondaryButtonText}>
          {item.is_completed ? 'Mark Active' : 'Mark Completed'}
        </Text>
      </Pressable>

      <Pressable style={styles.deleteButton} onPress={handleDelete}>
        <Text style={styles.deleteButtonText}>Delete Item</Text>
      </Pressable>
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
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: SPACING.md,
  },
  backButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  headerCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  headerMetaWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  repeatBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EAF3F5',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  repeatBadgeText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  generatedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEF3F5',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  generatedBadgeText: {
    color: '#5D7680',
    fontSize: 13,
    fontWeight: '700',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  emptyText: {
    color: COLORS.muted,
    fontSize: 15,
  },
  toggleButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: COLORS.surface,
  },
  toggleButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  toggleButtonText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  toggleButtonTextActive: {
    color: COLORS.primaryText,
  },
  stopRepeatingButton: {
    backgroundColor: '#FFF4E5',
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  stopRepeatingButtonText: {
    color: '#B45309',
    fontSize: 15,
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
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