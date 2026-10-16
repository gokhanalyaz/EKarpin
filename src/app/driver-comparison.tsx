import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { queryShifts, type Shift } from '@/lib/shifts';
import { listVehicleDrivers, type VehicleDriverRow } from '@/lib/vehicle-drivers';
import { listOwnerVehicles, type Vehicle } from '@/lib/vehicles';

type Period = 'today' | 'week' | 'month';

const PERIOD_LABELS: Record<Period, string> = {
  today: 'Bugün',
  week: 'Bu Hafta',
  month: 'Bu Ay',
};

function periodToRange(period: Period): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now);
  if (period === 'today') {
    from.setHours(0, 0, 0, 0);
  } else if (period === 'week') {
    from.setDate(from.getDate() - 7);
  } else {
    from.setDate(from.getDate() - 30);
  }
  return { from: from.toISOString(), to: now.toISOString() };
}

type DriverStats = {
  driverId: string;
  name: string;
  shiftCount: number;
  ownerTotal: number;
  kmTotal: number;
  kmDiscount: number;
};

export default function DriverComparisonScreen() {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [drivers, setDrivers] = useState<VehicleDriverRow[]>([]);
  const [period, setPeriod] = useState<Period>('week');
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const v = await listOwnerVehicles(profile.id);
      setVehicles(v);
      const targets = selectedVehicleId ? [selectedVehicleId] : v.map((x) => x.id);
      const driverLists = await Promise.all(
        targets.map((id) => listVehicleDrivers(id).catch(() => [] as VehicleDriverRow[]))
      );
      const merged = new Map<string, VehicleDriverRow>();
      driverLists.flat().forEach((row) => merged.set(row.driver_id, row));
      setDrivers(Array.from(merged.values()));

      const { from, to } = periodToRange(period);
      const result = await queryShifts({ vehicleIds: targets, from, to });
      setShifts(result);
    } catch (e) {
      console.warn('Karşılaştırma verisi yüklenemedi', e);
    } finally {
      setLoading(false);
    }
  }, [profile, selectedVehicleId, period]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const driverNameById = useMemo(() => {
    const map: Record<string, string> = {};
    drivers.forEach((d) => {
      map[d.driver_id] = d.driver?.full_name ?? 'İsimsiz';
    });
    return map;
  }, [drivers]);

  const stats = useMemo<DriverStats[]>(() => {
    const byDriver = new Map<string, DriverStats>();
    shifts.forEach((s) => {
      const existing = byDriver.get(s.driver_id) ?? {
        driverId: s.driver_id,
        name: driverNameById[s.driver_id] ?? 'İsimsiz',
        shiftCount: 0,
        ownerTotal: 0,
        kmTotal: 0,
        kmDiscount: 0,
      };
      existing.shiftCount += 1;
      existing.ownerTotal += Number(s.owner_total) || 0;
      existing.kmTotal += Number(s.km_total) || 0;
      existing.kmDiscount += Number(s.km_discount) || 0;
      byDriver.set(s.driver_id, existing);
    });
    return Array.from(byDriver.values()).sort((a, b) => b.ownerTotal - a.ownerTotal);
  }, [shifts, driverNameById]);

  const maxOwnerTotal = Math.max(1, ...stats.map((s) => s.ownerTotal));

  return (
    <ThemedView style={{ flex: 1, paddingTop: insets.top }}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <ThemedText type="title" style={styles.title}>
          Şoför Karşılaştırma
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

        <ThemedText type="smallBold" style={styles.sectionTitle}>
          Dönem
        </ThemedText>
        <ThemedView style={styles.chipRow}>
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <Chip key={p} label={PERIOD_LABELS[p]} active={period === p} onPress={() => setPeriod(p)} />
          ))}
        </ThemedView>

        <ThemedText type="smallBold" style={styles.sectionTitle}>
          Sonuçlar
        </ThemedText>
        {loading ? (
          <ActivityIndicator style={styles.loading} />
        ) : stats.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Bu dönem için kapanmış karpin bulunamadı.
          </ThemedText>
        ) : (
          <ThemedView style={styles.list}>
            {stats.map((s) => (
              <ThemedView key={s.driverId} type="backgroundElement" style={styles.card}>
                <ThemedView style={styles.cardHeader}>
                  <ThemedText type="smallBold">{s.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {s.shiftCount} karpin
                  </ThemedText>
                </ThemedView>
                <ThemedView style={styles.barTrack}>
                  <ThemedView style={[styles.barFill, { width: `${(s.ownerTotal / maxOwnerTotal) * 100}%` }]} />
                </ThemedView>
                <ThemedText type="small" themeColor="textSecondary">
                  Araç sahibine kalan: {s.ownerTotal.toFixed(2)} ₺
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Toplam km: {s.kmTotal.toFixed(0)} km
                  {s.kmDiscount > 0 ? ` · Düşülen km: ${s.kmDiscount.toFixed(0)}` : ''}
                </ThemedText>
              </ThemedView>
            ))}
          </ThemedView>
        )}
      </ScrollView>
    </ThemedView>
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
  chipActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  chipTextActive: { color: Brand.onPrimary, fontWeight: '700' },
  loading: { marginTop: Spacing.four },
  list: { gap: Spacing.two, marginTop: Spacing.two },
  card: { padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.one },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: '#94A3B833', overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4, backgroundColor: Brand.primary },
});
