import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermissions() {
  const settings = await Notifications.getPermissionsAsync();

  if (settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });

  return (
    requested.granted ||
    requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

export async function configureNotificationChannel() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  });
}

export async function registerForPushToken() {
  const granted = await ensureNotificationPermissions();
  if (!granted) return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (!projectId) {
    console.warn('Missing EAS projectId for push token registration.');
    return null;
  }

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return token.data;
}

function combineDateAndHour(dateYmd: string, hour: number, minute = 0) {
  const date = new Date(`${dateYmd}T12:00:00`);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function isFuture(date: Date) {
  return date.getTime() > Date.now();
}

export async function scheduleTaskDueReminder(params: {
  taskId: string;
  title: string;
  dueDate: string | null;
}) {
  const { taskId, title, dueDate } = params;
  if (!dueDate) return null;

  const granted = await ensureNotificationPermissions();
  if (!granted) return null;

  const triggerDate = new Date(Date.now() + 60 * 1000);

  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Task due today',
      body: title,
      data: {
        type: 'task_due',
        taskId,
      },
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
      channelId: 'default',
    },
  });
}

export async function scheduleTaskOverdueReminder(params: {
  taskId: string;
  title: string;
  dueDate: string | null;
}) {
  const { taskId, title, dueDate } = params;
  if (!dueDate) return null;

  const granted = await ensureNotificationPermissions();
  if (!granted) return null;

  const triggerDate = new Date(Date.now() + 60 * 1000);

  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Task overdue',
      body: title,
      data: {
        type: 'task_overdue',
        taskId,
      },
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
      channelId: 'default',
    },
  });
}

export async function scheduleServiceReceiptReminder(params: {
  serviceRecordId: string;
  serviceTitle: string;
  serviceDate: string | null;
}) {
  const { serviceRecordId, serviceTitle, serviceDate } = params;
  if (!serviceDate) return null;

  const granted = await ensureNotificationPermissions();
  if (!granted) return null;

  const triggerDate = new Date(Date.now() + 60 * 1000);

  if (!isFuture(triggerDate)) return null;

  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Upload receipt or document',
      body: `Upload receipt, invoice, or warranty for ${serviceTitle}.`,
      data: {
        type: 'service_receipt',
        serviceRecordId,
      },
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
      channelId: 'default',
    },
  });
}

export async function cancelScheduledNotification(
  notificationId: string | null | undefined
) {
  if (!notificationId) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}