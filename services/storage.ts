import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  NOTIFICATIONS_ENABLED: 'tizi_notifications_enabled',
  REMINDER_TIME: 'tizi_reminder_time',
  SPREADSHEET_ID: 'tizi_spreadsheet_id',
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

  async getSpreadsheetId(): Promise<string | null> {
    return await AsyncStorage.getItem(KEYS.SPREADSHEET_ID);
  },

  async setSpreadsheetId(id: string | null): Promise<void> {
    if (id === null) {
      await AsyncStorage.removeItem(KEYS.SPREADSHEET_ID);
    } else {
      await AsyncStorage.setItem(KEYS.SPREADSHEET_ID, id);
    }
  },
};
