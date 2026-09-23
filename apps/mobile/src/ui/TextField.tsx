import { StyleSheet, TextInput, View } from "react-native";

import { FieldLabel } from "./FieldLabel";
import { useTheme } from "./theme";
import { radius, spacing } from "./themes";

export interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
  /** Masks the input and keeps it out of autocorrect and autocapitalisation. */
  secret?: boolean;
  testID?: string;
}

export function TextField({
  label,
  value,
  onChangeText,
  multiline = false,
  placeholder,
  secret = false,
  testID,
}: TextFieldProps) {
  const { palette, fontSize } = useTheme();

  return (
    <View style={styles.field}>
      <FieldLabel>{label}</FieldLabel>
      <TextInput
        testID={testID}
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        secureTextEntry={secret}
        autoComplete={secret ? "current-password" : undefined}
        autoCapitalize={secret ? "none" : undefined}
        autoCorrect={secret ? false : undefined}
        placeholder={placeholder}
        placeholderTextColor={palette.textMuted}
        style={[
          styles.input,
          multiline && styles.multiline,
          { color: palette.text, borderColor: palette.border, fontSize: fontSize.md },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    padding: spacing.md,
    minHeight: 44,
  },
  multiline: { minHeight: 88, textAlignVertical: "top" },
});
