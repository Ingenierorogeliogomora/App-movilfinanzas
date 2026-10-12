// "Financial order of operations": the sequence a planner typically follows
// with someone whose debts got out of control. Each step reports progress
// computed from the person's own data.

import { HIGH_INTEREST_APR } from './health';
import type { Debt } from './types';

export type PlanStepKey =
  | 'track'
  | 'budget'
  | 'starter_fund'
  | 'stop_new_debt'
  | 'high_interest'
  | 'full_fund'
  | 'retirement'
  | 'other_goals';

export interface PlanStep {
  key: PlanStepKey;
  progress: number;
  done: boolean;
  /** Steps that can only be confirmed by the person. */
  manual: boolean;
}

export interface PlanInput {
  recentTransactions: number;
  budgetsCount: number;
  emergencyFund: number;
  monthlyEssentials: number;
  debts: Pick<Debt, 'balance' | 'originalBalance' | 'apr' | 'closedAt'>[];
  manualDone: Partial<Record<PlanStepKey, boolean>>;
  /** Starter emergency fund when essentials are unknown (minor units). */
  defaultStarterFund?: number;
}

const clamp = (v: number) => Math.min(1, Math.max(0, v));

export function starterFundTarget(monthlyEssentials: number, fallback = 100_000): number {
  // US planners usually suggest $1,000 or one month of essentials, whichever is higher.
  return Math.max(fallback, monthlyEssentials);
}

export function buildPlan(input: PlanInput): PlanStep[] {
  const high = input.debts.filter((d) => d.apr >= HIGH_INTEREST_APR);
  const highOriginal = high.reduce((s, d) => s + Math.max(d.originalBalance, d.balance), 0);
  const highBalance = high.filter((d) => !d.closedAt).reduce((s, d) => s + Math.max(0, d.balance), 0);
  const starter = starterFundTarget(input.monthlyEssentials, input.defaultStarterFund);
  const full = input.monthlyEssentials > 0 ? input.monthlyEssentials * 3 : starter * 3;

  const steps: PlanStep[] = [
    { key: 'track', manual: false, progress: clamp(input.recentTransactions / 20), done: false },
    { key: 'budget', manual: false, progress: clamp(input.budgetsCount / 5), done: false },
    { key: 'starter_fund', manual: false, progress: clamp(input.emergencyFund / starter), done: false },
    { key: 'stop_new_debt', manual: true, progress: 0, done: false },
    {
      key: 'high_interest',
      manual: false,
      progress: highOriginal > 0 ? clamp(1 - highBalance / highOriginal) : 1,
      done: false,
    },
    { key: 'full_fund', manual: false, progress: clamp(input.emergencyFund / full), done: false },
    { key: 'retirement', manual: true, progress: 0, done: false },
    { key: 'other_goals', manual: true, progress: 0, done: false },
  ];

  for (const s of steps) {
    if (s.manual) {
      s.done = !!input.manualDone[s.key];
      s.progress = s.done ? 1 : 0;
    } else {
      s.done = s.progress >= 1;
    }
  }
  return steps;
}

/** The first step not finished yet: where the person should focus now. */
export function currentStep(steps: PlanStep[]): PlanStep | null {
  return steps.find((s) => !s.done) ?? null;
}
