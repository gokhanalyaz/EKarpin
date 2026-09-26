import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { formatDuration, getShiftDurationMinutes, listVehicleShifts, type Shift } from '@/lib/shifts';
import { getSettlementLabel, getSettlementState, markDeliveredAndNotify, markReceivedAndNotify, settlementAmount } from '@/lib/settlement';
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

export type SettlementInfo = {
  state: 'pending' | 'awaiting_confirmation' | 'confirmed';
  label: string;
  /** Verilirse kartin basinda bir secim kutusu (checkbox) gosterilir. */
  selected?: boolean;
  onToggleSelect?: () => void;
};

type CardProps = {
  shift: Shift;
  driverName?: string;
  vehiclePlate?: string;
  /** false ise karta dokununca vardiya detayina gidilmez (detay ekraninin kendisinde kullanildiginda). */
  pressable?: boolean;
  settlement?: SettlementInfo;
};

/** Kapanmis bir vardiyanin kalem kalem dokumu. Hem liste hem de tek vardiya detay ekraninda kullanilir. */
export function ShiftHistoryCard({ shift: s, driverName, vehiclePlate, pressable = true, settlement }: CardProps) {
  const minutes = getShiftDurationMinutes(s.opened_at, s.closed_at);
  const isPercentage = s.payment_model === 'percentage';
  const hasCard = (s.card_amount ?? 0) > 0;

  const settlementCardStyle =
    settlement?.state === 'pending'
      ? styles.cardPending
      : settlement?.state === 'awaiting_confirmation'
      ? styles.cardAwaiting
      : undefined;
  const settlementBadgeStyle =
    settlement?.state === 'confirmed'
      ? styles.settlementDone
      : settlement?.state === 'awaiting_confirmation'
      ? styles.settlementAwaiting
      : styles.settlementPending;

  const content = (
    <ThemedView type="backgroundElement" style={[styles.card, settlementCardStyle]}>
      {settlement && (
        <ThemedView style={styles.settlementRow}>
          {settlement.onToggleSelect ? (
            <Pressable onPress={settlement.onToggleSelect} style={styles.checkbox} hitSlop={8}>
              <ThemedText>{settlement.selected ? '☑️' : '⬜️'}</ThemedText>
            </Pressable>
          ) : null}
          <ThemedText type="small" style={[styles.settlementBadge, settlementBadgeStyle]}>
            {settlement.label}
          </ThemedText>
        </ThemedView>
      )}
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
  const { profile } = useAuth();
  const isOwner = profile?.role === 'owner';
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [driverNames, setDriverNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = () => {
    return Promise.all([listVehicleShifts(vehicleId), listVehicleDrivers(vehicleId)]).then(
      ([shiftRows, driverRows]) => {
        setShifts(shiftRows.filter((s) => s.status === 'closed'));
        const map: Record<string, string> = {};
        driverRows.forEach((row) => {
          map[row.driver_id] = row.driver?.full_name ?? 'İsimsiz';
        });
        setDriverNames(map);
      }
    );
  };

  useEffect(() => {
    let cancelled = false;
    load()
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  const pendingCount = useMemo(
    () => shifts.filter((s) => getSettlementState(s) !== 'confirmed').length,
    [shifts]
  );

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBatchMark() {
    const selected = shifts.filter((s) => selectedIds.has(s.id));
    if (selected.length === 0) return;
    setBusy(true);
    try {
      if (isOwner) {
        await markReceivedAndNotify(selected);
      } else {
        await markDeliveredAndNotify(selected, profile?.full_name ?? 'Bir şoför');
      }
      setSelectedIds(new Set());
      await load();
      Alert.alert(
        'Kaydedildi',
        isOwner
          ? `${selected.length} karpin teslim alındı olarak işaretlendi.`
          : `${selected.length} karpin teslim edildi olarak işaretlendi, araç sahibine bildirim gönderildi.`
      );
    } catch (e: any) {
      Alert.alert('İşlem başarısız', e?.message ?? 'Bilinmeyen hata oluştu.');
    } finally {
      setBusy(false);
    }
  }

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
      {pendingCount > 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          {isOwner ? 'Teslim alınmayan' : 'Teslim etmediğim'}: {pendingCount} karpin
        </ThemedText>
      )}
      {selectedIds.size > 0 && (
        <Pressable
          style={({ pressed }) => [styles.batchButton, (busy || pressed) && styles.buttonPressed]}
          onPress={handleBatchMark}
          disabled={busy}>
          <ThemedText style={styles.batchButtonText}>
            {busy ? 'İşleniyor...' : isOwner ? `Teslim Aldım (${selectedIds.size})` : `Teslim Ettim (${selectedIds.size})`}
          </ThemedText>
        </Pressable>
      )}
      {shifts.map((s) => {
        const state = getSettlementState(s);
        const canAct = isOwner ? state !== 'confirmed' : state === 'pending';
        return (
          <ShiftHistoryCard
            key={s.id}
            shift={s}
            driverName={driverNames[s.driver_id]}
            settlement={{
              state,
              label: getSettlementLabel(state, isOwner ? 'owner' : 'driver'),
              selected: selectedIds.has(s.id),
              onToggleSelect: canAct ? () => toggleSelect(s.id) : undefined,
            }}
          />
        );
      })}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two },
  batchButton: {
    backgroundColor: '#208AEF',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  batchButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  buttonPressed: { opacity: 0.7 },
  card: { padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.half },
  cardPending: { borderWidth: 1.5, borderColor: '#F59E0B' },
  cardAwaiting: { borderWidth: 1.5, borderColor: '#2563EB' },
  settlementRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.half },
  checkbox: { paddingVertical: Spacing.half },
  settlementBadge: { paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: Spacing.one, overflow: 'hidden' },
  settlementDone: { backgroundColor: '#16A34A33', color: '#16A34A' },
  settlementAwaiting: { backgroundColor: '#2563EB33', color: '#1D4ED8' },
  settlementPending: { backgroundColor: '#F59E0B33', color: '#B45309' },
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
