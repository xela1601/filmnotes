import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { FieldLabel } from "./FieldLabel";
import { useTheme } from "./theme";

export interface NumberFieldProps {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  /** Increment of the -/+ buttons (default 1). */
  step?: number;
  min?: number;
  max?: number;
  testID?: string;
}

function clamp(value: number, min: number | undefined, max: number | undefined): number {
  if (min !== undefined && value < min) return min;
  if (max !== undefined && value > max) return max;
  return value;
}

/** Numeric input with large -/+ tap targets (usable with cold fingers). */
export function NumberField({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
  testID,
}: NumberFieldProps) {
  const { palette, fontSize } = useTheme();

  const bump = (delta: number) => {
    onChange(clamp((value ?? 0) + delta, min, max));
  };

  const parse = (text: string) => {
    const trimmed = text.trim().replace(",", ".");
    if (trimmed === "") {
      onChange(null);
      return;
    }
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) onChange(clamp(parsed, min, max));
  };

  return (
    <View style={styles.field}>
      <FieldLabel>{label}</FieldLabel>
      <View style={styles.row}>
        <Pressable
          testID={testID === undefined ? undefined : `${testID}-decrement`}
          accessibilityRole="button"
          accessibilityLabel={`${label} -`}
          onPress={() => bump(-step)}
          style={[styles.stepper, { borderColor: palette.border }]}
        >
          <Text style={{ color: palette.text, fontSize: fontSize.lg }}>−</Text>
        </Pressable>
        <TextInput
          testID={testID}
          accessibilityLabel={label}
          value={value === null ? "" : String(value)}
          onChangeText={parse}
          keyboardType="numeric"
          style={[
            styles.input,
            { color: palette.text, borderColor: palette.border, fontSize: fontSize.md },
          ]}
        />
        <Pressable
          testID={testID === undefined ? undefined : `${testID}-increment`}
          accessibilityRole="button"
          accessibilityLabel={`${label} +`}
          onPress={() => bump(step)}
          style={[styles.stepper, { borderColor: palette.border }]}
        >
          <Text style={{ color: palette.text, fontSize: fontSize.lg }}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepper: {
    width: 48,
    height: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    paddingHorizontal: 12,
    minHeight: 44,
    textAlign: "center",
  },
});
