import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabBar } from '@/components/bottom-tab-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VehicleCard } from '@/components/vehicle-card';
import { Brand, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { getAnyOpenShift, getLastClosedShift, type Shift } from '@/lib/shifts';
import { listVehicleDrivers } from '@/lib/vehicle-drivers';
import { listOwnerVehicles, type Vehicle } from '@/lib/vehicles';

type StatusInfo = {
  open: boolean;
  driverName?: string;
  cornerTimeLabel?: 'Açılış' | 'Kapanış';
  cornerTimeIso?: string;
};

export function OwnerHome() {
  const { profile, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [status, setStatus] = useState<Record<string, StatusInfo>>({});
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);

  const loadVehicles = useCallback(async () => {
    if (!profile) return;
    if (!hasLoadedRef.current) setLoading(true);
    try {
      const data = await listOwnerVehicles(profile.id);
      setVehicles(data);

      const entries = await Promise.all(
        data.map(async (v) => {
          const open: Shift | null = await getAnyOpenShift(v.id).catch(() => null);
          const drivers = await listVehicleDrivers(v.id).catch(() => []);
          if (open) {
            const driverName = drivers.find((d) => d.driver_id === open.driver_id)?.driver?.full_name;
            return [
              v.id,
              { open: true, driverName: driverName ?? undefined, cornerTimeLabel: 'Açılış' as const, cornerTimeIso: open.opened_at },
            ] as const;
          }
          const lastClosed: Shift | null = await getLastClosedShift(v.id).catch(() => null);
          if (!lastClosed) return [v.id, { open: false }] as const;
          const driverName = drivers.find((d) => d.driver_id === lastClosed.driver_id)?.driver?.full_name;
          return [
            v.id,
            {
              open: false,
              driverName: driverName ?? undefined,
              cornerTimeLabel: 'Kapanış' as const,
              cornerTimeIso: lastClosed.closed_at ?? undefined,
            },
          ] as const;
        })
      );
      setStatus(Object.fromEntries(entries));
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
    <ThemedView style={styles.root}>
      <ThemedView style={[styles.container, { paddingTop: insets.top + Spacing.four }]}>
      <ThemedView style={styles.header}>
        <ThemedText type="subtitle">Araçlarım</ThemedText>
        <Pressable onPress={signOut}>
          <ThemedText type="linkPrimary">Çıkış</ThemedText>
        </Pressable>
      </ThemedView>

      {loading ? (
        <ActivityIndicator style={styles.loading} />
      ) : (
        <FlatList
          data={vehicles}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
              Henüz araç eklemedin. Aşağıdaki butonla ilk aracını ekle.
            </ThemedText>
          }
          renderItem={({ item }) => {
            const s = status[item.id];
            return (
              <Pressable onPress={() => router.push(`/vehicle/${item.id}`)}>
                <VehicleCard
                  vehicle={item}
                  statusLabel={s?.open ? 'Vardiya Açık' : 'Vardiya Kapalı'}
                  statusActive={s?.open}
                  subLabel={s?.driverName}
                  cornerTimeLabel={s?.cornerTimeLabel}
                  cornerTimeIso={s?.cornerTimeIso}
                />
              </Pressable>
            );
          }}
        />
      )}

      <Pressable
        style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
        onPress={() => router.push('/add-vehicle')}>
        <ThemedText style={styles.addButtonText}>+ Araç Ekle</ThemedText>
      </Pressable>
      </ThemedView>
      <BottomTabBar current="home" />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.four,
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
  addButton: {
    backgroundColor: Brand.primary,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  addButtonPressed: { opacity: 0.7 },
  addButtonText: { color: Brand.onPrimary, fontWeight: '700', fontSize: 16 },
});
