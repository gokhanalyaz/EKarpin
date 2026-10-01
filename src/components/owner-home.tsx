import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { getAnyOpenShift, type Shift } from '@/lib/shifts';
import { listVehicleDrivers } from '@/lib/vehicle-drivers';
import { listOwnerVehicles, type Vehicle } from '@/lib/vehicles';

type StatusInfo = { open: boolean; driverName?: string };

export function OwnerHome() {
  const { profile, signOut } = useAuth();
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
          if (!open) return [v.id, { open: false }] as const;
          const drivers = await listVehicleDrivers(v.id).catch(() => []);
          const driverName = drivers.find((d) => d.driver_id === open.driver_id)?.driver?.full_name;
          return [v.id, { open: true, driverName: driverName ?? undefined }] as const;
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
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="subtitle">Araçlarım</ThemedText>
        <Pressable onPress={signOut}>
          <ThemedText type="linkPrimary">Çıkış</ThemedText>
        </Pressable>
      </ThemedView>

      <Pressable style={styles.historyLink} onPress={() => router.push('/history')}>
        <ThemedText type="linkPrimary">📋 Tüm Karpinleri Filtrele</ThemedText>
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
              Henüz araç eklemedin. Aşağıdaki butonla ilk aracını ekle.
            </ThemedText>
          }
          renderItem={({ item }) => {
            const s = status[item.id];
            return (
              <Pressable onPress={() => router.push(`/vehicle/${item.id}`)}>
                <ThemedView type="backgroundElement" style={styles.card}>
                  <ThemedText type="smallBold">{item.plate_no}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.payment_model === 'percentage'
                      ? `Yüzdelik sistem (%${item.percentage_rate ?? 25})`
                      : `Km sistemi (${item.km_rate ?? '-'} TL/km)`}
                  </ThemedText>
                  <ThemedText type="small" themeColor={s?.open ? undefined : 'textSecondary'}>
                    {s?.open
                      ? `Vardiya açık${s.driverName ? ` — ${s.driverName}` : ''}`
                      : 'Vardiya kapalı'}
                  </ThemedText>
                </ThemedView>
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
  addButton: {
    backgroundColor: Brand.primary,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  addButtonPressed: { opacity: 0.7 },
  addButtonText: { color: Brand.onPrimary, fontWeight: '700', fontSize: 16 },
});
