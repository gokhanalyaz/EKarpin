import Constants from 'expo-constants';
import { SymbolView } from 'expo-symbols';
import { Alert, Linking, Platform, ScrollView, StyleSheet } from 'react-native';

import { GroupCard, GroupFooter, GroupRow } from '@/components/grouped-list';
import { SafeScreen } from '@/components/safe-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';

const SUPPORT_PHONE = '4444562';
const SUPPORT_PHONE_DISPLAY = '444 45 62';
const SUPPORT_EMAIL = 'info@digitalkarpin.com';

/** "Sorun Bildir" konuları. İleride telsiz / POS / taksimetre arızası
 * gibi konular da buraya eklenecek (şimdilik "Yakında" olarak görünüyor). */
const REPORT_TOPICS = [
  { key: 'app_bug', label: 'Uygulama Hatası', hint: 'Bir ekran çalışmıyor, hata veriyor vb.' },
  { key: 'suggestion', label: 'Öneri / İstek', hint: 'Uygulamada görmek istediğin bir özellik' },
  { key: 'other', label: 'Diğer', hint: 'Başka bir konu' },
];
const COMING_SOON_TOPICS = ['Telsiz Arızası Bildir', 'POS Arızası Bildir', 'Taksimetre Arızası Bildir'];

/** Destek sekmesi: bizi ara, e-posta gönder, sorun bildir. */
export default function SupportScreen() {
  const { profile } = useAuth();

  async function open(url: string, fallbackMessage: string) {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Açılamadı', fallbackMessage);
    }
  }

  function callUs() {
    open(`tel:${SUPPORT_PHONE}`, `Bizi ${SUPPORT_PHONE_DISPLAY} numarasından arayabilirsin.`);
  }

  function emailUs(subject: string, intro?: string) {
    // Kim olduğunu ve hangi cihazdan yazdığını otomatik ekliyoruz ki
    // sorunu daha hızlı çözebilelim; kullanıcı sadece sorununu yazar.
    const body = [
      intro ?? 'Mesajınızı buraya yazın:',
      '',
      '',
      '',
      '----- Lütfen bu kısmı silmeyin -----',
      `Ad Soyad: ${profile?.full_name ?? '-'}`,
      `Telefon: ${profile?.phone ?? '-'}`,
      `Hesap Türü: ${profile?.role === 'owner' ? 'Araç Sahibi' : 'Şoför'}`,
      `Uygulama Sürümü: ${Constants.expoConfig?.version ?? '-'}`,
      `Cihaz: ${Platform.OS === 'ios' ? 'iPhone' : 'Android'} (${String(Platform.Version)})`,
    ].join('\n');
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`[Dijital Karpin] ${subject}`)}&body=${encodeURIComponent(body)}`;
    open(url, `E-posta uygulaması açılamadı. Bize ${SUPPORT_EMAIL} adresinden yazabilirsin.`);
  }

  return (
    <SafeScreen>
      <ScrollView contentContainerStyle={styles.container}>
        <ThemedView style={[styles.hero, styles.transparentBg]}>
          <ThemedView style={styles.heroIcon}>
            <SymbolView name="lifepreserver.fill" size={34} tintColor={Brand.onPrimary} />
          </ThemedView>
          <ThemedText type="title" style={styles.title}>
            Destek
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
            Bir sorun mu yaşıyorsun ya da bir sorun mu var? Bize hemen ulaş, yardımcı olalım.
          </ThemedText>
        </ThemedView>

        <ThemedText type="eyebrow" style={styles.sectionTitle}>
          Bize Ulaşın
        </ThemedText>
        <GroupCard>
          <GroupRow title="Bizi Ara" subtitle={SUPPORT_PHONE_DISPLAY} chevron onPress={callUs} />
          <GroupRow
            title="E-posta Gönder"
            subtitle={SUPPORT_EMAIL}
            chevron
            divider={false}
            onPress={() => emailUs('Destek Talebi')}
          />
        </GroupCard>

        <ThemedText type="eyebrow" style={styles.sectionTitle}>
          Sorun Bildir
        </ThemedText>
        <GroupCard>
          {REPORT_TOPICS.map((topic, index) => (
            <GroupRow
              key={topic.key}
              title={topic.label}
              subtitle={topic.hint}
              chevron
              divider={index < REPORT_TOPICS.length - 1 || COMING_SOON_TOPICS.length > 0}
              onPress={() => emailUs(topic.label, `${topic.label} - lütfen yaşadığın sorunu kısaca anlat:`)}
            />
          ))}
          {COMING_SOON_TOPICS.map((label, index) => (
            <GroupRow
              key={label}
              title={label}
              value="Yakında"
              disabled
              divider={index < COMING_SOON_TOPICS.length - 1}
            />
          ))}
        </GroupCard>
        <GroupFooter>
          Seçtiğin konuyla bir e-posta hazırlanır; sorununu yazıp göndermen yeterli. İstersen ekran görüntüsü de
          ekleyebilirsin.
        </GroupFooter>
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.two },
  transparentBg: { backgroundColor: 'transparent' },
  hero: { alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.two },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', paddingHorizontal: Spacing.three },
  sectionTitle: { marginTop: Spacing.three, paddingHorizontal: Spacing.three },
});
