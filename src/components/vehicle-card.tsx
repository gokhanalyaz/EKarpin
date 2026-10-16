import { StyleSheet, View } from 'react-native';

import { PaymentModelBadge } from '@/components/payment-model-badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { Vehicle } from '@/lib/vehicles';

type Props = {
  vehicle: Vehicle;
  /** "VARDİYA AÇIK" / "VARDİYA KAPALI" gibi durum yazısı. */
  statusLabel: string;
  /** true ise statusLabel yeşil renkte gösterilir (vardiya açık anlaminda). */
  statusActive?: boolean;
  /** Durumun altına yazilan ikinci satir - örn. şoförün adı. */
  subLabel?: string;
  /** Köşeye not edilen saat etiketi: "Açılış" veya "Kapanış". */
  cornerTimeLabel?: 'Açılış' | 'Kapanış';
  /** Köşedeki saatin ISO zaman damgası. */
  cornerTimeIso?: string;
};

/** Bugunse sadece saat, degilse (1+ gun farkli) tarih + saat gosterir. */
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

export function VehicleCard({ vehicle, statusLabel, statusActive, subLabel, cornerTimeLabel, cornerTimeIso }: Props) {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      {cornerTimeIso && cornerTimeLabel && (
        <View style={styles.cornerBadge}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.cornerText}>
            {cornerTimeLabel}: {formatCornerTime(cornerTimeIso)}
          </ThemedText>
        </View>
      )}

      <View style={styles.row}>
        <View style={styles.leftColumn}>
          <ThemedText type="smallBold" style={styles.plate}>
            {vehicle.plate_no}
          </ThemedText>
          <ThemedText type="small" style={[styles.statusText, statusActive && styles.statusActiveText]}>
            {statusLabel}
          </ThemedText>
          {subLabel && (
            <ThemedText type="smallBold" style={styles.subLabel}>
              {subLabel}
            </ThemedText>
          )}
        </View>

        <View style={styles.rightColumn}>
          <ThemedText style={styles.carIcon}>🚗</ThemedText>
          <PaymentModelBadge vehicle={vehicle} compact />
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, borderRadius: Spacing.two },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  leftColumn: { flex: 1, gap: Spacing.half, paddingRight: Spacing.two },
  plate: { fontSize: 18 },
  cornerBadge: { position: 'absolute', top: Spacing.two, right: Spacing.three, zIndex: 1 },
  cornerText: { fontSize: 11, fontWeight: '700' },
  statusText: {
    marginTop: Spacing.one,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 13,
  },
  statusActiveText: { color: '#16A34A' },
  subLabel: { marginTop: Spacing.two },
  rightColumn: { alignItems: 'center', gap: 0 },
  carIcon: { fontSize: 32, marginBottom: -14 },
});
