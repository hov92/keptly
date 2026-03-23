import { useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { supabase } from '../../lib/supabase';

const HOME_TYPES = ['House', 'Apartment', 'Condo', 'Townhouse'];

export default function CreateHouseholdScreen() {
  const [name, setName] = useState('');
  const [homeType, setHomeType] = useState('House');
  const [loading, setLoading] = useState(false);

  async function handleCreateHousehold() {
    if (!name.trim()) {
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

      const { data: household, error: householdError } = await supabase
        .from('households')
        .insert({
          name: name.trim(),
          home_type: homeType,
          created_by: user.id,
        })
        .select('id')
        .single();

      if (householdError || !household) {
        Alert.alert(
          'Create failed',
          householdError?.message ?? 'Could not create household.'
        );
        return;
      }

      const { error: memberError } = await supabase
        .from('household_members')
        .insert({
          household_id: household.id,
          user_id: user.id,
          role: 'owner',
        });

      if (memberError) {
        Alert.alert(
          'Member error',
          memberError.message ?? 'Could not add household member.'
        );
        return;
      }

      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Error', 'Something went wrong creating the household.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create your household</Text>
      <Text style={styles.subtitle}>
        Set up your home so Keptly can keep everything organized.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Household name"
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Home type</Text>

      <View style={styles.typeRow}>
        {HOME_TYPES.map((type) => {
          const selected = homeType === type;

          return (
            <Pressable
              key={type}
              onPress={() => setHomeType(type)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text
                style={[styles.chipText, selected && styles.chipTextSelected]}
              >
                {type}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        style={styles.button}
        onPress={handleCreateHousehold}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Creating...' : 'Create Household'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F6F2',
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#5F6368',
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E6E0D8',
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F1F1F',
    marginBottom: 10,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6E0D8',
  },
  chipSelected: {
    backgroundColor: '#264653',
    borderColor: '#264653',
  },
  chipText: {
    color: '#1F1F1F',
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  button: {
    backgroundColor: '#264653',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});