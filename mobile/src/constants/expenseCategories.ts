import { Ionicons } from '@expo/vector-icons';

export const EXPENSE_CATEGORIES = [
  'Food',
  'Fuel',
  'Stay',
  'Transport',
  'Activities',
  'Shopping',
  'Bills',
  'Other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_ICONS: Record<
  ExpenseCategory,
  keyof typeof Ionicons.glyphMap
> = {
  Food: 'restaurant-outline',
  Fuel: 'speedometer-outline',
  Stay: 'bed-outline',
  Transport: 'car-outline',
  Activities: 'ticket-outline',
  Shopping: 'cart-outline',
  Bills: 'receipt-outline',
  Other: 'ellipsis-horizontal-circle-outline',
};