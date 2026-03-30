import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { supabase } from '../../../../lib/supabase';
import { AppScreen } from '../../../../components/app-screen';
import { FormInput } from '../../../../components/form-input';
import { DateField } from '../../../../components/date-field';
import { CategoryPicker } from '../../../../components/category-picker';
import { COLORS, RADIUS, SPACING } from '../../../../constants/theme';

type LoadedRecord = {
  title: string;
  service_date: string | null;
  amount: number | null;
  notes: string | null;
  household_id: string;
};

type ServiceRecordDocument = {
  id: string;
  service_record_id: string;
  household_id: string;
  file_path: string;
  file_name: string;
  file_type: string | null;
  document_kind: 'receipt' | 'invoice' | 'warranty' | 'photo' | 'other';
  created_by: string | null;
  created_at: string;
};

type DocumentPreviewMap = Record<string, string>;

type PendingUpload =
  | {
      source: 'photo';
      base64: string;
      fileName: string;
      mimeType?: string | null;
      kind: DocumentKind;
    }
  | {
      source: 'file';
      uri: string;
      fileName: string;
      mimeType?: string | null;
      kind: DocumentKind;
    };

const DOCUMENT_KIND_OPTIONS = [
  'receipt',
  'invoice',
  'warranty',
  'photo',
  'other',
] as const;

type DocumentKind = (typeof DOCUMENT_KIND_OPTIONS)[number];

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

function splitFileName(fileName: string) {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot <= 0) {
    return { base: fileName, ext: '' };
  }
  return {
    base: fileName.slice(0, lastDot),
    ext: fileName.slice(lastDot),
  };
}

function ZoomablePreviewImage({ uri }: { uri: string }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = clamp(savedScale.value * event.scale, 1, 4);
    })
    .onEnd(() => {
      savedScale.value = clamp(scale.value, 1, 4);
      scale.value = withSpring(savedScale.value);
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const next = savedScale.value > 1 ? 1 : 2.5;
      savedScale.value = next;
      scale.value = withSpring(next);
    });

  const composed = Gesture.Simultaneous(pinch, doubleTap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.Image
        source={{ uri }}
        style={[styles.previewImage, animatedStyle]}
        resizeMode="contain"
      />
    </GestureDetector>
  );
}

export default function EditServiceRecordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width: windowWidth } = useWindowDimensions();

  const [title, setTitle] = useState('');
  const [serviceDate, setServiceDate] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [householdId, setHouseholdId] = useState<string | null>(null);

  const [documents, setDocuments] = useState<ServiceRecordDocument[]>([]);
  const [documentKind, setDocumentKind] = useState<DocumentKind>('receipt');
  const [documentPreviewUrls, setDocumentPreviewUrls] =
    useState<DocumentPreviewMap>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImages, setPreviewImages] = useState<ServiceRecordDocument[]>(
    []
  );
  const [previewIndex, setPreviewIndex] = useState(0);

  const [renameVisible, setRenameVisible] = useState(false);
  const [renameBaseName, setRenameBaseName] = useState('');
  const [renameExtension, setRenameExtension] = useState('');
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null);

  const previewListRef = useRef<FlatList<ServiceRecordDocument>>(null);

  useEffect(() => {
    async function loadRecord() {
      const { data, error } = await supabase
        .from('service_records')
        .select('title, service_date, amount, notes, household_id')
        .eq('id', id)
        .single();

      if (error) {
        Alert.alert('Load failed', error.message);
        router.back();
        return;
      }

      const record = data as LoadedRecord;

      setTitle(record.title ?? '');
      setServiceDate(record.service_date ?? null);
      setAmount(record.amount != null ? String(record.amount) : '');
      setNotes(record.notes ?? '');
      setHouseholdId(record.household_id ?? null);

      await loadDocuments();
      setLoading(false);
    }

    if (id) {
      loadRecord();
    }
  }, [id]);

  useEffect(() => {
    if (!previewVisible) return;

    const timeout = setTimeout(() => {
      previewListRef.current?.scrollToIndex({
        index: previewIndex,
        animated: false,
      });
    }, 0);

    return () => clearTimeout(timeout);
  }, [previewVisible, previewIndex]);

  async function loadDocuments() {
    const { data, error } = await supabase
      .from('service_record_documents')
      .select(
        'id, service_record_id, household_id, file_path, file_name, file_type, document_kind, created_by, created_at'
      )
      .eq('service_record_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      Alert.alert('Document load failed', error.message);
      return;
    }

    const docs = (data ?? []) as ServiceRecordDocument[];
    setDocuments(docs);
    await loadPreviewUrls(docs);
  }

  async function loadPreviewUrls(docs: ServiceRecordDocument[]) {
    const nextMap: DocumentPreviewMap = {};

    for (const doc of docs) {
      if (!isImageDocument(doc)) continue;

      const { data, error } = await supabase.storage
        .from('service-documents')
        .createSignedUrl(doc.file_path, 60 * 60);

      if (!error && data?.signedUrl) {
        nextMap[doc.id] = data.signedUrl;
      }
    }

    setDocumentPreviewUrls(nextMap);
  }

  function isImageDocument(doc: ServiceRecordDocument) {
    return (
      doc.document_kind === 'photo' ||
      doc.file_type?.startsWith('image/') === true
    );
  }

  function getDocumentTypeLabel(doc: ServiceRecordDocument) {
    if (doc.document_kind === 'receipt') return 'Receipt';
    if (doc.document_kind === 'invoice') return 'Invoice';
    if (doc.document_kind === 'warranty') return 'Warranty';
    if (doc.document_kind === 'photo') return 'Photo';
    return 'Document';
  }

  async function handleSave() {
    if (!title.trim()) {
      Alert.alert('Missing info', 'Enter a service title.');
      return;
    }

    const parsedAmount =
      amount.trim() === '' ? null : Number.parseFloat(amount.trim());

    if (amount.trim() !== '' && Number.isNaN(parsedAmount as number)) {
      Alert.alert('Invalid amount', 'Enter a valid dollar amount.');
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from('service_records')
        .update({
          title: title.trim(),
          service_date: serviceDate,
          amount: parsedAmount,
          notes: notes.trim() || null,
        })
        .eq('id', id);

      if (error) {
        Alert.alert('Save failed', error.message);
        return;
      }

      router.back();
    } catch {
      Alert.alert('Error', 'Something went wrong saving the service record.');
    } finally {
      setSaving(false);
    }
  }

  async function uploadAsset(params: {
    uri: string;
    fileName: string;
    mimeType?: string | null;
    kind: DocumentKind;
  }) {
    if (!householdId) {
      Alert.alert(
        'Missing household',
        'Could not determine household for this record.'
      );
      return;
    }

    const { uri, fileName, mimeType, kind } = params;

    const safeName = fileName.replace(/[^\w.\-]+/g, '_');
    const filePath = `${householdId}/${id}/${Date.now()}-${safeName}`;

    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const arrayBuffer = decode(base64);

    const { error: uploadError } = await supabase.storage
      .from('service-documents')
      .upload(filePath, arrayBuffer, {
        contentType: mimeType ?? 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) {
      Alert.alert('Upload failed', uploadError.message);
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const { error: insertError } = await supabase
      .from('service_record_documents')
      .insert({
        service_record_id: id,
        household_id: householdId,
        file_path: filePath,
        file_name: fileName,
        file_type: mimeType ?? null,
        document_kind: kind,
        created_by: session?.user?.id ?? null,
      });

    if (insertError) {
      Alert.alert('Save failed', insertError.message);
      return;
    }

    await loadDocuments();
  }

  async function uploadPhotoAsset(params: {
    base64: string;
    fileName: string;
    mimeType?: string | null;
    kind: DocumentKind;
  }) {
    if (!householdId) {
      Alert.alert(
        'Missing household',
        'Could not determine household for this record.'
      );
      return;
    }

    const { base64, fileName, mimeType, kind } = params;

    if (!base64) {
      Alert.alert('Upload failed', 'Photo data was empty.');
      return;
    }

    const safeName = fileName.replace(/[^\w.\-]+/g, '_');
    const filePath = `${householdId}/${id}/${Date.now()}-${safeName}`;

    const arrayBuffer = decode(base64);

    const { error: uploadError } = await supabase.storage
      .from('service-documents')
      .upload(filePath, arrayBuffer, {
        contentType: mimeType ?? 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      Alert.alert('Upload failed', uploadError.message);
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const { error: insertError } = await supabase
      .from('service_record_documents')
      .insert({
        service_record_id: id,
        household_id: householdId,
        file_path: filePath,
        file_name: fileName,
        file_type: mimeType ?? null,
        document_kind: kind,
        created_by: session?.user?.id ?? null,
      });

    if (insertError) {
      Alert.alert('Save failed', insertError.message);
      return;
    }

    await loadDocuments();
  }

  function openRenameModal(upload: PendingUpload) {
    const { base, ext } = splitFileName(upload.fileName);
    setPendingUpload(upload);
    setRenameBaseName(base);
    setRenameExtension(ext);
    setRenameVisible(true);
  }

  function closeRenameModal() {
    if (uploading) return;
    setRenameVisible(false);
    setPendingUpload(null);
    setRenameBaseName('');
    setRenameExtension('');
  }

  async function confirmRenameAndUpload() {
    if (!pendingUpload) return;

    const trimmedBase = renameBaseName.trim();
    if (!trimmedBase) {
      Alert.alert('Missing name', 'Enter a file name.');
      return;
    }

    const finalFileName = `${trimmedBase}${renameExtension}`;

    try {
      setUploading(true);
      setRenameVisible(false);

      if (pendingUpload.source === 'photo') {
        await uploadPhotoAsset({
          base64: pendingUpload.base64,
          fileName: finalFileName,
          mimeType: pendingUpload.mimeType,
          kind: pendingUpload.kind,
        });
      } else {
        await uploadAsset({
          uri: pendingUpload.uri,
          fileName: finalFileName,
          mimeType: pendingUpload.mimeType,
          kind: pendingUpload.kind,
        });
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Upload failed', 'Could not save this file.');
    } finally {
      setUploading(false);
      setPendingUpload(null);
      setRenameBaseName('');
      setRenameExtension('');
    }
  }

  async function handleUploadDocument() {
    try {
      const pickerResult = await DocumentPicker.getDocumentAsync({
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (pickerResult.canceled) return;

      const asset = pickerResult.assets[0];

      openRenameModal({
        source: 'file',
        uri: asset.uri,
        fileName: asset.name,
        mimeType: asset.mimeType ?? null,
        kind: documentKind,
      });
    } catch (error) {
      console.error(error);
      Alert.alert('Upload failed', 'Could not upload this document.');
    }
  }

  async function handleChoosePhoto() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permission needed',
          'Allow photo library access to choose a receipt photo.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.85,
        base64: true,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      const extension = asset.fileName?.split('.').pop() || 'jpg';
      const fileName = asset.fileName || `photo-${Date.now()}.${extension}`;

      openRenameModal({
        source: 'photo',
        base64: asset.base64 ?? '',
        fileName,
        mimeType: asset.mimeType ?? 'image/jpeg',
        kind: documentKind,
      });
    } catch (error) {
      console.error(error);
      Alert.alert('Upload failed', 'Could not choose a photo.');
    }
  }

  async function handleTakePhoto() {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permission needed',
          'Allow camera access to take a receipt photo.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.85,
        base64: true,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      const extension = asset.fileName?.split('.').pop() || 'jpg';
      const fileName = asset.fileName || `camera-${Date.now()}.${extension}`;

      openRenameModal({
        source: 'photo',
        base64: asset.base64 ?? '',
        fileName,
        mimeType: asset.mimeType ?? 'image/jpeg',
        kind: documentKind,
      });
    } catch (error) {
      console.error(error);
      Alert.alert('Upload failed', 'Could not take a photo.');
    }
  }

  function openImagePreview(doc: ServiceRecordDocument) {
    const imageDocs = documents.filter(isImageDocument);
    const index = imageDocs.findIndex((item) => item.id === doc.id);

    if (index < 0) {
      Alert.alert('Preview unavailable', 'Could not preview this image yet.');
      return;
    }

    setPreviewImages(imageDocs);
    setPreviewIndex(index);
    setPreviewVisible(true);
  }

  async function handleOpenDocument(doc: ServiceRecordDocument) {
    if (isImageDocument(doc)) {
      openImagePreview(doc);
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from('service-documents')
        .createSignedUrl(doc.file_path, 60);

      if (error || !data?.signedUrl) {
        Alert.alert(
          'Open failed',
          error?.message || 'Could not open this document.'
        );
        return;
      }

      await Linking.openURL(data.signedUrl);
    } catch (error) {
      console.error(error);
      Alert.alert('Open failed', 'Could not open this document.');
    }
  }

  async function handleDeleteDocument(doc: ServiceRecordDocument) {
    Alert.alert('Delete document?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error: storageError } = await supabase.storage
            .from('service-documents')
            .remove([doc.file_path]);

          if (storageError) {
            Alert.alert('Delete failed', storageError.message);
            return;
          }

          const { error: rowError } = await supabase
            .from('service_record_documents')
            .delete()
            .eq('id', doc.id);

          if (rowError) {
            Alert.alert('Delete failed', rowError.message);
            return;
          }

          if (previewVisible) {
            const nextImages = previewImages.filter((item) => item.id !== doc.id);
            setPreviewImages(nextImages);

            if (nextImages.length === 0) {
              setPreviewVisible(false);
              setPreviewIndex(0);
            } else if (previewIndex >= nextImages.length) {
              setPreviewIndex(nextImages.length - 1);
            }
          }

          await loadDocuments();
        },
      },
    ]);
  }

  function handlePreviewScrollEnd(
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) {
    const { contentOffset, layoutMeasurement } = event.nativeEvent;
    const nextIndex = Math.round(contentOffset.x / layoutMeasurement.width);
    setPreviewIndex(nextIndex);
  }

  function renderPreviewItem({ item }: { item: ServiceRecordDocument }) {
    const previewUrl = documentPreviewUrls[item.id];

    return (
      <View style={[styles.previewSlide, { width: windowWidth }]}>
        {previewUrl ? (
          <ZoomablePreviewImage uri={previewUrl} />
        ) : (
          <Text style={styles.previewEmptyText}>No image available.</Text>
        )}
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

  const currentPreviewDoc = previewImages[previewIndex];

  return (
    <AppScreen>
      <FormInput
        placeholder="Service title"
        value={title}
        onChangeText={setTitle}
        returnKeyType="done"
      />

      <DateField
        label="Service date"
        value={serviceDate}
        onChange={setServiceDate}
      />

      <FormInput
        placeholder="Amount paid"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        returnKeyType="done"
      />

      <FormInput
        placeholder="Notes"
        value={notes}
        onChangeText={setNotes}
        multiline
      />

      <Pressable style={styles.button} onPress={handleSave} disabled={saving}>
        <Text style={styles.buttonText}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Text>
      </Pressable>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Documents</Text>
        <Text style={styles.sectionHelp}>
          Upload receipts, invoices, warranties, or photos for this service.
        </Text>

        <CategoryPicker
          label="Document type"
          value={documentKind}
          onChange={(value) =>
            setDocumentKind((value || 'receipt') as DocumentKind)
          }
          options={[...DOCUMENT_KIND_OPTIONS]}
          placeholder="Select document type"
        />

        <View style={styles.uploadGrid}>
          <Pressable
            style={styles.secondaryButton}
            onPress={handleTakePhoto}
            disabled={uploading}
          >
            <Text style={styles.secondaryButtonText}>
              {uploading ? 'Working...' : 'Take Photo'}
            </Text>
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={handleChoosePhoto}
            disabled={uploading}
          >
            <Text style={styles.secondaryButtonText}>
              {uploading ? 'Working...' : 'Choose Photo'}
            </Text>
          </Pressable>
        </View>

        <Pressable
          style={styles.secondaryButton}
          onPress={handleUploadDocument}
          disabled={uploading}
        >
          <Text style={styles.secondaryButtonText}>
            {uploading ? 'Uploading...' : 'Upload File'}
          </Text>
        </Pressable>

        {documents.length === 0 ? (
          <View style={styles.documentCard}>
            <Text style={styles.documentMeta}>No documents uploaded yet.</Text>
          </View>
        ) : (
          documents.map((doc) => {
            const previewUrl = documentPreviewUrls[doc.id];
            const isImage = isImageDocument(doc);

            return (
              <View key={doc.id} style={styles.documentCard}>
                {isImage && previewUrl ? (
                  <Pressable onPress={() => openImagePreview(doc)}>
                    <Image source={{ uri: previewUrl }} style={styles.thumbnail} />
                  </Pressable>
                ) : (
                  <View style={styles.fileBadge}>
                    <Text style={styles.fileBadgeText}>
                      {getDocumentTypeLabel(doc)}
                    </Text>
                  </View>
                )}

                <Text style={styles.documentTitle}>{doc.file_name}</Text>
                <Text style={styles.documentMeta}>
                  Type: {getDocumentTypeLabel(doc)}
                </Text>
                <Text style={styles.documentMeta}>
                  Added: {new Date(doc.created_at).toLocaleString()}
                </Text>

                <View style={styles.documentActions}>
                  <Pressable
                    style={styles.inlineButton}
                    onPress={() => handleOpenDocument(doc)}
                  >
                    <Text style={styles.inlineButtonText}>
                      {isImage ? 'View Full' : 'Open'}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={styles.inlineDeleteButton}
                    onPress={() => handleDeleteDocument(doc)}
                  >
                    <Text style={styles.inlineDeleteButtonText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </View>

      <Modal
        visible={renameVisible}
        transparent
        animationType="fade"
        onRequestClose={closeRenameModal}
      >
        <View style={styles.renameOverlay}>
          <View style={styles.renameCard}>
            <Text style={styles.renameTitle}>Rename file</Text>
            <Text style={styles.renameHelp}>
              Choose how this file should appear in the app.
            </Text>

            <View style={styles.renameInputRow}>
              <TextInput
                value={renameBaseName}
                onChangeText={setRenameBaseName}
                placeholder="File name"
                placeholderTextColor={COLORS.muted}
                style={styles.renameInput}
                autoFocus
              />
              {!!renameExtension && (
                <View style={styles.renameExtensionPill}>
                  <Text style={styles.renameExtensionText}>{renameExtension}</Text>
                </View>
              )}
            </View>

            <View style={styles.renameActions}>
              <Pressable
                style={styles.renameCancelButton}
                onPress={closeRenameModal}
                disabled={uploading}
              >
                <Text style={styles.renameCancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={styles.renameSaveButton}
                onPress={confirmRenameAndUpload}
                disabled={uploading}
              >
                <Text style={styles.renameSaveText}>
                  {uploading ? 'Saving...' : 'Save File'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={previewVisible}
        animationType="fade"
        transparent={false}
        onRequestClose={() => setPreviewVisible(false)}
      >
        <GestureHandlerRootView style={styles.previewScreen}>
          <View style={styles.previewHeader}>
            <View style={styles.previewHeaderText}>
              <Text style={styles.previewTitle} numberOfLines={1}>
                {currentPreviewDoc?.file_name || 'Photo Preview'}
              </Text>
              <Text style={styles.previewCounter}>
                {previewImages.length > 0
                  ? `${previewIndex + 1} of ${previewImages.length}`
                  : ''}
              </Text>
            </View>

            <Pressable
              style={styles.previewCloseButton}
              onPress={() => setPreviewVisible(false)}
            >
              <Text style={styles.previewCloseButtonText}>Close</Text>
            </Pressable>
          </View>

          <View style={styles.previewHintRow}>
            <Text style={styles.previewHintText}>
              Swipe left or right • Pinch to zoom • Double tap to zoom
            </Text>
          </View>

          <FlatList
            ref={previewListRef}
            data={previewImages}
            keyExtractor={(item) => item.id}
            renderItem={renderPreviewItem}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handlePreviewScrollEnd}
            getItemLayout={(_, index) => ({
              length: windowWidth,
              offset: windowWidth * index,
              index,
            })}
            initialScrollIndex={previewIndex}
          />
        </GestureHandlerRootView>
      </Modal>
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
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: COLORS.primaryText,
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginTop: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  sectionHelp: {
    fontSize: 14,
    color: COLORS.muted,
    marginBottom: SPACING.sm,
    lineHeight: 20,
  },
  uploadGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: 8,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  documentCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  thumbnail: {
    width: '100%',
    height: 180,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    resizeMode: 'cover',
  },
  fileBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.accentSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: SPACING.sm,
  },
  fileBadgeText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  documentTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  documentMeta: {
    fontSize: 14,
    color: COLORS.muted,
    marginBottom: 4,
  },
  documentActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  inlineButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingVertical: 10,
    alignItems: 'center',
  },
  inlineButtonText: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  inlineDeleteButton: {
    flex: 1,
    backgroundColor: COLORS.dangerSoft,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  inlineDeleteButtonText: {
    color: COLORS.danger,
    fontWeight: '700',
  },
  renameOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
  },
  renameCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  renameTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  renameHelp: {
    fontSize: 14,
    color: COLORS.muted,
    marginBottom: SPACING.md,
  },
  renameInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  renameInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.background,
  },
  renameExtensionPill: {
    backgroundColor: COLORS.accentSoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  renameExtensionText: {
    color: COLORS.accent,
    fontWeight: '700',
  },
  renameActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  renameCancelButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 12,
    alignItems: 'center',
  },
  renameCancelText: {
    color: COLORS.text,
    fontWeight: '700',
  },
  renameSaveButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  renameSaveText: {
    color: COLORS.primaryText,
    fontWeight: '700',
  },
  previewScreen: {
    flex: 1,
    backgroundColor: '#000',
  },
  previewHeader: {
    paddingTop: 60,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewHeaderText: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  previewTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  previewCounter: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    marginTop: 4,
  },
  previewCloseButton: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  previewCloseButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  previewHintRow: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  previewHintText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
  },
  previewSlide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewEmptyText: {
    color: '#fff',
    fontSize: 16,
  },
});