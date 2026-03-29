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
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
} from 'expo-router';

import { AppScreen } from '../../../../components/app-screen';
import { COLORS, RADIUS, SPACING } from '../../../../constants/theme';
import { supabase } from '../../../../lib/supabase';
import { getActiveHouseholdPermissions } from '../../../../lib/permissions';
import { smartBack } from '../../../../lib/navigation';

type Provider = {
  id: string;
  name: string;
  category: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  is_preferred: boolean | null;
};

type ServiceRecord = {
  id: string;
  title: string;
  service_date: string | null;
  amount: number | null;
  notes: string | null;
};

export default function ProviderDetailScreen() {
  const { id, returnTo } = useLocalSearchParams<{
    id: string;
    returnTo?: string;
  }>();
  const navigation = useNavigation();

  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [canManageServiceRecords, setCanManageServiceRecords] = useState(false);

  function handleBack() {
    smartBack({
      navigation,
      returnTo: returnTo ?? '/records/providers',
    fallback: '/records/providers',
    });
  }

  async function loadData() {
    try {
      setLoading(true);

      const permissions = await getActiveHouseholdPermissions();
      setCanManageServiceRecords(permissions.canManageServiceRecords);

      const { data: providerData, error: providerError } = await supabase
        .from('providers')
        .select('id, name, category, phone, email, notes, is_preferred')
        .eq('id', id)
        .single();

      if (providerError) {
        Alert.alert('Load failed', providerError.message);
        handleBack();
        return;
      }

      const { data: recordsData, error: recordsError } = await supabase
        .from('service_records')
        .select('id, title, service_date, amount, notes')
        .eq('provider_id', id)
        .order('service_date', { ascending: false });

      if (recordsError) {
        Alert.alert('Load failed', recordsError.message);
        return;
      }

      setProvider(providerData as Provider);
      setRecords((recordsData ?? []) as ServiceRecord[]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      if (id) loadData();
    }, [id])
  );

  function renderRecord({ item }: { item: ServiceRecord }) {
    return (
      <Pressable
        style={styles.recordCard}
        onPress={() =>
          router.push({
            pathname: '/records/service-records/edit/[id]',
            params: { id: item.id },
          })
        }
      >
        <Text style={styles.recordTitle}>{item.title}</Text>
        <Text style={styles.recordMeta}>
          Date: {item.service_date || 'No date'}
        </Text>
        <Text style={styles.recordMeta}>
          Amount: {item.amount != null ? `$${item.amount}` : 'Not set'}
        </Text>
        {item.notes ? (
          <Text style={styles.recordMeta}>Notes: {item.notes}</Text>
        ) : null}
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

  if (!provider) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Provider not found.</Text>
      </View>
    );
  }

  return (
    <AppScreen>
      <Pressable onPress={handleBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>Back</Text>
      </Pressable>

      <View style={styles.providerCard}>
        {provider.category ? (
          <Text style={styles.providerMeta}>Category: {provider.category}</Text>
        ) : null}
        {provider.phone ? (
          <Text style={styles.providerMeta}>Phone: {provider.phone}</Text>
        ) : null}
        {provider.email ? (
          <Text style={styles.providerMeta}>Email: {provider.email}</Text>
        ) : null}
        {provider.notes ? (
          <Text style={styles.providerMeta}>Notes: {provider.notes}</Text>
        ) : null}
        {provider.is_preferred ? (
          <Text style={styles.preferredText}>Preferred provider</Text>
        ) : null}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Service history</Text>

        {canManageServiceRecords ? (
          <Pressable
            style={styles.addButton}
            onPress={() =>
              router.push({
                pathname: '/records/providers/[id]/new-service',
                params: {
                  id: provider.id,
                  returnTo: '/records/providers',
                },
              })
            }
          >
            <Text style={styles.addButtonText}>Add</Text>
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        renderItem={renderRecord}
        scrollEnabled={false}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No service records yet.</Text>
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
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: SPACING.md,
  },
  backButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  providerCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  providerMeta: {
    fontSize: 14,
    color: COLORS.muted,
    marginBottom: 6,
  },
  preferredText: {
    marginTop: 8,
    color: COLORS.accent,
    fontWeight: '700',
    fontSize: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
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
  recordCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  recordTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  recordMeta: {
    fontSize: 14,
    color: COLORS.muted,
    marginBottom: 4,
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