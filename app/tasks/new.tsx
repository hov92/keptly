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
import { getCurrentHouseholdId } from '../../lib/household';

export default function NewTaskScreen() {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCreateTask() {
    if (!title.trim()) {
      Alert.alert('Missing info', 'Enter a task title.');
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

      const householdId = await getCurrentHouseholdId();

      if (!householdId) {
        Alert.alert('No household', 'Create a household first.');
        router.replace('/household/create');
        return;
      }

      const { error } = await supabase.from('tasks').insert({
        household_id: householdId,
        title: title.trim(),
        category: category.trim() || null,
        due_date: dueDate.trim() || null,
        created_by: user.id,
      });

      if (error) {
        Alert.alert('Create failed', error.message);
        return;
      }

      router.back();
    } catch (error) {
      Alert.alert('Error', 'Something went wrong creating the task.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <Text style={styles.title}>Add task</Text>
      <Text style={styles.subtitle}>Create a task for your household.</Text>

      <TextInput
        style={styles.input}
        placeholder="Task title"
        value={title}
        onChangeText={setTitle}
      />

      <TextInput
        style={styles.input}
        placeholder="Category (optional)"
        value={category}
        onChangeText={setCategory}
      />

      <TextInput
        style={styles.input}
        placeholder="Due date YYYY-MM-DD (optional)"
        value={dueDate}
        onChangeText={setDueDate}
        autoCapitalize="none"
      />

      <Pressable
        style={styles.button}
        onPress={handleCreateTask}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Saving...' : 'Save Task'}
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
  backButton: {
    marginBottom: 20,
  },
  backText: {
    color: '#2A9D8F',
    fontSize: 16,
    fontWeight: '600',
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
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E6E0D8',
  },
  button: {
    backgroundColor: '#264653',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});