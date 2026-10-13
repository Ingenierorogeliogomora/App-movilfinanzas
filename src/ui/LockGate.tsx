import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';

import { authenticate, canUseDeviceLock, lockState, lockSupported, setAppSwitcherProtection } from '@/data/deviceLock';
import { useI18n } from '@/i18n';
import { useLockStatus } from '@/state/lock';
import { useStore } from '@/state/store';
import { spacing, useTheme } from '@/theme';

import { Button, Icon, Txt } from './primitives';

/** Coming back within this time does not ask again (e.g. switching to the bank app). */
const GRACE_MS = 60_000;

/**
 * Covers the app until the person unlocks it with Face ID / fingerprint /
 * passcode. The app-switcher preview is hidden natively while the lock is on.
 */
export function LockGate() {
  const c = useTheme();
  const { t } = useI18n();
  const appLock = useStore((s) => s.settings.appLock) && lockSupported;
  // Locked on cold start when the setting is on (the store is loaded before this mounts).
  const [locked, setLocked] = useState(appLock);
  const lockedRef = useRef(locked);
  const backgroundAt = useRef<number | null>(null);
  const authenticating = useRef(false);
  const engaged = appLock && locked;

  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);

  useEffect(() => {
    lockState.engaged = engaged;
    useLockStatus.setState({ locked: engaged });
  }, [engaged]);

  useEffect(() => {
    if (lockSupported) void setAppSwitcherProtection(appLock);
  }, [appLock]);

  const unlock = useCallback(async () => {
    if (authenticating.current) return;
    authenticating.current = true;
    try {
      // With no biometrics or passcode left on the phone the lock would keep
      // the person out of their own data; it also protects nothing then.
      if (!(await canUseDeviceLock()) || (await authenticate(t('lock.prompt'), t('common.cancel')))) {
        setLocked(false);
      }
    } finally {
      authenticating.current = false;
    }
  }, [t]);

  useEffect(() => {
    if (!appLock) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        // The Android passcode screen and the file pickers/share sheets we open
        // also send the app to the background; those are not "leaving".
        if (!authenticating.current && lockState.suspended === 0) backgroundAt.current = Date.now();
      } else if (state === 'active') {
        const away = backgroundAt.current;
        backgroundAt.current = null;
        if (away === null) return;
        const now = Date.now();
        // A clock moved backwards counts as expired, so changing the time cannot skip the lock.
        const expired = now - away > GRACE_MS || now < away;
        if (expired || lockedRef.current) {
          setLocked(true);
          void unlock();
        }
      }
    });
    return () => sub.remove();
  }, [appLock, unlock]);

  // Ask right away when the lock appears (cold start).
  useEffect(() => {
    if (engaged && AppState.currentState === 'active') void unlock();
  }, [engaged, unlock]);

  if (!engaged) return null;

  const screen = (
    <View style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: c.bg }]} accessibilityViewIsModal>
      <View style={[styles.badge, { backgroundColor: c.primary }]}>
        <Icon name="lock-closed" size={36} color={c.onPrimary} />
      </View>
      <Txt variant="title" center>
        {t('lock.title')}
      </Txt>
      <Txt muted center>
        {t('lock.body')}
      </Txt>
      <Button title={t('lock.unlock')} icon="finger-print" onPress={() => void unlock()} style={{ alignSelf: 'stretch' }} />
    </View>
  );
  // On iOS, modal screens are presented above the app's root view; a separate
  // full-window overlay is the only way to stay on top of them.
  return Platform.OS === 'ios' ? (
    <FullWindowOverlay unstable_accessibilityContainerViewIsModal>{screen}</FullWindowOverlay>
  ) : (
    screen
  );
}

const styles = StyleSheet.create({
  overlay: { zIndex: 1000, elevation: 1000, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xxl },
  badge: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
