import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import { AppScreen } from '../../components/app-screen';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';
import {
  cancelHouseholdInvite,
  declineHouseholdInvite,
  getIncomingHouseholdInvites,
  getOutgoingHouseholdInvites,
  HouseholdInvite,
} from '../../lib/household-invites';
import { supabase } from '../../lib/supabase';
import { acceptHouseholdInvite } from '../../lib/household-invites';
import { getActiveHouseholdPermissions } from '../../lib/permissions';

export default function HouseholdInvitesScreen() {
  const [loading, setLoading] = useState(true);
  const [incoming, setIncoming] = useState<HouseholdInvite[]>([]);
  const [outgoing, setOutgoing] = useState<HouseholdInvite[]>([]);
  const [canManageOutgoing, setCanManageOutgoing] = useState(false);

  async function loadData() {
    try {
      setLoading(true);

      const permissions = await getActiveHouseholdPermissions();
      setCanManageOutgoing(permissions.canInviteMembers);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const email = session?.user?.email ?? '';

      const [incomingData, outgoingData] = await Promise.all([
        getIncomingHouseholdInvites(email),
        permissions.canInviteMembers ? getOutgoingHouseholdInvites() : Promise.resolve([]),
      ]);

      setIncoming(incomingData);
      setOutgoing(outgoingData);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not load invites.';
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

  async function handleAccept(inviteId: string) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const userId = session?.user?.id;
    if (!userId) {
      Alert.alert('Auth error', 'You are not signed in.');
      return;
    }

    try {
      await acceptHouseholdInvite({ inviteId, userId });
      loadData();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not accept invite.';
      Alert.alert('Accept failed', message);
    }
  }

  async function handleDecline(inviteId: string) {
    try {
      await declineHouseholdInvite(inviteId);
      loadData();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not decline invite.';
      Alert.alert('Decline failed', message);
    }
  }

  async function handleCancel(inviteId: string) {
    try {
      await cancelHouseholdInvite(inviteId);
      loadData();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not cancel invite.';
      Alert.alert('Cancel failed', message);
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
      <Text style={styles.sectionTitle}>Incoming invites</Text>

      {incoming.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>No incoming invites.</Text>
        </View>
      ) : (
        incoming.map((invite) => (
          <View key={invite.id} style={styles.card}>
            <Text style={styles.cardTitle}>
              {invite.households?.[0]?.name ?? 'Household invite'}
            </Text>
            <Text style={styles.cardMeta}>Role: {invite.invited_role}</Text>
            <Text style={styles.cardMeta}>Email: {invite.invited_email}</Text>

            <View style={styles.actionRow}>
              <Pressable
                style={styles.primaryButton}
                onPress={() => handleAccept(invite.id)}
              >
                <Text style={styles.primaryButtonText}>Accept</Text>
              </Pressable>

              <Pressable
                style={styles.secondaryButton}
                onPress={() => handleDecline(invite.id)}
              >
                <Text style={styles.secondaryButtonText}>Decline</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}

      {canManageOutgoing ? (
        <>
          <Text style={styles.sectionTitle}>Outgoing invites</Text>

          {outgoing.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.emptyText}>No outgoing invites.</Text>
            </View>
          ) : (
            outgoing.map((invite) => (
              <View key={invite.id} style={styles.card}>
                <Text style={styles.cardTitle}>{invite.invited_email}</Text>
                <Text style={styles.cardMeta}>Role: {invite.invited_role}</Text>
                <Text style={styles.cardMeta}>Status: {invite.status}</Text>

                {invite.status === 'pending' ? (
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => handleCancel(invite.id)}
                  >
                    <Text style={styles.secondaryButtonText}>Cancel Invite</Text>
                  </Pressable>
                ) : null}
              </View>
            ))
          )}
        </>
      ) : null}
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  cardMeta: {
    fontSize: 14,
    color: COLORS.muted,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.muted,
  },
  actionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: COLORS.primaryText,
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontWeight: '700',
  },
});