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

import { EQUIPMENT_NAMESPACE } from "./i18n";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Button, FieldLabel, radius, spacing, useTheme } from "../../ui";

export interface ListFieldProps {
  label: string;
  values: readonly (string | number)[];
  onChange: (values: (string | number)[]) => void;
  /** Parse the input as a number – for aperture values and other numeric lists. */
  numeric?: boolean;
  testID?: string;
}

export function ListField({ label, values, onChange, numeric = false, testID }: ListFieldProps) {
  const { t } = useTranslation(EQUIPMENT_NAMESPACE);
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
              // Duplicates are legal here (two "1/60" entries while editing) and the chips hold
              // no state of their own, so the index is part of the key on purpose.
              // eslint-disable-next-line @eslint-react/no-array-index-key
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
  field: { gap: spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
});
