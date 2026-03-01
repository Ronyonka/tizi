import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const NotificationService = {
  async requestPermissions(): Promise<boolean> {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  },

  async scheduleWorkoutReminder(time: string, routines: { name: string; day_of_week: string }[]) {
    await Notifications.cancelAllScheduledNotificationsAsync();

    const [hours, minutes] = time.split(':').map(Number);

    // Day mapping: Routines use "Monday", "Tuesday", etc.
    // Expo Notifications use 1 (Sunday) to 7 (Saturday) or weekday: number (1 is Sunday?)
    // Actually Expo CalendarTrigger uses weekday 1=Sunday, 2=Monday...
    const dayMap: Record<string, number> = {
      'Sunday': 1,
      'Monday': 2,
      'Tuesday': 3,
      'Wednesday': 4,
      'Thursday': 5,
      'Friday': 6,
      'Saturday': 7,
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
        } as Notifications.NotificationTriggerInput,
      });
    }
  },

  async cancelAll() {
    await Notifications.cancelAllScheduledNotificationsAsync();
  },
};
