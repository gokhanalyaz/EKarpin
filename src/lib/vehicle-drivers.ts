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
  /** Null = sinirsiz. Doluysa, bu soforun kapanmis karpinleri KENDI
   * panelinde (Gecmis sekmesi, arac/sofor ekranlari) sadece bu kadar gun
   * boyunca gorunur - veri silinmez, sadece soforun gorunumunden kaybolur.
   * Arac sahibi tarafinda bu sinir hicbir zaman uygulanmaz. */
  shift_visibility_days: number | null;
  /** Şoför vardiya kapatırken uygulama komisyonu (Uber, Yandex vb.) girebilir mi (varsayılan evet). */
  can_enter_commission?: boolean | null;
};

export async function listVehicleDrivers(vehicleId: string): Promise<VehicleDriverRow[]> {
  const { data, error } = await supabase
    .from('vehicle_drivers')
    // '*' ile: yeni eklenen kolonlar (örn. can_enter_commission) veritabanında
    // henüz yoksa bile sorgu bozulmasın.
    .select('*, driver:profiles(*)')
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

/**
 * Araç sahibi, bu şoförün kapanmış karpinlerinin kendi panelinde kaç gün
 * görünür kalacağını belirler/günceller (null/0 = sınırsız - şoför hep
 * görür). Bu sadece şoförün görünümünü kısıtlar, veri hiçbir zaman
 * silinmez; araç sahibi tarafında bu sınır hiçbir zaman uygulanmaz.
 */
export async function setDriverShiftVisibilityDays(
  vehicleDriverRowId: string,
  days: number | null
): Promise<void> {
  const { error } = await supabase
    .from('vehicle_drivers')
    .update({ shift_visibility_days: days && days > 0 ? Math.round(days) : null })
    .eq('id', vehicleDriverRowId);
  if (error) throw error;
}

/**
 * Bir soforun KENDISININ atandigi tum araclardaki vehicle_drivers
 * satirlarini (ozellikle her arac icin tanimlanmis shift_visibility_days
 * degerini) getirir - sofor tarafindaki ekranlarda "bu araçta karpinlerim
 * kac gun gorunur" bilgisini aractan araca uygulamak icin kullanilir.
 */
export async function listMyVehicleAssignments(
  driverId: string
): Promise<Pick<VehicleDriverRow, 'vehicle_id' | 'shift_visibility_days'>[]> {
  const { data, error } = await supabase
    .from('vehicle_drivers')
    .select('vehicle_id, shift_visibility_days')
    .eq('driver_id', driverId);
  if (error) throw error;
  return (data ?? []) as unknown as Pick<VehicleDriverRow, 'vehicle_id' | 'shift_visibility_days'>[];
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

/**
 * Soforu araçtan kaldirir (vehicle_drivers satirini siler). deleteShifts=true
 * verilirse, o soforun bu araçla ilgili TUM karpinleri (shifts) de silinir;
 * false/omit ise karpinler oldugu gibi kalir (gecmis veriler korunur).
 */
export async function removeDriverFromVehicle(
  vehicleDriverRowId: string,
  options: { vehicleId: string; driverId: string; deleteShifts: boolean }
): Promise<void> {
  if (options.deleteShifts) {
    const { error: shiftsError } = await supabase
      .from('shifts')
      .delete()
      .eq('vehicle_id', options.vehicleId)
      .eq('driver_id', options.driverId);
    if (shiftsError) throw shiftsError;
  }

  const { error } = await supabase.from('vehicle_drivers').delete().eq('id', vehicleDriverRowId);
  if (error) throw error;
}

/** Araç sahibi: bu şoför uygulama komisyonu girebilsin mi. */
export async function setDriverCanEnterCommission(vehicleDriverId: string, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('vehicle_drivers')
    .update({ can_enter_commission: enabled })
    .eq('id', vehicleDriverId);
  if (error) throw error;
}
