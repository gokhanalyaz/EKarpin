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
  const { profile, signOut } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [openByMe, setOpenByMe] = useState<Record<string, boolean>>({});
  const [cornerInfo, setCornerInfo] = useState<Record<string, { label: 'Açılış' | 'Kapanış'; iso: string } | undefined>>({});
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
          const open: Shift | null = await getAnyOpenShift(v.id).catch(() => null);
          const isMine = open?.driver_id === profile.id;
          if (isMine && open) {
            return [v.id, { isMine: true, corner: { label: 'Açılış' as const, iso: open.opened_at } }] as const;
          }
          const lastClosed = await getLastClosedShiftForDriver(v.id, profile.id).catch(() => null);
          const corner = lastClosed?.closed_at ? { label: 'Kapanış' as const, iso: lastClosed.closed_at } : undefined;
          return [v.id, { isMine: false, corner }] as const;
        })
      );
      setOpenByMe(Object.fromEntries(statuses.map(([id, s]) => [id, s.isMine])));
      setCornerInfo(Object.fromEntries(statuses.map(([id, s]) => [id, s.corner])));
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
      <ThemedView style={styles.header}>
        <ThemedText type="subtitle">Araçlarım</ThemedText>
        <Pressable onPress={signOut}>
          <ThemedText type="linkPrimary">Çıkış</ThemedText>
        </Pressable>
      </ThemedView>

      <Pressable style={styles.historyLink} onPress={() => router.push('/history')}>
        <ThemedText type="linkPrimary">📋 Karpinlerimi Filtrele</ThemedText>
      </Pressable>

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
            const corner = cornerInfo[item.id];
            return (
              <Pressable onPress={() => router.push(`/shift/${item.id}`)}>
                <VehicleCard
                  vehicle={item}
                  statusLabel={openByMe[item.id] ? 'Vardiyan Açık' : 'Vardiya Açmak İçin Dokun'}
                  statusActive={openByMe[item.id]}
                  subLabel={openByMe[item.id] ? 'Kapatmak için dokun' : undefined}
                  cornerTimeLabel={corner?.label}
                  cornerTimeIso={corner?.iso}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  historyLink: { marginBottom: Spacing.three },
  loading: { marginTop: Spacing.four },
  list: { gap: Spacing.two, paddingBottom: Spacing.four, flexGrow: 1 },
  empty: { textAlign: 'center', marginTop: Spacing.five },
  card: { padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.half },
});
