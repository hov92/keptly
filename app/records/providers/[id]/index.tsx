import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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

type ServiceRecordDocument = {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  document_kind: 'receipt' | 'invoice' | 'warranty' | 'photo' | 'other';
  is_primary: boolean;
};

type ServiceRecord = {
  id: string;
  title: string;
  service_date: string | null;
  amount: number | null;
  notes: string | null;
  service_record_documents?: ServiceRecordDocument[] | null;
};

type PreviewMap = Record<string, string>;

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
  const [previewUrls, setPreviewUrls] = useState<PreviewMap>({});

  function handleBack() {
    smartBack({
      navigation,
      returnTo,
      fallback: '/(tabs)/records',
    });
  }

  function isImageDocument(doc: ServiceRecordDocument) {
    return (
      doc.document_kind === 'photo' ||
      doc.file_type?.startsWith('image/') === true
    );
  }

  function getPrimaryLabel(doc: ServiceRecordDocument) {
    return isImageDocument(doc) ? 'Cover photo' : 'Primary receipt';
  }

  async function loadPreviewUrls(recordRows: ServiceRecord[]) {
    const nextMap: PreviewMap = {};

    for (const record of recordRows) {
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
          'id, title, service_date, amount, notes, service_record_documents(id, file_name, file_path, file_type, document_kind, is_primary)'
        )
        .eq('provider_id', id)
        .order('service_date', { ascending: false });

      if (recordsError) {
        Alert.alert('Load failed', recordsError.message);
        return;
      }

      const recordRows = (recordsData ?? []) as ServiceRecord[];

      setProvider(providerData as Provider);
      setRecords(recordRows);
      await loadPreviewUrls(recordRows);
    } catch (error) {
      console.error(error);
      Alert.alert('Load failed', 'Could not load provider details.');
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      if (id) loadData();
    }, [id])
  );

  const summary = useMemo(() => {
    let missingReceipts = 0;
    let docsAttached = 0;

    for (const record of records) {
      const count = record.service_record_documents?.length ?? 0;
      if (count === 0) missingReceipts += 1;
      if (count > 0) docsAttached += 1;
    }

    return {
      totalRecords: records.length,
      missingReceipts,
      docsAttached,
    };
  }, [records]);

  function renderRecord({ item }: { item: ServiceRecord }) {
    const docs = item.service_record_documents ?? [];
    const documentCount = docs.length;
    const primaryDocument = docs.find((doc) => doc.is_primary) ?? null;
    const previewUrl = previewUrls[item.id];
    const hasDocuments = documentCount > 0;
    const isMissingReceipt = !hasDocuments;

    return (
      <Pressable
        style={styles.recordCard}
        onPress={() =>
          router.push({
            pathname: '/records/service-records/[id]',
            params: {
              id: item.id,
              returnTo: `/records/providers/${id}`,
            },
          })
        }
      >
        {primaryDocument && previewUrl ? (
          <Image source={{ uri: previewUrl }} style={styles.recordThumbnail} />
        ) : null}

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

        <View style={styles.badgeRow}>
          {primaryDocument ? (
            <View style={styles.primaryBadge}>
              <Text style={styles.primaryBadgeText}>
                {getPrimaryLabel(primaryDocument)}
              </Text>
            </View>
          ) : null}

          <View
            style={[
              styles.infoBadge,
              isMissingReceipt && styles.warningBadge,
            ]}
          >
            <Text
              style={[
                styles.infoBadgeText,
                isMissingReceipt && styles.warningBadgeText,
              ]}
            >
              {isMissingReceipt
                ? 'Missing receipt'
                : `${documentCount} ${documentCount === 1 ? 'doc' : 'docs'} attached`}
            </Text>
          </View>
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
        <Text style={styles.providerName}>{provider.name}</Text>

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

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{summary.totalRecords}</Text>
          <Text style={styles.summaryLabel}>Records</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{summary.docsAttached}</Text>
          <Text style={styles.summaryLabel}>With docs</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{summary.missingReceipts}</Text>
          <Text style={styles.summaryLabel}>Missing receipt</Text>
        </View>
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
                  returnTo: `/records/providers/${provider.id}`,
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
    marginBottom: SPACING.md,
  },
  providerName: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 10,
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
  summaryRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  summaryCard: {
    flex: 1,
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
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.muted,
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
  recordThumbnail: {
    width: '100%',
    height: 160,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    resizeMode: 'cover',
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