import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { getOwnerPushToken, sendPushNotification } from '@/lib/notifications';
import { getSuggestedOpeningKm, openShift } from '@/lib/shifts';
import type { Vehicle } from '@/lib/vehicles';

type Props = {
  vehicle: Vehicle;
  onOpened: () => void;
};

export function ShiftOpenForm({ vehicle, onOpened }: Props) {
  const theme = useTheme();
  const { profile } = useAuth();
  const [km, setKm] = useState('');
  const [suggestedKm, setSuggestedKm] = useState<number | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getSuggestedOpeningKm(vehicle.id)
      .then((value) => {
        if (value != null) {
          setSuggestedKm(value);
          setKm(String(value));
        }
      })
      .catch(() => {});
  }, [vehicle.id]);

  async function handleTakePhoto() {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('İzin gerekli', 'Km fotoğrafı çekebilmek için kamera izni vermelisin.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.6,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (e) {
      Alert.alert('Fotoğraf alınamadı', 'Kamera açılırken bir sorun oluştu, fotoğrafsız devam edebilirsin.');
    }
  }

  async function handleStart() {
    const kmValue = Number(km.replace(',', '.'));
    if (!km || Number.isNaN(kmValue) || kmValue < 0) {
      Alert.alert('Km gerekli', 'Geçerli bir açılış km değeri girin.');
      return;
    }
    if (!profile) return;

    setSubmitting(true);
    try {
      let photoError: string | null = null;
      const openedShift = await openShift(
        {
          vehicleId: vehicle.id,
          driverId: profile.id,
          paymentModel: vehicle.payment_model,
          openingKm: kmValue,
          photoUri,
        },
        { onPhotoError: (message) => { photoError = message; } }
      );

      if (photoError) {
        Alert.alert('Fotoğraf Yüklenemedi', `Vardiya başladı ama fotoğraf sunucuya yüklenemedi:\n${photoError}`);
      }

      getOwnerPushToken(vehicle.id)
        .then((token) => {
          if (!token) return;
          const driverName = profile?.full_name ?? 'Bir şoför';
          return sendPushNotification(
            token,
            'Karpin Açıldı',
            `${driverName}, ${vehicle.plate_no} plakalı aracın karpinini açtı.`,
            { type: 'shift_opened', shiftId: openedShift.id, vehicleId: vehicle.id }
          );
        })
        .catch(() => {});

      onOpened();
    } catch (e: any) {
      Alert.alert('Vardiya başlatılamadı', e?.message ?? 'Bilinmeyen hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Vardiya Aç
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={{ opacity: 0.4 }}>
        build-check: PD-04
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {vehicle.plate_no}
      </ThemedText>

      <ThemedText type="eyebrow" style={styles.sectionTitle}>
        Açılış Km
      </ThemedText>
      {suggestedKm != null && (
        <ThemedText type="small" themeColor="textSecondary">
          Önceki vardiyanın kapanış km&apos;si: {suggestedKm}. Doğruysa onaylayabilir, farklıysa
          düzeltebilirsin.
        </ThemedText>
      )}
      <TextInput
        style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
        placeholder="Örn. 125430"
        placeholderTextColor={theme.textSecondary}
        keyboardType="number-pad"
        value={km}
        onChangeText={setKm}
      />

      <ThemedText type="eyebrow" style={styles.sectionTitle}>
        Km Sayacı Fotoğrafı
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
        İsteğe bağlı — sadece kameradan çekilebilir, galeriden yükleme yapılamaz.
      </ThemedText>
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={styles.preview} />
      ) : null}
      <Pressable
        style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
        onPress={handleTakePhoto}>
        <ThemedText type="linkPrimary">
          {photoUri ? 'Fotoğrafı Yeniden Çek' : 'Fotoğraf Çek'}
        </ThemedText>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.button, (submitting || pressed) && styles.buttonPressed]}
        onPress={handleStart}
        disabled={submitting}>
        <ThemedText style={styles.buttonText}>
          {submitting ? 'Başlatılıyor...' : 'Vardiyayı Başlat'}
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  title: { fontSize: 28, lineHeight: 34 },
  sectionTitle: { marginTop: Spacing.four },
  hint: { marginBottom: Spacing.one },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  preview: { width: '100%', height: 200, borderRadius: Spacing.two, marginTop: Spacing.two },
  secondaryButton: { alignItems: 'center', marginTop: Spacing.two, paddingVertical: Spacing.two },
  button: {
    backgroundColor: Brand.primary,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.four,
  },
  buttonPressed: { opacity: 0.7 },
  buttonText: { color: Brand.onPrimary, fontWeight: '700', fontSize: 16 },
});
