import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { NavigationContainer, type LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../auth/AuthProvider';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterChoiceScreen } from '../screens/RegisterChoiceScreen';
import { StudentRegisterScreen } from '../screens/StudentRegisterScreen';
import { AlumniVerifyScreen } from '../screens/AlumniVerifyScreen';
import { AlumniEmailLinkPendingScreen } from '../screens/AlumniEmailLinkPendingScreen';
import { BusinessRegisterScreen } from '../screens/BusinessRegisterScreen';
import { PendingApprovalScreen } from '../screens/PendingApprovalScreen';
import { AccountProvisioningScreen } from '../screens/system/AccountProvisioningScreen';
import { StudentDashboard } from '../screens/dashboards/StudentDashboard';
import { AlumniDashboard } from '../screens/dashboards/AlumniDashboard';
import { BusinessDashboard } from '../screens/dashboards/BusinessDashboard';
import { AccountScreen } from '../screens/system/AccountScreen';
import { PortfolioScreen } from '../screens/profile/PortfolioScreen';
import { ProfileAssistantScreen } from '../screens/profile/ProfileAssistantScreen';
import { OnboardingScreen } from '../screens/profile/OnboardingScreen';
import { FeedScreen } from '../screens/social/FeedScreen';
import { ConnectionsStack } from './ConnectionsStack';
import { MessagesStack } from './MessagesStack';
import { AdminStack } from './AdminStack';
import { OpportunityBoardScreen } from '../screens/opportunities/OpportunityBoardScreen';
import { firebaseProjectId } from '../firebaseApi';
import { Icon } from 'react-native-paper';
import { InboxBell } from '../notifications/NotificationCenter';
import { navigationRef } from './navigationRef';
import { TutorialHost } from '../tutorial/TutorialHost';
import { theme } from '../ui/theme';

export type RootStackParamList = {
  Login: undefined;
  RegisterChoice: undefined;
  StudentRegister: undefined;
  AlumniVerify: undefined;
  AlumniPending: undefined;
  BusinessRegister: undefined;
  PendingApproval: undefined;
  AccountProvisioning: undefined;
  Onboarding: undefined;
  StudentShell: undefined;
  AlumniShell: undefined;
  BusinessShell: undefined;
  AdminShell: undefined;
};

type RoleTabParamList = { Dashboard: undefined; Console: undefined; Feed: undefined; Connections: undefined; Messages: undefined; Opportunities: undefined; Portfolio: undefined; Assistant: undefined; Account: undefined };
const RootStack = createNativeStackNavigator<RootStackParamList>();
const StudentTabs = createBottomTabNavigator<RoleTabParamList>();
const AlumniTabs = createBottomTabNavigator<RoleTabParamList>();
const BusinessTabs = createBottomTabNavigator<RoleTabParamList>();
const AdminTabs = createBottomTabNavigator<RoleTabParamList>();

const TAB_ICONS: Record<string, string> = {
  Dashboard: 'view-dashboard-outline',
  Console: 'shield-account-outline',
  Feed: 'newspaper-variant-outline',
  Connections: 'account-group-outline',
  Messages: 'message-text-outline',
  Opportunities: 'briefcase-outline',
  Portfolio: 'card-account-details-outline',
  Assistant: 'robot-happy-outline',
  Account: 'account-circle-outline',
};

// Shared by every role's tab navigator: icons, brand colours and the notification bell.
const tabScreenOptions = ({ route }: { route: { name: string } }) => ({
  headerRight: () => <InboxBell />,
  tabBarActiveTintColor: theme.colors.primary,
  tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
  tabBarIcon: ({ color, size }: { color: string; size: number }) => (
    <Icon source={TAB_ICONS[route.name] ?? 'circle-outline'} color={color} size={size} />
  ),
});

function RoleTabs({ dashboard, showAssistant = true }: { dashboard: React.ComponentType; showAssistant?: boolean }) {
  return <StudentTabs.Navigator screenOptions={tabScreenOptions}><StudentTabs.Screen name="Dashboard" component={dashboard} /><StudentTabs.Screen name="Feed" component={FeedScreen} /><StudentTabs.Screen name="Connections" component={ConnectionsStack} options={{ headerShown: false }} /><StudentTabs.Screen name="Messages" component={MessagesStack} options={{ headerShown: false }} /><StudentTabs.Screen name="Opportunities" component={OpportunityBoardScreen} /><StudentTabs.Screen name="Portfolio" component={PortfolioScreen} />{showAssistant && <StudentTabs.Screen name="Assistant" component={ProfileAssistantScreen} />}<StudentTabs.Screen name="Account" component={AccountScreen} /></StudentTabs.Navigator>;
}
function AlumniRoleTabs() { return <AlumniTabs.Navigator screenOptions={tabScreenOptions}><AlumniTabs.Screen name="Dashboard" component={AlumniDashboard} /><AlumniTabs.Screen name="Feed" component={FeedScreen} /><AlumniTabs.Screen name="Connections" component={ConnectionsStack} options={{ headerShown: false }} /><AlumniTabs.Screen name="Messages" component={MessagesStack} options={{ headerShown: false }} /><AlumniTabs.Screen name="Opportunities" component={OpportunityBoardScreen} /><AlumniTabs.Screen name="Portfolio" component={PortfolioScreen} /><AlumniTabs.Screen name="Assistant" component={ProfileAssistantScreen} /><AlumniTabs.Screen name="Account" component={AccountScreen} /></AlumniTabs.Navigator>; }
function BusinessRoleTabs() { return <BusinessTabs.Navigator screenOptions={tabScreenOptions}><BusinessTabs.Screen name="Dashboard" component={BusinessDashboard} /><BusinessTabs.Screen name="Feed" component={FeedScreen} /><BusinessTabs.Screen name="Connections" component={ConnectionsStack} options={{ headerShown: false }} /><BusinessTabs.Screen name="Messages" component={MessagesStack} options={{ headerShown: false }} /><BusinessTabs.Screen name="Opportunities" component={OpportunityBoardScreen} /><BusinessTabs.Screen name="Portfolio" component={PortfolioScreen} /><BusinessTabs.Screen name="Assistant" component={ProfileAssistantScreen} /><BusinessTabs.Screen name="Account" component={AccountScreen} /></BusinessTabs.Navigator>; }
function AdminRoleTabs() { return <AdminTabs.Navigator screenOptions={tabScreenOptions}><AdminTabs.Screen name="Console" component={AdminStack} options={{ headerShown: false }} /><AdminTabs.Screen name="Feed" component={FeedScreen} /><AdminTabs.Screen name="Connections" component={ConnectionsStack} options={{ headerShown: false }} /><AdminTabs.Screen name="Messages" component={MessagesStack} options={{ headerShown: false }} /><AdminTabs.Screen name="Portfolio" component={PortfolioScreen} /><AdminTabs.Screen name="Assistant" component={ProfileAssistantScreen} /><AdminTabs.Screen name="Account" component={AccountScreen} /></AdminTabs.Navigator>; }
function getLinking(): LinkingOptions<RootStackParamList> { const projectId = firebaseProjectId(); return { prefixes: ['richfieldconnect://', `https://${projectId}.firebaseapp.com`] }; }
function BootstrapError({ message }: { message: string }) { return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}><Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Account state unavailable</Text><Text>{message}</Text></View>; }

// The role shells render their own tab headers, and these full-screen states have
// no screen to go back to, so the root stack's default header (which shows raw
// route names such as "AdminShell") is hidden for them. Registration screens keep
// it for the back button to Login.
const HEADERLESS_ROUTES = new Set(['Login', 'Onboarding', 'PendingApproval', 'AccountProvisioning', 'StudentShell', 'AlumniShell', 'BusinessShell', 'AdminShell']);

export function RootNavigator() {
  const { loading, firebaseUser, profile, profileError } = useAuth();
  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;
  return <TutorialHost><NavigationContainer ref={navigationRef} linking={getLinking()}><RootStack.Navigator screenOptions={({ route }) => ({ headerShown: !HEADERLESS_ROUTES.has(route.name) })}>
    {!firebaseUser ? <RootStack.Group><RootStack.Screen name="Login" component={LoginScreen} /><RootStack.Screen name="RegisterChoice" component={RegisterChoiceScreen} options={{ title: 'Create an account' }} /><RootStack.Screen name="StudentRegister" component={StudentRegisterScreen} options={{ title: 'Student registration' }} /><RootStack.Screen name="AlumniVerify" component={AlumniVerifyScreen} options={{ title: 'Alumni verification' }} /><RootStack.Screen name="AlumniPending" component={AlumniEmailLinkPendingScreen} options={{ title: 'Check your email' }} /><RootStack.Screen name="BusinessRegister" component={BusinessRegisterScreen} options={{ title: 'Employer registration' }} /></RootStack.Group>
      : !profile ? <RootStack.Screen name="AccountProvisioning">{() => <AccountProvisioningScreen error={profileError} />}</RootStack.Screen>
      : profile.role === 'business' && !profile.isApproved ? <RootStack.Screen name="PendingApproval" component={PendingApprovalScreen} />
      : profile.role !== 'administrator' && profile.onboardingComplete !== true ? <RootStack.Screen name="Onboarding">{() => <OnboardingScreen onComplete={() => undefined} />}</RootStack.Screen>
      : profile.role === 'student' ? <RootStack.Screen name="StudentShell">{() => <RoleTabs dashboard={StudentDashboard} />}</RootStack.Screen>
      : profile.role === 'alumni' ? <RootStack.Screen name="AlumniShell" component={AlumniRoleTabs} />
      : profile.role === 'business' && profile.isApproved ? <RootStack.Screen name="BusinessShell" component={BusinessRoleTabs} />
      : profile.role === 'administrator' ? <RootStack.Screen name="AdminShell" component={AdminRoleTabs} />
      : <RootStack.Screen name="AccountProvisioning">{() => <BootstrapError message="Your account has an unsupported role. Contact a Richfield administrator." />}</RootStack.Screen>}
  </RootStack.Navigator></NavigationContainer></TutorialHost>;
}
