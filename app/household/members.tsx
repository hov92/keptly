import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import { AppScreen } from '../../components/app-screen';
import { FormScreenHeader } from '../../components/form-screen-header';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';
import { getHouseholdMembers, HouseholdMember } from '../../lib/household-members';
import { getOutgoingHouseholdInvites, HouseholdInvite } from '../../lib/household-invites';

export default function HouseholdMembersScreen() {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [invites, setInvites] = useState<HouseholdInvite[]>([]);

  async function loadData() {
    try {
      setLoading(true);

      const [membersData, invitesData] = await Promise.all([
        getHouseholdMembers(),
        getOutgoingHouseholdInvites(),
      ]);

      setMembers(membersData);
      setInvites(invitesData.filter((invite) => invite.status === 'pending'));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not load household.';
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
        title="Household members"
        subtitle="See who belongs to this household and which invites are pending."
      />

      <Text style={styles.sectionTitle}>Members</Text>

      {members.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>No members found.</Text>
        </View>
      ) : (
        members.map((member) => (
          <View key={member.id} style={styles.card}>
            <Text style={styles.cardTitle}>
              {member.profiles?.full_name || 'Unnamed member'}
            </Text>
            <Text style={styles.cardMeta}>{member.user_id}</Text>
            <Text style={styles.cardMeta}>
              Role: {member.role || 'member'}
            </Text>
          </View>
        ))
      )}

      <Text style={styles.sectionTitle}>Pending invites</Text>

      {invites.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>No pending invites.</Text>
        </View>
      ) : (
        invites.map((invite) => (
          <View key={invite.id} style={styles.card}>
            <Text style={styles.cardTitle}>{invite.invited_email}</Text>
            <Text style={styles.cardMeta}>Pending</Text>
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
});