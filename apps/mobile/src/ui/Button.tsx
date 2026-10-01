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

/**
 * The app's one button.
 *
 * `danger` is an outline in the danger colour, not a filled block: deleting a roll is the action
 * the screen should be least eager to offer, and a red fill made it the loudest thing on it
 * (T-026). Every variant answers a press - outdoors, one-handed, a tap without feedback reads as
 * a tap that missed.
 */
export function Button({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  testID,
}: ButtonProps) {
  const { palette, fontSize } = useTheme();

  const filled = variant === "primary";
  const label = filled ? palette.onPrimary : variant === "danger" ? palette.danger : palette.text;
  const border = filled ? palette.primary : variant === "danger" ? palette.danger : palette.border;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: filled ? palette.primary : pressed ? palette.surface : "transparent",
          borderColor: border,
          opacity: disabled ? 0.45 : pressed && filled ? 0.82 : 1,
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
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontWeight: fontWeight.semibold },
});
