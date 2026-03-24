import { supabase } from './supabase';
import { getCurrentHouseholdId } from './household';

export async function getMergedTaskCategories(
  defaults: readonly string[]
): Promise<string[]> {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return [...defaults];

  const { data, error } = await supabase
    .from('task_categories')
    .select('name')
    .eq('household_id', householdId)
    .order('name', { ascending: true });

  if (error) {
    console.error(error.message);
    return [...defaults];
  }

  const custom = (data ?? []).map((item) => item.name);
  return Array.from(new Set([...defaults, ...custom]));
}

export async function getMergedProviderCategories(
  defaults: readonly string[]
): Promise<string[]> {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return [...defaults];

  const { data, error } = await supabase
    .from('provider_categories')
    .select('name')
    .eq('household_id', householdId)
    .order('name', { ascending: true });

  if (error) {
    console.error(error.message);
    return [...defaults];
  }

  const custom = (data ?? []).map((item) => item.name);
  return Array.from(new Set([...defaults, ...custom]));
}

export async function saveCustomTaskCategory(
  name: string,
  userId?: string | null
) {
  const trimmed = name.trim();
  if (!trimmed) return;

  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const { error } = await supabase.from('task_categories').upsert(
    {
      household_id: householdId,
      name: trimmed,
      created_by: userId ?? null,
    },
    {
      onConflict: 'household_id,name',
      ignoreDuplicates: true,
    }
  );

  if (error) {
    console.error(error.message);
  }
}

export async function saveCustomProviderCategory(
  name: string,
  userId?: string | null
) {
  const trimmed = name.trim();
  if (!trimmed) return;

  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const { error } = await supabase.from('provider_categories').upsert(
    {
      household_id: householdId,
      name: trimmed,
      created_by: userId ?? null,
    },
    {
      onConflict: 'household_id,name',
      ignoreDuplicates: true,
    }
  );

  if (error) {
    console.error(error.message);
  }
}