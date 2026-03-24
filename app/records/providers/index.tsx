import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { supabase } from '../../../lib/supabase';
import { getCurrentHouseholdId } from '../../../lib/household';

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

export default function ProvidersScreen() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadProviders() {
    try {
      setLoading(true);

      const householdId = await getCurrentHouseholdId();

      if (!householdId) {
        setProviders([]);
        return;
      }

      const { data, error } = await supabase
        .from('providers')
        .select('id, name, category, phone, email, notes, is_preferred, created_at')
        .eq('household_id', householdId)
        .order('is_preferred', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error(error.message);
        return;
      }

      setProviders((data ?? []) as Provider[]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadProviders();
    }, [])
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Providers</Text>
          <Text style={styles.subtitle}>Trusted pros for your household</Text>
        </View>

        <Pressable
          style={styles.addButton}
          onPress={() => router.push('/records/providers/new')}
        >
          <Text style={styles.addButtonText}>+ Add</Text>
        </Pressable>
      </View>

      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>Back to Records</Text>
      </Pressable>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : providers.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No providers yet</Text>
          <Text style={styles.emptyText}>
            Add your first plumber, cleaner, electrician, or lawn care provider.
          </Text>

          <Pressable
            style={styles.primaryButton}
            onPress={() => router.push('/records/providers/new')}
          >
            <Text style={styles.primaryButtonText}>Add Provider</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={providers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => router.push(`/records/providers/${item.id}`)}
            >
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                {item.is_preferred ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Preferred</Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.cardMeta}>
                {item.category || 'No category'}
              </Text>

              {item.phone ? <Text style={styles.cardMeta}>{item.phone}</Text> : null}
              {item.email ? <Text style={styles.cardMeta}>{item.email}</Text> : null}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F6F2',
    padding: 24,
    paddingTop: 60,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#5F6368',
  },
  addButton: {
    backgroundColor: '#264653',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  backButton: {
    marginBottom: 18,
  },
  backText: {
    color: '#2A9D8F',
    fontSize: 15,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#5F6368',
    lineHeight: 22,
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#264653',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
    alignItems: 'center',
  },
  cardTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  cardMeta: {
    fontSize: 14,
    color: '#5F6368',
    marginBottom: 4,
  },
  badge: {
    backgroundColor: '#E8F5F3',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    color: '#2A9D8F',
    fontSize: 12,
    fontWeight: '700',
  },
});