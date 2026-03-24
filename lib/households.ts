import { supabase } from './supabase';

export type HouseholdOption = {
  household_id: string;
  name: string;
  home_type: string | null;
  role: string | null;
  is_active: boolean;
};

export async function getMyHouseholds(): Promise<HouseholdOption[]> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) throw sessionError;

  const user = session?.user;
  if (!user) return [];

  const { data: membershipsData, error: membershipsError } = await supabase
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', user.id);

  if (membershipsError) {
    throw new Error(membershipsError.message);
  }

  const memberships =
    (membershipsData ?? []) as {
      household_id: string;
      role: string | null;
    }[];

  const householdIds = memberships.map((item) => item.household_id);

  if (householdIds.length === 0) return [];

  const { data: householdsData, error: householdsError } = await supabase
    .from('households')
    .select('id, name, home_type')
    .in('id', householdIds);

  if (householdsError) {
    throw new Error(householdsError.message);
  }

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('current_household_id')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  const activeHouseholdId = profileData?.current_household_id ?? null;

  const householdMap = new Map(
    (
      (householdsData ?? []) as {
        id: string;
        name: string;
        home_type: string | null;
      }[]
    ).map((household) => [household.id, household])
  );

  return memberships
    .map((membership) => {
      const household = householdMap.get(membership.household_id);
      if (!household) return null;

      return {
        household_id: household.id,
        name: household.name,
        home_type: household.home_type,
        role: membership.role,
        is_active: activeHouseholdId === household.id,
      };
    })
    .filter(Boolean) as HouseholdOption[];
}

export async function getActiveHousehold() {
  const households = await getMyHouseholds();
  return households.find((household) => household.is_active) ?? null;
}

export async function setActiveHousehold(householdId: string) {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) throw sessionError;

  const user = session?.user;
  if (!user) {
    throw new Error('You are not signed in.');
  }

  const { data: membershipData, error: membershipError } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .eq('household_id', householdId)
    .limit(1);

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  if (!membershipData || membershipData.length === 0) {
    throw new Error('You are not a member of that household.');
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ current_household_id: householdId })
    .eq('id', user.id);

  if (profileError) {
    throw new Error(profileError.message);
  }
}