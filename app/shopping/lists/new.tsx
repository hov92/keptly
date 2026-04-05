import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { AppScreen } from '../../../components/app-screen';
import { FormInput } from '../../../components/form-input';
import { COLORS, RADIUS, SPACING } from '../../../constants/theme';
import { supabase } from '../../../lib/supabase';
import { getCurrentHouseholdId } from '../../../lib/household';
import {
  SHOPPING_LIST_COLORS,
  SHOPPING_LIST_ICONS,
} from '../../../lib/shopping-lists';

export default function NewShoppingListScreen() {
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(SHOPPING_LIST_COLORS[0]);
  const [icon, setIcon] = useState<string>(SHOPPING_LIST_ICONS[0]);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Missing info', 'Enter a list name.');
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

      const { error } = await supabase.from('shopping_lists').insert({
        household_id: householdId,
        name: name.trim(),
        color,
        icon,
        is_default: false,
        created_by: session?.user?.id ?? null,
      });

      if (error) {
        Alert.alert('Save failed', error.message);
        return;
      }

      router.replace('/shopping/lists');
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Could not save shopping list.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppScreen>
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

      <Pressable style={styles.button} onPress={handleSave} disabled={saving}>
        <Text style={styles.buttonText}>
          {saving ? 'Saving...' : 'Save List'}
        </Text>
      </Pressable>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
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