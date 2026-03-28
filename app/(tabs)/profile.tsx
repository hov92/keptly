import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { AppScreen } from '../../components/app-screen';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { getMyHouseholds, HouseholdOption } from '../../lib/households';
import { getActiveHouseholdPermissions } from '../../lib/permissions';

type PermissionsState = {
  role: 'owner' | 'member' | 'child' | null;
  canInviteMembers: boolean;
  canSwitchHouseholds: boolean;
  canManageProviders: boolean;
  canManageServiceRecords: boolean;
};

export default function ProfileScreen() {
  const [households, setHouseholds] = useState<HouseholdOption[]>([]);
  const [permissions, setPermissions] = useState<PermissionsState>({
    role: null,
    canInviteMembers: false,
    canSwitchHouseholds: false,
    canManageProviders: false,
    canManageServiceRecords: false,
  });

  useFocusEffect(
    useCallback(() => {
      getMyHouseholds().then(setHouseholds).catch(console.error);
      getActiveHouseholdPermissions().then(setPermissions).catch(console.error);
    }, [])
  );

  const activeHousehold =
    households.find((household) => household.is_active) ?? null;

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      Alert.alert('Logout failed', error.message);
      return;
    }

    router.replace('/login');
  }

  return (
    <AppScreen>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>Manage your household and account.</Text>

      <Pressable style={styles.cardButton}>
        <Text style={styles.cardTitle}>Current household</Text>
        <Text style={styles.cardText}>
          {activeHousehold
            ? `${activeHousehold.name}${activeHousehold.home_type ? ` • ${activeHousehold.home_type}` : ''}`
            : 'No active household selected'}
        </Text>
        <Text style={styles.roleText}>Role: {permissions.role ?? 'unknown'}</Text>
      </Pressable>

      {permissions.canSwitchHouseholds ? (
        <Pressable
          style={styles.cardButton}
          onPress={() => router.push('/household/switch' as any)}
        >
          <Text style={styles.cardTitle}>Switch household</Text>
          <Text style={styles.cardText}>
            Choose which household you want to view.
          </Text>
        </Pressable>
      ) : null}

      <Pressable
        style={styles.cardButton}
        onPress={() => router.push('/household/members')}
      >
        <Text style={styles.cardTitle}>Household members</Text>
        <Text style={styles.cardText}>
          View members and pending invites for this household.
        </Text>
      </Pressable>

      {permissions.canInviteMembers ? (
        <>
          <Pressable
            style={styles.cardButton}
            onPress={() => router.push('/household/invites')}
          >
            <Text style={styles.cardTitle}>Household invites</Text>
            <Text style={styles.cardText}>
              View incoming invites and manage outgoing ones.
            </Text>
          </Pressable>

          <Pressable
            style={styles.cardButton}
            onPress={() => router.push('/household/invite')}
          >
            <Text style={styles.cardTitle}>Invite a member</Text>
            <Text style={styles.cardText}>
              Invite someone by email to share the household.
            </Text>
          </Pressable>
        </>
      ) : null}

      <Pressable style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Log out</Text>
      </Pressable>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.muted,
    marginBottom: SPACING.lg,
  },
  cardButton: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  cardText: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  roleText: {
    marginTop: 8,
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  logoutButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  logoutButtonText: {
    color: COLORS.primaryText,
    fontSize: 16,
    fontWeight: '600',
  },
});