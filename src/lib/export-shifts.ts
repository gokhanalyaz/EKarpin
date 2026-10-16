import { Asset } from 'expo-asset';
import { File, Paths } from 'expo-file-system';
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import { Alert, Platform, Share } from 'react-native';
import * as XLSX from 'xlsx';
// @ts-ignore: @pdf-lib/fontkit'in tip tanımı olmayabilir (paket sürümüne göre değişiyor).
import fontkit from '@pdf-lib/fontkit';

import { Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';

import type { Shift } from '@/lib/shifts';
import type { Vehicle } from '@/lib/vehicles';

/**
 * Araç detay sayfasında (tarih filtresi uygulandıktan sonra) listelenen
 * karpinleri Excel (.xlsx) veya PDF olarak telefona kaydedilebilir hale
 * getirir. İkisi de saf JS kütüphaneler (xlsx + pdf-lib) kullanıyor, yani
 * yeni bir native build gerektirmiyor - eas update ile yayınlanabilir.
 *
 * Paylaşım için expo-sharing EKLENMEDİ (o yeni bir native build ister).
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
  driverShare: number | null;
  ownerNet: number | null;
  cash: number | null;
  kmDebt: number | null;
  notes: string | null;
};

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
  'Masraf (₺)',
  'Şoför Payı (₺)',
  'Net Kalan (₺)',
  'Nakit (₺)',
  'Km Borcu (₺)',
  'Not',
] as const;

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
  return {
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
      expenseDisplay(r),
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
      totals.expenseAmount,
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

/** İnter TTF'lerini (zaten uygulamada kullanılıyor) PDF'e gömebilmek için byte olarak okur. */
async function loadFontBytes(assetModule: number): Promise<Uint8Array> {
  const asset = Asset.fromModule(assetModule);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  const file = new File(uri);
  return await file.bytes();
}

// Türkçe'ye özgü (WinAnsi/Latin-1'de olmayan) karakterler için - özel font
// gömme herhangi bir nedenle başarısız olursa, çökmek yerine okunaklı bir
// PDF üretebilmek için ASCII karşılığına düşürüyoruz.
const TURKISH_FOLD: Record<string, string> = {
  ş: 's', Ş: 'S', ğ: 'g', Ğ: 'G', ı: 'i', İ: 'I', ö: 'o', Ö: 'O', ü: 'u', Ü: 'U', ç: 'c', Ç: 'C',
};
function foldTurkish(s: string): string {
  return s.replace(/[şŞğĞıİöÖüÜçÇ]/g, (ch) => TURKISH_FOLD[ch] ?? ch);
}

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
  { header: 'Masraf', weight: 2.8, align: 'left' },
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
    r.expenseAmount != null ? expenseDisplay(r) : '-',
    money(r.driverShare),
    money(r.ownerNet),
    money(r.cash),
    money(r.kmDebt),
    r.notes ?? '-',
  ];
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

  const pdfDoc = await PDFDocument.create();

  let regularFont: PDFFont;
  let boldFont: PDFFont;
  let asciiOnly = false;
  try {
    pdfDoc.registerFontkit(fontkit);
    const [regularBytes, boldBytes] = await Promise.all([
      loadFontBytes(Inter_400Regular),
      loadFontBytes(Inter_700Bold),
    ]);
    regularFont = await pdfDoc.embedFont(regularBytes, { subset: true });
    boldFont = await pdfDoc.embedFont(boldBytes, { subset: true });
  } catch (e) {
    console.warn('Özel font (Inter) PDF içine gömülemedi, standart fonta düşülüyor', e);
    asciiOnly = true;
    regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  }

  const t = (s: string) => (asciiOnly ? foldTurkish(s) : s);

  const PAGE_WIDTH = 841.89; // A4 yatay
  const PAGE_HEIGHT = 595.28;
  const MARGIN = 24;
  const usableWidth = PAGE_WIDTH - MARGIN * 2;
  const totalWeight = PDF_COLUMNS.reduce((sum, c) => sum + c.weight, 0);
  const colWidths = PDF_COLUMNS.map((c) => (c.weight / totalWeight) * usableWidth);
  const colX: number[] = [];
  {
    let x = MARGIN;
    for (const w of colWidths) {
      colX.push(x);
      x += w;
    }
  }

  const ROW_HEIGHT = 14;
  const HEADER_FONT_SIZE = 7.5;
  const BODY_FONT_SIZE = 7;
  const TITLE_FONT_SIZE = 12;

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  function drawTitle() {
    page.drawText(t(`${vehicle.plate_no} - ${rangeLabel}`), {
      x: MARGIN,
      y,
      size: TITLE_FONT_SIZE,
      font: boldFont,
    });
    y -= TITLE_FONT_SIZE + 4;
    page.drawText(t(`Oluşturulma: ${formatDateTimeLocal(new Date().toISOString())} · ${shifts.length} karpin`), {
      x: MARGIN,
      y,
      size: 8,
      font: regularFont,
      color: rgb(0.4, 0.4, 0.4),
    });
    y -= 14;
  }

  function truncate(text: string, maxWidth: number, font: PDFFont, size: number): string {
    let str = text;
    while (str.length > 1 && font.widthOfTextAtSize(str, size) > maxWidth - 4) {
      str = str.slice(0, -1);
    }
    if (str !== text && str.length > 1) str = `${str.slice(0, -1)}…`;
    return str;
  }

  function drawHeaderRow() {
    page.drawRectangle({
      x: MARGIN,
      y: y - ROW_HEIGHT + 3,
      width: usableWidth,
      height: ROW_HEIGHT,
      color: rgb(1, 0.77, 0),
    });
    PDF_COLUMNS.forEach((col, i) => {
      const text = truncate(t(col.header), colWidths[i], boldFont, HEADER_FONT_SIZE);
      const textWidth = boldFont.widthOfTextAtSize(text, HEADER_FONT_SIZE);
      const x = col.align === 'right' ? colX[i] + colWidths[i] - textWidth - 3 : colX[i] + 3;
      page.drawText(text, { x, y, size: HEADER_FONT_SIZE, font: boldFont, color: rgb(0.09, 0.09, 0.09) });
    });
    y -= ROW_HEIGHT;
  }

  function ensureSpace() {
    if (y < MARGIN + ROW_HEIGHT) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
      drawHeaderRow();
    }
  }

  function drawDataRow(values: string[], opts?: { bold?: boolean }) {
    ensureSpace();
    const font = opts?.bold ? boldFont : regularFont;
    values.forEach((raw, i) => {
      const col = PDF_COLUMNS[i];
      const text = truncate(t(raw), colWidths[i], font, BODY_FONT_SIZE);
      const textWidth = font.widthOfTextAtSize(text, BODY_FONT_SIZE);
      const x = col.align === 'right' ? colX[i] + colWidths[i] - textWidth - 3 : colX[i] + 3;
      page.drawText(text, { x, y, size: BODY_FONT_SIZE, font, color: rgb(0.1, 0.1, 0.1) });
    });
    page.drawLine({
      start: { x: MARGIN, y: y - 3 },
      end: { x: MARGIN + usableWidth, y: y - 3 },
      thickness: 0.4,
      color: rgb(0.85, 0.85, 0.85),
    });
    y -= ROW_HEIGHT;
  }

  drawTitle();
  drawHeaderRow();
  rows.forEach((r) => drawDataRow(pdfRowValues(r)));

  const totalsValues = [
    'TOPLAM', '', '', '', '', '', '', '', '',
    money(totals.revenue), money(totals.card), money(totals.fuel), money(totals.expenseAmount),
    money(totals.driverShare), money(totals.ownerNet), money(totals.cash), money(totals.kmDebt), '',
  ];
  ensureSpace();
  drawDataRow(totalsValues, { bold: true });

  const bytes = await pdfDoc.save();
  const fileName = `${safeFileNamePart(vehicle.plate_no)}_${safeFileNamePart(rangeLabel)}.pdf`;
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);

  await shareFile(file);
}
