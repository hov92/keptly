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
import { COLORS, RADIUS, SPACING } from '../../../constants/theme';
import { supabase } from '../../../lib/supabase';
import { smartBack } from '../../../lib/navigation';
import {
  SHOPPING_LIST_COLORS,
  SHOPPING_LIST_ICONS,
} from '../../../lib/shopping-lists';

type ShoppingListRow = {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  is_default: boolean;
};

export default function ShoppingListDetailScreen() {
  const { id, returnTo } = useLocalSearchParams<{
    id: string;
    returnTo?: string;
  }>();
  const navigation = useNavigation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [list, setList] = useState<ShoppingListRow | null>(null);

  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(SHOPPING_LIST_COLORS[0]);
  const [icon, setIcon] = useState<string>(SHOPPING_LIST_ICONS[0]);

  function handleBack() {
    smartBack({
      navigation,
      returnTo,
      fallback: '/shopping/lists',
    });
  }

  useEffect(() => {
    async function loadList() {
      try {
        setLoading(true);

        const { data, error } = await supabase
          .from('shopping_lists')
          .select('id, name, color, icon, is_default')
          .eq('id', id)
          .single();

        if (error) {
          Alert.alert('Load failed', error.message);
          return;
        }

        const nextList = data as ShoppingListRow;
        setList(nextList);
        setName(nextList.name ?? '');
        setColor(nextList.color ?? SHOPPING_LIST_COLORS[0]);
        setIcon(nextList.icon ?? SHOPPING_LIST_ICONS[0]);
      } catch (error) {
        console.error(error);
        Alert.alert('Load failed', 'Could not load list.');
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      loadList();
    }
  }, [id]);

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Missing info', 'Enter a list name.');
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from('shopping_lists')
        .update({
          name: name.trim(),
          color,
          icon,
        })
        .eq('id', id);

      if (error) {
        Alert.alert('Save failed', error.message);
        return;
      }

      handleBack();
    } catch (error) {
      console.error(error);
      Alert.alert('Save failed', 'Could not save list.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!list) return;

    if (list.is_default) {
      Alert.alert('Cannot delete', 'The default list cannot be deleted.');
      return;
    }

    Alert.alert('Delete list?', 'This will also delete items in this list.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase
            .from('shopping_lists')
            .delete()
            .eq('id', list.id);

          if (error) {
            Alert.alert('Delete failed', error.message);
            return;
          }

          router.replace('/shopping/lists');
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

  if (!list) {
    return (
      <AppScreen>
        <View style={styles.card}>
          <Text style={styles.emptyText}>List not found.</Text>
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
        placeholder="List name"
        value={name}
        onChangeText={setName}
        returnKeyType="done"
      />

      <View style={styles.section}>
        <Text style={styles.label}>Color</Text>
        <View style={styles.chipWrap}>
          {SHOPPING_LIST_COLORS.map((itemColor) => {
            const isActive = color === itemColor;

            return (
              <Pressable
                key={itemColor}
                style={[
                  styles.colorChip,
                  { backgroundColor: itemColor },
                  isActive && styles.colorChipActive,
                ]}
                onPress={() => setColor(itemColor)}
              >
                <Text style={styles.colorChipText}>
                  {isActive ? 'Selected' : ' '}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Icon</Text>
        <View style={styles.chipWrap}>
          {SHOPPING_LIST_ICONS.map((itemIcon) => {
            const isActive = icon === itemIcon;

            return (
              <Pressable
                key={itemIcon}
                style={[
                  styles.optionChip,
                  isActive && styles.optionChipActive,
                ]}
                onPress={() => setIcon(itemIcon)}
              >
                <Text
                  style={[
                    styles.optionChipText,
                    isActive && styles.optionChipTextActive,
                  ]}
                >
                  {itemIcon}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Pressable style={styles.primaryButton} onPress={handleSave} disabled={saving}>
        <Text style={styles.primaryButtonText}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Text>
      </Pressable>

      {!list.is_default ? (
        <Pressable style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>Delete List</Text>
        </Pressable>
      ) : null}
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
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  emptyText: {
    color: COLORS.muted,
    fontSize: 15,
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
  section: {
    marginBottom: SPACING.md,
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
  },
  colorChip: {
    minWidth: 72,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  colorChipActive: {
    borderColor: COLORS.text,
  },
  colorChipText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  optionChip: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  optionChipText: {
    color: COLORS.text,
    fontWeight: '600',
  },
  optionChipTextActive: {
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