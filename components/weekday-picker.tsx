import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS, RADIUS, SPACING } from '../constants/theme';

export type WeekdayCode = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

const DAYS: { code: WeekdayCode; label: string }[] = [
  { code: 'sun', label: 'Sun' },
  { code: 'mon', label: 'Mon' },
  { code: 'tue', label: 'Tue' },
  { code: 'wed', label: 'Wed' },
  { code: 'thu', label: 'Thu' },
  { code: 'fri', label: 'Fri' },
  { code: 'sat', label: 'Sat' },
];

type Props = {
  label?: string;
  value: WeekdayCode[];
  onChange: (value: WeekdayCode[]) => void;
};

export function WeekdayPicker({
  label = 'Repeat on',
  value,
  onChange,
}: Props) {
  function toggleDay(code: WeekdayCode) {
    if (value.includes(code)) {
      onChange(value.filter((item) => item !== code));
      return;
    }

    onChange([...value, code]);
  }

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.row}>
        {DAYS.map((day) => {
          const selected = value.includes(day.code);

          return (
            <Pressable
              key={day.code}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => toggleDay(day.code)}
            >
              <Text
                style={[styles.chipText, selected && styles.chipTextSelected]}
              >
                {day.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  chip: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 14,
  },
  chipTextSelected: {
    color: COLORS.primaryText,
  },
});