import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  NOTIFICATIONS_ENABLED: 'tizi_notifications_enabled',
  REMINDER_TIME: 'tizi_reminder_time',
};

export const Storage = {
  async getNotificationsEnabled(): Promise<boolean> {
    const val = await AsyncStorage.getItem(KEYS.NOTIFICATIONS_ENABLED);
    return val === null ? true : val === 'true';
  },

  async setNotificationsEnabled(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(KEYS.NOTIFICATIONS_ENABLED, String(enabled));
  },

  async getReminderTime(): Promise<string> {
    const val = await AsyncStorage.getItem(KEYS.REMINDER_TIME);
    return val ?? '08:00';
  },

  async setReminderTime(time: string): Promise<void> {
    await AsyncStorage.setItem(KEYS.REMINDER_TIME, time);
  },
};
