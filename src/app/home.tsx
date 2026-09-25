import { Redirect } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { DriverHome } from '@/components/driver-home';
import { OwnerHome } from '@/components/owner-home';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth-context';

export default function HomeScreen() {
  const { session, profile, loading } = useAuth();

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
