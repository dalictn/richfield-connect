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
import { AdminDashboardScreen } from '../screens/admin/AdminDashboardScreen';
import { ModerationQueueScreen } from '../screens/admin/ModerationQueueScreen';
import { BroadcastScreen } from '../screens/admin/BroadcastScreen';
import { AccountScreen } from '../screens/system/AccountScreen';
import { PortfolioScreen } from '../screens/profile/PortfolioScreen';
import { ProfileAssistantScreen } from '../screens/profile/ProfileAssistantScreen';
import { OnboardingScreen } from '../screens/profile/OnboardingScreen';
import { FeedScreen } from '../screens/social/FeedScreen';
import { ConnectionsScreen } from '../screens/social/ConnectionsScreen';
import { MessagesScreen } from '../screens/social/MessagesScreen';
import { OpportunityBoardScreen } from '../screens/opportunities/OpportunityBoardScreen';
import { firebaseProjectId } from '../firebaseApi';

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

type RoleTabParamList = { Dashboard: undefined; Feed: undefined; Connections: undefined; Messages: undefined; Opportunities: undefined; Portfolio: undefined; Assistant: undefined; Moderation: undefined; Broadcast: undefined; Account: undefined };
const RootStack = createNativeStackNavigator<RootStackParamList>();
const StudentTabs = createBottomTabNavigator<RoleTabParamList>();
const AlumniTabs = createBottomTabNavigator<RoleTabParamList>();
const BusinessTabs = createBottomTabNavigator<RoleTabParamList>();
const AdminTabs = createBottomTabNavigator<RoleTabParamList>();

function RoleTabs({ dashboard, showAssistant = true }: { dashboard: React.ComponentType; showAssistant?: boolean }) {
  return <StudentTabs.Navigator><StudentTabs.Screen name="Dashboard" component={dashboard} /><StudentTabs.Screen name="Feed" component={FeedScreen} /><StudentTabs.Screen name="Connections" component={ConnectionsScreen} /><StudentTabs.Screen name="Messages" component={MessagesScreen} /><StudentTabs.Screen name="Opportunities" component={OpportunityBoardScreen} /><StudentTabs.Screen name="Portfolio" component={PortfolioScreen} />{showAssistant && <StudentTabs.Screen name="Assistant" component={ProfileAssistantScreen} />}<StudentTabs.Screen name="Account" component={AccountScreen} /></StudentTabs.Navigator>;
}
function AlumniRoleTabs() { return <AlumniTabs.Navigator><AlumniTabs.Screen name="Dashboard" component={AlumniDashboard} /><AlumniTabs.Screen name="Feed" component={FeedScreen} /><AlumniTabs.Screen name="Connections" component={ConnectionsScreen} /><AlumniTabs.Screen name="Messages" component={MessagesScreen} /><AlumniTabs.Screen name="Opportunities" component={OpportunityBoardScreen} /><AlumniTabs.Screen name="Portfolio" component={PortfolioScreen} /><AlumniTabs.Screen name="Assistant" component={ProfileAssistantScreen} /><AlumniTabs.Screen name="Account" component={AccountScreen} /></AlumniTabs.Navigator>; }
function BusinessRoleTabs() { return <BusinessTabs.Navigator><BusinessTabs.Screen name="Dashboard" component={BusinessDashboard} /><BusinessTabs.Screen name="Feed" component={FeedScreen} /><BusinessTabs.Screen name="Connections" component={ConnectionsScreen} /><BusinessTabs.Screen name="Messages" component={MessagesScreen} /><BusinessTabs.Screen name="Opportunities" component={OpportunityBoardScreen} /><BusinessTabs.Screen name="Portfolio" component={PortfolioScreen} /><BusinessTabs.Screen name="Assistant" component={ProfileAssistantScreen} /><BusinessTabs.Screen name="Account" component={AccountScreen} /></BusinessTabs.Navigator>; }
function AdminRoleTabs() { return <AdminTabs.Navigator><AdminTabs.Screen name="Dashboard" component={AdminDashboardScreen} /><AdminTabs.Screen name="Moderation" component={ModerationQueueScreen} /><AdminTabs.Screen name="Broadcast" component={BroadcastScreen} /><AdminTabs.Screen name="Feed" component={FeedScreen} /><AdminTabs.Screen name="Connections" component={ConnectionsScreen} /><AdminTabs.Screen name="Messages" component={MessagesScreen} /><AdminTabs.Screen name="Portfolio" component={PortfolioScreen} /><AdminTabs.Screen name="Assistant" component={ProfileAssistantScreen} /><AdminTabs.Screen name="Account" component={AccountScreen} /></AdminTabs.Navigator>; }
function getLinking(): LinkingOptions<RootStackParamList> { const projectId = firebaseProjectId(); return { prefixes: ['richfieldconnect://', `https://${projectId}.firebaseapp.com`] }; }
function BootstrapError({ message }: { message: string }) { return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}><Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Account state unavailable</Text><Text>{message}</Text></View>; }

export function RootNavigator() {
  const { loading, firebaseUser, profile, profileError } = useAuth();
  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;
  return <NavigationContainer linking={getLinking()}><RootStack.Navigator>
    {!firebaseUser ? <RootStack.Group><RootStack.Screen name="Login" component={LoginScreen} /><RootStack.Screen name="RegisterChoice" component={RegisterChoiceScreen} /><RootStack.Screen name="StudentRegister" component={StudentRegisterScreen} /><RootStack.Screen name="AlumniVerify" component={AlumniVerifyScreen} /><RootStack.Screen name="AlumniPending" component={AlumniEmailLinkPendingScreen} /><RootStack.Screen name="BusinessRegister" component={BusinessRegisterScreen} /></RootStack.Group>
      : !profile ? <RootStack.Screen name="AccountProvisioning">{() => <AccountProvisioningScreen error={profileError} />}</RootStack.Screen>
      : profile.role === 'business' && !profile.isApproved ? <RootStack.Screen name="PendingApproval" component={PendingApprovalScreen} />
      : profile.role !== 'administrator' && profile.onboardingComplete !== true ? <RootStack.Screen name="Onboarding">{() => <OnboardingScreen onComplete={() => undefined} />}</RootStack.Screen>
      : profile.role === 'student' ? <RootStack.Screen name="StudentShell">{() => <RoleTabs dashboard={StudentDashboard} />}</RootStack.Screen>
      : profile.role === 'alumni' ? <RootStack.Screen name="AlumniShell" component={AlumniRoleTabs} />
      : profile.role === 'business' && profile.isApproved ? <RootStack.Screen name="BusinessShell" component={BusinessRoleTabs} />
      : profile.role === 'administrator' ? <RootStack.Screen name="AdminShell" component={AdminRoleTabs} />
      : <RootStack.Screen name="AccountProvisioning">{() => <BootstrapError message="Your account has an unsupported role. Contact a Richfield administrator." />}</RootStack.Screen>}
  </RootStack.Navigator></NavigationContainer>;
}
