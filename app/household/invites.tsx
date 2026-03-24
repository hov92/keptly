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
import { supabase } from '../../lib/supabase';
import {
  HouseholdInvite,
  acceptHouseholdInvite,
  cancelHouseholdInvite,
  declineHouseholdInvite,
  getIncomingHouseholdInvites,
  getOutgoingHouseholdInvites,
} from '../../lib/household-invites';

export default function HouseholdInvitesScreen() {
  const [loading, setLoading] = useState(true);
  const [incoming, setIncoming] = useState<HouseholdInvite[]>([]);
  const [outgoing, setOutgoing] = useState<HouseholdInvite[]>([]);

  async function loadInvites() {
    try {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const email = session?.user?.email ?? '';

      const [incomingData, outgoingData] = await Promise.all([
        getIncomingHouseholdInvites(email),
        getOutgoingHouseholdInvites(),
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
      loadInvites();
    }, [])
  );

  async function handleAccept(invite: HouseholdInvite) {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const userId = session?.user?.id;
      if (!userId) {
        Alert.alert('Auth error', 'You are not signed in.');
        return;
      }

      await acceptHouseholdInvite({
        inviteId: invite.id,
        userId,
      });

      await loadInvites();
      Alert.alert('Invite accepted', 'You joined the household.');
      router.replace('/');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not accept invite.';
      Alert.alert('Accept failed', message);
    }
  }

  async function handleDecline(inviteId: string) {
    try {
      await declineHouseholdInvite(inviteId);
      await loadInvites();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not decline invite.';
      Alert.alert('Decline failed', message);
    }
  }

  async function handleCancel(inviteId: string) {
    try {
      await cancelHouseholdInvite(inviteId);
      await loadInvites();
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
      <FormScreenHeader
        title="Household invites"
        subtitle="Manage outgoing invites and respond to incoming ones."
      />

      <Pressable
        style={styles.topButton}
        onPress={() => router.push('/household/invite')}
      >
        <Text style={styles.topButtonText}>Invite Member</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Incoming invites</Text>

      {incoming.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No incoming invites.</Text>
        </View>
      ) : (
        incoming.map((invite) => (
          <View key={invite.id} style={styles.card}>
            <Text style={styles.cardTitle}>
              {invite.households?.name ?? 'Household invite'}
            </Text>
            <Text style={styles.cardMeta}>{invite.invited_email}</Text>
            <Text style={styles.cardMeta}>Role: {invite.invited_role}</Text>

            <View style={styles.row}>
              <Pressable
                style={[styles.actionButton, styles.acceptButton]}
                onPress={() => handleAccept(invite)}
              >
                <Text style={styles.acceptButtonText}>Accept</Text>
              </Pressable>

              <Pressable
                style={[styles.actionButton, styles.declineButton]}
                onPress={() => handleDecline(invite.id)}
              >
                <Text style={styles.declineButtonText}>Decline</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}

      <Text style={styles.sectionTitle}>Outgoing invites</Text>

      {outgoing.length === 0 ? (
        <View style={styles.emptyCard}>
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
                style={[styles.actionButton, styles.cancelButton]}
                onPress={() => handleCancel(invite.id)}
              >
                <Text style={styles.cancelButtonText}>Cancel Invite</Text>
              </Pressable>
            ) : null}
          </View>
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
  topButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  topButtonText: {
    color: COLORS.primaryText,
    fontSize: 16,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
  },
  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  emptyText: {
    color: COLORS.muted,
    fontSize: 15,
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
  row: {
    flexDirection: 'row',
    gap: SPACING.sm,
    flexWrap: 'wrap',
    marginTop: 8,
  },
  actionButton: {
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  acceptButton: {
    backgroundColor: COLORS.accentSoft,
  },
  acceptButtonText: {
    color: COLORS.accent,
    fontWeight: '700',
  },
  declineButton: {
    backgroundColor: COLORS.dangerSoft,
  },
  declineButtonText: {
    color: COLORS.danger,
    fontWeight: '700',
  },
  cancelButton: {
    backgroundColor: COLORS.dangerSoft,
    alignSelf: 'flex-start',
  },
  cancelButtonText: {
    color: COLORS.danger,
    fontWeight: '700',
  },
});