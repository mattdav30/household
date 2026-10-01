import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { api, changes } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPush(): Promise<string | null> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Household updates',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#1F6F5C',
    });
  }
  if (!Device.isDevice) return null;
  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return null;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;
  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await api('/api/push', { method: 'POST', body: { token } });
    return token;
  } catch {
    return null;
  }
}

/** When a push arrives while the app is open, refresh the matching list straight away. */
export function listenForChanges() {
  const sub = Notifications.addNotificationReceivedListener((n) => {
    const table = (n.request.content.data as { table?: string } | undefined)?.table;
    changes.emit(table);
  });
  return () => sub.remove();
}
