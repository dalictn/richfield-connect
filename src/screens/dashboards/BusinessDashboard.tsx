import React from 'react';
import { Button, Text, View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { BusinessAnalyticsScreen } from '../analytics/BusinessAnalyticsScreen';
export function BusinessDashboard() { const { logout, profile } = useAuth(); return <View style={{ flex: 1 }}><BusinessAnalyticsScreen /><View style={{ padding: 16 }}><Text style={{ marginBottom: 8 }}>{profile?.companyName ?? 'Business account'}</Text><Button title="Sign out" onPress={logout} /></View></View>; }
