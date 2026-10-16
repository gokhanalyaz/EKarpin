import { useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { getSignedPhotoUrl } from '@/lib/shifts';

type Props = {
  path: string;
  label?: string;
  /** true ise metin yerine kucuk bir fotograf ikonu gosterir (DetailRow'un yanina gomulu kullanim icin). */
  iconOnly?: boolean;
};

/** Private storage'daki bir fotografi (imzali link uretip) tam ekran gosteren buton. */
export function PhotoViewButton({ path, label, iconOnly }: Props) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function handleOpen() {
    setVisible(true);
    setLoading(true);
    setFailed(false);
    try {
      const signed = await getSignedPhotoUrl(path);
      if (signed) {
        setUrl(signed);
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Pressable
        hitSlop={8}
        style={({ pressed }) => [iconOnly ? styles.iconButton : styles.button, pressed && styles.pressed]}
        onPress={handleOpen}>
        {iconOnly ? (
          <SymbolView name="photo" size={16} tintColor="#8A5B00" />
        ) : (
          <ThemedText type="linkPrimary">{label}</ThemedText>
        )}
      </Pressable>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          {loading ? (
            <ActivityIndicator color="#fff" size="large" />
          ) : failed || !url ? (
            <ThemedText style={styles.errorText}>Fotoğraf yüklenemedi.</ThemedText>
          ) : (
            <Image source={{ uri: url }} style={styles.image} resizeMode="contain" />
          )}
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: { paddingVertical: 8 },
  iconButton: { paddingHorizontal: 4, paddingVertical: 2 },
  pressed: { opacity: 0.6 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '85%' },
  errorText: { color: '#fff' },
});
