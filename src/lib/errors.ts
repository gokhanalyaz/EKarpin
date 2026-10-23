/**
 * Supabase/veritabanı hatalarını kullanıcıya anlaşılır Türkçe mesaja çevirir.
 * Özellikle bir özellik için gereken veritabanı güncellemesi (SQL) henüz
 * çalıştırılmamışsa çıkan teknik İngilizce mesajı ("Could not find the
 * column ... in the schema cache") yakalar.
 */
export function friendlyError(e: unknown): string {
  const message = (e as { message?: string } | null)?.message ?? '';
  if (/schema cache|does not exist|could not find the .* column|function .* not found/i.test(message)) {
    return 'Bu özellik için sunucu tarafında bir güncelleme eksik. Lütfen biraz sonra tekrar dene veya Destek sekmesinden bize yaz.';
  }
  if (/network|fetch failed|timeout/i.test(message)) {
    return 'İnternet bağlantısı kurulamadı. Bağlantını kontrol edip tekrar dene.';
  }
  return message || 'Bilinmeyen bir hata oluştu.';
}
