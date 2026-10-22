import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { SafeScreen } from '@/components/safe-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { createVehicle, deleteVehicle, uploadVehicleRegistration, type PaymentModel } from '@/lib/vehicles';

/**
 * Araç ekleme: ruhsat fotoğrafı ZORUNLU (çekilmeden/seçilmeden araç
 * eklenemez). Fotoğraf 'vehicle-documents' depolamasına, sadece araç
 * sahibinin görebileceği şekilde yüklenir. Yükleme başarısız olursa araç
 * kaydı geri alınır - ruhsatsız araç kalmasın.
 *
 * İleride (henüz yapılmadı): ruhsattan plakanın otomatik okunması (OCR),
 * "35T" ile başlamayan plakaların reddedilmesi, sigorta vb. diğer belgeler.
 */
export default function AddVehicleScreen() {
  const theme = useTheme();
  const { profile } = useAuth();
  const [plateNo, setPlateNo] = useState('');
  const [paymentModel, setPaymentModel] = useState<PaymentModel>('percentage');
  const [percentageRate, setPercentageRate] = useState('25');
  const [kmRate, setKmRate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [registrationUri, setRegistrationUri] = useState<string | null>(null);

  async function takeRegistrationPhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Kamera izni gerekli', 'Ruhsatın fotoğrafını çekebilmek için kamera izni vermelisin.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: false });
    if (!result.canceled && result.assets[0]) setRegistrationUri(result.assets[0].uri);
  }

  async function pickRegistrationPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled && result.assets[0]) setRegistrationUri(result.assets[0].uri);
  }

  async function handleSave() {
    if (!profile) return;

    if (!plateNo.trim()) {
      Alert.alert('Eksik bilgi', 'Plaka girin.');
      return;
    }
    if (paymentModel === 'km_based' && !kmRate.trim()) {
      Alert.alert('Eksik bilgi', 'Km başına ücret girin.');
      return;
    }
    if (!registrationUri) {
      Alert.alert('Ruhsat gerekli', 'Aracı ekleyebilmek için ruhsatın fotoğrafını çekmen ya da galeriden seçmen gerekiyor.');
      return;
    }

    setSubmitting(true);
    try {
      const vehicle = await createVehicle({
        ownerId: profile.id,
        plateNo,
        paymentModel,
        percentageRate:
          paymentModel === 'percentage' ? Number(percentageRate.replace(',', '.')) : undefined,
        kmRate: paymentModel === 'km_based' ? Number(kmRate.replace(',', '.')) : undefined,
      });
      try {
        await uploadVehicleRegistration(vehicle.id, registrationUri);
      } catch (uploadError) {
        // Ruhsat yüklenemediyse aracı da geri al (ruhsatsız araç kalmasın).
        await deleteVehicle(vehicle.id).catch(() => {});
        throw uploadError;
      }
      router.back();
    } catch (e: any) {
      Alert.alert('Kaydedilemedi', e?.message ?? 'Bilinmeyen hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeScreen>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <ThemedText type="title" style={styles.title}>
          Araç Ekle
        </ThemedText>

        <ThemedText type="smallBold">Ruhsat Fotoğrafı (zorunlu)</ThemedText>
        {registrationUri ? (
          <ThemedView style={styles.transparentBg}>
            <Image source={{ uri: registrationUri }} style={styles.registrationPreview} resizeMode="cover" />
            <ThemedView style={[styles.photoActions, styles.transparentBg]}>
              <Pressable onPress={takeRegistrationPhoto} hitSlop={8}>
                <ThemedText type="linkPrimary">Yeniden Çek</ThemedText>
              </Pressable>
              <Pressable onPress={pickRegistrationPhoto} hitSlop={8}>
                <ThemedText type="linkPrimary">Galeriden Değiştir</ThemedText>
              </Pressable>
            </ThemedView>
          </ThemedView>
        ) : (
          <ThemedView style={[styles.photoButtonsRow, styles.transparentBg]}>
            <Pressable
              style={({ pressed }) => [styles.photoButton, { borderColor: theme.backgroundSelected }, pressed && styles.buttonPressed]}
              onPress={takeRegistrationPhoto}>
              <SymbolView name="camera.fill" size={26} tintColor={theme.text} />
              <ThemedText type="smallBold">Fotoğraf Çek</ThemedText>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.photoButton, { borderColor: theme.backgroundSelected }, pressed && styles.buttonPressed]}
              onPress={pickRegistrationPhoto}>
              <SymbolView name="photo.on.rectangle" size={26} tintColor={theme.text} />
              <ThemedText type="smallBold">Galeriden Seç</ThemedText>
            </Pressable>
          </ThemedView>
        )}

        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
          placeholder="Plaka (örn. 35 ABC 123)"
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="characters"
          value={plateNo}
          onChangeText={setPlateNo}
        />

        <ThemedText type="smallBold">Çalışma Sistemi</ThemedText>
        <ThemedView style={styles.roleRow}>
          <Pressable
            style={[
              styles.roleButton,
              { borderColor: theme.backgroundSelected },
              paymentModel === 'percentage' && styles.roleButtonActive,
            ]}
            onPress={() => setPaymentModel('percentage')}>
            <ThemedText style={paymentModel === 'percentage' ? styles.roleTextActive : undefined}>
              Yüzdelik
            </ThemedText>
          </Pressable>
          <Pressable
            style={[
              styles.roleButton,
              { borderColor: theme.backgroundSelected },
              paymentModel === 'km_based' && styles.roleButtonActive,
            ]}
            onPress={() => setPaymentModel('km_based')}>
            <ThemedText style={paymentModel === 'km_based' ? styles.roleTextActive : undefined}>
              Km Sistemi
            </ThemedText>
          </Pressable>
        </ThemedView>

        {paymentModel === 'percentage' ? (
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
            placeholder="Şoför payı (%)"
            placeholderTextColor={theme.textSecondary}
            keyboardType="numeric"
            value={percentageRate}
            onChangeText={setPercentageRate}
          />
        ) : (
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
            placeholder="Km başına ücret (TL)"
            placeholderTextColor={theme.textSecondary}
            keyboardType="numeric"
            value={kmRate}
            onChangeText={setKmRate}
          />
        )}

        <Pressable
          style={({ pressed }) => [styles.button, (submitting || pressed) && styles.buttonPressed]}
          onPress={handleSave}
          disabled={submitting}>
          <ThemedText style={styles.buttonText}>
            {submitting ? 'Kaydediliyor...' : 'Kaydet'}
          </ThemedText>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.three },
  title: { marginBottom: Spacing.two, textAlign: 'center' },
  transparentBg: { backgroundColor: 'transparent' },
  photoButtonsRow: { flexDirection: 'row', gap: Spacing.two },
  photoButton: {
    flex: 1,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  registrationPreview: { width: '100%', height: 190, borderRadius: Spacing.three },
  photoActions: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.five, marginTop: Spacing.two },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  roleRow: { flexDirection: 'row', gap: Spacing.two },
  roleButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  roleButtonActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  roleTextActive: { color: Brand.onPrimary, fontWeight: '700' },
  button: {
    backgroundColor: Brand.primary,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  buttonPressed: { opacity: 0.7 },
  buttonText: { color: Brand.onPrimary, fontWeight: '700', fontSize: 16 },
});
