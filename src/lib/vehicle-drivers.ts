import type { Profile } from '@/contexts/auth-context';
import { normalizePhone } from '@/lib/format';
import { supabase } from '@/lib/supabase';

export type VehicleDriverRow = {
  id: string;
  vehicle_id: string;
  driver_id: string;
  created_at: string;
  driver: Profile;
  daily_km_discount_limit: number | null;
};

export async function listVehicleDrivers(vehicleId: string): Promise<VehicleDriverRow[]> {
  const { data, error } = await supabase
    .from('vehicle_drivers')
    .select('id, vehicle_id, driver_id, created_at, daily_km_discount_limit, driver:profiles(*)')
    .eq('vehicle_id', vehicleId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as VehicleDriverRow[];
}

/** Bu şoförün bu araçta tanımlı günlük km düşüm hakkını döner (yetkisi yoksa null). */
export async function getDriverDailyKmLimit(vehicleId: string, driverId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('vehicle_drivers')
    .select('daily_km_discount_limit')
    .eq('vehicle_id', vehicleId)
    .eq('driver_id', driverId)
    .maybeSingle();
  if (error) throw error;
  const value = (data as { daily_km_discount_limit: number | null } | null)?.daily_km_discount_limit;
  return value != null && value > 0 ? value : null;
}

/** Araç sahibi bu şoförün günlük km düşüm hakkını belirler/günceller (null/0 = yetkiyi kaldır). */
export async function setDriverDailyKmLimit(vehicleDriverRowId: string, limit: number | null): Promise<void> {
  const { error } = await supabase
    .from('vehicle_drivers')
    .update({ daily_km_discount_limit: limit && limit > 0 ? limit : null })
    .eq('id', vehicleDriverRowId);
  if (error) throw error;
}

export async function findDriverByPhone(phone: string): Promise<Profile | null> {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'driver')
    .eq('phone', normalized)
    .maybeSingle();

  if (error) throw error;
  return (data as Profile) ?? null;
}

export async function assignDriver(vehicleId: string, driverId: string): Promise<void> {
  const { error } = await supabase
    .from('vehicle_drivers')
    .insert({ vehicle_id: vehicleId, driver_id: driverId });

  if (error) throw error;
}

export async function unassignDriver(vehicleDriverRowId: string): Promise<void> {
  const { error } = await supabase.from('vehicle_drivers').delete().eq('id', vehicleDriverRowId);
  if (error) throw error;
}
