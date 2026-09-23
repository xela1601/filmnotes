import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "./theme";
import { spacing } from "./themes";

export interface EmptyStateProps {
  title: string;
  hint?: string;
  testID?: string;
}

export function EmptyState({ title, hint, testID }: EmptyStateProps) {
  const { palette, fontSize } = useTheme();

  return (
    <View testID={testID} style={styles.container}>
      <Text style={[styles.title, { color: palette.text, fontSize: fontSize.lg }]}>{title}</Text>
      {hint !== undefined && (
        <Text style={[styles.hint, { color: palette.textMuted, fontSize: fontSize.md }]}>
          {hint}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
  title: { fontWeight: "600", textAlign: "center" },
  hint: { textAlign: "center" },
});
