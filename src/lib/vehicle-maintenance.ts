import { supabase } from '@/lib/supabase';

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

export async function deleteMaintenanceLog(id: string): Promise<void> {
  const { error } = await supabase.from('vehicle_maintenance_logs').delete().eq('id', id);
  if (error) throw error;
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
