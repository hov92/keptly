import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

type ExportRow = {
  providerName: string;
  serviceTitle: string;
  serviceDate: string | null;
  amount: number | null;
  documentCount: number;
  notes: string | null;
};

function escapeCsv(value: string | number | null | undefined) {
  const text = value == null ? '' : String(value);
  const escaped = text.replace(/"/g, '""');
  return `"${escaped}"`;
}

export async function exportAllServiceHistoryCsv(params: {
  householdName?: string | null;
  rows: ExportRow[];
}) {
  const { householdName, rows } = params;

  const header = [
    'Household',
    'Provider',
    'Service Title',
    'Service Date',
    'Amount',
    'Document Count',
    'Document Status',
    'Notes',
  ];

  const csvRows = rows.map((row) => {
    const documentStatus =
      row.documentCount > 0 ? 'Docs attached' : 'Missing receipt';

    return [
      householdName ?? '',
      row.providerName,
      row.serviceTitle,
      row.serviceDate ?? '',
      row.amount != null ? row.amount.toFixed(2) : '',
      row.documentCount,
      documentStatus,
      row.notes ?? '',
    ];
  });

  const csv = [header, ...csvRows]
    .map((row) => row.map(escapeCsv).join(','))
    .join('\n');

  const safeName = (householdName || 'household')
    .replace(/[^\w\-]+/g, '_')
    .toLowerCase();

  const file = new File(
    Paths.cache,
    `${safeName}_service_history_${Date.now()}.csv`
  );

  file.write(csv);

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    return file.uri;
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    dialogTitle: 'Export all service history',
    UTI: 'public.comma-separated-values-text',
  });

  return file.uri;
}