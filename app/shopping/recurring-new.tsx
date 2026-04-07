import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';

import { AppScreen } from '../../components/app-screen';
import { FormInput } from '../../components/form-input';
import { CategoryPicker } from '../../components/category-picker';
import { COLORS, RADIUS } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { getCurrentHouseholdId } from '../../lib/household';
import { refreshRecurringShoppingNotifications } from '../../lib/notification-polish';
import { SHOPPING_CATEGORIES } from '../../lib/shopping';

export default function NewRecurringTemplateScreen() {
  const [title, setTitle] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [category, setCategory] = useState('Other');
  const [notes, setNotes] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [isActive, setIsActive] = useState(true);
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
      if (!householdId) {
        Alert.alert('No household', 'Select a household first.');
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const { error } = await supabase.from('shopping_recurring_templates').insert({
        household_id: householdId,
        title: title.trim(),
        quantity: parsedQuantity,
        unit: unit.trim() || null,
        category,
        notes: notes.trim() || null,
        assigned_to: null,
        is_favorite: isFavorite,
        is_active: isActive,
        created_by: session?.user?.id ?? null,
      });

      if (error) {
        Alert.alert('Save failed', error.message);
        return;
      }

      await refreshRecurringShoppingNotifications();
      router.replace('/shopping/recurring');
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Could not save recurring item.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppScreen>
      <FormInput
        placeholder="Recurring item name"
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

      <Pressable
        style={[styles.toggleButton, isActive && styles.toggleButtonActive]}
        onPress={() => setIsActive((prev) => !prev)}
      >
        <Text
          style={[
            styles.toggleButtonText,
            isActive && styles.toggleButtonTextActive,
          ]}
        >
          {isActive ? 'Active: Yes' : 'Active: No'}
        </Text>
      </Pressable>

      <Pressable style={styles.button} onPress={handleSave} disabled={saving}>
        <Text style={styles.buttonText}>
          {saving ? 'Saving...' : 'Save Recurring Item'}
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