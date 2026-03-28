import { supabase } from './supabase';
import { getCurrentHouseholdId } from './household';

export type HouseholdActivityItem = {
  id: string;
  household_id: string;
  actor_user_id: string | null;
  target_user_id: string | null;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
};

type SharedMemberName = {
  id: string;
  full_name: string | null;
};

export async function logHouseholdActivity(params: {
  householdId?: string;
  actorUserId?: string | null;
  targetUserId?: string | null;
  action: string;
  details?: Record<string, unknown> | null;
}) {
  const householdId = params.householdId ?? (await getCurrentHouseholdId());

  if (!householdId) {
    throw new Error('No household found.');
  }

  const { error } = await supabase.from('household_activity').insert({
    household_id: householdId,
    actor_user_id: params.actorUserId ?? null,
    target_user_id: params.targetUserId ?? null,
    action: params.action,
    details: params.details ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function getHouseholdActivity() {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return [];

  const { data, error } = await supabase
    .from('household_activity')
    .select('id, household_id, actor_user_id, target_user_id, action, details, created_at')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as HouseholdActivityItem[];

  const uniqueUserIds = Array.from(
    new Set(
      rows.flatMap((row) => [row.actor_user_id, row.target_user_id]).filter(Boolean)
    )
  ) as string[];

  const { data: namesData, error: namesError } = await supabase.rpc(
    'get_shared_household_member_names'
  );

  if (namesError) {
    throw new Error(namesError.message);
  }

  const nameMap = new Map(
    ((namesData ?? []) as SharedMemberName[]).map((row) => [row.id, row.full_name])
  );

  return rows.map((row) => ({
    ...row,
    actor_name: row.actor_user_id ? nameMap.get(row.actor_user_id) ?? 'Household member' : 'System',
    target_name: row.target_user_id ? nameMap.get(row.target_user_id) ?? 'Household member' : null,
  }));
}