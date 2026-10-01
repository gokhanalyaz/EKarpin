import { SymbolView } from 'expo-symbols';
import { StyleSheet } from 'react-native';

import { PaymentModelBadge } from '@/components/payment-model-badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, FontFamily, Spacing } from '@/constants/theme';
import type { Vehicle } from '@/lib/vehicles';

type Props = {
  vehicle: Vehicle;
  /** Durum basligi, orn. "Vardiya Açık" / "Vardiya Kapalı" / "Vardiyan Açık". */
  statusLabel: string;
  /** true ise durum basligi vurgulu (yesil) renkte gosterilir. */
  statusActive?: boolean;
  /** Durum basliginin ALTINDA ayri bir satirda gosterilir - soför adi ya da bir ipucu metni (orn. "Kapatmak için dokun"). */
  subLabel?: string;
  /** Vardiya acikken kartin kosesine kucuk bir not olarak acilis saati yazilir. */
  openedAt?: string | null;
};

function formatOpenedTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Ana ekranlardaki (ev sahibi + sofor) arac karti: plaka beyaz bir
 * rozet/kutu OLMADAN, sadece yazi karakteri olarak gosterilir; saga
 * yaslanmis arac simgesinin hemen altinda da kucuk bir odeme modeli
 * rozeti (% / km) yer alir - "araç görseli" istegi icin SF Symbols'un
 * arac simgesi kullanildi (yeni bir gorsel/asset pipeline'i
 * gerektirmeden). Durum basligi (acik/kapali) kalin+buyuk harf+aralikli
 * bir "karakterle" govde metninden ayristirilir; soför adi/ipucu bunun
 * ALTINDA ayri bir satirda, acilis saati ise vardiya acikken kartin sag
 * ust kosesinde kucuk bir not olarak gosterilir.
 */
export function VehicleCard({ vehicle, statusLabel, statusActive, subLabel, openedAt }: Props) {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      {statusActive && openedAt ? (
        <ThemedView style={[styles.openedAtBadge, styles.transparentBg]}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.openedAtText}>
            Açılış {formatOpenedTime(openedAt)}
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
            <ThemedText type="small" themeColor="textSecondary" style={styles.subLabel}>
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
  rightColumn: { alignItems: 'center', gap: Spacing.half },
  statusText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  statusActiveText: { color: '#16A34A' },
  subLabel: { marginTop: Spacing.half },
  openedAtBadge: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.three,
  },
  openedAtText: { fontSize: 11 },
  plateText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 20,
    letterSpacing: 1,
  },
  carIcon: { marginRight: -Spacing.one },
});
