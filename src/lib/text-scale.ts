import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

/** Uygulama içi yazı boyutu: büyük punto isteyenler için. */
export type TextScale = 'normal' | 'large' | 'xlarge';

export const TEXT_SCALE_FACTORS: Record<TextScale, number> = {
  normal: 1,
  large: 1.15,
  xlarge: 1.3,
};

export const TEXT_SCALE_LABELS: Record<TextScale, string> = {
  normal: 'Normal',
  large: 'Büyük',
  xlarge: 'Çok Büyük',
};

const STORAGE_KEY = 'text_scale';
let current: TextScale = 'normal';
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function getTextScale(): TextScale {
  return current;
}

export async function setTextScale(scale: TextScale): Promise<void> {
  current = scale;
  emit();
  try {
    await AsyncStorage.setItem(STORAGE_KEY, scale);
  } catch {
    // Kaydedilemese de bu oturumda geçerli olur.
  }
}

/** Uygulama açılışında kayıtlı yazı boyutunu yükler. */
export async function loadStoredTextScale(): Promise<void> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEY);
    if (value === 'large' || value === 'xlarge' || value === 'normal') {
      current = value;
      emit();
    }
  } catch {
    // varsayılan: normal
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Seçili yazı boyutu (değişince bileşen yeniden çizilir). */
export function useTextScale(): TextScale {
  return useSyncExternalStore(subscribe, getTextScale, getTextScale);
}

/** Seçili yazı boyutunun çarpanı (1, 1.15, 1.3). */
export function useTextScaleFactor(): number {
  return TEXT_SCALE_FACTORS[useTextScale()];
}
