import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';

import { AppScreen } from '../../components/app-screen';
import { FormInput } from '../../components/form-input';
import { COLORS, RADIUS } from '../../constants/theme';
import { supabase } from '../../lib/supabase';

export default function CreateHouseholdScreen() {
  const [householdName, setHouseholdName] = useState('');
  const [homeType, setHomeType] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCreateHousehold() {
    if (!householdName.trim()) {
      Alert.alert('Missing info', 'Enter a household name.');
      return;
    }

    try {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user;
      if (!user) {
        Alert.alert('Auth error', 'You are not signed in.');
        router.replace('/login');
        return;
      }

      const { data: householdData, error: householdError } = await supabase
        .from('households')
        .insert({
          name: householdName.trim(),
          home_type: homeType.trim() || null,
          created_by: user.id,
        })
        .select('id')
        .single();

      if (householdError) {
        Alert.alert('Create failed', householdError.message);
        return;
      }

      const newHouseholdId = householdData.id;

      const { error: memberError } = await supabase
        .from('household_members')
        .insert({
          household_id: newHouseholdId,
          user_id: user.id,
          role: 'owner',
        });

      if (memberError) {
        Alert.alert('Create failed', memberError.message);
        return;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ current_household_id: newHouseholdId })
        .eq('id', user.id);

      if (profileError) {
        Alert.alert('Profile update failed', profileError.message);
        return;
      }

      router.replace('/(tabs)');
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Something went wrong creating the household.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppScreen>
      <FormInput
        placeholder="Household name"
        value={householdName}
        onChangeText={setHouseholdName}
        returnKeyType="done"
      />

      <FormInput
        placeholder="Home type"
        value={homeType}
        onChangeText={setHomeType}
        returnKeyType="done"
      />

      <Pressable
        style={styles.button}
        onPress={handleCreateHousehold}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Creating...' : 'Create Household'}
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