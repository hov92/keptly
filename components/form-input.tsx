import { TextInput, TextInputProps, StyleSheet } from 'react-native';

import { COLORS, RADIUS, SPACING } from '../constants/theme';

type FormInputProps = TextInputProps;

export function FormInput(props: FormInputProps) {
  return (
    <TextInput
      placeholderTextColor={COLORS.placeholder}
      style={[styles.input, props.multiline && styles.multiline, props.style]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  multiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
});