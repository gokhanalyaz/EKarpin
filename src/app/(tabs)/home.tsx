import { Redirect, router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator } from 'react-native';

import { DriverHome } from '@/components/driver-home';
import { OwnerHome } from '@/components/owner-home';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth-context';
import { consumePendingNotificationRoute } from '@/lib/notification-routing';

export default function HomeScreen() {
  const { session, profile, loading } = useAuth();

  // Uygulama bir bildirime dokunularak açıldıysa, hedef ekranı ana sayfanın üstüne aç.
  useEffect(() => {
    if (!profile) return;
    const target = consumePendingNotificationRoute();
    if (target) setTimeout(() => router.push(target as any), 0);
  }, [profile]);

  if (!loading && !session) {
    return <Redirect href="/login" />;
  }

  if (!profile) {
    return (
      <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  return profile.role === 'owner' ? <OwnerHome /> : <DriverHome />;
}
