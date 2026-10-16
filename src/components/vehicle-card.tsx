import { SymbolView } from 'expo-symbols';
import { StyleSheet } from 'react-native';

import { PaymentModelBadge } from '@/components/payment-model-badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import type { Vehicle } from '@/lib/vehicles';

type Props = {
  vehicle: Vehicle;
  /** Durum başlığı, örn. "Vardiya Açık" / "Vardiya Kapalı" / "Vardiyan Açık". */
  statusLabel: string;
  /** true ise durum başlığı vurgulu (yeşil) renkte gösterilir. */
  statusActive?: boolean;
  /** Durum başlığının ALTINDA ayrı bir satırda gösterilir - şoför adı ya da bir ipucu metni (örn. "Kapatmak için dokun"). */
  subLabel?: string;
  /** true ise subLabel (şoför adı gibi önemli bir bilgi) koyu/siyah ve kalın yazılır; false/yoksa ipucu metni gibi soluk gri kalır. */
  subLabelBold?: boolean;
  /** Kartın köşesine küçük bir saat notu olarak yazılacak etiket: vardiya açıkken "Açılış", kapalıyken (son kapanan vardiya varsa) "Kapanış". */
  cornerTimeLabel?: string;
  /** Yukarıdaki etiketin yanına yazılacak zaman (ISO). Yoksa/null ise köşe notu hiç gösterilmez. */
  cornerTimeIso?: string | null;
};

/** Saat damgasını küçük köşe notu için biçimlendirir - bugünse sadece saat
 * ("18:45"), tarih atladıysa (dünkü/daha eski bir vardiyaysa) önüne gün.ay
 * da eklenir ("30.09 18:45") ki hangi güne ait olduğu belli olsun. */
function formatCornerTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  const time = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return time;
  const date = d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
  return `${date} ${time}`;
}

/**
 * Ana ekranlardaki (ev sahibi + şoför) araç kartı: plaka beyaz bir
 * rozet/kutu OLMADAN, sadece yazı karakteri olarak gösterilir; sağa
 * yaslanmış araç simgesinin hemen altında da küçük bir ödeme modeli
 * rozeti (% / km) yer alır - SF Symbols'un araç simgesi kullanıldı.
 * Durum başlığı (açık/kapalı) kalın+büyük harf+aralıklı bir "karakterle"
 * gövde metninden ayrıştırılır; şoför adı/ipucu bunun ALTINDA ayrı bir
 * satırda, açılış/kapanış saati ise kartın sağ üst köşesinde küçük bir
 * not olarak gösterilir.
 */
export function VehicleCard({ vehicle, statusLabel, statusActive, subLabel, subLabelBold, cornerTimeLabel, cornerTimeIso }: Props) {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      {cornerTimeIso ? (
        <ThemedView style={[styles.openedAtBadge, styles.transparentBg]}>
          <ThemedText type="small" style={styles.openedAtText}>
            {cornerTimeLabel} {formatCornerTime(cornerTimeIso)}
          </ThemedText>
        </ThemedView>
      ) : null}
      <ThemedView style={[styles.content, styles.transparentBg]}>
        <ThemedText style={styles.plateText}>{vehicle.plate_no}</ThemedText>
        <ThemedView style={styles.transparentBg}>
          <ThemedText
            themeColor={statusActive ? undefined : 'textSecondary'}
            style={[styles.statusText, statusActive && styles.statusActiveText]}>
            {statusLabel}
          </ThemedText>
          {subLabel ? (
            <ThemedText
              type="small"
              themeColor={subLabelBold ? undefined : 'textSecondary'}
              style={[styles.subLabel, subLabelBold && styles.subLabelBold]}>
              {subLabel}
            </ThemedText>
          ) : null}
        </ThemedView>
      </ThemedView>
      <ThemedView style={[styles.rightColumn, styles.transparentBg]}>
        <SymbolView
          name="car.side.fill"
          size={84}
          tintColor={statusActive ? '#16A34A' : Brand.primary}
          style={styles.carIcon}
        />
        <PaymentModelBadge vehicle={vehicle} compact />
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.four,
    borderRadius: Spacing.three,
    minHeight: 148,
    gap: Spacing.two,
  },
  content: { flex: 1, gap: Spacing.two, alignItems: 'flex-start' },
  transparentBg: { backgroundColor: 'transparent' },
  rightColumn: { alignItems: 'center', gap: 0 },
  statusText: {
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  statusActiveText: { color: '#16A34A' },
  subLabel: { marginTop: Spacing.two },
  subLabelBold: { fontWeight: '800' },
  openedAtBadge: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.three,
  },
  openedAtText: { fontSize: 12, fontWeight: '800' },
  plateText: {
    fontWeight: '800',
    fontSize: 20,
    letterSpacing: 1,
  },
  carIcon: { marginBottom: -14 },
});
