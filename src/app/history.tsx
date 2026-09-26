import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet } from 'react-native';

import { ShiftHistoryCard, type SettlementInfo } from '@/components/shift-history-list';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { queryShifts, type Shift } from '@/lib/shifts';
import {
  getSettlementLabel,
  getSettlementState,
  markDeliveredAndNotify,
  markReceivedAndNotify,
  settlementAmount,
} from '@/lib/settlement';
import { listVehicleDrivers, type VehicleDriverRow } from '@/lib/vehicle-drivers';
import { listAssignedVehicles, listOwnerVehicles, type Vehicle } from '@/lib/vehicles';

type DatePreset = 'today' | 'week' | 'month' | 'all';

function presetToRange(preset: DatePreset): { from?: string; to?: string } {
  if (preset === 'all') return {};
  const now = new Date();
  const from = new Date(now);
  if (preset === 'today') {
    from.setHours(0, 0, 0, 0);
  } else if (preset === 'week') {
    from.setDate(from.getDate() - 7);
  } else {
    from.setDate(from.getDate() - 30);
  }
  return { from: from.toISOString(), to: now.toISOString() };
}

const PRESET_LABELS: Record<DatePreset, string> = {
  today: 'Bugün',
  week: 'Son 7 Gün',
  month: 'Son 30 Gün',
  all: 'Tüm Zamanlar',
};

export default function HistoryScreen() {
  const { vehicleId: initialVehicleId } = useLocalSearchParams<{ vehicleId?: string }>();
  const { profile } = useAuth();
  const isOwner = profile?.role === 'owner';

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(initialVehicleId ?? null);
  const [drivers, setDrivers] = useState<VehicleDriverRow[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [preset, setPreset] = useState<DatePreset>('all');

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);

  type SettlementFilter = 'all' | 'pending' | 'done';
  const [settlementFilter, setSettlementFilter] = useState<SettlementFilter>('all');

  useEffect(() => {
    if (!profile) return;
    setVehiclesLoading(true);
    const loader = isOwner ? listOwnerVehicles(profile.id) : listAssignedVehicles(profile.id);
    loader
      .then((rows) => setVehicles(rows))
      .catch(() => {})
      .finally(() => setVehiclesLoading(false));
  }, [profile, isOwner]);

  useEffect(() => {
    if (!isOwner) return;
    const targets = selectedVehicleId ? [selectedVehicleId] : vehicles.map((v) => v.id);
    if (targets.length === 0) {
      setDrivers([]);
      return;
    }
    Promise.all(targets.map((id) => listVehicleDrivers(id).catch(() => [] as VehicleDriverRow[])))
      .then((lists) => {
        const merged = new Map<string, VehicleDriverRow>();
        lists.flat().forEach((row) => merged.set(row.driver_id, row));
        setDrivers(Array.from(merged.values()));
      })
      .catch(() => {});
  }, [isOwner, selectedVehicleId, vehicles]);

  const driverNameById = useMemo(() => {
    const map: Record<string, string> = {};
    drivers.forEach((d) => {
      map[d.driver_id] = d.driver?.full_name ?? 'İsimsiz';
    });
    return map;
  }, [drivers]);

  const vehiclePlateById = useMemo(() => {
    const map: Record<string, string> = {};
    vehicles.forEach((v) => {
      map[v.id] = v.plate_no;
    });
    return map;
  }, [vehicles]);

  const kmDiscountSummary = useMemo(() => {
    const byDriver = new Map<string, number>();
    let total = 0;
    shifts.forEach((s) => {
      const value = Number(s.km_discount) || 0;
      if (value <= 0) return;
      total += value;
      byDriver.set(s.driver_id, (byDriver.get(s.driver_id) ?? 0) + value);
    });
    const rows = Array.from(byDriver.entries())
      .map(([driverId, kmSum]) => ({ driverId, kmSum, name: driverNameById[driverId] ?? 'İsimsiz' }))
      .sort((a, b) => b.kmSum - a.kmSum);
    return { total, rows };
  }, [shifts, driverNameById]);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const { from, to } = presetToRange(preset);
      const result = await queryShifts({
        vehicleIds: selectedVehicleId ? [selectedVehicleId] : vehicles.map((v) => v.id),
        driverId: isOwner ? selectedDriverId ?? undefined : profile.id,
        from,
        to,
      });
      setShifts(result);
    } catch (e) {
      console.warn('Karpin geçmişi yüklenemedi', e);
    } finally {
      setLoading(false);
    }
  }, [profile, isOwner, selectedVehicleId, selectedDriverId, preset, vehicles]);

  const settlementTotals = useMemo(() => {
    let pendingTotal = 0;
    let doneTotal = 0;
    let pendingCount = 0;
    let doneCount = 0;
    shifts.forEach((s) => {
      if (getSettlementState(s) === 'confirmed') {
        doneTotal += settlementAmount(s);
        doneCount += 1;
      } else {
        pendingTotal += settlementAmount(s);
        pendingCount += 1;
      }
    });
    return { pendingTotal, doneTotal, pendingCount, doneCount };
  }, [shifts]);

  const visibleShifts = useMemo(() => {
    if (settlementFilter === 'all') return shifts;
    return shifts.filter((s) =>
      settlementFilter === 'done' ? getSettlementState(s) === 'confirmed' : getSettlementState(s) !== 'confirmed'
    );
  }, [shifts, settlementFilter]);

  async function handleConfirmOne(shift: Shift) {
    try {
      if (isOwner) {
        await markReceivedAndNotify([shift]);
      } else {
        await markDeliveredAndNotify([shift], profile?.full_name ?? 'Bir şoför');
      }
      await load();
    } catch (e: any) {
      Alert.alert('İşlem başarısız', e?.message ?? 'Bilinmeyen hata oluştu.');
    }
  }

  useEffect(() => {
    if (vehiclesLoading) return;
    load();
  }, [vehiclesLoading, load]);

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <ThemedText type="title" style={styles.title}>
        Karpin Geçmişi
      </ThemedText>

      <ThemedText type="smallBold" style={styles.sectionTitle}>
        Araç
      </ThemedText>
      <ThemedView style={styles.chipRow}>
        <Chip label="Tüm Araçlar" active={selectedVehicleId === null} onPress={() => setSelectedVehicleId(null)} />
        {vehicles.map((v) => (
          <Chip
            key={v.id}
            label={v.plate_no}
            active={selectedVehicleId === v.id}
            onPress={() => setSelectedVehicleId(v.id)}
          />
        ))}
      </ThemedView>

      {isOwner && (
        <>
          <ThemedText type="smallBold" style={styles.sectionTitle}>
            Şoför
          </ThemedText>
          <ThemedView style={styles.chipRow}>
            <Chip
              label="Tüm Şoförler"
              active={selectedDriverId === null}
              onPress={() => setSelectedDriverId(null)}
            />
            {drivers.map((d) => (
              <Chip
                key={d.driver_id}
                label={d.driver?.full_name ?? 'İsimsiz'}
                active={selectedDriverId === d.driver_id}
                onPress={() => setSelectedDriverId(d.driver_id)}
              />
            ))}
          </ThemedView>
        </>
      )}

      <ThemedText type="smallBold" style={styles.sectionTitle}>
        Tarih Aralığı
      </ThemedText>
      <ThemedView style={styles.chipRow}>
        {(Object.keys(PRESET_LABELS) as DatePreset[]).map((p) => (
          <Chip key={p} label={PRESET_LABELS[p]} active={preset === p} onPress={() => setPreset(p)} />
        ))}
      </ThemedView>

      {isOwner && kmDiscountSummary.total > 0 && (
        <ThemedView type="backgroundElement" style={styles.kmSummaryBox}>
          <ThemedText type="smallBold">Km Düşümü Özeti (bu filtre için)</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Toplam düşülen: {kmDiscountSummary.total} km
          </ThemedText>
          {kmDiscountSummary.rows.map((row) => (
            <ThemedText key={row.driverId} type="small" themeColor="textSecondary">
              {row.name}: {row.kmSum} km
            </ThemedText>
          ))}
        </ThemedView>
      )}

      <ThemedText type="smallBold" style={styles.sectionTitle}>
        Teslim Durumu
      </ThemedText>
      <ThemedView style={styles.chipRow}>
        <Chip label="Tümü" active={settlementFilter === 'all'} onPress={() => setSettlementFilter('all')} />
        <Chip
          label={isOwner ? 'Teslim Alınmayan' : 'Teslim Etmediğim'}
          active={settlementFilter === 'pending'}
          onPress={() => setSettlementFilter('pending')}
        />
        <Chip
          label={isOwner ? 'Teslim Alınan' : 'Teslim Ettiğim'}
          active={settlementFilter === 'done'}
          onPress={() => setSettlementFilter('done')}
        />
      </ThemedView>

      {!loading && shifts.length > 0 && (
        <ThemedView type="backgroundElement" style={styles.kmSummaryBox}>
          <ThemedText type="small" themeColor="textSecondary">
            {isOwner ? 'Teslim alınmayan' : 'Teslim etmediğim'}: {settlementTotals.pendingCount} karpin ·{' '}
            {settlementTotals.pendingTotal.toFixed(2)} ₺
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {isOwner ? 'Teslim alınan' : 'Teslim ettiğim'}: {settlementTotals.doneCount} karpin ·{' '}
            {settlementTotals.doneTotal.toFixed(2)} ₺
          </ThemedText>
        </ThemedView>
      )}

      <ThemedText type="smallBold" style={styles.sectionTitle}>
        Sonuçlar {loading ? '' : `(${visibleShifts.length})`}
      </ThemedText>
      {loading ? (
        <ActivityIndicator style={styles.loading} />
      ) : visibleShifts.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Bu filtrelere uyan kapanmış vardiya yok.
        </ThemedText>
      ) : (
        <ThemedView style={styles.list}>
          {visibleShifts.map((s) => {
            const state = getSettlementState(s);
            const canAct = isOwner ? state !== 'confirmed' : state === 'pending';
            const numLabel = s.shift_no != null ? `#${s.shift_no} numaralı karpini` : 'bu karpini';
            const settlement: SettlementInfo = {
              state,
              label: getSettlementLabel(state, isOwner ? 'owner' : 'driver'),
              onConfirm: canAct ? () => handleConfirmOne(s) : undefined,
              confirmTitle: isOwner ? 'Teslim Aldınız mı?' : 'Teslim Ettiniz mi?',
              confirmMessage: isOwner
                ? `${numLabel} teslim aldığınızı onaylıyor musunuz?`
                : `${numLabel} teslim ettiğinizi onaylıyor musunuz?`,
              confirmButtonLabel: isOwner ? 'Teslim Aldım' : 'Teslim Ettim',
            };
            return (
              <ShiftHistoryCard
                key={s.id}
                shift={s}
                driverName={driverNameById[s.driver_id]}
                vehiclePlate={!selectedVehicleId ? vehiclePlateById[s.vehicle_id] : undefined}
                settlement={settlement}
              />
            );
          })}
        </ThemedView>
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
  container: { padding: Spacing.four, gap: Spacing.two, paddingBottom: Spacing.six },
  title: { marginBottom: Spacing.two },
  sectionTitle: { marginTop: Spacing.three },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    borderWidth: 1,
    borderColor: '#94A3B8',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  chipActive: { backgroundColor: '#208AEF', borderColor: '#208AEF' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  loading: { marginTop: Spacing.four },
  list: { gap: Spacing.two, marginTop: Spacing.two },
  kmSummaryBox: { padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.half, marginTop: Spacing.three },
  batchButton: {
    backgroundColor: '#208AEF',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.three,
  },
  batchButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  buttonPressed: { opacity: 0.7 },
});
