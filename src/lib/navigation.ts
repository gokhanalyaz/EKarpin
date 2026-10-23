import { router } from 'expo-router';

/** Geri gidilecek ekran varsa geri gider, yoksa (örn. bildirimden açıldıysa) ana sayfaya döner. */
export function goBackOrHome(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/home');
}
