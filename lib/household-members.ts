import { supabase } from './supabase';
import { getCurrentHouseholdId } from './household';

export type HouseholdMember = {
  id: string;
  household_id: string;
  user_id: string;
  role?: string | null;
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
    .eq('household_id', householdId);

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