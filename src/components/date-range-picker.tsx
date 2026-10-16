import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';

const WEEKDAY_LABELS = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'];
const MONTH_LABELS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

export type DateRange = { from: Date; to: Date };

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function buildMonthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const firstWeekday = (first.getDay() + 6) % 7; // Pazartesi = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/**
 * Araç sahibinin dilediği tarihi veya tarih aralığını kendi seçebildiği
 * basit bir takvim. Native bir kütüphaneye bağlı değil (sadece View/Pressable),
 * bu yuzden JS guncellemesiyle (eas update) anında yayınlanabilir.
 * Tek gun secmek icin: bir gune dokun, "Uygula"ya bas (ikinci gune dokunmana
 * gerek yok). Aralik secmek icin: baslangic gunune, sonra bitis gunune dokun.
 */
export function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRange | null;
  onChange: (range: DateRange | null) => void;
}) {
  const today = startOfDay(new Date());
  const [viewDate, setViewDate] = useState(() => value?.from ?? today);
  const [draftStart, setDraftStart] = useState<Date | null>(value?.from ?? null);
  const [draftEnd, setDraftEnd] = useState<Date | null>(value?.to ?? null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const cells = buildMonthGrid(year, month);

  function handleDayPress(day: Date) {
    const d = startOfDay(day);
    if (!draftStart || (draftStart && draftEnd)) {
      setDraftStart(d);
      setDraftEnd(null);
      return;
    }
    if (d.getTime() < draftStart.getTime()) {
      setDraftEnd(draftStart);
      setDraftStart(d);
    } else {
      setDraftEnd(d);
    }
  }

  function isInRange(day: Date): boolean {
    if (!draftStart) return false;
    const end = draftEnd ?? draftStart;
    return day.getTime() >= draftStart.getTime() && day.getTime() <= end.getTime();
  }

  function handleApply() {
    if (!draftStart) return;
    onChange({ from: draftStart, to: draftEnd ?? draftStart });
  }

  function handleClear() {
    setDraftStart(null);
    setDraftEnd(null);
    onChange(null);
  }

  return (
    <ThemedView type="backgroundElement" style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.navButton} onPress={() => setViewDate(new Date(year, month - 1, 1))}>
          <ThemedText type="smallBold">‹</ThemedText>
        </Pressable>
        <ThemedText type="smallBold">
          {MONTH_LABELS[month]} {year}
        </ThemedText>
        <Pressable style={styles.navButton} onPress={() => setViewDate(new Date(year, month + 1, 1))}>
          <ThemedText type="smallBold">›</ThemedText>
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAY_LABELS.map((w) => (
          <ThemedText key={w} type="small" themeColor="textSecondary" style={styles.weekLabel}>
            {w}
          </ThemedText>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((day, i) => {
          if (!day) return <View key={i} style={styles.cell} />;
          const isStart = !!draftStart && sameDay(day, draftStart);
          const isEnd = draftEnd ? sameDay(day, draftEnd) : isStart;
          const inRange = isInRange(day);
          const isToday = sameDay(day, today);
          return (
            <Pressable key={i} style={styles.cell} onPress={() => handleDayPress(day)}>
              <View style={[styles.dayCircle, inRange && styles.dayInRange, (isStart || isEnd) && styles.daySelected]}>
                <ThemedText
                  type="small"
                  style={[(isStart || isEnd) && styles.daySelectedText, isToday && !isStart && !isEnd && styles.dayTodayText]}>
                  {day.getDate()}
                </ThemedText>
              </View>
            </Pressable>
          );
        })}
      </View>

      <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
        {draftStart && draftEnd
          ? `${draftStart.toLocaleDateString('tr-TR')} - ${draftEnd.toLocaleDateString('tr-TR')}`
          : draftStart
            ? `${draftStart.toLocaleDateString('tr-TR')} seçildi · tek gün için doğrudan Uygula'ya basabilirsin`
            : 'Başlangıç günü seç'}
      </ThemedText>

      <View style={styles.actions}>
        <Pressable style={styles.clearButton} onPress={handleClear}>
          <ThemedText type="small" themeColor="textSecondary">
            Temizle
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.applyButton, !draftStart && styles.applyButtonDisabled]}
          onPress={handleApply}
          disabled={!draftStart}>
          <ThemedText style={styles.applyButtonText}>Uygula</ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const CELL_SIZE = 38;

const styles = StyleSheet.create({
  container: { padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.two },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  navButton: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
  weekRow: { flexDirection: 'row' },
  weekLabel: { width: CELL_SIZE, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: CELL_SIZE, height: CELL_SIZE, alignItems: 'center', justifyContent: 'center' },
  dayCircle: {
    width: CELL_SIZE - 6,
    height: CELL_SIZE - 6,
    borderRadius: (CELL_SIZE - 6) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayInRange: { backgroundColor: '#FFC40033' },
  daySelected: { backgroundColor: Brand.primary },
  daySelectedText: { color: Brand.onPrimary, fontWeight: '700' },
  dayTodayText: { color: Brand.primaryPressed, fontWeight: '700' },
  hint: { textAlign: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  clearButton: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.two },
  applyButton: {
    backgroundColor: Brand.primary,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  applyButtonDisabled: { opacity: 0.4 },
  applyButtonText: { color: Brand.onPrimary, fontWeight: '700' },
});
