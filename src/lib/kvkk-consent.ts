/**
 * KVKK onayi icin cok basit, kalici olmayan bir "kutu" (store). Kayit
 * ekrani ile /kvkk ekrani arasinda, kayit formundaki alanlari (ad, telefon,
 * sifre) kaybetmeden bilgi tasimak icin kullanilir: kullanici /kvkk
 * ekraninda en alta inip "Okudum, Onaylıyorum" diyince burasi guncellenir,
 * kayit ekrani geri donulunce (useFocusEffect ile) bu degeri okur.
 */
let kvkkAccepted = false;

export function getKvkkAccepted(): boolean {
  return kvkkAccepted;
}

export function setKvkkAccepted(value: boolean): void {
  kvkkAccepted = value;
}

/** Degeri okur ve ayni anda false'a resetler (bir sonraki kayit denemesine sizmasin diye). */
export function consumeKvkkAccepted(): boolean {
  const value = kvkkAccepted;
  kvkkAccepted = false;
  return value;
}
