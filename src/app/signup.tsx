import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
} from 'react-native';

import { PasswordInput } from '@/components/password-input';
import { PhoneInput } from '@/components/phone-input';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import type { UserRole } from '@/contexts/auth-context';
import { normalizePhone } from '@/lib/format';
import { consumeKvkkAccepted } from '@/lib/kvkk-consent';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

export default function SignupScreen() {
  const theme = useTheme();
  const [role, setRole] = useState<UserRole>('owner');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [kvkkAccepted, setKvkkAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (consumeKvkkAccepted()) {
        setKvkkAccepted(true);
      }
    }, [])
  );

  async function handleSignup() {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Eksik bilgi', 'Ad ve soyisim zorunlu.');
      return;
    }
    if (phone.length !== 10) {
      Alert.alert('Telefon numarası eksik', 'Telefon numaranı eksiksiz gir — bu numarayla giriş yapacaksın.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Şifre çok kısa', 'Şifre en az 6 karakter olmalı.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Şifreler eşleşmiyor', 'Girdiğin iki şifre aynı olmalı.');
      return;
    }
    if (!kvkkAccepted) {
      Alert.alert(
        'Onay gerekli',
        'Devam etmek için KVKK Aydınlatma Metni\'ni okuyup kabul etmen gerekiyor.'
      );
      return;
    }

    setSubmitting(true);
    const normalizedPhone = normalizePhone(phone);
    // Uygulamada e-posta alani yok; her hesap icin telefon numarasindan
    // turetilen sabit bir "sentetik" e-posta kullaniliyor (Supabase Auth
    // e-posta alanini zorunlu tuttugu icin).
    const syntheticEmail = `${normalizedPhone}@dijitalkarpin.app`;
    const fullName = `${firstName.trim()} ${lastName.trim()}`;

    const { error } = await supabase.auth.signUp({
      email: syntheticEmail,
      password,
      options: {
        data: {
          role,
          full_name: fullName,
          phone: normalizedPhone,
          kvkk_accepted_at: new Date().toISOString(),
        },
      },
    });
    setSubmitting(false);

    if (error) {
      if (error.message.toLowerCase().includes('already registered')) {
        Alert.alert('Kayıt başarısız', 'Bu telefon numarasıyla zaten bir hesap var.');
      } else {
        Alert.alert('Kayıt başarısız', error.message);
      }
      return;
    }
    router.replace('/');
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ThemedView style={styles.container}>
          <ThemedText type="title" style={styles.title}>
            Hesap Oluştur
          </ThemedText>

          <ThemedText type="eyebrow">Ben bir...</ThemedText>
          <ThemedView style={styles.roleRow}>
            <Pressable
              style={[
                styles.roleButton,
                { borderColor: theme.backgroundSelected },
                role === 'owner' && styles.roleButtonActive,
              ]}
              onPress={() => setRole('owner')}>
              <ThemedText style={role === 'owner' ? styles.roleTextActive : undefined}>
                Araç Sahibi
              </ThemedText>
            </Pressable>
            <Pressable
              style={[
                styles.roleButton,
                { borderColor: theme.backgroundSelected },
                role === 'driver' && styles.roleButtonActive,
              ]}
              onPress={() => setRole('driver')}>
              <ThemedText style={role === 'driver' ? styles.roleTextActive : undefined}>
                Şoför
              </ThemedText>
            </Pressable>
          </ThemedView>

          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
            placeholder="Ad"
            placeholderTextColor={theme.textSecondary}
            value={firstName}
            onChangeText={setFirstName}
          />
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
            placeholder="Soyisim"
            placeholderTextColor={theme.textSecondary}
            value={lastName}
            onChangeText={setLastName}
          />
          <PhoneInput value={phone} onChangeText={setPhone} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
            Bu numarayla giriş yapacaksın, doğru gir.
          </ThemedText>
          <PasswordInput value={password} onChangeText={setPassword} placeholder="Şifre (en az 6 karakter)" />
          <PasswordInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Şifre (tekrar)"
          />

          <Pressable style={styles.kvkkRow} onPress={() => router.push('/kvkk')}>
            <ThemedView
              style={[
                styles.checkbox,
                { borderColor: theme.backgroundSelected },
                kvkkAccepted && styles.checkboxChecked,
              ]}>
              {kvkkAccepted && <ThemedText style={styles.checkboxMark}>✓</ThemedText>}
            </ThemedView>
            <ThemedText type="small" style={styles.kvkkText}>
              <ThemedText type="linkPrimary" style={styles.kvkkLink}>
                KVKK Aydınlatma Metni
              </ThemedText>
              {"'ni okudum, kabul ediyorum."}
            </ThemedText>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.button, (submitting || pressed) && styles.buttonPressed]}
            onPress={handleSignup}
            disabled={submitting}>
            <ThemedText style={styles.buttonText}>
              {submitting ? 'Kayıt olunuyor...' : 'Kayıt Ol'}
            </ThemedText>
          </Pressable>

          <Link href="/login" style={styles.link}>
            <ThemedText type="linkPrimary">Zaten hesabın var mı? Giriş yap</ThemedText>
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
  title: { textAlign: 'center', marginBottom: Spacing.two },
  roleRow: { flexDirection: 'row', gap: Spacing.two },
  roleButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  roleButtonActive: {
    backgroundColor: Brand.primary,
    borderColor: Brand.primary,
  },
  roleTextActive: { color: Brand.onPrimary, fontWeight: '700' },
  hint: { marginTop: -Spacing.two },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  kvkkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: -Spacing.one,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderRadius: Spacing.one,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Brand.primary,
    borderColor: Brand.primary,
  },
  checkboxMark: { color: Brand.onPrimary, fontSize: 14, fontWeight: '700' },
  kvkkText: { flex: 1 },
  kvkkLink: { textDecorationLine: 'underline' },
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
