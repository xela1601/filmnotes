import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "./theme";
import { fontWeight, letterSpacing, radius, spacing } from "./themes";

export interface SectionProps {
  title: string;
  children?: ReactNode;
  testID?: string;
}

/** A labelled group of fields. */
export function Section({ title, children, testID }: SectionProps) {
  const { palette, fontSize } = useTheme();

  return (
    <View testID={testID} style={styles.section}>
      <Text style={[styles.title, { color: palette.textMuted, fontSize: fontSize.sm }]}>
        {title.toUpperCase()}
      </Text>
      <View
        style={[styles.body, { backgroundColor: palette.surface, borderColor: palette.border }]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  title: { fontWeight: fontWeight.semibold, letterSpacing: letterSpacing.wide },
  body: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.lg,
  },
});
