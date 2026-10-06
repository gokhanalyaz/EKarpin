import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Brand, Spacing } from '@/constants/theme';

export type TabKey = 'home' | 'drivers' | 'history' | 'maintenance';

const TABS: { key: TabKey; label: string; icon: string; href: string }[] = [
  { key: 'home', label: 'Araçlarım', icon: '🚗', href: '/home' },
  { key: 'drivers', label: 'Şoförler', icon: '👤', href: '/drivers' },
  { key: 'history', label: 'Geçmiş', icon: '📋', href: '/history' },
  { key: 'maintenance', label: 'Bakım', icon: '🔧', href: '/maintenance' },
];

/**
 * Araç sahibi için tüm ana ekranlarda (Araçlarım, Şoförler, Geçmiş, Bakım)
 * aynı sekilde goruntulenen, alt kisma sabit menü. Expo Router tab-group
 * kullanmadan, her ana ekranin kendi icine (flex sibling olarak, ekranin
 * en altina) yerlestirdigi basit bir navigasyon cubugu - mevcut Stack
 * yapisini bozmadan tum ana ekranlarda tutarlilik saglar.
 */
export function BottomTabBar({ current }: { current: TabKey }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.background, borderTopColor: theme.backgroundSelected, paddingBottom: Spacing.two + insets.bottom },
      ]}>
      {TABS.map((tab) => {
        const active = tab.key === current;
        return (
          <Pressable
            key={tab.key}
            style={styles.tab}
            onPress={() => {
              if (!active) router.replace(tab.href as any);
            }}>
            <ThemedText style={styles.icon}>{tab.icon}</ThemedText>
            <ThemedText
              type="small"
              themeColor={active ? undefined : 'textSecondary'}
              style={[styles.label, active && { color: Brand.primaryPressed, fontWeight: '700' }]}>
              {tab.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: Spacing.two,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  icon: { fontSize: 20 },
  label: { fontSize: 12, lineHeight: 16 },
});
