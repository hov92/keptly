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
import { FormScreenHeader } from '../../components/form-screen-header';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';
import {
  getMyHouseholds,
  HouseholdOption,
  setActiveHousehold,
} from '../../lib/households';

export default function SwitchHouseholdScreen() {
  const [loading, setLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [households, setHouseholds] = useState<HouseholdOption[]>([]);

  async function loadHouseholds() {
    try {
      setLoading(true);
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
      loadHouseholds();
    }, [])
  );

  async function handleSwitch(householdId: string) {
    try {
      setSwitchingId(householdId);
      await setActiveHousehold(householdId);
      Alert.alert('Household switched', 'Your active household was updated.');
      router.replace('/');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not switch household.';
      Alert.alert('Switch failed', message);
    } finally {
      setSwitchingId(null);
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
      <FormScreenHeader
        title="Switch household"
        subtitle="Choose which household you want to view right now."
      />

      {households.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>No households found.</Text>
        </View>
      ) : (
        households.map((household) => {
          const isBusy = switchingId === household.household_id;

          return (
            <Pressable
              key={household.household_id}
              style={[
                styles.card,
                household.is_active && styles.activeCard,
              ]}
              onPress={() => handleSwitch(household.household_id)}
              disabled={isBusy || household.is_active}
            >
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>{household.name}</Text>

                {household.is_active ? (
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>Active</Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.cardMeta}>
                Type: {household.home_type || 'Not set'}
              </Text>

              <Text style={styles.cardMeta}>
                Role: {household.role || 'member'}
              </Text>

              {!household.is_active ? (
                <Text style={styles.switchText}>
                  {isBusy ? 'Switching...' : 'Tap to switch'}
                </Text>
              ) : null}
            </Pressable>
          );
        })
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
    borderColor: COLORS.border,
  },
  activeCard: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.accentSoft,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: 6,
  },
  cardTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  cardMeta: {
    fontSize: 14,
    color: COLORS.muted,
    marginBottom: 4,
  },
  switchText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  activeBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  activeBadgeText: {
    color: COLORS.primaryText,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.muted,
  },
});