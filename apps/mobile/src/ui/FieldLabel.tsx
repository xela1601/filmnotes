import { StyleSheet, Text } from "react-native";

import { useTheme } from "./theme";
import { fontWeight } from "./themes";

/** Shared label above a form field. */
export function FieldLabel({ children }: { children: string }) {
  const { palette, fontSize } = useTheme();
  return (
    <Text style={[styles.label, { color: palette.textMuted, fontSize: fontSize.sm }]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: { fontWeight: fontWeight.semibold },
});
