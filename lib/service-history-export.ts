import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

type ExportRecord = {
  title: string;
  service_date: string | null;
  amount: number | null;
  notes: string | null;
  documentCount: number;
};

function escapeCsv(value: string | number | null | undefined) {
  const text = value == null ? '' : String(value);
  const escaped = text.replace(/"/g, '""');
  return `"${escaped}"`;
}

export async function exportServiceHistoryCsv(params: {
  providerName: string;
  records: ExportRecord[];
}) {
  const { providerName, records } = params;

  const header = [
    'Provider',
    'Service Title',
    'Service Date',
    'Amount',
    'Document Count',
    'Document Status',
    'Notes',
  ];

  const rows = records.map((record) => {
    const documentStatus =
      record.documentCount > 0 ? 'Docs attached' : 'Missing receipt';

    return [
      providerName,
      record.title,
      record.service_date ?? '',
      record.amount != null ? record.amount.toFixed(2) : '',
      record.documentCount,
      documentStatus,
      record.notes ?? '',
    ];
  });

  const csv = [header, ...rows]
    .map((row) => row.map(escapeCsv).join(','))
    .join('\n');

  const safeProviderName = providerName.replace(/[^\w\-]+/g, '_');
  const file = new File(
    Paths.cache,
    `${safeProviderName}_service_history_${Date.now()}.csv`
  );

  file.write(csv);

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    return file.uri;
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    dialogTitle: 'Share service history',
    UTI: 'public.comma-separated-values-text',
  });

  return file.uri;
}