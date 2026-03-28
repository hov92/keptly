import { supabase } from './supabase';
import { getCurrentHouseholdId } from './household';
import { logHouseholdActivity } from './household-activity';

export type HouseholdMember = {
  id: string;
  household_id: string;
  user_id: string;
  role?: 'owner' | 'member' | 'child' | null;
  profiles?: {
    full_name: string | null;
  } | null;
};

type SharedMemberName = {
  id: string;
  full_name: string | null;
};

export async function getHouseholdMembers() {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return [];

  const { data: membersData, error: membersError } = await supabase
    .from('household_members')
    .select('id, household_id, user_id, role')
    .eq('household_id', householdId)
    .order('created_at', { ascending: true });

  if (membersError) {
    throw new Error(membersError.message);
  }

  const members = (membersData ?? []) as Omit<HouseholdMember, 'profiles'>[];

  const { data: namesData, error: namesError } = await supabase.rpc(
    'get_shared_household_member_names'
  );

  if (namesError) {
    throw new Error(namesError.message);
  }

  const nameMap = new Map(
    ((namesData ?? []) as SharedMemberName[]).map((row) => [
      row.id,
      row.full_name,
    ])
  );

  return members.map((member) => ({
    ...member,
    profiles: {
      full_name: nameMap.get(member.user_id) ?? null,
    },
  })) as HouseholdMember[];
}

export async function getHouseholdMemberOptions() {
  const members = await getHouseholdMembers();

  return members.map((member) => ({
    label: member.profiles?.full_name || 'Household member',
    value: member.user_id,
  }));
}

export async function updateHouseholdMemberRole(params: {
  memberId: string;
  role: 'member' | 'child';
}) {
  const { memberId, role } = params;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { data: memberData, error: memberLoadError } = await supabase
    .from('household_members')
    .select('household_id, user_id')
    .eq('id', memberId)
    .single();

  if (memberLoadError) {
    throw new Error(memberLoadError.message);
  }

  const { error } = await supabase
    .from('household_members')
    .update({ role })
    .eq('id', memberId);

  if (error) {
    throw new Error(error.message);
  }

  await logHouseholdActivity({
    householdId: memberData.household_id,
    actorUserId: session?.user?.id ?? null,
    targetUserId: memberData.user_id,
    action: 'member_role_changed',
    details: { role },
  });
}

export async function removeHouseholdMember(memberId: string) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { data: memberData, error: memberLoadError } = await supabase
    .from('household_members')
    .select('household_id, user_id, role')
    .eq('id', memberId)
    .single();

  if (memberLoadError) {
    throw new Error(memberLoadError.message);
  }

  const { error } = await supabase
    .from('household_members')
    .delete()
    .eq('id', memberId);

  if (error) {
    throw new Error(error.message);
  }

  await logHouseholdActivity({
    householdId: memberData.household_id,
    actorUserId: session?.user?.id ?? null,
    targetUserId: memberData.user_id,
    action: 'member_removed',
    details: { previous_role: memberData.role },
  });
}

export async function promoteHouseholdMemberToOwner(memberId: string) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { data: memberData, error: memberLoadError } = await supabase
    .from('household_members')
    .select('household_id, user_id')
    .eq('id', memberId)
    .single();

  if (memberLoadError) {
    throw new Error(memberLoadError.message);
  }

  const { error } = await supabase
    .from('household_members')
    .update({ role: 'owner' })
    .eq('id', memberId);

  if (error) {
    throw new Error(error.message);
  }

  await logHouseholdActivity({
    householdId: memberData.household_id,
    actorUserId: session?.user?.id ?? null,
    targetUserId: memberData.user_id,
    action: 'member_promoted_to_owner',
    details: null,
  });
}