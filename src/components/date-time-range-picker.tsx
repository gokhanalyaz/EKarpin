import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, FontFamily, Spacing } from '@/constants/theme';

const WEEKDAY_LABELS = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'];
const MONTH_LABELS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

export type DateTimeRange = { from: Date; to: Date };

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

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function wrap(value: number, mod: number): number {
  return ((value % mod) + mod) % mod;
}

const QUICK_TIMES: { hour: number; minute: number; label: string }[] = [
  { hour: 0, minute: 0, label: '00:00' },
  { hour: 6, minute: 0, label: '06:00' },
  { hour: 8, minute: 0, label: '08:00' },
  { hour: 12, minute: 0, label: '12:00' },
  { hour: 18, minute: 0, label: '18:00' },
  { hour: 23, minute: 59, label: '23:59' },
];

function TimeStepper({
  label,
  hour,
  minute,
  onChangeHour,
  onChangeMinute,
}: {
  label: string;
  hour: number;
  minute: number;
  onChangeHour: (h: number) => void;
  onChangeMinute: (m: number) => void;
}) {
  return (
    <View style={styles.timeSectionGroup}>
      <View style={styles.timeRow}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.timeLabel}>
          {label}
        </ThemedText>
        <View style={styles.timeControls}>
          <Pressable style={styles.timeStepButton} onPress={() => onChangeHour(wrap(hour - 1, 24))} hitSlop={6}>
            <ThemedText type="smallBold">−</ThemedText>
          </Pressable>
          <ThemedText type="smallBold" style={styles.timeValue}>
            {pad2(hour)}
          </ThemedText>
          <Pressable style={styles.timeStepButton} onPress={() => onChangeHour(wrap(hour + 1, 24))} hitSlop={6}>
            <ThemedText type="smallBold">+</ThemedText>
          </Pressable>
          <ThemedText type="smallBold" style={styles.timeColon}>
            :
          </ThemedText>
          <Pressable style={styles.timeStepButton} onPress={() => onChangeMinute(wrap(minute - 5, 60))} hitSlop={6}>
            <ThemedText type="smallBold">−</ThemedText>
          </Pressable>
          <ThemedText type="smallBold" style={styles.timeValue}>
            {pad2(minute)}
          </ThemedText>
          <Pressable style={styles.timeStepButton} onPress={() => onChangeMinute(wrap(minute + 5, 60))} hitSlop={6}>
            <ThemedText type="smallBold">+</ThemedText>
          </Pressable>
        </View>
      </View>
      <View style={styles.quickTimeRow}>
        {QUICK_TIMES.map((qt) => {
          const active = hour === qt.hour && minute === qt.minute;
          return (
            <Pressable
              key={qt.label}
              style={[styles.quickTimeChip, active && styles.quickTimeChipActive]}
              onPress={() => {
                onChangeHour(qt.hour);
                onChangeMinute(qt.minute);
              }}>
              <ThemedText type="small" style={active ? styles.quickTimeChipTextActive : undefined}>
                {qt.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Tarih ARALIĞI + saat seçebilen basit bir takvim. Native bir kütüphaneye
 * bağlı değil (sadece View/Pressable), bu yüzden JS güncellemesiyle
 * (eas update) anında yayınlanabilir - date-range-picker.tsx'in saat
 * seçimi de olan hali.
 * Tek gün+saat aralığı için: bir güne dokun, saatleri ayarla, Uygula'ya bas.
 * Gün aralığı için: başlangıç gününe, sonra bitiş gününe dokun, sonra
 * her ikisinin saatini ayarla.
 */
export function DateTimeRangePicker({
  value,
  onChange,
}: {
  value: DateTimeRange | null;
  onChange: (range: DateTimeRange | null) => void;
}) {
  const today = startOfDay(new Date());
  const [viewDate, setViewDate] = useState(() => value?.from ?? today);
  const [draftStart, setDraftStart] = useState<Date | null>(value ? startOfDay(value.from) : null);
  const [draftEnd, setDraftEnd] = useState<Date | null>(value ? startOfDay(value.to) : null);
  const [startHour, setStartHour] = useState(value ? value.from.getHours() : 0);
  const [startMinute, setStartMinute] = useState(value ? value.from.getMinutes() : 0);
  const [endHour, setEndHour] = useState(value ? value.to.getHours() : 23);
  const [endMinute, setEndMinute] = useState(value ? value.to.getMinutes() : 59);

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
    const from = new Date(draftStart);
    from.setHours(startHour, startMinute, 0, 0);
    const to = new Date(draftEnd ?? draftStart);
    to.setHours(endHour, endMinute, 59, 999);
    onChange({ from, to });
  }

  function handleClear() {
    setDraftStart(null);
    setDraftEnd(null);
    setStartHour(0);
    setStartMinute(0);
    setEndHour(23);
    setEndMinute(59);
    onChange(null);
  }

  return (
    <ThemedView type="backgroundElement" style={styles.container}>
      <View style={[styles.header, styles.transparentBg]}>
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

      <View style={[styles.weekRow, styles.transparentBg]}>
        {WEEKDAY_LABELS.map((w) => (
          <ThemedText key={w} type="small" themeColor="textSecondary" style={styles.weekLabel}>
            {w}
          </ThemedText>
        ))}
      </View>

      <View style={[styles.grid, styles.transparentBg]}>
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
            ? `${draftStart.toLocaleDateString('tr-TR')} seçildi · aralık için bir gün daha seçebilirsin`
            : 'Başlangıç günü seç'}
      </ThemedText>

      {draftStart && (
        <View style={[styles.timeSection, styles.transparentBg]}>
          <TimeStepper
            label="Başlangıç Saati"
            hour={startHour}
            minute={startMinute}
            onChangeHour={setStartHour}
            onChangeMinute={setStartMinute}
          />
          <TimeStepper
            label="Bitiş Saati"
            hour={endHour}
            minute={endMinute}
            onChangeHour={setEndHour}
            onChangeMinute={setEndMinute}
          />
        </View>
      )}

      <View style={[styles.actions, styles.transparentBg]}>
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
  transparentBg: { backgroundColor: 'transparent' },
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
  daySelectedText: { color: Brand.onPrimary, fontFamily: FontFamily.bodyBold },
  dayTodayText: { color: Brand.primaryPressed, fontFamily: FontFamily.bodyBold },
  hint: { textAlign: 'center' },
  timeSection: { gap: Spacing.three, marginTop: Spacing.one },
  timeSectionGroup: { gap: Spacing.one },
  quickTimeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  quickTimeChip: {
    borderWidth: 1,
    borderColor: '#94A3B8',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  quickTimeChipActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  quickTimeChipTextActive: { color: Brand.onPrimary, fontFamily: FontFamily.bodyBold },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timeLabel: { flexShrink: 1 },
  timeControls: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  timeStepButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeValue: { minWidth: 24, textAlign: 'center' },
  timeColon: { marginHorizontal: -Spacing.half },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  clearButton: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.two },
  applyButton: {
    backgroundColor: Brand.primary,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  applyButtonDisabled: { opacity: 0.4 },
  applyButtonText: { color: Brand.onPrimary, fontFamily: FontFamily.bodyBold },
});
