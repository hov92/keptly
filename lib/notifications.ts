import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Href } from 'expo-router';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function configureNotificationChannel() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function ensureNotificationPermissions() {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted || existing.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return existing;
  }

  return Notifications.requestPermissionsAsync();
}

type NavigateFn = (href: Href) => void;

function getRouteFromNotificationData(data: Record<string, unknown> | undefined): Href | null {
  if (!data) return null;

  if (typeof data.taskId === 'string') {
    return {
      pathname: '/tasks/[id]',
      params: {
        id: data.taskId,
        returnTo: '/(tabs)/tasks',
      },
    } as Href;
  }

  if (typeof data.pantryItemId === 'string') {
    return {
      pathname: '/shopping/pantry/[id]',
      params: {
        id: data.pantryItemId,
        returnTo: '/shopping/pantry',
      },
    } as Href;
  }

  if (typeof data.templateId === 'string') {
    return {
      pathname: '/shopping/recurring/[id]',
      params: {
        id: data.templateId,
        returnTo: '/shopping/recurring',
      },
    } as Href;
  }

  return null;
}

export function setupNotificationRouting(navigate: NavigateFn) {
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const route = getRouteFromNotificationData(
        response.notification.request.content.data as Record<string, unknown>
      );

      if (route) {
        navigate(route);
      }
    }
  );

  return () => {
    subscription.remove();
  };
}

export async function handleInitialNotificationRoute(navigate: NavigateFn) {
  const response = await Notifications.getLastNotificationResponseAsync();
  if (!response) return;

  const route = getRouteFromNotificationData(
    response.notification.request.content.data as Record<string, unknown>
  );

  if (route) {
    navigate(route);
  }
}

export async function scheduleTaskDueReminder(params: {
  taskId: string;
  title: string;
  dueDate: string | null;
}) {
  if (!params.dueDate) return null;

  const date = new Date(params.dueDate);
  const triggerDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    9,
    0,
    0,
    0
  );

  if (triggerDate.getTime() <= Date.now()) return null;

  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Task due today',
      body: params.title,
      data: {
        type: 'task_due',
        taskId: params.taskId,
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });
}

export async function scheduleTaskOverdueReminder(params: {
  taskId: string;
  title: string;
  dueDate: string | null;
}) {
  if (!params.dueDate) return null;

  const date = new Date(params.dueDate);
  const triggerDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    18,
    0,
    0,
    0
  );

  if (triggerDate.getTime() <= Date.now()) return null;

  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Task overdue',
      body: `${params.title} still needs attention.`,
      data: {
        type: 'task_overdue',
        taskId: params.taskId,
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });
}