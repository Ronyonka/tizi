import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';

import { Colors } from '@/constants/theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_SCREENS: {
  name: string;
  title: string;
  icon: IoniconsName;
  iconActive: IoniconsName;
}[] = [
  {
    name: 'index',
    title: 'Home',
    icon: 'home-outline',
    iconActive: 'home',
  },
  {
    name: 'workouts',
    title: 'Workouts',
    icon: 'barbell-outline',
    iconActive: 'barbell',
  },
  {
    name: 'calendar',
    title: 'Calendar',
    icon: 'calendar-outline',
    iconActive: 'calendar',
  },
  {
    name: 'progress',
    title: 'Progress',
    icon: 'trending-up-outline',
    iconActive: 'trending-up',
  },
  {
    name: 'settings',
    title: 'Settings',
    icon: 'settings-outline',
    iconActive: 'settings',
  },
];

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.tabBar,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 10,
          paddingTop: 6,
        },
        tabBarActiveTintColor: Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.3,
        },
      }}
    >
      {TAB_SCREENS.map(({ name, title, icon, iconActive }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? iconActive : icon}
                size={24}
                color={color}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
