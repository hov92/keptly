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

import { AppScreen } from '../../../components/app-screen';
import { COLORS, RADIUS, SPACING } from '../../../constants/theme';
import { supabase } from '../../../lib/supabase';
import { getCurrentHouseholdId } from '../../../lib/household';
import { getActiveHouseholdPermissions } from '../../../lib/permissions';

type Provider = {
  id: string;
  name: string;
  category: string | null;
  phone: string | null;
  email: string | null;
};

export default function ProvidersScreen() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [canManageProviders, setCanManageProviders] = useState(false);

  async function loadProviders() {
    try {
      setLoading(true);

      const permissions = await getActiveHouseholdPermissions();
      setCanManageProviders(permissions.canManageProviders);

      const householdId = await getCurrentHouseholdId();
      if (!householdId) {
        setProviders([]);
        return;
      }

      const { data, error } = await supabase
        .from('providers')
        .select('id, name, category, phone, email')
        .eq('household_id', householdId)
        .order('name', { ascending: true });

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

  function renderItem({ item }: { item: Provider }) {
    return (
      <Pressable
        style={styles.card}
        onPress={() =>
          router.push({
  pathname: '/records/providers/[id]',
  params: {
    id: item.id,
    returnTo: '/records/providers',
  },
})
        }
      >
        <Text style={styles.cardTitle}>{item.name}</Text>
        {item.category ? <Text style={styles.cardMeta}>Category: {item.category}</Text> : null}
        {item.phone ? <Text style={styles.cardMeta}>Phone: {item.phone}</Text> : null}
        {item.email ? <Text style={styles.cardMeta}>Email: {item.email}</Text> : null}
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
          <Text style={styles.subtitle}>
            Trusted pros saved for this household.
          </Text>
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
          <View style={styles.card}>
            <Text style={styles.cardMeta}>No providers saved yet.</Text>
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
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  cardMeta: {
    fontSize: 14,
    color: COLORS.muted,
    marginBottom: 4,
  },
});