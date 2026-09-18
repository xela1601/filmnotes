import { Pressable, StyleSheet, Text, View } from "react-native";

import { FieldLabel } from "./FieldLabel";
import type { SelectOption } from "./SelectField";
import { useTheme } from "./theme";

export interface MultiSelectFieldProps<T> {
  label: string;
  values: T[];
  options: SelectOption<T>[];
  onChange: (values: T[]) => void;
  testID?: string;
}

/** Toggle chips – used for filter stacks, where several entries are normal. */
export function MultiSelectField<T extends string | number>({
  label,
  values,
  options,
  onChange,
  testID,
}: MultiSelectFieldProps<T>) {
  const { palette, fontSize } = useTheme();

  const toggle = (option: T) => {
    onChange(values.includes(option) ? values.filter((v) => v !== option) : [...values, option]);
  };

  return (
    <View testID={testID} style={styles.field}>
      <FieldLabel>{label}</FieldLabel>
      <View style={styles.chips}>
        {options.map((option) => {
          const active = values.includes(option.value);
          return (
            <Pressable
              key={String(option.value)}
              testID={testID === undefined ? undefined : `${testID}-option-${String(option.value)}`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
              onPress={() => toggle(option.value)}
              style={[
                styles.chip,
                {
                  borderColor: palette.border,
                  backgroundColor: active ? palette.primary : "transparent",
                },
              ]}
            >
              <Text
                style={{ color: active ? palette.onPrimary : palette.text, fontSize: fontSize.md }}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
});
