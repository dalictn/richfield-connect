/**
 * Web implementation of the cross-platform dialog helpers.
 *
 * react-native-web's Alert is a no-op, so these fall back to the browser's own
 * dialogs. See alert.native.ts for the contract.
 */

export function notify(title: string, message?: string): void {
  if (typeof window === 'undefined') return;
  window.alert(message ? `${title}\n\n${message}` : title);
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  const body = options.message ? `${options.title}\n\n${options.message}` : options.title;
  return Promise.resolve(window.confirm(body));
}
