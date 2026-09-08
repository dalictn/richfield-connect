export async function registerForNotifications(): Promise<void> { return Promise.resolve(); }
export function subscribeNotificationMessages(): () => void { return () => undefined; }
export function subscribeTokenRefresh(): () => void { return () => undefined; }
