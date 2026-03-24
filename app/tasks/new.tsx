import { useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';

import { supabase } from '../../lib/supabase';
import { getCurrentHouseholdId } from '../../lib/household';

function toYMD(date: Date) {
  return date.toISOString().slice(0, 10);
}

function fromYMD(value: string) {
  return new Date(`${value}T12:00:00`);
}

function formatDateLabel(value: string | null) {
  if (!value) return 'No date selected';
  return fromYMD(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function NewTaskScreen() {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const pickerValue = useMemo(() => {
    return dueDate ? fromYMD(dueDate) : new Date();
  }, [dueDate]);

  function onDateChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }

    if (event.type === 'dismissed') {
      return;
    }

    if (selectedDate) {
      setDueDate(toYMD(selectedDate));
    }
  }

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
        due_date: dueDate,
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

      <Text style={styles.label}>Due date</Text>

      <Pressable style={styles.dateButton} onPress={() => setShowPicker(true)}>
        <Text style={styles.dateButtonText}>{formatDateLabel(dueDate)}</Text>
      </Pressable>

      {dueDate ? (
        <Pressable onPress={() => setDueDate(null)} style={styles.clearLink}>
          <Text style={styles.clearLinkText}>Clear date</Text>
        </Pressable>
      ) : null}

      {showPicker ? (
        <DateTimePicker
          value={pickerValue}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={onDateChange}
        />
      ) : null}

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
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F1F1F',
    marginBottom: 10,
  },
  dateButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E6E0D8',
  },
  dateButtonText: {
    color: '#1F1F1F',
    fontSize: 16,
  },
  clearLink: {
    marginBottom: 12,
  },
  clearLinkText: {
    color: '#2A9D8F',
    fontSize: 14,
    fontWeight: '600',
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