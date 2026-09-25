import { StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  /** Sadece yerel rakamlar (basinda 0 veya 90 olmadan), en fazla 10 hane. */
  value: string;
  onChangeText: (digits: string) => void;
  placeholder?: string;
};

/** Basinda sabit "+90" onekiyle telefon numarasi giris alani. */
export function PhoneInput({ value, onChangeText, placeholder }: Props) {
  const theme = useTheme();

  return (
    <View style={[styles.row, { borderColor: theme.backgroundSelected }]}>
      <ThemedText style={styles.prefix}>+90</ThemedText>
      <TextInput
        style={[styles.input, { color: theme.text }]}
        placeholder={placeholder ?? '5xx xxx xx xx'}
        placeholderTextColor={theme.textSecondary}
        keyboardType="number-pad"
        maxLength={10}
        value={value}
        onChangeText={(text) => onChangeText(text.replace(/\D/g, '').slice(0, 10))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  prefix: { fontSize: 16, fontWeight: '700', marginRight: Spacing.one },
  input: { flex: 1, paddingVertical: Spacing.three, fontSize: 16 },
});
