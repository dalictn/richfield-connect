import { Alert } from 'react-native';

/**
 * Cross-platform dialogs.
 *
 * react-native-web ships `Alert.alert` as an empty function, so on web every
 * Alert-based message is silently dropped and — worse — every confirmation
 * callback never runs, leaving destructive buttons inert. Screens use these
 * helpers instead of Alert directly so both platforms behave the same.
 */

export function notify(title: string, message?: string): void {
  Alert.alert(title, message);
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(options.title, options.message, [
      { text: options.cancelLabel ?? 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      {
        text: options.confirmLabel ?? 'Confirm',
        style: options.destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}
