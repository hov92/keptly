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

import { AppScreen } from '../../../components/app-screen';
import { FormInput } from '../../../components/form-input';
import { CategoryPicker } from '../../../components/category-picker';
import { COLORS, RADIUS, SPACING } from '../../../constants/theme';
import { supabase } from '../../../lib/supabase';
import { refreshRecurringShoppingNotifications } from '../../../lib/notification-polish';
import { smartBack } from '../../../lib/navigation';
import { SHOPPING_CATEGORIES } from '../../../lib/shopping';

type RecurringTemplate = {
  id: string;
  title: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  notes: string | null;
  is_favorite: boolean;
  is_active: boolean;
};

export default function RecurringTemplateDetailScreen() {
  const { id, returnTo } = useLocalSearchParams<{
    id: string;
    returnTo?: string;
  }>();
  const navigation = useNavigation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [item, setItem] = useState<RecurringTemplate | null>(null);

  const [title, setTitle] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [category, setCategory] = useState('Other');
  const [notes, setNotes] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [isActive, setIsActive] = useState(true);

  function handleBack() {
    smartBack({
      navigation,
      returnTo,
      fallback: '/shopping/recurring',
    });
  }

  useEffect(() => {
    async function loadItem() {
      try {
        setLoading(true);

        const { data, error } = await supabase
          .from('shopping_recurring_templates')
          .select(
            'id, title, quantity, unit, category, notes, is_favorite, is_active'
          )
          .eq('id', id)
          .single();

        if (error) {
          Alert.alert('Load failed', error.message);
          return;
        }

        const nextItem = data as RecurringTemplate;
        setItem(nextItem);
        setTitle(nextItem.title ?? '');
        setQuantity(nextItem.quantity != null ? String(nextItem.quantity) : '');
        setUnit(nextItem.unit ?? '');
        setCategory(nextItem.category ?? 'Other');
        setNotes(nextItem.notes ?? '');
        setIsFavorite(nextItem.is_favorite ?? false);
        setIsActive(nextItem.is_active ?? true);
      } catch (error) {
        console.error(error);
        Alert.alert('Load failed', 'Could not load recurring item.');
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      loadItem();
    }
  }, [id]);

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

      const { error } = await supabase
        .from('shopping_recurring_templates')
        .update({
          title: title.trim(),
          quantity: parsedQuantity,
          unit: unit.trim() || null,
          category,
          notes: notes.trim() || null,
          is_favorite: isFavorite,
          is_active: isActive,
        })
        .eq('id', id);

      if (error) {
        Alert.alert('Save failed', error.message);
        return;
      }

      await refreshRecurringShoppingNotifications();
      handleBack();
    } catch (error) {
      console.error(error);
      Alert.alert('Save failed', 'Could not save recurring item.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!item) return;

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

          await refreshRecurringShoppingNotifications();
          router.replace('/shopping/recurring');
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
        <View style={styles.card}>
          <Text style={styles.emptyText}>Recurring item not found.</Text>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <Pressable onPress={handleBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>Back</Text>
      </Pressable>

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

      <Pressable style={styles.primaryButton} onPress={handleSave} disabled={saving}>
        <Text style={styles.primaryButtonText}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Text>
      </Pressable>

      <Pressable style={styles.deleteButton} onPress={handleDelete}>
        <Text style={styles.deleteButtonText}>Delete Recurring Item</Text>
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