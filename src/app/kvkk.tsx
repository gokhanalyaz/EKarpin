import { router } from 'expo-router';
import { useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet } from 'react-native';

import { LegalDocView } from '@/components/legal-doc-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { setKvkkAccepted } from '@/lib/kvkk-consent';
import { LEGAL_DOCS, type LegalDocKey } from '@/lib/legal-texts';

/** Kayıtta onaylanan metinler: Kullanım Koşulları + KVKK Aydınlatma + Açık Rıza. */
const SIGNUP_DOCS: LegalDocKey[] = ['kullanim', 'kvkk', 'acik-riza'];

const SCROLL_END_THRESHOLD = 24;

export default function KvkkScreen() {
  const [reachedEnd, setReachedEnd] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(0);

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (reachedEnd) return;
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distanceToBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    if (distanceToBottom <= SCROLL_END_THRESHOLD) {
      setReachedEnd(true);
    }
  }

  function handleContentSizeChange(_w: number, contentHeight: number) {
    // Metin ekrana sigiyorsa (kaydirmaya gerek yoksa) direkt onaya izin ver.
    if (viewportHeight > 0 && contentHeight <= viewportHeight + SCROLL_END_THRESHOLD) {
      setReachedEnd(true);
    }
  }

  function handleApprove() {
    setKvkkAccepted(true);
    router.back();
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="subtitle">Sözleşmeler ve Onaylar</ThemedText>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ThemedText type="linkPrimary">Kapat</ThemedText>
        </Pressable>
      </ThemedView>

      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
        onScroll={handleScroll}
        onContentSizeChange={handleContentSizeChange}
        scrollEventThrottle={32}>
        <ThemedText type="small" themeColor="textSecondary">
          Kayıt olmadan önce lütfen aşağıdaki metinleri sonuna kadar okuyun.
        </ThemedText>
        {SIGNUP_DOCS.map((key) => (
          <LegalDocView key={key} doc={LEGAL_DOCS[key]} />
        ))}
      </ScrollView>

      <ThemedView style={styles.footer}>
        {!reachedEnd && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.footerHint}>
            Onaylamak için lütfen metnin sonuna kadar kaydırın.
          </ThemedText>
        )}
        <Pressable
          style={({ pressed }) => [
            styles.approveButton,
            !reachedEnd && styles.approveButtonDisabled,
            pressed && reachedEnd && styles.buttonPressed,
          ]}
          disabled={!reachedEnd}
          onPress={handleApprove}>
          <ThemedText type="linkPrimary" style={styles.approveButtonText}>
            Okudum, Onaylıyorum
          </ThemedText>
        </Pressable>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing.four, paddingTop: Spacing.six },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  scroll: { paddingBottom: Spacing.six, gap: Spacing.two },
  paragraph: { marginBottom: Spacing.three, lineHeight: 20 },
  note: { marginTop: Spacing.two, fontStyle: 'italic' },
  footer: { paddingTop: Spacing.two, paddingBottom: Spacing.four, gap: Spacing.two },
  footerHint: { textAlign: 'center' },
  approveButton: {
    backgroundColor: Brand.primary,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  approveButtonDisabled: { opacity: 0.4 },
  approveButtonText: { color: Brand.onPrimary, fontWeight: '700' },
  buttonPressed: { opacity: 0.7 },
});
