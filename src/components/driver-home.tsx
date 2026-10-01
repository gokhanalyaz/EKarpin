import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { getAnyOpenShift } from '@/lib/shifts';
import { listAssignedVehicles, type Vehicle } from '@/lib/vehicles';

export function DriverHome() {
  const { profile } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [openByMe, setOpenByMe] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);

  const loadVehicles = useCallback(async () => {
    if (!profile) return;
    if (!hasLoadedRef.current) setLoading(true);
    try {
      const data = await listAssignedVehicles(profile.id);
      setVehicles(data);
      const statuses = await Promise.all(
        data.map(async (v) => {
          const open = await getAnyOpenShift(v.id).catch(() => null);
          return [v.id, open?.driver_id === profile.id] as const;
        })
      );
      setOpenByMe(Object.fromEntries(statuses));
    } catch (e) {
      console.warn('Araçlar yüklenemedi', e);
    } finally {
      setLoading(false);
      hasLoadedRef.current = true;
    }
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      loadVehicles();
    }, [loadVehicles])
  );

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="subtitle" style={styles.header}>
        Araçlarım
      </ThemedText>

      {loading ? (
        <ActivityIndicator style={styles.loading} />
      ) : (
        <FlatList
          data={vehicles}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
              Henüz hiçbir araca atanmadın. Araç sahibinin seni eklemesini bekle.
            </ThemedText>
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/shift/${item.id}`)}>
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="smallBold">{item.plate_no}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {item.payment_model === 'percentage'
                    ? `Yüzdelik sistem (%${item.percentage_rate ?? 25})`
                    : `Km sistemi (${item.km_rate ?? '-'} TL/km)`}
                </ThemedText>
                <ThemedText type="small" themeColor={openByMe[item.id] ? undefined : 'textSecondary'}>
                  {openByMe[item.id] ? 'Vardiyan açık — kapatmak için dokun' : 'Vardiya açmak için dokun'}
                </ThemedText>
              </ThemedView>
            </Pressable>
          )}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
    paddingBottom: Spacing.four,
  },
  header: { marginBottom: Spacing.three },
  loading: { marginTop: Spacing.four },
  list: { gap: Spacing.two, paddingBottom: Spacing.four, flexGrow: 1 },
  empty: { textAlign: 'center', marginTop: Spacing.five },
  card: { padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.half },
});
