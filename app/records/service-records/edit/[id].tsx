import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { supabase } from '../../../../lib/supabase';
import { AppScreen } from '../../../../components/app-screen';
import { FormInput } from '../../../../components/form-input';
import { DateField } from '../../../../components/date-field';
import { FormScreenHeader } from '../../../../components/form-screen-header';
import { COLORS, RADIUS } from '../../../../constants/theme';

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
    } catch {
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
    <AppScreen>
      <FormScreenHeader
        title="Edit service record"
        subtitle="Update the details for this service."
      />

      <FormInput
        placeholder="Service title"
        value={title}
        onChangeText={setTitle}
        returnKeyType="done"
      />

      <DateField label="Service date" value={serviceDate} onChange={setServiceDate} />

      <FormInput
        placeholder="Amount paid"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        returnKeyType="done"
      />

      <FormInput
        placeholder="Notes"
        value={notes}
        onChangeText={setNotes}
        multiline
      />

      <Pressable style={styles.button} onPress={handleSave} disabled={saving}>
        <Text style={styles.buttonText}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Text>
      </Pressable>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
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