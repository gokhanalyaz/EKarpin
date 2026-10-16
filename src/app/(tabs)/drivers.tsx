import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet } from 'react-native';

import { PhoneInput } from '@/components/phone-input';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { formatPhoneWithPrefix } from '@/lib/format';
import {
  assignDriver,
  findDriverByPhone,
  listVehicleDrivers,
  removeDriverFromVehicle,
  type VehicleDriverRow,
} from '@/lib/vehicle-drivers';
import { listOwnerVehicles, type Vehicle } from '@/lib/vehicles';

type VehicleGroup = { vehicle: Vehicle; drivers: VehicleDriverRow[] };

export default function DriversScreen() {
  const { profile } = useAuth();
  const [groups, setGroups] = useState<VehicleGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingForVehicle, setAddingForVehicle] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [assigning, setAssigning] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const vehicles = await listOwnerVehicles(profile.id);
      const withDrivers = await Promise.all(
        vehicles.map(async (vehicle) => ({
          vehicle,
          drivers: await listVehicleDrivers(vehicle.id).catch(() => [] as VehicleDriverRow[]),
        }))
      );
      setGroups(withDrivers);
    } catch (e) {
      console.warn('Şoförler yüklenemedi', e);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleInvite() {
    const display = formatPhoneWithPrefix(phone) || 'telefon numaranla';
    try {
      await Share.share({
        message: `Dijital Karpin'e şoför olarak eklenebilmen için önce uygulamayı aç, "Şoförüm" seçeneğiyle ${display} numarasıyla kayıt ol. Sonra seni araca ekleyeceğim.`,
      });
    } catch {
      // Paylaşım penceresi kapatıldıysa sessizce geç.
    }
  }

  async function handleAssign(vehicleId: string) {
    if (phone.length !== 10) {
      Alert.alert('Eksik bilgi', 'Şoförün telefon numarasını eksiksiz girin.');
      return;
    }
    setAssigning(true);
    try {
      const driver = await findDriverByPhone(phone);
      if (!driver) {
        Alert.alert(
          'Şoför bulunamadı',
          'Bu telefon numarasıyla kayıtlı bir şoför yok. Önce şoförün uygulamaya "Şoför" olarak, aynı telefon numarasıyla kayıt olması gerekiyor. İstersen ona davet mesajı gönderebilirsin.',
          [
            { text: 'Tamam', style: 'cancel' },
            { text: 'Davet Gönder', onPress: handleInvite },
          ]
        );
        return;
      }
      await assignDriver(vehicleId, driver.id);
      setPhone('');
      setAddingForVehicle(null);
      await load();
    } catch (e: any) {
      Alert.alert('Eklenemedi', e?.message ?? 'Bilinmeyen hata oluştu.');
    } finally {
      setAssigning(false);
    }
  }

  function handleDelete(vehicleId: string, row: VehicleDriverRow) {
    const name = row.driver?.full_name ?? 'Bu şoför';
    Alert.alert('Şoförü Sil', `${name} bu araçtan kaldırılacak. Devam edilsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Devam Et',
        style: 'destructive',
        onPress: () => {
          Alert.alert(
            'Karpinler Ne Olsun?',
            `${name} adlı şoförün bu araçla ilgili tüm karpinleri de silinsin mi? Bu işlem geri alınamaz.`,
            [
              {
                text: 'Hayır, Karpinler Kalsın',
                onPress: () => performDelete(vehicleId, row, false),
              },
              {
                text: 'Evet, Karpinleri de Sil',
                style: 'destructive',
                onPress: () => performDelete(vehicleId, row, true),
              },
            ]
          );
        },
      },
    ]);
  }

  async function performDelete(vehicleId: string, row: VehicleDriverRow, deleteShifts: boolean) {
    try {
      await removeDriverFromVehicle(row.id, { vehicleId, driverId: row.driver_id, deleteShifts });
      await load();
    } catch (e: any) {
      Alert.alert('Silinemedi', e?.message ?? 'Bilinmeyen hata oluştu.');
    }
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Şoförler
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
        Araçlarına atanmış tüm şoförleri buradan yönetebilirsin.
      </ThemedText>

      {loading ? (
        <ActivityIndicator style={styles.loading} />
      ) : groups.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
          Henüz araç eklemedin.
        </ThemedText>
      ) : (
        groups.map(({ vehicle, drivers }) => (
          <ThemedView key={vehicle.id} type="backgroundElement" style={styles.vehicleGroup}>
            <Pressable onPress={() => router.push(`/vehicle/${vehicle.id}`)}>
              <ThemedText type="smallBold">{vehicle.plate_no}</ThemedText>
            </Pressable>

            {drivers.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.noDrivers}>
                Henüz şoför eklenmedi.
              </ThemedText>
            ) : (
              <ThemedView style={styles.driverList}>
                {drivers.map((row) => (
                  <ThemedView key={row.id} style={styles.driverRow}>
                    <ThemedView style={{ flex: 1 }}>
                      <ThemedText type="small">{row.driver?.full_name ?? 'İsimsiz'}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {row.driver?.phone ? `+${row.driver.phone}` : '-'}
                      </ThemedText>
                    </ThemedView>
                    <Pressable onPress={() => handleDelete(vehicle.id, row)}>
                      <ThemedText type="small" style={styles.deleteText}>
                        Şoförü Sil
                      </ThemedText>
                    </Pressable>
                  </ThemedView>
                ))}
              </ThemedView>
            )}

            {addingForVehicle === vehicle.id ? (
              <ThemedView style={styles.addForm}>
                <PhoneInput value={phone} onChangeText={setPhone} />
                <Pressable
                  style={({ pressed }) => [styles.button, (assigning || pressed) && styles.buttonPressed]}
                  onPress={() => handleAssign(vehicle.id)}
                  disabled={assigning}>
                  <ThemedText style={styles.buttonText}>
                    {assigning ? 'Ekleniyor...' : 'Şoför Ekle'}
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={styles.linkButton}
                  onPress={() => {
                    setAddingForVehicle(null);
                    setPhone('');
                  }}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Vazgeç
                  </ThemedText>
                </Pressable>
              </ThemedView>
            ) : (
              <Pressable style={styles.addDriverButton} onPress={() => setAddingForVehicle(vehicle.id)}>
                <ThemedText type="linkPrimary">+ Şoför Ekle</ThemedText>
              </Pressable>
            )}
          </ThemedView>
        ))
      )}

      <Pressable style={styles.compareLink} onPress={() => router.push('/driver-comparison')}>
        <ThemedText type="linkPrimary">📊 Şoförleri Karşılaştır</ThemedText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  container: { padding: Spacing.four, paddingBottom: Spacing.six, gap: Spacing.two },
  title: { marginBottom: Spacing.half },
  subtitle: { marginBottom: Spacing.two },
  loading: { marginTop: Spacing.four },
  empty: { textAlign: 'center', marginTop: Spacing.five },
  vehicleGroup: { padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.two, marginTop: Spacing.two },
  noDrivers: { marginTop: Spacing.one },
  driverList: { gap: Spacing.two, marginTop: Spacing.one },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.one },
  deleteText: { color: '#DC2626', fontWeight: '700' },
  addForm: { gap: Spacing.two, marginTop: Spacing.two },
  addDriverButton: { alignItems: 'center', marginTop: Spacing.two, paddingVertical: Spacing.one },
  button: {
    backgroundColor: Brand.primary,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  buttonPressed: { opacity: 0.7 },
  buttonText: { color: Brand.onPrimary, fontWeight: '700', fontSize: 16 },
  linkButton: { alignItems: 'center', marginTop: Spacing.one },
  compareLink: { alignItems: 'center', marginTop: Spacing.four, paddingVertical: Spacing.two },
});
