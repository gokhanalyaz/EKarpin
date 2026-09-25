import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { formatDuration, getShiftDurationMinutes, listVehicleShifts, type Shift } from '@/lib/shifts';
import { listVehicleDrivers } from '@/lib/vehicle-drivers';

type Props = {
  vehicleId: string;
};

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('tr-TR')} ${d.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function formatTL(value: number | null | undefined): string {
  return `${(value ?? 0).toFixed(2)} ₺`;
}

function DetailRow({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <ThemedView style={styles.detailRow}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.detailLabel}>
        {label}
      </ThemedText>
      <ThemedText type={emphasize ? 'smallBold' : 'small'} style={styles.detailValue}>
        {value}
      </ThemedText>
    </ThemedView>
  );
}

type CardProps = {
  shift: Shift;
  driverName?: string;
  vehiclePlate?: string;
  /** false ise karta dokununca vardiya detayina gidilmez (detay ekraninin kendisinde kullanildiginda). */
  pressable?: boolean;
};

/** Kapanmis bir vardiyanin kalem kalem dokumu. Hem liste hem de tek vardiya detay ekraninda kullanilir. */
export function ShiftHistoryCard({ shift: s, driverName, vehiclePlate, pressable = true }: CardProps) {
  const minutes = getShiftDurationMinutes(s.opened_at, s.closed_at);
  const isPercentage = s.payment_model === 'percentage';
  const hasCard = (s.card_amount ?? 0) > 0;

  const content = (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">
        {vehiclePlate ? `${vehiclePlate} · ` : ''}
        {driverName ?? 'Şoför'}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.dateLine}>
        {formatDateTime(s.opened_at)} → {s.closed_at ? formatDateTime(s.closed_at) : '-'}
        {minutes != null ? ` · ${formatDuration(minutes)}` : ''}
      </ThemedText>

      <ThemedView style={styles.details}>
        <DetailRow label="Açılış Km" value={s.opening_km != null ? String(s.opening_km) : '-'} />
        <DetailRow label="Kapanış Km" value={s.closing_km != null ? String(s.closing_km) : '-'} />

        {isPercentage ? (
          <>
            <DetailRow label="Hasılat (Tutar)" value={formatTL(s.total_amount)} />
            {hasCard && <DetailRow label="Kredi Kartı" value={formatTL(s.card_amount)} />}
            <DetailRow label="Motorin" value={formatTL(s.fuel_cost)} />
            <DetailRow label="Diğer Masraf" value={formatTL(s.other_expenses)} />
            {s.other_expenses_note ? (
              <DetailRow label="Masraf Notu" value={s.other_expenses_note} />
            ) : null}
            <DetailRow label="Ondalık (Şoför Payı)" value={formatTL(s.driver_share)} />
            <DetailRow label="Net Kalan" value={formatTL(s.owner_total)} emphasize />
            {hasCard && <DetailRow label="Nakit Tutar" value={formatTL(s.net_cash)} emphasize />}
          </>
        ) : (
          <>
            <DetailRow label="Toplam Km" value={s.km_total != null ? String(s.km_total) : '-'} />
            <DetailRow label="Km Borcu" value={formatTL(s.km_debt)} emphasize />
          </>
        )}
      </ThemedView>

      {s.notes ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
          Not: {s.notes}
        </ThemedText>
      ) : null}
    </ThemedView>
  );

  if (!pressable) return content;

  return (
    <Pressable onPress={() => router.push(`/shift-detail/${s.id}`)}>
      {content}
    </Pressable>
  );
}

export function ShiftHistoryList({ vehicleId }: Props) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [driverNames, setDriverNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listVehicleShifts(vehicleId), listVehicleDrivers(vehicleId)])
      .then(([shiftRows, driverRows]) => {
        if (cancelled) return;
        setShifts(shiftRows.filter((s) => s.status === 'closed'));
        const map: Record<string, string> = {};
        driverRows.forEach((row) => {
          map[row.driver_id] = row.driver?.full_name ?? 'İsimsiz';
        });
        setDriverNames(map);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  if (loading) return null;

  if (shifts.length === 0) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        Henüz kapanmış vardiya yok.
      </ThemedText>
    );
  }

  return (
    <ThemedView style={styles.list}>
      {shifts.map((s) => (
        <ShiftHistoryCard key={s.id} shift={s} driverName={driverNames[s.driver_id]} />
      ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two },
  card: { padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.half },
  dateLine: { marginBottom: Spacing.half },
  details: {
    borderRadius: Spacing.one,
    paddingTop: Spacing.half,
    gap: Spacing.half,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: { flexShrink: 1 },
  detailValue: { flexShrink: 0, textAlign: 'right' },
  note: { marginTop: Spacing.half },
});
