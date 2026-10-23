import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { LegalDocView } from '@/components/legal-doc-view';
import { SafeScreen } from '@/components/safe-screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { LEGAL_DOCS, type LegalDocKey } from '@/lib/legal-texts';

/** Tek bir hukuki metni gösteren ekran: /legal?doc=gizlilik | kullanim | kvkk | acik-riza */
export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const theme = useTheme();
  const legalDoc = LEGAL_DOCS[(doc as LegalDocKey) ?? 'gizlilik'] ?? LEGAL_DOCS.gizlilik;

  return (
    <SafeScreen>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => router.back()} style={styles.back}>
          <SymbolView name="chevron.left" size={20} tintColor={theme.text} />
        </Pressable>
        <ThemedText type="smallBold" style={styles.headerTitle} numberOfLines={1}>
          {legalDoc.title}
        </ThemedText>
        <View style={styles.back} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <LegalDocView doc={legalDoc} />
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  back: { width: 36, height: 36, justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16 },
  content: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.six },
});
