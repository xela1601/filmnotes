import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "./theme";
import { fontWeight, spacing } from "./themes";

export interface ListItemProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  /** The last row of a card: the card's own edge ends it, a divider there would be a second line. */
  last?: boolean;
  testID?: string;
}

/** A row; one that leads somewhere says so with a chevron and answers the press. */
export function ListItem({ title, subtitle, right, onPress, last = false, testID }: ListItemProps) {
  const { palette, fontSize } = useTheme();
  const navigates = onPress !== undefined;

  return (
    <Pressable
      testID={testID}
      accessibilityRole={navigates ? "button" : undefined}
      disabled={!navigates}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          borderColor: palette.border,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
          backgroundColor: pressed ? palette.surface : "transparent",
        },
      ]}
    >
      <View style={styles.texts}>
        <Text style={[styles.title, { color: palette.text, fontSize: fontSize.md }]}>{title}</Text>
        {subtitle !== undefined && (
          <Text style={{ color: palette.textMuted, fontSize: fontSize.sm }}>{subtitle}</Text>
        )}
      </View>
      <View style={styles.end}>
        {right}
        {navigates && (
          <Ionicons
            testID={testID === undefined ? undefined : `chevron-${testID}`}
            name="chevron-forward"
            size={18}
            color={palette.textMuted}
          />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  texts: { flexShrink: 1, gap: spacing.xs },
  title: { fontWeight: fontWeight.semibold },
  end: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
});
