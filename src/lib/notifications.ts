import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Bildirim izni ister, Expo push token'ini alir. Simulator/emulator'de
 * ve izin verilmezse null doner.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== 'granted') {
    return null;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn('EAS projectId bulunamadı, push token alınamadı.');
    return null;
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data;
  } catch (e) {
    console.warn('Push token alınamadı', e);
    return null;
  }
}

/** Alinan push token'i kullanicinin profiline kaydeder. */
export async function savePushToken(userId: string, token: string): Promise<void> {
  const { error } = await supabase.from('profiles').update({ push_token: token }).eq('id', userId);
  if (error) console.warn('Push token kaydedilemedi', error);
}

/** Bir kullaniciya (push token'i biliniyorsa) Expo push servisi uzerinden bildirim gonderir. */
export async function sendPushNotification(
  toToken: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to: toToken, sound: 'default', title, body, data }),
    });
  } catch (e) {
    console.warn('Push bildirimi gönderilemedi', e);
  }
}

/** Bir kullanicinin (soforun/sahibin) kayitli push token'ini dogrudan id ile getirir. */
export async function getUserPushToken(userId: string): Promise<string | null> {
  const { data, error } = await supabase.from('profiles').select('push_token').eq('id', userId).maybeSingle();
  if (error || !data) return null;
  return (data as { push_token: string | null }).push_token ?? null;
}

/** Bir aracin sahibinin push token'ini getirir (kayitli degilse null). */
export async function getOwnerPushToken(vehicleId: string): Promise<string | null> {
  const { data: vehicle, error: vehicleError } = await supabase
    .from('vehicles')
    .select('owner_id')
    .eq('id', vehicleId)
    .single();
  if (vehicleError || !vehicle) return null;

  const { data: owner, error: ownerError } = await supabase
    .from('profiles')
    .select('push_token')
    .eq('id', vehicle.owner_id)
    .single();
  if (ownerError || !owner) return null;

  return (owner as { push_token: string | null }).push_token ?? null;
}
