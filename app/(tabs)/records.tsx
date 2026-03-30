import { useCallback, useMemo, useState } from 'react';
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

import { AppScreen } from '../../components/app-screen';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { getCurrentHouseholdId } from '../../lib/household';
import { getActiveHouseholdPermissions } from '../../lib/permissions';
import { exportAllServiceHistoryCsv } from '../../lib/all-service-history-export';
import { exportServiceHistoryCsv } from '../../lib/service-history-export';

type ProviderRow = {
  id: string;
  household_id: string;
  name: string;
  category: string | null;
  phone: string | null;
  email: string | null;
};

type HouseholdRow = {
  id: string;
  name: string;
};

type ExportServiceRow = {
  id: string;
  title: string;
  service_date: string | null;
  amount: number | null;
  notes: string | null;
  providers: { name: string }[] | null;
  service_record_documents?: { id: string }[] | null;
};

type ProviderExportRow = {
  id: string;
  title: string;
  service_date: string | null;
  amount: number | null;
  notes: string | null;
  service_record_documents?: { id: string }[] | null;
};

export default function RecordsScreen() {
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [householdName, setHouseholdName] = useState<string | null>(null);
  const [canManageProviders, setCanManageProviders] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingProviderId, setExportingProviderId] = useState<string | null>(null);

  async function loadData() {
    try {
      setLoading(true);

      const permissions = await getActiveHouseholdPermissions();
      setCanManageProviders(permissions.canManageProviders);

      const householdId = await getCurrentHouseholdId();
      if (!householdId) {
        setProviders([]);
        setHouseholdName(null);
        return;
      }

      const [{ data: householdData, error: householdError }, { data, error }] =
        await Promise.all([
          supabase
            .from('households')
            .select('id, name')
            .eq('id', householdId)
            .single(),
          supabase
            .from('providers')
            .select('id, household_id, name, category, phone, email')
            .eq('household_id', householdId)
            .order('name', { ascending: true }),
        ]);

      if (householdError) {
        console.error(householdError.message);
      } else {
        setHouseholdName((householdData as HouseholdRow)?.name ?? null);
      }

      if (error) {
        console.error(error.message);
        return;
      }

      setProviders((data ?? []) as ProviderRow[]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const providerCount = useMemo(() => providers.length, [providers]);

  async function handleExportAllCsv() {
    try {
      setExporting(true);

      const householdId = await getCurrentHouseholdId();
      if (!householdId) {
        Alert.alert('No household', 'Select a household first.');
        return;
      }

      const { data, error } = await supabase
        .from('service_records')
        .select(
          'id, title, service_date, amount, notes, providers(name), service_record_documents(id)'
        )
        .eq('household_id', householdId)
        .order('service_date', { ascending: false });

      if (error) {
        Alert.alert('Export failed', error.message);
        return;
      }

      const rows = ((data ?? []) as ExportServiceRow[]).map((row) => ({
        providerName: row.providers?.[0]?.name ?? 'Unknown provider',
        serviceTitle: row.title,
        serviceDate: row.service_date,
        amount: row.amount,
        documentCount: row.service_record_documents?.length ?? 0,
        notes: row.notes,
      }));

      if (rows.length === 0) {
        Alert.alert('Nothing to export', 'There is no service history yet.');
        return;
      }

      await exportAllServiceHistoryCsv({
        householdName,
        rows,
      });
    } catch (error) {
      console.error(error);
      Alert.alert('Export failed', 'Could not export service history.');
    } finally {
      setExporting(false);
    }
  }

  async function handleExportProviderCsv(provider: ProviderRow) {
    try {
      setExportingProviderId(provider.id);

      const { data, error } = await supabase
        .from('service_records')
        .select('id, title, service_date, amount, notes, service_record_documents(id)')
        .eq('provider_id', provider.id)
        .order('service_date', { ascending: false });

      if (error) {
        Alert.alert('Export failed', error.message);
        return;
      }

      const rows = ((data ?? []) as ProviderExportRow[]).map((row) => ({
        title: row.title,
        service_date: row.service_date,
        amount: row.amount,
        notes: row.notes,
        documentCount: row.service_record_documents?.length ?? 0,
      }));

      if (rows.length === 0) {
        Alert.alert('Nothing to export', `No service history found for ${provider.name}.`);
        return;
      }

      await exportServiceHistoryCsv({
        providerName: provider.name,
        records: rows,
      });
    } catch (error) {
      console.error(error);
      Alert.alert('Export failed', 'Could not export provider service history.');
    } finally {
      setExportingProviderId(null);
    }
  }

  function renderProvider({ item }: { item: ProviderRow }) {
    const providerExporting = exportingProviderId === item.id;

    return (
      <View style={styles.card}>
        <Pressable
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
          {item.category ? (
            <Text style={styles.cardMeta}>Category: {item.category}</Text>
          ) : null}
          {item.phone ? <Text style={styles.cardMeta}>Phone: {item.phone}</Text> : null}
          {item.email ? <Text style={styles.cardMeta}>Email: {item.email}</Text> : null}
        </Pressable>

        <View style={styles.cardActions}>
          <Pressable
            style={styles.exportProviderButton}
            onPress={() => handleExportProviderCsv(item)}
            disabled={providerExporting}
          >
            <Text style={styles.exportProviderButtonText}>
              {providerExporting ? 'Exporting...' : 'Export Provider CSV'}
            </Text>
          </Pressable>

          <Pressable
            style={styles.viewButton}
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
            <Text style={styles.viewButtonText}>Open</Text>
          </Pressable>
        </View>
      </View>
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
      <View style={styles.headerBlock}>
        <Text style={styles.title}>Records</Text>
        <Text style={styles.subtitle}>Providers, service history, and documents.</Text>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{providerCount}</Text>
          <Text style={styles.summaryLabel}>Providers</Text>
        </View>
      </View>

      <View style={styles.actionsRow}>
        <Pressable
          style={styles.secondaryButton}
          onPress={handleExportAllCsv}
          disabled={exporting}
        >
          <Text style={styles.secondaryButtonText}>
            {exporting ? 'Exporting...' : 'Export All CSV'}
          </Text>
        </Pressable>

        <Pressable
          style={styles.primaryButton}
          onPress={() => router.push('/records/providers')}
        >
          <Text style={styles.primaryButtonText}>View Providers</Text>
        </Pressable>
      </View>

      {canManageProviders ? (
        <Pressable
          style={styles.addButton}
          onPress={() => router.push('/records/providers/new')}
        >
          <Text style={styles.addButtonText}>Add Provider</Text>
        </Pressable>
      ) : null}

      <FlatList
        data={providers}
        keyExtractor={(item) => item.id}
        renderItem={renderProvider}
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
  headerBlock: {
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
  summaryRow: {
    marginBottom: SPACING.md,
  },
  summaryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 13,
    color: COLORS.muted,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: COLORS.primaryText,
    fontWeight: '700',
  },
  addButton: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  addButtonText: {
    color: COLORS.text,
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
  cardActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  exportProviderButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingVertical: 12,
    alignItems: 'center',
  },
  exportProviderButtonText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  viewButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewButtonText: {
    color: COLORS.primaryText,
    fontWeight: '700',
  },
});