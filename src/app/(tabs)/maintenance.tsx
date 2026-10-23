import { useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ActionSheetModal } from '@/components/action-sheet-modal';
import { GroupCard } from '@/components/grouped-list';
import { SafeScreen } from '@/components/safe-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, FontFamily, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { friendlyError } from '@/lib/errors';
import { getSuggestedOpeningKm } from '@/lib/shifts';
import {
  addMaintenanceLog,
  deleteMaintenanceLog,
  getInspectionStatus,
  getMaintenanceStatus,
  inspectionMessage,
  latestByType,
  listMaintenanceLogs,
  MAINTENANCE_ICONS,
  maintenanceTypeLabel,
  MAINTENANCE_TYPES,
  updateMaintenanceLog,
  type MaintenanceLog,
  type MaintenanceStatus,
} from '@/lib/vehicle-maintenance';
import {
  formatDateOnly,
  listOwnerVehicles,
  parseDateOnly,
  setVehicleInspection,
  type Vehicle,
} from '@/lib/vehicles';

const NOTICE_DAY_OPTIONS = [7, 10, 15, 30];
const OVERDUE = '#DC2626';
const DUE_SOON = '#D97706';
const OK = '#16A34A';

/** 'GG.AA.YYYY' yazarken noktaları kendiliğinden ekler. */
function formatDateTyping(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}

/** 'GG.AA.YYYY' -> Date (geçersizse null). */
function parseTypedDate(text: string): Date | null {
  const m = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  if (d.getDate() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1) return null;
  return d;
}

function toTypedDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

function statusColor(status: { overdue: boolean; dueSoon: boolean }): string {
  return status.overdue ? OVERDUE : status.dueSoon ? DUE_SOON : OK;
}

/**
 * Araç Bakım sekmesi: güncel km, vize, zamanı gelen bakımlar ve bakım
 * geçmişi. Ekleme/düzenleme formları alttan açılan pencerede - X'e,
 * "Vazgeç"e veya boşluğa dokunarak değişiklik yapmadan çıkılabiliyor.
 */
export default function MaintenanceScreen() {
  const { profile } = useAuth();
  const theme = useTheme();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [currentKm, setCurrentKm] = useState<number | null>(null);
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Bakım ekle / düzenle penceresi
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [type, setType] = useState<string>(MAINTENANCE_TYPES[0].key);
  const [kmInput, setKmInput] = useState('');
  const [intervalInput, setIntervalInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [saving, setSaving] = useState(false);

  // Vize penceresi
  const [inspectionOpen, setInspectionOpen] = useState(false);
  const [inspectionDateInput, setInspectionDateInput] = useState('');
  const [noticeDays, setNoticeDays] = useState(10);
  const [savingInspection, setSavingInspection] = useState(false);

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) ?? null;

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

  // --- Bakım ekle / düzenle ---

  function openAddForm() {
    setEditingId(null);
    setType(MAINTENANCE_TYPES[0].key);
    setKmInput(currentKm != null ? String(currentKm) : '');
    setIntervalInput('');
    setNoteInput('');
    setFormOpen(true);
  }

  function openEditForm(log: MaintenanceLog) {
    setEditingId(log.id);
    setType(log.type);
    setKmInput(String(log.km_at_service));
    setIntervalInput(log.interval_km != null ? String(log.interval_km) : '');
    setNoteInput(log.note ?? '');
    setFormOpen(true);
  }

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
      if (editingId) {
        await updateMaintenanceLog(editingId, { type, kmAtService: km, intervalKm: interval, note: noteInput });
      } else {
        await addMaintenanceLog({
          vehicleId: selectedVehicleId,
          createdBy: profile.id,
          type,
          kmAtService: km,
          intervalKm: interval,
          note: noteInput,
        });
      }
      setFormOpen(false);
      await load();
    } catch (e: any) {
      Alert.alert('Kaydedilemedi', friendlyError(e));
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(log: MaintenanceLog) {
    Alert.alert(
      'Bakım Kaydını Sil',
      `${maintenanceTypeLabel(log.type)} (${log.km_at_service} km) kaydı silinecek. Bu kayda bağlı hatırlatma da kalkar. Devam edilsin mi?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMaintenanceLog(log.id);
              setFormOpen(false);
              await load();
            } catch (e: any) {
              Alert.alert('Silinemedi', friendlyError(e));
            }
          },
        },
      ]
    );
  }

  /** "Yapıldı": aynı türden, bugünkü km'de yeni bir kayıt açar - hatırlatma sıfırlanır. */
  function handleMarkDone(status: MaintenanceStatus) {
    if (!profile || !selectedVehicleId) return;
    const log = status.log;
    if (currentKm == null) {
      openAddForm();
      setType(log.type);
      setIntervalInput(log.interval_km != null ? String(log.interval_km) : '');
      return;
    }
    Alert.alert(
      'Bakım Yapıldı mı?',
      `${maintenanceTypeLabel(log.type)} bugün ${currentKm} km'de yapıldı olarak kaydedilsin mi?${
        log.interval_km ? ` Bir sonraki hatırlatma ${log.interval_km} km sonra.` : ''
      }`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Evet, Yapıldı',
          onPress: async () => {
            try {
              await addMaintenanceLog({
                vehicleId: selectedVehicleId,
                createdBy: profile.id,
                type: log.type,
                kmAtService: currentKm,
                intervalKm: log.interval_km,
                reminderBufferKm: log.reminder_buffer_km,
                note: 'Yapıldı olarak işaretlendi',
              });
              await load();
            } catch (e: any) {
              Alert.alert('Kaydedilemedi', friendlyError(e));
            }
          },
        },
      ]
    );
  }

  // --- Vize ---

  function openInspection() {
    if (!selectedVehicle) return;
    setInspectionDateInput(
      selectedVehicle.inspection_due_date ? toTypedDate(parseDateOnly(selectedVehicle.inspection_due_date)) : ''
    );
    setNoticeDays(selectedVehicle.inspection_notice_days ?? 10);
    setInspectionOpen(true);
  }

  async function saveInspection(date: Date | null, days: number) {
    if (!selectedVehicle) return;
    setSavingInspection(true);
    try {
      await setVehicleInspection(selectedVehicle.id, date ? formatDateOnly(date) : null, days);
      setVehicles((prev) =>
        prev.map((v) =>
          v.id === selectedVehicle.id
            ? { ...v, inspection_due_date: date ? formatDateOnly(date) : null, inspection_notice_days: days }
            : v
        )
      );
      setInspectionOpen(false);
    } catch (e: any) {
      Alert.alert('Kaydedilemedi', friendlyError(e));
    } finally {
      setSavingInspection(false);
    }
  }

  function handleSaveInspection() {
    const date = parseTypedDate(inspectionDateInput);
    if (!date) {
      Alert.alert('Geçersiz tarih', 'Vize tarihini GG.AA.YYYY şeklinde gir (örn. 15.03.2027).');
      return;
    }
    saveInspection(date, noticeDays);
  }

  /** "Vize yapıldı": tarihi bir yıl ileri alır (pencereden değiştirilebilir). */
  function handleInspectionDone() {
    if (!selectedVehicle?.inspection_due_date) return;
    const next = parseDateOnly(selectedVehicle.inspection_due_date);
    next.setFullYear(next.getFullYear() + 1);
    Alert.alert(
      'Vize Yapıldı mı?',
      `Yeni vize tarihi ${next.toLocaleDateString('tr-TR')} olarak kaydedilsin mi? Farklıysa "Tarihi Değiştir"e bas.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Tarihi Değiştir',
          onPress: () => {
            setInspectionDateInput(toTypedDate(next));
            setNoticeDays(selectedVehicle.inspection_notice_days ?? 10);
            setInspectionOpen(true);
          },
        },
        { text: 'Evet, Kaydet', onPress: () => saveInspection(next, selectedVehicle.inspection_notice_days ?? 10) },
      ]
    );
  }

  const inspection = selectedVehicle ? getInspectionStatus(selectedVehicle) : null;
  const dueItems = latestByType(logs)
    .map((log) => getMaintenanceStatus(log, currentKm))
    .filter((s) => s.dueSoon || s.overdue)
    .sort((a, b) => (a.remainingKm ?? 0) - (b.remainingKm ?? 0));
  const inspectionDue = !!inspection && (inspection.dueSoon || inspection.overdue);

  return (
    <SafeScreen>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.container}>
        <ThemedText type="title" style={styles.title}>
          Araç Bakım
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
          Bakım, lastik ve vize bilgilerini kaydet; zamanı gelince sana hatırlatma yapılır.
        </ThemedText>

        {vehicles.length > 1 && (
          <ThemedView style={styles.chipRow}>
            {vehicles.map((v) => {
              const active = selectedVehicleId === v.id;
              return (
                <Pressable
                  key={v.id}
                  style={[styles.chip, { borderColor: theme.backgroundSelected }, active && styles.chipActive]}
                  onPress={() => setSelectedVehicleId(v.id)}>
                  <ThemedText type="smallBold" style={active ? styles.chipTextActive : undefined}>
                    {v.plate_no}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ThemedView>
        )}

        {loading ? (
          <ActivityIndicator style={styles.loading} />
        ) : !selectedVehicle ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
            Henüz araç eklemedin.
          </ThemedText>
        ) : (
          <>
            {/* Özet: güncel km + vize */}
            <GroupCard style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryCell}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Güncel Km
                  </ThemedText>
                  <ThemedText style={styles.summaryValue}>
                    {currentKm != null ? currentKm.toLocaleString('tr-TR') : '—'}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.summaryHint}>
                    son karpinden
                  </ThemedText>
                </View>
                <View style={[styles.summaryDivider, { backgroundColor: theme.separator }]} />
                <Pressable style={styles.summaryCell} onPress={openInspection}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Vize
                  </ThemedText>
                  {inspection ? (
                    <>
                      <ThemedText style={[styles.summaryValue, { color: statusColor(inspection) }]}>
                        {inspection.overdue
                          ? `${Math.abs(inspection.daysLeft)} gün geçti`
                          : `${inspection.daysLeft} gün`}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.summaryHint}>
                        {inspection.dueDate.toLocaleDateString('tr-TR')}
                      </ThemedText>
                    </>
                  ) : (
                    <>
                      <ThemedText type="smallBold" style={styles.summaryAdd}>
                        + Tarih Ekle
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.summaryHint}>
                        hatırlatma için
                      </ThemedText>
                    </>
                  )}
                </Pressable>
              </View>
            </GroupCard>

            {/* Zamanı gelenler */}
            {(dueItems.length > 0 || inspectionDue) && (
              <>
                <ThemedText type="eyebrow" style={styles.sectionTitle}>
                  Zamanı Gelenler
                </ThemedText>
                {inspectionDue && inspection && (
                  <DueCard
                    icon="calendar.badge.exclamationmark"
                    title="Vize"
                    message={inspectionMessage(inspection)}
                    color={statusColor(inspection)}
                    onDone={handleInspectionDone}
                  />
                )}
                {dueItems.map((s) => (
                  <DueCard
                    key={s.log.id}
                    icon={MAINTENANCE_ICONS[s.log.type] ?? 'wrench.fill'}
                    title={maintenanceTypeLabel(s.log.type)}
                    message={
                      s.overdue
                        ? `Zamanı geçti - ${s.nextDueKm} km'de yapılması gerekiyordu.`
                        : `${s.remainingKm?.toFixed(0)} km kaldı (${s.nextDueKm} km'de).`
                    }
                    color={statusColor(s)}
                    onDone={() => handleMarkDone(s)}
                  />
                ))}
              </>
            )}

            {/* Bakım geçmişi */}
            {/* Büyük, açıklamalı "bakım ekle" butonu - ne ekleneceği belli olsun */}
            <Pressable onPress={openAddForm} style={({ pressed }) => [styles.addBigButton, pressed && styles.pressed]}>
              <View style={styles.addBigIcon}>
                <SymbolView name="plus" size={20} tintColor={Brand.primary} />
              </View>
              <View style={styles.addBigTextWrap}>
                <ThemedText style={styles.addBigTitle}>Yeni Bakım Kaydı Ekle</ThemedText>
                <ThemedText style={styles.addBigSubtitle}>Yağ, lastik, fren, periyodik bakım veya diğer</ThemedText>
              </View>
            </Pressable>

            <View style={styles.historyHeader}>
              <ThemedText type="eyebrow">Bakım Geçmişi</ThemedText>
            </View>

            {logs.length === 0 ? (
              <GroupCard style={styles.emptyCard}>
                <SymbolView name="wrench.and.screwdriver" size={30} tintColor={theme.textSecondary} />
                <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                  Henüz bakım kaydı yok. Yukarıdaki sarı butondan ilk kaydı ekle, sırası gelince hatırlatalım.
                </ThemedText>
              </GroupCard>
            ) : (
              <GroupCard>
                {logs.map((log, index) => {
                  const status = getMaintenanceStatus(log, currentKm);
                  const color = status.nextDueKm != null ? statusColor(status) : theme.textSecondary;
                  return (
                    <Pressable
                      key={log.id}
                      onPress={() => openEditForm(log)}
                      style={({ pressed }) => [
                        styles.logRow,
                        index < logs.length - 1 && {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: theme.separator,
                        },
                        pressed && styles.pressed,
                      ]}>
                      <View style={[styles.logIcon, { backgroundColor: theme.subtleFill }]}>
                        <SymbolView name={(MAINTENANCE_ICONS[log.type] ?? 'wrench.fill') as any} size={18} tintColor={theme.text} />
                      </View>
                      <View style={styles.logBody}>
                        <ThemedText type="smallBold" style={styles.logTitle}>
                          {maintenanceTypeLabel(log.type)}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {new Date(log.created_at).toLocaleDateString('tr-TR')} · {log.km_at_service.toLocaleString('tr-TR')} km
                        </ThemedText>
                        {log.note ? (
                          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
                            {log.note}
                          </ThemedText>
                        ) : null}
                        {status.nextDueKm != null && (
                          <ThemedText type="small" style={[styles.logNext, { color }]}>
                            {status.overdue
                              ? `Zamanı geçti (${status.nextDueKm} km)`
                              : `Sıradaki: ${status.nextDueKm.toLocaleString('tr-TR')} km · ${status.remainingKm?.toFixed(0)} km kaldı`}
                          </ThemedText>
                        )}
                      </View>
                      <SymbolView name="chevron.right" size={13} tintColor={theme.textSecondary} />
                    </Pressable>
                  );
                })}
              </GroupCard>
            )}
            {logs.length > 0 && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.footerHint}>
                Bir kaydı düzenlemek veya silmek için üstüne dokun.
              </ThemedText>
            )}
          </>
        )}
      </ScrollView>

      {/* Bakım ekle / düzenle */}
      <ActionSheetModal
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? 'Bakımı Düzenle' : 'Yeni Bakım'}>
        <ThemedText type="eyebrow" style={styles.formLabel}>
          Bakım Türü
        </ThemedText>
        <View style={styles.typeGrid}>
          {MAINTENANCE_TYPES.map((t) => {
            const active = type === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => setType(t.key)}
                style={[
                  styles.typeOption,
                  { borderColor: theme.backgroundSelected, backgroundColor: theme.card },
                  active && styles.typeOptionActive,
                ]}>
                <SymbolView
                  name={(MAINTENANCE_ICONS[t.key] ?? 'wrench.fill') as any}
                  size={18}
                  tintColor={active ? Brand.onPrimary : theme.textSecondary}
                />
                <ThemedText type="small" style={active ? styles.typeTextActive : undefined}>
                  {t.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <ThemedText type="eyebrow" style={styles.formLabel}>
          Yapıldığı Km
        </ThemedText>
        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected, backgroundColor: theme.background }]}
          placeholder={currentKm != null ? String(currentKm) : 'Örn: 125000'}
          placeholderTextColor={theme.textSecondary}
          keyboardType="number-pad"
          value={kmInput}
          onChangeText={setKmInput}
        />

        <ThemedText type="eyebrow" style={styles.formLabel}>
          Kaç Km Sonra Hatırlatılsın?
        </ThemedText>
        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected, backgroundColor: theme.background }]}
          placeholder="Örn: 10000 (boş bırakabilirsin)"
          placeholderTextColor={theme.textSecondary}
          keyboardType="number-pad"
          value={intervalInput}
          onChangeText={setIntervalInput}
        />

        <ThemedText type="eyebrow" style={styles.formLabel}>
          Not
        </ThemedText>
        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected, backgroundColor: theme.background }]}
          placeholder="Örn: Ön lastikler değişti (isteğe bağlı)"
          placeholderTextColor={theme.textSecondary}
          value={noteInput}
          onChangeText={setNoteInput}
        />

        <Pressable
          style={({ pressed }) => [styles.primaryButton, (saving || pressed) && styles.pressed]}
          onPress={handleSave}
          disabled={saving}>
          <ThemedText style={styles.primaryButtonText}>
            {saving ? 'Kaydediliyor...' : editingId ? 'Değişiklikleri Kaydet' : 'Kaydet'}
          </ThemedText>
        </Pressable>
        {editingId && (
          <Pressable
            style={styles.textButton}
            onPress={() => {
              const log = logs.find((l) => l.id === editingId);
              if (log) handleDelete(log);
            }}>
            <ThemedText type="smallBold" style={{ color: OVERDUE }}>
              Bu Kaydı Sil
            </ThemedText>
          </Pressable>
        )}
        <Pressable style={styles.textButton} onPress={() => setFormOpen(false)}>
          <ThemedText type="small" themeColor="textSecondary">
            Vazgeç
          </ThemedText>
        </Pressable>
      </ActionSheetModal>

      {/* Vize */}
      <ActionSheetModal
        visible={inspectionOpen}
        onClose={() => setInspectionOpen(false)}
        title="Vize Tarihi"
        description="Vize bitiş tarihini gir. Seçtiğin gün kadar önceden her sabah hatırlatma gelir.">
        <ThemedText type="eyebrow" style={styles.formLabel}>
          Vize Bitiş Tarihi
        </ThemedText>
        <TextInput
          style={[styles.input, styles.dateInput, { color: theme.text, borderColor: theme.backgroundSelected, backgroundColor: theme.background }]}
          placeholder="GG.AA.YYYY"
          placeholderTextColor={theme.textSecondary}
          keyboardType="number-pad"
          value={inspectionDateInput}
          onChangeText={(t) => setInspectionDateInput(formatDateTyping(t))}
          maxLength={10}
        />

        <ThemedText type="eyebrow" style={styles.formLabel}>
          Kaç Gün Önce Hatırlatılsın?
        </ThemedText>
        <View style={styles.noticeRow}>
          {NOTICE_DAY_OPTIONS.map((d) => {
            const active = noticeDays === d;
            return (
              <Pressable
                key={d}
                onPress={() => setNoticeDays(d)}
                style={[
                  styles.noticeOption,
                  { borderColor: theme.backgroundSelected, backgroundColor: theme.card },
                  active && styles.typeOptionActive,
                ]}>
                <ThemedText type="smallBold" style={active ? styles.typeTextActive : undefined}>
                  {d} gün
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={({ pressed }) => [styles.primaryButton, (savingInspection || pressed) && styles.pressed]}
          onPress={handleSaveInspection}
          disabled={savingInspection}>
          <ThemedText style={styles.primaryButtonText}>{savingInspection ? 'Kaydediliyor...' : 'Kaydet'}</ThemedText>
        </Pressable>
        {selectedVehicle?.inspection_due_date && (
          <Pressable style={styles.textButton} onPress={() => saveInspection(null, noticeDays)}>
            <ThemedText type="smallBold" style={{ color: OVERDUE }}>
              Vize Takibini Kaldır
            </ThemedText>
          </Pressable>
        )}
        <Pressable style={styles.textButton} onPress={() => setInspectionOpen(false)}>
          <ThemedText type="small" themeColor="textSecondary">
            Vazgeç
          </ThemedText>
        </Pressable>
      </ActionSheetModal>
    </SafeScreen>
  );
}

function DueCard({
  icon,
  title,
  message,
  color,
  onDone,
}: {
  icon: string;
  title: string;
  message: string;
  color: string;
  onDone: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.dueCard, { backgroundColor: theme.card, borderLeftColor: color }]}>
      <View style={[styles.dueIcon, { backgroundColor: `${color}1F` }]}>
        <SymbolView name={icon as any} size={18} tintColor={color} />
      </View>
      <View style={styles.logBody}>
        <ThemedText type="smallBold" style={styles.logTitle}>
          {title}
        </ThemedText>
        <ThemedText type="small" style={{ color }}>
          {message}
        </ThemedText>
      </View>
      <Pressable onPress={onDone} style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}>
        <SymbolView name="checkmark" size={12} tintColor={Brand.onPrimary} />
        <ThemedText style={styles.doneText}>Yapıldı</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  container: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.two },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', marginBottom: Spacing.two, paddingHorizontal: Spacing.two },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, justifyContent: 'center', backgroundColor: 'transparent' },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: Spacing.three, paddingVertical: 7 },
  chipActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  chipTextActive: { color: Brand.onPrimary },
  loading: { marginTop: Spacing.four },
  empty: { textAlign: 'center', marginTop: Spacing.five },
  summaryCard: { marginTop: Spacing.two },
  summaryRow: { flexDirection: 'row', alignItems: 'stretch' },
  summaryCell: { flex: 1, alignItems: 'center', paddingVertical: Spacing.three, gap: 2 },
  summaryDivider: { width: StyleSheet.hairlineWidth, marginVertical: Spacing.three },
  summaryValue: { fontFamily: FontFamily.displayBold, fontSize: 24, lineHeight: 30 },
  summaryHint: { fontSize: 12, lineHeight: 16 },
  summaryAdd: { color: Brand.primaryPressed, fontSize: 16, lineHeight: 30 },
  sectionTitle: { marginTop: Spacing.three, paddingHorizontal: Spacing.one },
  dueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 14,
    borderLeftWidth: 4,
  },
  dueIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Brand.primary,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  doneText: { color: Brand.onPrimary, fontFamily: FontFamily.bodyBold, fontSize: 13 },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.four,
    paddingHorizontal: Spacing.one,
  },
  addBigButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    backgroundColor: Brand.primary,
    borderRadius: 16,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    marginTop: Spacing.four,
  },
  addBigIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Brand.onPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBigTextWrap: { alignItems: 'flex-start' },
  addBigTitle: { color: Brand.onPrimary, fontFamily: FontFamily.bodyBold, fontSize: 17, lineHeight: 22 },
  addBigSubtitle: { color: Brand.onPrimary, fontFamily: FontFamily.body, fontSize: 13, lineHeight: 18, opacity: 0.8 },
  emptyCard: { alignItems: 'center', padding: Spacing.four, gap: Spacing.two },
  emptyText: { textAlign: 'center' },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: 14 },
  logIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  logBody: { flex: 1, gap: 1 },
  logTitle: { fontSize: 15 },
  logNext: { fontFamily: FontFamily.bodySemiBold, marginTop: 2 },
  footerHint: { textAlign: 'center', fontSize: 12, marginTop: Spacing.one },
  formLabel: { marginTop: Spacing.two },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  typeOptionActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  typeTextActive: { color: Brand.onPrimary, fontFamily: FontFamily.bodyBold },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: FontFamily.body,
  },
  dateInput: { fontFamily: FontFamily.bodyBold, fontSize: 18, letterSpacing: 1 },
  noticeRow: { flexDirection: 'row', gap: Spacing.two },
  noticeOption: { flex: 1, alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingVertical: 10 },
  primaryButton: {
    backgroundColor: Brand.primary,
    borderRadius: 12,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.three,
  },
  primaryButtonText: { color: Brand.onPrimary, fontFamily: FontFamily.bodyBold, fontSize: 16 },
  textButton: { alignItems: 'center', paddingVertical: Spacing.two },
  pressed: { opacity: 0.6 },
});
