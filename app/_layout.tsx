import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

function getBaseUrl(): string {
  if (typeof window !== 'undefined') return '';
  const debuggerHost =
    Constants.expoGoConfig?.debuggerHost ??
    (Constants.manifest as { debuggerHost?: string } | null)?.debuggerHost;
  const host = debuggerHost?.split(':')[0] ?? 'localhost';
  return `http://${host}:8081`;
}

export default function RootLayout() {
  useEffect(() => {
    // Test Google Sheets connection on app launch (server-side via API route)
    fetch(`${getBaseUrl()}/api/test-sheets`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          console.log('[App] Firestore:', data.message);
        } else {
          console.warn('[App] Firestore connection issue:', data.message);
        }
      })
      .catch((err) => {
        console.error('[App] Could not reach /api/test-sheets:', err.message);
      });
  }, []);

  return (
    <ThemeProvider value={DarkTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="light" />
    </ThemeProvider>
  );
}

