// Face ID / Touch ID / fingerprint / device passcode, via the OS prompt.

import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export const lockSupported = Platform.OS === 'ios' || Platform.OS === 'android';

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
