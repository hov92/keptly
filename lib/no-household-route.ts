import { supabase } from './supabase';
import { getCurrentHouseholdId } from './household';

export async function getNoHouseholdRoute(): Promise<
  '/household/create' | '/household/invites'
> {
  const activeHouseholdId = await getCurrentHouseholdId();
  if (activeHouseholdId) {
    return '/household/create';
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    return '/household/create';
  }

  const { data, error } = await supabase
    .from('household_invites')
    .select('id')
    .ilike('invited_email', email)
    .eq('status', 'pending')
    .limit(1);

  if (error) {
    throw error;
  }

  return data && data.length > 0 ? '/household/invites' : '/household/create';
}