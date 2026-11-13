import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Bildirimler ekranının en son ne zaman açıldığını telefonda saklar. Zildeki
 * sayı sadece bu zamandan SONRA gelen şoför bildirimlerini sayar; bakım/vize
 * hatırlatmaları ise o gün ekran açılmadıysa sayılır (her gün yeniden).
 */
const KEY = 'notifications_last_seen_at';

export async function getNotificationsLastSeen(): Promise<Date | null> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v ? new Date(v) : null;
  } catch {
    return null;
  }
}

export async function markNotificationsSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, new Date().toISOString());
  } catch {
    // önemli değil
  }
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Zilde gösterilecek okunmamış bildirim sayısı. */
export function countUnread(
  alerts: { created_at: string }[],
  reminderCount: number,
  lastSeen: Date | null
): number {
  const newAlerts = lastSeen ? alerts.filter((a) => new Date(a.created_at) > lastSeen).length : alerts.length;
  const remindersUnseen = lastSeen && sameDay(lastSeen, new Date()) ? 0 : reminderCount;
  return newAlerts + remindersUnseen;
}
