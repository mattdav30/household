import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider, useSession } from '../lib/session';
import { listenForChanges, registerForPush } from '../lib/push';
import { C, MODE } from '../lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function Gate() {
  const { ready, profile } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync().catch(() => undefined);
    const onLogin = segments[0] === 'login';
    if (!profile && !onLogin) router.replace('/login');
    if (profile && onLogin) router.replace('/');
  }, [ready, profile, segments, router]);

  // Once signed in: register this phone for push, refresh lists when pushes arrive,
  // and open the right screen when a notification is tapped.
  useEffect(() => {
    if (!profile) return;
    registerForPush();
    const off = listenForChanges();
    const tapSub = Notifications.addNotificationResponseReceivedListener((r) => {
      const data = r.notification.request.content.data as { table?: string; screen?: string } | undefined;
      const route: Record<string, string> = {
        shopping_items: '/shopping', pantry_items: '/shopping', meals: '/meals', events: '/calendar', chores: '/chores', bills: '/bills', wishes: '/lists',
      };
      const target = data?.table ? route[data.table] : '/';
      if (target) router.push(target as never);
    });
    return () => { off(); tapSub.remove(); };
  }, [profile, router]);

  // Hold the screens back until the saved sign in loads, so no screen fetches without a token.
  if (!ready) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" options={{ animation: 'fade' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style={MODE === 'dark' ? 'light' : 'dark'} />
        <Gate />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
