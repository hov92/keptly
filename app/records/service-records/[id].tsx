import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';

import { AppScreen } from '../../../components/app-screen';
import { COLORS, RADIUS, SPACING } from '../../../constants/theme';
import { supabase } from '../../../lib/supabase';
import { smartBack } from '../../../lib/navigation';

type ServiceRecordDocument = {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  document_kind: 'receipt' | 'invoice' | 'warranty' | 'photo' | 'other';
  is_primary: boolean;
  created_at: string;
};

type ServiceRecordProvider = {
  id: string;
  name: string;
  category: string | null;
};

type ServiceRecordDetail = {
  id: string;
  title: string;
  service_date: string | null;
  amount: number | null;
  notes: string | null;
  providers?: ServiceRecordProvider[] | null;
  service_record_documents?: ServiceRecordDocument[] | null;
};

export default function ServiceRecordDetailScreen() {
  const { id, returnTo } = useLocalSearchParams<{
    id: string;
    returnTo?: string;
  }>();
  const navigation = useNavigation();

  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<ServiceRecordDetail | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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

  useEffect(() => {
    async function loadRecord() {
      try {
        setLoading(true);

        const { data, error } = await supabase
          .from('service_records')
          .select(
            'id, title, service_date, amount, notes, providers(id, name, category), service_record_documents(id, file_name, file_path, file_type, document_kind, is_primary, created_at)'
          )
          .eq('id', id)
          .single();

        if (error) {
          Alert.alert('Load failed', error.message);
          return;
        }

        const nextRecord = data as unknown as ServiceRecordDetail;
        setRecord(nextRecord);

        const primaryDoc =
          nextRecord.service_record_documents?.find((doc) => doc.is_primary) ??
          null;

        if (primaryDoc && isImageDocument(primaryDoc)) {
          const { data: signed, error: signedError } = await supabase.storage
            .from('service-documents')
            .createSignedUrl(primaryDoc.file_path, 60 * 60);

          if (!signedError && signed?.signedUrl) {
            setPreviewUrl(signed.signedUrl);
          } else {
            setPreviewUrl(null);
          }
        } else {
          setPreviewUrl(null);
        }
      } catch (error) {
        console.error(error);
        Alert.alert('Load failed', 'Could not load service record.');
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      loadRecord();
    }
  }, [id]);

  const summary = useMemo(() => {
    const docs = record?.service_record_documents ?? [];
    return {
      docCount: docs.length,
      missingReceipt: docs.length === 0,
      primaryDoc: docs.find((doc) => doc.is_primary) ?? null,
    };
  }, [record]);

  async function handleOpenDoc(doc: ServiceRecordDocument) {
    try {
      const { data, error } = await supabase.storage
        .from('service-documents')
        .createSignedUrl(doc.file_path, 60);

      if (error || !data?.signedUrl) {
        Alert.alert('Open failed', error?.message || 'Could not open document.');
        return;
      }

      await Linking.openURL(data.signedUrl);
    } catch (error) {
      console.error(error);
      Alert.alert('Open failed', 'Could not open document.');
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!record) {
    return (
      <AppScreen>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.emptyText}>Service record not found.</Text>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <Pressable onPress={handleBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>Back</Text>
      </Pressable>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.title}>{record.title}</Text>

          <Text style={styles.meta}>
            Provider: {record.providers?.[0]?.name ?? 'Unknown provider'}
          </Text>

          <Text style={styles.meta}>
            Category: {record.providers?.[0]?.category ?? 'None'}
          </Text>

          <Text style={styles.meta}>
            Date: {record.service_date || 'No date'}
          </Text>

          <Text style={styles.meta}>
            Amount: {record.amount != null ? `$${record.amount}` : 'Not set'}
          </Text>

          <Text style={styles.meta}>Documents: {summary.docCount}</Text>

          <Text style={styles.meta}>
            Receipt status: {summary.missingReceipt ? 'Missing' : 'Attached'}
          </Text>

          {record.notes ? (
            <>
              <Text style={styles.subheading}>Notes</Text>
              <Text style={styles.notes}>{record.notes}</Text>
            </>
          ) : null}
        </View>

        {summary.primaryDoc ? (
          <View style={styles.card}>
            <Text style={styles.subheading}>
              {isImageDocument(summary.primaryDoc)
                ? 'Cover photo'
                : 'Primary receipt'}
            </Text>

            {previewUrl ? (
              <Image source={{ uri: previewUrl }} style={styles.heroImage} />
            ) : (
              <Text style={styles.meta}>{summary.primaryDoc.file_name}</Text>
            )}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.subheading}>Documents</Text>

          {(record.service_record_documents?.length ?? 0) === 0 ? (
            <Text style={styles.emptyText}>No documents attached yet.</Text>
          ) : (
            record.service_record_documents?.map((doc) => (
              <Pressable
                key={doc.id}
                style={styles.docRow}
                onPress={() => handleOpenDoc(doc)}
              >
                <View style={styles.docLeft}>
                  <Text style={styles.docName}>{doc.file_name}</Text>
                  <Text style={styles.docMeta}>
                    {doc.document_kind}
                    {doc.is_primary ? ' • primary' : ''}
                  </Text>
                </View>
                <Text style={styles.openText}>Open</Text>
              </Pressable>
            ))
          )}
        </View>

        <Pressable
          style={styles.editButton}
          onPress={() =>
            router.push({
              pathname: '/records/service-records/edit/[id]',
              params: {
                id: record.id,
                returnTo: `/records/service-records/${record.id}`,
              },
            })
          }
        >
          <Text style={styles.editButtonText}>Edit Service Record</Text>
        </Pressable>
      </ScrollView>
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
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  subheading: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  meta: {
    fontSize: 14,
    color: COLORS.muted,
    marginBottom: 6,
  },
  notes: {
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 22,
  },
  heroImage: {
    width: '100%',
    height: 220,
    borderRadius: RADIUS.md,
    resizeMode: 'cover',
  },
  docRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  docLeft: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  docName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  docMeta: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 4,
  },
  openText: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  editButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  editButtonText: {
    color: COLORS.primaryText,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyText: {
    color: COLORS.muted,
    fontSize: 15,
  },
});