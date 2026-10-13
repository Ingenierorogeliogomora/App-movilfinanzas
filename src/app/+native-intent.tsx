import { lockState } from '@/data/deviceLock';

/**
 * Links that open the app (e.g. salda://transaction/new) are ignored while the
 * app is locked, so nobody can reach a screen without unlocking first.
 */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string | null {
  try {
    return !initial && lockState.engaged ? null : path;
  } catch {
    return path;
  }
}
