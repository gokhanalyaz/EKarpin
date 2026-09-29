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
  /** Verilirse rozete dokununca hemen (Alert ile sorup) SADECE bu vardiyayi isaretler. */
  onConfirm?: () => void;
  confirmTitle?: string;
  confirmMessage?: string;
  confirmButtonLabel?: string;
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

  function handleSettlementPress() {
    if (!settlement?.onConfirm) return;
    Alert.alert(
      settlement.confirmTitle ?? 'Emin misiniz?',
      settlement.confirmMessage,
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: settlement.confirmButtonLabel ?? 'Evet', onPress: settlement.onConfirm },
      ]
    );
  }

  const content = (
    <ThemedView type="backgroundElement" style={[styles.card, settlementCardStyle]}>
      {settlement && (
        <ThemedView style={styles.settlementRow}>
          {settlement.onConfirm ? (
            <Pressable onPress={handleSettlementPress} hitSlop={8}>
              <ThemedText type="small" style={[styles.settlementBadge, settlementBadgeStyle]}>
                {settlement.label} ›
              </ThemedText>
            </Pressable>
          ) : (
            <ThemedText type="small" style={[styles.settlementBadge, settlementBadgeStyle]}>
              {settlement.label}
            </ThemedText>
          )}
        </ThemedView>
      )}
      <ThemedText type="smallBold">
        {s.shift_no != null ? `Karpin No: ${s.shift_no} · ` : ''}
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
      {shifts.map((s) => {
        const state = getSettlementState(s);
        const canAct = isOwner ? state !== 'confirmed' : state === 'pending';
        const numLabel = s.shift_no != null ? `#${s.shift_no} numaralı karpini` : 'bu karpini';
        return (
          <ShiftHistoryCard
            key={s.id}
            shift={s}
            driverName={driverNames[s.driver_id]}
            settlement={{
              state,
              label: getSettlementLabel(state, isOwner ? 'owner' : 'driver'),
              onConfirm: canAct ? () => handleConfirmOne(s) : undefined,
              confirmTitle: isOwner ? 'Teslim Aldınız mı?' : 'Teslim Ettiniz mi?',
              confirmMessage: isOwner
                ? `${numLabel} teslim aldığınızı onaylıyor musunuz?`
                : `${numLabel} teslim ettiğinizi onaylıyor musunuz?`,
              confirmButtonLabel: isOwner ? 'Teslim Aldım' : 'Teslim Ettim',
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
