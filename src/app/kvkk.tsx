import { router } from 'expo-router';
import { useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, FontFamily, Spacing } from '@/constants/theme';
import { setKvkkAccepted } from '@/lib/kvkk-consent';

const SCROLL_END_THRESHOLD = 24;

export default function KvkkScreen() {
  const [reachedEnd, setReachedEnd] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(0);

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (reachedEnd) return;
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distanceToBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    if (distanceToBottom <= SCROLL_END_THRESHOLD) {
      setReachedEnd(true);
    }
  }

  function handleContentSizeChange(_w: number, contentHeight: number) {
    // Metin ekrana sigiyorsa (kaydirmaya gerek yoksa) direkt onaya izin ver.
    if (viewportHeight > 0 && contentHeight <= viewportHeight + SCROLL_END_THRESHOLD) {
      setReachedEnd(true);
    }
  }

  function handleApprove() {
    setKvkkAccepted(true);
    router.back();
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">KVKK Aydınlatma Metni</ThemedText>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ThemedText type="linkPrimary">Kapat</ThemedText>
        </Pressable>
      </ThemedView>

      <ScrollView
        contentContainerStyle={styles.scroll}
        onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
        onScroll={handleScroll}
        onContentSizeChange={handleContentSizeChange}
        scrollEventThrottle={32}>
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

        <ThemedText type="smallBold">6. Üçüncü Kişilerle Paylaşım İçin Açık Rıza</ThemedText>
        <ThemedText style={styles.paragraph}>
          Uygulama üzerinden gelecekte sunulabilecek ek hizmetler (örneğin; mazot/gider
          fişlerinizin veya günlük hasılat raporlarınızın esnaf/şoförler odası muhasebesine ya da
          kendi belirlediğiniz mali müşavirinize aktarılması; araç bakım, taksimetre, telsiz veya
          POS cihazı tedarikçisi gibi hizmet sağlayıcılara randevu/arıza talebi oluşturulması)
          yalnızca sizin açık talebiniz ve yetkilendirmeniz üzerine devreye girer. Bu tür bir
          hizmeti kullanmayı tercih ettiğinizde, o hizmetin gerektirdiği kişisel verilerin
          (ör. ilgili plakaya ait fişler, iletişim bilgileriniz) ilgili üçüncü kişi/kurumla, yalnızca
          o talebi karşılamak amacıyla paylaşılmasına açık rıza göstermiş olursunuz. Bu onayı,
          söz konusu hizmeti hiç kullanmayarak fiilen devre dışı bırakabilir; ilgili talebi
          oluşturmadığınız sürece verileriniz bu şekilde hiçbir üçüncü kişiyle paylaşılmaz.
        </ThemedText>

        <ThemedText type="smallBold">7. Haklarınız</ThemedText>
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

      <ThemedView style={styles.footer}>
        {!reachedEnd && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.footerHint}>
            Onaylamak için lütfen metnin sonuna kadar kaydırın.
          </ThemedText>
        )}
        <Pressable
          style={({ pressed }) => [
            styles.approveButton,
            !reachedEnd && styles.approveButtonDisabled,
            pressed && reachedEnd && styles.buttonPressed,
          ]}
          disabled={!reachedEnd}
          onPress={handleApprove}>
          <ThemedText type="linkPrimary" style={styles.approveButtonText}>
            Okudum, Onaylıyorum
          </ThemedText>
        </Pressable>
      </ThemedView>
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
  footer: { paddingTop: Spacing.two, paddingBottom: Spacing.four, gap: Spacing.two },
  footerHint: { textAlign: 'center' },
  approveButton: {
    backgroundColor: Brand.primary,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  approveButtonDisabled: { opacity: 0.4 },
  approveButtonText: { color: Brand.onPrimary, fontFamily: FontFamily.bodyBold },
  buttonPressed: { opacity: 0.7 },
});
