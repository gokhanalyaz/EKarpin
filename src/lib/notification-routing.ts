/**
 * Bir push bildiriminin "data" payload'undan, dokunulunca gidilecek ekranin
 * yolunu cozer. Hem canli (uygulama acikken/arka plandayken dokunulan)
 * bildirimler hem de soguk baslangicta (uygulama kapaliyken bildirime
 * dokunup acildiginda) kullanilir - o yuzden burasi SADECE yol doner,
 * navigasyonu kendisi yapmaz (soguk baslangicta hemen router.push yapmak,
 * henuz index.tsx'in /home yonlendirmesiyle yarisip kaybedebiliyor).
 */
function singleShiftId(data: Record<string, unknown>): string | null {
  const ids = Array.isArray(data.shiftIds)
    ? data.shiftIds.filter((x): x is string => typeof x === 'string')
    : [];
  return ids.length === 1 ? ids[0] : null;
}

export function resolveNotificationRoute(data: Record<string, unknown> | undefined | null): string | null {
  if (!data) return null;
  const type = data.type;
  if ((type === 'shift_opened' || type === 'shift_closed') && typeof data.shiftId === 'string') {
    return `/shift-detail/${data.shiftId}`;
  }
  if (type === 'vehicle_alert' && typeof data.vehicleId === 'string') {
    return `/vehicle/${data.vehicleId}`;
  }
  if (type === 'settlement_pending') {
    // Tek vardiyaysa (her zaman oyle, tek tek isaretleniyor) dogrudan o
    // vardiyanin detayina goturup oradan onaylatiyoruz. Birden fazlaysa
    // (ileride toplu isaretleme eklenirse) arac sayfasindaki listeye duser.
    const shiftId = singleShiftId(data);
    if (shiftId) return `/shift-detail/${shiftId}`;
    if (typeof data.vehicleId === 'string') return `/vehicle/${data.vehicleId}`;
  }
  if (type === 'settlement_confirmed') {
    const shiftId = singleShiftId(data);
    if (shiftId) return `/shift-detail/${shiftId}`;
    if (typeof data.vehicleId === 'string') return `/shift/${data.vehicleId}`;
  }
  return null;
}
