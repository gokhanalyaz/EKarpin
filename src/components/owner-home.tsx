import { router, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VehicleCard } from '@/components/vehicle-card';
import { Brand, FontFamily, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { getAnyOpenShift, getLastClosedShift, type Shift } from '@/lib/shifts';
import { listOwnerVehicleAlerts } from '@/lib/vehicle-alerts';
import { listVehicleDrivers } from '@/lib/vehicle-drivers';
import { listMaintenanceReminders } from '@/lib/vehicle-maintenance';
import { listOwnerVehicles, type Vehicle } from '@/lib/vehicles';

type StatusInfo = { open: boolean; driverName?: string; cornerLabel?: string; cornerIso?: string | null };

export function OwnerHome() {
  const { profile } = useAuth();
  const theme = useTheme();
  const [notificationCount, setNotificationCount] = useState(0);
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

      // Zil simgesindeki sayı: şoför bildirimleri + sırası gelen bakımlar.
      // Ana listeyi bekletmemek için arka planda hesaplanıyor.
      Promise.all([
        listOwnerVehicleAlerts(data.map((v) => v.id)).catch(() => []),
        listMaintenanceReminders(data).catch(() => []),
      ]).then(([alerts, reminders]) => setNotificationCount(alerts.length + reminders.length));

      const entries = await Promise.all(
        data.map(async (v) => {
          const open: Shift | null = await getAnyOpenShift(v.id).catch(() => null);
          if (open) {
            const drivers = await listVehicleDrivers(v.id).catch(() => []);
            const driverName = drivers.find((d) => d.driver_id === open.driver_id)?.driver?.full_name;
            return [
              v.id,
              { open: true, driverName: driverName ?? undefined, cornerLabel: 'Açılış', cornerIso: open.opened_at },
            ] as const;
          }
          // Vardiya kapaliysa, acilis yerine bu aracin en son kapandigi saati not olarak gosterelim.
          const lastClosed = await getLastClosedShift(v.id).catch(() => null);
          return [
            v.id,
            { open: false, cornerLabel: lastClosed ? 'Kapanış' : undefined, cornerIso: lastClosed?.closed_at ?? null },
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
    <ThemedView style={styles.container}>
      <ThemedView style={styles.headerRow}>
        <ThemedView style={styles.bellButton} />
        <ThemedText type="title" style={styles.header}>
          Araçlarım
        </ThemedText>
        <Pressable
          hitSlop={12}
          onPress={() => router.push('/notifications')}
          style={({ pressed }) => [styles.bellButton, pressed && styles.addButtonPressed]}
          accessibilityLabel="Bildirimler">
          <SymbolView name="bell" size={24} tintColor={theme.text} />
          {notificationCount > 0 && (
            <ThemedView style={styles.badge}>
              <ThemedText style={styles.badgeText}>{notificationCount > 99 ? '99+' : notificationCount}</ThemedText>
            </ThemedView>
          )}
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
                  statusActive={s?.open}
                  statusLabel={s?.open ? 'Vardiya Açık' : 'Vardiya Kapalı'}
                  subLabel={s?.open ? s.driverName : undefined}
                  subLabelBold
                  cornerTimeLabel={s?.cornerLabel}
                  cornerTimeIso={s?.cornerIso}
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
    paddingBottom: Spacing.four,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.two,
    marginBottom: Spacing.five,
    backgroundColor: 'transparent',
  },
  header: { flex: 1, textAlign: 'center' },
  bellButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 11, lineHeight: 13, fontFamily: FontFamily.bodyBold },
  loading: { marginTop: Spacing.four },
  list: { gap: Spacing.four, paddingBottom: Spacing.four, flexGrow: 1, justifyContent: 'center' },
  empty: { textAlign: 'center', marginTop: Spacing.five },
  addButton: {
    backgroundColor: Brand.primary,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  addButtonPressed: { opacity: 0.7 },
  addButtonText: { color: Brand.onPrimary, fontFamily: FontFamily.bodyBold, fontSize: 16 },
});
