import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { getOwnerPushToken, sendPushNotification } from '@/lib/notifications';
import { createVehicleAlert } from '@/lib/vehicle-alerts';
import type { Vehicle } from '@/lib/vehicles';

type Props = {
  vehicle: Vehicle;
  shiftId: string;
  onClose: () => void;
};

/**
 * Vardiya kapanmasini beklemeden, sofor araç sahibine anlik bir not/uyari
 * gonderebilsin diye (ör. "araç arızalı", "kaza oldu"). Karpin akisindan
 * bagimsiz, kalici olarak kaydedilen ekstra bir bildirim.
 */
export function VehicleAlertForm({ vehicle, shiftId, onClose }: Props) {
  const theme = useTheme();
  const { profile } = useAuth();
  const [note, setNote] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function handleTakePhoto() {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('İzin gerekli', 'Fotoğraf çekebilmek için kamera izni vermelisin.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: false });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (e) {
      Alert.alert('Fotoğraf alınamadı', 'Kamera açılırken bir sorun oluştu.');
    }
  }

  async function handleSend() {
    if (!note.trim()) {
      Alert.alert('Not gerekli', 'Araç sahibine ne bildirmek istediğini yaz.');
      return;
    }
    if (!profile) return;

    setSending(true);
    try {
      await createVehicleAlert({
        vehicleId: vehicle.id,
        driverId: profile.id,
        shiftId,
        note: note.trim(),
        photoUri,
      });

      getOwnerPushToken(vehicle.id)
        .then((token) => {
          if (!token) return;
          const driverName = profile?.full_name ?? 'Bir şoför';
          return sendPushNotification(
            token,
            '⚠️ Araç Bildirimi',
            `${driverName} (${vehicle.plate_no}): ${note.trim()}`,
            { type: 'vehicle_alert', vehicleId: vehicle.id }
          );
        })
        .catch(() => {});

      Alert.alert('Gönderildi', 'Araç sahibine bildirimin iletildi.', [{ text: 'Tamam', onPress: onClose }]);
    } catch (e: any) {
      Alert.alert('Gönderilemedi', e?.message ?? 'Bilinmeyen hata oluştu.');
    } finally {
      setSending(false);
    }
  }

  return (
    <ThemedView type="backgroundElement" style={styles.container}>
      <ThemedText type="eyebrow">Araç Sahibine Bildir</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
        Örn. araç arızalı, kaza oldu, lastik patladı gibi acil durumları buradan bildirebilirsin.
      </ThemedText>
      <TextInput
        style={[
          styles.input,
          { color: theme.text, borderColor: theme.backgroundSelected },
        ]}
        placeholder="Ne bildirmek istiyorsun?"
        placeholderTextColor={theme.textSecondary}
        value={note}
        onChangeText={setNote}
        multiline
      />

      {photoUri ? <Image source={{ uri: photoUri }} style={styles.preview} /> : null}
      <Pressable
        style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
        onPress={handleTakePhoto}>
        <ThemedText type="linkPrimary">
          {photoUri ? 'Fotoğrafı Yeniden Çek' : '+ Fotoğraf Ekle (isteğe bağlı)'}
        </ThemedText>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.button, (sending || pressed) && styles.buttonPressed]}
        onPress={handleSend}
        disabled={sending}>
        <ThemedText style={styles.buttonText}>{sending ? 'Gönderiliyor...' : 'Gönder'}</ThemedText>
      </Pressable>
      <Pressable style={styles.cancelButton} onPress={onClose}>
        <ThemedText type="small" themeColor="textSecondary">
          Vazgeç
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.two, marginTop: Spacing.three },
  hint: { marginTop: -Spacing.one },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  preview: { width: '100%', height: 160, borderRadius: Spacing.two },
  secondaryButton: { alignItems: 'center', paddingVertical: Spacing.two },
  button: {
    backgroundColor: '#DC2626',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  cancelButton: { alignItems: 'center', paddingVertical: Spacing.one },
  buttonPressed: { opacity: 0.7 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
