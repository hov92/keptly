import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { supabase } from '../../../lib/supabase';

export default function EditTaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadTask() {
      const { data, error } = await supabase
        .from('tasks')
        .select('title, category, due_date')
        .eq('id', id)
        .single();

      if (error) {
        Alert.alert('Load failed', error.message);
        router.back();
        return;
      }

      setTitle(data.title ?? '');
      setCategory(data.category ?? '');
      setDueDate(data.due_date ?? '');
      setLoading(false);
    }

    if (id) {
      loadTask();
    }
  }, [id]);

  async function handleSave() {
    if (!title.trim()) {
      Alert.alert('Missing info', 'Enter a task title.');
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from('tasks')
        .update({
          title: title.trim(),
          category: category.trim() || null,
          due_date: dueDate.trim() || null,
        })
        .eq('id', id);

      if (error) {
        Alert.alert('Save failed', error.message);
        return;
      }

      router.replace(`/tasks/${id}`);
    } catch (error) {
      Alert.alert('Error', 'Something went wrong saving the task.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <Text style={styles.title}>Edit task</Text>
      <Text style={styles.subtitle}>Update your household task.</Text>

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

      <Pressable style={styles.button} onPress={handleSave} disabled={saving}>
        <Text style={styles.buttonText}>
          {saving ? 'Saving...' : 'Save Changes'}
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
  center: {
    flex: 1,
    backgroundColor: '#F8F6F2',
    alignItems: 'center',
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