/**
 * Karpin gecmisi ekranlarinda (Gecmis sekmesi + arac detay sayfasi) ortak
 * kullanilan tarih araligi secenekleri - tek yerden yonetilsin diye.
 */
export type DatePreset = 'today' | 'week' | 'month' | 'all';

export const PRESET_LABELS: Record<DatePreset, string> = {
  today: 'Bugün',
  week: 'Son 7 Gün',
  month: 'Son 30 Gün',
  all: 'Tüm Zamanlar',
};

export function presetToRange(preset: DatePreset): { from?: string; to?: string } {
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
