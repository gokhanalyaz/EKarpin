import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet } from 'react-native';

import { ShiftHistoryCard } from '@/components/shift-history-list';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { getShift, type Shift } from '@/lib/shifts';
import { getSettlementLabel, getSettlementState, markDeliveredAndNotify, markReceivedAndNotify } from '@/lib/settlement';
import { listVehicleDrivers } from '@/lib/vehicle-drivers';
import { getVehicle, type Vehicle } from '@/lib/vehicles';

export default function ShiftDetailScreen() {
  const { shiftId } = useLocalSearchParams<{ shiftId: string }>();
  const { profile } = useAuth();
  const isOwner = profile?.role === 'owner';
  const [shift, setShift] = useState<Shift | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [driverName, setDriverName] = useState<string>('Şoför');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!shiftId) return;
    setLoading(true);
    try {
      const s = await getShift(shiftId);
      if (!s) {
        setNotFound(true);
        return;
      }
      setShift(s);
      const v = await getVehicle(s.vehicle_id);
      setVehicle(v);
      const drivers = await listVehicleDrivers(s.vehicle_id).catch(() => []);
      const found = drivers.find((d) => d.driver_id === s.driver_id);
      setDriverName(found?.driver?.full_name ?? 'Şoför');
    } catch (e) {
      console.warn('Vardiya detayı yüklenemedi', e);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [shiftId]);

  async function handleConfirmSettlement() {
    if (!shift) return;
    // Anında geri bildirim icin: ag cevabini beklemeden ekrani guncelle,
    // basarisiz olursa geri al.
    const previousShift = shift;
    const now = new Date().toISOString();
    setShift({
      ...shift,
      ...(isOwner ? { owner_confirmed_received_at: now } : { driver_marked_delivered_at: now }),
    });
    try {
      if (isOwner) {
        await markReceivedAndNotify([shift]);
      } else {
        await markDeliveredAndNotify([shift], profile?.full_name ?? 'Bir şoför');
      }
      load().catch(() => {});
    } catch (e: any) {
      setShift(previousShift);
      Alert.alert('İşlem başarısız', e?.message ?? 'Bilinmeyen hata oluştu.');
    }
  }

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (notFound || !shift || !vehicle) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText type="small" themeColor="textSecondary">
          Vardiya bulunamadı.
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText type="title" style={styles.title}>
        {vehicle.plate_no}
      </ThemedText>

      <ShiftHistoryCard
        shift={shift}
        driverName={driverName}
        vehicle={vehicle}
        pressable={false}
        settlement={
          shift.status === 'closed'
            ? (() => {
                const state = getSettlementState(shift);
                const canAct = isOwner ? state !== 'confirmed' : state === 'pending';
                const numLabel = shift.shift_no != null ? `#${shift.shift_no} numaralı karpini` : 'bu karpini';
                return {
                  state,
                  label: getSettlementLabel(state, isOwner ? 'owner' : 'driver'),
                  onConfirm: canAct ? handleConfirmSettlement : undefined,
                  confirmTitle: isOwner ? 'Teslim Aldınız mı?' : 'Teslim Ettiniz mi?',
                  confirmMessage: isOwner
                    ? `${numLabel} teslim aldığınızı onaylıyor musunuz?`
                    : `${numLabel} teslim ettiğinizi onaylıyor musunuz?`,
                  confirmButtonLabel: isOwner ? 'Teslim Aldım' : 'Teslim Ettim',
                };
              })()
            : undefined
        }
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: Spacing.four, gap: Spacing.three },
  title: { textAlign: 'center', marginBottom: Spacing.two },
});
