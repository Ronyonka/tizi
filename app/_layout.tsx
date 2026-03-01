import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

export default function RootLayout() {
  useEffect(() => {
    // Test Google Sheets connection on app launch (server-side via API route)
    fetch('/api/test-sheets')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          console.log('[App] Google Sheets:', data.message);
        } else {
          console.warn('[App] Google Sheets connection issue:', data.message);
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

