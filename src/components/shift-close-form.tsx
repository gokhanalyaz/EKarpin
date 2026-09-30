import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { closeShift, formatDuration, getShiftDurationMinutes, getUsedKmDiscountToday, type Shift } from '@/lib/shifts';
import { getOwnerPushToken, sendPushNotification } from '@/lib/notifications';
import { getDriverDailyKmLimit, listVehicleDrivers, type VehicleDriverRow } from '@/lib/vehicle-drivers';
import { EXPENSE_CATEGORIES, DEFAULT_EXPENSE_CATEGORIES, type ExpenseItem } from '@/lib/expense-categories';
import type { Vehicle } from '@/lib/vehicles';

type Props = {
  shift: Shift;
  vehicle: Vehicle;
  onClosed: () => void;
};

export function ShiftCloseForm({ shift, vehicle, onClosed }: Props) {
  const theme = useTheme();
  const { profile } = useAuth();
  const [drivers, setDrivers] = useState<VehicleDriverRow[]>([]);
  const [handedTo, setHandedTo] = useState<string | null>(null);

  const [closingKm, setClosingKm] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const [totalAmount, setTotalAmount] = useState('');
  const [cardAmount, setCardAmount] = useState('');
  const [fuelCost, setFuelCost] = useState('');
  const [expenseAmounts, setExpenseAmounts] = useState<Record<string, string>>({});
  const [expenseNote, setExpenseNote] = useState('');
  const [fuelReceiptUri, setFuelReceiptUri] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [showNotePhoto, setShowNotePhoto] = useState(false);
  const [notePhotoUri, setNotePhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [kmDiscountLimit, setKmDiscountLimit] = useState<number | null>(null);
  const [kmDiscountUsedToday, setKmDiscountUsedToday] = useState(0);
  const [kmDiscount, setKmDiscount] = useState('');
  const [kmDiscountNote, setKmDiscountNote] = useState('');

  const isPercentage = vehicle.payment_model === 'percentage';

  const enabledExpenseCategoryKeys = vehicle.enabled_expense_categories ?? DEFAULT_EXPENSE_CATEGORIES;
  const enabledExpenseCategories = EXPENSE_CATEGORIES.filter((c) =>
    enabledExpenseCategoryKeys.includes(c.key)
  );

  useEffect(() => {
    listVehicleDrivers(vehicle.id)
      .then((rows) => {
        setDrivers(rows);
        const other = rows.find((r) => r.driver_id !== profile?.id);
        setHandedTo(other?.driver_id ?? rows[0]?.driver_id ?? null);
      })
      .catch(() => {});
  }, [vehicle.id, profile?.id]);

  useEffect(() => {
    if (isPercentage || !profile) return;
    getDriverDailyKmLimit(vehicle.id, profile.id)
      .then((limit) => {
        setKmDiscountLimit(limit);
        if (limit != null) {
          return getUsedKmDiscountToday(vehicle.id, profile.id).then(setKmDiscountUsedToday);
        }
      })
      .catch(() => {});
  }, [vehicle.id, profile?.id, isPercentage]);

  const kmDiscountRemaining =
    kmDiscountLimit != null ? Math.max(0, kmDiscountLimit - kmDiscountUsedToday) : null;
  const kmDiscountValue = num(kmDiscount);

  function num(value: string): number {
    const n = Number(value.replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }

  const otherExpensesTotal = enabledExpenseCategories.reduce(
    (sum, cat) => sum + num(expenseAmounts[cat.key] ?? ''),
    0
  );
  const base = num(totalAmount) - num(fuelCost) - otherExpensesTotal;
  const driverShare = isPercentage ? base * ((vehicle.percentage_rate ?? 25) / 100) : 0;
  // Toplam (nakit + kredi karti) once hesaplanir, nakit kismi bundan kredi
  // kartinin cikarilmasiyla bulunur (kredi karti, hasilatin bir PARCASIdir).
  const ownerTotal = base - driverShare;
  const netCash = ownerTotal - num(cardAmount);

  const kmValue = Number(closingKm.replace(',', '.'));
  const kmTotal =
    !Number.isNaN(kmValue) && shift.opening_km != null ? kmValue - shift.opening_km : null;
  const billableKmTotal = kmTotal != null ? Math.max(0, kmTotal - kmDiscountValue) : null;
  const kmDebt = billableKmTotal != null ? billableKmTotal * (vehicle.km_rate ?? 0) : null;

  async function handleTakePhoto() {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('İzin gerekli', 'Km fotoğrafı çekebilmek için kamera izni vermelisin.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: false });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (e) {
      Alert.alert('Fotoğraf alınamadı', 'Kamera açılırken bir sorun oluştu, fotoğrafsız devam edebilirsin.');
    }
  }

  async function handleAddFuelReceipt() {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('İzin gerekli', 'Fiş fotoğrafı için kamera izni vermelisin.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.6 });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setFuelReceiptUri(result.assets[0].uri);
      }
    } catch (e) {
      Alert.alert('Fotoğraf alınamadı', 'Kamera açılırken bir sorun oluştu, fişsiz devam edebilirsin.');
    }
  }

  async function handleTakeNotePhoto() {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('İzin gerekli', 'Fotoğraf çekebilmek için kamera izni vermelisin.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: false });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setNotePhotoUri(result.assets[0].uri);
      }
    } catch (e) {
      Alert.alert('Fotoğraf alınamadı', 'Kamera açılırken bir sorun oluştu.');
    }
  }

  async function handleClose() {
    if (!closingKm || Number.isNaN(kmValue)) {
      Alert.alert('Km gerekli', 'Geçerli bir kapanış km değeri girin.');
      return;
    }
    if (shift.opening_km != null && kmValue < shift.opening_km) {
      Alert.alert('Km hatalı', "Kapanış km, açılış km'den (" + shift.opening_km + ') küçük olamaz.');
      return;
    }
    if (!handedTo) {
      Alert.alert('Teslim edilecek şoför', 'Aracı devredeceğin şoförü seç.');
      return;
    }
    if (isPercentage && !totalAmount) {
      Alert.alert('Tutar gerekli', 'Günün hasılat tutarını gir.');
      return;
    }
    if (!isPercentage && kmDiscountValue > 0) {
      if (kmDiscountRemaining != null && kmDiscountValue > kmDiscountRemaining) {
        Alert.alert('Km düşümü fazla', `Bugün için kalan km düşüm hakkın ${kmDiscountRemaining} km.`);
        return;
      }
      if (!kmDiscountNote.trim()) {
        Alert.alert('Açıklama gerekli', 'Km düşümü için kısa bir açıklama yaz (örn. müşteri iptal etti).');
        return;
      }
    }

    setSubmitting(true);
    try {
      let photoErrorMessage: string | null = null;
      await closeShift(
        {
          shiftId: shift.id,
          vehicle,
          closingKm: kmValue,
          photoUri,
          handedToDriverId: handedTo,
          totalAmount: isPercentage ? num(totalAmount) : undefined,
          fuelCost: isPercentage ? num(fuelCost) : undefined,
          fuelReceiptUri: isPercentage && fuelReceiptUri ? fuelReceiptUri : undefined,
          expenseItems: isPercentage
            ? (enabledExpenseCategories
                .map((cat): ExpenseItem | null => {
                  const amount = num(expenseAmounts[cat.key] ?? '');
                  if (amount <= 0) return null;
                  return {
                    category: cat.key,
                    amount,
                    note: cat.key === 'diger' && expenseNote.trim() ? expenseNote.trim() : undefined,
                  };
                })
                .filter((item): item is ExpenseItem => item !== null))
            : undefined,
          cardAmount: isPercentage ? num(cardAmount) : undefined,
          notes: notes.trim() ? notes.trim() : undefined,
          notesPhotoUri: notePhotoUri,
          kmDiscount: !isPercentage && kmDiscountValue > 0 ? kmDiscountValue : undefined,
          kmDiscountNote: !isPercentage && kmDiscountValue > 0 ? kmDiscountNote.trim() : undefined,
        },
        {
          onPhotoError: (errors) => {
            photoErrorMessage = [errors.closing, errors.notes].filter(Boolean).join('\n');
          },
        }
      );

      if (photoErrorMessage) {
        Alert.alert('Fotoğraf Yüklenemedi', `Vardiya kapandı ama fotoğraf sunucuya yüklenemedi:\n${photoErrorMessage}`);
      }

      getOwnerPushToken(vehicle.id)
        .then((token) => {
          if (!token) return;
          const driverName = profile?.full_name ?? 'Bir şoför';
          return sendPushNotification(
            token,
            'Karpin Kapatıldı',
            `${driverName}, ${vehicle.plate_no} plakalı aracın karpinini kapattı.`,
            { type: 'shift_closed', shiftId: shift.id, vehicleId: vehicle.id }
          );
        })
        .catch(() => {});

      const minutes = getShiftDurationMinutes(shift.opened_at, new Date().toISOString());
      const durationLine = minutes != null ? `Çalışma süren: ${formatDuration(minutes)}` : '';
      const shareLine = isPercentage ? `Sana kalan (ondalık): ${driverShare.toFixed(2)} ₺` : '';
      Alert.alert(
        'Vardiya Kapatıldı',
        [durationLine, shareLine].filter(Boolean).join('\n'),
        [{ text: 'Tamam', onPress: onClosed }]
      );
      return;
    } catch (e: any) {
      Alert.alert('Vardiya kapatılamadı', e?.message ?? 'Bilinmeyen hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Vardiya Kapat
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={{ opacity: 0.4 }}>
        build-check: PD-04
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {vehicle.plate_no} · Açılış km: {shift.opening_km ?? '-'}
      </ThemedText>

      <ThemedText type="smallBold" style={styles.sectionTitle}>
        Kapanış Km
      </ThemedText>
      <TextInput
        style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
        placeholder="Örn. 125610"
        placeholderTextColor={theme.textSecondary}
        keyboardType="number-pad"
        value={closingKm}
        onChangeText={setClosingKm}
      />
      {kmTotal != null && kmTotal >= 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          Toplam km: {kmTotal}
        </ThemedText>
      )}

      {!isPercentage && kmDiscountLimit != null && (
        <>
          <ThemedText type="smallBold" style={styles.sectionTitle}>
            Km Düşümü (İsteğe Bağlı)
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
            Bugün için kalan hakkın: {kmDiscountRemaining} km. Örn. müşteri iptal etti, durağa
            boş dönmek zorunda kaldın gibi durumlarda kullan.
          </ThemedText>
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
            placeholder="0"
            placeholderTextColor={theme.textSecondary}
            keyboardType="number-pad"
            value={kmDiscount}
            onChangeText={setKmDiscount}
          />
          {kmDiscountValue > 0 && (
            <TextInput
              style={[styles.input, styles.noteInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
              placeholder="Açıklama (zorunlu) — örn. müşteri iptal etti"
              placeholderTextColor={theme.textSecondary}
              value={kmDiscountNote}
              onChangeText={setKmDiscountNote}
              multiline
            />
          )}
        </>
      )}

      <ThemedText type="smallBold" style={styles.sectionTitle}>
        Km Sayacı Fotoğrafı
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
        İsteğe bağlı — sadece kameradan çekilebilir, galeriden yükleme yapılamaz.
      </ThemedText>
      {photoUri ? <Image source={{ uri: photoUri }} style={styles.preview} /> : null}
      <Pressable
        style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
        onPress={handleTakePhoto}>
        <ThemedText type="linkPrimary">
          {photoUri ? 'Fotoğrafı Yeniden Çek' : 'Fotoğraf Çek'}
        </ThemedText>
      </Pressable>

      {isPercentage && (
        <>
          <ThemedText type="smallBold" style={styles.sectionTitle}>
            Tutar (Hasılat)
          </ThemedText>
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
            placeholder="₺"
            placeholderTextColor={theme.textSecondary}
            keyboardType="decimal-pad"
            value={totalAmount}
            onChangeText={setTotalAmount}
          />

          <ThemedText type="smallBold" style={styles.sectionTitle}>
            Kredi Kartı
          </ThemedText>
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
            placeholder="₺"
            placeholderTextColor={theme.textSecondary}
            keyboardType="decimal-pad"
            value={cardAmount}
            onChangeText={setCardAmount}
          />

          <ThemedText type="smallBold" style={styles.sectionTitle}>
            Motorin
          </ThemedText>
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
            placeholder="₺"
            placeholderTextColor={theme.textSecondary}
            keyboardType="decimal-pad"
            value={fuelCost}
            onChangeText={setFuelCost}
          />

          {fuelCost.trim().length > 0 && (
            <>
              <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
                Fişi sadece kameradan çekebilirsin, galeriden yükleme yapılamaz.
              </ThemedText>
              {fuelReceiptUri ? (
                <Image source={{ uri: fuelReceiptUri }} style={styles.receiptPreview} />
              ) : null}
              <Pressable
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
                onPress={handleAddFuelReceipt}>
                <ThemedText type="linkPrimary">
                  {fuelReceiptUri ? 'Fişi Yeniden Çek' : 'Fiş Ekle'}
                </ThemedText>
              </Pressable>
            </>
          )}

          {enabledExpenseCategories.length > 0 && (
          <ThemedText type="smallBold" style={styles.sectionTitle}>
            Diğer Masraflar
          </ThemedText>
          )}
          {enabledExpenseCategories.map((cat) => (
            <ThemedView key={cat.key} style={styles.expenseRow}>
              <ThemedText type="small" style={styles.expenseLabel}>
                {cat.label}
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  styles.expenseInput,
                  { color: theme.text, borderColor: theme.backgroundSelected },
                ]}
                placeholder="₺"
                placeholderTextColor={theme.textSecondary}
                keyboardType="decimal-pad"
                value={expenseAmounts[cat.key] ?? ''}
                onChangeText={(v) => setExpenseAmounts((prev) => ({ ...prev, [cat.key]: v }))}
              />
            </ThemedView>
          ))}
          {(expenseAmounts['diger'] ?? '').trim().length > 0 && (
            <TextInput
              style={[
                styles.input,
                styles.noteInput,
                { color: theme.text, borderColor: theme.backgroundSelected },
              ]}
              placeholder="Diğer masraf ne içindi? (örn. lastik tamiri)"
              placeholderTextColor={theme.textSecondary}
              value={expenseNote}
              onChangeText={setExpenseNote}
              multiline
            />
          )}
          {otherExpensesTotal > 0 && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
              Toplam diğer masraf: {otherExpensesTotal.toFixed(2)} ₺
            </ThemedText>
          )}

          <ThemedView type="backgroundElement" style={styles.summary}>
            <ThemedText type="small">
              Ondalık (%{vehicle.percentage_rate ?? 25}): {driverShare.toFixed(2)} ₺
            </ThemedText>
            <ThemedText type="small">Net Nakit: {netCash.toFixed(2)} ₺</ThemedText>
          </ThemedView>
        </>
      )}

      <ThemedText type="smallBold" style={styles.sectionTitle}>
        Not (Araç Sahibine)
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
        İletmek istediğin ekstra bilgi varsa buraya yaz — isteğe bağlı.
      </ThemedText>
      <TextInput
        style={[
          styles.input,
          styles.noteInput,
          { color: theme.text, borderColor: theme.backgroundSelected },
        ]}
        placeholder="Örn. yarın lastik kontrolü gerekiyor"
        placeholderTextColor={theme.textSecondary}
        value={notes}
        onChangeText={setNotes}
        multiline
      />

      {!showNotePhoto ? (
        <Pressable
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
          onPress={() => setShowNotePhoto(true)}>
          <ThemedText type="linkPrimary">+ Fotoğraf Eklemek İster misiniz?</ThemedText>
        </Pressable>
      ) : (
        <>
          {notePhotoUri ? (
            <Image source={{ uri: notePhotoUri }} style={styles.receiptPreview} />
          ) : null}
          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
            onPress={handleTakeNotePhoto}>
            <ThemedText type="linkPrimary">
              {notePhotoUri ? 'Fotoğrafı Yeniden Çek' : 'Fotoğraf Çek'}
            </ThemedText>
          </Pressable>
        </>
      )}

      <ThemedText type="smallBold" style={styles.sectionTitle}>
        Aracı Teslim Et
      </ThemedText>
      {drivers.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Bu araca atanmış başka şoför yok, araç sahibinle iletişime geç.
        </ThemedText>
      ) : (
        <ThemedView style={styles.driverRow}>
          {drivers.map((d) => (
            <Pressable
              key={d.driver_id}
              style={[
                styles.driverChip,
                { borderColor: theme.backgroundSelected },
                handedTo === d.driver_id && styles.driverChipActive,
              ]}
              onPress={() => setHandedTo(d.driver_id)}>
              <ThemedText style={handedTo === d.driver_id ? styles.driverChipTextActive : undefined}>
                {d.driver?.full_name ?? 'İsimsiz'}
                {d.driver_id === profile?.id ? ' (Ben)' : ''}
              </ThemedText>
            </Pressable>
          ))}
        </ThemedView>
      )}

      {isPercentage && (
        <ThemedView style={styles.driverShareBox}>
          <ThemedText type="small" themeColor="textSecondary">
            Sana Kalan (Ondalık)
          </ThemedText>
          <ThemedText style={styles.driverShareAmount}>{driverShare.toFixed(2)} ₺</ThemedText>
        </ThemedView>
      )}

      <ThemedView style={styles.finalBox}>
        {isPercentage ? (
          num(cardAmount) > 0 ? (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                Net Kalan
              </ThemedText>
              <ThemedText style={styles.finalAmount}>{ownerTotal.toFixed(2)} ₺</ThemedText>
              <ThemedText type="smallBold" style={styles.cashLabel}>
                Nakit Tutar: {netCash.toFixed(2)} ₺
              </ThemedText>
            </>
          ) : (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                Net Kalan Nakit Tutar
              </ThemedText>
              <ThemedText style={styles.finalAmount}>{netCash.toFixed(2)} ₺</ThemedText>
            </>
          )
        ) : (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              Araç Sahibine Km Borcu
            </ThemedText>
            <ThemedText style={styles.finalAmount}>{(kmDebt ?? 0).toFixed(2)} ₺</ThemedText>
            {kmDiscountValue > 0 && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.cashLabel}>
                ({kmDiscountValue} km düşüldü, borç {billableKmTotal ?? 0} km üzerinden hesaplandı)
              </ThemedText>
            )}
          </>
        )}
      </ThemedView>

      <Pressable
        style={({ pressed }) => [styles.button, (submitting || pressed) && styles.buttonPressed]}
        onPress={handleClose}
        disabled={submitting}>
        <ThemedText style={styles.buttonText}>
          {submitting ? 'Kapatılıyor...' : 'Vardiyayı Kapat'}
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  title: { fontSize: 28, lineHeight: 34 },
  sectionTitle: { marginTop: Spacing.four },
  hint: { marginBottom: Spacing.one },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  noteInput: { minHeight: 72, textAlignVertical: 'top' },
  expenseRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.one },
  expenseLabel: { flex: 1 },
  expenseInput: { flex: 0, width: 100, marginBottom: 0 },
  summary: { padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.half, marginTop: Spacing.three },
  preview: { width: '100%', height: 200, borderRadius: Spacing.two, marginTop: Spacing.two },
  receiptPreview: { width: '100%', height: 160, borderRadius: Spacing.two, marginTop: Spacing.two },
  secondaryButton: { alignItems: 'center', marginTop: Spacing.two, paddingVertical: Spacing.two },
  driverRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.two },
  driverChip: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  driverChipActive: { backgroundColor: '#208AEF', borderColor: '#208AEF' },
  driverChipTextActive: { color: '#fff', fontWeight: '700' },
  driverShareBox: {
    alignItems: 'center',
    gap: Spacing.half,
    marginTop: Spacing.four,
    paddingVertical: Spacing.three,
  },
  driverShareAmount: { fontSize: 28, lineHeight: 36, fontWeight: '800', color: '#F59E0B' },
  finalBox: {
    alignItems: 'center',
    gap: Spacing.half,
    marginTop: Spacing.five,
    paddingVertical: Spacing.four,
  },
  finalAmount: { fontSize: 40, lineHeight: 50, fontWeight: '800', color: '#16A34A' },
  cashLabel: { color: '#16A34A', marginTop: Spacing.half },
  button: {
    backgroundColor: '#208AEF',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  buttonPressed: { opacity: 0.7 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
