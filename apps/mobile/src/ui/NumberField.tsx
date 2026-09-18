import { useState } from "react";
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

/** The number a typed field means, or `null` while it is not a number (yet). */
function parseNumber(text: string): number | null {
  const trimmed = text.trim().replace(",", ".");
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
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

  /**
   * What the field shows, kept separately from `value`.
   *
   * A controlled `String(value)` ate the decimal point: typing "1.7" sent "1." through
   * `Number`, which is 1, and the re-render replaced the text with "1" - so an f/1.7 lens
   * became f/17. The text the user typed stays until it parses into a different number.
   */
  const [text, setText] = useState(value === null ? "" : String(value));

  // Adjusting state during render (the pattern React documents for exactly this) rather than in
  // an effect: a change that came from somewhere else - the steppers, a reset - is adopted, but
  // a half-typed number is never overwritten with its own parsed value.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    if (parseNumber(text) !== value) setText(value === null ? "" : String(value));
  }

  const bump = (delta: number) => {
    onChange(clamp((value ?? 0) + delta, min, max));
  };

  const parse = (typed: string) => {
    setText(typed);
    const parsed = parseNumber(typed);
    if (parsed === null) {
      if (typed.trim() === "") onChange(null);
      return;
    }
    onChange(clamp(parsed, min, max));
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
          value={text}
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
