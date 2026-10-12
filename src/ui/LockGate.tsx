import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { authenticate, canUseDeviceLock, lockSupported } from '@/data/deviceLock';
import { useI18n } from '@/i18n';
import { useStore } from '@/state/store';
import { spacing, useTheme } from '@/theme';

import { Button, Icon, Txt } from './primitives';

/** Coming back within this time does not ask again (e.g. switching to the bank app). */
const GRACE_MS = 60_000;

/**
 * Covers the app until the person unlocks it with Face ID / fingerprint /
 * passcode. Also hides balances while the app is in the background so they do
 * not show in the app switcher.
 */
export function LockGate() {
  const c = useTheme();
  const { t } = useI18n();
  const appLock = useStore((s) => s.settings.appLock);
  // Locked on cold start when the setting is on (the store is loaded before this mounts).
  const [locked, setLocked] = useState(appLock && lockSupported);
  const [covered, setCovered] = useState(false);
  const backgroundAt = useRef<number | null>(null);
  const authenticating = useRef(false);

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
    if (!appLock || !lockSupported) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        backgroundAt.current = Date.now();
        setCovered(true);
      } else if (state === 'inactive') {
        // iOS also goes "inactive" while showing the Face ID prompt.
        if (!authenticating.current) setCovered(true);
      } else if (state === 'active') {
        setCovered(false);
        const away = backgroundAt.current;
        backgroundAt.current = null;
        if (away !== null && Date.now() - away > GRACE_MS) {
          // Close open forms so nothing is visible above the lock screen.
          if (router.canDismiss()) router.dismissAll();
          setLocked(true);
        }
      }
    });
    return () => sub.remove();
  }, [appLock]);

  // Ask right away when the lock appears.
  useEffect(() => {
    if (appLock && locked && AppState.currentState === 'active') void unlock();
  }, [appLock, locked, unlock]);

  if (!appLock || !lockSupported || (!locked && !covered)) return null;

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: c.bg }]} accessibilityViewIsModal>
      <View style={[styles.badge, { backgroundColor: c.primary }]}>
        <Icon name="lock-closed" size={36} color={c.onPrimary} />
      </View>
      {locked ? (
        <>
          <Txt variant="title" center>
            {t('lock.title')}
          </Txt>
          <Txt muted center>
            {t('lock.body')}
          </Txt>
          <Button title={t('lock.unlock')} icon="finger-print" onPress={() => void unlock()} style={{ alignSelf: 'stretch' }} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { zIndex: 1000, elevation: 1000, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xxl },
  badge: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
