import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import { Archivo_800ExtraBold, Archivo_900Black } from '@expo-google-fonts/archivo';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AuthProvider } from '@/contexts/auth-context';
import { resolveNotificationRoute } from '@/lib/notification-routing';

SplashScreen.preventAutoHideAsync();

/** Bir bildirime dokunuldugunda (uygulama ZATEN acikken/arka plandayken), dogru ekrana yonlendirir. */
function handleNotificationData(data: Record<string, unknown> | undefined) {
  const target = resolveNotificationRoute(data);
  if (target) router.push(target as any);
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  // Ozel yazi tipleri (basliklar icin Archivo, govde metni icin Inter)
  // yuklenene kadar acilis ekranini acik tutuyoruz; aksi halde once
  // sistem fontuyla bir an goruntulenip sonra degisirdi (goz tirmalayici).
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Archivo_800ExtraBold,
    Archivo_900Black,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    // Uygulama kapaliyken bir bildirime dokunularak acildiysa (cold start),
    // o kontrol index.tsx tarafinda, oturum/yonlendirme kararina DAHIL
    // edilerek yapiliyor (burada yapilsa, henuz navigasyon hazir olmadan
    // push etmis olurduk ve index.tsx'in /home yonlendirmesi bunun ustune
    // yazardi). Burada sadece uygulama ZATEN acikken/arka plandayken
    // dokunulan bildirimleri dinliyoruz; o durumda navigasyon zaten hazir.
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationData(response.notification.request.content.data as Record<string, unknown>);
    });

    return () => subscription.remove();
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </ThemeProvider>
  );
}
