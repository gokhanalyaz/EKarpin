import { SymbolView } from 'expo-symbols';
import { Alert, Linking, ScrollView, StyleSheet } from 'react-native';

import { GroupCard, GroupFooter, GroupRow } from '@/components/grouped-list';
import { SafeScreen } from '@/components/safe-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';

// Destek hattı SADECE WhatsApp mesajı içindir (aramalar cevaplanmaz).
// Ülke koduyla, boşluksuz: 0542 249 83 72
const SUPPORT_WHATSAPP = '905422498372';
const SUPPORT_WHATSAPP_DISPLAY = '0542 249 83 72';
const SUPPORT_EMAIL = 'info@digitalkarpin.com';


/** Destek sekmesi: WhatsApp'tan yaz veya e-posta gönder (hazır metin yok). */
export default function SupportScreen() {

  async function open(url: string, fallbackMessage: string) {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Açılamadı', fallbackMessage);
    }
  }

  // Hazır metin yok: sohbet boş açılır, kullanıcı sorununu kendisi yazar.
  function whatsappUs() {
    open(`https://wa.me/${SUPPORT_WHATSAPP}`, 'WhatsApp açılamadı. Telefonunda WhatsApp yüklü olduğundan emin ol.');
  }

  function emailUs() {
    open(
      `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Dijital Karpin Destek')}`,
      `E-posta uygulaması açılamadı. Bize ${SUPPORT_EMAIL} adresinden yazabilirsin.`
    );
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
            subtitle={`${SUPPORT_WHATSAPP_DISPLAY} · en hızlı yanıt`}
            chevron
            onPress={whatsappUs}
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
          Sorununu WhatsApp'tan yazman yeterli; istersen ekran görüntüsü de ekleyebilirsin. Bu numara sadece WhatsApp mesajı içindir, aramalar cevaplanmaz.
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
