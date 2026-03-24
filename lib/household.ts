import { supabase } from './supabase';

export async function getCurrentHouseholdId(): Promise<string | null> {
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
    .limit(1);

  if (error) throw error;

  return data?.[0]?.household_id ?? null;
}