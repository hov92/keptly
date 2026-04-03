export const SHOPPING_CATEGORIES = [
  'Produce',
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

export type ShoppingListItem = {
  id: string;
  household_id: string;
  title: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  notes: string | null;
  is_completed: boolean;
  created_by: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  created_by_name?: string | null;
  assigned_to_name?: string | null;
};

export type ShoppingFilter = 'all' | 'active' | 'completed' | 'assigned';

export function formatQuantity(value: number | null, unit: string | null) {
  if (value == null && !unit) return null;
  if (value != null && unit) return `${value} ${unit}`;
  if (value != null) return `${value}`;
  return unit;
}