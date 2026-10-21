import { File } from 'expo-file-system';

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
  /** Ruhsat fotoğrafının 'vehicle-documents' depolamasındaki yolu. */
  registration_photo_path?: string | null;
};

export function paymentModelLabel(
  vehicle: Pick<Vehicle, 'payment_model' | 'percentage_rate' | 'km_rate'>
): string {
  return vehicle.payment_model === 'percentage'
    ? `Yüzdelik (%${vehicle.percentage_rate ?? 25})`
    : `Km (${vehicle.km_rate ?? '-'} TL/km)`;
}

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

/**
 * Ruhsat fotoğrafını yükler ve aracın kaydına bağlar. Dosya yolu
 * <aracId>/ruhsat-<zaman>.jpg - sadece aracın sahibi görebilir.
 */
export async function uploadVehicleRegistration(vehicleId: string, uri: string): Promise<string> {
  const file = new File(uri);
  if (!file.exists) throw new Error('Ruhsat fotoğrafı bulunamadı, tekrar çekmeyi dene.');
  const arrayBuffer = await file.arrayBuffer();
  if (!arrayBuffer || arrayBuffer.byteLength === 0) throw new Error('Ruhsat fotoğrafı okunamadı.');

  const path = `${vehicleId}/ruhsat-${Date.now()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from('vehicle-documents')
    .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
  if (uploadError) throw new Error(`Ruhsat yüklenemedi: ${uploadError.message}`);

  const { error } = await supabase.from('vehicles').update({ registration_photo_path: path }).eq('id', vehicleId);
  if (error) throw error;
  return path;
}

/** Ruhsat yüklenemezse yarım kalan araç kaydını geri almak için. */
export async function deleteVehicle(vehicleId: string): Promise<void> {
  const { error } = await supabase.from('vehicles').delete().eq('id', vehicleId);
  if (error) throw error;
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

/**
 * Arac sahibi, yuzdelik araclarda km-hasilat karsilastirmasi icin beklenen km basi hasilati girer.
 * NOT: Bu fonksiyon hala duruyor ama Arac Ayarlari ekranindaki UI'si simdilik
 * kaldirildi (kullanicinin istegiyle) - ileride (uygulama yayildikca) UI geri
 * eklenebilir, bu yuzden alt yapi burada bilerek silinmedi.
 */
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

/**
 * Arac sahibi, calisma sistemini (yuzdelik/km) ve ilgili orani diledigi
 * zaman degistirebilir. Geçmis vardiyalar kendi payment_model'ini zaten
 * ayrica sakladigi icin (Shift.payment_model), bu degisiklik eski
 * karpinlerin gorunumunu etkilemez - sadece yeni acilacak vardiyalara
 * uygulanir.
 */
export async function updateVehiclePaymentModel(
  vehicleId: string,
  input: { paymentModel: PaymentModel; percentageRate?: number | null; kmRate?: number | null }
): Promise<void> {
  const { error } = await supabase
    .from('vehicles')
    .update({
      payment_model: input.paymentModel,
      percentage_rate: input.paymentModel === 'percentage' ? (input.percentageRate ?? 25) : null,
      km_rate: input.paymentModel === 'km_based' ? (input.kmRate ?? null) : null,
    })
    .eq('id', vehicleId);
  if (error) throw error;
}
