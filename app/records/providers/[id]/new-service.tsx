import { useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { supabase } from '../../../../lib/supabase';
import { getCurrentHouseholdId } from '../../../../lib/household';
import { AppScreen } from '../../../../components/app-screen';
import { FormInput } from '../../../../components/form-input';
import { DateField } from '../../../../components/date-field';
import { FormScreenHeader } from '../../../../components/form-screen-header';
import { COLORS, RADIUS } from '../../../../constants/theme';

export default function NewServiceRecordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [title, setTitle] = useState('');
  const [serviceDate, setServiceDate] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

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
    } catch {
      Alert.alert('Error', 'Something went wrong saving the service record.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppScreen>
      <FormScreenHeader
        title="Add service record"
        subtitle="Save work completed by this provider."
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

      <Pressable style={styles.button} onPress={handleSave} disabled={loading}>
        <Text style={styles.buttonText}>
          {loading ? 'Saving...' : 'Save Record'}
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