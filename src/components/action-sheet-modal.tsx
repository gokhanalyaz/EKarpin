import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

/**
 * Native Alert.alert zincirleri yerine kullanılan, geri gesture'ında veya
 * arka plana (backdrop) dokununca GÜVENLİ şekilde "vazgeç" sayan ortak
 * onay/seçim kartı. Alert.alert'te kullanıcı bir butona basmadan ekranı
 * kapatmaya çalışırsa (örn. geri kaydırma) tutarsız/takılı kalan bir
 * durum oluşabiliyordu - burada backdrop'a dokunmak veya Android geri
 * tuşu her zaman onClose'u tetikler, hiçbir aksiyon uygulanmaz.
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
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable onPress={() => {}}>
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="subtitle" style={styles.title}>
              {title}
            </ThemedText>
            {description ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.description}>
                {description}
              </ThemedText>
            ) : null}
            {children}
          </ThemedView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    width: 320,
    maxWidth: '100%',
    maxHeight: '80%',
    padding: Spacing.four,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  title: { textAlign: 'center' },
  description: { textAlign: 'center', marginBottom: Spacing.one },
});
