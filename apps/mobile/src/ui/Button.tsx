import { Pressable, StyleSheet, Text } from "react-native";

import { useTheme } from "./theme";
import { fontWeight, radius, spacing } from "./themes";

export type ButtonVariant = "primary" | "secondary" | "danger";

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  testID?: string;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  testID,
}: ButtonProps) {
  const { palette, fontSize } = useTheme();

  const background =
    variant === "primary" ? palette.primary : variant === "danger" ? palette.danger : "transparent";
  const label = variant === "secondary" ? palette.text : palette.onPrimary;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        {
          backgroundColor: background,
          borderColor: variant === "secondary" ? palette.border : background,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <Text style={[styles.label, { color: label, fontSize: fontSize.md }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontWeight: fontWeight.semibold },
});
