export type ShoppingRecurringTemplate = {
  id: string;
  household_id: string;
  title: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  notes: string | null;
  assigned_to: string | null;
  is_favorite: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  assigned_to_name?: string | null;
};

export type PantryItem = {
  id: string;
  household_id: string;
  title: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  notes: string | null;
  low_stock_threshold: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export function isLowStock(item: PantryItem) {
  if (item.quantity == null || item.low_stock_threshold == null) return false;
  return item.quantity <= item.low_stock_threshold;
}