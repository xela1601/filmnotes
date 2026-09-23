import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "./theme";
import { fontWeight, spacing } from "./themes";

export interface ListItemProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  testID?: string;
}

export function ListItem({ title, subtitle, right, onPress, testID }: ListItemProps) {
  const { palette, fontSize } = useTheme();

  return (
    <Pressable
      testID={testID}
      accessibilityRole={onPress === undefined ? undefined : "button"}
      disabled={onPress === undefined}
      onPress={onPress}
      style={[styles.row, { borderColor: palette.border }]}
    >
      <View style={styles.texts}>
        <Text style={[styles.title, { color: palette.text, fontSize: fontSize.md }]}>{title}</Text>
        {subtitle !== undefined && (
          <Text style={{ color: palette.textMuted, fontSize: fontSize.sm }}>{subtitle}</Text>
        )}
      </View>
      {right}
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
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  texts: { flexShrink: 1, gap: spacing.xs },
  title: { fontWeight: fontWeight.semibold },
});
