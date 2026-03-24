import { ReactNode } from 'react';
import { ScrollView, StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS, SPACING } from '../constants/theme';

type AppScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  contentContainerStyle?: ViewStyle;
};

export function AppScreen({
  children,
  scroll = true,
  contentContainerStyle,
}: AppScreenProps) {
  if (!scroll) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          scrollEnabled={false}
          contentContainerStyle={[styles.container, contentContainerStyle]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[styles.container, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    padding: SPACING.xl,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.xxl,
  },
});