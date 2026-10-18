import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Apple "Ayarlar" uygulaması tarzı gruplu liste: beyaz, köşeleri yuvarlak
 * bir kart ve içinde ince çizgilerle ayrılmış satırlar.
 */
export function GroupCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.card }, style]}>{children}</View>;
}

type RowProps = {
  title: string;
  subtitle?: string;
  value?: string;
  right?: ReactNode;
  onPress?: () => void;
  /** Satırın altında ayırıcı çizgi olsun mu (son satırda false). */
  divider?: boolean;
  chevron?: boolean;
  destructive?: boolean;
  disabled?: boolean;
};

export function GroupRow({ title, subtitle, value, right, onPress, divider = true, chevron, destructive, disabled }: RowProps) {
  const theme = useTheme();
  const content = (
    <>
      <View style={styles.rowText}>
        <ThemedText style={destructive ? styles.destructive : undefined}>{title}</ThemedText>
        {subtitle ? (
          <ThemedText type="small" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {value ? (
        <ThemedText type="small" themeColor="textSecondary">
          {value}
        </ThemedText>
      ) : null}
      {right}
      {chevron ? <SymbolView name="chevron.right" size={14} tintColor={theme.textSecondary} /> : null}
    </>
  );
  const rowStyle = [
    styles.row,
    divider && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.separator },
    disabled && styles.disabled,
  ];
  if (!onPress) return <View style={rowStyle}>{content}</View>;
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [...rowStyle, pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

/** Kartın altında küçük gri açıklama (Apple'daki "footer" metni gibi). */
export function GroupFooter({ children }: { children: ReactNode }) {
  return (
    <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
      {children}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, overflow: 'hidden', marginTop: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    minHeight: 52,
  },
  rowText: { flex: 1, gap: 1 },
  destructive: { color: '#DC2626' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.6 },
  footer: { marginTop: Spacing.one, paddingHorizontal: Spacing.three, fontSize: 13, lineHeight: 18 },
});
