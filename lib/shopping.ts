export const SHOPPING_CATEGORIES = [
  'Produce',
  'Bread',
  'Dairy',
  'Meat',
  'Frozen',
  'Pantry',
  'Snacks',
  'Drinks',
  'Household',
  'Personal care',
  'Other',
] as const;

export type ShoppingCategory = (typeof SHOPPING_CATEGORIES)[number];

export type ShoppingFilter =
  | 'all'
  | 'active'
  | 'completed'
  | 'assigned'
  | 'favorites'
  | 'pantry';

export type ShoppingRecurrenceType = 'weekly' | 'biweekly' | 'monthly';

export type ShoppingListItem = {
  id: string;
  household_id: string;
  list_id: string;
  title: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  notes: string | null;
  is_completed: boolean;
  is_favorite: boolean;
  created_by: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  last_purchased_at?: string | null;
  created_by_name?: string | null;
  assigned_to_name?: string | null;
};

export function formatQuantity(value: number | null, unit: string | null) {
  if (value == null && !unit) return null;
  if (value != null && unit) return `${value} ${unit}`;
  if (value != null) return `${value}`;
  return unit;
}

export function recurrenceLabel(
  recurrenceType?: ShoppingRecurrenceType | null,
  recurrenceInterval?: number | null
) {
  if (!recurrenceType) return null;
  if (recurrenceType === 'weekly') return 'Repeats weekly';
  if (recurrenceType === 'biweekly') return 'Repeats every 2 weeks';
  if (recurrenceType === 'monthly') return 'Repeats monthly';
  if (recurrenceInterval) return `Repeats every ${recurrenceInterval}`;
  return 'Repeats';
}