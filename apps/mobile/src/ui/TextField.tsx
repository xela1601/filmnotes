import { StyleSheet, TextInput, View } from 'react-native';

import { FieldLabel } from './FieldLabel';
import { useTheme } from './theme';

export interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
  testID?: string;
}

export function TextField({
  label,
  value,
  onChangeText,
  multiline = false,
  placeholder,
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
  field: { gap: 4 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 6, padding: 12, minHeight: 44 },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
});
