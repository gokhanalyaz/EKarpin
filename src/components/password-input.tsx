import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
};

/** Sifre giris alani, sag tarafta goster/gizle metniyle. */
export function PasswordInput({ value, onChangeText, placeholder }: Props) {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);

  return (
    <View style={[styles.row, { borderColor: theme.backgroundSelected }]}>
      <TextInput
        style={[styles.input, { color: theme.text }]}
        placeholder={placeholder ?? 'Şifre'}
        placeholderTextColor={theme.textSecondary}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="number-pad"
        value={value}
        onChangeText={(text) => onChangeText(text.replace(/\D/g, ''))}
      />
      <Pressable onPress={() => setVisible((v) => !v)} hitSlop={8}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.toggle}>
          {visible ? 'Gizle' : 'Göster'}
        </ThemedText>
      </Pressable>
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
  input: {
    flex: 1,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  toggle: {
    marginLeft: Spacing.two,
  },
});
