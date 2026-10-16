import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
} from 'react-native';

import { ActionSheetModal } from '@/components/action-sheet-modal';
import { formatDateTime } from '@/components/shift-history-list';
import { PhoneInput } from '@/components/phone-input';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DEFAULT_EXPENSE_CATEGORIES, EXPENSE_CATEGORIES } from '@/lib/expense-categories';
import { formatPhoneWithPrefix } from '@/lib/format';
import { deleteDriverShifts, getAnyOpenShift, queryShifts, type Shift } from '@/lib/shifts';
import {
  assignDriver,
  findDriverByPhone,
  listVehicleDrivers,
  removeDriverFromVehicle,
  setDriverDailyKmLimit,
  setDriverShiftVisibilityDays,
  type VehicleDriverRow,
} from '@/lib/vehicle-drivers';
import { getVehicle, updateVehiclePaymentModel, type PaymentModel, type Vehicle } from '@/lib/vehicles';

const VISIBILITY_QUICK_DAYS = [7, 15, 30, 60, 90];

/** Aracin ayar sayfasi: gider kategorileri, odeme sistemi ve sofor
 * yonetimi (ekleme/silme, km dusum hakki, karpin gorus suresi) burada
 * toplandi - arac detay sayfasi sadece plaka + vardiya gecmisine linkten
 * ibaret kalsin diye.
 * NOT: Km-hasilat karsilastirma bolumu simdilik arayuzden kaldirildi
 * (lib/vehicles.ts'teki setExpectedRevenuePerKm fonksiyonu duruyor,
 * ileride tekrar eklenebilir - "ileride yapilabilecekler" listesinde). */
export default function VehicleSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [drivers, setDrivers] = useState<VehicleDriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);

  const [paymentModelChoice, setPaymentModelChoice] = useState<PaymentModel>('percentage');
  const [percentageRateInput, setPercentageRateInput] = useState('25');
  const [kmRateInput, setKmRateInput] = useState('');
  const [savingPaymentModel, setSavingPaymentModel] = useState(false);
  const [hasOpenShift, setHasOpenShift] = useState(false);

  const [limitInputs, setLimitInputs] = useState<Record<string, string>>({});
  const [savingLimitFor, setSavingLimitFor] = useState<string | null>(null);

  const [phone, setPhone] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [showAddDriver, setShowAddDriver] = useState(false);

  // Soforu kaldirma akisi: "Karpinler kalsin / hepsini sil / secerek sil"
  const [removeTarget, setRemoveTarget] = useState<VehicleDriverRow | null>(null);

  // Karpin secip silme (soforu kaldirirken "secerek sil" veya bagimsiz
  // "Karpin Sil" aksiyonundan acilir).
  const [shiftPickerFor, setShiftPickerFor] = useState<{ row: VehicleDriverRow; thenRemove: boolean } | null>(null);
  const [pickerShifts, setPickerShifts] = useState<Shift[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [selectedShiftIds, setSelectedShiftIds] = useState<Set<string>>(new Set());

  // "Karpin Gorus Suresi Ekle": once hangi sofor (birden fazla sofor
  // varsa), sonra kac gun - kisa ve adim adim bir akis.
  const [visibilityStep, setVisibilityStep] = useState<'closed' | 'pickDriver' | 'pickDays'>('closed');
  const [visibilityTarget, setVisibilityTarget] = useState<VehicleDriverRow | null>(null);
  const [visibilityCustomInput, setVisibilityCustomInput] = useState('');
  const [savingVisibility, setSavingVisibility] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    if (!hasLoadedRef.current) setLoading(true);
    try {
      const [v, d, openShift] = await Promise.all([
        getVehicle(id),
        listVehicleDrivers(id),
        getAnyOpenShift(id).catch(() => null),
      ]);
      setVehicle(v);
      setDrivers(d);
      setHasOpenShift(!!openShift);
      setPaymentModelChoice(v.payment_model);
      setPercentageRateInput(v.percentage_rate != null ? String(v.percentage_rate) : '25');
      setKmRateInput(v.km_rate != null ? String(v.km_rate) : '');
      setLimitInputs(
        Object.fromEntries(
          d.map((row) => [row.id, row.daily_km_discount_limit != null ? String(row.daily_km_discount_limit) : ''])
        )
      );
    } catch (e) {
      console.warn('Araç ayarları yüklenemedi', e);
    } finally {
      setLoading(false);
      hasLoadedRef.current = true;
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleToggleExpenseCategory(key: string) {
    if (!vehicle) return;
    const { setEnabledExpenseCategories } = await import('@/lib/vehicles');
    const current = vehicle.enabled_expense_categories ?? DEFAULT_EXPENSE_CATEGORIES;
    const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
    setVehicle({ ...vehicle, enabled_expense_categories: next });
    try {
      await setEnabledExpenseCategories(vehicle.id, next);
    } catch (e: any) {
      setVehicle({ ...vehicle, enabled_expense_categories: current });
      Alert.alert('Kaydedilemedi', e?.message ?? 'Bilinmeyen hata oluştu.');
    }
  }

  async function handleSavePaymentModel() {
    if (!vehicle) return;
    if (hasOpenShift) {
      Alert.alert(
        'Vardiya açık',
        'Çalışma sistemini değiştirmeden önce bu aracın açık vardiyasının kapatılması gerekiyor.'
      );
      return;
    }
    let percentageRate: number | undefined;
    let kmRate: number | undefined;
    if (paymentModelChoice === 'percentage') {
      const raw = percentageRateInput.trim();
      const parsed = Number(raw.replace(',', '.'));
      if (!raw || Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
        Alert.alert('Geçersiz değer', 'Şoför payını 0-100 arasında bir yüzde olarak girin.');
        return;
      }
      percentageRate = parsed;
    } else {
      const raw = kmRateInput.trim();
      const parsed = Number(raw.replace(',', '.'));
      if (!raw || Number.isNaN(parsed) || parsed <= 0) {
        Alert.alert('Geçersiz değer', 'Km başına ücreti geçerli bir sayı olarak girin.');
        return;
      }
      kmRate = parsed;
    }
    setSavingPaymentModel(true);
    try {
      await updateVehiclePaymentModel(vehicle.id, {
        paymentModel: paymentModelChoice,
        percentageRate,
        kmRate,
      });
      await load();
      Alert.alert('Kaydedildi', 'Çalışma sistemi güncellendi. Bu değişiklik yalnızca bundan sonra açılacak vardiyaları etkiler.');
    } catch (e: any) {
      Alert.alert('Kaydedilemedi', e?.message ?? 'Bilinmeyen hata oluştu.');
    } finally {
      setSavingPaymentModel(false);
    }
  }

  async function handleSaveLimit(row: VehicleDriverRow) {
    const raw = limitInputs[row.id] ?? '';
    const parsed = raw.trim() ? Number(raw.replace(',', '.')) : null;
    if (raw.trim() && (Number.isNaN(parsed) || (parsed as number) < 0)) {
      Alert.alert('Geçersiz değer', 'Geçerli bir km değeri gir (boş bırakırsan yetki kaldırılır).');
      return;
    }
    setSavingLimitFor(row.id);
    try {
      await setDriverDailyKmLimit(row.id, parsed);
      await load();
    } catch (e: any) {
      Alert.alert('Kaydedilemedi', e?.message ?? 'Bilinmeyen hata oluştu.');
    } finally {
      setSavingLimitFor(null);
    }
  }

  // --- Sofor kaldirma / karpin silme akisi ---

  async function handleKeepShiftsAndRemove() {
    if (!removeTarget || !id) return;
    const row = removeTarget;
    setRemoveTarget(null);
    try {
      await removeDriverFromVehicle(row.id, { vehicleId: id, driverId: row.driver_id, deleteShifts: false });
      await load();
    } catch (e: any) {
      Alert.alert('Kaldırılamadı', e?.message ?? 'Bilinmeyen hata oluştu.');
    }
  }

  async function handleDeleteAllAndRemove() {
    if (!removeTarget || !id) return;
    const row = removeTarget;
    setRemoveTarget(null);
    try {
      await removeDriverFromVehicle(row.id, { vehicleId: id, driverId: row.driver_id, deleteShifts: true });
      await load();
    } catch (e: any) {
      Alert.alert('Kaldırılamadı', e?.message ?? 'Bilinmeyen hata oluştu.');
    }
  }

  async function openShiftPicker(row: VehicleDriverRow, thenRemove: boolean) {
    if (!id) return;
    setRemoveTarget(null);
    setShiftPickerFor({ row, thenRemove });
    setSelectedShiftIds(new Set());
    setPickerLoading(true);
    try {
      const rows = await queryShifts({ vehicleIds: [id], driverId: row.driver_id });
      setPickerShifts(rows);
    } catch (e) {
      console.warn('Karpinler yüklenemedi', e);
      setPickerShifts([]);
    } finally {
      setPickerLoading(false);
    }
  }

  function toggleShiftSelected(shiftId: string) {
    setSelectedShiftIds((prev) => {
      const next = new Set(prev);
      if (next.has(shiftId)) next.delete(shiftId);
      else next.add(shiftId);
      return next;
    });
  }

  function toggleSelectAllShifts() {
    setSelectedShiftIds((prev) =>
      prev.size === pickerShifts.length ? new Set() : new Set(pickerShifts.map((s) => s.id))
    );
  }

  async function handleConfirmShiftDeletion() {
    if (!shiftPickerFor || !id) return;
    const { row, thenRemove } = shiftPickerFor;
    if (selectedShiftIds.size === 0) {
      Alert.alert('Seçim yok', 'Silmek için en az bir karpin seç (veya "Tümünü Seç"e bas).');
      return;
    }
    try {
      await deleteDriverShifts(id, row.driver_id, Array.from(selectedShiftIds));
      if (thenRemove) {
        await removeDriverFromVehicle(row.id, { vehicleId: id, driverId: row.driver_id, deleteShifts: false });
      }
      setShiftPickerFor(null);
      await load();
    } catch (e: any) {
      Alert.alert('Silinemedi', e?.message ?? 'Bilinmeyen hata oluştu.');
    }
  }

  // --- Karpin gorus suresi akisi ---

  function openVisibilityFlow() {
    if (drivers.length === 1) {
      pickVisibilityDriver(drivers[0]);
    } else {
      setVisibilityStep('pickDriver');
    }
  }

  function pickVisibilityDriver(row: VehicleDriverRow) {
    setVisibilityTarget(row);
    setVisibilityCustomInput(row.shift_visibility_days != null ? String(row.shift_visibility_days) : '');
    setVisibilityStep('pickDays');
  }

  async function saveVisibilityDays(days: number | null) {
    if (!visibilityTarget) return;
    setSavingVisibility(true);
    try {
      await setDriverShiftVisibilityDays(visibilityTarget.id, days);
      setVisibilityStep('closed');
      setVisibilityTarget(null);
      await load();
    } catch (e: any) {
      Alert.alert('Kaydedilemedi', e?.message ?? 'Bilinmeyen hata oluştu.');
    } finally {
      setSavingVisibility(false);
    }
  }

  function handleSaveCustomVisibility() {
    const raw = visibilityCustomInput.trim();
    if (!raw) {
      saveVisibilityDays(null);
      return;
    }
    const parsed = Number(raw.replace(',', '.'));
    if (Number.isNaN(parsed) || parsed <= 0) {
      Alert.alert('Geçersiz değer', 'Geçerli bir gün sayısı gir.');
      return;
    }
    saveVisibilityDays(Math.round(parsed));
  }

  // --- Sofor ekleme ---

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

  async function handleAssign() {
    if (!id) return;
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
      await assignDriver(id, driver.id);
      setPhone('');
      setShowAddDriver(false);
      await load();
    } catch (e: any) {
      Alert.alert('Eklenemedi', e?.message ?? 'Bilinmeyen hata oluştu.');
    } finally {
      setAssigning(false);
    }
  }

  if (loading || !vehicle) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  const keys = vehicle.enabled_expense_categories ?? DEFAULT_EXPENSE_CATEGORIES;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive">
        <ThemedText type="title" style={styles.title}>
          Ayarlar
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.plate}>
          {vehicle.plate_no}
        </ThemedText>

        <ThemedText type="eyebrow" style={styles.firstSectionTitle}>
          Çalışma Sistemi
        </ThemedText>
        {hasOpenShift ? (
          <ThemedText type="small" themeColor="textSecondary">
            Bu aracın şu an açık bir vardiyası var. Çalışma sistemini değiştirebilmek için önce
            vardiyanın kapatılması gerekiyor.
          </ThemedText>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            Bu değişiklik yalnızca bundan sonra açılacak vardiyaları etkiler - geçmiş karpinler
            kayıt edildikleri sistemde görünmeye devam eder.
          </ThemedText>
        )}
        <ThemedView style={[styles.roleRow, styles.transparentBg]}>
          <Pressable
            disabled={hasOpenShift}
            style={[
              styles.roleButton,
              { borderColor: theme.backgroundSelected },
              paymentModelChoice === 'percentage' && styles.roleButtonActive,
              hasOpenShift && styles.roleButtonDisabled,
            ]}
            onPress={() => setPaymentModelChoice('percentage')}>
            <ThemedText style={paymentModelChoice === 'percentage' ? styles.roleTextActive : undefined}>
              Yüzdelik
            </ThemedText>
          </Pressable>
          <Pressable
            disabled={hasOpenShift}
            style={[
              styles.roleButton,
              { borderColor: theme.backgroundSelected },
              paymentModelChoice === 'km_based' && styles.roleButtonActive,
              hasOpenShift && styles.roleButtonDisabled,
            ]}
            onPress={() => setPaymentModelChoice('km_based')}>
            <ThemedText style={paymentModelChoice === 'km_based' ? styles.roleTextActive : undefined}>
              Km Sistemi
            </ThemedText>
          </Pressable>
        </ThemedView>
        <ThemedView style={[styles.inlineRow, { marginTop: Spacing.three }]}>
          <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
            {paymentModelChoice === 'percentage' ? 'Şoför Payı (%)' : 'Km Başına Ücret (₺)'}
          </ThemedText>
          <TextInput
            editable={!hasOpenShift}
            style={[styles.smallInput, { color: theme.text, borderColor: theme.backgroundSelected, backgroundColor: theme.background }]}
            placeholder={paymentModelChoice === 'percentage' ? '25' : '0.00'}
            placeholderTextColor={theme.textSecondary}
            keyboardType="decimal-pad"
            value={paymentModelChoice === 'percentage' ? percentageRateInput : kmRateInput}
            onChangeText={paymentModelChoice === 'percentage' ? setPercentageRateInput : setKmRateInput}
          />
        </ThemedView>
        <Pressable
          disabled={hasOpenShift || savingPaymentModel}
          style={({ pressed }) => [
            styles.button,
            styles.paymentModelSaveButton,
            (hasOpenShift || savingPaymentModel || pressed) && styles.pressed,
          ]}
          onPress={handleSavePaymentModel}>
          <ThemedText style={styles.buttonText}>
            {savingPaymentModel ? 'Kaydediliyor...' : 'Çalışma Sistemini Kaydet'}
          </ThemedText>
        </Pressable>

        <ThemedText type="eyebrow" style={styles.sectionTitle}>
          Gider Kategorileri
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Şoför vardiya kapatırken hangi masraf kalemlerini görsün? (Yüzdelik veya km sistemi fark
          etmez, tüm araçlarda geçerlidir.)
        </ThemedText>
        <ThemedView style={styles.chipRow}>
          {EXPENSE_CATEGORIES.map((cat) => {
            const enabled = keys.includes(cat.key);
            return (
              <Pressable
                key={cat.key}
                onPress={() => handleToggleExpenseCategory(cat.key)}
                style={[styles.chip, { borderColor: theme.backgroundSelected }, enabled && styles.chipOn]}>
                <ThemedText type="small" style={enabled ? styles.chipTextOn : undefined}>
                  {enabled ? '✓ ' : ''}
                  {cat.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </ThemedView>

        <ThemedText type="eyebrow" style={styles.sectionTitle}>
          Şoförler
        </ThemedText>
        {drivers.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Henüz şoför eklenmedi.
          </ThemedText>
        ) : (
          <ThemedView style={styles.list}>
            {drivers.map((item) => (
              <ThemedView key={item.id} type="backgroundElement" style={styles.driverCard}>
                <ThemedView style={styles.driverCardHeader}>
                  <ThemedText type="smallBold">{item.driver?.full_name ?? 'İsimsiz'}</ThemedText>
                  <ThemedView style={[styles.driverCardActions, styles.transparentBg]}>
                    <Pressable onPress={() => openShiftPicker(item, false)} hitSlop={8}>
                      <ThemedText type="small" themeColor="textSecondary">
                        Karpin Sil
                      </ThemedText>
                    </Pressable>
                    <Pressable onPress={() => setRemoveTarget(item)} hitSlop={8}>
                      <ThemedText type="small" style={styles.removeText}>
                        Kaldır
                      </ThemedText>
                    </Pressable>
                  </ThemedView>
                </ThemedView>
                <ThemedText type="small" themeColor="textSecondary">
                  {item.driver?.phone ? `+${item.driver.phone}` : '-'}
                </ThemedText>
                {vehicle.payment_model === 'km_based' && (
                  <ThemedView style={styles.inlineRow}>
                    <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
                      Günlük Km Düşüm Hakkı
                    </ThemedText>
                    <TextInput
                      style={[styles.smallInput, { color: theme.text, borderColor: theme.backgroundSelected, backgroundColor: theme.background }]}
                      placeholder="Yok"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="number-pad"
                      value={limitInputs[item.id] ?? ''}
                      onChangeText={(v) => setLimitInputs((prev) => ({ ...prev, [item.id]: v }))}
                    />
                    <Pressable
                      style={({ pressed }) => [styles.smallSaveButton, pressed && styles.pressed]}
                      onPress={() => handleSaveLimit(item)}
                      disabled={savingLimitFor === item.id}>
                      <ThemedText type="linkPrimary" style={{ fontSize: 13 }}>
                        {savingLimitFor === item.id ? '...' : 'Kaydet'}
                      </ThemedText>
                    </Pressable>
                  </ThemedView>
                )}
              </ThemedView>
            ))}
          </ThemedView>
        )}

        <ThemedText type="eyebrow" style={styles.sectionTitle}>
          Karpin Görüş Süresi
        </ThemedText>
        {drivers.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Önce şoför ekle.
          </ThemedText>
        ) : (
          <ThemedView style={[styles.visibilityList, styles.transparentBg]}>
            {drivers.map((row) => (
              <Pressable key={row.id} onPress={() => pickVisibilityDriver(row)} style={styles.visibilityRow}>
                <ThemedText type="small">{row.driver?.full_name ?? 'İsimsiz'}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {row.shift_visibility_days != null ? `${row.shift_visibility_days} gün` : 'Sınırsız'}
                </ThemedText>
              </Pressable>
            ))}
          </ThemedView>
        )}
        <Pressable style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]} onPress={openVisibilityFlow}>
          <ThemedText type="linkPrimary">+ Karpin Görüş Süresi Ekle</ThemedText>
        </Pressable>

        {showAddDriver ? (
          <>
            <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
              Şoförün önce uygulamaya &quot;Şoför&quot; olarak kayıt olmuş olması gerekir.
            </ThemedText>
            <PhoneInput value={phone} onChangeText={setPhone} />
            <Pressable
              style={({ pressed }) => [styles.button, (assigning || pressed) && styles.pressed]}
              onPress={handleAssign}
              disabled={assigning}>
              <ThemedText style={styles.buttonText}>{assigning ? 'Ekleniyor...' : 'Şoför Ekle'}</ThemedText>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]} onPress={handleInvite}>
              <ThemedText type="linkPrimary">Şoförü davet et (link gönder)</ThemedText>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
              onPress={() => setShowAddDriver(false)}>
              <ThemedText type="small" themeColor="textSecondary">
                Vazgeç
              </ThemedText>
            </Pressable>
          </>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.addDriverButton, pressed && styles.pressed]}
            onPress={() => setShowAddDriver(true)}>
            <ThemedText type="linkPrimary">+ Şoför Ekle</ThemedText>
          </Pressable>
        )}
      </ScrollView>

      {/* Şoförü kaldır: karpinler ne olsun? */}
      <ActionSheetModal
        visible={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title="Şoförü Kaldır"
        description={`${removeTarget?.driver?.full_name ?? 'Bu şoför'} bu araçtan kaldırılacak. Bu şoförün karpinleri ne olsun?`}>
        <Pressable style={[styles.sheetButton, styles.sheetButtonPrimary]} onPress={handleKeepShiftsAndRemove}>
          <ThemedText style={styles.sheetButtonPrimaryText}>Karpinler Kalsın, Kaldır</ThemedText>
        </Pressable>
        <Pressable
          style={styles.sheetButton}
          onPress={() => removeTarget && openShiftPicker(removeTarget, true)}>
          <ThemedText type="smallBold">Seçerek Sil ve Kaldır</ThemedText>
        </Pressable>
        <Pressable style={[styles.sheetButton, styles.sheetButtonDanger]} onPress={handleDeleteAllAndRemove}>
          <ThemedText style={styles.sheetButtonDangerText}>Tüm Karpinleri Sil ve Kaldır</ThemedText>
        </Pressable>
        <Pressable style={styles.sheetCancelButton} onPress={() => setRemoveTarget(null)}>
          <ThemedText type="small" themeColor="textSecondary">
            Vazgeç
          </ThemedText>
        </Pressable>
      </ActionSheetModal>

      {/* Karpin seç ve sil (tek tek veya tümünü) */}
      <ActionSheetModal
        visible={!!shiftPickerFor}
        onClose={() => setShiftPickerFor(null)}
        title="Karpin Seç"
        description={`${shiftPickerFor?.row.driver?.full_name ?? 'Şoförün'} bu araçtaki karpinlerinden silinecekleri seç.`}>
        {pickerLoading ? (
          <ActivityIndicator />
        ) : pickerShifts.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
            Bu şoförün bu araçta kayıtlı karpini yok.
          </ThemedText>
        ) : (
          <>
            <Pressable style={styles.selectAllRow} onPress={toggleSelectAllShifts}>
              <ThemedText type="linkPrimary">
                {selectedShiftIds.size === pickerShifts.length ? 'Seçimi Kaldır' : 'Tümünü Seç'}
              </ThemedText>
            </Pressable>
            <ScrollView style={styles.shiftPickerList}>
              {pickerShifts.map((s) => {
                const selected = selectedShiftIds.has(s.id);
                const amount = s.owner_total ?? s.km_debt ?? s.total_amount ?? 0;
                return (
                  <Pressable
                    key={s.id}
                    style={[styles.shiftPickerRow, selected && styles.shiftPickerRowSelected]}
                    onPress={() => toggleShiftSelected(s.id)}>
                    <ThemedView style={[styles.checkbox, selected && styles.checkboxOn, styles.transparentBg]}>
                      {selected && <ThemedText style={styles.checkboxMark}>✓</ThemedText>}
                    </ThemedView>
                    <ThemedView style={[{ flex: 1 }, styles.transparentBg]}>
                      <ThemedText type="small">
                        {s.shift_no != null ? `#${s.shift_no} · ` : ''}
                        {formatDateTime(s.opened_at)}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {amount.toFixed(2)} ₺
                      </ThemedText>
                    </ThemedView>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        )}
        <Pressable style={[styles.sheetButton, styles.sheetButtonDanger]} onPress={handleConfirmShiftDeletion}>
          <ThemedText style={styles.sheetButtonDangerText}>
            {selectedShiftIds.size > 0 ? `Seçilen ${selectedShiftIds.size} Karpini Sil` : 'Karpinleri Sil'}
          </ThemedText>
        </Pressable>
        <Pressable style={styles.sheetCancelButton} onPress={() => setShiftPickerFor(null)}>
          <ThemedText type="small" themeColor="textSecondary">
            Vazgeç
          </ThemedText>
        </Pressable>
      </ActionSheetModal>

      {/* Karpin gorus suresi: 1) hangi sofor 2) kac gun */}
      <ActionSheetModal
        visible={visibilityStep === 'pickDriver'}
        onClose={() => setVisibilityStep('closed')}
        title="Hangi Şoför İçin?">
        {drivers.map((row) => (
          <Pressable key={row.id} style={styles.sheetButton} onPress={() => pickVisibilityDriver(row)}>
            <ThemedText type="smallBold">{row.driver?.full_name ?? 'İsimsiz'}</ThemedText>
          </Pressable>
        ))}
        <Pressable style={styles.sheetCancelButton} onPress={() => setVisibilityStep('closed')}>
          <ThemedText type="small" themeColor="textSecondary">
            Vazgeç
          </ThemedText>
        </Pressable>
      </ActionSheetModal>

      <ActionSheetModal
        visible={visibilityStep === 'pickDays'}
        onClose={() => setVisibilityStep('closed')}
        title="Kaç Gün Görsün?"
        description={`${visibilityTarget?.driver?.full_name ?? 'Şoför'} kendi panelinde bu aracın karpinlerini kaç gün görsün? Süre dolunca karpin sadece şoförün görünümünden kaybolur, senin tarafında hep kalır.`}>
        <ThemedView style={[styles.quickDaysRow, styles.transparentBg]}>
          {VISIBILITY_QUICK_DAYS.map((d) => (
            <Pressable
              key={d}
              style={[styles.quickDayChip, visibilityTarget?.shift_visibility_days === d && styles.quickDayChipActive]}
              onPress={() => saveVisibilityDays(d)}
              disabled={savingVisibility}>
              <ThemedText
                type="small"
                style={visibilityTarget?.shift_visibility_days === d ? styles.quickDayChipTextActive : undefined}>
                {d} gün
              </ThemedText>
            </Pressable>
          ))}
        </ThemedView>
        <ThemedView style={[styles.inlineRow, styles.transparentBg]}>
          <TextInput
            style={[styles.smallInput, { flex: 1, color: theme.text, borderColor: theme.backgroundSelected, backgroundColor: theme.background }]}
            placeholder="Özel gün sayısı"
            placeholderTextColor={theme.textSecondary}
            keyboardType="number-pad"
            value={visibilityCustomInput}
            onChangeText={setVisibilityCustomInput}
          />
          <Pressable
            style={({ pressed }) => [styles.smallSaveButton, pressed && styles.pressed]}
            onPress={handleSaveCustomVisibility}
            disabled={savingVisibility}>
            <ThemedText type="linkPrimary">Kaydet</ThemedText>
          </Pressable>
        </ThemedView>
        <Pressable style={styles.sheetButton} onPress={() => saveVisibilityDays(null)} disabled={savingVisibility}>
          <ThemedText type="smallBold">Sınırsız (Her Zaman Görsün)</ThemedText>
        </Pressable>
        <Pressable style={styles.sheetCancelButton} onPress={() => setVisibilityStep('closed')}>
          <ThemedText type="small" themeColor="textSecondary">
            Vazgeç
          </ThemedText>
        </Pressable>
      </ActionSheetModal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { paddingHorizontal: Spacing.four, paddingTop: Spacing.six, paddingBottom: Spacing.six, gap: Spacing.two },
  title: { marginBottom: Spacing.one },
  plate: { marginBottom: Spacing.two },
  firstSectionTitle: {},
  sectionTitle: { marginTop: Spacing.five },
  transparentBg: { backgroundColor: 'transparent' },
  roleRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.three },
  roleButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  roleButtonActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  roleButtonDisabled: { opacity: 0.5 },
  roleTextActive: { color: Brand.onPrimary, fontFamily: FontFamily.bodyBold },
  paymentModelSaveButton: { marginTop: Spacing.three, marginBottom: Spacing.two },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.three, backgroundColor: 'transparent' },
  chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: 999, borderWidth: 1 },
  chipOn: { backgroundColor: '#2563EB1F', borderColor: '#2563EB' },
  chipTextOn: { color: '#1D4ED8', fontFamily: FontFamily.bodyBold },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.two, backgroundColor: 'transparent' },
  smallInput: {
    borderWidth: 1.5,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minWidth: 92,
    fontSize: 17,
    fontFamily: FontFamily.bodyBold,
    textAlign: 'right',
  },
  smallSaveButton: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.one },
  list: { gap: Spacing.two, marginTop: Spacing.two, backgroundColor: 'transparent' },
  driverCard: { padding: Spacing.three, gap: Spacing.half },
  driverCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'transparent' },
  driverCardActions: { flexDirection: 'row', gap: Spacing.three },
  removeText: { color: '#DC2626' },
  visibilityList: { gap: Spacing.half, marginTop: Spacing.two },
  visibilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderColor: '#94A3B833',
    borderRadius: Spacing.two,
  },
  hint: { marginTop: Spacing.two, marginBottom: Spacing.one },
  button: {
    backgroundColor: Brand.primary,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  linkButton: { alignItems: 'center', marginTop: Spacing.three },
  addDriverButton: { alignItems: 'center', marginTop: Spacing.four, paddingVertical: Spacing.two },
  pressed: { opacity: 0.7 },
  buttonText: { color: Brand.onPrimary, fontFamily: FontFamily.bodyBold, fontSize: 16 },
  sheetButton: {
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#94A3B8',
  },
  sheetButtonPrimary: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  sheetButtonPrimaryText: { color: Brand.onPrimary, fontFamily: FontFamily.bodyBold },
  sheetButtonDanger: { backgroundColor: '#FEE2E2', borderColor: '#DC2626' },
  sheetButtonDangerText: { color: '#DC2626', fontFamily: FontFamily.bodyBold },
  sheetCancelButton: { alignItems: 'center', paddingVertical: Spacing.two },
  selectAllRow: { alignItems: 'flex-end' },
  shiftPickerList: { maxHeight: 260 },
  shiftPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#94A3B833',
  },
  shiftPickerRowSelected: { backgroundColor: '#FFC40022' },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  checkboxMark: { color: Brand.onPrimary, fontSize: 14, fontFamily: FontFamily.bodyBold },
  quickDaysRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  quickDayChip: {
    borderWidth: 1,
    borderColor: '#94A3B8',
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  quickDayChipActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  quickDayChipTextActive: { color: Brand.onPrimary, fontFamily: FontFamily.bodyBold },
});
