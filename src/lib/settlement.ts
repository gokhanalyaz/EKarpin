import type { Shift } from '@/lib/shifts';
import { markShiftsDeliveredByDriver, markShiftsReceivedByOwner } from '@/lib/shifts';
import { getOwnerPushToken, getUserPushToken, sendPushNotification } from '@/lib/notifications';

export type SettlementRole = 'owner' | 'driver';
export type SettlementState = 'pending' | 'awaiting_confirmation' | 'confirmed';

/** Bir vardiyanin teslim/tahsilat durumu. Gecerli/son durum arac sahibinin onayidir. */
export function getSettlementState(shift: Shift): SettlementState {
  if (shift.owner_confirmed_received_at) return 'confirmed';
  if (shift.driver_marked_delivered_at) return 'awaiting_confirmation';
  return 'pending';
}

export function getSettlementLabel(state: SettlementState, role: SettlementRole): string {
  if (state === 'confirmed') return role === 'owner' ? 'Teslim Alındı' : 'Onaylandı';
  if (state === 'awaiting_confirmation') {
    return role === 'owner' ? 'Şoför Teslim Etti · Onay Bekliyor' : 'Onay Bekleniyor';
  }
  return role === 'owner' ? 'Teslim Alınmadı' : 'Teslim Etmedim';
}

/** O vardiyada arac sahibine kalan/borc tutari (odeme modeline gore). */
export function settlementAmount(shift: Shift): number {
  return shift.payment_model === 'percentage' ? shift.net_cash ?? 0 : shift.km_debt ?? 0;
}

/** Sofor secili vardiyalari "teslim ettim" olarak isaretler ve arac sahibine bildirim gonderir. */
export async function markDeliveredAndNotify(shifts: Shift[], driverName: string): Promise<void> {
  const ids = shifts.map((s) => s.id);
  if (ids.length === 0) return;
  await markShiftsDeliveredByDriver(ids);

  const vehicleIds = Array.from(new Set(shifts.map((s) => s.vehicle_id)));
  vehicleIds.forEach((vehicleId) => {
    const count = shifts.filter((s) => s.vehicle_id === vehicleId).length;
    getOwnerPushToken(vehicleId)
      .then((token) => {
        if (!token) return;
        return sendPushNotification(
          token,
          'Teslim Onayı Bekleniyor',
          `${driverName}, ${count} karpin için teslim bildirdi. Onaylamak için dokun.`,
          { type: 'settlement_pending', vehicleId }
        );
      })
      .catch(() => {});
  });
}

/** Arac sahibi secili vardiyalari "teslim aldim" olarak isaretler ve ilgili soforlere bildirim gonderir. */
export async function markReceivedAndNotify(shifts: Shift[]): Promise<void> {
  const ids = shifts.map((s) => s.id);
  if (ids.length === 0) return;
  await markShiftsReceivedByOwner(ids);

  const driverIds = Array.from(new Set(shifts.map((s) => s.driver_id)));
  driverIds.forEach((driverId) => {
    const count = shifts.filter((s) => s.driver_id === driverId).length;
    const vehicleId = shifts.find((s) => s.driver_id === driverId)?.vehicle_id;
    getUserPushToken(driverId)
      .then((token) => {
        if (!token) return;
        return sendPushNotification(
          token,
          'Teslim Onaylandı',
          `Araç sahibiniz ${count} karpin tesliminizi onayladı.`,
          { type: 'settlement_confirmed', vehicleId }
        );
      })
      .catch(() => {});
  });
}
