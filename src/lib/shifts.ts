import { File } from 'expo-file-system';
import { supabase } from '@/lib/supabase';
import type { PaymentModel, Vehicle } from '@/lib/vehicles';

export type ShiftStatus = 'open' | 'closed';

export type Shift = {
  id: string;
  vehicle_id: string;
  driver_id: string;
  payment_model: PaymentModel;
  status: ShiftStatus;
  opened_at: string;
  closed_at: string | null;

  opening_km: number | null;
  opening_km_photo_url: string | null;
  opening_km_confirmed: boolean;

  closing_km: number | null;
  closing_km_photo_url: string | null;

  total_amount: number | null;
  fuel_cost: number | null;
  fuel_receipt_url: string | null;
  other_expenses: number | null;
  other_expenses_note: string | null;
  driver_share: number | null;
  card_amount: number | null;

  net_cash: number | null;
  owner_total: number | null;

  km_total: number | null;
  km_debt: number | null;

  handed_to_driver_id: string | null;
  notes: string | null;
  notes_photo_url: string | null;
  photo_debug: string | null;
  created_at: string;
};

/** Yerel bir fotoğraf dosyasını (uri) shift-photos bucket'ına yükler, storage path'i döner. */
export async function uploadShiftPhoto(
  shiftId: string,
  uri: string,
  kind: 'opening' | 'closing' | 'fuel-receipt' | 'notes' | 'alert',
  suffix?: string
): Promise<string> {
  const path = suffix ? `${shiftId}/${kind}-${suffix}.jpg` : `${shiftId}/${kind}.jpg`;

  const file = new File(uri);
  if (!file.exists) {
    throw new Error(`Fotoğraf dosyası bulunamadı (uri: ${uri})`);
  }
  const arrayBuffer = await file.arrayBuffer();
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    throw new Error('Fotoğraf dosyası boş okundu (0 byte).');
  }

  const { error } = await supabase.storage
    .from('shift-photos')
    .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: true });

  if (error) throw new Error(`Supabase yükleme hatası: ${error.message}`);
  return path;
}

/** Private bucket'taki bir fotoğrafı gösterebilmek için geçici (imzalı) link üretir. */
export async function getSignedPhotoUrl(path: string, expiresInSeconds = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('shift-photos')
    .createSignedUrl(path, expiresInSeconds);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/** Bu şoförün bu araçta şu an açık bir vardiyası var mı. */
export async function getOpenShiftForDriver(vehicleId: string, driverId: string): Promise<Shift | null> {
  const { data, error } = await supabase
    .from('shifts')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .eq('driver_id', driverId)
    .eq('status', 'open')
    .maybeSingle();
  if (error) throw error;
  return data as Shift | null;
}

/** Araçta (kim açmış olursa olsun) şu an açık bir vardiya var mı — araç sahibi görünümü için. */
export async function getAnyOpenShift(vehicleId: string): Promise<Shift | null> {
  const { data, error } = await supabase
    .from('shifts')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .eq('status', 'open')
    .maybeSingle();
  if (error) throw error;
  return data as Shift | null;
}

/** Bir önceki kapanan vardiyanın kapanış km'sini, açılışta öneri olarak kullanmak için getirir. */
export async function getSuggestedOpeningKm(vehicleId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('shifts')
    .select('closing_km')
    .eq('vehicle_id', vehicleId)
    .eq('status', 'closed')
    .order('closed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.closing_km as number | undefined) ?? null;
}

/** Tek bir vardiyayi id ile getirir (vardiya detay ekrani ve bildirim yonlendirmesi icin). */
export async function getShift(shiftId: string): Promise<Shift | null> {
  const { data, error } = await supabase
    .from('shifts')
    .select('*')
    .eq('id', shiftId)
    .maybeSingle();
  if (error) throw error;
  return (data as Shift | null) ?? null;
}

export async function openShift(
  input: {
    vehicleId: string;
    driverId: string;
    paymentModel: PaymentModel;
    openingKm: number;
    photoUri: string | null;
  },
  options?: { onPhotoError?: (message: string) => void }
): Promise<Shift> {
  const { data: inserted, error } = await supabase
    .from('shifts')
    .insert({
      vehicle_id: input.vehicleId,
      driver_id: input.driverId,
      payment_model: input.paymentModel,
      status: 'open',
      opening_km: input.openingKm,
      opening_km_confirmed: true,
    })
    .select()
    .single();
  if (error) throw error;

  const shift = inserted as Shift;
  if (!input.photoUri) {
    return shift;
  }
  try {
    const path = await uploadShiftPhoto(shift.id, input.photoUri, 'opening');
    const { data: updated, error: updateError } = await supabase
      .from('shifts')
      .update({ opening_km_photo_url: path, photo_debug: `[v3] opening OK @ ${new Date().toISOString()}` })
      .eq('id', shift.id)
      .select()
      .single();
    if (updateError) throw updateError;
    return updated as Shift;
  } catch (e: any) {
    console.warn('Açılış fotoğrafı yüklenemedi', e);
    const message = e?.message ?? String(e);
    options?.onPhotoError?.(message);
    try {
      await supabase
        .from('shifts')
        .update({ photo_debug: `[v3] opening FAILED @ ${new Date().toISOString()}: ${message}` })
        .eq('id', shift.id);
    } catch {}
    return shift;
  }
}

export type CloseShiftInput = {
  shiftId: string;
  vehicle: Vehicle;
  closingKm: number;
  photoUri: string | null;
  handedToDriverId: string;
  // Yalnizca yuzdelik modelde kullanilir:
  totalAmount?: number;
  fuelCost?: number;
  fuelReceiptUri?: string;
  otherExpenses?: number;
  otherExpensesNote?: string;
  cardAmount?: number;
  notes?: string;
  notesPhotoUri?: string | null;
};

export type PhotoUploadErrors = {
  closing?: string;
  notes?: string;
};

/**
 * Vardiyayi kapatir ve odeme moduna gore hesaplari yapar.
 * Yuzdelik: base = tutar - motorin - diger masraflar
 *           ondalik (driver_share) = base * yuzde/100
 *           net_cash = base - ondalik
 *           owner_total = net_cash + kredi karti
 * Km sistemi: km_total = kapanis km - acilis km
 *             km_debt = km_total * km_rate
 */
export async function closeShift(
  input: CloseShiftInput,
  options?: { onPhotoError?: (errors: PhotoUploadErrors) => void }
): Promise<Shift> {
  const photoErrors: PhotoUploadErrors = {};
  const debugParts: string[] = [];
  const { data: current, error: fetchError } = await supabase
    .from('shifts')
    .select('*')
    .eq('id', input.shiftId)
    .single();
  if (fetchError) throw fetchError;
  const shift = current as Shift;

  const openingKm = shift.opening_km ?? 0;
  const kmTotal = input.closingKm - openingKm;
  if (kmTotal < 0) {
    throw new Error("Kapanış km, açılış km'den küçük olamaz.");
  }

  const update: Record<string, unknown> = {
    status: 'closed',
    closed_at: new Date().toISOString(),
    closing_km: input.closingKm,
    handed_to_driver_id: input.handedToDriverId,
    km_total: kmTotal,
    notes: input.notes ?? null,
  };

  if (shift.payment_model === 'percentage') {
    const totalAmount = input.totalAmount ?? 0;
    const fuelCost = input.fuelCost ?? 0;
    const otherExpenses = input.otherExpenses ?? 0;
    const cardAmount = input.cardAmount ?? 0;
    const percentageRate = input.vehicle.percentage_rate ?? 25;

    const base = totalAmount - fuelCost - otherExpenses;
    const driverShare = base * (percentageRate / 100);
    // Toplam (nakit + kredi karti) once hesaplanir, nakit kismi bundan kredi
    // kartinin cikarilmasiyla bulunur (kredi karti, hasilatin bir PARCASIdir).
    const ownerTotal = base - driverShare;
    const netCash = ownerTotal - cardAmount;

    Object.assign(update, {
      total_amount: totalAmount,
      fuel_cost: fuelCost,
      other_expenses: otherExpenses,
      other_expenses_note: input.otherExpensesNote ?? null,
      card_amount: cardAmount,
      driver_share: driverShare,
      net_cash: netCash,
      owner_total: ownerTotal,
    });

    if (input.fuelReceiptUri) {
      try {
        const receiptPath = await uploadShiftPhoto(shift.id, input.fuelReceiptUri, 'fuel-receipt');
        Object.assign(update, { fuel_receipt_url: receiptPath });
        debugParts.push('fuel-receipt OK');
      } catch (e: any) {
        console.warn('Motorin fişi yüklenemedi', e);
        debugParts.push(`fuel-receipt FAILED: ${e?.message ?? String(e)}`);
      }
    }
  } else {
    const kmRate = input.vehicle.km_rate ?? 0;
    Object.assign(update, {
      km_debt: kmTotal * kmRate,
    });
  }

  if (input.photoUri) {
    try {
      const path = await uploadShiftPhoto(shift.id, input.photoUri, 'closing');
      Object.assign(update, { closing_km_photo_url: path });
      debugParts.push('closing OK');
    } catch (e: any) {
      console.warn('Kapanış fotoğrafı yüklenemedi', e);
      photoErrors.closing = e?.message ?? String(e);
      debugParts.push(`closing FAILED: ${photoErrors.closing}`);
    }
  }

  if (input.notesPhotoUri) {
    try {
      const notePath = await uploadShiftPhoto(shift.id, input.notesPhotoUri, 'notes');
      Object.assign(update, { notes_photo_url: notePath });
      debugParts.push('notes OK');
    } catch (e: any) {
      console.warn('Not fotoğrafı yüklenemedi', e);
      photoErrors.notes = e?.message ?? String(e);
      debugParts.push(`notes FAILED: ${photoErrors.notes}`);
    }
  }

  if (photoErrors.closing || photoErrors.notes) {
    options?.onPhotoError?.(photoErrors);
  }

  if (debugParts.length > 0) {
    Object.assign(update, { photo_debug: `[v3] ${new Date().toISOString()} ${debugParts.join(' | ')}` });
  }

  const { data: updated, error } = await supabase
    .from('shifts')
    .update(update)
    .eq('id', input.shiftId)
    .select()
    .single();
  if (error) throw error;
  return updated as Shift;
}

export async function listVehicleShifts(vehicleId: string, limit = 20): Promise<Shift[]> {
  const { data, error } = await supabase
    .from('shifts')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('opened_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Shift[];
}

export async function listDriverShifts(driverId: string, limit = 20): Promise<Shift[]> {
  const { data, error } = await supabase
    .from('shifts')
    .select('*')
    .eq('driver_id', driverId)
    .order('opened_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Shift[];
}

export type ShiftQueryFilter = {
  vehicleIds?: string[];
  driverId?: string;
  from?: string;
  to?: string;
  limit?: number;
};

/** Gecmis karpinleri (kapanmis vardiyalar) esnek filtrelerle sorgular; geçmiş/filtre ekrani icin. */
export async function queryShifts(filter: ShiftQueryFilter): Promise<Shift[]> {
  let q = supabase
    .from('shifts')
    .select('*')
    .eq('status', 'closed')
    .order('opened_at', { ascending: false });

  if (filter.vehicleIds && filter.vehicleIds.length > 0) {
    q = q.in('vehicle_id', filter.vehicleIds);
  }
  if (filter.driverId) {
    q = q.eq('driver_id', filter.driverId);
  }
  if (filter.from) {
    q = q.gte('opened_at', filter.from);
  }
  if (filter.to) {
    q = q.lte('opened_at', filter.to);
  }
  q = q.limit(filter.limit ?? 200);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Shift[];
}

/** İki zaman damgası arasındaki farkı dakika olarak döner (vardiya süresi). */
export function getShiftDurationMinutes(openedAt: string, closedAt: string | null): number | null {
  if (!closedAt) return null;
  const opened = new Date(openedAt).getTime();
  const closed = new Date(closedAt).getTime();
  if (Number.isNaN(opened) || Number.isNaN(closed)) return null;
  return Math.max(0, Math.round((closed - opened) / 60000));
}

/** Dakikayı "X sa Y dk" gibi okunabilir bir metne çevirir. */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} dk`;
  if (m === 0) return `${h} sa`;
  return `${h} sa ${m} dk`;
}
