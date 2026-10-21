import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';

/** Gece/gündüz modu tercihi: telefona uy (otomatik), her zaman açık, her zaman koyu. */
export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'theme_preference';

function apply(pref: ThemePreference) {
  // Appearance.setColorScheme tüm uygulamanın (useColorScheme dahil)
  // rengini değiştirir; 'unspecified' telefonun kendi ayarına geri döner.
  Appearance.setColorScheme(pref === 'system' ? 'unspecified' : pref);
}

export async function getThemePreference(): Promise<ThemePreference> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

export async function setThemePreference(pref: ThemePreference): Promise<void> {
  apply(pref);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // Kaydedilemese de bu oturum için uygulanmış olur.
  }
}

/** Uygulama açılışında kayıtlı tercihi uygular. */
export async function applyStoredThemePreference(): Promise<void> {
  apply(await getThemePreference());
}
