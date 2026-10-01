import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VehicleCard } from '@/components/vehicle-card';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { getAnyOpenShift, getLastClosedShiftForDriver, type Shift } from '@/lib/shifts';
import { listAssignedVehicles, type Vehicle } from '@/lib/vehicles';

export function DriverHome() {
  const { profile } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  type CardStatus = { shift: Shift | null; cornerLabel?: string; cornerIso?: string | null };
  const [cardStatus, setCardStatus] = useState<Record<string, CardStatus>>({});
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
          const mine = open?.driver_id === profile.id ? open : null;
          if (mine) {
            return [v.id, { shift: mine, cornerLabel: 'Açılış', cornerIso: mine.opened_at }] as const;
          }
          // Vardiya kapaliysa, acilis yerine bu soforun bu aracta en son kapattigi saati gosterelim.
          const lastClosed = await getLastClosedShiftForDriver(v.id, profile.id).catch(() => null);
          return [
            v.id,
            { shift: null, cornerLabel: lastClosed ? 'Kapanış' : undefined, cornerIso: lastClosed?.closed_at ?? null },
          ] as const;
        })
      );
      setCardStatus(Object.fromEntries(statuses));
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
            const st = cardStatus[item.id];
            const open = st?.shift;
            return (
              <Pressable onPress={() => router.push(`/shift/${item.id}`)}>
                <VehicleCard
                  vehicle={item}
                  statusActive={!!open}
                  statusLabel={open ? 'Vardiyan Açık' : 'Vardiya Kapalı'}
                  subLabel={open ? 'Kapatmak için dokun' : 'Açmak için dokun'}
                  cornerTimeLabel={st?.cornerLabel}
                  cornerTimeIso={st?.cornerIso}
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
