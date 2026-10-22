import { getSuggestedOpeningKm } from '@/lib/shifts';
import { supabase } from '@/lib/supabase';
import { parseDateOnly, type Vehicle } from '@/lib/vehicles';

export type MaintenanceLog = {
  id: string;
  vehicle_id: string;
  created_by: string;
  type: string;
  km_at_service: number;
  interval_km: number | null;
  reminder_buffer_km: number;
  note: string | null;
  created_at: string;
};

export const MAINTENANCE_TYPES = [
  { key: 'lastik', label: 'Lastik Değişimi' },
  { key: 'yag', label: 'Yağ Bakımı' },
  { key: 'periyodik', label: 'Periyodik Bakım' },
  { key: 'fren', label: 'Fren Bakımı' },
  { key: 'diger', label: 'Diğer' },
] as const;

/** Her bakım türü için ikon (SF Symbols). */
export const MAINTENANCE_ICONS: Record<string, string> = {
  lastik: 'circle.circle.fill',
  yag: 'drop.fill',
  periyodik: 'wrench.and.screwdriver.fill',
  fren: 'exclamationmark.octagon.fill',
  diger: 'ellipsis.circle.fill',
};

export type InspectionStatus = { dueDate: Date; daysLeft: number; dueSoon: boolean; overdue: boolean };

/** Aracın vize durumu (vize tarihi girilmemişse null). */
export function getInspectionStatus(vehicle: Vehicle): InspectionStatus | null {
  if (!vehicle.inspection_due_date) return null;
  const dueDate = parseDateOnly(vehicle.inspection_due_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysLeft = Math.round((dueDate.getTime() - today.getTime()) / 86400000);
  const notice = vehicle.inspection_notice_days ?? 10;
  return { dueDate, daysLeft, dueSoon: daysLeft >= 0 && daysLeft <= notice, overdue: daysLeft < 0 };
}

export function maintenanceTypeLabel(key: string): string {
  return MAINTENANCE_TYPES.find((t) => t.key === key)?.label ?? key;
}

export async function listMaintenanceLogs(vehicleId: string): Promise<MaintenanceLog[]> {
  const { data, error } = await supabase
    .from('vehicle_maintenance_logs')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as MaintenanceLog[];
}

export async function addMaintenanceLog(input: {
  vehicleId: string;
  createdBy: string;
  type: string;
  kmAtService: number;
  intervalKm?: number | null;
  reminderBufferKm?: number;
  note?: string | null;
}): Promise<MaintenanceLog> {
  const { data, error } = await supabase
    .from('vehicle_maintenance_logs')
    .insert({
      vehicle_id: input.vehicleId,
      created_by: input.createdBy,
      type: input.type,
      km_at_service: input.kmAtService,
      interval_km: input.intervalKm ?? null,
      reminder_buffer_km: input.reminderBufferKm ?? 1000,
      note: input.note?.trim() || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as MaintenanceLog;
}

/** Hatalı girilmiş bir bakım kaydını düzeltir (tür, km, hatırlatma aralığı, not). */
export async function updateMaintenanceLog(
  id: string,
  input: { type: string; kmAtService: number; intervalKm?: number | null; note?: string | null }
): Promise<MaintenanceLog> {
  const { data, error } = await supabase
    .from('vehicle_maintenance_logs')
    .update({
      type: input.type,
      km_at_service: input.kmAtService,
      interval_km: input.intervalKm ?? null,
      note: input.note?.trim() || null,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as MaintenanceLog;
}

export async function deleteMaintenanceLog(id: string): Promise<void> {
  const { data, error } = await supabase.from('vehicle_maintenance_logs').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Bakım kaydı silinemedi.');
}

export type MaintenanceStatus = {
  log: MaintenanceLog;
  nextDueKm: number | null;
  remainingKm: number | null;
  dueSoon: boolean;
  overdue: boolean;
};

/** Verilen bakim kaydi ve aracin guncel km'sine gore kalan km / hatirlatma durumunu hesaplar. */
export function getMaintenanceStatus(log: MaintenanceLog, currentKm: number | null): MaintenanceStatus {
  if (log.interval_km == null || currentKm == null) {
    return { log, nextDueKm: null, remainingKm: null, dueSoon: false, overdue: false };
  }
  const nextDueKm = log.km_at_service + log.interval_km;
  const remainingKm = nextDueKm - currentKm;
  return {
    log,
    nextDueKm,
    remainingKm,
    dueSoon: remainingKm <= log.reminder_buffer_km && remainingKm > 0,
    overdue: remainingKm <= 0,
  };
}

export type MaintenanceReminder = {
  key: string;
  vehicle: Vehicle;
  kind: 'km' | 'inspection';
  title: string;
  message: string;
  overdue: boolean;
};

function kmReminderMessage(status: MaintenanceStatus): string {
  return status.overdue
    ? `Zamanı geçti - ${status.nextDueKm} km'de yapılması gerekiyordu (${Math.abs(status.remainingKm ?? 0).toFixed(0)} km geçti).`
    : `Yaklaşıyor - ${status.remainingKm?.toFixed(0)} km sonra (${status.nextDueKm} km'de).`;
}

export function inspectionMessage(status: InspectionStatus): string {
  const date = status.dueDate.toLocaleDateString('tr-TR');
  if (status.overdue) return `Vize süresi ${Math.abs(status.daysLeft)} gün önce doldu (${date}).`;
  if (status.daysLeft === 0) return `Vize için bugün son gün (${date}).`;
  return `Vizeye ${status.daysLeft} gün kaldı (${date}).`;
}

/**
 * Bildirimler ekranı ve ana sayfadaki zil için: verilen araçlarda sırası
 * yaklaşan veya geçmiş bakımları döner. Her bakım türünün sadece en son
 * kaydına bakılır - yani bakım yapılıp yeni kayıt girildiğinde ya da kayıt
 * düzenlendiğinde/silindiğinde hatırlatma kendiliğinden güncellenir.
 */
export async function listMaintenanceReminders(vehicles: Vehicle[]): Promise<MaintenanceReminder[]> {
  const perVehicle = await Promise.all(
    vehicles.map(async (vehicle) => {
      const [logs, km] = await Promise.all([
        listMaintenanceLogs(vehicle.id).catch(() => [] as MaintenanceLog[]),
        getSuggestedOpeningKm(vehicle.id).catch(() => null),
      ]);
      const kmReminders: MaintenanceReminder[] = latestByType(logs)
        .map((log) => getMaintenanceStatus(log, km))
        .filter((status) => status.dueSoon || status.overdue)
        .map((status) => ({
          key: status.log.id,
          vehicle,
          kind: 'km' as const,
          title: maintenanceTypeLabel(status.log.type),
          message: kmReminderMessage(status),
          overdue: status.overdue,
        }));
      const inspection = getInspectionStatus(vehicle);
      if (inspection && (inspection.dueSoon || inspection.overdue)) {
        kmReminders.unshift({
          key: `vize-${vehicle.id}`,
          vehicle,
          kind: 'inspection',
          title: 'Vize',
          message: inspectionMessage(inspection),
          overdue: inspection.overdue,
        });
      }
      return kmReminders;
    })
  );
  // Zamanı geçenler en üstte.
  return perVehicle.flat().sort((a, b) => Number(b.overdue) - Number(a.overdue));
}

/** Her bakim turu (type) icin en son kaydi döner (o turun en guncel durumu). */
export function latestByType(logs: MaintenanceLog[]): MaintenanceLog[] {
  const map = new Map<string, MaintenanceLog>();
  logs.forEach((log) => {
    const existing = map.get(log.type);
    if (!existing || new Date(log.created_at) > new Date(existing.created_at)) {
      map.set(log.type, log);
    }
  });
  return Array.from(map.values());
}
