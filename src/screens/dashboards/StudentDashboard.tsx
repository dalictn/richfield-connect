import React from 'react';
import { Button, Text, View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { StudentAnalyticsScreen } from '../analytics/StudentAnalyticsScreen';
export function StudentDashboard() { const { logout, profile } = useAuth(); return <View style={{ flex: 1 }}><StudentAnalyticsScreen /><View style={{ padding: 16 }}><Text style={{ marginBottom: 8 }}>Signed in as {profile?.displayName ?? 'Student'}</Text><Button title="Sign out" onPress={logout} /></View></View>; }
