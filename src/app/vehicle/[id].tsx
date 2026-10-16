import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { PaymentModelBadge } from '@/components/payment-model-badge';
import { ShiftHistoryList } from '@/components/shift-history-list';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getVehicle, type Vehicle } from '@/lib/vehicles';

export default function VehicleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);

  const load = useCallback(async () => {
    if (!id) return;
    if (!hasLoadedRef.current) setLoading(true);
    try {
      const v = await getVehicle(id);
      setVehicle(v);
    } catch (e) {
      console.warn('Araç detayı yüklenemedi', e);
    } finally {
      setLoading(false);
      hasLoadedRef.current = true;
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading || !vehicle) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedView style={[styles.titleRow, styles.transparentBg]}>
        <ThemedText type="title" style={styles.title}>
          {vehicle.plate_no}
        </ThemedText>
        <Pressable
          hitSlop={12}
          onPress={() => router.push(`/vehicle-settings/${vehicle.id}`)}
          style={({ pressed }) => pressed && styles.buttonPressed}>
          <SymbolView name="gearshape" size={24} tintColor={theme.text} />
        </Pressable>
      </ThemedView>
      <PaymentModelBadge vehicle={vehicle} />

      <ThemedText type="eyebrow" style={styles.sectionTitle}>
        Vardiya Geçmişi
      </ThemedText>
      <ShiftHistoryList vehicle={vehicle} showFilters />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { paddingHorizontal: Spacing.four, paddingTop: Spacing.six, paddingBottom: Spacing.six, gap: Spacing.two },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  transparentBg: { backgroundColor: 'transparent' },
  title: { flex: 1 },
  sectionTitle: { marginTop: Spacing.six },
  buttonPressed: { opacity: 0.7 },
});
