import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
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
import { ShiftHistoryList } from '@/components/shift-history-list';
import { VehicleAlertList } from '@/components/vehicle-alert-list';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatPhoneWithPrefix } from '@/lib/format';
import {
  assignDriver,
  findDriverByPhone,
  listVehicleDrivers,
  setDriverDailyKmLimit,
  type VehicleDriverRow,
} from '@/lib/vehicle-drivers';
import { getVehicle, type Vehicle } from '@/lib/vehicles';

export default function VehicleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [drivers, setDrivers] = useState<VehicleDriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);
  const [phone, setPhone] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [limitInputs, setLimitInputs] = useState<Record<string, string>>({});
  const [savingLimitFor, setSavingLimitFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    if (!hasLoadedRef.current) setLoading(true);
    try {
      const [v, d] = await Promise.all([getVehicle(id), listVehicleDrivers(id)]);
      setVehicle(v);
      setDrivers(d);
      setLimitInputs(
        Object.fromEntries(d.map((row) => [row.id, row.daily_km_discount_limit != null ? String(row.daily_km_discount_limit) : '']))
      );
    } catch (e) {
      console.warn('Araç detayı yüklenemedi', e);
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
      Alert.alert('Kaydedildi', parsed ? `${row.driver?.full_name ?? 'Şoför'} için günlük ${parsed} km düşüm hakkı tanımlandı.` : 'Km düşüm yetkisi kaldırıldı.');
    } catch (e: any) {
      Alert.alert('Kaydedilemedi', e?.message ?? 'Bilinmeyen hata oluştu.');
    } finally {
      setSavingLimitFor(null);
    }
  }

  if (loading || !vehicle) {
    return (
      <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive">
        <ThemedText type="title" style={styles.title}>
          {vehicle.plate_no}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {vehicle.payment_model === 'percentage'
            ? `Yüzdelik sistem (%${vehicle.percentage_rate ?? 25})`
            : `Km sistemi (${vehicle.km_rate ?? '-'} TL/km)`}
        </ThemedText>

        <VehicleAlertList vehicleId={vehicle.id} />

        <ThemedText type="smallBold" style={styles.sectionTitle}>
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
                <ThemedText type="smallBold">{item.driver?.full_name ?? 'İsimsiz'}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {item.driver?.phone ? `+${item.driver.phone}` : '-'}
                </ThemedText>
                {vehicle.payment_model === 'km_based' && (
                  <ThemedView style={styles.kmLimitRow}>
                    <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
                      Günlük Km Düşüm Hakkı
                    </ThemedText>
                    <TextInput
                      style={[styles.kmLimitInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
                      placeholder="Yok"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="number-pad"
                      value={limitInputs[item.id] ?? ''}
                      onChangeText={(v) => setLimitInputs((prev) => ({ ...prev, [item.id]: v }))}
                    />
                    <Pressable
                      style={({ pressed }) => [styles.kmLimitSaveButton, pressed && styles.buttonPressed]}
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

        <ThemedView style={[styles.sectionTitle, styles.historyHeaderRow]}>
          <ThemedText type="smallBold">Vardiya Geçmişi</ThemedText>
          <Pressable onPress={() => router.push(`/history?vehicleId=${vehicle.id}`)}>
            <ThemedText type="linkPrimary" style={{ fontSize: 13 }}>
              Filtrele
            </ThemedText>
          </Pressable>
        </ThemedView>
        <ShiftHistoryList vehicleId={vehicle.id} />

        {showAddDriver ? (
          <>
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              Şoför Ekle
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
              Şoförün önce uygulamaya &quot;Şoför&quot; olarak kayıt olmuş olması gerekir.
            </ThemedText>
            <PhoneInput value={phone} onChangeText={setPhone} />
            <Pressable
              style={({ pressed }) => [styles.button, (assigning || pressed) && styles.buttonPressed]}
              onPress={handleAssign}
              disabled={assigning}>
              <ThemedText style={styles.buttonText}>
                {assigning ? 'Ekleniyor...' : 'Şoför Ekle'}
              </ThemedText>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.linkButton, pressed && styles.buttonPressed]}
              onPress={handleInvite}>
              <ThemedText type="linkPrimary">Şoförü davet et (link gönder)</ThemedText>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.linkButton, pressed && styles.buttonPressed]}
              onPress={() => setShowAddDriver(false)}>
              <ThemedText type="small" themeColor="textSecondary">
                Vazgeç
              </ThemedText>
            </Pressable>
          </>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.addDriverButton, pressed && styles.buttonPressed]}
            onPress={() => setShowAddDriver(true)}>
            <ThemedText type="linkPrimary">+ Şoför Ekle</ThemedText>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: Spacing.four, paddingTop: Spacing.six, paddingBottom: Spacing.six, gap: Spacing.two },
  title: { fontSize: 32, lineHeight: 38 },
  sectionTitle: { marginTop: Spacing.four },
  historyHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  list: { gap: Spacing.two, marginTop: Spacing.two },
  driverCard: { padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.half },
  kmLimitRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.one },
  kmLimitInput: {
    borderWidth: 1,
    borderRadius: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    width: 70,
    fontSize: 14,
  },
  kmLimitSaveButton: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.one },
  hint: { marginBottom: Spacing.one },
  button: {
    backgroundColor: '#208AEF',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  linkButton: { alignItems: 'center', marginTop: Spacing.three },
  addDriverButton: { alignItems: 'center', marginTop: Spacing.four, paddingVertical: Spacing.two },
  buttonPressed: { opacity: 0.7 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
