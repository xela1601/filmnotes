import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "./theme";
import { spacing } from "./themes";

export interface ScreenProps {
  title?: string;
  /** Wrap the content in a ScrollView (default: true). */
  scroll?: boolean;
  children?: ReactNode;
  testID?: string;
}

/** Safe-area aware page container with padding and an optional header title. */
export function Screen({ title, scroll = true, children, testID }: ScreenProps) {
  const { palette, spacing, fontSize } = useTheme();
  const insets = useSafeAreaInsets();

  const content = (
    <>
      {title !== undefined && (
        <Text style={[styles.title, { color: palette.text, fontSize: fontSize.xl }]}>{title}</Text>
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
  title: { fontWeight: "700" },
});
