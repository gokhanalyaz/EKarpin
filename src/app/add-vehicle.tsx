import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { createVehicle, type PaymentModel } from '@/lib/vehicles';

export default function AddVehicleScreen() {
  const theme = useTheme();
  const { profile } = useAuth();
  const [plateNo, setPlateNo] = useState('');
  const [paymentModel, setPaymentModel] = useState<PaymentModel>('percentage');
  const [percentageRate, setPercentageRate] = useState('25');
  const [kmRate, setKmRate] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

    setSubmitting(true);
    try {
      await createVehicle({
        ownerId: profile.id,
        plateNo,
        paymentModel,
        percentageRate:
          paymentModel === 'percentage' ? Number(percentageRate.replace(',', '.')) : undefined,
        kmRate: paymentModel === 'km_based' ? Number(kmRate.replace(',', '.')) : undefined,
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Kaydedilemedi', e?.message ?? 'Bilinmeyen hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ThemedView style={styles.container}>
        <ThemedText type="title" style={styles.title}>
          Araç Ekle
        </ThemedText>

        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
          placeholder="Plaka (örn. 35 ABC 123)"
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="characters"
          value={plateNo}
          onChangeText={setPlateNo}
        />

        <ThemedText type="eyebrow">Çalışma Sistemi</ThemedText>
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
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing.four, paddingTop: Spacing.six, gap: Spacing.three },
  title: { marginBottom: Spacing.two },
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
