import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export default function KvkkScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">KVKK Aydınlatma Metni</ThemedText>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ThemedText type="linkPrimary">Kapat</ThemedText>
        </Pressable>
      </ThemedView>

      <ScrollView contentContainerStyle={styles.scroll}>
        <ThemedText type="smallBold">1. Veri Sorumlusu</ThemedText>
        <ThemedText style={styles.paragraph}>
          Dijital Karpin ("Uygulama") olarak, 6698 sayılı Kişisel Verilerin Korunması Kanunu
          ("KVKK") kapsamında veri sorumlusu sıfatıyla, kişisel verilerinizin işlenmesine ilişkin
          sizi aşağıdaki hususlarda bilgilendiririz.
        </ThemedText>

        <ThemedText type="smallBold">2. İşlenen Kişisel Veriler</ThemedText>
        <ThemedText style={styles.paragraph}>
          Uygulama üzerinden; ad soyad, telefon numarası, e-posta adresi, araç plaka bilgisi,
          vardiya (karpin) kayıtları, kilometre ve gelir-gider bilgileri, araç/yakıt fişi
          fotoğrafları ile bildirim gönderebilmek için cihazınıza ait push bildirim kimliği
          işlenmektedir.
        </ThemedText>

        <ThemedText type="smallBold">3. İşleme Amaçları</ThemedText>
        <ThemedText style={styles.paragraph}>
          Kişisel verileriniz; hesabınızın oluşturulması ve doğrulanması, araç sahibi ile şoför
          arasında vardiya (karpin) kayıtlarının tutulması, gelir-gider hesaplamalarının
          yapılması, tarafınıza bildirim gönderilmesi ve uygulamanın işlerliğinin sağlanması
          amaçlarıyla sınırlı olarak işlenmektedir.
        </ThemedText>

        <ThemedText type="smallBold">4. Aktarım</ThemedText>
        <ThemedText style={styles.paragraph}>
          Kişisel verileriniz, uygulamanın teknik altyapısını sağlayan hizmet sağlayıcılar
          (barındırma/veritabanı ve bildirim hizmeti sağlayıcıları) ile hesabınızı paylaştığınız
          araç sahibi/şoför dışında üçüncü kişilerle paylaşılmaz.
        </ThemedText>

        <ThemedText type="smallBold">5. Hukuki Sebep</ThemedText>
        <ThemedText style={styles.paragraph}>
          Kişisel verileriniz, bir sözleşmenin kurulması ve ifasıyla doğrudan doğruya ilgili olması
          ve veri sorumlusunun meşru menfaati hukuki sebeplerine dayanılarak işlenmektedir.
        </ThemedText>

        <ThemedText type="smallBold">6. Haklarınız</ThemedText>
        <ThemedText style={styles.paragraph}>
          KVKK'nın 11. maddesi uyarınca; kişisel verilerinizin işlenip işlenmediğini öğrenme,
          işlenmişse buna ilişkin bilgi talep etme, işlenme amacını ve amacına uygun kullanılıp
          kullanılmadığını öğrenme, aktarıldığı üçüncü kişileri bilme, eksik/yanlış işlenmişse
          düzeltilmesini isteme, silinmesini/yok edilmesini isteme ve itiraz haklarına sahipsiniz.
          Taleplerinizi uygulama içindeki iletişim adresi üzerinden bize iletebilirsiniz.
        </ThemedText>

        <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
          Bu metin genel bir taslaktır ve yayın öncesinde bir hukuk danışmanı tarafından teyit
          edilmesi önerilir.
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing.four, paddingTop: Spacing.six },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  scroll: { paddingBottom: Spacing.six, gap: Spacing.two },
  paragraph: { marginBottom: Spacing.three, lineHeight: 20 },
  note: { marginTop: Spacing.two, fontStyle: 'italic' },
});
