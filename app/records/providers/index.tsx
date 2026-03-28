import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { AppScreen } from '../../../components/app-screen';
import { COLORS, RADIUS, SPACING } from '../../../constants/theme';
import { supabase } from '../../../lib/supabase';
import { getCurrentHouseholdId } from '../../../lib/household';
import { getNoHouseholdRoute } from '../../../lib/no-household-route';
import { getActiveHouseholdPermissions } from '../../../lib/permissions';

type Provider = {
  id: string;
  name: string;
  category: string | null;
  phone: string | null;
  email: string | null;
  is_preferred: boolean | null;
};

export default function ProvidersScreen() {
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [canManageProviders, setCanManageProviders] = useState(false);

  async function loadProviders() {
    try {
      setLoading(true);

      const householdId = await getCurrentHouseholdId();

      if (!householdId || householdId === 'null' || householdId === 'undefined') {
        const route = await getNoHouseholdRoute();
        router.replace(route);
        return;
      }

      const permissions = await getActiveHouseholdPermissions();
      setCanManageProviders(permissions.canManageProviders);

      const { data, error } = await supabase
        .from('providers')
        .select('id, name, category, phone, email, is_preferred')
        .eq('household_id', householdId)
        .order('name', { ascending: true });

      if (error) {
        Alert.alert('Load failed', error.message);
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

  function renderItem({ item }: { item: Provider }) {
    return (
      <Pressable
        style={styles.card}
        onPress={() => router.push(`/records/providers/${item.id}`)}
      >
        <View style={styles.topRow}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          {item.is_preferred ? (
            <View style={styles.preferredBadge}>
              <Text style={styles.preferredBadgeText}>Preferred</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.cardText}>Category: {item.category || 'None'}</Text>
        {item.phone ? <Text style={styles.cardText}>Phone: {item.phone}</Text> : null}
        {item.email ? <Text style={styles.cardText}>Email: {item.email}</Text> : null}
      </Pressable>
    );
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
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Providers</Text>
          <Text style={styles.subtitle}>Trusted pros saved for this household.</Text>
        </View>

        {canManageProviders ? (
          <Pressable
            style={styles.addButton}
            onPress={() => router.push('/records/providers/new')}
          >
            <Text style={styles.addButtonText}>Add</Text>
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={providers}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        scrollEnabled={false}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No providers yet.</Text>
          </View>
        }
      />
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.muted,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  addButtonText: {
    color: COLORS.primaryText,
    fontWeight: '700',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  cardText: {
    fontSize: 14,
    color: COLORS.muted,
    marginBottom: 4,
  },
  preferredBadge: {
    backgroundColor: COLORS.accentSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  preferredBadgeText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  emptyText: {
    color: COLORS.muted,
    fontSize: 15,
  },
});