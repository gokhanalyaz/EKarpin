import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AuthProvider } from '@/contexts/auth-context';

SplashScreen.preventAutoHideAsync();

/** Bir bildirime dokunuldugunda, icindeki veriye gore dogru ekrana yonlendirir. */
function handleNotificationData(data: Record<string, unknown> | undefined) {
  if (!data) return;
  const type = data.type;
  if ((type === 'shift_opened' || type === 'shift_closed') && typeof data.shiftId === 'string') {
    router.push(`/shift-detail/${data.shiftId}`);
  } else if (type === 'vehicle_alert' && typeof data.vehicleId === 'string') {
    router.push(`/vehicle/${data.vehicleId}`);
  } else if (type === 'settlement_pending' && typeof data.vehicleId === 'string') {
    // Sofor teslim ettigini bildirdi - arac sahibi onaylasin diye arac
    // detay sayfasina goturuyoruz (orada teslim alinmayanlari isaretleyebilir).
    router.push(`/vehicle/${data.vehicleId}`);
  } else if (type === 'settlement_confirmed' && typeof data.vehicleId === 'string') {
    // Arac sahibi teslimi onayladi - sofore kendi vardiya ekranini gosteriyoruz.
    router.push(`/shift/${data.vehicleId}`);
  }
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    // Uygulama kapaliyken bir bildirime dokunularak acildiysa (cold start).
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        handleNotificationData(response.notification.request.content.data as Record<string, unknown>);
      }
    });

    // Uygulama acikken/arka plandayken bir bildirime dokunulursa.
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
