import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { formatDateTime } from '@/components/shift-history-list';
import { PhotoViewButton } from '@/components/photo-view-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { listVehicleAlerts, type VehicleAlert } from '@/lib/vehicle-alerts';
import { listVehicleDrivers } from '@/lib/vehicle-drivers';

type Props = {
  vehicleId: string;
};

/** Araç sahibinin, şoförlerden gelen "araç sahibine bildir" kayıtlarını görebildiği liste. */
export function VehicleAlertList({ vehicleId }: Props) {
  const [alerts, setAlerts] = useState<VehicleAlert[]>([]);
  const [driverNames, setDriverNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listVehicleAlerts(vehicleId), listVehicleDrivers(vehicleId)])
      .then(([alertRows, driverRows]) => {
        if (cancelled) return;
        setAlerts(alertRows);
        const map: Record<string, string> = {};
        driverRows.forEach((row) => {
          map[row.driver_id] = row.driver?.full_name ?? 'İsimsiz';
        });
        setDriverNames(map);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  if (loading || alerts.length === 0) return null;

  return (
    <ThemedView style={styles.wrapper}>
      <ThemedText type="eyebrow" style={styles.title}>
        Şoför Bildirimleri
      </ThemedText>
      <ThemedView style={styles.list}>
      {alerts.map((a) => (
        <ThemedView key={a.id} type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">{driverNames[a.driver_id] ?? 'Şoför'}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.date}>
            {formatDateTime(a.created_at)}
          </ThemedText>
          <ThemedText type="small">{a.note}</ThemedText>
          {a.photo_url && <PhotoViewButton path={a.photo_url} label="Fotoğrafı Gör" />}
        </ThemedView>
      ))}
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: Spacing.two },
  title: { marginBottom: Spacing.two },
  list: { gap: Spacing.two },
  card: { padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.half, borderLeftWidth: 3, borderLeftColor: '#DC2626' },
  date: { marginBottom: Spacing.half },
});
