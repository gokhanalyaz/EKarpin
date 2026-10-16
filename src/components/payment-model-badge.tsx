import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { Vehicle } from '@/lib/vehicles';

type Props = {
  vehicle: Vehicle;
  /** Küçük, araç ikonunun tam altına yapışan kompakt görünüm. */
  compact?: boolean;
};

export function PaymentModelBadge({ vehicle, compact }: Props) {
  const label =
    vehicle.payment_model === 'percentage'
      ? `%${vehicle.percentage_rate ?? 25}`
      : `${vehicle.km_rate ?? '-'} TL/km`;

  return (
    <View style={[styles.badge, compact && styles.badgeCompact]}>
      <ThemedText type="small" style={[styles.text, compact && styles.textCompact]}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: '#94A3B826',
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  badgeCompact: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  text: { fontSize: 13, fontWeight: '700' },
  textCompact: { fontSize: 11 },
});
