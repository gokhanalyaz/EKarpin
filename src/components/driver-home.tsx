import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VehicleCard } from '@/components/vehicle-card';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { getAnyOpenShift, type Shift } from '@/lib/shifts';
import { listAssignedVehicles, type Vehicle } from '@/lib/vehicles';

export function DriverHome() {
  const { profile } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [openShiftByMe, setOpenShiftByMe] = useState<Record<string, Shift | null>>({});
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);

  const loadVehicles = useCallback(async () => {
    if (!profile) return;
    if (!hasLoadedRef.current) setLoading(true);
    try {
      const data = await listAssignedVehicles(profile.id);
      setVehicles(data);
      const statuses = await Promise.all(
        data.map(async (v) => {
          const open = await getAnyOpenShift(v.id).catch(() => null);
          return [v.id, open?.driver_id === profile.id ? open : null] as const;
        })
      );
      setOpenShiftByMe(Object.fromEntries(statuses));
    } catch (e) {
      console.warn('Araçlar yüklenemedi', e);
    } finally {
      setLoading(false);
      hasLoadedRef.current = true;
    }
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      loadVehicles();
    }, [loadVehicles])
  );

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.header}>
        Araçlarım
      </ThemedText>

      {loading ? (
        <ActivityIndicator style={styles.loading} />
      ) : (
        <FlatList
          data={vehicles}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
              Henüz hiçbir araca atanmadın. Araç sahibinin seni eklemesini bekle.
            </ThemedText>
          }
          renderItem={({ item }) => {
            const open = openShiftByMe[item.id];
            return (
              <Pressable onPress={() => router.push(`/shift/${item.id}`)}>
                <VehicleCard
                  vehicle={item}
                  statusActive={!!open}
                  statusLabel={open ? 'Vardiyan Açık' : 'Vardiya Kapalı'}
                  subLabel={open ? 'Kapatmak için dokun' : 'Açmak için dokun'}
                  openedAt={open?.opened_at}
                />
              </Pressable>
            );
          }}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
    paddingBottom: Spacing.four,
  },
  header: { textAlign: 'center', marginTop: Spacing.two, marginBottom: Spacing.five },
  loading: { marginTop: Spacing.four },
  list: { gap: Spacing.four, paddingBottom: Spacing.four, flexGrow: 1, justifyContent: 'center' },
  empty: { textAlign: 'center', marginTop: Spacing.five },
});
