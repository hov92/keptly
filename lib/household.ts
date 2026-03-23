import { supabase } from './supabase';

export async function getCurrentHouseholdId() {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) throw sessionError;

  const user = session?.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;

  return data?.household_id ?? null;
}