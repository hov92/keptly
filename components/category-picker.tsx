import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type CategoryPickerProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
};

export function CategoryPicker({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select a category',
}: CategoryPickerProps) {
  const [open, setOpen] = useState(false);

  const selectedLabel = useMemo(() => {
    return value || placeholder;
  }, [value, placeholder]);

  function handleSelect(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>

      <Pressable style={styles.field} onPress={() => setOpen(true)}>
        <Text style={[styles.fieldText, !value && styles.placeholderText]}>
          {selectedLabel}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label}</Text>

              <Pressable onPress={() => setOpen(false)}>
                <Text style={styles.doneText}>Done</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Pressable
                style={styles.option}
                onPress={() => handleSelect('')}
              >
                <Text style={[styles.optionText, styles.placeholderText]}>
                  {placeholder}
                </Text>
              </Pressable>

              {options.map((option) => {
                const selected = value === option;

                return (
                  <Pressable
                    key={option}
                    style={[styles.option, selected && styles.optionSelected]}
                    onPress={() => handleSelect(option)}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        selected && styles.optionTextSelected,
                      ]}
                    >
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 12,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F1F1F',
    marginBottom: 10,
  },
  field: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6E0D8',
    minHeight: 56,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldText: {
    flex: 1,
    fontSize: 16,
    color: '#1F1F1F',
  },
  placeholderText: {
    color: '#6B7280',
  },
  chevron: {
    fontSize: 18,
    color: '#1F1F1F',
    marginLeft: 12,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.28)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#F8F6F2',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 28,
    maxHeight: '70%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  doneText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2A9D8F',
  },
  option: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6E0D8',
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
  },
  optionSelected: {
    borderColor: '#264653',
    backgroundColor: '#EAF3F5',
  },
  optionText: {
    fontSize: 16,
    color: '#1F1F1F',
  },
  optionTextSelected: {
    color: '#264653',
    fontWeight: '700',
  },
});