import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet } from 'react-native';

import { PhotoViewButton } from '@/components/photo-view-button';
import { formatDateTime } from '@/components/shift-history-list';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { listOwnerVehicleAlerts, type VehicleAlert } from '@/lib/vehicle-alerts';
import { listVehicleDrivers } from '@/lib/vehicle-drivers';
import { listOwnerVehicles, type Vehicle } from '@/lib/vehicles';

/** Arac sahibinin TUM araclarindan gelen "sofor bildirimlerini" tek listede
 * topladigi sekme (ör. "araç arızalı", "kaza oldu" gibi anlik uyarilar). */
export default function NotificationsScreen() {
  const { profile } = useAuth();
  const [alerts, setAlerts] = useState<VehicleAlert[]>([]);
  const [vehiclesById, setVehiclesById] = useState<Record<string, Vehicle>>({});
  const [driverNames, setDriverNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      const vehicles = await listOwnerVehicles(profile.id);
      setVehiclesById(Object.fromEntries(vehicles.map((v) => [v.id, v])));

      const vehicleIds = vehicles.map((v) => v.id);
      const [alertRows, driverRowsPerVehicle] = await Promise.all([
        listOwnerVehicleAlerts(vehicleIds),
        Promise.all(vehicleIds.map((vehicleId) => listVehicleDrivers(vehicleId).catch(() => []))),
      ]);
      setAlerts(alertRows);

      const map: Record<string, string> = {};
      driverRowsPerVehicle.flat().forEach((row) => {
        map[row.driver_id] = row.driver?.full_name ?? 'İsimsiz';
      });
      setDriverNames(map);
    } catch (e) {
      console.warn('Bildirimler yüklenemedi', e);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.header}>
        Bildirimler
      </ThemedText>
      <FlatList
        data={alerts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, alerts.length === 0 && styles.listEmpty]}
        ListEmptyComponent={
          <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
            Henüz bir bildirim yok. Şoförlerin "Araç Sahibine Bildir" ile gönderdiği uyarılar
            burada görünecek.
          </ThemedText>
        }
        renderItem={({ item }) => (
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="eyebrow" themeColor="textSecondary">
              {vehiclesById[item.vehicle_id]?.plate_no ?? 'Araç'}
            </ThemedText>
            <ThemedText type="smallBold">{driverNames[item.driver_id] ?? 'Şoför'}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatDateTime(item.created_at)}
            </ThemedText>
            <ThemedText type="small">{item.note}</ThemedText>
            {item.photo_url && <PhotoViewButton path={item.photo_url} label="Fotoğrafı Gör" />}
          </ThemedView>
        )}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, paddingHorizontal: Spacing.four, paddingTop: Spacing.six },
  header: { textAlign: 'center', marginBottom: Spacing.four },
  list: { gap: Spacing.three, paddingBottom: Spacing.six, flexGrow: 1 },
  listEmpty: { justifyContent: 'center' },
  empty: { textAlign: 'center' },
  card: { padding: Spacing.three, gap: Spacing.half, borderLeftWidth: 3, borderLeftColor: '#DC2626' },
});
