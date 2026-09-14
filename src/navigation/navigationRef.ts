import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './RootNavigator';

/**
 * Lets components that live outside a navigator — the guided tour overlay — move
 * the user between tabs.
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigateToTab(shell: keyof RootStackParamList, tab: string): void {
  if (!navigationRef.isReady()) return;
  try {
    (navigationRef.navigate as unknown as (name: string, params: { screen: string }) => void)(shell, { screen: tab });
  } catch (error) {
    console.warn('Tour navigation failed', error);
  }
}
