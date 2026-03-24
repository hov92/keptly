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

export async function getHouseholdMembers() {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return [];

  const { data, error } = await supabase
    .from('household_members')
    .select('id, household_id, user_id, role, profiles(full_name)')
    .eq('household_id', householdId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as HouseholdMember[];
}

export async function getHouseholdMemberOptions() {
  const members = await getHouseholdMembers();

  return members.map((member) => ({
    label: member.profiles?.full_name || member.user_id,
    value: member.user_id,
  }));
}