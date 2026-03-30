import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { exportServiceHistoryCsv } from '../../../../lib/service-history-export';

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
  service_record_documents?: { id: string }[] | null;
};

type FilterKey = 'all' | 'missing' | 'docs' | 'year';
type SortKey = 'newest' | 'oldest' | 'highest' | 'lowest';

type GroupedSection = {
  label: string;
  items: ServiceRecord[];
};

function dateValue(value: string | null) {
  if (!value) return 0;
  return new Date(`${value}T12:00:00`).getTime();
}

function amountValue(value: number | null) {
  return value ?? 0;
}

function getYearLabel(value: string | null) {
  if (!value) return 'No date';
  return value.slice(0, 4);
}

function formatCurrency(value: number) {
  return `$${value.toFixed(2)}`;
}

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
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [activeSort, setActiveSort] = useState<SortKey>('newest');

  function handleBack() {
    smartBack({
      navigation,
      returnTo: returnTo ?? '/records/providers',
      fallback: '/records/providers',
    });
  }

  function getDocumentCount(record: ServiceRecord) {
    return record.service_record_documents?.length ?? 0;
  }

  function getDocumentCountLabel(record: ServiceRecord) {
    const count = getDocumentCount(record);
    if (count === 0) return 'No documents';
    if (count === 1) return '1 document';
    return `${count} documents`;
  }

  function isThisYear(record: ServiceRecord) {
    if (!record.service_date) return false;
    const year = new Date().getFullYear();
    return record.service_date.startsWith(String(year));
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
        .select(
          'id, title, service_date, amount, notes, service_record_documents(id)'
        )
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
      Alert.alert('Error', 'Could not load provider details.');
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      if (id) loadData();
    }, [id])
  );

  const filteredAndSortedRecords = useMemo(() => {
    let next = [...records];

    if (activeFilter === 'missing') {
      next = next.filter((record) => getDocumentCount(record) === 0);
    } else if (activeFilter === 'docs') {
      next = next.filter((record) => getDocumentCount(record) > 0);
    } else if (activeFilter === 'year') {
      next = next.filter(isThisYear);
    }

    next.sort((a, b) => {
      if (activeSort === 'newest') {
        return dateValue(b.service_date) - dateValue(a.service_date);
      }

      if (activeSort === 'oldest') {
        return dateValue(a.service_date) - dateValue(b.service_date);
      }

      if (activeSort === 'highest') {
        return amountValue(b.amount) - amountValue(a.amount);
      }

      return amountValue(a.amount) - amountValue(b.amount);
    });

    return next;
  }, [records, activeFilter, activeSort]);

  const groupedSections = useMemo(() => {
    const groups = new Map<string, ServiceRecord[]>();

    filteredAndSortedRecords.forEach((record) => {
      const label = getYearLabel(record.service_date);
      const current = groups.get(label) ?? [];
      current.push(record);
      groups.set(label, current);
    });

    const sections: GroupedSection[] = Array.from(groups.entries()).map(
      ([label, items]) => ({
        label,
        items,
      })
    );

    sections.sort((a, b) => {
      if (a.label === 'No date') return 1;
      if (b.label === 'No date') return -1;
      return Number(b.label) - Number(a.label);
    });

    return sections;
  }, [filteredAndSortedRecords]);

  const summary = useMemo(() => {
    const totalRecords = records.length;
    const missingReceipts = records.filter(
      (record) => getDocumentCount(record) === 0
    ).length;
    const docsAttached = records.filter(
      (record) => getDocumentCount(record) > 0
    ).length;
    const totalSpend = records.reduce(
      (sum, record) => sum + amountValue(record.amount),
      0
    );

    return {
      totalRecords,
      missingReceipts,
      docsAttached,
      totalSpend,
    };
  }, [records]);

  async function handleExportCsv() {
    if (!provider) return;

    try {
      const exportRows = filteredAndSortedRecords.map((record) => ({
        title: record.title,
        service_date: record.service_date,
        amount: record.amount,
        notes: record.notes,
        documentCount: getDocumentCount(record),
      }));

      if (exportRows.length === 0) {
        Alert.alert('Nothing to export', 'There are no matching service records.');
        return;
      }

      await exportServiceHistoryCsv({
        providerName: provider.name,
        records: exportRows,
      });
    } catch (error) {
      console.error(error);
      Alert.alert('Export failed', 'Could not export service history.');
    }
  }

  function renderRecord(item: ServiceRecord) {
    const documentCount = getDocumentCount(item);
    const isMissingReceipt = documentCount === 0;
    const hasDocuments = documentCount > 0;

    return (
      <Pressable
        key={item.id}
        style={styles.recordCard}
        onPress={() =>
          router.push({
            pathname: '/records/service-records/edit/[id]',
            params: { id: item.id },
          })
        }
      >
        <View style={styles.recordHeaderRow}>
          <Text style={styles.recordTitle}>{item.title}</Text>

          <View style={styles.badgeStack}>
            {isMissingReceipt ? (
              <View style={styles.missingBadge}>
                <Text style={styles.missingBadgeText}>Missing receipt</Text>
              </View>
            ) : null}

            {hasDocuments ? (
              <View style={styles.docsBadge}>
                <Text style={styles.docsBadgeText}>Docs attached</Text>
              </View>
            ) : null}
          </View>
        </View>

        <Text style={styles.recordMeta}>
          Date: {item.service_date || 'No date'}
        </Text>
        <Text style={styles.recordMeta}>
          Amount: {item.amount != null ? `$${item.amount}` : 'Not set'}
        </Text>
        <Text style={styles.recordMeta}>
          Documents: {getDocumentCountLabel(item)}
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

      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{summary.totalRecords}</Text>
          <Text style={styles.summaryLabel}>Total records</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{summary.missingReceipts}</Text>
          <Text style={styles.summaryLabel}>Missing receipts</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{summary.docsAttached}</Text>
          <Text style={styles.summaryLabel}>Docs attached</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>
            {formatCurrency(summary.totalSpend)}
          </Text>
          <Text style={styles.summaryLabel}>Total spend</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Service history</Text>

        <View style={styles.headerActions}>
          <Pressable style={styles.secondaryActionButton} onPress={handleExportCsv}>
            <Text style={styles.secondaryActionButtonText}>Export CSV</Text>
          </Pressable>

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
      </View>

      <View style={styles.filterRow}>
        <Pressable
          style={[
            styles.filterChip,
            activeFilter === 'all' && styles.filterChipActive,
          ]}
          onPress={() => setActiveFilter('all')}
        >
          <Text
            style={[
              styles.filterChipText,
              activeFilter === 'all' && styles.filterChipTextActive,
            ]}
          >
            All
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.filterChip,
            activeFilter === 'missing' && styles.filterChipActive,
          ]}
          onPress={() => setActiveFilter('missing')}
        >
          <Text
            style={[
              styles.filterChipText,
              activeFilter === 'missing' && styles.filterChipTextActive,
            ]}
          >
            Missing receipt
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.filterChip,
            activeFilter === 'docs' && styles.filterChipActive,
          ]}
          onPress={() => setActiveFilter('docs')}
        >
          <Text
            style={[
              styles.filterChipText,
              activeFilter === 'docs' && styles.filterChipTextActive,
            ]}
          >
            Has documents
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.filterChip,
            activeFilter === 'year' && styles.filterChipActive,
          ]}
          onPress={() => setActiveFilter('year')}
        >
          <Text
            style={[
              styles.filterChipText,
              activeFilter === 'year' && styles.filterChipTextActive,
            ]}
          >
            This year
          </Text>
        </Pressable>
      </View>

      <View style={styles.sortRow}>
        <Pressable
          style={[
            styles.sortChip,
            activeSort === 'newest' && styles.sortChipActive,
          ]}
          onPress={() => setActiveSort('newest')}
        >
          <Text
            style={[
              styles.sortChipText,
              activeSort === 'newest' && styles.sortChipTextActive,
            ]}
          >
            Newest first
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.sortChip,
            activeSort === 'oldest' && styles.sortChipActive,
          ]}
          onPress={() => setActiveSort('oldest')}
        >
          <Text
            style={[
              styles.sortChipText,
              activeSort === 'oldest' && styles.sortChipTextActive,
            ]}
          >
            Oldest first
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.sortChip,
            activeSort === 'highest' && styles.sortChipActive,
          ]}
          onPress={() => setActiveSort('highest')}
        >
          <Text
            style={[
              styles.sortChipText,
              activeSort === 'highest' && styles.sortChipTextActive,
            ]}
          >
            Highest amount
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.sortChip,
            activeSort === 'lowest' && styles.sortChipActive,
          ]}
          onPress={() => setActiveSort('lowest')}
        >
          <Text
            style={[
              styles.sortChipText,
              activeSort === 'lowest' && styles.sortChipTextActive,
            ]}
          >
            Lowest amount
          </Text>
        </Pressable>
      </View>

      {groupedSections.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No matching service records.</Text>
        </View>
      ) : (
        groupedSections.map((section) => (
          <View key={section.label} style={styles.groupSection}>
            <Text style={styles.groupHeader}>{section.label}</Text>
            {section.items.map(renderRecord)}
          </View>
        ))
      )}
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
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  summaryCard: {
    width: '47%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 13,
    color: COLORS.muted,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'center',
  },
  secondaryActionButton: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryActionButtonText: {
    color: COLORS.primary,
    fontWeight: '700',
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
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  filterChip: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 13,
  },
  filterChipTextActive: {
    color: COLORS.primaryText,
  },
  sortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  sortChip: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sortChipActive: {
    backgroundColor: COLORS.accentSoft,
    borderColor: COLORS.accent,
  },
  sortChipText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 13,
  },
  sortChipTextActive: {
    color: COLORS.accent,
  },
  groupSection: {
    marginBottom: SPACING.lg,
  },
  groupHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  recordCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  recordHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginBottom: 8,
  },
  recordTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  badgeStack: {
    alignItems: 'flex-end',
    gap: 6,
  },
  missingBadge: {
    backgroundColor: COLORS.dangerSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  missingBadgeText: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  docsBadge: {
    backgroundColor: COLORS.accentSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  docsBadgeText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '700',
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