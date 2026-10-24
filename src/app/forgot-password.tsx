import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, TextInput } from 'react-native';

import { PasswordInput } from '@/components/password-input';
import { PhoneInput } from '@/components/phone-input';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { friendlyError } from '@/lib/errors';
import { normalizePhone } from '@/lib/format';
import { supabase } from '@/lib/supabase';

const SUPPORT_WHATSAPP_URL = 'https://wa.me/905422498372';

/**
 * Şifremi Unuttum: telefona SMS ile 6 haneli kod gelir, kod + yeni şifre
 * girilir. SMS servisi henüz açık değilse (veya günlük sınır dolduysa)
 * kullanıcı WhatsApp destek hattına yönlendirilir.
 */
export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function askWhatsApp(message: string) {
    Alert.alert('Şifreni sıfırlayalım', message, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: "WhatsApp'tan Yaz", onPress: () => Linking.openURL(SUPPORT_WHATSAPP_URL).catch(() => {}) },
    ]);
  }

  async function sendCode() {
    if (phone.length !== 10) {
      Alert.alert('Eksik bilgi', 'Telefon numaranı eksiksiz gir.');
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('request_password_reset', { p_phone: normalizePhone(phone) });
      if (error) {
        // Sunucu tarafı henüz kurulmadıysa WhatsApp'a yönlendir.
        askWhatsApp("Destek ekibimize WhatsApp'tan yaz, şifreni hemen sıfırlayalım.");
        return;
      }
      switch (data as string) {
        case 'sent':
          setStep('code');
          Alert.alert('Kod gönderildi', 'Telefonuna gelen 6 haneli kodu gir. Kod 10 dakika geçerli.');
          break;
        case 'not_found':
          Alert.alert('Hesap bulunamadı', 'Bu telefon numarasıyla kayıtlı bir hesap bulunamadı.');
          break;
        case 'too_soon':
          Alert.alert('Biraz bekle', 'Yeni kod istemek için 1 dakika beklemen gerekiyor.');
          break;
        case 'limit':
          askWhatsApp("Bugün çok fazla kod istendi. Destek ekibimize WhatsApp'tan yaz, şifreni sıfırlayalım.");
          break;
        default:
          askWhatsApp("Destek ekibimize WhatsApp'tan yaz, şifreni hemen sıfırlayalım.");
      }
    } catch (e) {
      Alert.alert('Bir sorun oluştu', friendlyError(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function confirm() {
    if (code.trim().length !== 6) {
      Alert.alert('Kod eksik', 'Telefonuna gelen 6 haneli kodu gir.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Şifre çok kısa', 'Yeni şifre en az 6 karakter olmalı.');
      return;
    }
    if (password !== password2) {
      Alert.alert('Şifreler eşleşmiyor', 'Girdiğin iki şifre aynı olmalı.');
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('confirm_password_reset', {
        p_phone: normalizePhone(phone),
        p_code: code.trim(),
        p_new_password: password,
      });
      if (error) throw error;
      switch (data as string) {
        case 'ok':
          Alert.alert('Şifren değişti', 'Yeni şifrenle giriş yapabilirsin.', [
            { text: 'Tamam', onPress: () => router.replace('/login') },
          ]);
          break;
        case 'expired':
          Alert.alert('Kodun süresi doldu', 'Lütfen yeni bir kod iste.');
          setStep('phone');
          setCode('');
          break;
        case 'too_many':
          Alert.alert('Çok fazla deneme', 'Lütfen yeni bir kod iste.');
          setStep('phone');
          setCode('');
          break;
        case 'weak':
          Alert.alert('Şifre çok kısa', 'Yeni şifre en az 6 karakter olmalı.');
          break;
        default:
          Alert.alert('Kod hatalı', 'Girdiğin kod doğru değil, tekrar kontrol et.');
      }
    } catch (e) {
      Alert.alert('Bir sorun oluştu', friendlyError(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ThemedView style={styles.container}>
        <ThemedText type="title" style={styles.title}>
          Şifremi Unuttum
        </ThemedText>

        {step === 'phone' ? (
          <>
            <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
              Telefon numaranı gir, sana SMS ile 6 haneli bir kod gönderelim.
            </ThemedText>
            <PhoneInput value={phone} onChangeText={setPhone} />
            <Pressable
              style={({ pressed }) => [styles.button, (submitting || pressed) && styles.buttonPressed]}
              onPress={sendCode}
              disabled={submitting}>
              <ThemedText style={styles.buttonText}>{submitting ? 'Gönderiliyor...' : 'Kod Gönder'}</ThemedText>
            </Pressable>
          </>
        ) : (
          <>
            <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
              Telefonuna gelen kodu ve yeni şifreni gir.
            </ThemedText>
            <TextInput
              style={[styles.codeInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
              placeholder="6 haneli kod"
              placeholderTextColor={theme.textSecondary}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              maxLength={6}
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, ''))}
            />
            <PasswordInput value={password} onChangeText={setPassword} placeholder="Yeni şifre (en az 6 karakter)" />
            <PasswordInput value={password2} onChangeText={setPassword2} placeholder="Yeni şifre (tekrar)" />
            <Pressable
              style={({ pressed }) => [styles.button, (submitting || pressed) && styles.buttonPressed]}
              onPress={confirm}
              disabled={submitting}>
              <ThemedText style={styles.buttonText}>{submitting ? 'Kaydediliyor...' : 'Şifremi Değiştir'}</ThemedText>
            </Pressable>
            <Pressable style={styles.link} onPress={sendCode} disabled={submitting}>
              <ThemedText type="linkPrimary">Kodu tekrar gönder</ThemedText>
            </Pressable>
          </>
        )}

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
  codeInput: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
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
  link: { alignSelf: 'center', marginTop: Spacing.two },
});
