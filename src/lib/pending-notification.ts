/**
 * Uygulama tamamen kapaliyken bir bildirime dokunularak acildiginda
 * (soguk baslangic), henuz oturum/yonlendirme hazir olmadan router.push
 * yapmak, index.tsx'in "/home"a yonlendirmesiyle yarisip kaybedebiliyor.
 * Bunun yerine hedef yol burada bekletilir; index.tsx, oturum hazir
 * olup kendi yonlendirme kararini verirken bunu okuyup tuketir (varsa
 * /home yerine dogrudan bu hedefe gider).
 */
let pendingTarget: string | null = null;

export function setPendingNotificationTarget(target: string | null): void {
  pendingTarget = target;
}

/** Degeri okur ve ayni anda temizler (bir daha kullanilmasin diye). */
export function consumePendingNotificationTarget(): string | null {
  const target = pendingTarget;
  pendingTarget = null;
  return target;
}
