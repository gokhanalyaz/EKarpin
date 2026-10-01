import { SymbolView } from 'expo-symbols';
import { StyleSheet } from 'react-native';

import { PaymentModelBadge } from '@/components/payment-model-badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, FontFamily, Spacing } from '@/constants/theme';
import type { Vehicle } from '@/lib/vehicles';

type Props = {
  vehicle: Vehicle;
  /** Vardiya durumu satiri (orn. "Vardiya açık — Ahmet" / "Vardiya kapalı"). */
  statusText: string;
  /** true ise durum metni vurgulu (normal metin) renkte, degilse ikincil gri renkte gosterilir. */
  statusActive?: boolean;
};

/**
 * Ana ekranlardaki (ev sahibi + sofor) arac karti: plaka gercek bir plaka
 * gibi beyaz rozette, saga yaslanmis buyuk bir arac simgesiyle birlikte
 * gosterilir - "araç görseli" istegi icin SF Symbols'un arac simgesi
 * kullanildi (yeni bir gorsel/asset pipeline'i gerektirmeden).
 */
export function VehicleCard({ vehicle, statusText, statusActive }: Props) {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedView style={[styles.content, styles.transparentBg]}>
        <PaymentModelBadge vehicle={vehicle} />
        <ThemedText type="small" themeColor={statusActive ? undefined : 'textSecondary'}>
          {statusText}
        </ThemedText>
        <ThemedView style={styles.plate}>
          <ThemedText style={styles.plateText}>{vehicle.plate_no}</ThemedText>
        </ThemedView>
      </ThemedView>
      <SymbolView name="car.side.fill" size={84} tintColor={Brand.primary} style={styles.carIcon} />
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
  plate: {
    backgroundColor: '#FFFFFF',
    borderRadius: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderWidth: 1,
    borderColor: '#D4D4D8',
    marginTop: Spacing.one,
  },
  plateText: {
    color: '#111111',
    fontFamily: FontFamily.bodyBold,
    fontSize: 20,
    letterSpacing: 1,
  },
  carIcon: { marginRight: -Spacing.one },
});
