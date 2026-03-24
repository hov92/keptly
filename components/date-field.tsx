import { useMemo, useState } from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';

import { formatDateLabel, fromYMD, toYMD } from '../lib/date';
import { COLORS, RADIUS, SPACING } from '../constants/theme';

type DateFieldProps = {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  clearLabel?: string;
};

export function DateField({
  label,
  value,
  onChange,
  clearLabel = 'Clear date',
}: DateFieldProps) {
  const [showPicker, setShowPicker] = useState(false);

  const pickerValue = useMemo(() => {
    return value ? fromYMD(value) : new Date();
  }, [value]);

  function openDatePicker() {
    Keyboard.dismiss();
    setShowPicker(true);
  }

  function handleChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }

    if (event.type === 'dismissed') {
      return;
    }

    if (selectedDate) {
      onChange(toYMD(selectedDate));
    }
  }

  return (
    <>
      <Text style={styles.label}>{label}</Text>

      <Pressable style={styles.dateButton} onPress={openDatePicker}>
        <Text style={styles.dateButtonText}>{formatDateLabel(value)}</Text>
      </Pressable>

      {value ? (
        <Pressable onPress={() => onChange(null)} style={styles.clearLink}>
          <Text style={styles.clearLinkText}>{clearLabel}</Text>
        </Pressable>
      ) : null}

      {showPicker ? (
        <ScrollView
          horizontal={false}
          scrollEnabled={false}
          contentContainerStyle={styles.pickerOuter}
        >
          <Pressable style={styles.pickerWrap}>
            <DateTimePicker
              value={pickerValue}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={handleChange}
              themeVariant="light"
              accentColor={COLORS.primary}
              textColor={COLORS.text}
            />
          </Pressable>
        </ScrollView>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 10,
  },
  dateButton: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dateButtonText: {
    color: COLORS.text,
    fontSize: 16,
  },
  clearLink: {
    marginBottom: SPACING.sm,
  },
  clearLinkText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  pickerOuter: {
    marginBottom: SPACING.sm,
  },
  pickerWrap: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
});