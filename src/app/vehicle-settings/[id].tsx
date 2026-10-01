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

import { PhoneInput } from '@/components/phone-input';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DEFAULT_EXPENSE_CATEGORIES, EXPENSE_CATEGORIES } from '@/lib/expense-categories';
import { formatPhoneWithPrefix } from '@/lib/format';
import { getAnyOpenShift } from '@/lib/shifts';
import {
  assignDriver,
  findDriverByPhone,
  listVehicleDrivers,
  setDriverDailyKmLimit,
  setDriverShiftVisibilityDays,
  unassignDriver,
  type VehicleDriverRow,
} from '@/lib/vehicle-drivers';
import {
  getVehicle,
  setEnabledExpenseCategories,
  setExpectedRevenuePerKm,
  updateVehiclePaymentModel,
  type PaymentModel,
  type Vehicle,
} from '@/lib/vehicles';

/** Aracin ayar sayfasi: gider kategorileri, km karsilastirma orani ve
 * sofor yonetimi (ekleme/silme, km dusum hakki) burada toplandi - arac
 * detay sayfasi sadece plaka + vardiya gecmisine linkten ibaret kalsin diye. */
export default function VehicleSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [drivers, setDrivers] = useState<VehicleDriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);

  const [revenueRateInput, setRevenueRateInput] = useState('');
  const [savingRevenueRate, setSavingRevenueRate] = useState(false);

  const [paymentModelChoice, setPaymentModelChoice] = useState<PaymentModel>('percentage');
  const [percentageRateInput, setPercentageRateInput] = useState('25');
  const [kmRateInput, setKmRateInput] = useState('');
  const [savingPaymentModel, setSavingPaymentModel] = useState(false);
  const [hasOpenShift, setHasOpenShift] = useState(false);

  const [limitInputs, setLimitInputs] = useState<Record<string, string>>({});
  const [savingLimitFor, setSavingLimitFor] = useState<string | null>(null);

  const [visibilityInputs, setVisibilityInputs] = useState<Record<string, string>>({});
  const [savingVisibilityFor, setSavingVisibilityFor] = useState<string | null>(null);

  const [phone, setPhone] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [showAddDriver, setShowAddDriver] = useState(false);

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
      setRevenueRateInput(v.expected_revenue_per_km != null ? String(v.expected_revenue_per_km) : '');
      setLimitInputs(
        Object.fromEntries(
          d.map((row) => [row.id, row.daily_km_discount_limit != null ? String(row.daily_km_discount_limit) : ''])
        )
      );
      setVisibilityInputs(
        Object.fromEntries(
          d.map((row) => [row.id, row.shift_visibility_days != null ? String(row.shift_visibility_days) : ''])
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

  async function handleSaveRevenueRate() {
    if (!vehicle) return;
    const raw = revenueRateInput.trim();
    const parsed = raw ? Number(raw.replace(',', '.')) : null;
    if (raw && (Number.isNaN(parsed) || (parsed as number) < 0)) {
      Alert.alert('Geçersiz değer', 'Geçerli bir TL/km değeri gir (boş bırakırsan karşılaştırma kapanır).');
      return;
    }
    setSavingRevenueRate(true);
    try {
      await setExpectedRevenuePerKm(vehicle.id, parsed);
      await load();
    } catch (e: any) {
      Alert.alert('Kaydedilemedi', e?.message ?? 'Bilinmeyen hata oluştu.');
    } finally {
      setSavingRevenueRate(false);
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

  async function handleSaveVisibility(row: VehicleDriverRow) {
    const raw = visibilityInputs[row.id] ?? '';
    const parsed = raw.trim() ? Number(raw.replace(',', '.')) : null;
    if (raw.trim() && (Number.isNaN(parsed) || (parsed as number) <= 0)) {
      Alert.alert(
        'Geçersiz değer',
        'Geçerli bir gün sayısı gir (boş bırakırsan şoför karpinlerini süresiz görür).'
      );
      return;
    }
    setSavingVisibilityFor(row.id);
    try {
      await setDriverShiftVisibilityDays(row.id, parsed);
      await load();
    } catch (e: any) {
      Alert.alert('Kaydedilemedi', e?.message ?? 'Bilinmeyen hata oluştu.');
    } finally {
      setSavingVisibilityFor(null);
    }
  }

  function handleRemoveDriver(row: VehicleDriverRow) {
    Alert.alert(
      'Şoförü Kaldır',
      `${row.driver?.full_name ?? 'Bu şoförü'} bu araçtan kaldırmak istediğine emin misin? Geçmiş vardiyaları silinmez, sadece bu araca erişimi kalkar.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Kaldır',
          style: 'destructive',
          onPress: async () => {
            try {
              await unassignDriver(row.id);
              await load();
            } catch (e: any) {
              Alert.alert('Kaldırılamadı', e?.message ?? 'Bilinmeyen hata oluştu.');
            }
          },
        },
      ]
    );
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

      {vehicle.payment_model === 'percentage' && (
        <>
          <ThemedText type="eyebrow" style={styles.sectionTitle}>
            Km Karşılaştırma
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Bu araç km başına normal şartlarda ortalama ne kadar hasılat yapar? Girersen, her
            vardiyada kat edilen km'ye göre beklenen hasılatla gerçek hasılat karşılaştırılıp
            kâr/zarar durumu gösterilir.
          </ThemedText>
          <ThemedView style={styles.inlineRow}>
            <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
              Beklenen Km Başı Hasılat (₺/km)
            </ThemedText>
            <TextInput
              style={[styles.smallInput, { color: theme.text, borderColor: theme.backgroundSelected, backgroundColor: theme.background }]}
              placeholder="Yok"
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
              value={revenueRateInput}
              onChangeText={setRevenueRateInput}
            />
            <Pressable
              style={({ pressed }) => [styles.smallSaveButton, pressed && styles.pressed]}
              onPress={handleSaveRevenueRate}
              disabled={savingRevenueRate}>
              <ThemedText type="linkPrimary" style={{ fontSize: 13 }}>
                {savingRevenueRate ? '...' : 'Kaydet'}
              </ThemedText>
            </Pressable>
          </ThemedView>
        </>
      )}

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
                <Pressable onPress={() => handleRemoveDriver(item)} hitSlop={8}>
                  <ThemedText type="small" style={styles.removeText}>
                    Kaldır
                  </ThemedText>
                </Pressable>
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
              <ThemedText type="small" themeColor="textSecondary" style={styles.visibilityHint}>
                Bu şoför kendi panelinde karpinlerini kaç gün görsün? (Boş = sınırsız. Bu süre
                dolunca karpin sadece şoförün görünümünden kaybolur, senin tarafında hep kalır.)
              </ThemedText>
              <ThemedView style={styles.inlineRow}>
                <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
                  Şoför Panelinde Görünme Süresi (gün)
                </ThemedText>
                <TextInput
                  style={[styles.smallInput, { color: theme.text, borderColor: theme.backgroundSelected, backgroundColor: theme.background }]}
                  placeholder="Sınırsız"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="number-pad"
                  value={visibilityInputs[item.id] ?? ''}
                  onChangeText={(v) => setVisibilityInputs((prev) => ({ ...prev, [item.id]: v }))}
                />
                <Pressable
                  style={({ pressed }) => [styles.smallSaveButton, pressed && styles.pressed]}
                  onPress={() => handleSaveVisibility(item)}
                  disabled={savingVisibilityFor === item.id}>
                  <ThemedText type="linkPrimary" style={{ fontSize: 13 }}>
                    {savingVisibilityFor === item.id ? '...' : 'Kaydet'}
                  </ThemedText>
                </Pressable>
              </ThemedView>
            </ThemedView>
          ))}
        </ThemedView>
      )}

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
  removeText: { color: '#DC2626' },
  visibilityHint: { marginTop: Spacing.two },
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
});
