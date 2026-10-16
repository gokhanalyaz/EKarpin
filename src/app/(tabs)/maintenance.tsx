import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, FontFamily, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { getSuggestedOpeningKm } from '@/lib/shifts';
import {
  addMaintenanceLog,
  getMaintenanceStatus,
  listMaintenanceLogs,
  maintenanceTypeLabel,
  MAINTENANCE_TYPES,
  type MaintenanceLog,
} from '@/lib/vehicle-maintenance';
import { listOwnerVehicles, type Vehicle } from '@/lib/vehicles';

export default function MaintenanceScreen() {
  const { profile } = useAuth();
  const theme = useTheme();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [currentKm, setCurrentKm] = useState<number | null>(null);
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddForm, setShowAddForm] = useState(false);
  const [type, setType] = useState<string>(MAINTENANCE_TYPES[0].key);
  const [kmInput, setKmInput] = useState('');
  const [intervalInput, setIntervalInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const v = await listOwnerVehicles(profile.id);
      setVehicles(v);
      const activeId = selectedVehicleId ?? v[0]?.id ?? null;
      if (!selectedVehicleId && activeId) setSelectedVehicleId(activeId);
      if (activeId) {
        const [km, maintenanceLogs] = await Promise.all([
          getSuggestedOpeningKm(activeId).catch(() => null),
          listMaintenanceLogs(activeId).catch(() => [] as MaintenanceLog[]),
        ]);
        setCurrentKm(km);
        setLogs(maintenanceLogs);
      } else {
        setCurrentKm(null);
        setLogs([]);
      }
    } catch (e) {
      console.warn('Bakım bilgisi yüklenemedi', e);
    } finally {
      setLoading(false);
    }
  }, [profile, selectedVehicleId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleSave() {
    if (!profile || !selectedVehicleId) return;
    const km = Number(kmInput.replace(',', '.'));
    if (!kmInput.trim() || Number.isNaN(km) || km < 0) {
      Alert.alert('Geçersiz değer', 'Geçerli bir km değeri gir.');
      return;
    }
    const interval = intervalInput.trim() ? Number(intervalInput.replace(',', '.')) : null;
    if (intervalInput.trim() && (interval == null || Number.isNaN(interval) || interval <= 0)) {
      Alert.alert('Geçersiz değer', 'Hatırlatma aralığı için geçerli bir km değeri gir (boş bırakabilirsin).');
      return;
    }
    setSaving(true);
    try {
      await addMaintenanceLog({
        vehicleId: selectedVehicleId,
        createdBy: profile.id,
        type,
        kmAtService: km,
        intervalKm: interval,
        note: noteInput,
      });
      setKmInput('');
      setIntervalInput('');
      setNoteInput('');
      setShowAddForm(false);
      await load();
    } catch (e: any) {
      Alert.alert('Kaydedilemedi', e?.message ?? 'Bilinmeyen hata oluştu.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Araç Bakım
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
        Araçlarının bakım ve lastik değişimlerini km bilgisiyle kaydet, sırası geldiğinde hatırlatma al.
      </ThemedText>

      <ThemedText type="smallBold" style={styles.sectionTitle}>
        Araç
      </ThemedText>
      <ThemedView style={styles.chipRow}>
        {vehicles.map((v) => (
          <Chip
            key={v.id}
            label={v.plate_no}
            active={selectedVehicleId === v.id}
            onPress={() => setSelectedVehicleId(v.id)}
          />
        ))}
      </ThemedView>

      {loading ? (
        <ActivityIndicator style={styles.loading} />
      ) : !selectedVehicleId ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
          Henüz araç eklemedin.
        </ThemedText>
      ) : (
        <>
          <ThemedView type="backgroundElement" style={styles.kmBox}>
            <ThemedText type="small" themeColor="textSecondary">
              Güncel Km (son karpinden)
            </ThemedText>
            <ThemedText type="subtitle">{currentKm != null ? `${currentKm} km` : 'Bilinmiyor'}</ThemedText>
          </ThemedView>

          <ThemedText type="smallBold" style={styles.sectionTitle}>
            Bakım Geçmişi
          </ThemedText>
          {logs.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              Henüz bakım/lastik kaydı yok.
            </ThemedText>
          ) : (
            <ThemedView style={styles.list}>
              {logs.map((log) => {
                const status = getMaintenanceStatus(log, currentKm);
                return (
                  <ThemedView key={log.id} type="backgroundElement" style={styles.logCard}>
                    <ThemedView style={styles.logHeader}>
                      <ThemedText type="smallBold">{maintenanceTypeLabel(log.type)}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {new Date(log.created_at).toLocaleDateString('tr-TR')}
                      </ThemedText>
                    </ThemedView>
                    <ThemedText type="small" themeColor="textSecondary">
                      {log.km_at_service} km'de yapıldı
                    </ThemedText>
                    {log.note && (
                      <ThemedText type="small" themeColor="textSecondary">
                        {log.note}
                      </ThemedText>
                    )}
                    {status.nextDueKm != null && (
                      <ThemedText
                        type="small"
                        style={
                          status.overdue
                            ? styles.overdueText
                            : status.dueSoon
                              ? styles.dueSoonText
                              : undefined
                        }>
                        {status.overdue
                          ? `Süresi geçti! ${Math.abs(status.remainingKm ?? 0).toFixed(0)} km önce ${status.nextDueKm} km'de yapılması gerekiyordu.`
                          : status.dueSoon
                            ? `Yaklaşıyor: ${status.remainingKm?.toFixed(0)} km sonra (${status.nextDueKm} km'de) sırası geliyor.`
                            : `Sırada: ${status.nextDueKm} km'de (${status.remainingKm?.toFixed(0)} km kaldı).`}
                      </ThemedText>
                    )}
                  </ThemedView>
                );
              })}
            </ThemedView>
          )}

          {showAddForm ? (
            <ThemedView style={styles.addForm}>
              <ThemedText type="smallBold" style={styles.sectionTitle}>
                Yeni Bakım Kaydı
              </ThemedText>
              <ThemedView style={styles.chipRow}>
                {MAINTENANCE_TYPES.map((t) => (
                  <Chip key={t.key} label={t.label} active={type === t.key} onPress={() => setType(t.key)} />
                ))}
              </ThemedView>
              <ThemedText type="small" themeColor="textSecondary">
                Km (bu bakımın yapıldığı km)
              </ThemedText>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                placeholder={currentKm != null ? String(currentKm) : 'Örn: 125000'}
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                value={kmInput}
                onChangeText={setKmInput}
              />
              <ThemedText type="small" themeColor="textSecondary">
                Kaç km sonra hatırlat? (boş bırakabilirsin)
              </ThemedText>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                placeholder="Örn: 10000"
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                value={intervalInput}
                onChangeText={setIntervalInput}
              />
              <ThemedText type="small" themeColor="textSecondary">
                Not (opsiyonel)
              </ThemedText>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                placeholder="Örn: Ön lastikler değişti"
                placeholderTextColor={theme.textSecondary}
                value={noteInput}
                onChangeText={setNoteInput}
              />
              <Pressable
                style={({ pressed }) => [styles.button, (saving || pressed) && styles.buttonPressed]}
                onPress={handleSave}
                disabled={saving}>
                <ThemedText style={styles.buttonText}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</ThemedText>
              </Pressable>
              <Pressable style={styles.linkButton} onPress={() => setShowAddForm(false)}>
                <ThemedText type="small" themeColor="textSecondary">
                  Vazgeç
                </ThemedText>
              </Pressable>
            </ThemedView>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.addButton, pressed && styles.buttonPressed]}
              onPress={() => {
                setKmInput(currentKm != null ? String(currentKm) : '');
                setShowAddForm(true);
              }}>
              <ThemedText style={styles.buttonText}>+ Bakım Kaydı Ekle</ThemedText>
            </Pressable>
          )}
        </>
      )}
    </ScrollView>
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
  scroll: { flex: 1 },
  container: { padding: Spacing.four, paddingBottom: Spacing.six, gap: Spacing.two },
  title: { marginBottom: Spacing.half },
  subtitle: { marginBottom: Spacing.two },
  sectionTitle: { marginTop: Spacing.three },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, backgroundColor: 'transparent' },
  chip: {
    borderWidth: 1,
    borderColor: '#94A3B8',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  chipActive: { backgroundColor: Brand.primary, borderColor: Brand.primary, borderWidth: 0 },
  chipTextActive: { color: Brand.onPrimary, fontFamily: FontFamily.bodyBold },
  loading: { marginTop: Spacing.four },
  empty: { textAlign: 'center', marginTop: Spacing.five },
  kmBox: { padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.half, marginTop: Spacing.two },
  list: { gap: Spacing.two, marginTop: Spacing.two, backgroundColor: 'transparent' },
  logCard: { padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.half },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'transparent' },
  dueSoonText: { color: '#B45309', fontWeight: '700' },
  overdueText: { color: '#DC2626', fontWeight: '700' },
  addForm: { gap: Spacing.two, marginTop: Spacing.two, backgroundColor: 'transparent' },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 14,
  },
  addButton: {
    backgroundColor: Brand.primary,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.four,
  },
  button: {
    backgroundColor: Brand.primary,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  buttonPressed: { opacity: 0.7 },
  buttonText: { color: Brand.onPrimary, fontFamily: FontFamily.bodyBold, fontSize: 16 },
  linkButton: { alignItems: 'center', marginTop: Spacing.one },
});
