import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import { Alert, Platform, Share } from 'react-native';
import * as XLSX from 'xlsx';

import { EXPENSE_CATEGORIES } from '@/lib/expense-categories';
import type { Shift } from '@/lib/shifts';
import type { Vehicle } from '@/lib/vehicles';

/**
 * Araç detay sayfasında (tarih filtresi uygulandıktan sonra) listelenen
 * karpinleri Excel (.xlsx) veya PDF olarak telefona kaydedilebilir hale
 * getirir.
 *
 * Excel: xlsx (SheetJS) - saf JS, native build gerektirmez.
 * PDF: ÖNCE pdf-lib (saf JS) ile deneniyordu, ama cihazda test edildiğinde
 * harflerin (özellikle rakamların) rastgele kaybolduğu görüldü - hem özel
 * font gömülü hem de pdf-lib'in standart fontuyla aynı sorun çıktı, yani
 * sorun pdf-lib'in kendisindeydi (Hermes/RN ile uyumsuzluk). Bu yüzden PDF
 * artık expo-print ile, normal bir HTML tablosu Apple'ın kendi WebKit PDF
 * motoruyla PDF'e çevrilerek üretiliyor - font/karakter sorunu olmuyor,
 * Türkçe karakterler sorunsuz basılıyor. Bunun bedeli: expo-print yeni bir
 * native modül olduğu için YENİ BİR NATIVE BUILD (eas build) gerektiriyor,
 * sade bir eas update yetmiyor.
 *
 * Paylaşım için expo-sharing EKLENMEDİ (o da ayrıca native build ister).
 * Bunun yerine, zaten uygulamada kullanılan react-native'in çekirdek
 * Share API'si ile iOS'un sistem paylaşım sayfası (UIActivityViewController)
 * açılıyor - oradan "Dosyalara Kaydet", AirDrop, Mail vs. seçilebiliyor.
 */

type ExportRow = {
  shiftNo: number | null;
  driverName: string;
  openedAt: string;
  closedAt: string | null;
  durationMinutes: number | null;
  system: 'percentage' | 'km_based';
  openingKm: number | null;
  closingKm: number | null;
  totalKm: number | null;
  revenue: number | null;
  card: number | null;
  fuel: number | null;
  expenseAmount: number | null;
  expenseNote: string | null;
  /** Kategori bazında masraf dökümü (oto yıkama, durak aidatı, komisyon...). */
  expenseByCategory: Record<string, number>;
  /** Kategori bazında açıklamalar (Diğer notu, komisyonda uygulama adları). */
  expenseNotesByCategory: Record<string, string>;
  driverShare: number | null;
  ownerNet: number | null;
  cash: number | null;
  kmDebt: number | null;
  notes: string | null;
};

/** Excel'de ayrı sütun olarak gösterilen masraf kategorileri. */
const EXPENSE_COLUMNS = EXPENSE_CATEGORIES.map((c) => ({ key: c.key, label: c.label }));

function buildExpenseBreakdown(s: Shift): { amounts: Record<string, number>; notes: Record<string, string> } {
  const amounts: Record<string, number> = {};
  const notes: Record<string, string> = {};
  if (s.payment_model !== 'percentage') return { amounts, notes };
  const items = s.expense_items ?? [];
  if (items.length === 0 && (Number(s.other_expenses) || 0) > 0) {
    // Eski kayıtlar: döküm yok, toplam masraf "Diğer"e yazılır.
    amounts.diger = Number(s.other_expenses);
    if (s.other_expenses_note) notes.diger = s.other_expenses_note;
    return { amounts, notes };
  }
  items.forEach((item) => {
    const amount = Number(item.amount) || 0;
    amounts[item.category] = (amounts[item.category] ?? 0) + amount;
    if (item.note) {
      const piece = item.category === 'uygulama_komisyonu' ? `${item.note} ${amount.toFixed(2)}` : item.note;
      notes[item.category] = notes[item.category] ? `${notes[item.category]}, ${piece}` : piece;
    }
  });
  return { amounts, notes };
}

const HEADERS = [
  'Vardiya No',
  'Şoför',
  'Açılış Tarihi',
  'Kapanış Tarihi',
  'Süre (dk)',
  'Sistem',
  'Açılış Km',
  'Kapanış Km',
  'Toplam Km',
  'Hasılat (₺)',
  'Kredi Kartı (₺)',
  'Motorin (₺)',
  ...EXPENSE_CATEGORIES.map((c) => `${c.label} (₺)`),
  'Toplam Masraf (₺)',
  'Masraf Açıklaması',
  'Şoför Payı (₺)',
  'Net Kalan (₺)',
  'Nakit (₺)',
  'Km Borcu (₺)',
  'Not',
];

function formatDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('tr-TR')} ${d.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function getDurationMinutes(openedAt: string, closedAt: string | null): number | null {
  if (!closedAt) return null;
  const diff = new Date(closedAt).getTime() - new Date(openedAt).getTime();
  return diff >= 0 ? Math.round(diff / 60000) : null;
}

function buildExportRows(shifts: Shift[], driverNames: Record<string, string>): ExportRow[] {
  return shifts.map((s) => ({
    shiftNo: s.shift_no,
    driverName: driverNames[s.driver_id] ?? 'İsimsiz',
    openedAt: s.opened_at,
    closedAt: s.closed_at,
    durationMinutes: getDurationMinutes(s.opened_at, s.closed_at),
    system: s.payment_model,
    openingKm: s.opening_km,
    closingKm: s.closing_km,
    totalKm: s.km_total,
    revenue: s.payment_model === 'percentage' ? s.total_amount : null,
    card: s.payment_model === 'percentage' ? s.card_amount : null,
    fuel: s.payment_model === 'percentage' ? s.fuel_cost : null,
    expenseAmount: s.payment_model === 'percentage' ? s.other_expenses : null,
    expenseNote: s.payment_model === 'percentage' ? s.other_expenses_note : null,
    ...(() => {
      const b = buildExpenseBreakdown(s);
      return { expenseByCategory: b.amounts, expenseNotesByCategory: b.notes };
    })(),
    driverShare: s.payment_model === 'percentage' ? s.driver_share : null,
    ownerNet: s.payment_model === 'percentage' ? s.owner_total : null,
    cash: s.payment_model === 'percentage' ? s.net_cash : null,
    kmDebt: s.payment_model === 'km_based' ? s.km_debt : null,
    notes: s.notes,
  }));
}

function sumBy(rows: ExportRow[], key: keyof ExportRow): number {
  return rows.reduce((total, r) => total + (Number(r[key]) || 0), 0);
}

function computeTotals(rows: ExportRow[]) {
  const byCategory: Record<string, number> = {};
  rows.forEach((r) => {
    Object.entries(r.expenseByCategory).forEach(([k, v]) => {
      byCategory[k] = (byCategory[k] ?? 0) + v;
    });
  });
  return {
    byCategory,
    revenue: sumBy(rows, 'revenue'),
    card: sumBy(rows, 'card'),
    fuel: sumBy(rows, 'fuel'),
    expenseAmount: sumBy(rows, 'expenseAmount'),
    driverShare: sumBy(rows, 'driverShare'),
    ownerNet: sumBy(rows, 'ownerNet'),
    cash: sumBy(rows, 'cash'),
    kmDebt: sumBy(rows, 'kmDebt'),
  };
}

function expenseDisplay(row: ExportRow): string {
  if (row.expenseAmount == null) return '';
  return row.expenseNote ? `${row.expenseAmount.toFixed(2)} (${row.expenseNote})` : row.expenseAmount.toFixed(2);
}

/** Masraf açıklamaları tek metin: "Diğer: lastik tamiri · Komisyon: Uber 50.00, Yandex Go 30.00" */
function expenseNotesText(row: ExportRow): string {
  return EXPENSE_COLUMNS.filter((c) => row.expenseNotesByCategory[c.key])
    .map((c) => `${c.key === 'uygulama_komisyonu' ? 'Komisyon' : c.label}: ${row.expenseNotesByCategory[c.key]}`)
    .join(' · ');
}

/** PDF için tek hücrede masraf dökümü: "Oto Yıkama 50.00 · HGS / Otoyol 20.00 ..." */
function expenseBreakdownText(row: ExportRow): string {
  const parts = EXPENSE_COLUMNS.filter((c) => (row.expenseByCategory[c.key] ?? 0) > 0).map((c) => {
    const note = row.expenseNotesByCategory[c.key];
    return `${c.label} ${row.expenseByCategory[c.key].toFixed(2)}${note ? ` (${note})` : ''}`;
  });
  return parts.length > 0 ? parts.join(' · ') : '-';
}

/** Dosya adında sorun çıkarabilecek karakterleri (/, :, boşluk vs.) temizler. */
function safeFileNamePart(s: string): string {
  return s
    .trim()
    .replace(/[^0-9A-Za-zığüşöçİĞÜŞÖÇ_-]+/g, '_')
    .replace(/_+/g, '_');
}

async function shareFile(file: File) {
  try {
    if (Platform.OS === 'ios') {
      await Share.share({ url: file.uri, title: file.name });
    } else {
      // Android'de Share.share url ile yerel dosya paylaşamıyor; en azından
      // dosyanın nerede durduğunu bildirelim (ileride expo-sharing ile
      // düzgün bir "paylaş" akışı eklenebilir - not alındı).
      await Share.share({ message: `Dosya kaydedildi: ${file.uri}` });
    }
  } catch (e: any) {
    if (e?.message !== 'User did not share') {
      Alert.alert('Paylaşılamadı', e?.message ?? 'Bilinmeyen hata oluştu.');
    }
  }
}

// ---------------------------------------------------------------------------
// Excel (.xlsx)
// ---------------------------------------------------------------------------

export async function exportShiftsToExcel(
  vehicle: Vehicle,
  shifts: Shift[],
  driverNames: Record<string, string>,
  rangeLabel: string
): Promise<void> {
  if (shifts.length === 0) {
    Alert.alert('Karpin yok', 'Bu filtreye uyan kapanmış karpin bulunamadı.');
    return;
  }
  const rows = buildExportRows(shifts, driverNames);
  const totals = computeTotals(rows);

  const aoa: (string | number)[][] = [
    [`${vehicle.plate_no} - ${rangeLabel}`],
    [`Oluşturulma: ${formatDateTimeLocal(new Date().toISOString())}`],
    [],
    [...HEADERS],
    ...rows.map((r) => [
      r.shiftNo ?? '',
      r.driverName,
      formatDateTimeLocal(r.openedAt),
      r.closedAt ? formatDateTimeLocal(r.closedAt) : '',
      r.durationMinutes ?? '',
      r.system === 'percentage' ? 'Yüzdelik' : 'Km',
      r.openingKm ?? '',
      r.closingKm ?? '',
      r.totalKm ?? '',
      r.revenue ?? '',
      r.card ?? '',
      r.fuel ?? '',
      ...EXPENSE_COLUMNS.map((c) => (r.system === 'percentage' ? r.expenseByCategory[c.key] ?? 0 : '')),
      r.expenseAmount ?? '',
      expenseNotesText(r),
      r.driverShare ?? '',
      r.ownerNet ?? '',
      r.cash ?? '',
      r.kmDebt ?? '',
      r.notes ?? '',
    ]),
    [
      'TOPLAM',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      totals.revenue,
      totals.card,
      totals.fuel,
      ...EXPENSE_COLUMNS.map((c) => totals.byCategory[c.key] ?? 0),
      totals.expenseAmount,
      '',
      totals.driverShare,
      totals.ownerNet,
      totals.cash,
      totals.kmDebt,
      '',
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = HEADERS.map((h) => ({ wch: Math.max(10, h.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Karpinler');
  const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) as string;

  const fileName = `${safeFileNamePart(vehicle.plate_no)}_${safeFileNamePart(rangeLabel)}.xlsx`;
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(base64, { encoding: 'base64' });

  await shareFile(file);
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

// expo-print HTML'i WebKit'in kendi PDF motoruyla render ettiği için
// Türkçe karakterler normal UTF-8 metin olarak basılıyor - pdf-lib'de
// olduğu gibi aksansız karaktere düşürmeye (ASCII fold) artık gerek yok.

type PdfColumn = { header: string; weight: number; align: 'left' | 'right' };

const PDF_COLUMNS: PdfColumn[] = [
  { header: 'No', weight: 1, align: 'left' },
  { header: 'Şoför', weight: 3, align: 'left' },
  { header: 'Açılış', weight: 3, align: 'left' },
  { header: 'Kapanış', weight: 3, align: 'left' },
  { header: 'Süre', weight: 1.3, align: 'right' },
  { header: 'Sistem', weight: 1.6, align: 'left' },
  { header: 'AçKm', weight: 1.6, align: 'right' },
  { header: 'KapKm', weight: 1.6, align: 'right' },
  { header: 'TopKm', weight: 1.6, align: 'right' },
  { header: 'Hasılat', weight: 2, align: 'right' },
  { header: 'K.Kartı', weight: 1.8, align: 'right' },
  { header: 'Motorin', weight: 1.8, align: 'right' },
  { header: 'Masraf Dökümü', weight: 5, align: 'left' },
  { header: 'Ş.Payı', weight: 2, align: 'right' },
  { header: 'Net Kalan', weight: 2.2, align: 'right' },
  { header: 'Nakit', weight: 2, align: 'right' },
  { header: 'KmBorcu', weight: 1.8, align: 'right' },
  { header: 'Not', weight: 3.2, align: 'left' },
];

function money(n: number | null): string {
  return n == null ? '-' : n.toFixed(2);
}

function pdfRowValues(r: ExportRow): string[] {
  return [
    r.shiftNo != null ? String(r.shiftNo) : '-',
    r.driverName,
    formatDateTimeLocal(r.openedAt),
    r.closedAt ? formatDateTimeLocal(r.closedAt) : '-',
    r.durationMinutes != null ? String(r.durationMinutes) : '-',
    r.system === 'percentage' ? 'Yüzdelik' : 'Km',
    r.openingKm != null ? String(r.openingKm) : '-',
    r.closingKm != null ? String(r.closingKm) : '-',
    r.totalKm != null ? String(r.totalKm) : '-',
    money(r.revenue),
    money(r.card),
    money(r.fuel),
    r.expenseAmount != null ? `${r.expenseAmount.toFixed(2)} — ${expenseBreakdownText(r)}` : '-',
    money(r.driverShare),
    money(r.ownerNet),
    money(r.cash),
    money(r.kmDebt),
    r.notes ?? '-',
  ];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function categorySummaryHtml(totals: ReturnType<typeof computeTotals>): string {
  const rows = EXPENSE_COLUMNS.filter((c) => (totals.byCategory[c.key] ?? 0) > 0)
    .map((c) => `<tr><td>${escapeHtml(c.label)}</td><td style="text-align:right">${money(totals.byCategory[c.key])} ₺</td></tr>`)
    .join('');
  if (!rows) return '';
  return `<h2>Masraf Dökümü (Toplam)</h2>
  <table class="summary">${rows}<tr class="sum"><td>Toplam Masraf</td><td style="text-align:right">${money(totals.expenseAmount)} ₺</td></tr></table>`;
}

function buildPdfHtml(
  vehicle: Vehicle,
  rangeLabel: string,
  rows: ExportRow[],
  totals: ReturnType<typeof computeTotals>
): string {
  const totalWeight = PDF_COLUMNS.reduce((sum, c) => sum + c.weight, 0);
  const colgroup = PDF_COLUMNS.map(
    (c) => `<col style="width:${((c.weight / totalWeight) * 100).toFixed(2)}%">`
  ).join('');
  const theadCells = PDF_COLUMNS.map(
    (c) => `<th style="text-align:${c.align}">${escapeHtml(c.header)}</th>`
  ).join('');

  const bodyRows = rows
    .map((r) => {
      const cells = pdfRowValues(r)
        .map((v, i) => `<td style="text-align:${PDF_COLUMNS[i].align}">${escapeHtml(v)}</td>`)
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  const totalsValues = [
    'TOPLAM', '', '', '', '', '', '', '', '',
    money(totals.revenue), money(totals.card), money(totals.fuel), money(totals.expenseAmount),
    money(totals.driverShare), money(totals.ownerNet), money(totals.cash), money(totals.kmDebt), '',
  ];
  const totalsCells = totalsValues
    .map((v, i) => `<td style="text-align:${PDF_COLUMNS[i].align}">${escapeHtml(v)}</td>`)
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4 landscape; margin: 10mm 8mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1a1a1a; margin: 0; }
  h1 { font-size: 15px; margin: 0 0 2px 0; }
  .meta { font-size: 9px; color: #666; margin: 0 0 8px 0; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th, td { font-size: 7.5px; padding: 3px 3px; border-bottom: 0.5px solid #ddd; word-break: break-word; white-space: normal; }
  th { background: #FFC400; color: #1a1a1a; font-weight: 700; border-bottom: none; }
  tfoot td { font-weight: 700; border-top: 1px solid #1a1a1a; border-bottom: none; }
  h2 { font-size: 11px; margin: 14px 0 4px 0; }
  table.summary { width: 260px; table-layout: auto; }
  table.summary td { font-size: 9px; }
  table.summary tr.sum td { font-weight: 700; border-top: 1px solid #1a1a1a; }
</style>
</head>
<body>
  <h1>${escapeHtml(`${vehicle.plate_no} - ${rangeLabel}`)}</h1>
  <p class="meta">${escapeHtml(
    `Oluşturulma: ${formatDateTimeLocal(new Date().toISOString())} · ${rows.length} karpin`
  )}</p>
  <table>
    <colgroup>${colgroup}</colgroup>
    <thead><tr>${theadCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
    <tfoot><tr>${totalsCells}</tr></tfoot>
  </table>
  ${categorySummaryHtml(totals)}
</body>
</html>`;
}

export async function exportShiftsToPdf(
  vehicle: Vehicle,
  shifts: Shift[],
  driverNames: Record<string, string>,
  rangeLabel: string
): Promise<void> {
  if (shifts.length === 0) {
    Alert.alert('Karpin yok', 'Bu filtreye uyan kapanmış karpin bulunamadı.');
    return;
  }

  const rows = buildExportRows(shifts, driverNames);
  const totals = computeTotals(rows);
  const html = buildPdfHtml(vehicle, rangeLabel, rows, totals);

  // expo-print, HTML'i WebKit üzerinden PDF'e çevirip rastgele isimli bir
  // geçici dosya döndürür (cache dizininde). Düzgün bir dosya adı
  // (plaka_tarihAralığı.pdf) vermek için bu dosyanın baytlarını okuyup
  // kendi isimlendirdiğimiz dosyaya yazıyoruz, sonra geçici dosyayı siliyoruz.
  const { uri } = await Print.printToFileAsync({ html, base64: false });

  const fileName = `${safeFileNamePart(vehicle.plate_no)}_${safeFileNamePart(rangeLabel)}.pdf`;
  const tempFile = new File(uri);
  const bytes = await tempFile.bytes();
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);
  try {
    tempFile.delete();
  } catch {
    // Geçici dosya silinemese de sorun değil, sistem cache'i periyodik temizler.
  }

  await shareFile(file);
}
