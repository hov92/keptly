import { supabase } from './supabase';
import { getCurrentHouseholdId } from './household';

export type HouseholdInvite = {
  id: string;
  household_id: string;
  invited_email: string;
  invited_by: string | null;
  invited_role: 'owner' | 'member' | 'child';
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  responded_at: string | null;
  households?: { name: string } | null;
};

export async function createHouseholdInvite(params: {
  email: string;
  role: 'owner' | 'member' | 'child';
  userId?: string | null;
}) {
  const { email, role, userId } = params;

  const householdId = await getCurrentHouseholdId();
  if (!householdId) {
    throw new Error('No household found.');
  }

  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    throw new Error('Email is required.');
  }

  const { error } = await supabase.from('household_invites').insert({
    household_id: householdId,
    invited_email: normalized,
    invited_role: role,
    invited_by: userId ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function getOutgoingHouseholdInvites() {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return [];

  const { data, error } = await supabase
    .from('household_invites')
    .select(
      'id, household_id, invited_email, invited_by, invited_role, status, created_at, responded_at'
    )
    .eq('household_id', householdId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as HouseholdInvite[];
}

export async function getIncomingHouseholdInvites(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return [];

  const { data, error } = await supabase
    .from('household_invites')
    .select(
      'id, household_id, invited_email, invited_by, invited_role, status, created_at, responded_at, households(name)'
    )
    .ilike('invited_email', normalized)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as HouseholdInvite[];
}

export async function cancelHouseholdInvite(inviteId: string) {
  const { error } = await supabase
    .from('household_invites')
    .delete()
    .eq('id', inviteId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function declineHouseholdInvite(inviteId: string) {
  const { error } = await supabase
    .from('household_invites')
    .update({
      status: 'declined',
      responded_at: new Date().toISOString(),
    })
    .eq('id', inviteId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function acceptHouseholdInvite(params: {
  inviteId: string;
  userId: string;
}) {
  const { inviteId, userId } = params;

  const { data: inviteData, error: inviteLoadError } = await supabase
    .from('household_invites')
    .select('household_id, invited_role')
    .eq('id', inviteId)
    .single();

  if (inviteLoadError) {
    throw new Error(inviteLoadError.message);
  }

  const householdId = inviteData.household_id as string;
  const invitedRole =
    (inviteData.invited_role as 'owner' | 'member' | 'child') ?? 'member';

  const { error: memberError } = await supabase
    .from('household_members')
    .upsert(
      {
        household_id: householdId,
        user_id: userId,
        role: invitedRole,
      },
      {
        onConflict: 'household_id,user_id',
      }
    );

  if (memberError) {
    throw new Error(memberError.message);
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      current_household_id: householdId,
    })
    .eq('id', userId);

  if (profileError) {
    throw new Error(profileError.message);
  }

  const { error: inviteError } = await supabase
    .from('household_invites')
    .update({
      status: 'accepted',
      responded_at: new Date().toISOString(),
    })
    .eq('id', inviteId);

  if (inviteError) {
    throw new Error(inviteError.message);
  }
}