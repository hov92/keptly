import { supabase } from './supabase';

export type ShoppingRepeatRule = 'weekly' | 'biweekly' | 'monthly';

export type ShoppingRecurringTemplateRow = {
  id: string;
  household_id: string;
  list_id: string | null;
  source_item_id: string | null;
  title: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  notes: string | null;
  is_favorite: boolean;
  is_active: boolean;
  repeat_rule: ShoppingRepeatRule | null;
  last_generated_at: string | null;
  last_completed_at: string | null;
};

export type ShoppingItemRecurringInput = {
  householdId: string;
  listId: string;
  itemId?: string | null;
  title: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  notes: string | null;
  isFavorite: boolean;
  repeatRule: ShoppingRepeatRule | null;
  createdBy: string | null;
};

function normalizeItemKey(params: {
  title: string;
  unit: string | null;
  category: string | null;
}) {
  return [
    params.title.trim().toLowerCase(),
    params.unit?.trim().toLowerCase() || '',
    params.category?.trim().toLowerCase() || '',
  ].join('::');
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function getNextRecurringDueDate(
  lastCompletedAt: string | null,
  repeatRule: ShoppingRepeatRule | null
) {
  if (!lastCompletedAt || !repeatRule) return null;

  const base = new Date(lastCompletedAt);

  if (repeatRule === 'weekly') return addDays(base, 7);
  if (repeatRule === 'biweekly') return addDays(base, 14);
  if (repeatRule === 'monthly') return addMonths(base, 1);

  return null;
}

export function formatRepeatRuleLabel(
  repeatRule: ShoppingRepeatRule | null | undefined
) {
  if (repeatRule === 'weekly') return 'Weekly';
  if (repeatRule === 'biweekly') return 'Every 2 weeks';
  if (repeatRule === 'monthly') return 'Monthly';
  return null;
}

export async function upsertRecurringTemplateFromShoppingItem(
  input: ShoppingItemRecurringInput
) {
  if (!input.repeatRule) {
    if (input.itemId) {
      await supabase
        .from('shopping_recurring_templates')
        .delete()
        .eq('source_item_id', input.itemId);
    }
    return;
  }

  if (input.itemId) {
    const { data: existing, error: existingError } = await supabase
      .from('shopping_recurring_templates')
      .select('id')
      .eq('source_item_id', input.itemId)
      .maybeSingle();

    if (existingError) {
      throw new Error(existingError.message);
    }

    if (existing?.id) {
      const { error } = await supabase
        .from('shopping_recurring_templates')
        .update({
          household_id: input.householdId,
          list_id: input.listId,
          title: input.title.trim(),
          quantity: input.quantity,
          unit: input.unit,
          category: input.category,
          notes: input.notes,
          is_favorite: input.isFavorite,
          is_active: true,
          repeat_rule: input.repeatRule,
        })
        .eq('id', existing.id);

      if (error) throw new Error(error.message);
      return;
    }
  }

  const { error } = await supabase.from('shopping_recurring_templates').insert({
    household_id: input.householdId,
    list_id: input.listId,
    source_item_id: input.itemId ?? null,
    title: input.title.trim(),
    quantity: input.quantity,
    unit: input.unit,
    category: input.category,
    notes: input.notes,
    assigned_to: null,
    is_favorite: input.isFavorite,
    is_active: true,
    repeat_rule: input.repeatRule,
    created_by: input.createdBy,
  });

  if (error) throw new Error(error.message);
}

export async function stopRecurringTemplateFromItem(itemId: string) {
  const { error } = await supabase
    .from('shopping_recurring_templates')
    .delete()
    .eq('source_item_id', itemId);

  if (error) throw new Error(error.message);
}

export async function markRecurringTemplateCompletedFromItem(itemId: string) {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('shopping_recurring_templates')
    .update({
      last_completed_at: now,
    })
    .eq('source_item_id', itemId);

  if (error) throw new Error(error.message);
}

export async function generateDueRecurringShoppingItems(householdId: string) {
  const now = new Date();

  const { data: templates, error: templateError } = await supabase
    .from('shopping_recurring_templates')
    .select(
      'id, household_id, list_id, source_item_id, title, quantity, unit, category, notes, is_favorite, is_active, repeat_rule, last_generated_at, last_completed_at'
    )
    .eq('household_id', householdId)
    .eq('is_active', true);

  if (templateError) throw new Error(templateError.message);

  const rows = (templates ?? []) as ShoppingRecurringTemplateRow[];

  for (const template of rows) {
    if (!template.list_id || !template.repeat_rule) continue;

    const nextDue = getNextRecurringDueDate(
      template.last_completed_at,
      template.repeat_rule
    );

    if (!nextDue || nextDue.getTime() > now.getTime()) continue;

    const { data: existingItems, error: existingError } = await supabase
      .from('shopping_list_items')
      .select('id, title, unit, category, is_completed')
      .eq('household_id', householdId)
      .eq('list_id', template.list_id)
      .eq('is_completed', false);

    if (existingError) throw new Error(existingError.message);

    const templateKey = normalizeItemKey({
      title: template.title,
      unit: template.unit,
      category: template.category,
    });

    const alreadyOpen = (existingItems ?? []).some((item) => {
      const itemKey = normalizeItemKey({
        title: item.title,
        unit: item.unit,
        category: item.category,
      });
      return itemKey === templateKey;
    });

    if (alreadyOpen) continue;

    const { error: insertError } = await supabase.from('shopping_list_items').insert({
      household_id: householdId,
      list_id: template.list_id,
      title: template.title,
      quantity: template.quantity,
      unit: template.unit,
      category: template.category,
      notes: template.notes,
      is_completed: false,
      is_favorite: template.is_favorite,
      created_by: null,
      assigned_to: null,
      generated_by_recurring: true,
    });

    if (insertError) throw new Error(insertError.message);

    const { error: updateError } = await supabase
      .from('shopping_recurring_templates')
      .update({
        last_generated_at: now.toISOString(),
      })
      .eq('id', template.id);

    if (updateError) throw new Error(updateError.message);
  }
}