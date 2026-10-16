import { useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

import { PhotoViewButton } from '@/components/photo-view-button';
import { formatDateTime } from '@/components/shift-history-list';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { deleteVehicleAlert, listOwnerVehicleAlerts, type VehicleAlert } from '@/lib/vehicle-alerts';
import { listVehicleDrivers } from '@/lib/vehicle-drivers';
import { listOwnerVehicles, type Vehicle } from '@/lib/vehicles';

/** Arac sahibinin TUM araclarindan gelen "sofor bildirimlerini" tek listede
 * topladigi sekme (ör. "araç arızalı", "kaza oldu" gibi anlik uyarilar).
 * Bir bildirimi sola kaydirarak (onay sorduktan sonra) kalici olarak
 * silebilir - veri gorulup "islemi bitti" dendiginde ortadan kalksin diye. */
export default function NotificationsScreen() {
  const { profile } = useAuth();
  const [alerts, setAlerts] = useState<VehicleAlert[]>([]);
  const [vehiclesById, setVehiclesById] = useState<Record<string, Vehicle>>({});
  const [driverNames, setDriverNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const swipeableRefs = useRef<Record<string, Swipeable | null>>({});

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

  function handleDeletePress(alert: VehicleAlert) {
    Alert.alert('Bildirimi Sil', 'Bu bildirim kalıcı olarak silinecek, tekrar geri gelmeyecek. Devam edilsin mi?', [
      { text: 'Vazgeç', onPress: () => swipeableRefs.current[alert.id]?.close() },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const previous = alerts;
          setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
          try {
            await deleteVehicleAlert(alert.id);
          } catch (e: any) {
            setAlerts(previous);
            Alert.alert('Silinemedi', e?.message ?? 'Bilinmeyen hata oluştu.');
          }
        },
      },
    ]);
  }

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
          <Swipeable
            ref={(ref) => {
              swipeableRefs.current[item.id] = ref;
            }}
            friction={2}
            rightThreshold={40}
            overshootRight={false}
            renderRightActions={() => (
              <Pressable style={styles.deleteAction} onPress={() => handleDeletePress(item)}>
                <SymbolView name="trash" size={22} tintColor="#FFFFFF" />
                <ThemedText type="small" style={styles.deleteActionText}>
                  Sil
                </ThemedText>
              </Pressable>
            )}>
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
          </Swipeable>
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
  deleteAction: {
    width: 72,
    marginLeft: Spacing.two,
    borderRadius: Spacing.two,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.half,
  },
  deleteActionText: { color: '#FFFFFF' },
});
