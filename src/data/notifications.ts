// Local notifications for payment reminders. Nothing is sent to a server:
// reminders are scheduled on the device from the person's own data.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const remindersSupported = Platform.OS === 'ios' || Platform.OS === 'android';

const CHANNEL_ID = 'payment-reminders';

export interface ScheduledReminder {
  id: string;
  title: string;
  body: string;
  date: Date;
  /** Screen to open when the notification is tapped. */
  url: string;
}

/** Shows reminders even when the app is open. Call once at startup. */
export function configureNotifications(): void {
  if (!remindersSupported) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function ensureChannel(name: string): Promise<void> {
  // Android 8+ needs a channel, and Android 13+ only shows the permission
  // prompt once a channel exists.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name,
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
}

function allowed(status: Notifications.NotificationPermissionsStatus): boolean {
  return status.granted || status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

/** Asks for permission if needed. Returns whether reminders can be shown. */
export async function requestReminderPermission(channelName: string): Promise<boolean> {
  if (!remindersSupported) return false;
  await ensureChannel(channelName);
  const current = await Notifications.getPermissionsAsync();
  if (allowed(current)) return true;
  if (!current.canAskAgain) return false;
  return allowed(await Notifications.requestPermissionsAsync());
}

export async function cancelAllReminders(): Promise<void> {
  if (!remindersSupported) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Replaces every scheduled reminder with `items`. Salda schedules nothing
 * else, so clearing all pending notifications is safe. Returns how many
 * were scheduled.
 */
export async function replaceReminders(items: ScheduledReminder[], channelName: string): Promise<number> {
  if (!remindersSupported) return 0;
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!allowed(await Notifications.getPermissionsAsync())) return 0;
  await ensureChannel(channelName);
  let scheduled = 0;
  const now = Date.now();
  for (const item of items) {
    if (item.date.getTime() <= now) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: item.id,
      content: { title: item.title, body: item.body, data: { url: item.url }, sound: 'default' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: item.date, channelId: CHANNEL_ID },
    });
    scheduled++;
  }
  return scheduled;
}
