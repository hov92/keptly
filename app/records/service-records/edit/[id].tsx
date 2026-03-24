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

import { supabase } from '../../../../lib/supabase';

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

type LoadedRecord = {
  title: string;
  service_date: string | null;
  amount: number | null;
  notes: string | null;
  provider_id: string | null;
};

export default function EditServiceRecordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [title, setTitle] = useState('');
  const [serviceDate, setServiceDate] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [providerId, setProviderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const pickerValue = useMemo(() => {
    return serviceDate ? fromYMD(serviceDate) : new Date();
  }, [serviceDate]);

  useEffect(() => {
    async function loadRecord() {
      const { data, error } = await supabase
        .from('service_records')
        .select('title, service_date, amount, notes, provider_id')
        .eq('id', id)
        .single();

      if (error) {
        Alert.alert('Load failed', error.message);
        router.back();
        return;
      }

      const record = data as LoadedRecord;

      setTitle(record.title ?? '');
      setServiceDate(record.service_date ?? null);
      setAmount(record.amount != null ? String(record.amount) : '');
      setNotes(record.notes ?? '');
      setProviderId(record.provider_id ?? null);
      setLoading(false);
    }

    if (id) {
      loadRecord();
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
      setServiceDate(toYMD(selectedDate));
    }
  }

  async function handleSave() {
    if (!title.trim()) {
      Alert.alert('Missing info', 'Enter a service title.');
      return;
    }

    const parsedAmount =
      amount.trim() === '' ? null : Number.parseFloat(amount.trim());

    if (amount.trim() !== '' && Number.isNaN(parsedAmount as number)) {
      Alert.alert('Invalid amount', 'Enter a valid dollar amount.');
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from('service_records')
        .update({
          title: title.trim(),
          service_date: serviceDate,
          amount: parsedAmount,
          notes: notes.trim() || null,
        })
        .eq('id', id);

      if (error) {
        Alert.alert('Save failed', error.message);
        return;
      }

      if (providerId) {
        router.replace(`/records/providers/${providerId}`);
      } else {
        router.back();
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong saving the service record.');
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

        <Text style={styles.title}>Edit service record</Text>
        <Text style={styles.subtitle}>Update the details for this service.</Text>

        <TextInput
          style={styles.input}
          placeholder="Service title"
          placeholderTextColor="#6B7280"
          value={title}
          onChangeText={setTitle}
          returnKeyType="done"
        />

        <Text style={styles.label}>Service date</Text>

        <Pressable style={styles.dateButton} onPress={openDatePicker}>
          <Text style={styles.dateButtonText}>{formatDateLabel(serviceDate)}</Text>
        </Pressable>

        {serviceDate ? (
          <Pressable onPress={() => setServiceDate(null)} style={styles.clearLink}>
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

        <TextInput
          style={styles.input}
          placeholder="Amount paid"
          placeholderTextColor="#6B7280"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          returnKeyType="done"
        />

        <TextInput
          style={[styles.input, styles.notesInput]}
          placeholder="Notes"
          placeholderTextColor="#6B7280"
          value={notes}
          onChangeText={setNotes}
          multiline
        />

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