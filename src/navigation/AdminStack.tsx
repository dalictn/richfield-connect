import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AdminConsoleScreen } from '../screens/admin/AdminConsoleScreen';
import { AdminDashboardScreen } from '../screens/admin/AdminDashboardScreen';
import { OpportunityApprovalScreen } from '../screens/admin/OpportunityApprovalScreen';
import { ModerationQueueScreen } from '../screens/admin/ModerationQueueScreen';
import { BroadcastScreen } from '../screens/admin/BroadcastScreen';
import { AdminAnalyticsScreen } from '../screens/analytics/AdminAnalyticsScreen';

/**
 * Administrator governance screens, grouped behind a single console tab.
 *
 * Keeping these as sibling tabs alongside the member screens (feed, messages,
 * portfolio and so on) produced eleven bottom tabs, which is unusable on a
 * phone. The console hub is the only tab; everything else is pushed from it.
 */
export type AdminStackParamList = {
  AdminHome: undefined;
  AdminUsers: undefined;
  AdminApprovals: undefined;
  AdminModeration: undefined;
  AdminAnalytics: undefined;
  AdminBroadcast: undefined;
};

const Stack = createNativeStackNavigator<AdminStackParamList>();

export function AdminStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="AdminHome" component={AdminConsoleScreen} options={{ title: 'Console' }} />
      <Stack.Screen name="AdminUsers" component={AdminDashboardScreen} options={{ title: 'User management' }} />
      <Stack.Screen name="AdminApprovals" component={OpportunityApprovalScreen} options={{ title: 'Opportunity approvals' }} />
      <Stack.Screen name="AdminModeration" component={ModerationQueueScreen} options={{ title: 'Moderation queue' }} />
      <Stack.Screen name="AdminAnalytics" component={AdminAnalyticsScreen} options={{ title: 'Platform analytics' }} />
      <Stack.Screen name="AdminBroadcast" component={BroadcastScreen} options={{ title: 'Broadcast centre' }} />
    </Stack.Navigator>
  );
}
