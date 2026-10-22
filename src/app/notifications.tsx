import { router, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

import { PhotoViewButton } from '@/components/photo-view-button';
import { SafeScreen } from '@/components/safe-screen';
import { formatDateTime } from '@/components/shift-history-list';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/contexts/auth-context';
import { deleteVehicleAlert, listOwnerVehicleAlerts, type VehicleAlert } from '@/lib/vehicle-alerts';
import { listVehicleDrivers } from '@/lib/vehicle-drivers';
import { listMaintenanceReminders, type MaintenanceReminder } from '@/lib/vehicle-maintenance';
import { listOwnerVehicles, type Vehicle } from '@/lib/vehicles';

/** Bildirimler artık alt menüde ayrı sekme değil; ana sayfadaki zil
 * simgesinden açılıyor. En üstte sırası yaklaşan/geçen bakım
 * hatırlatmaları (silinemez - bakım kaydı girilince/düzenlenince kendisi
 * kalkar), altında şoför bildirimleri yer alıyor.
 *
 * Arac sahibinin TUM araclarindan gelen "sofor bildirimlerini" tek listede
 * topladigi sekme (ör. "araç arızalı", "kaza oldu" gibi anlik uyarilar).
 * Bir bildirimi sola kaydirarak (onay sorduktan sonra) kalici olarak
 * silebilir - veri gorulup "islemi bitti" dendiginde ortadan kalksin diye. */
export default function NotificationsScreen() {
  const { profile } = useAuth();
  const theme = useTheme();
  const [reminders, setReminders] = useState<MaintenanceReminder[]>([]);
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
      const [alertRows, driverRowsPerVehicle, reminderRows] = await Promise.all([
        listOwnerVehicleAlerts(vehicleIds),
        Promise.all(vehicleIds.map((vehicleId) => listVehicleDrivers(vehicleId).catch(() => []))),
        listMaintenanceReminders(vehicles).catch(() => [] as MaintenanceReminder[]),
      ]);
      setAlerts(alertRows);
      setReminders(reminderRows);

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

  const reminderHeader =
    reminders.length > 0 ? (
      <ThemedView style={[styles.reminderSection, styles.transparentBg]}>
        <ThemedText type="eyebrow">Bakım Hatırlatmaları</ThemedText>
        {reminders.map((reminder) => (
          <Pressable key={reminder.key} onPress={() => router.navigate('/maintenance')}>
            <ThemedView
              type="backgroundElement"
              style={[styles.card, { borderLeftColor: reminder.overdue ? '#DC2626' : '#D97706' }]}>
              <ThemedText type="eyebrow" themeColor="textSecondary">
                {reminder.vehicle.plate_no}
              </ThemedText>
              <ThemedText type="smallBold">{reminder.title}</ThemedText>
              <ThemedText type="small" style={{ color: reminder.overdue ? '#DC2626' : '#B45309' }}>
                {reminder.message}
              </ThemedText>
            </ThemedView>
          </Pressable>
        ))}
        {alerts.length > 0 && (
          <ThemedText type="eyebrow" style={styles.alertsTitle}>
            Şoför Bildirimleri
          </ThemedText>
        )}
      </ThemedView>
    ) : null;

  return (
    <SafeScreen>
    <ThemedView style={[styles.container, styles.transparentBg]}>
      <ThemedView style={[styles.headerRow, styles.transparentBg]}>
        <Pressable hitSlop={12} onPress={() => router.back()} style={styles.backButton}>
          <SymbolView name="chevron.left" size={20} tintColor={theme.text} />
        </Pressable>
        <ThemedText type="title" style={styles.header}>
          Bildirimler
        </ThemedText>
        <ThemedView style={[styles.backButton, styles.transparentBg]} />
      </ThemedView>
      {loading ? (
        <ActivityIndicator style={styles.loadingIndicator} />
      ) : (
      <FlatList showsVerticalScrollIndicator={false}
        data={alerts}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={reminderHeader}
        contentContainerStyle={[styles.list, alerts.length === 0 && reminders.length === 0 && styles.listEmpty]}
        ListEmptyComponent={
          reminders.length > 0 ? null : (
            <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
              Henüz bir bildirim yok. Şoförlerin &quot;Araç Sahibine Bildir&quot; ile gönderdiği uyarılar ve
              sırası gelen bakım hatırlatmaları burada görünecek.
            </ThemedText>
          )
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
      )}
    </ThemedView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing.four, paddingTop: Spacing.three },
  transparentBg: { backgroundColor: 'transparent' },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.four },
  backButton: { width: 36, height: 36, justifyContent: 'center' },
  header: { flex: 1, textAlign: 'center' },
  loadingIndicator: { marginTop: Spacing.five },
  reminderSection: { gap: Spacing.three, marginBottom: Spacing.three },
  alertsTitle: { marginTop: Spacing.two },
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
