import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { GroupCard, GroupFooter, GroupRow } from '@/components/grouped-list';
import { LegalDocView } from '@/components/legal-doc-view';
import { goBackOrHome } from '@/lib/navigation';
import { SafeScreen } from '@/components/safe-screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { LEGAL_DOCS, type LegalDocKey } from '@/lib/legal-texts';

/**
 * /legal            -> Yasal Metinler listesi (dört metin tek menüde)
 * /legal?doc=...    -> tek bir metin (gizlilik | kullanim | kvkk | acik-riza)
 * Açık Rıza Metni KVKK gereği diğer metinlerle birleştirilemez; bu yüzden
 * tek menü altında ama ayrı belgeler olarak duruyor.
 */
export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const theme = useTheme();
  const legalDoc = doc ? LEGAL_DOCS[doc as LegalDocKey] ?? null : null;

  if (!legalDoc) {
    const order: LegalDocKey[] = ['gizlilik', 'kullanim', 'kvkk', 'acik-riza'];
    return (
      <SafeScreen>
        <View style={styles.header}>
          <Pressable hitSlop={12} onPress={goBackOrHome} style={styles.back}>
            <SymbolView name="chevron.left" size={20} tintColor={theme.text} />
          </Pressable>
          <ThemedText type="smallBold" style={styles.headerTitle}>
            Yasal Metinler
          </ThemedText>
          <View style={styles.back} />
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <GroupCard>
            {order.map((key, i) => (
              <GroupRow
                key={key}
                title={LEGAL_DOCS[key].title}
                chevron
                divider={i < order.length - 1}
                onPress={() => router.push(`/legal?doc=${key}` as any)}
              />
            ))}
          </GroupCard>
          <GroupFooter>Kayıt olurken onayladığın metinler. İstediğin zaman buradan okuyabilirsin.</GroupFooter>
        </ScrollView>
      </SafeScreen>
    );
  }

  return (
    <SafeScreen>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={goBackOrHome} style={styles.back}>
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
