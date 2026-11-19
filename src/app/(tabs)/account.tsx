import { router, useFocusEffect } from 'expo-router';
import { SymbolView } from '@/components/app-icon';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  // Sadece ilk açılışta yükleniyor göstergesi: geri dönünce liste yerinde
  // kalsın, sayfa en üste zıplamasın.
  const hasLoadedRef = useRef(false);
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
    if (!hasLoadedRef.current) setLoadingVehicles(true);
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
      hasLoadedRef.current = true;
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
    Alert.alert('Çıkış Yap', 'Hesabından çıkmak istediğine emin misin?', [
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
      Alert.alert('Eksik bilgi', 'Şoförün telefon numarasını eksiksiz gir.');
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
            `${name} adlı şoförün bu araçtaki karpinleri onun ekranından da silinsin mi? Karpinler senin tarafında her zaman kalır.`,
            [
              { text: 'Hayır, Karpinler Kalsın', onPress: () => performDelete(vehicleId, row, false) },
              {
                text: 'Evet, Şoförden Sil',
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

  const initials = (profile?.full_name ?? '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toLocaleUpperCase('tr-TR'))
    .join('');

  return (
    <SafeScreen>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
      <ThemedText type="title" style={styles.header}>
        Hesabım
      </ThemedText>

      {/* Profil: tek, sade kart */}
      <GroupCard style={styles.profileCard}>
        <ThemedView style={styles.avatar}>
          <ThemedText style={styles.avatarText}>{initials || '?'}</ThemedText>
        </ThemedView>
        <ThemedView style={[styles.profileInfo, styles.transparentBg]}>
          <ThemedText type="smallBold" style={styles.profileName}>
            {profile?.full_name ?? '-'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {profile?.phone ? `+${profile.phone}` : '-'}
          </ThemedText>
        </ThemedView>
        <ThemedView style={[styles.roleBadge, { backgroundColor: theme.subtleFill }]}>
          <ThemedText type="small" style={styles.roleBadgeText}>
            {profile?.role === 'owner' ? 'Araç Sahibi' : 'Şoför'}
          </ThemedText>
        </ThemedView>
      </GroupCard>

      {isOwner && (
        <>
          <ThemedText type="eyebrow" style={styles.sectionTitle}>
            Araçlar ve Şoförler
          </ThemedText>

          {loadingVehicles ? (
            <ActivityIndicator style={styles.loading} />
          ) : groups.length === 0 ? (
            <GroupCard style={styles.emptyCard}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
                Henüz araç eklemedin.
              </ThemedText>
            </GroupCard>
          ) : (
            groups.map(({ vehicle, drivers }) => (
              <GroupCard key={vehicle.id} style={styles.vehicleCard}>
                {/* Araç başlığı: dokununca araca gider */}
                <Pressable
                  style={({ pressed }) => [
                    styles.vehicleHeader,
                    { borderBottomColor: theme.separator },
                    pressed && styles.pressed,
                  ]}
                  onPress={() => router.push(`/vehicle/${vehicle.id}`)}>
                  <ThemedView style={[styles.vehicleIcon, { backgroundColor: Brand.primary }]}>
                    <SymbolView name="car.fill" size={18} tintColor={Brand.onPrimary} />
                  </ThemedView>
                  <ThemedView style={[styles.vehicleHeaderText, styles.transparentBg]}>
                    <ThemedText style={styles.plateText}>{vehicle.plate_no}</ThemedText>
                    {/* Şoför sayısı: belirgin rozet (şoför yoksa turuncu uyarı) */}
                    <ThemedView
                      style={[
                        styles.countBadge,
                        { backgroundColor: drivers.length === 0 ? 'rgba(217,119,6,0.14)' : 'rgba(22,163,74,0.12)' },
                      ]}>
                      <SymbolView
                        name={drivers.length === 0 ? 'exclamationmark.circle.fill' : 'person.2.fill'}
                        size={12}
                        tintColor={drivers.length === 0 ? '#B45309' : '#15803D'}
                      />
                      <ThemedText
                        style={[styles.countBadgeText, { color: drivers.length === 0 ? '#B45309' : '#15803D' }]}>
                        {drivers.length === 0 ? 'Şoför yok' : `${drivers.length} şoför`}
                      </ThemedText>
                    </ThemedView>
                  </ThemedView>
                  <SymbolView name="chevron.right" size={14} tintColor={theme.textSecondary} />
                </Pressable>

                {/* Şoförler: ince çizgiyle ayrılmış satırlar */}
                {drivers.map((row) => (
                  <ThemedView
                    key={row.id}
                    style={[styles.driverRow, styles.transparentBg, { borderBottomColor: theme.separator }]}>
                    <ThemedView style={[styles.driverAvatar, { backgroundColor: theme.subtleFill }]}>
                      <SymbolView name="person.fill" size={16} tintColor={theme.textSecondary} />
                    </ThemedView>
                    <ThemedView style={[styles.driverInfo, styles.transparentBg]}>
                      <ThemedText type="smallBold">{row.driver?.full_name ?? 'İsimsiz'}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {row.driver?.phone ? `+${row.driver.phone}` : '-'}
                      </ThemedText>
                    </ThemedView>
                    <Pressable
                      style={({ pressed }) => [styles.smallDanger, pressed && styles.pressed]}
                      onPress={() => handleDelete(vehicle.id, row)}
                      hitSlop={6}>
                      <SymbolView name="trash" size={13} tintColor="#DC2626" />
                      <ThemedText style={styles.smallDangerText}>Şoförü Sil</ThemedText>
                    </Pressable>
                  </ThemedView>
                ))}

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
                  /* Alt kısım: iki eşit buton */
                  <ThemedView style={[styles.vehicleActions, styles.transparentBg]}>
                    <Pressable
                      style={({ pressed }) => [styles.actionButton, { backgroundColor: theme.subtleFill }, pressed && styles.pressed]}
                      onPress={() => setAddingForVehicle(vehicle.id)}>
                      <SymbolView name="person.badge.plus" size={15} tintColor={theme.text} />
                      <ThemedText type="smallBold">Şoför Ekle</ThemedText>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.actionButton, styles.actionDanger, pressed && styles.pressed]}
                      onPress={() => requestDeleteVehicle(vehicle)}>
                      <SymbolView name="trash" size={14} tintColor="#DC2626" />
                      <ThemedText type="smallBold" style={styles.dangerText}>
                        Aracı Sil
                      </ThemedText>
                    </Pressable>
                  </ThemedView>
                )}
              </GroupCard>
            ))
          )}
        </>
      )}

      {/* Ayarlar: görünüm + yasal metinler */}
      <ThemedText type="eyebrow" style={styles.sectionTitle}>
        Ayarlar
      </ThemedText>
      <GroupCard>
        <GroupRow
          title="Görünüm ve Yazı Boyutu"
          value={`${THEME_OPTIONS.find((o) => o.key === themePref)?.label} · ${TEXT_SCALE_LABELS[textScale]}`}
          chevron
          onPress={() => setShowAppearance(true)}
        />
        <GroupRow title="Yasal Metinler" chevron divider={false} onPress={() => router.push('/legal' as any)} />
      </GroupCard>

      <Pressable
        style={({ pressed }) => [styles.signOutButton, pressed && styles.signOutButtonPressed]}
        onPress={handleSignOut}>
        <ThemedText style={styles.signOutButtonText}>Çıkış Yap</ThemedText>
      </Pressable>

      <Pressable onPress={handleDeleteAccount} style={({ pressed }) => [styles.deleteAccount, pressed && styles.pressed]}>
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
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: Brand.onPrimary, fontFamily: FontFamily.bodyBold, fontSize: 17 },
  profileInfo: { flex: 1, gap: 1 },
  profileName: { fontSize: 16 },
  roleBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  roleBadgeText: { fontFamily: FontFamily.bodySemiBold, fontSize: 12 },
  emptyCard: { padding: Spacing.four },
  vehicleCard: { marginTop: Spacing.two },
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  vehicleIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  vehicleHeaderText: { flex: 1, gap: 4, alignItems: 'flex-start' },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  countBadgeText: { fontFamily: FontFamily.bodyBold, fontSize: 12, lineHeight: 15 },
  driverAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  smallDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(220,38,38,0.1)',
  },
  smallDangerText: { color: '#DC2626', fontFamily: FontFamily.bodySemiBold, fontSize: 12 },
  vehicleActions: { flexDirection: 'row', gap: Spacing.two, padding: Spacing.three },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  actionDanger: { backgroundColor: 'rgba(220,38,38,0.1)' },
  dangerText: { color: '#DC2626' },
  pressed: { opacity: 0.6 },
  card: { padding: Spacing.four, gap: Spacing.half },
  fieldSpacing: { marginTop: Spacing.three },
  appearanceCard: { marginTop: Spacing.three },
  sheetLabel: { marginTop: Spacing.two },
  segment: { flexDirection: 'row', padding: 3, borderRadius: 12, gap: 3 },
  segmentOption: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: Spacing.two, borderRadius: 10 },
  sizeSample: { fontFamily: FontFamily.bodyBold },
  sheetHint: { fontSize: 13, lineHeight: 18 },
  transparentBg: { backgroundColor: 'transparent' },
  sectionTitle: { marginTop: Spacing.four, marginBottom: Spacing.one, paddingHorizontal: Spacing.three },
  loading: { marginTop: Spacing.two },
  empty: { textAlign: 'center', marginTop: Spacing.two },
  vehicleGroup: { padding: Spacing.three, gap: Spacing.two, marginTop: Spacing.three },
  plateRow: { alignItems: 'center', paddingBottom: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth },
  plateText: { fontFamily: FontFamily.displayBold, fontSize: 18, lineHeight: 22 },
  noDrivers: { marginTop: Spacing.one },
  driverList: { gap: Spacing.two, marginTop: Spacing.one },
  // Her şoför kendi gri kutusunda - şoförler birbirinden net ayrılıyor.
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: 12,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
  addForm: { gap: Spacing.two, padding: Spacing.three },
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
