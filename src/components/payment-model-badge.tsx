import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { paymentModelLabel, type Vehicle } from '@/lib/vehicles';

type Props = {
  vehicle: Pick<Vehicle, 'payment_model' | 'percentage_rate' | 'km_rate'>;
};

/**
 * Aracin odeme modelini (yuzdelik/km) duz gri metin yerine kucuk, renkli
 * bir rozet olarak gosterir - ev sahibi/sofor ekranlarinda tutarli sekilde
 * kullanilsin diye tek bilesende toplandi.
 */
export function PaymentModelBadge({ vehicle }: Props) {
  const isPercentage = vehicle.payment_model === 'percentage';
  return (
    <ThemedView style={[styles.badge, isPercentage ? styles.percentage : styles.kmBased]}>
      <ThemedText type="smallBold" style={isPercentage ? styles.percentageText : styles.kmBasedText}>
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
  percentage: { backgroundColor: '#FFC40033' },
  percentageText: { color: '#8A5B00' },
  kmBased: { backgroundColor: '#2563EB1F' },
  kmBasedText: { color: '#1D4ED8' },
});
