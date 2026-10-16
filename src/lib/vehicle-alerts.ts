import { supabase } from '@/lib/supabase';
import { uploadShiftPhoto } from '@/lib/shifts';

export type VehicleAlert = {
  id: string;
  vehicle_id: string;
  driver_id: string;
  shift_id: string | null;
  note: string;
  photo_url: string | null;
  created_at: string;
};

/**
 * Vardiya kapanmasindan bagimsiz, sofor tarafindan arac sahibine anlik
 * bildirim (ör. "araç arızalı", "kaza oldu") gonderme kaydi. Fotograf
 * varsa, ilgili vardiyanin storage klasoru altina yuklenir (mevcut
 * "shift-photos" erisim kurallari zaten bu klasoru kapsiyor).
 */
export async function createVehicleAlert(input: {
  vehicleId: string;
  driverId: string;
  shiftId: string;
  note: string;
  photoUri?: string | null;
}): Promise<VehicleAlert> {
  const { data: inserted, error } = await supabase
    .from('vehicle_alerts')
    .insert({
      vehicle_id: input.vehicleId,
      driver_id: input.driverId,
      shift_id: input.shiftId,
      note: input.note,
    })
    .select()
    .single();
  if (error) throw error;

  const alert = inserted as VehicleAlert;
  if (!input.photoUri) {
    return alert;
  }

  try {
    const path = await uploadShiftPhoto(input.shiftId, input.photoUri, 'alert', String(Date.now()));
    const { data: updated, error: updateError } = await supabase
      .from('vehicle_alerts')
      .update({ photo_url: path })
      .eq('id', alert.id)
      .select()
      .single();
    if (updateError) throw updateError;
    return updated as VehicleAlert;
  } catch (e) {
    console.warn('Bildirim fotoğrafı yüklenemedi', e);
    return alert;
  }
}

export async function listVehicleAlerts(vehicleId: string, limit = 20): Promise<VehicleAlert[]> {
  const { data, error } = await supabase
    .from('vehicle_alerts')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as VehicleAlert[];
}

/** Arac sahibinin TUM araclarindaki bildirimleri (en yeniden eskiye) - "Bildirimler" sekmesi icin. */
export async function listOwnerVehicleAlerts(vehicleIds: string[], limit = 50): Promise<VehicleAlert[]> {
  if (vehicleIds.length === 0) return [];
  const { data, error } = await supabase
    .from('vehicle_alerts')
    .select('*')
    .in('vehicle_id', vehicleIds)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as VehicleAlert[];
}
