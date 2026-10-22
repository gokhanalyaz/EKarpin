import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Ortak seçim/onay penceresi - iPhone'un kendi alt pencereleri (bottom
 * sheet) gibi ekranın altından açılır. Eskiden ekranın ortasında sabit
 * genişlikte bir kart olduğu için uzun içerikte (örn. "Şoförü Kaldır",
 * "Kaç Gün Görsün?") ekrana sığmıyordu; artık tam genişlikte, içerik
 * uzunsa kaydırılabiliyor, klavye açılınca yukarı itiliyor.
 *
 * Arka plana dokunmak, sağ üstteki X veya Android geri tuşu her zaman
 * onClose'u tetikler - hiçbir aksiyon uygulanmadan güvenle kapanır.
 */
export function ActionSheetModal({
  visible,
  onClose,
  title,
  description,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Kapat" />
        <View style={[styles.sheet, { backgroundColor: theme.card, paddingBottom: insets.bottom + Spacing.three }]}>
          <View style={[styles.grabber, { backgroundColor: theme.separator }]} />
          <View style={styles.header}>
            <View style={styles.closeSpacer} />
            <ThemedText type="subtitle" style={styles.title}>
              {title}
            </ThemedText>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={[styles.closeButton, { backgroundColor: theme.subtleFill }]}
              accessibilityLabel="Kapat">
              <SymbolView name="xmark" size={13} tintColor={theme.textSecondary} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={false}>
            {description ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.description}>
                {description}
              </ThemedText>
            ) : null}
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    width: '100%',
    maxHeight: '88%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: Spacing.two },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.two },
  closeSpacer: { width: 30 },
  title: { flex: 1, textAlign: 'center' },
  closeButton: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 0 },
  content: { gap: Spacing.two, paddingBottom: Spacing.two },
  description: { textAlign: 'center', marginBottom: Spacing.one },
});
