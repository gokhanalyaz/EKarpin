import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet } from 'react-native';

import { PasswordInput } from '@/components/password-input';
import { PhoneInput } from '@/components/phone-input';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { normalizePhone } from '@/lib/format';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const theme = useTheme();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin() {
    if (phone.length !== 10 || !password) {
      Alert.alert('Eksik bilgi', 'Telefon numarası ve şifre girin.');
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

    const { error } = await supabase.auth.signInWithPassword({
      email: foundEmail,
      password,
    });
    setSubmitting(false);
    if (error) {
      Alert.alert('Giriş başarısız', error.message);
      return;
    }
    router.replace('/');
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <ThemedView style={styles.container}>
        <ThemedText type="title" style={styles.title}>
          Dijital Karpin
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
          Hesabınıza giriş yapın
        </ThemedText>

        <PhoneInput value={phone} onChangeText={setPhone} />

        <PasswordInput value={password} onChangeText={setPassword} placeholder="Şifre" />

        <Link href="/forgot-password" style={styles.forgotLink}>
          <ThemedText type="small" themeColor="textSecondary">
            Parolamı unuttum
          </ThemedText>
        </Link>

        <Pressable
          style={({ pressed }) => [styles.button, (submitting || pressed) && styles.buttonPressed]}
          onPress={handleLogin}
          disabled={submitting}>
          <ThemedText style={styles.buttonText}>
            {submitting ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </ThemedText>
        </Pressable>

        <Link href="/signup" style={styles.link}>
          <ThemedText type="linkPrimary">Hesabın yok mu? Kayıt ol</ThemedText>
        </Link>
      </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center' },
  container: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.six,
    gap: Spacing.three,
  },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', marginBottom: Spacing.three },
  forgotLink: { alignSelf: 'flex-end', marginTop: -Spacing.two },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
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
