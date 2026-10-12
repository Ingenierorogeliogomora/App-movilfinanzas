// Domain model shared by the whole app. All money values are integer cents
// (minor units) to avoid floating point drift.

export type TxType = 'income' | 'expense' | 'transfer';

export type PaymentMethod =
  | 'credit_card'
  | 'debit_card'
  | 'transfer'
  | 'digital_wallet'
  | 'cash'
  | 'check'
  | 'other';

export const PAYMENT_METHODS: PaymentMethod[] = [
  'credit_card',
  'debit_card',
  'transfer',
  'digital_wallet',
  'cash',
  'check',
  'other',
];

/** Fixed = obligation that repeats every period. Variable = changes with behavior. */
export type Nature = 'fixed' | 'variable';

/** 50/30/20 buckets: needs (50%), wants (30%), savings & debt repayment (20%). */
export type Bucket = 'needs' | 'wants' | 'savings';

export type CategoryType = 'income' | 'expense';

export interface Category {
  id: string;
  /** Stable key for built-in categories (used for translations and rules). */
  key: string | null;
  /** Custom name. When null, the UI shows the translated built-in name. */
  name: string | null;
  type: CategoryType;
  icon: string;
  color: string;
  nature: Nature;
  bucket: Bucket;
  archived: boolean;
  sort: number;
}

export interface Transaction {
  id: string;
  type: TxType;
  /** Always positive. Direction is given by `type`. */
  amount: number;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  categoryId: string | null;
  method: PaymentMethod;
  description: string;
  note: string | null;
  debtId: string | null;
  recurringId: string | null;
  importHash: string | null;
  createdAt: string;
}

export type DebtKind =
  | 'credit_card'
  | 'personal_loan'
  | 'auto_loan'
  | 'student_loan'
  | 'medical'
  | 'mortgage'
  | 'bnpl'
  | 'other';

export const DEBT_KINDS: DebtKind[] = [
  'credit_card',
  'personal_loan',
  'auto_loan',
  'student_loan',
  'medical',
  'mortgage',
  'bnpl',
  'other',
];

export interface Debt {
  id: string;
  name: string;
  kind: DebtKind;
  balance: number;
  /** Balance when the user started tracking it; used for progress. */
  originalBalance: number;
  /** Annual percentage rate, e.g. 24.99 */
  apr: number;
  minPayment: number;
  /** Credit limit (credit cards only) to compute utilization. */
  creditLimit: number | null;
  dueDay: number | null;
  createdAt: string;
  closedAt: string | null;
}

export type Frequency = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly' | 'quarterly' | 'yearly';

export const FREQUENCIES: Frequency[] = [
  'weekly',
  'biweekly',
  'semimonthly',
  'monthly',
  'quarterly',
  'yearly',
];

export interface Recurring {
  id: string;
  name: string;
  type: CategoryType;
  amount: number;
  categoryId: string | null;
  method: PaymentMethod;
  frequency: Frequency;
  /** Next due date, YYYY-MM-DD. */
  nextDate: string;
  active: boolean;
}

export interface Budget {
  categoryId: string;
  /** Monthly limit. */
  amount: number;
}

/** User-learned categorization rule: if a description contains `pattern`, apply it. */
export interface Rule {
  id: string;
  pattern: string;
  categoryId: string | null;
  txType: TxType | null;
  createdAt: string;
}
