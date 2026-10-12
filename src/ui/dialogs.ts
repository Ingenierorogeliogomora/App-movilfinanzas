// Native alerts on iOS/Android, browser dialogs on web (React Native Web's
// Alert.alert does nothing, which would silently skip confirmations).

import { Alert, Platform } from 'react-native';

export function notify(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

export function confirmAsync(options: {
  title: string;
  message?: string;
  confirmText: string;
  cancelText: string;
  destructive?: boolean;
}): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(options.message ? `${options.title}\n\n${options.message}` : options.title));
  }
  return new Promise((resolve) => {
    Alert.alert(
      options.title,
      options.message,
      [
        { text: options.cancelText, style: 'cancel', onPress: () => resolve(false) },
        { text: options.confirmText, style: options.destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
