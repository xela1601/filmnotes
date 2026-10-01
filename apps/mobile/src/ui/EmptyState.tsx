import { StyleSheet, Text, View } from "react-native";

import { Button } from "./Button";
import { useTheme } from "./theme";
import { fontWeight, spacing } from "./themes";

export interface EmptyStateProps {
  title: string;
  hint?: string;
  /** The next step, where there is an obvious one - an empty screen should not be a dead end. */
  action?: { title: string; onPress: () => void };
  testID?: string;
}

export function EmptyState({ title, hint, action, testID }: EmptyStateProps) {
  const { palette, fontSize } = useTheme();

  return (
    <View testID={testID} style={styles.container}>
      <Text style={[styles.title, { color: palette.text, fontSize: fontSize.lg }]}>{title}</Text>
      {hint !== undefined && (
        <Text style={[styles.hint, { color: palette.textMuted, fontSize: fontSize.md }]}>
          {hint}
        </Text>
      )}
      {action !== undefined && (
        <View style={styles.action}>
          <Button
            title={action.title}
            onPress={action.onPress}
            testID={testID === undefined ? undefined : `${testID}-action`}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
  title: { fontWeight: fontWeight.semibold, textAlign: "center" },
  hint: { textAlign: "center", maxWidth: 360 },
  action: { marginTop: spacing.md, alignSelf: "stretch" },
});
