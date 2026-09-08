import React, { useEffect, useState } from 'react';
import { Linking, ActivityIndicator, Text, View } from 'react-native';
import { AuthProvider } from './auth/AuthProvider';
import { RootNavigator } from './navigation/RootNavigator';
import { handleIncomingAlumniEmailLink } from './auth/authService';
import { initializeRichfieldAppCheck } from './firebaseAppCheck';
import { registerForNotifications, subscribeTokenRefresh } from './notifications/notificationService';

export default function App() {
  const [ready, setReady] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        await initializeRichfieldAppCheck();

        const handle = async (event: { url: string }) => {
          try {
            await handleIncomingAlumniEmailLink(event.url);
          } catch (error) {
            console.error('Email-link handling failed', error);
          }
        };

        const subscription = Linking.addEventListener('url', handle);
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) await handle({ url: initialUrl });

        if (mounted) setReady(true);
        return () => subscription.remove();
      } catch (error) {
        console.error('Application bootstrap failed', error);
        if (mounted) {
          setBootstrapError(error instanceof Error ? error.message : 'Unable to initialise the application.');
        }
        return undefined;
      }
    };

    let cleanup: (() => void) | undefined;
    void bootstrap().then((dispose) => {
      cleanup = dispose;
    });

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    void registerForNotifications().catch((error) => console.warn('Push notification registration unavailable', error));
    const unsubscribe = subscribeTokenRefresh();
    return unsubscribe;
  }, [ready]);

  if (bootstrapError) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 12 }}>Richfield Connect could not start</Text>
        <Text>{bootstrapError}</Text>
      </View>
    );
  }

  if (!ready) {
    return <ActivityIndicator style={{ flex: 1 }} size="large" />;
  }

  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
