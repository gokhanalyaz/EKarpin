import { router, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet } from 'react-native';

import { GroupCard } from '@/components/grouped-list';
import { PhoneInput } from '@/components/phone-input';
import { SafeScreen } from '@/components/safe-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, FontFamily, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
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

/** Hesabım sekmesi: profil bilgisi + (araç sahibiyse) araçlar ve her aracın
 * şoför yönetimi burada - artık ayrı bir "Şoförler" sekmesi yok, hepsi
 * burada toplandı. Şoför karşılaştırma özelliği şimdilik kaldırıldı. */
export default function AccountScreen() {
  const { profile, signOut } = useAuth();
  const theme = useTheme();
  const isOwner = profile?.role === 'owner';

  const [groups, setGroups] = useState<VehicleGroup[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [addingForVehicle, setAddingForVehicle] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [assigning, setAssigning] = useState(false);

  const loadVehicles = useCallback(async () => {
    if (!profile || !isOwner) {
      setLoadingVehicles(false);
      return;
    }
    setLoadingVehicles(true);
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
      console.warn('Araçlar yüklenemedi', e);
    } finally {
      setLoadingVehicles(false);
    }
  }, [profile, isOwner]);

  useFocusEffect(
    useCallback(() => {
      loadVehicles();
    }, [loadVehicles])
  );

  function handleSignOut() {
    Alert.alert('Çıkış Yap', 'Hesabınızdan çıkmak istediğinize emin misiniz?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Çıkış Yap', style: 'destructive', onPress: signOut },
    ]);
  }

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
          'Bu telefon numarasıyla kayıtlı bir şoför yok. Önce şoförün uygulamaya "Şoförüm" olarak, aynı telefon numarasıyla kayıt olması gerekiyor. İstersen ona davet mesajı gönderebilirsin.',
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
      await loadVehicles();
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
              { text: 'Hayır, Karpinler Kalsın', onPress: () => performDelete(vehicleId, row, false) },
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
      await loadVehicles();
    } catch (e: any) {
      Alert.alert('Silinemedi', e?.message ?? 'Bilinmeyen hata oluştu.');
    }
  }

  return (
    <SafeScreen>
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText type="title" style={styles.header}>
        Hesabım
      </ThemedText>

      <GroupCard style={styles.card}>
        <ThemedText type="eyebrow" themeColor="textSecondary">
          Ad Soyad
        </ThemedText>
        <ThemedText type="smallBold">{profile?.full_name ?? '-'}</ThemedText>

        <ThemedText type="eyebrow" themeColor="textSecondary" style={styles.fieldSpacing}>
          Telefon
        </ThemedText>
        <ThemedText type="smallBold">{profile?.phone ?? '-'}</ThemedText>

        <ThemedText type="eyebrow" themeColor="textSecondary" style={styles.fieldSpacing}>
          Hesap Türü
        </ThemedText>
        <ThemedText type="smallBold">{profile?.role === 'owner' ? 'Araç Sahibi' : 'Şoför'}</ThemedText>
      </GroupCard>

      {isOwner && (
        <>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Araçlar ve Şoförler
          </ThemedText>

          {loadingVehicles ? (
            <ActivityIndicator style={styles.loading} />
          ) : groups.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
              Henüz araç eklemedin.
            </ThemedText>
          ) : (
            groups.map(({ vehicle, drivers }) => (
              <GroupCard key={vehicle.id} style={styles.vehicleGroup}>
                <Pressable
                  style={[styles.plateRow, { borderBottomColor: theme.separator }]}
                  onPress={() => router.push(`/vehicle/${vehicle.id}`)}>
                  <ThemedText type="subtitle" style={styles.plateText}>
                    {vehicle.plate_no}
                  </ThemedText>
                </Pressable>

                {drivers.length === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary" style={[styles.noDrivers, styles.transparentBg]}>
                    Henüz şoför eklenmedi.
                  </ThemedText>
                ) : (
                  <ThemedView style={[styles.driverList, styles.transparentBg]}>
                    {drivers.map((row) => (
                      <ThemedView key={row.id} style={[styles.driverRow, { backgroundColor: theme.subtleFill }]}>
                        <SymbolView name="person.crop.circle.fill" size={30} tintColor={theme.textSecondary} />
                        <ThemedView style={[styles.driverInfo, styles.transparentBg]}>
                          <ThemedText type="smallBold">{row.driver?.full_name ?? 'İsimsiz'}</ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            {row.driver?.phone ? `+${row.driver.phone}` : '-'}
                          </ThemedText>
                        </ThemedView>
                        <Pressable
                          style={({ pressed }) => [styles.deleteAction, pressed && styles.deleteButtonPressed]}
                          onPress={() => handleDelete(vehicle.id, row)}
                          hitSlop={6}>
                          <ThemedView style={styles.deleteButton}>
                            <SymbolView name="trash" size={16} tintColor="#DC2626" />
                          </ThemedView>
                          <ThemedText style={styles.deleteLabel}>Şoförü Sil</ThemedText>
                        </Pressable>
                      </ThemedView>
                    ))}
                  </ThemedView>
                )}

                {addingForVehicle === vehicle.id ? (
                  <ThemedView style={[styles.addForm, styles.transparentBg]}>
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
              </GroupCard>
            ))
          )}
        </>
      )}

      <Pressable
        style={({ pressed }) => [styles.signOutButton, pressed && styles.signOutButtonPressed]}
        onPress={handleSignOut}>
        <ThemedText style={styles.signOutButtonText}>Çıkış Yap</ThemedText>
      </Pressable>
    </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
  },
  header: { marginBottom: Spacing.three, textAlign: 'center' },
  card: { padding: Spacing.four, gap: Spacing.half },
  fieldSpacing: { marginTop: Spacing.three },
  transparentBg: { backgroundColor: 'transparent' },
  sectionTitle: { marginTop: Spacing.five, marginBottom: Spacing.one, textAlign: 'center' },
  loading: { marginTop: Spacing.two },
  empty: { textAlign: 'center', marginTop: Spacing.two },
  vehicleGroup: { padding: Spacing.three, gap: Spacing.two, marginTop: Spacing.three },
  plateRow: { alignItems: 'center', paddingBottom: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth },
  plateText: { textAlign: 'center' },
  noDrivers: { marginTop: Spacing.one },
  driverList: { gap: Spacing.two, marginTop: Spacing.one },
  // Her şoför kendi gri kutusunda - şoförler birbirinden net ayrılıyor.
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: 12,
  },
  driverInfo: { flex: 1 },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(220,38,38,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonPressed: { opacity: 0.6 },
  deleteAction: { alignItems: 'center', gap: 3 },
  deleteLabel: { color: '#DC2626', fontFamily: FontFamily.bodySemiBold, fontSize: 11, lineHeight: 13 },
  addForm: { gap: Spacing.two, marginTop: Spacing.two },
  addDriverButton: { alignItems: 'center', marginTop: Spacing.two, paddingVertical: Spacing.one },
  button: {
    backgroundColor: Brand.primary,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  buttonPressed: { opacity: 0.7 },
  buttonText: { color: Brand.onPrimary, fontFamily: FontFamily.bodyBold, fontSize: 16 },
  linkButton: { alignItems: 'center', marginTop: Spacing.one },
  signOutButton: {
    borderWidth: 1,
    borderColor: '#DC2626',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.six,
  },
  signOutButtonPressed: { opacity: 0.6 },
  signOutButtonText: { color: '#DC2626', fontFamily: FontFamily.bodyBold, fontSize: 16 },
});
