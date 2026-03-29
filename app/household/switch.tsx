import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { AppScreen } from '../../components/app-screen';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';
import {
  getMyHouseholds,
  HouseholdOption,
  setActiveHousehold,
} from '../../lib/households';
import { getActiveHouseholdPermissions } from '../../lib/permissions';

export default function SwitchHouseholdScreen() {
  const [loading, setLoading] = useState(true);
  const [households, setHouseholds] = useState<HouseholdOption[]>([]);

  async function loadData() {
    try {
      setLoading(true);

      const permissions = await getActiveHouseholdPermissions();
      if (!permissions.canSwitchHouseholds) {
        Alert.alert('Restricted', 'Your role cannot switch households.');
        router.replace('/profile');
        return;
      }

      const data = await getMyHouseholds();
      setHouseholds(data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not load households.';
      Alert.alert('Load failed', message);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function handleSwitch(householdId: string) {
    try {
      await setActiveHousehold(householdId);
      router.replace('/profile');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not switch household.';
      Alert.alert('Switch failed', message);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <AppScreen>
      {households.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>No households available.</Text>
        </View>
      ) : (
        households.map((household) => (
          <Pressable
            key={household.household_id}
            style={[styles.card, household.is_active && styles.cardActive]}
            onPress={() => handleSwitch(household.household_id)}
            disabled={household.is_active}
          >
            <Text style={styles.cardTitle}>{household.name}</Text>
            <Text style={styles.cardMeta}>
              {household.home_type || 'No home type'}
            </Text>
            <Text style={styles.cardMeta}>
              Role: {household.role || 'member'}
            </Text>
            {household.is_active ? (
              <Text style={styles.activeText}>Current household</Text>
            ) : (
              <Text style={styles.switchText}>Tap to switch</Text>
            )}
          </Pressable>
        ))
      )}
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
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cardActive: {
    borderColor: COLORS.primary,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  cardMeta: {
    fontSize: 14,
    color: COLORS.muted,
    marginBottom: 4,
  },
  activeText: {
    marginTop: 10,
    color: COLORS.primary,
    fontWeight: '700',
  },
  switchText: {
    marginTop: 10,
    color: COLORS.muted,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.muted,
  },
});