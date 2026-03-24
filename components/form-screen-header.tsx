import { Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';

import { COLORS, SPACING } from '../constants/theme';

type FormScreenHeaderProps = {
  title: string;
  subtitle: string;
  backLabel?: string;
};

export function FormScreenHeader({
  title,
  subtitle,
  backLabel = 'Back',
}: FormScreenHeaderProps) {
  return (
    <>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>{backLabel}</Text>
      </Pressable>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </>
  );
}

const styles = StyleSheet.create({
  backButton: {
    marginBottom: SPACING.lg,
  },
  backText: {
    color: COLORS.accent,
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.muted,
    marginBottom: SPACING.xl,
  },
});