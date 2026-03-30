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
  getHouseholdMembers,
  HouseholdMember,
  promoteHouseholdMemberToOwner,
  removeHouseholdMember,
  updateHouseholdMemberRole,
} from '../../lib/household-members';
import {
  getOutgoingHouseholdInvites,
  HouseholdInvite,
} from '../../lib/household-invites';
import { getActiveHouseholdPermissions } from '../../lib/permissions';
import { supabase } from '../../lib/supabase';

export default function HouseholdMembersScreen() {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [invites, setInvites] = useState<HouseholdInvite[]>([]);
  const [role, setRole] = useState<'owner' | 'member' | 'child' | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  async function loadData() {
    try {
      setLoading(true);

      const permissions = await getActiveHouseholdPermissions();
      setRole(permissions.role);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      setCurrentUserId(session?.user?.id ?? null);

      const [membersData, invitesData] = await Promise.all([
        getHouseholdMembers(),
        permissions.canInviteMembers
          ? getOutgoingHouseholdInvites()
          : Promise.resolve([]),
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

  async function handleRoleChange(
    member: HouseholdMember,
    newRole: 'member' | 'child'
  ) {
    try {
      await updateHouseholdMemberRole({
        memberId: member.id,
        role: newRole,
      });
      loadData();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not update role.';
      Alert.alert('Update failed', message);
    }
  }

  async function handlePromote(member: HouseholdMember) {
    try {
      await promoteHouseholdMemberToOwner(member.id);
      loadData();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not promote member.';
      Alert.alert('Promote failed', message);
    }
  }

  async function handleRemove(member: HouseholdMember) {
    try {
      await removeHouseholdMember(member.id);
      loadData();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not remove member.';
      Alert.alert('Remove failed', message);
    }
  }

  const canManageMembers = role === 'owner';

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <AppScreen>
      {members.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>No members found.</Text>
        </View>
      ) : (
        members.map((member) => {
          const isSelf = member.user_id === currentUserId;

          return (
            <View key={member.id} style={styles.card}>
              <Text style={styles.cardTitle}>
                {member.profiles?.full_name || 'Household member'}
              </Text>
              <Text style={styles.cardMeta}>
                Role: {member.role || 'member'}
              </Text>

              {canManageMembers && !isSelf ? (
                <View style={styles.buttonGroup}>
                  {member.role !== 'member' ? (
                    <Pressable
                      style={styles.secondaryButton}
                      onPress={() => handleRoleChange(member, 'member')}
                    >
                      <Text style={styles.secondaryButtonText}>
                        Set as member
                      </Text>
                    </Pressable>
                  ) : null}

                  {member.role !== 'child' ? (
                    <Pressable
                      style={styles.secondaryButton}
                      onPress={() => handleRoleChange(member, 'child')}
                    >
                      <Text style={styles.secondaryButtonText}>
                        Set as child
                      </Text>
                    </Pressable>
                  ) : null}

                  {member.role !== 'owner' ? (
                    <Pressable
                      style={styles.secondaryButton}
                      onPress={() => handlePromote(member)}
                    >
                      <Text style={styles.secondaryButtonText}>
                        Promote to owner
                      </Text>
                    </Pressable>
                  ) : null}

                  <Pressable
                    style={styles.deleteButton}
                    onPress={() => handleRemove(member)}
                  >
                    <Text style={styles.deleteButtonText}>Remove member</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })
      )}

      <View style={styles.sectionBlock}>
        <Text style={styles.sectionLabel}>Pending invites</Text>

        {invites.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>No pending invites.</Text>
          </View>
        ) : (
          invites.map((invite) => (
            <View key={invite.id} style={styles.card}>
              <Text style={styles.cardTitle}>{invite.invited_email}</Text>
              <Text style={styles.cardMeta}>Role: {invite.invited_role}</Text>
              <Text style={styles.cardMeta}>Status: Pending</Text>
            </View>
          ))
        )}
      </View>
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
  sectionBlock: {
    marginTop: SPACING.lg,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
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
  buttonGroup: {
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
  secondaryButton: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  deleteButton: {
    backgroundColor: COLORS.dangerSoft,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: COLORS.danger,
    fontWeight: '700',
  },
});