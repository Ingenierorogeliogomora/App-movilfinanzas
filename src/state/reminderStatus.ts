import { create } from 'zustand';

/** What the last reminder sync actually achieved on this phone. */
export const useReminderStatus = create<{ permitted: boolean | null; scheduled: number }>(() => ({
  permitted: null,
  scheduled: 0,
}));
