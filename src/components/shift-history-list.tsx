import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';

import { PhotoViewButton } from '@/components/photo-view-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, FontFamily, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { PRESET_LABELS, presetToRange, type DatePreset } from '@/lib/date-presets';
import { formatDuration, getShiftDurationMinutes, listVehicleShifts, type Shift } from '@/lib/shifts';
import { expenseCategoryLabel } from '@/lib/expense-categories';
import { getSettlementLabel, getSettlementState, markDeliveredAndNotify, markReceivedAndNotify, settlementAmount } from '@/lib/settlement';
import { listVehicleDrivers } from '@/lib/vehicle-drivers';
import type { Vehicle } from '@/lib/vehicles';

type Props = {
  vehicle: Vehicle;
  /** true ise tarih araligi + teslim durumu filtreleri ve ozet kutusu da gosterilir (su an arac detay sayfasinda kullaniliyor). */
  showFilters?: boolean;
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

function DetailRow({
  label,
  value,
  emphasize,
  last,
  photoPath,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  /** Son satirda alt cizgi cekilmez - tablonun kapanisi temiz dursun diye. */
  last?: boolean;
  /** Verilirse (fotograf varsa) deger yanina kucuk bir fotograf ikonu eklenir, tiklayinca fotograf acilir. */
  photoPath?: string | null;
}) {
  const theme = useTheme();
  return (
    <ThemedView
      style={[styles.detailRow, !last && { borderBottomColor: theme.backgroundSelected, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.detailLabel}>
        {label}
      </ThemedText>
      <ThemedView style={styles.detailValueGroup}>
        <ThemedText type={emphasize ? 'smallBold' : 'small'} style={styles.detailValue}>
          {value}
        </ThemedText>
        {photoPath ? <PhotoViewButton path={photoPath} iconOnly /> : null}
      </ThemedView>
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
  /** Verilirse ve yuzdelik + km-karsilastirma orani ayarliysa "Km ile Karsilastir" butonu gosterilir. */
  vehicle?: Vehicle;
  /** false ise karta dokununca vardiya detayina gidilmez (detay ekraninin kendisinde kullanildiginda). */
  pressable?: boolean;
  settlement?: SettlementInfo;
};

/** Kapanmis bir vardiyanin kalem kalem dokumu. Hem liste hem de tek vardiya detay ekraninda kullanilir. */
export function ShiftHistoryCard({ shift: s, driverName, vehiclePlate, vehicle, pressable = true, settlement }: CardProps) {
  const minutes = getShiftDurationMinutes(s.opened_at, s.closed_at);
  const isPercentage = s.payment_model === 'percentage';
  const hasCard = (s.card_amount ?? 0) > 0;
  // "Toplam Diger Masraf" ve "Masraf Notu" ayri ayri degil, tek bir
  // "Masraf" satirinda birlikte gosteriliyor.
  const masrafValue = s.other_expenses_note
    ? `${formatTL(s.other_expenses)} (${s.other_expenses_note})`
    : formatTL(s.other_expenses);

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

  function handleCompareKm() {
    if (!vehicle?.expected_revenue_per_km || s.km_total == null) return;
    const rate = vehicle.expected_revenue_per_km;
    const expected = s.km_total * rate;
    const actual = s.total_amount ?? 0;
    const diff = actual - expected;
    const pct = expected > 0 ? (diff / expected) * 100 : 0;
    let verdict: string;
    if (expected > 0 && diff < -expected * 0.15) {
      verdict = 'Beklenenin belirgin altında — kayıp/eksik bildirim riski olabilir.';
    } else if (expected > 0 && diff > expected * 0.15) {
      verdict = 'Beklenenin üzerinde.';
    } else {
      verdict = 'Beklenen aralıkta, normal görünüyor.';
    }
    Alert.alert(
      'Km ile Karşılaştırma',
      `Kat edilen km: ${s.km_total}\n` +
        `Beklenen hasılat (${rate} ₺/km): ${expected.toFixed(2)} ₺\n` +
        `Gerçek hasılat: ${actual.toFixed(2)} ₺\n` +
        `Fark: ${diff >= 0 ? '+' : ''}${diff.toFixed(2)} ₺ (%${pct.toFixed(0)})\n\n${verdict}`
    );
  }

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
        <ThemedView style={[styles.settlementRow, styles.transparentBg]}>
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

      <ThemedView style={[styles.details, styles.transparentBg]}>
        <DetailRow
          label="Açılış Km"
          value={s.opening_km != null ? String(s.opening_km) : '-'}
          photoPath={s.opening_km_photo_url}
        />
        <DetailRow
          label="Kapanış Km"
          value={s.closing_km != null ? String(s.closing_km) : '-'}
          photoPath={s.closing_km_photo_url}
        />

        {isPercentage ? (
          <>
            <DetailRow label="Hasılat (Tutar)" value={formatTL(s.total_amount)} />
            {hasCard && <DetailRow label="Kredi Kartı" value={formatTL(s.card_amount)} />}
            <DetailRow label="Motorin" value={formatTL(s.fuel_cost)} photoPath={s.fuel_receipt_url} />
            {s.expense_items && s.expense_items.length > 0 ? (
              <>
                {s.expense_items.map((item, idx) => (
                  <DetailRow
                    key={idx}
                    label={expenseCategoryLabel(item.category)}
                    value={formatTL(item.amount)}
                  />
                ))}
                <DetailRow label="Masraf" value={masrafValue} emphasize />
              </>
            ) : (
              <DetailRow label="Masraf" value={masrafValue} />
            )}
            <DetailRow label="Ondalık (Şoför Payı)" value={formatTL(s.driver_share)} />
            <DetailRow label="Net Kalan" value={formatTL(s.owner_total)} emphasize last={!hasCard} />
            {hasCard && <DetailRow label="Nakit Tutar" value={formatTL(s.net_cash)} emphasize last />}
          </>
        ) : (
          <>
            <DetailRow label="Toplam Km" value={s.km_total != null ? String(s.km_total) : '-'} />
            <DetailRow label="Km Borcu" value={formatTL(s.km_debt)} emphasize last />
          </>
        )}
      </ThemedView>

      {isPercentage && vehicle?.expected_revenue_per_km != null && s.km_total != null && (
        <Pressable
          style={({ pressed }) => [styles.compareButton, pressed && styles.buttonPressed]}
          onPress={handleCompareKm}>
          <ThemedText type="linkPrimary" style={{ fontSize: 13 }}>
            📊 Km ile Karşılaştır
          </ThemedText>
        </Pressable>
      )}

      {s.notes ? (
        <ThemedView style={[styles.noteRow, styles.transparentBg]}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            Not: {s.notes}
          </ThemedText>
          {s.notes_photo_url ? <PhotoViewButton path={s.notes_photo_url} iconOnly /> : null}
        </ThemedView>
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

export function ShiftHistoryList({ vehicle, showFilters }: Props) {
  const { profile } = useAuth();
  const isOwner = profile?.role === 'owner';
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [driverNames, setDriverNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<DatePreset>('all');
  const [settlementFilter, setSettlementFilter] = useState<'all' | 'pending' | 'done'>('all');

  const load = () => {
    return Promise.all([listVehicleShifts(vehicle.id), listVehicleDrivers(vehicle.id)]).then(
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
  }, [vehicle.id]);

  // Ekran her odaklandığında (bildirime dokununca, ya da uygulamaya geri
  // dönünce) listeyi sessizce (loading gösterip yanıp sönmeden) tazele ki
  // şoförün az önce "teslim ettim" işaretlemesi hemen görünsün.
  useFocusEffect(
    useCallback(() => {
      load().catch(() => {});
    }, [vehicle.id])
  );

  const visibleShifts = useMemo(() => {
    const { from, to } = presetToRange(preset);
    return shifts.filter((s) => {
      if (from && s.opened_at < from) return false;
      if (to && s.opened_at > to) return false;
      if (settlementFilter === 'all') return true;
      const state = getSettlementState(s);
      return settlementFilter === 'done' ? state === 'confirmed' : state !== 'confirmed';
    });
  }, [shifts, preset, settlementFilter]);

  const settlementTotals = useMemo(() => {
    let pendingTotal = 0;
    let doneTotal = 0;
    let pendingCount = 0;
    let doneCount = 0;
    visibleShifts.forEach((s) => {
      if (getSettlementState(s) === 'confirmed') {
        doneTotal += settlementAmount(s);
        doneCount += 1;
      } else {
        pendingTotal += settlementAmount(s);
        pendingCount += 1;
      }
    });
    return { pendingTotal, doneTotal, pendingCount, doneCount };
  }, [visibleShifts]);

  async function handleConfirmOne(shift: Shift) {
    // Anında geri bildirim icin: ag cevabini beklemeden listeyi guncelle,
    // basarisiz olursa geri al.
    const previousShifts = shifts;
    const now = new Date().toISOString();
    setShifts((prev) =>
      prev.map((s) =>
        s.id === shift.id
          ? { ...s, ...(isOwner ? { owner_confirmed_received_at: now } : { driver_marked_delivered_at: now }) }
          : s
      )
    );
    try {
      if (isOwner) {
        await markReceivedAndNotify([shift]);
      } else {
        await markDeliveredAndNotify([shift], profile?.full_name ?? 'Bir şoför');
      }
      load().catch(() => {});
    } catch (e: any) {
      setShifts(previousShifts);
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
    <ThemedView style={[styles.list, styles.transparentBg]}>
      {showFilters && (
        <>
          <ThemedView style={[styles.filterChipRow, styles.transparentBg]}>
            {(Object.keys(PRESET_LABELS) as DatePreset[]).map((p) => (
              <FilterChip key={p} label={PRESET_LABELS[p]} active={preset === p} onPress={() => setPreset(p)} />
            ))}
          </ThemedView>
          <ThemedView style={[styles.filterChipRow, styles.transparentBg]}>
            <FilterChip label="Tümü" active={settlementFilter === 'all'} onPress={() => setSettlementFilter('all')} />
            <FilterChip
              label={isOwner ? 'Teslim Alınmayan' : 'Teslim Etmediğim'}
              active={settlementFilter === 'pending'}
              onPress={() => setSettlementFilter('pending')}
            />
            <FilterChip
              label={isOwner ? 'Teslim Alınan' : 'Teslim Ettiğim'}
              active={settlementFilter === 'done'}
              onPress={() => setSettlementFilter('done')}
            />
          </ThemedView>
          <ThemedView type="backgroundElement" style={styles.summaryBox}>
            <ThemedText type="small" themeColor="textSecondary">
              {isOwner ? 'Teslim alınmayan' : 'Teslim etmediğim'}: {settlementTotals.pendingCount} karpin ·{' '}
              {settlementTotals.pendingTotal.toFixed(2)} ₺
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {isOwner ? 'Teslim alınan' : 'Teslim ettiğim'}: {settlementTotals.doneCount} karpin ·{' '}
              {settlementTotals.doneTotal.toFixed(2)} ₺
            </ThemedText>
          </ThemedView>
        </>
      )}

      {!showFilters && settlementTotals.pendingCount > 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          {isOwner ? 'Teslim alınmayan' : 'Teslim etmediğim'}: {settlementTotals.pendingCount} karpin
        </ThemedText>
      )}

      {visibleShifts.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Bu filtrelere uyan kapanmış vardiya yok.
        </ThemedText>
      ) : (
        visibleShifts.map((s) => {
          const state = getSettlementState(s);
          const canAct = isOwner ? state !== 'confirmed' : state === 'pending';
          const numLabel = s.shift_no != null ? `#${s.shift_no} numaralı karpini` : 'bu karpini';
          return (
            <ShiftHistoryCard
              key={s.id}
              shift={s}
              driverName={driverNames[s.driver_id]}
              vehicle={vehicle}
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
        })
      )}
    </ThemedView>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.filterChip, active && styles.filterChipActive]} onPress={onPress}>
      <ThemedText style={active ? styles.filterChipTextActive : undefined} type="small">
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two, backgroundColor: 'transparent' },
  filterChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  filterChip: {
    borderWidth: 1,
    borderColor: '#94A3B8',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  filterChipActive: { backgroundColor: Brand.primary, borderColor: Brand.primary, borderWidth: 0 },
  filterChipTextActive: { color: Brand.onPrimary, fontFamily: FontFamily.bodyBold },
  summaryBox: { padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.half },
  batchButton: {
    backgroundColor: Brand.primary,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  batchButtonText: { color: Brand.onPrimary, fontFamily: FontFamily.bodyBold, fontSize: 16 },
  buttonPressed: { opacity: 0.7 },
  compareButton: { marginTop: Spacing.two, alignSelf: 'flex-start' },
  card: { padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.half },
  cardPending: { borderWidth: 1.5, borderColor: '#F59E0B', backgroundColor: '#F59E0B14' },
  cardAwaiting: { borderWidth: 2, borderColor: '#2563EB', backgroundColor: '#2563EB1F' },
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
    backgroundColor: 'transparent',
    paddingVertical: Spacing.half,
  },
  detailLabel: { flexShrink: 1 },
  detailValue: { flexShrink: 0, textAlign: 'right' },
  detailValueGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    backgroundColor: 'transparent',
  },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, marginTop: Spacing.half },
  // ThemedView tipsiz kullanilinca varsayilan olarak opak "background"
  // (beyaz) rengini basinca kartin krem rengiyle uyusmuyordu - bu satirlarla
  // iceride kalan kutular tamamen seffaf kalip kartin rengini gosteriyor.
  transparentBg: { backgroundColor: 'transparent' },
  note: {},
});
