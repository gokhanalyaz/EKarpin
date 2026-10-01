import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet } from 'react-native';

import { PhoneInput } from '@/components/phone-input';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { normalizePhone } from '@/lib/format';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordScreen() {
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSend() {
    if (phone.length !== 10) {
      Alert.alert('Eksik bilgi', 'Telefon numarasını eksiksiz girin.');
      return;
    }

    setSubmitting(true);

    const { data: foundEmail, error: lookupError } = await supabase.rpc('get_email_by_phone', {
      p_phone: normalizePhone(phone),
    });
    if (lookupError || !foundEmail) {
      setSubmitting(false);
      Alert.alert('Hesap bulunamadı', 'Bu telefon numarasıyla kayıtlı bir hesap bulunamadı.');
      return;
    }

    // Uygulama uzerinden acilan yeni hesaplarda gercek bir e-posta kutusu
    // olmadigi icin (bkz. signup.tsx), o hesaplar icin otomatik e-posta ile
    // sifirlama calismiyor. Bu durumda kullaniciyi yonlendiriyoruz.
    if (foundEmail.endsWith('@dijitalkarpin.app')) {
      setSubmitting(false);
      Alert.alert(
        'Otomatik sıfırlama şu an yok',
        'Bu hesap için şifre sıfırlama bağlantısı otomatik gönderilemiyor. Lütfen uygulama sahibiyle iletişime geç, şifreni elle sıfırlasın.'
      );
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(foundEmail, {
      redirectTo: 'dijitalkarpin://reset-password',
    });
    setSubmitting(false);

    if (error) {
      Alert.alert('Bir sorun oluştu', error.message);
      return;
    }

    Alert.alert(
      'E-posta gönderildi',
      'Şifreni sıfırlamak için sana gönderdiğimiz e-postadaki bağlantıya tıkla. Bağlantı doğrudan uygulamayı açacak.',
      [{ text: 'Tamam', onPress: () => router.replace('/login') }]
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ThemedView style={styles.container}>
        <ThemedText type="title" style={styles.title}>
          Parolamı Unuttum
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
          Hesabına kayıtlı telefon numaranı gir, sana bir sıfırlama bağlantısı gönderelim.
        </ThemedText>

        <PhoneInput value={phone} onChangeText={setPhone} />

        <Pressable
          style={({ pressed }) => [styles.button, (submitting || pressed) && styles.buttonPressed]}
          onPress={handleSend}
          disabled={submitting}>
          <ThemedText style={styles.buttonText}>
            {submitting ? 'Gönderiliyor...' : 'Sıfırlama Bağlantısı Gönder'}
          </ThemedText>
        </Pressable>

        <Link href="/login" style={styles.link}>
          <ThemedText type="linkPrimary">Girişe geri dön</ThemedText>
        </Link>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', marginBottom: Spacing.two },
  button: {
    backgroundColor: Brand.primary,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  buttonPressed: { opacity: 0.7 },
  buttonText: { color: Brand.onPrimary, fontWeight: '700', fontSize: 16 },
  link: { alignSelf: 'center', marginTop: Spacing.three },
});
