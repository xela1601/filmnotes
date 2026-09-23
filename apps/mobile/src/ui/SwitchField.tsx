import { StyleSheet, Switch, Text, View } from "react-native";

import { useTheme } from "./theme";
import { spacing } from "./themes";

export interface SwitchFieldProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  testID?: string;
}

export function SwitchField({ label, value, onChange, testID }: SwitchFieldProps) {
  const { palette, fontSize } = useTheme();

  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: palette.text, fontSize: fontSize.md }]}>{label}</Text>
      <Switch
        testID={testID}
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: palette.primary, false: palette.border }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  label: { flexShrink: 1 },
});
