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
};

type MemberOption = {
  id: string;
  full_name: string | null;
};

export default function ShoppingItemDetailScreen() {
  const { id, returnTo } = useLocalSearchParams<{
    id: string;
    returnTo?: string;
  }>();
  const navigation = useNavigation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [item, setItem] = useState<ShoppingItem | null>(null);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [lists, setLists] = useState<ShoppingList[]>([]);

  const [title, setTitle] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [category, setCategory] = useState('Other');
  const [notes, setNotes] = useState('');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [listId, setListId] = useState<string>('');

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
            'id, household_id, list_id, title, quantity, unit, category, notes, is_completed, is_favorite, assigned_to'
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
        setAssignedTo(nextItem.assigned_to ?? '');
        setListId(nextItem.list_id ?? '');

        const [{ data: namesData, error: namesError }, { data: listData, error: listError }] =
          await Promise.all([
            supabase.rpc('get_shared_household_member_names'),
            supabase
              .from('shopping_lists')
              .select(
                'id, household_id, name, color, icon, is_default, created_by, created_at, updated_at'
              )
              .eq('household_id', nextItem.household_id)
              .order('created_at', { ascending: true }),
          ]);

        if (namesError) {
          Alert.alert('Load failed', namesError.message);
          return;
        }

        if (listError) {
          Alert.alert('Load failed', listError.message);
          return;
        }

        setMembers((namesData ?? []) as MemberOption[]);
        setLists((listData ?? []) as ShoppingList[]);
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
    if (!title.trim()) {
      Alert.alert('Missing info', 'Enter an item name.');
      return;
    }

    if (!listId) {
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

      const { error } = await supabase
        .from('shopping_list_items')
        .update({
          list_id: listId,
          title: title.trim(),
          quantity: parsedQuantity,
          unit: unit.trim() || null,
          category,
          notes: notes.trim() || null,
          assigned_to: assignedTo || null,
        })
        .eq('id', id);

      if (error) {
        Alert.alert('Save failed', error.message);
        return;
      }

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

    const { error } = await supabase
      .from('shopping_list_items')
      .update({
        is_completed: !item.is_completed,
        last_purchased_at: !item.is_completed ? new Date().toISOString() : null,
      })
      .eq('id', item.id);

    if (error) {
      Alert.alert('Update failed', error.message);
      return;
    }

    setItem({
      ...item,
      is_completed: !item.is_completed,
    });
  }

  async function handleToggleFavorite() {
    if (!item) return;

    const { error } = await supabase
      .from('shopping_list_items')
      .update({ is_favorite: !item.is_favorite })
      .eq('id', item.id);

    if (error) {
      Alert.alert('Update failed', error.message);
      return;
    }

    setItem({
      ...item,
      is_favorite: !item.is_favorite,
    });
  }

  async function handleAddAgain() {
    if (!item) return;

    const nextListId = listId || item.list_id;
    if (!nextListId) {
      Alert.alert('Add again failed', 'No shopping list selected.');
      return;
    }

    const parsedQuantity =
      quantity.trim() === '' ? null : Number.parseFloat(quantity.trim());

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const { error } = await supabase.from('shopping_list_items').insert({
      household_id: item.household_id,
      list_id: nextListId,
      title: title.trim() || item.title,
      quantity: parsedQuantity,
      unit: unit.trim() || null,
      category,
      notes: notes.trim() || null,
      is_completed: false,
      is_favorite: item.is_favorite,
      created_by: session?.user?.id ?? null,
      assigned_to: assignedTo || null,
    });

    if (error) {
      Alert.alert('Add again failed', error.message);
      return;
    }

    Alert.alert('Added', 'A new copy was added to the shopping list.');
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
      <View style={styles.memberWrap}>
        {lists.map((list) => (
          <Pressable
            key={list.id}
            style={[
              styles.memberChip,
              listId === list.id && styles.memberChipActive,
            ]}
            onPress={() => setListId(list.id)}
          >
            <Text
              style={[
                styles.memberChipText,
                listId === list.id && styles.memberChipTextActive,
              ]}
            >
              {list.name}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Assign to</Text>
      <View style={styles.memberWrap}>
        <Pressable
          style={[
            styles.memberChip,
            assignedTo === '' && styles.memberChipActive,
          ]}
          onPress={() => setAssignedTo('')}
        >
          <Text
            style={[
              styles.memberChipText,
              assignedTo === '' && styles.memberChipTextActive,
            ]}
          >
            No one
          </Text>
        </Pressable>

        {members.map((member) => (
          <Pressable
            key={member.id}
            style={[
              styles.memberChip,
              assignedTo === member.id && styles.memberChipActive,
            ]}
            onPress={() => setAssignedTo(member.id)}
          >
            <Text
              style={[
                styles.memberChipText,
                assignedTo === member.id && styles.memberChipTextActive,
              ]}
            >
              {member.full_name || 'Member'}
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

      <Pressable style={styles.primaryButton} onPress={handleSave} disabled={saving}>
        <Text style={styles.primaryButtonText}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Text>
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={handleToggleComplete}>
        <Text style={styles.secondaryButtonText}>
          {item.is_completed ? 'Mark Active' : 'Mark Completed'}
        </Text>
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={handleToggleFavorite}>
        <Text style={styles.secondaryButtonText}>
          {item.is_favorite ? 'Remove Favorite' : 'Mark Favorite'}
        </Text>
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={handleAddAgain}>
        <Text style={styles.secondaryButtonText}>Add Again</Text>
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
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  emptyText: {
    color: COLORS.muted,
    fontSize: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  memberWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  memberChip: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  memberChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  memberChipText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 13,
  },
  memberChipTextActive: {
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