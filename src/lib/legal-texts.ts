/**
 * Hukuki metinler (Kullanım Koşulları, KVKK Aydınlatma Metni, Açık Rıza
 * Metni, Gizlilik Politikası). Uygulama içinde /legal ekranında ve kayıt
 * sırasında gösterilir; aynı metinler web sitesinde de yayınlanacak.
 *
 * ŞİRKET BİLGİLERİ: Uygulamayı yayınlayacak şirket kesinleşince aşağıdaki
 * sabitler doldurulacak (unvan, adres, MERSİS / vergi no).
 */
export const LEGAL_ENTITY = {
  brand: 'Dijital Karpin',
  // TODO: şirket kesinleşince doldurulacak
  title: 'Dijital Karpin',
  address: 'İzmir, Türkiye',
  email: 'info@digitalkarpin.com',
  whatsapp: '0542 249 83 72',
  website: 'dijitalkarpin.com',
};

export const LEGAL_UPDATED_AT = '24.10.2026';

export type LegalSection = { heading: string; body: string };
export type LegalDocKey = 'kullanim' | 'kvkk' | 'acik-riza' | 'gizlilik';
export type LegalDoc = { key: LegalDocKey; title: string; sections: LegalSection[] };

const E = LEGAL_ENTITY;

const KULLANIM: LegalDoc = {
  key: 'kullanim',
  title: 'Kullanım Koşulları',
  sections: [
    {
      heading: '1. Taraflar ve Kapsam',
      body: `Bu Kullanım Koşulları ("Koşullar"), ${E.title} ("Dijital Karpin", "biz") tarafından sunulan Dijital Karpin mobil uygulaması ve ilgili hizmetlerin ("Uygulama") kullanımına ilişkin kuralları belirler. Uygulamaya kayıt olan veya Uygulamayı kullanan her kişi ("Kullanıcı") bu Koşulları okuduğunu, anladığını ve kabul ettiğini beyan eder. Koşulları kabul etmiyorsanız Uygulamayı kullanmayınız.`,
    },
    {
      heading: '2. Hizmetin Tanımı',
      body: `Uygulama; taksi, dolmuş ve benzeri ticari araç sahipleri ile şoförlerin vardiya (karpin) kayıtlarını, kilometre, hasılat, gider, komisyon, bakım ve vize bilgilerini dijital ortamda tutmalarına, raporlamalarına ve birbirleriyle paylaşmalarına yarayan bir kayıt ve takip aracıdır. Dijital Karpin; araç sahibi ile şoför arasındaki çalışma, ortaklık, kira, iş veya ticari ilişkinin tarafı, aracısı ya da garantörü değildir.`,
    },
    {
      heading: '3. Hesap ve Kullanıcı Yükümlülükleri',
      body: `Kullanıcı; kayıt sırasında ve kullanım boyunca verdiği bilgilerin doğru, güncel ve kendisine ait olduğunu, hesabının ve şifresinin güvenliğinden bizzat sorumlu olduğunu, hesabı üzerinden yapılan tüm işlemlerin kendisi tarafından yapılmış sayılacağını kabul eder. Kullanıcı Uygulamayı yürürlükteki mevzuata, bu Koşullara ve genel ahlaka uygun şekilde kullanmayı; başkasının adına veya izni olmadan hesap açmamayı, yanıltıcı veya hukuka aykırı içerik girmemeyi, Uygulamanın işleyişine zarar verecek girişimlerde bulunmamayı taahhüt eder. Araç sahibi, Uygulamaya eklediği şoförlerin ve kaydettiği araç, ruhsat ve diğer bilgilerin işlenmesi için gerekli izin ve bilgilendirmeleri yapmış olduğunu kabul eder.`,
    },
    {
      heading: '4. Kayıtların ve Hesaplamaların Niteliği',
      body: `Uygulamada yer alan tüm tutarlar, şoför payı, net kalan, nakit, km borcu, komisyon ve benzeri hesaplamalar Kullanıcıların girdiği bilgiler esas alınarak otomatik olarak yapılır ve yalnızca bilgilendirme amaçlıdır. Bu kayıtlar resmi muhasebe kaydı, fatura, makbuz, mali veya hukuki belge yerine geçmez. Girilen bilgilerin doğruluğundan, eksiksizliğinden ve bunlara dayanılarak yapılan ödeme, tahsilat, mahsup ve diğer işlemlerden tamamen ilgili Kullanıcılar sorumludur. Kullanıcılar arasında doğabilecek her türlü uyuşmazlık, alacak-borç ve talep Kullanıcıların kendi aralarındadır; Dijital Karpin bu uyuşmazlıklarda taraf değildir ve herhangi bir sorumluluk kabul etmez.`,
    },
    {
      heading: '5. Hizmetin Sunumu ve Değişiklikler',
      body: `Uygulama "olduğu gibi" ve "mevcut haliyle" sunulur. Dijital Karpin, Uygulamanın kesintisiz, hatasız veya her ihtiyaca uygun olacağını garanti etmez. Bakım, güncelleme, teknik arıza, üçüncü taraf hizmet sağlayıcılardan (sunucu, bildirim, uygulama mağazası, internet ve mobil operatör hizmetleri vb.) kaynaklanan kesinti ve gecikmeler olabilir. Dijital Karpin; Uygulamanın özelliklerini, kapsamını, tasarımını ve ücretlendirmesini önceden bildirimde bulunarak veya gerekli hallerde derhal değiştirme, askıya alma veya sonlandırma hakkını saklı tutar.`,
    },
    {
      heading: '6. Sorumluluğun Sınırlandırılması',
      body: `Yürürlükteki mevzuatın izin verdiği en geniş ölçüde; Dijital Karpin ve yöneticileri, çalışanları ve iş ortakları, Uygulamanın kullanımından veya kullanılamamasından doğan doğrudan veya dolaylı zararlardan, kâr kaybı, gelir kaybı, veri kaybı, iş kesintisi, itibar kaybı ve üçüncü kişi taleplerinden, Kullanıcıların yanlış, eksik veya geç girdiği bilgilerden, Kullanıcılar arasındaki ilişkilerden, bildirim ve hatırlatmaların ulaşmamasından veya gecikmesinden (bakım, vize, muayene ve benzeri yükümlülüklerin takibi her durumda Kullanıcının kendi sorumluluğundadır) ve üçüncü taraf hizmetlerden kaynaklanan sorunlardan sorumlu tutulamaz. Her halükârda Dijital Karpin'in toplam sorumluluğu, ilgili Kullanıcının zarara konu olaydan önceki 12 ay içinde Uygulama için Dijital Karpin'e fiilen ödediği tutarla sınırlıdır. Bu sınırlamalar, kanunen sınırlandırılması mümkün olmayan kasıt ve ağır ihmal hallerini kapsamaz.`,
    },
    {
      heading: '7. Fikri Mülkiyet',
      body: `Uygulamanın yazılımı, tasarımı, markası, logosu ve tüm içeriği Dijital Karpin'e veya lisans verenlerine aittir. Kullanıcıya yalnızca Uygulamayı kişisel/işletme içi amaçlarla kullanmak üzere sınırlı, devredilemez ve münhasır olmayan bir kullanım hakkı tanınır. Uygulamanın kopyalanması, çoğaltılması, tersine mühendislik yapılması veya ticari amaçla izinsiz kullanılması yasaktır.`,
    },
    {
      heading: '8. Hesabın Askıya Alınması ve Silinmesi',
      body: `Kullanıcı dilediği zaman Uygulama içindeki "Hesabımı Sil" seçeneği ile hesabını silebilir. Şoför hesabı silindiğinde, araç sahiplerinin kayıt bütünlüğü için o şoföre ait vardiya kayıtları kişisel bilgilerden arındırılarak ("Silinmiş Şoför" olarak) araç sahibinde kalmaya devam eder. Araç sahibi hesabı silindiğinde araçlar ve araçlara bağlı tüm kayıtlar silinir. Dijital Karpin; bu Koşullara veya mevzuata aykırı kullanım, güvenlik riski veya yetkili makam talebi halinde hesabı önceden bildirimde bulunmaksızın askıya alabilir veya kapatabilir.`,
    },
    {
      heading: '9. Kişisel Veriler',
      body: `Kişisel verileriniz, KVKK Aydınlatma Metni ve Gizlilik Politikası'nda açıklandığı şekilde işlenir. Bu metinler Kullanım Koşulları'nın ayrılmaz parçasıdır.`,
    },
    {
      heading: '10. Değişiklikler, Uygulanacak Hukuk ve Yetki',
      body: `Dijital Karpin bu Koşulları güncelleyebilir; güncel metin Uygulamada yayınlandığı tarihte yürürlüğe girer ve Uygulamanın kullanılmaya devam edilmesi güncel Koşulların kabulü anlamına gelir. Bu Koşullar Türkiye Cumhuriyeti hukukuna tabidir. Uyuşmazlıklarda, tüketici sıfatına ilişkin kanuni haklar saklı kalmak kaydıyla, İzmir Mahkemeleri ve İcra Daireleri yetkilidir. Dijital Karpin'in kayıtları, uyuşmazlıklarda HMK m.193 uyarınca kesin delil teşkil eder.`,
    },
    {
      heading: '11. İletişim',
      body: `Sorularınız için: ${E.email} · WhatsApp (sadece yazılı mesaj): ${E.whatsapp}`,
    },
  ],
};

const KVKK: LegalDoc = {
  key: 'kvkk',
  title: 'KVKK Aydınlatma Metni',
  sections: [
    {
      heading: '1. Veri Sorumlusu',
      body: `6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca kişisel verileriniz, veri sorumlusu sıfatıyla ${E.title} ("Dijital Karpin") tarafından aşağıda açıklanan kapsamda işlenmektedir. Adres: ${E.address} · E-posta: ${E.email}`,
    },
    {
      heading: '2. İşlenen Kişisel Veri Kategorileri',
      body: `Kimlik (ad soyad); iletişim (telefon numarası, e-posta adresi); müşteri işlem (vardiya/karpin kayıtları, hasılat, kredi kartı tahsilatı, yakıt ve diğer gider kalemleri, uygulama komisyonları, şoför payı, teslim/tahsil bilgileri, notlar); araç bilgileri (plaka, ruhsat fotoğrafı, kilometre, bakım ve vize bilgileri); görsel kayıt (km sayacı, fiş, ruhsat ve not fotoğrafları); işlem güvenliği (oturum ve giriş kayıtları, IP adresi, cihaz ve uygulama sürüm bilgisi, bildirim (push) kimliği); talep/şikâyet (destek ve iletişim yazışmaları); hukuki işlem (onay kayıtları ve tarihleri).`,
    },
    {
      heading: '3. İşleme Amaçları',
      body: `Üyelik ve hesap işlemlerinin yürütülmesi; araç sahibi ile şoför arasındaki vardiya, gelir-gider, komisyon, bakım ve vize kayıtlarının tutulması, hesaplanması, raporlanması (Excel/PDF dahil) ve paylaşılması; bildirim ve hatırlatmaların gönderilmesi; destek taleplerinin karşılanması; hizmetin geliştirilmesi, analizi ve güvenliğinin sağlanması; hukuki yükümlülüklerin yerine getirilmesi, yetkili kurum taleplerinin karşılanması ve olası uyuşmazlıklarda delil olarak kullanılması; Kullanıcının talep ettiği ek hizmetlerin (iş ortakları aracılığıyla) sunulması.`,
    },
    {
      heading: '4. Hukuki Sebepler ve Toplama Yöntemi',
      body: `Kişisel verileriniz; Uygulama, web sitesi, destek kanalları ve bildirim altyapısı üzerinden elektronik ortamda, KVKK m.5/2 uyarınca sözleşmenin kurulması ve ifası, hukuki yükümlülüğün yerine getirilmesi, bir hakkın tesisi, kullanılması veya korunması ve temel hak ve özgürlüklerinize zarar vermemek kaydıyla veri sorumlusunun meşru menfaati hukuki sebeplerine; bu sebeplerin bulunmadığı hallerde ise KVKK m.5/1 ve m.9 uyarınca açık rızanıza dayanılarak işlenir.`,
    },
    {
      heading: '5. Kişisel Verilerin Aktarılması',
      body: `Kişisel verileriniz yukarıdaki amaçlarla sınırlı olarak; aynı araçla ilişkili araç sahibi ve şoför kullanıcılara; barındırma, veritabanı, depolama, bildirim, e-posta ve mesajlaşma hizmeti sağlayıcılarımıza (bu sağlayıcıların sunucuları yurt dışında bulunabilir); uygulama mağazası ve işletim sistemi sağlayıcılarına; hukuk, mali müşavirlik, denetim ve danışmanlık hizmeti aldığımız kişilere; iş ortaklarımıza ve hizmet sağlayıcılarımıza (talebiniz halinde muhasebe, oda/kooperatif, bakım, telsiz, POS, taksimetre ve benzeri hizmet sağlayıcılar); şirket birleşmesi, bölünmesi, devri veya hizmetin başka bir şirkete devri halinde devralan tarafa; kanunen yetkili kamu kurum ve kuruluşları ile adli makamlara KVKK m.8 ve m.9'a uygun olarak aktarılabilir.`,
    },
    {
      heading: '6. Saklama Süresi',
      body: `Kişisel verileriniz, işleme amacının gerektirdiği süre ve ilgili mevzuatta öngörülen zamanaşımı/saklama süreleri boyunca saklanır; süre sonunda silinir, yok edilir veya anonim hale getirilir. Hesabınızı sildiğinizde kişisel verileriniz, kanuni saklama yükümlülükleri ve diğer kullanıcıların kayıt bütünlüğü için gerekli olanlar (anonimleştirilerek) hariç silinir.`,
    },
    {
      heading: '7. Haklarınız',
      body: `KVKK m.11 uyarınca; kişisel verilerinizin işlenip işlenmediğini öğrenme, işlenmişse bilgi talep etme, işleme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme, yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme, eksik veya yanlış işlenmişse düzeltilmesini, KVKK m.7 çerçevesinde silinmesini veya yok edilmesini ve bu işlemlerin aktarıldığı üçüncü kişilere bildirilmesini isteme, münhasıran otomatik sistemlerle analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme ve kanuna aykırı işleme nedeniyle zarara uğramanız halinde zararın giderilmesini talep etme haklarına sahipsiniz. Taleplerinizi ${E.email} adresine iletebilirsiniz; talepleriniz en geç 30 gün içinde sonuçlandırılır.`,
    },
  ],
};

const ACIK_RIZA: LegalDoc = {
  key: 'acik-riza',
  title: 'Açık Rıza Metni',
  sections: [
    {
      heading: 'Açık Rıza Beyanı',
      body: `KVKK Aydınlatma Metni'ni okudum ve anladım. Bu kapsamda, ${E.title} tarafından kişisel verilerimin aşağıdaki işlemler için işlenmesine özgür irademle açık rıza veriyorum:`,
    },
    {
      heading: '1. Yurt Dışına Aktarım',
      body: `Uygulamanın çalışması için kullanılan barındırma, veritabanı, dosya depolama ve bildirim hizmeti sağlayıcılarının sunucularının yurt dışında bulunabilmesi nedeniyle; kimlik, iletişim, müşteri işlem, araç, görsel kayıt ve işlem güvenliği verilerimin bu hizmet sağlayıcılara, hizmetin sunulması amacıyla yurt dışına aktarılmasına.`,
    },
    {
      heading: '2. Üçüncü Kişilerle Paylaşım',
      body: `Talep ettiğim veya kullandığım ek hizmetlerin sunulması, iş ortaklıkları kapsamında hizmetin geliştirilmesi ve tarafıma uygun hizmet ve tekliflerin sunulabilmesi amacıyla; iletişim, araç ve müşteri işlem verilerimin iş ortakları ve hizmet sağlayıcılarla (muhasebe/mali müşavirlik, oda ve kooperatifler, bakım-servis, telsiz, POS, taksimetre, sigorta ve benzeri sektör hizmet sağlayıcıları) paylaşılmasına.`,
    },
    {
      heading: '3. Rızanın Geri Alınması',
      body: `Bu açık rızamı dilediğim zaman ${E.email} adresine bildirerek geri alabileceğimi; geri almanın, geri alma tarihinden önceki işlemleri etkilemeyeceğini ve hizmetin sunulması için zorunlu olan aktarımlar bakımından geri almanın hizmetten yararlanmamı etkileyebileceğini biliyorum.`,
    },
  ],
};

const GIZLILIK: LegalDoc = {
  key: 'gizlilik',
  title: 'Gizlilik Politikası',
  sections: [
    {
      heading: 'Özet',
      body: `Dijital Karpin, araç sahipleri ve şoförler için vardiya (karpin), gelir-gider ve bakım takibi uygulamasıdır. Bu politika hangi bilgileri topladığımızı, neden topladığımızı ve haklarınızı özetler. Ayrıntılar KVKK Aydınlatma Metni'nde yer alır.`,
    },
    {
      heading: 'Topladığımız Bilgiler',
      body: `Ad soyad, telefon numarası; araç plakası ve ruhsat fotoğrafı; vardiya kayıtları (km, hasılat, giderler, komisyonlar, teslim bilgileri); km sayacı, fiş ve not fotoğrafları; bakım ve vize bilgileri; bildirim gönderebilmek için cihaz bildirim kimliği; destek yazışmaları. Konum bilginizi, rehberinizi veya reklam kimliğinizi toplamayız; verilerinizi satmayız ve reklam amaçlı izleme yapmayız.`,
    },
    {
      heading: 'Bilgileri Nasıl Kullanıyoruz',
      body: `Hesabınızı oluşturmak, araç sahibi ile şoför arasındaki kayıtları tutmak ve paylaşmak, hesaplamaları ve raporları (Excel/PDF) hazırlamak, bildirim ve hatırlatma göndermek, destek vermek, hizmeti güvenli tutmak ve geliştirmek için.`,
    },
    {
      heading: 'Paylaşım',
      body: `Kayıtlarınız, aynı araçla ilişkili araç sahibi ve şoförlerle paylaşılır. Uygulamayı çalıştırmak için barındırma, depolama ve bildirim hizmeti sağlayıcıları kullanılır (sunucular yurt dışında olabilir). Yasal zorunluluk halinde yetkili makamlarla, onayınız veya talebiniz halinde iş ortaklarıyla paylaşılabilir.`,
    },
    {
      heading: 'Saklama ve Silme',
      body: `Bilgileriniz hesabınız açık olduğu sürece ve yasal süreler boyunca saklanır. Uygulamadaki Hesabım > Hesabımı Sil ile hesabınızı istediğiniz zaman silebilirsiniz. Şoför hesaplarında, araç sahibinin kayıt bütünlüğü için vardiya kayıtları kişisel bilgilerden arındırılarak saklanır.`,
    },
    {
      heading: 'Güvenlik',
      body: `Verileriniz şifreli bağlantı (HTTPS) üzerinden iletilir; her kullanıcı yalnızca yetkili olduğu araç ve kayıtları görebilir. Fotoğraflar yalnızca ilgili kullanıcıların erişebildiği özel depolama alanında tutulur.`,
    },
    {
      heading: 'Çocuklar',
      body: `Uygulama 18 yaşından küçükler için tasarlanmamıştır ve bilerek 18 yaş altındaki kişilerden veri toplamayız.`,
    },
    {
      heading: 'İletişim',
      body: `${E.title} · ${E.address} · ${E.email} · WhatsApp (sadece yazılı): ${E.whatsapp}`,
    },
  ],
};

export const LEGAL_DOCS: Record<LegalDocKey, LegalDoc> = {
  kullanim: KULLANIM,
  kvkk: KVKK,
  'acik-riza': ACIK_RIZA,
  gizlilik: GIZLILIK,
};
