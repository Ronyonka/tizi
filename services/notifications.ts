import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const isAndroidExpoGo = Platform.OS === 'android' && isExpoGo;

// ─── Setup ──────────────────────────────────────────────────────────────────

/**
 * For Android Expo Go SDK 53+, we must skip notifications entirely to prevent crashes.
 * On other platforms/environments, we use dynamic imports to ensure the SDK is only 
 * loaded when safe.
 */
async function initializeNotificationHandler() {
  if (isAndroidExpoGo) {
    console.warn('[Notifications] Skipping setNotificationHandler on Android Expo Go.');
    return;
  }

  try {
    const Notifications = await import('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (error) {
    console.warn('[Notifications] setNotificationHandler failed:', error);
  }
}

// Initialized on load if not on Android Expo Go
if (!isAndroidExpoGo) {
  initializeNotificationHandler();
}

export const NotificationService = {
  async requestPermissions(): Promise<boolean> {
    if (isAndroidExpoGo) {
      console.warn('[Notifications] Permissions requested on Android Expo Go. Not supported.');
      return false;
    }
    
    try {
      const Notifications = await import('expo-notifications');
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      return finalStatus === 'granted';
    } catch (error) {
      console.error('[Notifications] Failed to request permissions:', error);
      return false;
    }
  },

  async scheduleWorkoutReminder(time: string, routines: { name: string; day_of_week: string }[]) {
    if (isAndroidExpoGo) {
      console.warn('[Notifications] Scheduling skipped on Android Expo Go.');
      return;
    }

    try {
      const Notifications = await import('expo-notifications');
      await Notifications.cancelAllScheduledNotificationsAsync();

      const [hours, minutes] = time.split(':').map(Number);

      const dayMap: Record<string, number> = {
        'Sunday': 1, 'Monday': 2, 'Tuesday': 3, 'Wednesday': 4,
        'Thursday': 5, 'Friday': 6, 'Saturday': 7,
      };

      for (const routine of routines) {
        const weekday = dayMap[routine.day_of_week];
        if (!weekday) continue;

        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Workout Time! 🏋️‍♂️',
            body: `Time for your "${routine.name}" workout.`,
            data: { routineName: routine.name },
          },
          trigger: {
            weekday,
            hour: hours,
            minute: minutes,
            repeats: true,
          } as any, // Use any to avoid issues with trigger type on different SDK versions
        });
      }
    } catch (error) {
      console.error('[Notifications] Failed to schedule reminders:', error);
    }
  },

  async cancelAll() {
    if (isAndroidExpoGo) return;
    
    try {
      const Notifications = await import('expo-notifications');
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('[Notifications] Failed to cancel notifications:', error);
    }
  },
};
