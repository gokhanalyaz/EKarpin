import { router, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text } from 'react-native';

import { ActionSheetModal } from '@/components/action-sheet-modal';
import { GroupCard, GroupRow } from '@/components/grouped-list';
import { PhoneInput } from '@/components/phone-input';
import { SafeScreen } from '@/components/safe-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, FontFamily, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/hooks/use-theme';
import { friendlyError } from '@/lib/errors';
import { formatPhoneWithPrefix } from '@/lib/format';
import {
  setTextScale,
  TEXT_SCALE_FACTORS,
  TEXT_SCALE_LABELS,
  useTextScale,
  type TextScale,
} from '@/lib/text-scale';
import { getThemePreference, setThemePreference, type ThemePreference } from '@/lib/theme-preference';
import {
  assignDriver,
  findDriverByPhone,
  listVehicleDrivers,
  removeDriverFromVehicle,
  type VehicleDriverRow,
} from '@/lib/vehicle-drivers';
import { getAnyOpenShift } from '@/lib/shifts';
import { archiveVehicle, deleteVehicle, listOwnerVehicles, type Vehicle } from '@/lib/vehicles';

type VehicleGroup = { vehicle: Vehicle; drivers: VehicleDriverRow[] };

const THEME_OPTIONS: { key: ThemePreference; label: string; icon: string }[] = [
  { key: 'system', label: 'Otomatik', icon: 'circle.lefthalf.filled' },
  { key: 'light', label: 'Gündüz', icon: 'sun.max.fill' },
  { key: 'dark', label: 'Gece', icon: 'moon.fill' },
];

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
  const [themePref, setThemePref] = useState<ThemePreference>('system');
  const [showAppearance, setShowAppearance] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);
  const [deletingVehicle, setDeletingVehicle] = useState(false);
  const textScale = useTextScale();

  useEffect(() => {
    getThemePreference().then(setThemePref);
  }, []);

  function handleThemeChange(pref: ThemePreference) {
    setThemePref(pref);
    setThemePreference(pref);
  }

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

  async function requestDeleteVehicle(vehicle: Vehicle) {
    const open = await getAnyOpenShift(vehicle.id).catch(() => null);
    if (open) {
      Alert.alert('Vardiya açık', 'Bu aracın açık bir vardiyası var. Aracı silmeden önce vardiyanın kapatılması gerekiyor.');
      return;
    }
    setVehicleToDelete(vehicle);
  }

  async function performDeleteVehicle(keepHistory: boolean) {
    if (!vehicleToDelete) return;
    setDeletingVehicle(true);
    try {
      if (keepHistory) await archiveVehicle(vehicleToDelete.id);
      else await deleteVehicle(vehicleToDelete.id);
      setVehicleToDelete(null);
      await loadVehicles();
    } catch (e: any) {
      Alert.alert('Araç silinemedi', friendlyError(e));
    } finally {
      setDeletingVehicle(false);
    }
  }

  function confirmDeleteAll() {
    if (!vehicleToDelete) return;
    Alert.alert(
      'Emin misin?',
      `${vehicleToDelete.plate_no} ve bu araca ait TÜM karpin, bakım ve bildirim kayıtları kalıcı olarak silinecek. Bu işlem geri alınamaz.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Evet, Hepsini Sil', style: 'destructive', onPress: () => performDeleteVehicle(false) },
      ]
    );
  }

  // Apple şartı: kullanıcı hesabını uygulamanın içinden silebilmeli.
  function handleDeleteAccount() {
    const isOwnerAccount = profile?.role === 'owner';
    Alert.alert(
      'Hesabımı Sil',
      isOwnerAccount
        ? 'Hesabın, araçların ve araçlarına ait TÜM karpin, bakım ve bildirim kayıtları kalıcı olarak silinecek. Bu işlem geri alınamaz.'
        : 'Hesabın ve kişisel bilgilerin kalıcı olarak silinecek, bir daha bu hesapla giriş yapamayacaksın. Araç sahiplerinin kayıtları için geçmiş karpinlerin "Silinmiş Şoför" adıyla araç sahibinde kalır. Bu işlem geri alınamaz.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Devam Et',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Emin misin?', 'Son onay: hesabın kalıcı olarak silinecek.', [
              { text: 'Vazgeç', style: 'cancel' },
              { text: 'Evet, Hesabımı Sil', style: 'destructive', onPress: performDeleteAccount },
            ]),
        },
      ]
    );
  }

  async function performDeleteAccount() {
    try {
      const { error } = await supabase.rpc('delete_my_account');
      if (error) throw error;
      Alert.alert('Hesabın silindi', 'Dijital Karpin\'i kullandığın için teşekkürler.');
      await signOut();
    } catch (e: any) {
      Alert.alert('Hesap silinemedi', friendlyError(e));
    }
  }

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
      Alert.alert('Eklenemedi', friendlyError(e));
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
      Alert.alert('Silinemedi', friendlyError(e));
    }
  }

  return (
    <SafeScreen>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
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

      {/* Görünüm: gece/gündüz + yazı boyutu tek, sade bir satırda */}
      <GroupCard style={styles.appearanceCard}>
        <GroupRow
          title="Görünüm ve Yazı Boyutu"
          value={`${THEME_OPTIONS.find((o) => o.key === themePref)?.label} · ${TEXT_SCALE_LABELS[textScale]}`}
          chevron
          divider={false}
          onPress={() => setShowAppearance(true)}
        />
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
                <Pressable
                  onPress={() => requestDeleteVehicle(vehicle)}
                  style={({ pressed }) => [styles.deleteVehicleRow, { borderTopColor: theme.separator }, pressed && styles.deleteButtonPressed]}>
                  <SymbolView name="trash" size={14} tintColor="#DC2626" />
                  <ThemedText type="small" style={styles.deleteVehicleText}>
                    Aracı Sil
                  </ThemedText>
                </Pressable>
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

      {/* Hukuki metinler */}
      <GroupCard style={styles.legalCard}>
        <GroupRow title="Gizlilik Politikası" chevron onPress={() => router.push('/legal?doc=gizlilik' as any)} />
        <GroupRow title="Kullanım Koşulları" chevron onPress={() => router.push('/legal?doc=kullanim' as any)} />
        <GroupRow title="KVKK Aydınlatma Metni" chevron onPress={() => router.push('/legal?doc=kvkk' as any)} />
        <GroupRow title="Açık Rıza Metni" chevron divider={false} onPress={() => router.push('/legal?doc=acik-riza' as any)} />
      </GroupCard>

      <Pressable onPress={handleDeleteAccount} style={({ pressed }) => [styles.deleteAccount, pressed && styles.deleteButtonPressed]}>
        <ThemedText type="small" style={styles.deleteAccountText}>
          Hesabımı Sil
        </ThemedText>
      </Pressable>
    </ScrollView>

    <ActionSheetModal
      visible={!!vehicleToDelete}
      onClose={() => !deletingVehicle && setVehicleToDelete(null)}
      title="Aracı Sil"
      description={`${vehicleToDelete?.plate_no ?? 'Bu araç'} silinecek. Araca ait karpin geçmişi ne olsun?`}>
      <Pressable
        disabled={deletingVehicle}
        onPress={() => performDeleteVehicle(true)}
        style={({ pressed }) => [styles.sheetPrimary, (pressed || deletingVehicle) && styles.buttonPressed]}>
        <ThemedText style={styles.buttonText}>Karpin Geçmişi Kalsın, Aracı Sil</ThemedText>
      </Pressable>
      <ThemedText type="small" themeColor="textSecondary" style={styles.sheetHint}>
        Araç listelerden kalkar, şoförler araçtan çıkarılır. Geçmiş karpinler Geçmiş sekmesinde &quot;(silindi)&quot;
        olarak görünmeye devam eder.
      </ThemedText>
      <Pressable
        disabled={deletingVehicle}
        onPress={confirmDeleteAll}
        style={({ pressed }) => [styles.sheetDanger, (pressed || deletingVehicle) && styles.buttonPressed]}>
        <ThemedText style={styles.sheetDangerText}>Aracı ve Tüm Geçmişini Sil</ThemedText>
      </Pressable>
      <Pressable style={styles.sheetCancel} onPress={() => setVehicleToDelete(null)}>
        <ThemedText type="small" themeColor="textSecondary">
          Vazgeç
        </ThemedText>
      </Pressable>
    </ActionSheetModal>

    <ActionSheetModal visible={showAppearance} onClose={() => setShowAppearance(false)} title="Görünüm">
      <ThemedText type="eyebrow" style={styles.sheetLabel}>
        Tema
      </ThemedText>
      <ThemedView style={[styles.segment, { backgroundColor: theme.subtleFill }]}>
        {THEME_OPTIONS.map((opt) => {
          const active = themePref === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => handleThemeChange(opt.key)}
              style={[styles.segmentOption, active && { backgroundColor: theme.card }]}>
              <SymbolView name={opt.icon as any} size={18} tintColor={active ? theme.text : theme.textSecondary} />
              <ThemedText type={active ? 'smallBold' : 'small'} themeColor={active ? 'text' : 'textSecondary'}>
                {opt.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </ThemedView>
      <ThemedText type="small" themeColor="textSecondary" style={styles.sheetHint}>
        Otomatik: telefonun kendi gece/gündüz ayarına uyar.
      </ThemedText>

      <ThemedText type="eyebrow" style={styles.sheetLabel}>
        Yazı Boyutu
      </ThemedText>
      <ThemedView style={[styles.segment, { backgroundColor: theme.subtleFill }]}>
        {(Object.keys(TEXT_SCALE_LABELS) as TextScale[]).map((key) => {
          const active = textScale === key;
          return (
            <Pressable
              key={key}
              onPress={() => setTextScale(key)}
              style={[styles.segmentOption, active && { backgroundColor: theme.card }]}>
              <Text
                style={[
                  styles.sizeSample,
                  { fontSize: 16 * TEXT_SCALE_FACTORS[key], color: active ? theme.text : theme.textSecondary },
                ]}>
                Aa
              </Text>
              <ThemedText type={active ? 'smallBold' : 'small'} themeColor={active ? 'text' : 'textSecondary'}>
                {TEXT_SCALE_LABELS[key]}
              </ThemedText>
            </Pressable>
          );
        })}
      </ThemedView>
      <ThemedText type="small" themeColor="textSecondary" style={styles.sheetHint}>
        Uygulamadaki yazılar seçtiğin boyutta görünür.
      </ThemedText>
    </ActionSheetModal>
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
  appearanceCard: { marginTop: Spacing.three },
  sheetLabel: { marginTop: Spacing.two },
  segment: { flexDirection: 'row', padding: 3, borderRadius: 12, gap: 3 },
  segmentOption: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: Spacing.two, borderRadius: 10 },
  sizeSample: { fontFamily: FontFamily.bodyBold },
  sheetHint: { fontSize: 13, lineHeight: 18 },
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
  legalCard: { marginTop: Spacing.five },
  deleteVehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.two,
    paddingTop: Spacing.three,
  },
  deleteVehicleText: { color: '#DC2626', fontFamily: FontFamily.bodySemiBold },
  sheetPrimary: { backgroundColor: Brand.primary, borderRadius: 12, paddingVertical: Spacing.three, alignItems: 'center' },
  sheetDanger: {
    backgroundColor: 'rgba(220,38,38,0.1)',
    borderRadius: 12,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  sheetDangerText: { color: '#DC2626', fontFamily: FontFamily.bodyBold, fontSize: 16 },
  sheetCancel: { alignItems: 'center', paddingVertical: Spacing.two },
  deleteAccount: { alignItems: 'center', paddingVertical: Spacing.three, marginTop: Spacing.three },
  deleteAccountText: { color: '#DC2626', fontFamily: FontFamily.bodySemiBold },
  signOutButtonText: { color: '#DC2626', fontFamily: FontFamily.bodyBold, fontSize: 16 },
});
