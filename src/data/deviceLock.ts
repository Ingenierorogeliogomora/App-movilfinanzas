// Face ID / Touch ID / fingerprint / device passcode, via the OS prompt.

import * as LocalAuthentication from 'expo-local-authentication';
import * as ScreenCapture from 'expo-screen-capture';
import { Platform } from 'react-native';

export const lockSupported = Platform.OS === 'ios' || Platform.OS === 'android';

/**
 * Shared with code outside React: deep links are ignored while `engaged`,
 * and leaving the app for a system screen we opened (file picker, share
 * sheet, Settings) does not count as leaving while `suspended` > 0.
 */
export const lockState = { engaged: false, suspended: 0 };

export async function withLockSuspended<T>(task: () => Promise<T>): Promise<T> {
  lockState.suspended++;
  try {
    return await task();
  } finally {
    lockState.suspended--;
  }
}

/** True when the phone has biometrics or at least a passcode/PIN set up. */
export async function canUseDeviceLock(): Promise<boolean> {
  if (!lockSupported) return false;
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    return level !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

/** Shows the system prompt. Falls back to the device passcode after failed biometrics. */
export async function authenticate(promptMessage: string, cancelLabel: string): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage, cancelLabel, disableDeviceFallback: false });
    return result.success;
  } catch {
    return false;
  }
}

/**
 * Hides the app's content in the app switcher: a native blur on iOS, and on
 * Android FLAG_SECURE (blank Recents thumbnail; it also blocks screenshots).
 */
export async function setAppSwitcherProtection(on: boolean): Promise<void> {
  try {
    if (Platform.OS === 'ios') {
      if (on) await ScreenCapture.enableAppSwitcherProtectionAsync(0.9);
      else await ScreenCapture.disableAppSwitcherProtectionAsync();
    } else if (Platform.OS === 'android') {
      if (on) await ScreenCapture.preventScreenCaptureAsync('app-lock');
      else await ScreenCapture.allowScreenCaptureAsync('app-lock');
    }
  } catch {
    // Not critical: the lock screen still protects the app.
  }
}
