import { Children, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, FontFamily, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code' | 'eyebrow';
  themeColor?: ThemeColor;
};

/**
 * Türkçe'ye uygun büyük harf: iOS'un textTransform:'uppercase'i cihaz
 * dilinden bağımsız çalıştığı için "i" harfini "I" yapıyordu (GIDER,
 * SISTEMI, TARIH gibi). Burada i→İ, ı→I elle çevriliyor.
 */
export function trUpper(s: string): string {
  return s.replace(/i/g, 'İ').replace(/ı/g, 'I').toUpperCase();
}

function upperChildren(children: ReactNode): ReactNode {
  return Children.map(children, (c) => (typeof c === 'string' ? trUpper(c) : c));
}

export function ThemedText({ style, type = 'default', themeColor, children, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        type === 'eyebrow' && styles.eyebrow,
        style,
      ]}
      {...rest}>
      {type === 'eyebrow' ? upperChildren(children) : children}
    </Text>
  );
}

const styles = StyleSheet.create({
  small: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
  },
  smallBold: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 14,
    lineHeight: 20,
  },
  default: {
    fontFamily: FontFamily.body,
    fontSize: 16,
    lineHeight: 24,
  },
  title: {
    fontFamily: FontFamily.displayBlack,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  eyebrow: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.4,
  },
  link: {
    fontFamily: FontFamily.body,
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    fontFamily: FontFamily.bodyBold,
    lineHeight: 30,
    fontSize: 14,
    color: '#8A5B00',
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
