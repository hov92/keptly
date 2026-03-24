export function toYMD(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function fromYMD(value: string) {
  return new Date(`${value}T12:00:00`);
}

export function formatDateLabel(value: string | null) {
  if (!value) return 'No date selected';

  return fromYMD(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}