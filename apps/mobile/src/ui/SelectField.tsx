import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { FieldLabel } from "./FieldLabel";
import { useTheme } from "./theme";
import { radius, spacing } from "./themes";

export interface SelectOption<T> {
  value: T;
  label: string;
}

export interface SelectFieldProps<T> {
  label: string;
  value: T | null;
  options: SelectOption<T>[];
  onChange: (value: T | null) => void;
  /** Allow clearing the selection (adds a "–" option). */
  nullable?: boolean;
  testID?: string;
}

/** Up to four options are shown as a segmented control, more open a modal picker. */
const SEGMENTED_MAX_OPTIONS = 4;

export function SelectField<T extends string | number>({
  label,
  value,
  options,
  onChange,
  nullable = false,
  testID,
}: SelectFieldProps<T>) {
  const { palette, fontSize } = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);

  // A value the option list does not contain has to stay visible. It happens when the value was
  // valid for a different lens or exposure mode, and it is usually exactly what an error message
  // is complaining about - showing "–" there would hide the problem the user has to fix.
  const known = options.find((option) => option.value === value) ?? null;
  const stranded: SelectOption<T> | null =
    value === null || known !== null ? null : { value, label: String(value) };
  const shownOptions = stranded === null ? options : [stranded, ...options];

  const segmented = shownOptions.length <= SEGMENTED_MAX_OPTIONS;
  const selected = known ?? stranded;
  const optionTestID = (option: SelectOption<T>) =>
    testID === undefined ? undefined : `${testID}-option-${String(option.value)}`;

  const select = (next: T | null) => {
    onChange(next);
    setPickerOpen(false);
  };

  if (segmented) {
    return (
      <View testID={testID} style={styles.field}>
        <FieldLabel>{label}</FieldLabel>
        <View style={styles.segments}>
          {nullable && (
            <Segment
              testID={testID === undefined ? undefined : `${testID}-option-none`}
              label="–"
              active={value === null}
              onPress={() => select(null)}
            />
          )}
          {shownOptions.map((option) => (
            <Segment
              key={String(option.value)}
              testID={optionTestID(option)}
              label={option.label}
              active={option.value === value}
              onPress={() => select(option.value)}
            />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View testID={testID} style={styles.field}>
      <FieldLabel>{label}</FieldLabel>
      <Pressable
        testID={testID === undefined ? undefined : `${testID}-open`}
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => setPickerOpen(true)}
        style={[styles.trigger, { borderColor: palette.border }]}
      >
        <Text
          style={{
            color: selected === null ? palette.textMuted : palette.text,
            fontSize: fontSize.md,
          }}
        >
          {selected?.label ?? "–"}
        </Text>
      </Pressable>
      <Modal visible={pickerOpen} animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <View style={[styles.modal, { backgroundColor: palette.background }]}>
          <Text style={[styles.modalTitle, { color: palette.text, fontSize: fontSize.lg }]}>
            {label}
          </Text>
          {/*
           * Scrollable, because a list can be longer than the screen: the Minolta offers 18
           * manual shutter speeds, and on a phone the last of them - "bulb" - sat below the
           * bottom edge with no way to reach it. Found by driving the exported bundle in a real
           * browser; jsdom has no layout and could not have shown it.
           */}
          <ScrollView contentContainerStyle={styles.modalOptions}>
            {nullable && (
              <ModalOption
                testID={testID === undefined ? undefined : `${testID}-option-none`}
                label="–"
                active={value === null}
                onPress={() => select(null)}
              />
            )}
            {shownOptions.map((option) => (
              <ModalOption
                key={String(option.value)}
                testID={optionTestID(option)}
                label={option.label}
                active={option.value === value}
                onPress={() => select(option.value)}
              />
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

interface OptionProps {
  label: string;
  active: boolean;
  onPress: () => void;
  testID?: string;
}

function Segment({ label, active, onPress, testID }: OptionProps) {
  const { palette, fontSize } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        styles.segment,
        {
          borderColor: palette.border,
          backgroundColor: active ? palette.primary : "transparent",
        },
      ]}
    >
      <Text style={{ color: active ? palette.onPrimary : palette.text, fontSize: fontSize.md }}>
        {label}
      </Text>
    </Pressable>
  );
}

function ModalOption({ label, active, onPress, testID }: OptionProps) {
  const { palette, fontSize } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.modalOption, { borderColor: palette.border }]}
    >
      <Text
        style={{
          color: active ? palette.primary : palette.text,
          fontSize: fontSize.md,
          fontWeight: active ? "700" : "400",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  segments: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  segment: {
    minHeight: 44,
    minWidth: 48,
    paddingHorizontal: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  trigger: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
  },
  modal: { flex: 1, padding: spacing.lg, gap: spacing.sm },
  modalOptions: { gap: spacing.sm, paddingBottom: spacing.xl },
  modalTitle: { fontWeight: "700", marginBottom: spacing.sm },
  modalOption: {
    minHeight: 48,
    justifyContent: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
