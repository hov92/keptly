import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { supabase } from '../../../lib/supabase';

type Provider = {
  id: string;
  name: string;
  category: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  is_preferred: boolean;
  created_at: string;
};

type ServiceRecord = {
  id: string;
  title: string;
  service_date: string | null;
  amount: number | null;
  notes: string | null;
  created_at: string;
};

export default function ProviderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadProvider() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('providers')
        .select('id, name, category, phone, email, notes, is_preferred, created_at')
        .eq('id', id)
        .single();

      if (error) {
        Alert.alert('Load failed', error.message);
        router.back();
        return;
      }

      setProvider(data as Provider);

      const { data: recordData, error: recordError } = await supabase
        .from('service_records')
        .select('id, title, service_date, amount, notes, created_at')
        .eq('provider_id', id)
        .order('service_date', { ascending: false });

      if (recordError) {
        Alert.alert('Load failed', recordError.message);
        return;
      }

      setRecords((recordData ?? []) as ServiceRecord[]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      if (id) {
        loadProvider();
      }
    }, [id])
  );

  function handleDelete() {
    if (!provider) return;

    Alert.alert('Delete provider?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('providers').delete().eq('id', provider.id);

          if (error) {
            Alert.alert('Delete failed', error.message);
            return;
          }

          router.replace('/records/providers');
        },
      },
    ]);
  }

  async function handleDeleteRecord(recordId: string) {
    const { error } = await supabase.from('service_records').delete().eq('id', recordId);

    if (error) {
      Alert.alert('Delete failed', error.message);
      return;
    }

    loadProvider();
  }

  async function handleCall() {
    if (!provider?.phone) return;
    await Linking.openURL(`tel:${provider.phone}`);
  }

  async function handleEmail() {
    if (!provider?.email) return;
    await Linking.openURL(`mailto:${provider.email}`);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!provider) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Provider not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <Text style={styles.title}>{provider.name}</Text>
      <Text style={styles.subtitle}>
        {provider.category || 'No category'}
      </Text>

      {provider.is_preferred ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Preferred</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.label}>Phone</Text>
        <Text style={styles.value}>{provider.phone || 'No phone'}</Text>

        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{provider.email || 'No email'}</Text>

        <Text style={styles.label}>Notes</Text>
        <Text style={styles.value}>{provider.notes || 'No notes'}</Text>
      </View>

      {provider.phone ? (
        <Pressable style={styles.primaryButton} onPress={handleCall}>
          <Text style={styles.primaryButtonText}>Call Provider</Text>
        </Pressable>
      ) : null}

      {provider.email ? (
        <Pressable style={styles.secondaryButton} onPress={handleEmail}>
          <Text style={styles.secondaryButtonText}>Email Provider</Text>
        </Pressable>
      ) : null}

      <Pressable
        style={styles.secondaryButton}
        onPress={() => router.push(`/records/providers/${provider.id}/new-service`)}
      >
        <Text style={styles.secondaryButtonText}>Add Service Record</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Service History</Text>

      {records.length === 0 ? (
        <View style={styles.historyCard}>
          <Text style={styles.historyEmpty}>No service records yet.</Text>
        </View>
      ) : (
        records.map((record) => (
          <View key={record.id} style={styles.historyCard}>
            <Text style={styles.historyTitle}>{record.title}</Text>
            <Text style={styles.historyMeta}>
              {record.service_date || 'No service date'}
            </Text>
            <Text style={styles.historyMeta}>
              {record.amount != null ? `$${Number(record.amount).toFixed(2)}` : 'No amount'}
            </Text>
            {record.notes ? (
              <Text style={styles.historyNotes}>{record.notes}</Text>
            ) : null}

            <View style={styles.recordButtonsRow}>
              <Pressable
                style={styles.smallEditButton}
                onPress={() => router.push(`/records/service-records/edit/${record.id}`)}
              >
                <Text style={styles.smallEditButtonText}>Edit Record</Text>
              </Pressable>

              <Pressable
                style={styles.smallDeleteButton}
                onPress={() =>
                  Alert.alert('Delete record?', 'This cannot be undone.', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () => handleDeleteRecord(record.id),
                    },
                  ])
                }
              >
                <Text style={styles.smallDeleteButtonText}>Delete Record</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}

      <Pressable style={styles.deleteButton} onPress={handleDelete}>
        <Text style={styles.deleteButtonText}>Delete Provider</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F6F2',
  },
  content: {
    padding: 24,
    paddingTop: 60,
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
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    color: '#5F6368',
    marginBottom: 12,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F5F3',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 16,
  },
  badgeText: {
    color: '#2A9D8F',
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: '#5F6368',
    marginTop: 12,
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  primaryButton: {
    backgroundColor: '#264653',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#264653',
  },
  secondaryButtonText: {
    color: '#264653',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F1F1F',
    marginTop: 8,
    marginBottom: 12,
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  historyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 6,
  },
  historyMeta: {
    fontSize: 14,
    color: '#5F6368',
    marginBottom: 4,
  },
  historyNotes: {
    fontSize: 14,
    color: '#1F1F1F',
    marginTop: 6,
    marginBottom: 10,
  },
  historyEmpty: {
    fontSize: 15,
    color: '#5F6368',
  },
  recordButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  smallEditButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F5F3',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  smallEditButtonText: {
    color: '#2A9D8F',
    fontSize: 12,
    fontWeight: '700',
  },
  smallDeleteButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEE4E2',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  smallDeleteButtonText: {
    color: '#B42318',
    fontSize: 12,
    fontWeight: '700',
  },
  deleteButton: {
    backgroundColor: '#C95A5A',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 16,
    color: '#5F6368',
  },
});