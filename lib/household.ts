import { supabase } from './supabase';

export async function getCurrentHouseholdId(): Promise<string | null> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) throw sessionError;

  const user = session?.user;
  if (!user) return null;

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('current_household_id')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) throw profileError;

  const currentHouseholdId = profileData?.current_household_id;

  if (
    currentHouseholdId &&
    currentHouseholdId !== 'null' &&
    currentHouseholdId !== 'undefined'
  ) {
    return currentHouseholdId;
  }

  const { data: memberData, error: memberError } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .limit(1);

  if (memberError) throw memberError;

  return memberData?.[0]?.household_id ?? null;
}