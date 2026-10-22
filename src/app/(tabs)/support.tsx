import Constants from 'expo-constants';
import { SymbolView } from 'expo-symbols';
import { Alert, Linking, Platform, ScrollView, StyleSheet } from 'react-native';

import { GroupCard, GroupFooter, GroupRow } from '@/components/grouped-list';
import { SafeScreen } from '@/components/safe-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';

// Destek hattı SADECE WhatsApp mesajı içindir (aramalar cevaplanmaz).
// Numara belli olunca buraya ülke koduyla, boşluksuz yazılacak
// (örn. '905321234567'). Boş kaldıkça WhatsApp satırı "yakında" uyarısı verir.
const SUPPORT_WHATSAPP = '';
const SUPPORT_EMAIL = 'info@digitalkarpin.com';

/** "Sorun Bildir" konuları - seçilen konuyla hazır bir WhatsApp mesajı açılır. */
const REPORT_TOPICS = [
  { key: 'app_bug', label: 'Uygulama Hatası', hint: 'Bir ekran çalışmıyor, hata veriyor vb.' },
  { key: 'suggestion', label: 'Öneri / İstek', hint: 'Uygulamada görmek istediğin bir özellik' },
  { key: 'other', label: 'Diğer', hint: 'Başka bir konu' },
];

/** Destek sekmesi: WhatsApp'tan yaz, e-posta gönder, sorun bildir. */
export default function SupportScreen() {
  const { profile } = useAuth();

  async function open(url: string, fallbackMessage: string) {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Açılamadı', fallbackMessage);
    }
  }

  // Kim olduğunu ve hangi cihazdan yazdığını otomatik ekliyoruz ki
  // sorunu daha hızlı çözebilelim; kullanıcı sadece sorununu yazar.
  function infoLines(): string {
    return [
      '----- Bilgi (silmeyin) -----',
      `Ad Soyad: ${profile?.full_name ?? '-'}`,
      `Telefon: ${profile?.phone ?? '-'}`,
      `Hesap Türü: ${profile?.role === 'owner' ? 'Araç Sahibi' : 'Şoför'}`,
      `Uygulama Sürümü: ${Constants.expoConfig?.version ?? '-'}`,
      `Cihaz: ${Platform.OS === 'ios' ? 'iPhone' : 'Android'} (${String(Platform.Version)})`,
    ].join('\n');
  }

  function whatsappUs(topic?: string) {
    if (!SUPPORT_WHATSAPP) {
      Alert.alert('Yakında', `WhatsApp destek hattımız çok yakında burada olacak. Şimdilik ${SUPPORT_EMAIL} adresine yazabilirsin.`);
      return;
    }
    const text = `${topic ? `Konu: ${topic}\n\n` : ''}Merhaba, \n\n\n${infoLines()}`;
    open(
      `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(text)}`,
      'WhatsApp açılamadı. Telefonunda WhatsApp yüklü olduğundan emin ol.'
    );
  }

  function emailUs() {
    const body = `Mesajınızı buraya yazın:\n\n\n\n${infoLines()}`;
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('[Dijital Karpin] Destek Talebi')}&body=${encodeURIComponent(body)}`;
    open(url, `E-posta uygulaması açılamadı. Bize ${SUPPORT_EMAIL} adresinden yazabilirsin.`);
  }

  return (
    <SafeScreen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
        <ThemedView style={[styles.hero, styles.transparentBg]}>
          <ThemedView style={styles.heroIcon}>
            <SymbolView name="bubble.left.and.text.bubble.right.fill" size={30} tintColor={Brand.onPrimary} />
          </ThemedView>
          <ThemedText type="title" style={styles.title}>
            Destek
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
            Bir sorun mu yaşıyorsun ya da aklına takılan bir şey mi var? Bize yaz, yardımcı olalım.
          </ThemedText>
        </ThemedView>

        <ThemedText type="eyebrow" style={styles.sectionTitle}>
          Bize Ulaşın
        </ThemedText>
        <GroupCard>
          <GroupRow
            title="WhatsApp'tan Yaz"
            subtitle="En hızlı yanıt buradan"
            chevron
            onPress={() => whatsappUs()}
            right={<SymbolView name="message.fill" size={18} tintColor="#25D366" />}
          />
          <GroupRow
            title="E-posta Gönder"
            subtitle={SUPPORT_EMAIL}
            chevron
            divider={false}
            onPress={emailUs}
            right={<SymbolView name="envelope.fill" size={18} tintColor="#8E8E93" />}
          />
        </GroupCard>
        <GroupFooter>
          Destek hattımız sadece WhatsApp mesajı içindir. Bu numaraya yapılan aramalar cevaplanmaz, lütfen yazılı mesaj
          gönder.
        </GroupFooter>

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
              divider={index < REPORT_TOPICS.length - 1}
              onPress={() => whatsappUs(topic.label)}
            />
          ))}
        </GroupCard>
        <GroupFooter>
          Konuyu seçince hazır bir WhatsApp mesajı açılır; sorununu yazıp göndermen yeterli. İstersen ekran görüntüsü de
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
