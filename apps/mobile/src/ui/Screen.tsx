import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "./theme";
import { fontWeight, spacing } from "./themes";

export interface ScreenProps {
  /**
   * The large title at the top of the content - for the tab roots, which have no header (T-026).
   * A pushed screen has its title in the navigation header and passes none here.
   */
  title?: string;
  /** Next to the large title, e.g. the "+" that adds to the list below it. */
  titleAction?: ReactNode;
  /** Wrap the content in a ScrollView (default: true). */
  scroll?: boolean;
  children?: ReactNode;
  testID?: string;
}

/** Safe-area aware page container with padding and an optional header title. */
export function Screen({ title, titleAction, scroll = true, children, testID }: ScreenProps) {
  const { palette, spacing, fontSize } = useTheme();
  const insets = useSafeAreaInsets();

  const content = (
    <>
      {title !== undefined && (
        <View style={styles.titleRow}>
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: palette.text, fontSize: fontSize.xl }]}
          >
            {title}
          </Text>
          {titleAction}
        </View>
      )}
      {children}
    </>
  );

  const padding = {
    paddingTop: insets.top + spacing.lg,
    paddingBottom: insets.bottom + spacing.lg,
    paddingLeft: insets.left + spacing.lg,
    paddingRight: insets.right + spacing.lg,
  };

  if (scroll) {
    return (
      <ScrollView
        testID={testID}
        style={{ backgroundColor: palette.background }}
        contentContainerStyle={[styles.container, padding]}
      >
        {content}
      </ScrollView>
    );
  }

  return (
    <View
      testID={testID}
      style={[styles.flex, styles.container, padding, { backgroundColor: palette.background }]}
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { gap: spacing.lg },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  title: { flexShrink: 1, fontWeight: fontWeight.bold },
});
