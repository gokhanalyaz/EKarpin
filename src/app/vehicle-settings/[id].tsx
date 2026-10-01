import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DEFAULT_EXPENSE_CATEGORIES, EXPENSE_CATEGORIES } from '@/lib/expense-categories';
import { getVehicle, setEnabledExpenseCategories, type Vehicle } from '@/lib/vehicles';

/** Aracin ayar sayfasi - su an sadece gider kategorileri burada, ileride
 * baska arac ayarlari da buraya eklenebilir. Vardiya kapatirken hangi
 * masraf kalemlerinin gorunecegini, odeme modelinden bagimsiz olarak
 * (yuzdelik veya km sistemi fark etmez) burada secebilirsin. */
export default function VehicleSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const v = await getVehicle(id);
      setVehicle(v);
    } catch (e) {
      console.warn('Araç ayarları yüklenemedi', e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleToggle(key: string) {
    if (!vehicle) return;
    const current = vehicle.enabled_expense_categories ?? DEFAULT_EXPENSE_CATEGORIES;
    const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
    setVehicle({ ...vehicle, enabled_expense_categories: next });
    try {
      await setEnabledExpenseCategories(vehicle.id, next);
    } catch (e: any) {
      setVehicle({ ...vehicle, enabled_expense_categories: current });
      Alert.alert('Kaydedilemedi', e?.message ?? 'Bilinmeyen hata oluştu.');
    }
  }

  if (loading || !vehicle) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  const keys = vehicle.enabled_expense_categories ?? DEFAULT_EXPENSE_CATEGORIES;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Ayarlar
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.plate}>
        {vehicle.plate_no}
      </ThemedText>

      <ThemedText type="eyebrow" style={styles.sectionTitle}>
        Gider Kategorileri
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Şoför vardiya kapatırken hangi masraf kalemlerini görsün? (Yüzdelik veya km sistemi fark
        etmez, tüm araçlarda geçerlidir.)
      </ThemedText>
      <ThemedView style={styles.chipRow}>
        {EXPENSE_CATEGORIES.map((cat) => {
          const enabled = keys.includes(cat.key);
          return (
            <Pressable
              key={cat.key}
              onPress={() => handleToggle(cat.key)}
              style={[styles.chip, { borderColor: theme.backgroundSelected }, enabled && styles.chipOn]}>
              <ThemedText type="small" style={enabled ? styles.chipTextOn : undefined}>
                {enabled ? '✓ ' : ''}
                {cat.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { paddingHorizontal: Spacing.four, paddingTop: Spacing.six, paddingBottom: Spacing.six },
  title: { marginBottom: Spacing.one },
  plate: { marginBottom: Spacing.four },
  sectionTitle: { marginBottom: Spacing.one },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.three },
  chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: 999, borderWidth: 1 },
  chipOn: { backgroundColor: '#2563EB1F', borderColor: '#2563EB' },
  chipTextOn: { color: '#1D4ED8', fontFamily: FontFamily.bodyBold },
});
