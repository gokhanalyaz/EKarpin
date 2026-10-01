import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AuthProvider } from '@/contexts/auth-context';
import { resolveNotificationRoute } from '@/lib/notification-routing';
import { setPendingNotificationTarget } from '@/lib/pending-notification';

SplashScreen.preventAutoHideAsync();

/** Bir bildirime dokunuldugunda (uygulama ZATEN acikken/arka plandayken), dogru ekrana yonlendirir. */
function handleNotificationData(data: Record<string, unknown> | undefined) {
  const target = resolveNotificationRoute(data);
  if (target) router.push(target as any);
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    // Uygulama kapaliyken bir bildirime dokunularak acildiysa (cold start):
    // henuz oturum/navigasyon hazir olmadigi icin hemen router.push YAPMIYORUZ
    // (index.tsx'in /home yonlendirmesiyle yarisip kaybediyordu). Hedefi
    // bekletiyoruz, index.tsx oturumu dogrulayinca bunu okuyup oraya gidiyor.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        const target = resolveNotificationRoute(
          response.notification.request.content.data as Record<string, unknown>
        );
        if (target) setPendingNotificationTarget(target);
      }
    });

    // Uygulama acikken/arka plandayken bir bildirime dokunulursa (navigasyon
    // zaten hazir, dogrudan yonlendirebiliriz).
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationData(response.notification.request.content.data as Record<string, unknown>);
    });

    return () => subscription.remove();
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </ThemeProvider>
  );
}
