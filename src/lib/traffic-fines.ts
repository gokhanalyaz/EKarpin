import { File } from 'expo-file-system';

import { getUserPushToken, sendPushNotification } from '@/lib/notifications';
import type { Shift } from '@/lib/shifts';
import { supabase } from '@/lib/supabase';

export const FINE_PHOTO_BUCKET = 'traffic-fines';

export type TrafficFine = {
  id: string;
  vehicle_id: string;
  /** Kayıt anındaki plaka - şoför sonradan araçtan ayrılsa da cezada plaka görünsün diye. */
  plate_no: string | null;
  shift_id: string | null;
  driver_id: string | null;
  /** Karpin bilgisinin kayıt anındaki kopyası: karpin şoförden gizlense ya da silinse de cezada görünür. */
  shift_no: number | null;
  shift_opened_at: string | null;
  shift_closed_at: string | null;
  shift_opening_km: number | null;
  shift_closing_km: number | null;
  fine_at: string;
  amount: number | null;
  note: string | null;
  photo_url: string | null;
  paid_at: string | null;
  created_by: string;
  created_at: string;
};

/**
 * Ceza anında aracı kim kullanıyordu? O saatte açık olan karpini bulur.
 * Bulamazsa (araç boştaysa ya da şoför değişimi sırasındaysa) hemen
 * öncesindeki ve sonrasındaki karpini döner; karar araç sahibine kalır.
 */
export type FineShiftLookup = {
  match: Shift | null;
  before: Shift | null;
  after: Shift | null;
};

export async function findShiftAt(vehicleId: string, at: Date): Promise<FineShiftLookup> {
  const iso = at.toISOString();

  // O saatte açılmış ve (henüz kapanmamış ya da o saatten sonra kapanmış) karpin.
  const { data: matches, error } = await supabase
    .from('shifts')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .lte('opened_at', iso)
    .or(`closed_at.gte."${iso}",closed_at.is.null`)
    .order('opened_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  const match = ((matches ?? [])[0] as Shift | undefined) ?? null;
  if (match) return { match, before: null, after: null };

  const [beforeRes, afterRes] = await Promise.all([
    supabase
      .from('shifts')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .lte('opened_at', iso)
      .order('opened_at', { ascending: false })
      .limit(1),
    supabase
      .from('shifts')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .gt('opened_at', iso)
      .order('opened_at', { ascending: true })
      .limit(1),
  ]);
  if (beforeRes.error) throw beforeRes.error;
  if (afterRes.error) throw afterRes.error;
  return {
    match: null,
    before: ((beforeRes.data ?? [])[0] as Shift | undefined) ?? null,
    after: ((afterRes.data ?? [])[0] as Shift | undefined) ?? null,
  };
}

/** Şoför adlarını id ile getirir. */
export async function getProfileNames(ids: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return {};
  const { data, error } = await supabase.from('profiles').select('id, full_name').in('id', unique);
  if (error) throw error;
  const map: Record<string, string> = {};
  (data ?? []).forEach((p: { id: string; full_name: string | null }) => {
    map[p.id] = p.full_name ?? 'İsimsiz';
  });
  return map;
}

async function uploadFinePhoto(vehicleId: string, fineId: string, uri: string): Promise<string> {
  const path = `${vehicleId}/${fineId}.jpg`;
  const file = new File(uri);
  if (!file.exists) throw new Error('Fotoğraf dosyası bulunamadı.');
  const arrayBuffer = await file.arrayBuffer();
  if (!arrayBuffer || arrayBuffer.byteLength === 0) throw new Error('Fotoğraf okunamadı, lütfen tekrar çek.');
  const { error } = await supabase.storage
    .from(FINE_PHOTO_BUCKET)
    .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
  if (error) throw new Error(`Fotoğraf yüklenemedi: ${error.message}`);
  return path;
}

export async function getFinePhotoUrl(path: string, expiresInSeconds = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage.from(FINE_PHOTO_BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export function formatFineDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('tr-TR');
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${date} ${time}`;
}

export function formatMoney(value: number | null | undefined): string {
  if (value == null) return '-';
  return `${Number(value).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₺`;
}

/** Cezadaki karpin kopyasından "#12 · 12.11.2026 08:00 → 20:00" gibi kısa metin. */
export function fineShiftLabel(f: Pick<TrafficFine, 'shift_no' | 'shift_opened_at' | 'shift_closed_at'>): string {
  if (!f.shift_opened_at) return '';
  const no = f.shift_no != null ? `#${f.shift_no} · ` : '';
  const open = formatFineDateTime(f.shift_opened_at);
  if (!f.shift_closed_at) return `${no}${open} → açık`;
  const sameDay = new Date(f.shift_opened_at).toDateString() === new Date(f.shift_closed_at).toDateString();
  const close = sameDay ? formatFineDateTime(f.shift_closed_at).split(' ')[1] : formatFineDateTime(f.shift_closed_at);
  return `${no}${open} → ${close}`;
}

/**
 * Cezayı kaydeder, fotoğraf varsa yükler ve şoföre (varsa) bildirim gönderir.
 * Fotoğraf yüklenemezse ceza yine kaydedilir; hata mesajı döner.
 */
export async function createTrafficFine(input: {
  vehicleId: string;
  plateNo: string;
  shift: Shift | null;
  fineAt: Date;
  amount: number | null;
  note: string | null;
  photoUri: string | null;
}): Promise<{ fine: TrafficFine; photoError: string | null; notified: boolean }> {
  const { data, error } = await supabase
    .from('traffic_fines')
    .insert({
      vehicle_id: input.vehicleId,
      plate_no: input.plateNo || null,
      shift_id: input.shift?.id ?? null,
      driver_id: input.shift?.driver_id ?? null,
      shift_no: input.shift?.shift_no ?? null,
      shift_opened_at: input.shift?.opened_at ?? null,
      shift_closed_at: input.shift?.closed_at ?? null,
      shift_opening_km: input.shift?.opening_km ?? null,
      shift_closing_km: input.shift?.closing_km ?? null,
      fine_at: input.fineAt.toISOString(),
      amount: input.amount,
      note: input.note,
    })
    .select()
    .single();
  if (error) throw error;
  let fine = data as TrafficFine;

  let photoError: string | null = null;
  if (input.photoUri) {
    try {
      const path = await uploadFinePhoto(input.vehicleId, fine.id, input.photoUri);
      const { data: updated, error: updateError } = await supabase
        .from('traffic_fines')
        .update({ photo_url: path })
        .eq('id', fine.id)
        .select()
        .single();
      if (updateError) throw updateError;
      fine = updated as TrafficFine;
    } catch (e: any) {
      photoError = e?.message ?? 'Fotoğraf yüklenemedi.';
    }
  }

  let notified = false;
  if (input.shift?.driver_id) {
    const token = await getUserPushToken(input.shift.driver_id);
    if (token) {
      const amountText = input.amount != null ? ` Tutar: ${formatMoney(input.amount)}.` : '';
      const shiftText = ` Karpin${fineShiftLabel(fine) ? ` ${fineShiftLabel(fine)}` : ''}.`;
      await sendPushNotification(
        token,
        `${input.plateNo} · Trafik Cezası`,
        `${formatFineDateTime(fine.fine_at)} tarihli trafik cezası sizin karpininize denk geliyor.${shiftText}${amountText}`,
        { type: 'traffic_fine', fineId: fine.id, vehicleId: input.vehicleId }
      );
      notified = true;
    }
  }

  return { fine, photoError, notified };
}

/** Araç sahibi: araçlarının cezaları. Şoför: kendisine atanan cezalar (RLS zaten süzüyor). */
export async function listTrafficFines(filter: { vehicleIds?: string[]; driverId?: string }): Promise<TrafficFine[]> {
  let q = supabase.from('traffic_fines').select('*').order('fine_at', { ascending: false }).limit(200);
  if (filter.vehicleIds && filter.vehicleIds.length > 0) q = q.in('vehicle_id', filter.vehicleIds);
  if (filter.driverId) q = q.eq('driver_id', filter.driverId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as TrafficFine[];
}

export async function setTrafficFinePaid(fineId: string, paid: boolean): Promise<void> {
  const { error } = await supabase
    .from('traffic_fines')
    .update({ paid_at: paid ? new Date().toISOString() : null })
    .eq('id', fineId);
  if (error) throw error;
}

export async function deleteTrafficFine(fine: TrafficFine): Promise<void> {
  const { error } = await supabase.from('traffic_fines').delete().eq('id', fine.id);
  if (error) throw error;
  if (fine.photo_url) {
    await supabase.storage.from(FINE_PHOTO_BUCKET).remove([fine.photo_url]);
  }
}
