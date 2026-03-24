import { supabase } from './supabase';
import { getCurrentHouseholdId } from './household';

export type HouseholdInvite = {
  id: string;
  household_id: string;
  invited_email: string;
  invited_by: string | null;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  responded_at: string | null;
  households?: { name: string } | null;
};

export async function createHouseholdInvite(
  email: string,
  userId?: string | null
) {
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
      'id, household_id, invited_email, invited_by, status, created_at, responded_at'
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
      'id, household_id, invited_email, invited_by, status, created_at, responded_at, households(name)'
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
  householdId: string;
  userId: string;
}) {
  const { inviteId, householdId, userId } = params;

  const { error: memberError } = await supabase
    .from('household_members')
    .upsert(
      {
        household_id: householdId,
        user_id: userId,
        role: 'member',
      },
      {
        onConflict: 'household_id,user_id',
        ignoreDuplicates: true,
      }
    );

  if (memberError) {
    throw new Error(memberError.message);
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