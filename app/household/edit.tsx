import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';

import { AppScreen } from '../../components/app-screen';
import { FormInput } from '../../components/form-input';
import { COLORS, RADIUS } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { getCurrentHouseholdId } from '../../lib/household';
import { getActiveHouseholdPermissions } from '../../lib/permissions';

export default function EditHouseholdScreen() {
  const [name, setName] = useState('');
  const [homeType, setHomeType] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadHousehold() {
      try {
        const permissions = await getActiveHouseholdPermissions();

        if (!permissions.canEditHousehold) {
          Alert.alert('Restricted', 'Only an owner can edit household details.');
          router.back();
          return;
        }

        const householdId = await getCurrentHouseholdId();
        if (!householdId) {
          Alert.alert('Missing household', 'No active household found.');
          router.back();
          return;
        }

        const { data, error } = await supabase
          .from('households')
          .select('name, home_type')
          .eq('id', householdId)
          .single();

        if (error) {
          Alert.alert('Load failed', error.message);
          router.back();
          return;
        }

        setName(data.name ?? '');
        setHomeType(data.home_type ?? '');
      } catch (error) {
        console.error(error);
        Alert.alert('Error', 'Could not load household details.');
        router.back();
      } finally {
        setLoading(false);
      }
    }

    loadHousehold();
  }, []);

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Missing info', 'Enter a household name.');
      return;
    }

    try {
      setSaving(true);

      const householdId = await getCurrentHouseholdId();
      if (!householdId) {
        Alert.alert('Missing household', 'No active household found.');
        return;
      }

      const { error } = await supabase
        .from('households')
        .update({
          name: name.trim(),
          home_type: homeType.trim() || null,
        })
        .eq('id', householdId);

      if (error) {
        Alert.alert('Save failed', error.message);
        return;
      }

      router.back();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Could not save household details.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppScreen>
        <Text>Loading household details...</Text>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <FormInput
        placeholder="Household name"
        value={name}
        onChangeText={setName}
        returnKeyType="done"
      />

      <FormInput
        placeholder="Home type"
        value={homeType}
        onChangeText={setHomeType}
        returnKeyType="done"
      />

      <Pressable style={styles.button} onPress={handleSave} disabled={saving}>
        <Text style={styles.buttonText}>
          {saving ? 'Saving...' : 'Save Household'}
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