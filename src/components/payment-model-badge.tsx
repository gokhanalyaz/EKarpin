import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { paymentModelLabel, type Vehicle } from '@/lib/vehicles';

type Props = {
  vehicle: Pick<Vehicle, 'payment_model' | 'percentage_rate' | 'km_rate'>;
  /** true ise daha kucuk bir rozet olarak gosterilir (orn. ana ekran arac kartinda, arac simgesinin hemen altinda). */
  compact?: boolean;
};

/**
 * Aracin odeme modelini (yuzdelik/km) duz gri metin yerine kucuk, renkli
 * bir rozet olarak gosterir - ev sahibi/sofor ekranlarinda tutarli sekilde
 * kullanilsin diye tek bilesende toplandi.
 */
export function PaymentModelBadge({ vehicle, compact }: Props) {
  const isPercentage = vehicle.payment_model === 'percentage';
  return (
    <ThemedView style={[styles.badge, compact && styles.badgeCompact, isPercentage ? styles.percentage : styles.kmBased]}>
      <ThemedText
        type={compact ? 'small' : 'smallBold'}
        style={[isPercentage ? styles.percentageText : styles.kmBasedText, compact && styles.textCompact]}>
        {paymentModelLabel(vehicle)}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Spacing.one,
  },
  badgeCompact: {
    alignSelf: 'center',
    paddingHorizontal: Spacing.one,
    paddingVertical: 2,
  },
  percentage: { backgroundColor: '#FFC40033' },
  percentageText: { color: '#8A5B00' },
  kmBased: { backgroundColor: '#2563EB1F' },
  kmBasedText: { color: '#1D4ED8' },
  textCompact: { fontSize: 11, lineHeight: 14 },
});
