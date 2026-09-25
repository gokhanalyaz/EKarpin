import type { Profile } from '@/contexts/auth-context';
import { normalizePhone } from '@/lib/format';
import { supabase } from '@/lib/supabase';

export type VehicleDriverRow = {
  id: string;
  vehicle_id: string;
  driver_id: string;
  created_at: string;
  driver: Profile;
};

export async function listVehicleDrivers(vehicleId: string): Promise<VehicleDriverRow[]> {
  const { data, error } = await supabase
    .from('vehicle_drivers')
    .select('id, vehicle_id, driver_id, created_at, driver:profiles(*)')
    .eq('vehicle_id', vehicleId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as VehicleDriverRow[];
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
