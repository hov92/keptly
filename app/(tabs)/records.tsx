import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { AppScreen } from '../../components/app-screen';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { getCurrentHouseholdId } from '../../lib/household';
import { getActiveHouseholdPermissions } from '../../lib/permissions';
import { exportAllServiceHistoryCsv } from '../../lib/all-service-history-export';

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

type ServiceRecordDocument = {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  document_kind: 'receipt' | 'invoice' | 'warranty' | 'photo' | 'other';
  is_primary: boolean;
};

type ServiceRecordProvider = {
  id: string;
  name: string;
  category: string | null;
};

type ServiceRecordRow = {
  id: string;
  title: string;
  service_date: string | null;
  amount: number | null;
  notes: string | null;
  provider_id: string | null;
  providers?: ServiceRecordProvider | null;
  service_record_documents?: ServiceRecordDocument[] | null;
};

type ExportServiceRow = {
  id: string;
  title: string;
  service_date: string | null;
  amount: number | null;
  notes: string | null;
  providers?: { name: string } | null;
  service_record_documents?: { id: string }[] | null;
};

type PreviewMap = Record<string, string>;

type RecordsFilter =
  | 'all'
  | 'providers'
  | 'service-records'
  | 'missing-receipt'
  | 'has-docs'
  | 'overdue-missing-receipt';

type RecordsSort =
  | 'newest'
  | 'oldest'
  | 'highest-amount'
  | 'lowest-amount'
  | 'provider-az';

const RECEIPT_OVERDUE_DAYS = 7;

function daysBetween(fromDate: Date, toDate: Date) {
  const diff = toDate.getTime() - fromDate.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function parseSafeDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export default function RecordsScreen() {
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [serviceRecords, setServiceRecords] = useState<ServiceRecordRow[]>([]);
  const [householdName, setHouseholdName] = useState<string | null>(null);
  const [canManageProviders, setCanManageProviders] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingVisible, setExportingVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<RecordsFilter>('all');
  const [activeSort, setActiveSort] = useState<RecordsSort>('newest');
  const [previewUrls, setPreviewUrls] = useState<PreviewMap>({});

  function isImageDocument(doc: ServiceRecordDocument) {
    return (
      doc.document_kind === 'photo' ||
      doc.file_type?.startsWith('image/') === true
    );
  }

  function isMissingReceipt(record: ServiceRecordRow) {
    return (record.service_record_documents?.length ?? 0) === 0;
  }

  function isOverdueMissingReceipt(record: ServiceRecordRow) {
    if (!isMissingReceipt(record)) return false;
    const serviceDate = parseSafeDate(record.service_date);
    if (!serviceDate) return false;

    const today = new Date();
    return daysBetween(serviceDate, today) >= RECEIPT_OVERDUE_DAYS;
  }

  async function loadPreviewUrls(records: ServiceRecordRow[]) {
    const nextMap: PreviewMap = {};

    for (const record of records) {
      const primaryDoc =
        record.service_record_documents?.find((doc) => doc.is_primary) ?? null;

      if (!primaryDoc || !isImageDocument(primaryDoc)) continue;

      const { data, error } = await supabase.storage
        .from('service-documents')
        .createSignedUrl(primaryDoc.file_path, 60 * 60);

      if (!error && data?.signedUrl) {
        nextMap[record.id] = data.signedUrl;
      }
    }

    setPreviewUrls(nextMap);
  }

  async function loadData() {
    try {
      setLoading(true);

      const permissions = await getActiveHouseholdPermissions();
      setCanManageProviders(permissions.canManageProviders);

      const householdId = await getCurrentHouseholdId();
      if (!householdId) {
        setProviders([]);
        setServiceRecords([]);
        setHouseholdName(null);
        return;
      }

      const [
        { data: householdData, error: householdError },
        { data: providersData, error: providersError },
        { data: recordsData, error: recordsError },
      ] = await Promise.all([
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
        supabase
          .from('service_records')
          .select(
            'id, title, service_date, amount, notes, provider_id, providers(id, name, category), service_record_documents(id, file_name, file_path, file_type, document_kind, is_primary)'
          )
          .eq('household_id', householdId),
      ]);

      if (householdError) {
        console.error(householdError.message);
      } else {
        setHouseholdName((householdData as HouseholdRow)?.name ?? null);
      }

      if (providersError) {
        console.error(providersError.message);
      } else {
        setProviders((providersData ?? []) as ProviderRow[]);
      }

      if (recordsError) {
        console.error(recordsError.message);
      } else {
        const rows = (recordsData ?? []) as unknown as ServiceRecordRow[];
        setServiceRecords(rows);
        await loadPreviewUrls(rows);
      }
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
  const totalRecordCount = useMemo(() => serviceRecords.length, [serviceRecords]);

  const summary = useMemo(() => {
    let missingReceipts = 0;
    let docsAttached = 0;
    let overdueMissingReceipts = 0;

    for (const record of serviceRecords) {
      const count = record.service_record_documents?.length ?? 0;

      if (count === 0) {
        missingReceipts += 1;
        if (isOverdueMissingReceipt(record)) {
          overdueMissingReceipts += 1;
        }
      } else {
        docsAttached += 1;
      }
    }

    return { missingReceipts, docsAttached, overdueMissingReceipts };
  }, [serviceRecords]);

  const normalizedSearch = search.trim().toLowerCase();

  const filteredProviders = useMemo(() => {
    const base = providers.filter((provider) => {
      if (!normalizedSearch) return true;

      return (
        provider.name.toLowerCase().includes(normalizedSearch) ||
        provider.category?.toLowerCase().includes(normalizedSearch) === true ||
        provider.email?.toLowerCase().includes(normalizedSearch) === true ||
        provider.phone?.toLowerCase().includes(normalizedSearch) === true
      );
    });

    if (
      activeFilter === 'service-records' ||
      activeFilter === 'missing-receipt' ||
      activeFilter === 'has-docs' ||
      activeFilter === 'overdue-missing-receipt'
    ) {
      return [];
    }

    return [...base].sort((a, b) => a.name.localeCompare(b.name));
  }, [providers, normalizedSearch, activeFilter]);

  const filteredServiceRecords = useMemo(() => {
    const base = serviceRecords.filter((record) => {
      const docs = record.service_record_documents ?? [];
      const hasDocs = docs.length > 0;

      const matchesSearch =
        !normalizedSearch ||
        record.title.toLowerCase().includes(normalizedSearch) ||
        record.notes?.toLowerCase().includes(normalizedSearch) === true ||
        record.providers?.name.toLowerCase().includes(normalizedSearch) ===
          true ||
        record.providers?.category?.toLowerCase().includes(normalizedSearch) ===
          true;

      if (!matchesSearch) return false;

      if (activeFilter === 'missing-receipt') return !hasDocs;
      if (activeFilter === 'has-docs') return hasDocs;
      if (activeFilter === 'overdue-missing-receipt') {
        return isOverdueMissingReceipt(record);
      }
      if (activeFilter === 'providers') return false;

      return true;
    });

    const sorted = [...base].sort((a, b) => {
      if (activeSort === 'newest') {
        const aTime = parseSafeDate(a.service_date)?.getTime() ?? 0;
        const bTime = parseSafeDate(b.service_date)?.getTime() ?? 0;
        return bTime - aTime;
      }

      if (activeSort === 'oldest') {
        const aTime = parseSafeDate(a.service_date)?.getTime() ?? 0;
        const bTime = parseSafeDate(b.service_date)?.getTime() ?? 0;
        return aTime - bTime;
      }

      if (activeSort === 'highest-amount') {
        return (b.amount ?? 0) - (a.amount ?? 0);
      }

      if (activeSort === 'lowest-amount') {
        return (a.amount ?? 0) - (b.amount ?? 0);
      }

      if (activeSort === 'provider-az') {
        return (a.providers?.name ?? '').localeCompare(b.providers?.name ?? '');
      }

      return 0;
    });

    if (activeFilter === 'providers') {
      return [];
    }

    return sorted;
  }, [serviceRecords, normalizedSearch, activeFilter, activeSort]);

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
        .eq('household_id', householdId);

      if (error) {
        Alert.alert('Export failed', error.message);
        return;
      }

      const rows = ((data ?? []) as unknown as ExportServiceRow[]).map((row) => ({
        providerName: row.providers?.name ?? 'Unknown provider',
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

  async function handleExportVisibleCsv() {
    try {
      setExportingVisible(true);

      const rows = filteredServiceRecords.map((row) => ({
        providerName: row.providers?.name ?? 'Unknown provider',
        serviceTitle: row.title,
        serviceDate: row.service_date,
        amount: row.amount,
        documentCount: row.service_record_documents?.length ?? 0,
        notes: row.notes,
      }));

      if (rows.length === 0) {
        Alert.alert('Nothing to export', 'There are no visible service records to export.');
        return;
      }

      await exportAllServiceHistoryCsv({
        householdName,
        rows,
      });
    } catch (error) {
      console.error(error);
      Alert.alert('Export failed', 'Could not export visible service history.');
    } finally {
      setExportingVisible(false);
    }
  }

  function renderProvider({ item }: { item: ProviderRow }) {
    return (
      <Pressable
        style={styles.card}
        onPress={() =>
          router.push({
            pathname: '/records/providers/[id]',
            params: {
              id: item.id,
              returnTo: '/(tabs)/records',
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
    );
  }

  function renderServiceRecord({ item }: { item: ServiceRecordRow }) {
    const docs = item.service_record_documents ?? [];
    const docCount = docs.length;
    const primaryDoc = docs.find((doc) => doc.is_primary) ?? null;
    const previewUrl = previewUrls[item.id];
    const hasDocs = docCount > 0;
    const overdueMissing = isOverdueMissingReceipt(item);

    return (
      <Pressable
        style={styles.card}
        onPress={() =>
          router.push({
            pathname: '/records/service-records/[id]',
            params: { id: item.id, returnTo: '/(tabs)/records' },
          })
        }
      >
        {primaryDoc && previewUrl ? (
          <Image source={{ uri: previewUrl }} style={styles.recordThumbnail} />
        ) : null}

        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardMeta}>
          Provider: {item.providers?.name ?? 'Unknown provider'}
        </Text>
        {item.service_date ? (
          <Text style={styles.cardMeta}>Date: {item.service_date}</Text>
        ) : null}
        <Text style={styles.cardMeta}>
          Amount: {item.amount != null ? `$${item.amount}` : 'Not set'}
        </Text>
        {item.notes ? <Text style={styles.cardMeta}>Notes: {item.notes}</Text> : null}

        <View style={styles.badgeRow}>
          {primaryDoc ? (
            <View style={styles.primaryBadge}>
              <Text style={styles.primaryBadgeText}>
                {isImageDocument(primaryDoc) ? 'Cover photo' : 'Primary receipt'}
              </Text>
            </View>
          ) : null}

          <View
            style={[
              styles.infoBadge,
              !hasDocs && styles.warningBadge,
            ]}
          >
            <Text
              style={[
                styles.infoBadgeText,
                !hasDocs && styles.warningBadgeText,
              ]}
            >
              {!hasDocs
                ? 'Missing receipt'
                : `${docCount} ${docCount === 1 ? 'doc' : 'docs'} attached`}
            </Text>
          </View>

          {overdueMissing ? (
            <View style={styles.overdueBadge}>
              <Text style={styles.overdueBadgeText}>Follow up</Text>
            </View>
          ) : null}
        </View>
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

  const showProviders =
    activeFilter === 'all' || activeFilter === 'providers';
  const showServiceRecords =
    activeFilter === 'all' ||
    activeFilter === 'service-records' ||
    activeFilter === 'missing-receipt' ||
    activeFilter === 'has-docs' ||
    activeFilter === 'overdue-missing-receipt';

  const nothingVisible =
    (!showProviders || filteredProviders.length === 0) &&
    (!showServiceRecords || filteredServiceRecords.length === 0);

  return (
    <AppScreen>
      <View style={styles.headerBlock}>
        <Text style={styles.title}>Records</Text>
        <Text style={styles.subtitle}>
          Providers, service history, and documents.
        </Text>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{providerCount}</Text>
          <Text style={styles.summaryLabel}>Providers</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{totalRecordCount}</Text>
          <Text style={styles.summaryLabel}>Service records</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{summary.missingReceipts}</Text>
          <Text style={styles.summaryLabel}>Missing receipt</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{summary.overdueMissingReceipts}</Text>
          <Text style={styles.summaryLabel}>Follow up</Text>
        </View>
      </View>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search providers, services, notes..."
        placeholderTextColor={COLORS.muted}
        style={styles.searchInput}
      />

      <View style={styles.filterRow}>
        {[
          ['all', 'All'],
          ['providers', 'Providers'],
          ['service-records', 'Service records'],
          ['missing-receipt', 'Missing receipt'],
          ['has-docs', 'Has docs'],
          ['overdue-missing-receipt', 'Follow up'],
        ].map(([value, label]) => (
          <Pressable
            key={value}
            style={[
              styles.filterChip,
              activeFilter === value && styles.filterChipActive,
            ]}
            onPress={() => setActiveFilter(value as RecordsFilter)}
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === value && styles.filterChipTextActive,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.sortRow}>
        {[
          ['newest', 'Newest'],
          ['oldest', 'Oldest'],
          ['highest-amount', 'Highest $'],
          ['lowest-amount', 'Lowest $'],
          ['provider-az', 'Provider A–Z'],
        ].map(([value, label]) => (
          <Pressable
            key={value}
            style={[
              styles.sortChip,
              activeSort === value && styles.sortChipActive,
            ]}
            onPress={() => setActiveSort(value as RecordsSort)}
          >
            <Text
              style={[
                styles.sortChipText,
                activeSort === value && styles.sortChipTextActive,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
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
          style={styles.secondaryButton}
          onPress={handleExportVisibleCsv}
          disabled={exportingVisible}
        >
          <Text style={styles.secondaryButtonText}>
            {exportingVisible ? 'Exporting...' : 'Export Visible CSV'}
          </Text>
        </Pressable>
      </View>

      {canManageProviders ? (
        <Pressable
          style={styles.primaryButtonFull}
          onPress={() => router.push('/records/providers/new')}
        >
          <Text style={styles.primaryButtonText}>Add Provider</Text>
        </Pressable>
      ) : null}

      {showProviders ? (
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Providers</Text>

          {filteredProviders.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardMeta}>No matching providers.</Text>
            </View>
          ) : (
            <FlatList
              data={filteredProviders}
              keyExtractor={(item) => item.id}
              renderItem={renderProvider}
              scrollEnabled={false}
            />
          )}
        </View>
      ) : null}

      {showServiceRecords ? (
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Service history</Text>

          {filteredServiceRecords.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardMeta}>No matching service records.</Text>
            </View>
          ) : (
            <FlatList
              data={filteredServiceRecords}
              keyExtractor={(item) => item.id}
              renderItem={renderServiceRecord}
              scrollEnabled={false}
            />
          )}
        </View>
      ) : null}

      {nothingVisible ? (
        <View style={styles.card}>
          <Text style={styles.cardMeta}>Nothing matches your search or filter.</Text>
        </View>
      ) : null}
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  summaryCard: {
    minWidth: '47%',
    flexGrow: 1,
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
  searchInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.background,
    marginBottom: SPACING.sm,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
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
  primaryButtonFull: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  primaryButtonText: {
    color: COLORS.primaryText,
    fontWeight: '700',
  },
  sectionBlock: {
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
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
  recordThumbnail: {
    width: '100%',
    height: 160,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    resizeMode: 'cover',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  primaryBadge: {
    backgroundColor: COLORS.accentSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  primaryBadgeText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  infoBadge: {
    backgroundColor: COLORS.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  infoBadgeText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
  },
  warningBadge: {
    backgroundColor: COLORS.dangerSoft,
    borderColor: COLORS.dangerSoft,
  },
  warningBadgeText: {
    color: COLORS.danger,
  },
  overdueBadge: {
    backgroundColor: '#FFF1DB',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  overdueBadgeText: {
    color: '#9A5B00',
    fontSize: 12,
    fontWeight: '700',
  },
});