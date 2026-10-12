import type { Bucket, CategoryType, Nature } from './types';

export interface CategorySeed {
  key: string;
  type: CategoryType;
  icon: string;
  color: string;
  nature: Nature;
  bucket: Bucket;
}

// Built-in categories designed around how a financial planner reviews a
// budget: fixed obligations vs. variable spending, and the 50/30/20 buckets.
export const DEFAULT_CATEGORIES: CategorySeed[] = [
  // Expenses — needs
  { key: 'housing', type: 'expense', icon: 'home', color: '#4F46E5', nature: 'fixed', bucket: 'needs' },
  { key: 'utilities', type: 'expense', icon: 'flash', color: '#0EA5E9', nature: 'fixed', bucket: 'needs' },
  { key: 'phone_internet', type: 'expense', icon: 'wifi', color: '#06B6D4', nature: 'fixed', bucket: 'needs' },
  { key: 'insurance', type: 'expense', icon: 'shield-checkmark', color: '#14B8A6', nature: 'fixed', bucket: 'needs' },
  { key: 'groceries', type: 'expense', icon: 'cart', color: '#22C55E', nature: 'variable', bucket: 'needs' },
  { key: 'transportation', type: 'expense', icon: 'car', color: '#84CC16', nature: 'variable', bucket: 'needs' },
  { key: 'health', type: 'expense', icon: 'medkit', color: '#EF4444', nature: 'variable', bucket: 'needs' },
  { key: 'education_kids', type: 'expense', icon: 'school', color: '#F59E0B', nature: 'fixed', bucket: 'needs' },
  { key: 'family_support', type: 'expense', icon: 'people', color: '#D946EF', nature: 'variable', bucket: 'needs' },
  { key: 'interest_fees', type: 'expense', icon: 'alert-circle', color: '#DC2626', nature: 'variable', bucket: 'needs' },
  // Expenses — savings & debt repayment
  { key: 'debt_payments', type: 'expense', icon: 'card', color: '#7C3AED', nature: 'fixed', bucket: 'savings' },
  { key: 'savings_investments', type: 'expense', icon: 'trending-up', color: '#10B981', nature: 'variable', bucket: 'savings' },
  // Expenses — wants
  { key: 'dining', type: 'expense', icon: 'restaurant', color: '#F97316', nature: 'variable', bucket: 'wants' },
  { key: 'shopping', type: 'expense', icon: 'bag-handle', color: '#EC4899', nature: 'variable', bucket: 'wants' },
  { key: 'subscriptions', type: 'expense', icon: 'repeat', color: '#8B5CF6', nature: 'fixed', bucket: 'wants' },
  { key: 'entertainment', type: 'expense', icon: 'film', color: '#F43F5E', nature: 'variable', bucket: 'wants' },
  { key: 'personal_care', type: 'expense', icon: 'sparkles', color: '#FB7185', nature: 'variable', bucket: 'wants' },
  { key: 'travel', type: 'expense', icon: 'airplane', color: '#3B82F6', nature: 'variable', bucket: 'wants' },
  { key: 'gifts_donations', type: 'expense', icon: 'gift', color: '#A855F7', nature: 'variable', bucket: 'wants' },
  { key: 'pets', type: 'expense', icon: 'paw', color: '#A16207', nature: 'variable', bucket: 'wants' },
  { key: 'other_expense', type: 'expense', icon: 'ellipsis-horizontal-circle', color: '#64748B', nature: 'variable', bucket: 'wants' },
  // Income
  { key: 'salary', type: 'income', icon: 'briefcase', color: '#16A34A', nature: 'fixed', bucket: 'needs' },
  { key: 'side_income', type: 'income', icon: 'rocket', color: '#0D9488', nature: 'variable', bucket: 'needs' },
  { key: 'refunds', type: 'income', icon: 'arrow-undo', color: '#0284C7', nature: 'variable', bucket: 'needs' },
  { key: 'other_income', type: 'income', icon: 'add-circle', color: '#65A30D', nature: 'variable', bucket: 'needs' },
];

export const SAVINGS_CATEGORY_KEY = 'savings_investments';
export const DEBT_PAYMENT_CATEGORY_KEY = 'debt_payments';
export const INTEREST_CATEGORY_KEY = 'interest_fees';
export const SUBSCRIPTIONS_CATEGORY_KEY = 'subscriptions';

export const CATEGORY_COLORS = [
  '#4F46E5', '#0EA5E9', '#06B6D4', '#14B8A6', '#22C55E', '#84CC16', '#EAB308', '#F59E0B',
  '#F97316', '#EF4444', '#EC4899', '#D946EF', '#A855F7', '#8B5CF6', '#64748B', '#A16207',
];

export const CATEGORY_ICONS = [
  'home', 'flash', 'wifi', 'shield-checkmark', 'cart', 'car', 'bus', 'medkit', 'school',
  'people', 'card', 'trending-up', 'restaurant', 'cafe', 'bag-handle', 'repeat', 'film',
  'game-controller', 'sparkles', 'barbell', 'airplane', 'gift', 'paw', 'heart', 'construct',
  'shirt', 'beer', 'briefcase', 'rocket', 'cash', 'wallet', 'ellipsis-horizontal-circle',
];
