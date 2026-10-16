import { Alert, Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FontFamily, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';

export default function AccountScreen() {
  const { profile, signOut } = useAuth();

  function handleSignOut() {
    Alert.alert('Çıkış Yap', 'Hesabınızdan çıkmak istediğinize emin misiniz?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Çıkış Yap', style: 'destructive', onPress: signOut },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText type="subtitle" style={styles.header}>
        Hesabım
      </ThemedText>

      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="eyebrow" themeColor="textSecondary">
          Ad Soyad
        </ThemedText>
        <ThemedText type="smallBold">{profile?.full_name ?? '-'}</ThemedText>

        <ThemedText type="eyebrow" themeColor="textSecondary" style={styles.fieldSpacing}>
          Telefon
        </ThemedText>
        <ThemedText type="smallBold">{profile?.phone ?? '-'}</ThemedText>

        <ThemedText type="eyebrow" themeColor="textSecondary" style={styles.fieldSpacing}>
          Hesap Türü
        </ThemedText>
        <ThemedText type="smallBold">{profile?.role === 'owner' ? 'Araç Sahibi' : 'Şoför'}</ThemedText>
      </ThemedView>

      <Pressable
        style={({ pressed }) => [styles.signOutButton, pressed && styles.signOutButtonPressed]}
        onPress={handleSignOut}>
        <ThemedText style={styles.signOutButtonText}>Çıkış Yap</ThemedText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
    paddingBottom: Spacing.six,
  },
  header: { marginBottom: Spacing.three },
  card: { padding: Spacing.four, gap: Spacing.half },
  fieldSpacing: { marginTop: Spacing.three },
  signOutButton: {
    borderWidth: 1,
    borderColor: '#DC2626',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.six,
  },
  signOutButtonPressed: { opacity: 0.6 },
  signOutButtonText: { color: '#DC2626', fontFamily: FontFamily.bodyBold, fontSize: 16 },
});
