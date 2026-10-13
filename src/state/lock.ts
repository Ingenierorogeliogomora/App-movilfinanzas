import { create } from 'zustand';

/** Whether the lock screen is up, so the app behind it can hide from screen readers. */
export const useLockStatus = create<{ locked: boolean }>(() => ({ locked: false }));
