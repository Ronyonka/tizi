import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { testConnection } from '@/services/firestore';

export default function RootLayout() {
  useEffect(() => {
    // Test Firestore connection on app launch
    testConnection()
      .then(() => {
        console.log('[App] Successfully connected to Firestore on app launch.');
      })
      .catch((err) => {
        console.error('[App] Firestore connection issue:', err.message);
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

