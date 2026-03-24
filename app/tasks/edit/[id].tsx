import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../../../lib/supabase';

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

export default function EditTaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const pickerValue = useMemo(() => {
    return dueDate ? fromYMD(dueDate) : new Date();
  }, [dueDate]);

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
      setDueDate(data.due_date ?? null);
      setLoading(false);
    }

    if (id) {
      loadTask();
    }
  }, [id]);

  function openDatePicker() {
    Keyboard.dismiss();
    setShowPicker(true);
  }

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
          due_date: dueDate,
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
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <Text style={styles.title}>Edit task</Text>
        <Text style={styles.subtitle}>Update your household task.</Text>

        <TextInput
          style={styles.input}
          placeholder="Task title"
          placeholderTextColor="#6B7280"
          value={title}
          onChangeText={setTitle}
          returnKeyType="done"
        />

        <TextInput
          style={styles.input}
          placeholder="Category (optional)"
          placeholderTextColor="#6B7280"
          value={category}
          onChangeText={setCategory}
          returnKeyType="done"
        />

        <Text style={styles.label}>Due date</Text>

        <Pressable style={styles.dateButton} onPress={openDatePicker}>
          <Text style={styles.dateButtonText}>{formatDateLabel(dueDate)}</Text>
        </Pressable>

        {dueDate ? (
          <Pressable onPress={() => setDueDate(null)} style={styles.clearLink}>
            <Text style={styles.clearLinkText}>Clear date</Text>
          </Pressable>
        ) : null}

        {showPicker ? (
          <View style={styles.pickerWrap}>
            <DateTimePicker
              value={pickerValue}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={onDateChange}
              themeVariant="light"
              accentColor="#264653"
              textColor="#1F1F1F"
            />
          </View>
        ) : null}

        <Pressable style={styles.button} onPress={handleSave} disabled={saving}>
          <Text style={styles.buttonText}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F6F2',
  },
  container: {
    padding: 24,
    paddingTop: 8,
    paddingBottom: 40,
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
    color: '#1F1F1F',
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
  pickerWrap: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 8,
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