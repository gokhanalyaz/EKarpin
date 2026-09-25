import { Link, router } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

function parseTokensFromUrl(url: string | null) {
  if (!url) return null;
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  const paramsString =
    hashIndex >= 0 ? url.slice(hashIndex + 1) : queryIndex >= 0 ? url.slice(queryIndex + 1) : '';
  if (!paramsString) return null;

  const params = new URLSearchParams(paramsString);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  const type = params.get('type');
  if (!access_token || !refresh_token) return null;
  return { access_token, refresh_token, type };
}

export default function ResetPasswordScreen() {
  const theme = useTheme();
  const [status, setStatus] = useState<'checking' | 'ready' | 'invalid'>('checking');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const handledRef = useRef(false);

  async function applyTokens(url: string | null) {
    if (handledRef.current) return;
    const tokens = parseTokensFromUrl(url);
    if (!tokens) {
      setStatus('invalid');
      return;
    }
    handledRef.current = true;
    const { error } = await supabase.auth.setSession({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    });
    setStatus(error ? 'invalid' : 'ready');
  }

  useEffect(() => {
    Linking.getInitialURL().then(applyTokens);
    const subscription = Linking.addEventListener('url', (event) => applyTokens(event.url));
    return () => subscription.remove();
  }, []);

  async function handleSubmit() {
    if (password.length < 6) {
      Alert.alert('Şifre çok kısa', 'Şifre en az 6 karakter olmalı.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Şifreler eşleşmiyor', 'Girdiğin iki şifre aynı olmalı.');
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (error) {
      Alert.alert('Bir sorun oluştu', error.message);
      return;
    }

    Alert.alert('Şifre güncellendi', 'Yeni şifrenle giriş yapıldı.', [
      { text: 'Tamam', onPress: () => router.replace('/') },
    ]);
  }

  if (status === 'checking') {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          Bağlantı doğrulanıyor...
        </ThemedText>
      </ThemedView>
    );
  }

  if (status === 'invalid') {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="title" style={styles.title}>
          Bağlantı Geçersiz
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          Bu şifre sıfırlama bağlantısının süresi dolmuş veya daha önce kullanılmış olabilir. Yeni bir
          bağlantı iste.
        </ThemedText>
        <Link href="/forgot-password" style={styles.link}>
          <ThemedText type="linkPrimary">Yeni bağlantı iste</ThemedText>
        </Link>
      </ThemedView>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ThemedView style={styles.container}>
        <ThemedText type="title" style={styles.title}>
          Yeni Şifre Belirle
        </ThemedText>

        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
          placeholder="Yeni şifre (en az 6 karakter)"
          placeholderTextColor={theme.textSecondary}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
          placeholder="Yeni şifre (tekrar)"
          placeholderTextColor={theme.textSecondary}
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        <Pressable
          style={({ pressed }) => [styles.button, (submitting || pressed) && styles.buttonPressed]}
          onPress={handleSubmit}
          disabled={submitting}>
          <ThemedText style={styles.buttonText}>
            {submitting ? 'Kaydediliyor...' : 'Şifreyi Güncelle'}
          </ThemedText>
        </Pressable>
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
  title: { textAlign: 'center', marginBottom: Spacing.two },
  centerText: { textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#208AEF',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  buttonPressed: { opacity: 0.7 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  link: { alignSelf: 'center', marginTop: Spacing.three },
});
