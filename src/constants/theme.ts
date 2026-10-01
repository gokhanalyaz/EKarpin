/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    // Soguk gri yerine marka sarisindan gelen sicak bir krem tonu -
    // kartlar (arac listesi, ozet kutulari, form kutulari) artik
    // "sade gri kutu" gibi degil, kendine ait bir karakteri var.
    backgroundElement: '#FBF3DF',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#241F14',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * Marka paleti: taksi sarisi + siyah. Birincil aksiyon butonlari,
 * secili durumlar ve vurgular bu renkleri kullanir (acik/koyu tema
 * farki yok - marka rengi sabit kalir).
 */
export const Brand = {
  primary: '#FFC400',
  primaryPressed: '#E0AC00',
  onPrimary: '#171717',
} as const;

/**
 * Ozel yazi tipi aileleri (Google Fonts: Archivo + Inter, _layout.tsx'te
 * useFonts ile yukleniyor). Basliklarda Archivo (kalin/iddiali), govde
 * metninde Inter (ince/okunakli) kullaniliyor - Netflix/Zara karisimi his.
 */
export const FontFamily = {
  displayBlack: 'Archivo_900Black',
  displayBold: 'Archivo_800ExtraBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
