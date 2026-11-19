import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { SymbolView } from '@/components/app-icon';
import { DateRangePicker } from '@/components/date-range-picker';
import { PhotoViewButton } from '@/components/photo-view-button';
import { SafeScreen } from '@/components/safe-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, FontFamily, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { goBackOrHome } from '@/lib/navigation';
import type { Shift } from '@/lib/shifts';
import {
  createTrafficFine,
  deleteTrafficFine,
  findShiftAt,
  formatFineDateTime,
  formatMoney,
  getFinePhotoUrl,
  getProfileNames,
  listTrafficFines,
  setTrafficFinePaid,
  type FineShiftLookup,
  type TrafficFine,
} from '@/lib/traffic-fines';
import { listAssignedVehicles, listOwnerVehicles, type Vehicle } from '@/lib/vehicles';

type PaidFilter = 'all' | 'unpaid' | 'paid';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function shiftTimeLabel(s: Shift): string {
  const open = formatFineDateTime(s.opened_at);
  const close = s.closed_at ? formatFineDateTime(s.closed_at) : 'hâlâ açık';
  return `${open} → ${close}`;
}

/**
 * Trafik cezası sorgulama ve kayıtları.
 * Araç sahibi: plaka + cezanın tarih/saati ile o an çalışan şoförün karpinini
 * bulur, cezayı kaydeder ve şoföre bildirir; kayıtlı cezaları yönetir.
 * Şoför: sadece kendisine atanan cezaları görür.
 */
export default function TrafficFinesScreen() {
  const { profile } = useAuth();
  const isOwner = profile?.role === 'owner';
  const theme = useTheme();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [day, setDay] = useState<Date | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [hour, setHour] = useState('');
  const [minute, setMinute] = useState('');

  const [searching, setSearching] = useState(false);
  const [lookup, setLookup] = useState<FineShiftLookup | null>(null);
  const [lookupAt, setLookupAt] = useState<Date | null>(null);
  const [chosenShiftId, setChosenShiftId] = useState<string | null>(null);

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [fines, setFines] = useState<TrafficFine[]>([]);
  const [finesLoading, setFinesLoading] = useState(true);
  const [paidFilter, setPaidFilter] = useState<PaidFilter>('all');
  const [names, setNames] = useState<Record<string, string>>({});

  const plateById = useMemo(() => {
    const map: Record<string, string> = {};
    vehicles.forEach((v) => (map[v.id] = v.plate_no));
    return map;
  }, [vehicles]);

  useEffect(() => {
    if (!profile) return;
    const loader = isOwner ? listOwnerVehicles(profile.id, { includeArchived: true }) : listAssignedVehicles(profile.id);
    loader
      .then((rows) => {
        setVehicles(rows);
        const active = rows.filter((v) => !v.archived_at);
        if (active.length === 1) setVehicleId(active[0].id);
      })
      .catch(() => {});
  }, [profile, isOwner]);

  const loadFines = useCallback(async () => {
    if (!profile) return;
    setFinesLoading(true);
    try {
      const rows = isOwner
        ? await listTrafficFines({ vehicleIds: vehicles.map((v) => v.id) })
        : await listTrafficFines({ driverId: profile.id });
      setFines(isOwner && vehicles.length === 0 ? [] : rows);
      const ids = rows.map((f) => f.driver_id).filter((x): x is string => !!x);
      const map = await getProfileNames(ids).catch(() => ({}) as Record<string, string>);
      setNames((prev) => ({ ...prev, ...map }));
    } catch (e) {
      console.warn('Cezalar yüklenemedi', e);
    } finally {
      setFinesLoading(false);
    }
  }, [profile, isOwner, vehicles]);

  useFocusEffect(
    useCallback(() => {
      loadFines();
    }, [loadFines])
  );

  function buildFineDate(): Date | null {
    if (!day) return null;
    const h = Number(hour);
    const m = Number(minute || '0');
    if (hour === '' || !Number.isInteger(h) || h < 0 || h > 23) return null;
    if (!Number.isInteger(m) || m < 0 || m > 59) return null;
    const d = new Date(day);
    d.setHours(h, m, 0, 0);
    return d;
  }

  async function handleSearch() {
    if (!vehicleId) {
      Alert.alert('Araç seç', 'Cezanın geldiği aracı seç.');
      return;
    }
    const at = buildFineDate();
    if (!at) {
      Alert.alert('Tarih ve saat eksik', 'Cezadaki tarihi seç ve saati (ör. 14 : 35) gir.');
      return;
    }
    if (at.getTime() > Date.now()) {
      Alert.alert('Geçersiz tarih', 'Ceza tarihi ileri bir zaman olamaz.');
      return;
    }
    setSearching(true);
    try {
      const result = await findShiftAt(vehicleId, at);
      setLookup(result);
      setLookupAt(at);
      setChosenShiftId(result.match?.id ?? null);
      const ids = [result.match, result.before, result.after]
        .map((s) => s?.driver_id)
        .filter((x): x is string => !!x);
      const map = await getProfileNames(ids).catch(() => ({}) as Record<string, string>);
      setNames((prev) => ({ ...prev, ...map }));
    } catch (e: any) {
      Alert.alert('Sorgulanamadı', e?.message ?? 'Bilinmeyen hata oluştu.');
    } finally {
      setSearching(false);
    }
  }

  function resetForm() {
    setLookup(null);
    setLookupAt(null);
    setChosenShiftId(null);
    setAmount('');
    setNote('');
    setPhotoUri(null);
    setHour('');
    setMinute('');
    setDay(null);
  }

  async function pickPhoto(source: 'camera' | 'library') {
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('İzin gerekli', 'Ceza tutanağını çekmek için kamera izni ver.');
          return;
        }
        const result = await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: false });
        if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
      } else {
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
        if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
      }
    } catch (e: any) {
      Alert.alert('Fotoğraf alınamadı', e?.message ?? 'Bilinmeyen hata oluştu.');
    }
  }

  function handlePhotoPress() {
    Alert.alert('Ceza Fotoğrafı', 'Ceza tutanağının fotoğrafını ekle', [
      { text: 'Fotoğraf Çek', onPress: () => pickPhoto('camera') },
      { text: 'Galeriden Seç', onPress: () => pickPhoto('library') },
      { text: 'Vazgeç', style: 'cancel' },
    ]);
  }

  const candidates = useMemo(() => {
    if (!lookup) return [] as Shift[];
    return [lookup.match, lookup.before, lookup.after].filter((s): s is Shift => !!s);
  }, [lookup]);
  const chosenShift = candidates.find((s) => s.id === chosenShiftId) ?? null;

  async function handleSave() {
    if (!vehicleId || !lookupAt) return;
    const parsedAmount = amount.trim() === '' ? null : Number(amount.replace(/\./g, '').replace(',', '.'));
    if (parsedAmount != null && (!Number.isFinite(parsedAmount) || parsedAmount < 0)) {
      Alert.alert('Tutar hatalı', 'Ceza tutarını sadece rakamla gir (ör. 1500).');
      return;
    }
    setSaving(true);
    try {
      const { photoError, notified } = await createTrafficFine({
        vehicleId,
        plateNo: plateById[vehicleId] ?? '',
        shiftId: chosenShift?.id ?? null,
        driverId: chosenShift?.driver_id ?? null,
        fineAt: lookupAt,
        amount: parsedAmount,
        note: note.trim() || null,
        photoUri,
      });
      const driverName = chosenShift ? names[chosenShift.driver_id] ?? 'Şoför' : null;
      let message = driverName
        ? notified
          ? `Ceza kaydedildi ve ${driverName} adlı şoföre bildirim gönderildi.`
          : `Ceza kaydedildi. ${driverName} bildirimleri kapalı olduğu için bildirim gönderilemedi.`
        : 'Ceza şoför atanmadan kaydedildi.';
      if (photoError) message += `\n\nFotoğraf yüklenemedi: ${photoError}`;
      Alert.alert('Kaydedildi', message);
      resetForm();
      await loadFines();
    } catch (e: any) {
      Alert.alert('Kaydedilemedi', e?.message ?? 'Bilinmeyen hata oluştu.');
    } finally {
      setSaving(false);
    }
  }

  async function togglePaid(fine: TrafficFine) {
    try {
      await setTrafficFinePaid(fine.id, !fine.paid_at);
      await loadFines();
    } catch (e: any) {
      Alert.alert('İşlem başarısız', e?.message ?? 'Bilinmeyen hata oluştu.');
    }
  }

  function confirmDelete(fine: TrafficFine) {
    Alert.alert('Cezayı Sil', `${formatFineDateTime(fine.fine_at)} tarihli ceza kaydı silinsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTrafficFine(fine);
            await loadFines();
          } catch (e: any) {
            Alert.alert('Silinemedi', e?.message ?? 'Bilinmeyen hata oluştu.');
          }
        },
      },
    ]);
  }

  const visibleFines = useMemo(
    () =>
      fines.filter((f) => (paidFilter === 'all' ? true : paidFilter === 'paid' ? !!f.paid_at : !f.paid_at)),
    [fines, paidFilter]
  );
  const unpaidTotal = useMemo(
    () => fines.filter((f) => !f.paid_at).reduce((sum, f) => sum + (Number(f.amount) || 0), 0),
    [fines]
  );
  const unpaidCount = fines.filter((f) => !f.paid_at).length;

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];

  function ShiftOption({ shift, title }: { shift: Shift; title: string }) {
    const selected = chosenShiftId === shift.id;
    return (
      <Pressable
        onPress={() => setChosenShiftId(shift.id)}
        style={[styles.shiftCard, { borderColor: selected ? Brand.primary : theme.backgroundSelected }, selected && styles.shiftCardSelected]}>
        <View style={styles.rowBetween}>
          <ThemedText type="eyebrow">{title}</ThemedText>
          <View style={[styles.radio, { borderColor: selected ? Brand.primary : theme.textSecondary }, selected && styles.radioOn]}>
            {selected && <SymbolView name="checkmark" size={14} tintColor={Brand.onPrimary} />}
          </View>
        </View>
        <ThemedText type="subtitle" style={styles.driverName}>
          {names[shift.driver_id] ?? 'Şoför'}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {shift.shift_no != null ? `Karpin #${shift.shift_no} · ` : ''}
          {shiftTimeLabel(shift)}
        </ThemedText>
        {(shift.opening_km != null || shift.closing_km != null) && (
          <ThemedText type="small" themeColor="textSecondary">
            Km: {shift.opening_km ?? '-'} → {shift.closing_km ?? '-'}
          </ThemedText>
        )}
        <Pressable hitSlop={8} onPress={() => router.push(`/shift-detail/${shift.id}` as any)}>
          <ThemedText type="linkPrimary">Karpini Aç</ThemedText>
        </Pressable>
      </Pressable>
    );
  }

  return (
    <SafeScreen>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={goBackOrHome} style={styles.back}>
          <SymbolView name="chevron.left" size={20} tintColor={theme.text} />
        </Pressable>
        <ThemedText type="smallBold" style={styles.headerTitle}>
          {isOwner ? 'Trafik Cezaları' : 'Trafik Cezalarım'}
        </ThemedText>
        <View style={styles.back} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          {isOwner && (
            <ThemedView type="backgroundElement" style={styles.box}>
              <ThemedText type="subtitle">Ceza Sorgula</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Cezadaki tarih ve saati gir; o saatte aracı kullanan şoförü ve karpinini bulalım.
              </ThemedText>

              <ThemedText type="eyebrow" style={styles.label}>
                Araç
              </ThemedText>
              <View style={styles.chipRow}>
                {vehicles.map((v) => (
                  <Chip
                    key={v.id}
                    label={v.archived_at ? `${v.plate_no} (silindi)` : v.plate_no}
                    active={vehicleId === v.id}
                    onPress={() => {
                      setVehicleId(v.id);
                      setLookup(null);
                    }}
                  />
                ))}
                {vehicles.length === 0 && (
                  <ThemedText type="small" themeColor="textSecondary">
                    Henüz aracın yok.
                  </ThemedText>
                )}
              </View>

              <ThemedText type="eyebrow" style={styles.label}>
                Ceza Tarihi
              </ThemedText>
              <Chip
                label={day ? day.toLocaleDateString('tr-TR') : 'Tarih Seç'}
                active={!!day || showCalendar}
                onPress={() => setShowCalendar((v) => !v)}
              />
              {showCalendar && (
                <DateRangePicker
                  value={day ? { from: day, to: day } : null}
                  onChange={(range) => {
                    setDay(range ? range.from : null);
                    setShowCalendar(false);
                    setLookup(null);
                  }}
                />
              )}

              <ThemedText type="eyebrow" style={styles.label}>
                Ceza Saati
              </ThemedText>
              <View style={styles.timeRow}>
                <TextInput
                  style={[...inputStyle, styles.timeInput]}
                  placeholder="SS"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="number-pad"
                  maxLength={2}
                  value={hour}
                  onChangeText={(t) => {
                    setHour(t.replace(/\D/g, ''));
                    setLookup(null);
                  }}
                />
                <ThemedText type="subtitle">:</ThemedText>
                <TextInput
                  style={[...inputStyle, styles.timeInput]}
                  placeholder="DD"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="number-pad"
                  maxLength={2}
                  value={minute}
                  onChangeText={(t) => {
                    setMinute(t.replace(/\D/g, ''));
                    setLookup(null);
                  }}
                />
              </View>

              <Pressable
                disabled={searching}
                onPress={handleSearch}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                {searching ? (
                  <ActivityIndicator color={Brand.onPrimary} />
                ) : (
                  <ThemedText style={styles.primaryButtonText}>Şoförü Bul</ThemedText>
                )}
              </Pressable>

              {lookup && lookupAt && (
                <View style={styles.resultArea}>
                  {lookup.match ? (
                    <>
                      <ThemedText type="smallBold">
                        {formatFineDateTime(lookupAt.toISOString())} saatinde aracı bu şoför kullanıyordu:
                      </ThemedText>
                      <ShiftOption shift={lookup.match} title="Ceza anındaki karpin" />
                    </>
                  ) : (
                    <>
                      <ThemedText type="smallBold">
                        {formatFineDateTime(lookupAt.toISOString())} saatinde açık bir karpin yok.
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        Araç o saatte boşta ya da şoför değişimi sırasında olabilir. Cezayı atamak istediğin karpini
                        seç ya da şoför seçmeden kaydet.
                      </ThemedText>
                      {lookup.before && <ShiftOption shift={lookup.before} title="Hemen önceki karpin" />}
                      {lookup.after && <ShiftOption shift={lookup.after} title="Hemen sonraki karpin" />}
                      {!lookup.before && !lookup.after && (
                        <ThemedText type="small" themeColor="textSecondary">
                          Bu araçta hiç karpin bulunamadı.
                        </ThemedText>
                      )}
                      {chosenShiftId && (
                        <Pressable hitSlop={8} onPress={() => setChosenShiftId(null)}>
                          <ThemedText type="linkPrimary">Seçimi kaldır (şoför atama)</ThemedText>
                        </Pressable>
                      )}
                    </>
                  )}

                  <ThemedText type="eyebrow" style={styles.label}>
                    Ceza Tutarı (₺)
                  </ThemedText>
                  <TextInput
                    style={inputStyle}
                    placeholder="Örn. 1500"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="decimal-pad"
                    value={amount}
                    onChangeText={setAmount}
                  />

                  <ThemedText type="eyebrow" style={styles.label}>
                    Not (isteğe bağlı)
                  </ThemedText>
                  <TextInput
                    style={[...inputStyle, styles.noteInput]}
                    placeholder="Örn. hız ihlali, park cezası"
                    placeholderTextColor={theme.textSecondary}
                    multiline
                    value={note}
                    onChangeText={setNote}
                  />

                  <Pressable onPress={handlePhotoPress} style={({ pressed }) => [styles.photoButton, { borderColor: theme.backgroundSelected }, pressed && styles.pressed]}>
                    {photoUri ? (
                      <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                    ) : (
                      <SymbolView name="camera.fill" size={20} tintColor={theme.text} />
                    )}
                    <ThemedText type="smallBold">
                      {photoUri ? 'Fotoğrafı Değiştir' : 'Ceza Fotoğrafı Ekle (isteğe bağlı)'}
                    </ThemedText>
                  </Pressable>

                  <Pressable
                    disabled={saving}
                    onPress={handleSave}
                    style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                    {saving ? (
                      <ActivityIndicator color={Brand.onPrimary} />
                    ) : (
                      <ThemedText style={styles.primaryButtonText}>
                        {chosenShift ? 'Cezayı Kaydet ve Şoföre Bildir' : 'Cezayı Kaydet'}
                      </ThemedText>
                    )}
                  </Pressable>
                </View>
              )}
            </ThemedView>
          )}

          <ThemedText type="eyebrow" style={styles.sectionTitle}>
            {isOwner ? 'Kayıtlı Cezalar' : 'Bana Atanan Cezalar'}
          </ThemedText>
          <View style={styles.chipRow}>
            <Chip label="Tümü" active={paidFilter === 'all'} onPress={() => setPaidFilter('all')} />
            <Chip label="Ödenmedi" active={paidFilter === 'unpaid'} onPress={() => setPaidFilter('unpaid')} />
            <Chip label="Ödendi" active={paidFilter === 'paid'} onPress={() => setPaidFilter('paid')} />
          </View>
          {!finesLoading && unpaidCount > 0 && (
            <ThemedText type="small" themeColor="textSecondary">
              Ödenmeyen: {unpaidCount} ceza · {formatMoney(unpaidTotal)}
            </ThemedText>
          )}

          {finesLoading ? (
            <ActivityIndicator style={styles.loading} />
          ) : visibleFines.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              Kayıtlı ceza yok.
            </ThemedText>
          ) : (
            visibleFines.map((f) => (
              <ThemedView key={f.id} type="backgroundElement" style={styles.fineCard}>
                <View style={styles.rowBetween}>
                  <ThemedText type="smallBold">
                    {plateById[f.vehicle_id] ?? ''} · {formatFineDateTime(f.fine_at)}
                  </ThemedText>
                  <View style={[styles.badge, f.paid_at ? styles.badgePaid : styles.badgeUnpaid]}>
                    <ThemedText style={styles.badgeText}>{f.paid_at ? 'Ödendi' : 'Ödenmedi'}</ThemedText>
                  </View>
                </View>
                {isOwner && (
                  <ThemedText type="small">Şoför: {f.driver_id ? names[f.driver_id] ?? 'Şoför' : 'Atanmadı'}</ThemedText>
                )}
                <ThemedText type="small">Tutar: {formatMoney(f.amount)}</ThemedText>
                {!!f.note && (
                  <ThemedText type="small" themeColor="textSecondary">
                    {f.note}
                  </ThemedText>
                )}
                <View style={styles.linkRow}>
                  {f.photo_url && <PhotoViewButton path={f.photo_url} label="Ceza Fotoğrafı" getUrl={getFinePhotoUrl} />}
                  {f.shift_id && (
                    <Pressable hitSlop={8} style={styles.linkButton} onPress={() => router.push(`/shift-detail/${f.shift_id}` as any)}>
                      <ThemedText type="linkPrimary">Karpini Aç</ThemedText>
                    </Pressable>
                  )}
                </View>
                {isOwner && (
                  <View style={styles.actionRow}>
                    <Pressable
                      onPress={() => togglePaid(f)}
                      style={({ pressed }) => [styles.smallButton, { borderColor: theme.backgroundSelected }, pressed && styles.pressed]}>
                      <ThemedText type="smallBold">{f.paid_at ? 'Ödenmedi Yap' : 'Ödendi İşaretle'}</ThemedText>
                    </Pressable>
                    <Pressable
                      onPress={() => confirmDelete(f)}
                      style={({ pressed }) => [styles.smallButton, { borderColor: theme.backgroundSelected }, pressed && styles.pressed]}>
                      <SymbolView name="trash" size={16} tintColor="#D92D20" />
                      <ThemedText type="smallBold" style={{ color: '#D92D20' }}>
                        Sil
                      </ThemedText>
                    </Pressable>
                  </View>
                )}
              </ThemedView>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeScreen>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <ThemedText style={active ? styles.chipTextActive : undefined} type="small">
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  back: { width: 36, height: 36, justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16 },
  content: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.six, gap: Spacing.two },
  box: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  label: { marginTop: Spacing.two },
  sectionTitle: { marginTop: Spacing.four },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#94A3B8',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  chipActive: { backgroundColor: Brand.primary, borderColor: Brand.primary, borderWidth: 0 },
  chipTextActive: { color: Brand.onPrimary, fontFamily: FontFamily.bodyBold },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
    fontFamily: FontFamily.body,
  },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  timeInput: { width: 64, textAlign: 'center' },
  noteInput: { minHeight: 64, textAlignVertical: 'top' },
  primaryButton: {
    backgroundColor: Brand.primary,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.three,
  },
  primaryButtonText: { color: Brand.onPrimary, fontFamily: FontFamily.bodyBold, fontSize: 16 },
  pressed: { opacity: 0.7 },
  resultArea: { gap: Spacing.two, marginTop: Spacing.three },
  shiftCard: { borderWidth: 2, borderRadius: Spacing.two, padding: Spacing.three, gap: Spacing.one },
  shiftCardSelected: { backgroundColor: 'rgba(255,196,0,0.12)' },
  driverName: { marginTop: Spacing.half },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioOn: { backgroundColor: Brand.primary },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Spacing.two,
    padding: Spacing.three,
    marginTop: Spacing.two,
  },
  photoPreview: { width: 48, height: 48, borderRadius: 6 },
  loading: { marginTop: Spacing.four },
  fineCard: { padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.one },
  badge: { borderRadius: 999, paddingHorizontal: Spacing.two, paddingVertical: 2 },
  badgePaid: { backgroundColor: '#D1FADF' },
  badgeUnpaid: { backgroundColor: '#FEE4E2' },
  badgeText: { fontSize: 12, fontFamily: FontFamily.bodyBold, color: '#171717' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.four },
  linkButton: { paddingVertical: 8 },
  actionRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one },
  smallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
