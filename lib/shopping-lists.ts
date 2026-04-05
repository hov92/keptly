export type ShoppingList = {
  id: string;
  household_id: string;
  name: string;
  color: string | null;
  icon: string | null;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export const SHOPPING_LIST_COLORS = [
  '#264653',
  '#2A9D8F',
  '#E9C46A',
  '#F4A261',
  '#E76F51',
  '#6D597A',
  '#457B9D',
] as const;

export const SHOPPING_LIST_ICONS = [
  'cart',
  'basket',
  'storefront',
  'restaurant',
  'briefcase',
  'gift',
  'home',
] as const;