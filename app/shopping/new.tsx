import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';

import { AppScreen } from '../../components/app-screen';
import { FormInput } from '../../components/form-input';
import { CategoryPicker } from '../../components/category-picker';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { getCurrentHouseholdId } from '../../lib/household';
import { getNoHouseholdRoute } from '../../lib/no-household-route';
import { SHOPPING_CATEGORIES } from '../../lib/shopping';
import type { ShoppingList } from '../../lib/shopping-lists';

export default function NewShoppingItemScreen() {
  const { returnTo, listId: initialListId } = useLocalSearchParams<{
    returnTo?: string;
    listId?: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [selectedListId, setSelectedListId] = useState('');

  const [title, setTitle] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [category, setCategory] = useState('Produce');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    async function loadLists() {
      try {
        setLoading(true);

        const householdId = await getCurrentHouseholdId();

        if (!householdId || householdId === 'null' || householdId === 'undefined') {
          const route = await getNoHouseholdRoute();
          router.replace(route);
          return;
        }

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

        const nextLists = (data ?? []) as ShoppingList[];
        setLists(nextLists);

        const preselected =
          (initialListId &&
            nextLists.find((list) => list.id === initialListId)?.id) ||
          nextLists.find((list) => list.is_default)?.id ||
          nextLists[0]?.id ||
          '';

        setSelectedListId(preselected);
      } catch (error) {
        console.error(error);
        Alert.alert('Load failed', 'Could not load shopping lists.');
      } finally {
        setLoading(false);
      }
    }

    loadLists();
  }, [initialListId]);

  async function handleSave() {
    if (!title.trim()) {
      Alert.alert('Missing info', 'Enter an item name.');
      return;
    }

    if (!selectedListId) {
      Alert.alert('Missing list', 'Choose a list for this item.');
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

      if (!householdId || householdId === 'null' || householdId === 'undefined') {
        const route = await getNoHouseholdRoute();
        router.replace(route);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const { error } = await supabase.from('shopping_list_items').insert({
        household_id: householdId,
        list_id: selectedListId,
        title: title.trim(),
        quantity: parsedQuantity,
        unit: unit.trim() || null,
        category,
        notes: notes.trim() || null,
        created_by: session?.user?.id ?? null,
        is_completed: false,
      });

      if (error) {
        Alert.alert('Save failed', error.message);
        return;
      }

      router.replace((returnTo as Href) || ('/(tabs)/shopping' as Href));
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Could not save this item.');
    } finally {
      setSaving(false);
    }
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

      <Text style={styles.label}>List</Text>
      <View style={styles.chipWrap}>
        {lists.map((list) => (
          <Pressable
            key={list.id}
            style={[
              styles.listChip,
              selectedListId === list.id && styles.listChipActive,
            ]}
            onPress={() => setSelectedListId(list.id)}
          >
            <Text
              style={[
                styles.listChipText,
                selectedListId === list.id && styles.listChipTextActive,
              ]}
            >
              {list.name}
            </Text>
          </Pressable>
        ))}
      </View>

      <FormInput
        placeholder="Notes (optional)"
        value={notes}
        onChangeText={setNotes}
        multiline
      />

      <Pressable style={styles.button} onPress={handleSave} disabled={saving}>
        <Text style={styles.buttonText}>
          {saving ? 'Saving...' : 'Save Item'}
        </Text>
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
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  listChip: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  listChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  listChipText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 13,
  },
  listChipTextActive: {
    color: COLORS.primaryText,
  },
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
});