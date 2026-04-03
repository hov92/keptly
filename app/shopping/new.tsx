import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';

import { AppScreen } from '../../components/app-screen';
import { FormInput } from '../../components/form-input';
import { CategoryPicker } from '../../components/category-picker';
import { COLORS, RADIUS } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { getCurrentHouseholdId } from '../../lib/household';
import { getNoHouseholdRoute } from '../../lib/no-household-route';
import { SHOPPING_CATEGORIES } from '../../lib/shopping';

export default function NewShoppingItemScreen() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();

  const [title, setTitle] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [category, setCategory] = useState('Produce');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim()) {
      Alert.alert('Missing info', 'Enter an item name.');
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
        title: title.trim(),
        quantity: parsedQuantity,
        unit: unit.trim() || null,
        category,
        notes: notes.trim() || null,
        created_by: session?.user?.id ?? null,
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