import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Ekranın üstünü telefonun saat/kamera (Dynamic Island) alanının altından
 * başlatır. Böylece başlıklar ve kaydırılan içerik saatin/kameranın altına
 * girmez. Arka plan şeffaf - sayfanın kendi gri arka planı görünmeye
 * devam eder.
 */
export function SafeScreen({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return <View style={[styles.root, { paddingTop: insets.top }]}>{children}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
