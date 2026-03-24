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
import { router, useLocalSearchParams } from 'expo-router';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';

import { supabase } from '../../../../lib/supabase';
import { getCurrentHouseholdId } from '../../../../lib/household';

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

export default function NewServiceRecordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [title, setTitle] = useState('');
  const [serviceDate, setServiceDate] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const pickerValue = useMemo(() => {
    return serviceDate ? fromYMD(serviceDate) : new Date();
  }, [serviceDate]);

  function onDateChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }

    if (event.type === 'dismissed') {
      return;
    }

    if (selectedDate) {
      setServiceDate(toYMD(selectedDate));
    }
  }

  async function handleSave() {
    if (!title.trim()) {
      Alert.alert('Missing info', 'Enter a service title.');
      return;
    }

    try {
      setLoading(true);

      const householdId = await getCurrentHouseholdId();

      if (!householdId) {
        Alert.alert('No household', 'Create a household first.');
        router.replace('/household/create');
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user;

      const parsedAmount =
        amount.trim() === '' ? null : Number.parseFloat(amount.trim());

      if (amount.trim() !== '' && Number.isNaN(parsedAmount as number)) {
        Alert.alert('Invalid amount', 'Enter a valid dollar amount.');
        return;
      }

      const { error } = await supabase.from('service_records').insert({
        household_id: householdId,
        provider_id: id,
        title: title.trim(),
        service_date: serviceDate,
        amount: parsedAmount,
        notes: notes.trim() || null,
        created_by: user?.id ?? null,
      });

      if (error) {
        Alert.alert('Save failed', error.message);
        return;
      }

      router.replace(`/records/providers/${id}`);
    } catch (error) {
      Alert.alert('Error', 'Something went wrong saving the service record.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <Text style={styles.title}>Add service record</Text>
      <Text style={styles.subtitle}>Save work completed by this provider.</Text>

      <TextInput
        style={styles.input}
        placeholder="Service title"
        placeholderTextColor="#6B7280"
        value={title}
        onChangeText={setTitle}
      />

      <Text style={styles.label}>Service date</Text>

      <Pressable style={styles.dateButton} onPress={() => setShowPicker(true)}>
        <Text style={styles.dateButtonText}>{formatDateLabel(serviceDate)}</Text>
      </Pressable>

      {serviceDate ? (
        <Pressable onPress={() => setServiceDate(null)} style={styles.clearLink}>
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

      <TextInput
        style={styles.input}
        placeholder="Amount paid"
        placeholderTextColor="#6B7280"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
      />

      <TextInput
        style={[styles.input, styles.notesInput]}
        placeholder="Notes"
        placeholderTextColor="#6B7280"
        value={notes}
        onChangeText={setNotes}
        multiline
      />

      <Pressable style={styles.button} onPress={handleSave} disabled={loading}>
        <Text style={styles.buttonText}>
          {loading ? 'Saving...' : 'Save Record'}
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
  notesInput: {
    minHeight: 100,
    textAlignVertical: 'top',
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