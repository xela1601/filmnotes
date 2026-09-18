/**
 * An editable list of short values: the entries are chips that can be tapped away, a
 * text input plus "add" appends a new one.
 *
 * Used for the string, number and shutter-speed lists of the equipment records
 * (aliases, aperture values, shutter speeds, power levels …). The values are kept as
 * the record holds them, so the editor can write the array straight back.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Button, FieldLabel, useTheme } from "../../ui";
import "./i18n";

export interface ListFieldProps {
  label: string;
  values: readonly (string | number)[];
  onChange: (values: (string | number)[]) => void;
  /** Parse the input as a number – for aperture values and other numeric lists. */
  numeric?: boolean;
  testID?: string;
}

export function ListField({ label, values, onChange, numeric = false, testID }: ListFieldProps) {
  const { t } = useTranslation("equipment");
  const { palette, fontSize } = useTheme();
  const [draft, setDraft] = useState("");

  const add = () => {
    const text = draft.trim();
    if (text === "") return;

    if (numeric) {
      const parsed = Number(text.replace(",", "."));
      if (!Number.isFinite(parsed)) return;
      onChange([...values, parsed]);
    } else {
      onChange([...values, text]);
    }
    setDraft("");
  };

  const removeAt = (index: number) => {
    onChange(values.filter((_, position) => position !== index));
  };

  return (
    <View style={styles.field} testID={testID}>
      <FieldLabel>{label}</FieldLabel>

      {values.length === 0 ? (
        <Text style={{ color: palette.textMuted, fontSize: fontSize.sm }}>
          {t("lists.emptyValue")}
        </Text>
      ) : (
        <View style={styles.chips}>
          {values.map((value, index) => (
            <Pressable
              // Values may repeat while the user is still typing, so the index is part of the key.
              key={`${String(value)}-${index}`}
              testID={testID === undefined ? undefined : `${testID}-remove-${index}`}
              accessibilityRole="button"
              accessibilityLabel={t("lists.remove", { value: String(value) })}
              onPress={() => removeAt(index)}
              style={[
                styles.chip,
                { borderColor: palette.border, backgroundColor: palette.surface },
              ]}
            >
              <Text style={{ color: palette.text, fontSize: fontSize.md }}>
                {`${String(value)} ×`}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.row}>
        <TextInput
          testID={testID === undefined ? undefined : `${testID}-input`}
          accessibilityLabel={label}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          keyboardType={numeric ? "numeric" : "default"}
          style={[
            styles.input,
            { color: palette.text, borderColor: palette.border, fontSize: fontSize.md },
          ]}
        />
        <Button
          title={t("lists.add")}
          variant="secondary"
          onPress={add}
          testID={testID === undefined ? undefined : `${testID}-add`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    paddingHorizontal: 12,
    minHeight: 44,
  },
});
