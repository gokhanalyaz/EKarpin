import { Redirect } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth-context';
import { consumePendingNotificationTarget } from '@/lib/pending-notification';

export default function Index() {
  const { session, profile, loading } = useAuth();
  // Uygulama bir bildirime dokunularak soguk baslangicla acildiysa, /home
  // yerine dogrudan o bildirimin hedefine gidilecek. Sadece bir kere (ilk
  // render'da) okunup tuketilir ki sonraki render'larda kaybolmasin/tekrar
  // tuketilmeye calisilmasin.
  const notificationTarget = useMemo(() => consumePendingNotificationTarget(), []);

  if (loading || (session && !profile)) {
    return (
      <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  return <Redirect href={(notificationTarget ?? '/home') as any} />;
}
