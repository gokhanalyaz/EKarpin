import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet } from 'react-native';

import { SafeScreen } from '@/components/safe-screen';
import { goBackOrHome } from '@/lib/navigation';
import { ShiftCloseForm } from '@/components/shift-close-form';
import { ShiftHistoryList } from '@/components/shift-history-list';
import { ShiftOpenForm } from '@/components/shift-open-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VehicleAlertForm } from '@/components/vehicle-alert-form';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { getAnyOpenShift, getOpenShiftForDriver, type Shift } from '@/lib/shifts';
import { getVehicle, type Vehicle } from '@/lib/vehicles';

export default function ShiftScreen() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const { profile } = useAuth();
  const theme = useTheme();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [myOpenShift, setMyOpenShift] = useState<Shift | null>(null);
  const [otherOpenShift, setOtherOpenShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAlertForm, setShowAlertForm] = useState(false);
  const hasLoadedRef = useRef(false);

  const load = useCallback(async () => {
    if (!vehicleId || !profile) return;
    if (!hasLoadedRef.current) setLoading(true);
    try {
      const [v, anyOpen] = await Promise.all([
        getVehicle(vehicleId),
        getAnyOpenShift(vehicleId),
      ]);
      setVehicle(v);
      if (anyOpen && anyOpen.driver_id === profile.id) {
        setMyOpenShift(anyOpen);
        setOtherOpenShift(null);
      } else if (anyOpen) {
        setMyOpenShift(null);
        setOtherOpenShift(anyOpen);
      } else {
        setMyOpenShift(null);
        setOtherOpenShift(null);
      }
    } catch (e) {
      console.warn('Vardiya bilgisi yüklenemedi', e);
    } finally {
      setLoading(false);
      hasLoadedRef.current = true;
    }
  }, [vehicleId, profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading || !vehicle) {
    return (
      <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (otherOpenShift) {
    return (
      <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.two }}>
        <ThemedText type="title" style={{ textAlign: 'center' }}>
          Araç Şu An Kullanımda
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
          Bu aracın vardiyası şu anda açık. Devralabilmen için önce mevcut şoförün vardiyayı
          kapatıp sana teslim etmesi gerekiyor.
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <SafeScreen>
    <ThemedView style={styles.topBar}>
      <Pressable hitSlop={12} onPress={goBackOrHome} style={styles.backButton} accessibilityLabel="Geri">
        <SymbolView name="chevron.left" size={20} tintColor={theme.text} />
      </Pressable>
    </ThemedView>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: Spacing.four, paddingBottom: Spacing.six }}
        keyboardShouldPersistTaps="handled">
        {myOpenShift ? (
          <>
            <ShiftCloseForm shift={myOpenShift} vehicle={vehicle} onClosed={load} />
            {showAlertForm ? (
              <VehicleAlertForm
                vehicle={vehicle}
                shiftId={myOpenShift.id}
                onClose={() => setShowAlertForm(false)}
              />
            ) : (
              <Pressable style={styles.alertToggle} onPress={() => setShowAlertForm(true)}>
                <ThemedText type="linkPrimary" style={styles.alertToggleText}>
                  ⚠️ Araç Sahibine Bildir
                </ThemedText>
              </Pressable>
            )}
          </>
        ) : (
          <ShiftOpenForm vehicle={vehicle} onOpened={load} />
        )}

        <ThemedText type="smallBold" style={{ marginTop: Spacing.six, marginBottom: Spacing.two }}>
          Vardiya Geçmişi
        </ThemedText>
        <ShiftHistoryList vehicle={vehicle} />
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  topBar: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, backgroundColor: 'transparent' },
  backButton: { width: 36, height: 36, justifyContent: 'center' },
  alertToggle: { alignItems: 'center', marginTop: Spacing.three, paddingVertical: Spacing.two },
  alertToggleText: { color: '#DC2626' },
});
