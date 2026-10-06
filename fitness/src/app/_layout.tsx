import { useEffect } from 'react';
import { AppState } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider, useSession } from '../lib/session';
import { StoreProvider, useStore } from '../lib/store';
import { refreshWidgetSoon } from '../widget/refresh';
import { UpdateBanner } from '../components/UpdateBanner';
import { C, MODE } from '../lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function Gate() {
  const { ready, profile } = useSession();
  const { refresh } = useStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync().catch(() => undefined);
    const onLogin = segments[0] === 'login';
    if (!profile && !onLogin) router.replace('/login');
    if (profile && onLogin) router.replace('/');
  }, [ready, profile, segments, router]);

  useEffect(() => {
    if (!profile) return;
    const appSub = AppState.addEventListener('change', (st) => {
      if (st === 'active') refresh();
      if (st === 'background') refreshWidgetSoon(0);
    });
    const tapSub = Notifications.addNotificationResponseReceivedListener((r) => {
      const screen = (r.notification.request.content.data as { screen?: string } | undefined)?.screen;
      if (screen && screen !== '/') router.push(screen as never);
    });
    return () => { appSub.remove(); tapSub.remove(); };
  }, [profile, router, refresh]);

  if (!ready) return null;
  return (
    <>
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" options={{ animation: 'fade' }} />
      <Stack.Screen name="session" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="camera" options={{ animation: 'fade' }} />
    </Stack>
    {profile ? <UpdateBanner /> : null}
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StoreProvider>
          <StatusBar style={MODE === 'dark' ? 'light' : 'dark'} />
          <Gate />
        </StoreProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
