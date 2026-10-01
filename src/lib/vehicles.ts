import { supabase } from '@/lib/supabase';

export type PaymentModel = 'percentage' | 'km_based';

export type Vehicle = {
  id: string;
  owner_id: string;
  plate_no: string;
  payment_model: PaymentModel;
  percentage_rate: number | null;
  km_rate: number | null;
  created_at: string;
  enabled_expense_categories: string[] | null;
  expected_revenue_per_km: number | null;
};

export async function listOwnerVehicles(ownerId: string): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Vehicle[];
}

export async function createVehicle(input: {
  ownerId: string;
  plateNo: string;
  paymentModel: PaymentModel;
  percentageRate?: number | null;
  kmRate?: number | null;
}): Promise<Vehicle> {
  const { data, error } = await supabase
    .from('vehicles')
    .insert({
      owner_id: input.ownerId,
      plate_no: input.plateNo.trim().toUpperCase(),
      payment_model: input.paymentModel,
      percentage_rate: input.paymentModel === 'percentage' ? (input.percentageRate ?? 25) : null,
      km_rate: input.paymentModel === 'km_based' ? (input.kmRate ?? null) : null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Vehicle;
}

type VehicleDriverRow = { vehicle: Vehicle | null };

export async function listAssignedVehicles(driverId: string): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from('vehicle_drivers')
    .select('vehicle:vehicles(*)')
    .eq('driver_id', driverId);

  if (error) throw error;
  return ((data ?? []) as unknown as VehicleDriverRow[])
    .map((row) => row.vehicle)
    .filter((v): v is Vehicle => v !== null);
}

export async function getVehicle(id: string): Promise<Vehicle> {
  const { data, error } = await supabase.from('vehicles').select('*').eq('id', id).single();
  if (error) throw error;
  return data as Vehicle;
}

/** Arac sahibi, bu aracta hangi gider kategorilerinin sofore acik olacagini belirler. */
export async function setEnabledExpenseCategories(
  vehicleId: string,
  categories: string[]
): Promise<void> {
  const { error } = await supabase
    .from('vehicles')
    .update({ enabled_expense_categories: categories })
    .eq('id', vehicleId);
  if (error) throw error;
}

/** Arac sahibi, yuzdelik araclarda km-hasilat karsilastirmasi icin beklenen km basi hasilati girer. */
export async function setExpectedRevenuePerKm(
  vehicleId: string,
  rate: number | null
): Promise<void> {
  const { error } = await supabase
    .from('vehicles')
    .update({ expected_revenue_per_km: rate })
    .eq('id', vehicleId);
  if (error) throw error;
}
