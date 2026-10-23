import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { LEGAL_UPDATED_AT, type LegalDoc } from '@/lib/legal-texts';

/** Bir hukuki metni (başlık + bölümler) okunaklı şekilde gösterir. */
export function LegalDocView({ doc, showTitle = true }: { doc: LegalDoc; showTitle?: boolean }) {
  return (
    <View style={styles.doc}>
      {showTitle && (
        <ThemedText type="subtitle" style={styles.docTitle}>
          {doc.title}
        </ThemedText>
      )}
      {doc.sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <ThemedText type="smallBold">{section.heading}</ThemedText>
          <ThemedText type="small" style={styles.body}>
            {section.body}
          </ThemedText>
        </View>
      ))}
      <ThemedText type="small" themeColor="textSecondary" style={styles.updated}>
        Son güncelleme: {LEGAL_UPDATED_AT}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  doc: { gap: Spacing.three },
  docTitle: { marginTop: Spacing.two },
  section: { gap: Spacing.one },
  body: { lineHeight: 21 },
  updated: { fontSize: 12 },
});
