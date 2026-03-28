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
import { FormScreenHeader } from '../../components/form-screen-header';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';
import {
  getHouseholdMembers,
  HouseholdMember,
  removeHouseholdMember,
  updateHouseholdMemberRole,
  promoteHouseholdMemberToOwner,
} from '../../lib/household-members';
import {
  getOutgoingHouseholdInvites,
  HouseholdInvite,
} from '../../lib/household-invites';
import { getActiveHouseholdPermissions } from '../../lib/permissions';
import { supabase } from '../../lib/supabase';

type HouseholdRole = 'owner' | 'member' | 'child' | null;

export default function HouseholdMembersScreen() {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [invites, setInvites] = useState<HouseholdInvite[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<HouseholdRole>(null);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);

  async function loadData() {
    try {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      setCurrentUserId(session?.user?.id ?? null);

      const permissions = await getActiveHouseholdPermissions();
      setCurrentRole(permissions.role);

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

  function canManageMember(member: HouseholdMember) {
    if (currentRole !== 'owner') return false;
    if (member.user_id === currentUserId) return false;
    if (member.role === 'owner') return false;
    return true;
  }

  function getRoleBadgeStyle(role: HouseholdRole) {
    if (role === 'owner') return styles.roleBadgeOwner;
    if (role === 'child') return styles.roleBadgeChild;
    return styles.roleBadgeMember;
  }

  function getRoleTextStyle(role: HouseholdRole) {
    if (role === 'owner') return styles.roleTextOwner;
    if (role === 'child') return styles.roleTextChild;
    return styles.roleTextMember;
  }

  function handleChangeRole(member: HouseholdMember) {
    if (!canManageMember(member)) return;

    Alert.alert(
      'Change role',
      `Update ${member.profiles?.full_name || 'this member'}'s role.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Set as Member',
          onPress: async () => {
            try {
              setBusyMemberId(member.id);
              await updateHouseholdMemberRole({
                memberId: member.id,
                role: 'member',
              });
              await loadData();
            } catch (error) {
              const message =
                error instanceof Error ? error.message : 'Could not update role.';
              Alert.alert('Update failed', message);
            } finally {
              setBusyMemberId(null);
            }
          },
        },
        {
          text: 'Set as Child',
          onPress: async () => {
            try {
              setBusyMemberId(member.id);
              await updateHouseholdMemberRole({
                memberId: member.id,
                role: 'child',
              });
              await loadData();
            } catch (error) {
              const message =
                error instanceof Error ? error.message : 'Could not update role.';
              Alert.alert('Update failed', message);
            } finally {
              setBusyMemberId(null);
            }
          },
        },
      ]
    );
  }

  function handlePromoteToOwner(member: HouseholdMember) {
    if (!canManageMember(member)) return;

    if (member.role !== 'member') {
      Alert.alert('Not allowed', 'Only a member can be promoted to owner.');
      return;
    }

    Alert.alert(
      'Promote to owner?',
      `${member.profiles?.full_name || 'This member'} will become an owner and gain full household access.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Promote',
          onPress: async () => {
            try {
              setBusyMemberId(member.id);
              await promoteHouseholdMemberToOwner(member.id);
              await loadData();
            } catch (error) {
              const message =
                error instanceof Error ? error.message : 'Could not promote member.';
              Alert.alert('Promotion failed', message);
            } finally {
              setBusyMemberId(null);
            }
          },
        },
      ]
    );
  }

  function handleRemove(member: HouseholdMember) {
    if (!canManageMember(member)) return;

    Alert.alert(
      'Remove member?',
      `Remove ${member.profiles?.full_name || 'this member'} from the household?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setBusyMemberId(member.id);
              await removeHouseholdMember(member.id);
              await loadData();
            } catch (error) {
              const message =
                error instanceof Error ? error.message : 'Could not remove member.';
              Alert.alert('Remove failed', message);
            } finally {
              setBusyMemberId(null);
            }
          },
        },
      ]
    );
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
        title="Household members"
        subtitle="See who belongs to this household and which invites are pending."
      />

      <Text style={styles.sectionTitle}>Members</Text>

      {members.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>No members found.</Text>
        </View>
      ) : (
        members.map((member) => {
          const isBusy = busyMemberId === member.id;
          const canManage = canManageMember(member);

          return (
            <View key={member.id} style={styles.card}>
              <View style={styles.topRow}>
                <Text style={styles.cardTitle}>
                  {member.profiles?.full_name || 'Household member'}
                </Text>

                <View
                  style={[
                    styles.roleBadge,
                    getRoleBadgeStyle(member.role ?? 'member'),
                  ]}
                >
                  <Text
                    style={[
                      styles.roleBadgeText,
                      getRoleTextStyle(member.role ?? 'member'),
                    ]}
                  >
                    {member.role || 'member'}
                  </Text>
                </View>
              </View>

              {canManage ? (
                <View style={styles.actionsCol}>
                  <View style={styles.actionsRow}>
                    <Pressable
                      style={[
                        styles.secondaryButton,
                        isBusy && styles.buttonDisabled,
                      ]}
                      onPress={() => handleChangeRole(member)}
                      disabled={isBusy}
                    >
                      <Text style={styles.secondaryButtonText}>
                        {isBusy ? 'Saving...' : 'Change role'}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.dangerButton,
                        isBusy && styles.buttonDisabled,
                      ]}
                      onPress={() => handleRemove(member)}
                      disabled={isBusy}
                    >
                      <Text style={styles.dangerButtonText}>Remove</Text>
                    </Pressable>
                  </View>

                  {member.role === 'member' ? (
                    <Pressable
                      style={[
                        styles.promoteButton,
                        isBusy && styles.buttonDisabled,
                      ]}
                      onPress={() => handlePromoteToOwner(member)}
                      disabled={isBusy}
                    >
                      <Text style={styles.promoteButtonText}>
                        Promote to owner
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })
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
            <Text style={styles.cardMeta}>Role: {invite.invited_role}</Text>
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
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
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
  roleBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  roleBadgeOwner: {
    backgroundColor: '#E8F5F3',
  },
  roleBadgeMember: {
    backgroundColor: '#EEF2F6',
  },
  roleBadgeChild: {
    backgroundColor: '#FEE4E2',
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  roleTextOwner: {
    color: '#2A9D8F',
  },
  roleTextMember: {
    color: COLORS.text,
  },
  roleTextChild: {
    color: '#B42318',
  },
  actionsCol: {
    marginTop: 8,
    gap: SPACING.sm,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  dangerButton: {
    flex: 1,
    backgroundColor: '#FEE4E2',
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dangerButtonText: {
    color: '#B42318',
    fontWeight: '700',
  },
  promoteButton: {
    backgroundColor: '#E8F5F3',
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  promoteButtonText: {
    color: '#2A9D8F',
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});