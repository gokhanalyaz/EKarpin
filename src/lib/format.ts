/**
 * Telefon numaralarini karsilastirabilmek icin her zaman ayni kaliba
 * (ulke kodu + 10 haneli numara, ornek: "905061234567") cevirir.
 * Kullanici "+90 506...", "0506..." veya sadece "506..." yazmis olsa da
 * sonuc hep aynidir, boylece kayit ve arama her zaman eslesir.
 */
export function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, '');

  if (digits.startsWith('90') && digits.length === 12) {
    return digits;
  }
  if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.slice(1);
  }
  if (digits.length === 10) {
    return `90${digits}`;
  }
  // Beklenmedik uzunluk: elimizdeki rakamlari oldugu gibi dondur.
  return digits;
}

/** Sadece yerel (10 haneli) kismi alip goruntuleme icin +90 onekini ekler. */
export function formatPhoneWithPrefix(localDigits: string): string {
  return localDigits ? `+90 ${localDigits}` : '';
}
