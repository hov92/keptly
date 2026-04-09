import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';

import { AppScreen } from '../../components/app-screen';
import { FormInput } from '../../components/form-input';
import { CategoryPicker } from '../../components/category-picker';
import { COLORS, RADIUS } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { getCurrentHouseholdId } from '../../lib/household';
import { SHOPPING_CATEGORIES } from '../../lib/shopping';
import type { ShoppingList } from '../../lib/shopping-lists';
import {
  type ShoppingRepeatRule,
  upsertRecurringTemplateFromShoppingItem,
} from '../../lib/shopping-recurring';

const REPEAT_OPTIONS: ShoppingRepeatRule[] = ['weekly', 'biweekly', 'monthly'];

export default function NewShoppingItemScreen() {
  const { listId, returnTo } = useLocalSearchParams<{
    listId?: string;
    returnTo?: string;
  }>();

  const [title, setTitle] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [category, setCategory] = useState('Other');
  const [notes, setNotes] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [selectedListId, setSelectedListId] = useState('');
  const [repeatRule, setRepeatRule] = useState<ShoppingRepeatRule | ''>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadLists() {
      const householdId = await getCurrentHouseholdId();
      if (!householdId) return;

      const { data, error } = await supabase
        .from('shopping_lists')
        .select(
          'id, household_id, name, color, icon, is_default, created_by, created_at, updated_at'
        )
        .eq('household_id', householdId)
        .order('created_at', { ascending: true });

      if (error) {
        Alert.alert('Load failed', error.message);
        return;
      }

      const rows = (data ?? []) as ShoppingList[];
      setLists(rows);

      if (listId && rows.some((list) => list.id === listId)) {
        setSelectedListId(listId);
        return;
      }

      const defaultList = rows.find((list) => list.is_default) ?? rows[0];
      setSelectedListId(defaultList?.id ?? '');
    }

    loadLists().catch(console.error);
  }, [listId]);

  async function handleSave() {
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

      const householdId = await getCurrentHouseholdId();
      if (!householdId) {
        Alert.alert('No household', 'Select a household first.');
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const { data: insertedItem, error } = await supabase
        .from('shopping_list_items')
        .insert({
          household_id: householdId,
          list_id: selectedListId,
          title: title.trim(),
          quantity: parsedQuantity,
          unit: unit.trim() || null,
          category,
          notes: notes.trim() || null,
          is_completed: false,
          is_favorite: isFavorite,
          created_by: session?.user?.id ?? null,
          assigned_to: null,
        })
        .select('id')
        .single();

      if (error) {
        Alert.alert('Save failed', error.message);
        return;
      }

      await upsertRecurringTemplateFromShoppingItem({
        householdId,
        listId: selectedListId,
        itemId: insertedItem.id,
        title: title.trim(),
        quantity: parsedQuantity,
        unit: unit.trim() || null,
        category,
        notes: notes.trim() || null,
        isFavorite,
        repeatRule: repeatRule || null,
        createdBy: session?.user?.id ?? null,
      });

      router.replace((returnTo as Href) || '/(tabs)/shopping');
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Could not save shopping item.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppScreen>
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
        optionLabels={Object.fromEntries(lists.map((list) => [list.id, list.name]))}
        placeholder="Select list"
      />

      <CategoryPicker
        label="Repeat"
        value={repeatRule}
        onChange={(value) => setRepeatRule((value as ShoppingRepeatRule | '') || '')}
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

      <Pressable style={styles.button} onPress={handleSave} disabled={saving}>
        <Text style={styles.buttonText}>
          {saving ? 'Saving...' : 'Save Item'}
        </Text>
      </Pressable>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: COLORS.primaryText,
    fontSize: 16,
    fontWeight: '600',
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
});