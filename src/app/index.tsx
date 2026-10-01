import { Redirect } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth-context';
import { resolveNotificationRoute } from '@/lib/notification-routing';

export default function Index() {
  const { session, profile, loading } = useAuth();
  const [notifChecked, setNotifChecked] = useState(false);
  const [notifTarget, setNotifTarget] = useState<string | null>(null);

  useEffect(() => {
    // Uygulama tamamen kapaliyken bir bildirime dokunularak acildiysa, hangi
    // ekrana gidilecegini ONCEDEN bilmemiz lazim - yoksa asagida /home'a
    // yonlendirip, bu kontrol gec gelince de onun ustune yazmis oluruz
    // (bu yuzden asil yonlendirme karari bu kontrol bitene kadar bekliyor).
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        const target = resolveNotificationRoute(
          response?.notification.request.content.data as Record<string, unknown> | undefined
        );
        setNotifTarget(target);
        // Ayni "son bildirim" bir dahaki acilista tekrar kullanilmasin diye temizle.
        if (response) {
          Notifications.clearLastNotificationResponseAsync().catch(() => {});
        }
      })
      .catch(() => setNotifTarget(null))
      .finally(() => setNotifChecked(true));
  }, []);

  if (loading || (session && !profile) || !notifChecked) {
    return (
      <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  return <Redirect href={(notifTarget ?? '/home') as any} />;
}
