import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FieldLabel } from "./FieldLabel";
import { useTheme } from "./theme";
import { fontWeight, radius, spacing } from "./themes";

export interface SelectOption<T> {
  value: T;
  label: string;
  /** Colours shown next to the label - a theme's own background, surface and accent. */
  swatch?: string[];
}

export interface SelectFieldProps<T> {
  label: string;
  /** Leave the visible label out where the section heading already says it; still announced. */
  hideLabel?: boolean;
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
  hideLabel = false,
  value,
  options,
  onChange,
  nullable = false,
  testID,
}: SelectFieldProps<T>) {
  const { palette, fontSize } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
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
        {!hideLabel && <FieldLabel>{label}</FieldLabel>}
        <View accessibilityLabel={label} style={styles.segments}>
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
      {!hideLabel && <FieldLabel>{label}</FieldLabel>}
      <Pressable
        testID={testID === undefined ? undefined : `${testID}-open`}
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => setPickerOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          {
            borderColor: palette.border,
            backgroundColor: pressed ? palette.surface : "transparent",
          },
        ]}
      >
        <Text
          style={[
            styles.triggerLabel,
            { color: selected === null ? palette.textMuted : palette.text, fontSize: fontSize.md },
          ]}
        >
          {selected?.label ?? "–"}
        </Text>
        {selected?.swatch !== undefined && <Swatch colors={selected.swatch} />}
        <Ionicons name="chevron-down" size={18} color={palette.textMuted} />
      </Pressable>
      <Modal visible={pickerOpen} animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <View
          style={[
            styles.modal,
            {
              backgroundColor: palette.background,
              paddingTop: insets.top + spacing.lg,
              paddingBottom: insets.bottom,
            },
          ]}
        >
          {/* A way out that is not a choice: before T-026 the only exit was picking something. */}
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: palette.text, fontSize: fontSize.lg }]}>
              {label}
            </Text>
            <Pressable
              testID={testID === undefined ? undefined : `${testID}-close`}
              accessibilityRole="button"
              accessibilityLabel={t("actions.close")}
              hitSlop={spacing.sm}
              onPress={() => setPickerOpen(false)}
              style={({ pressed }) => [styles.close, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Ionicons name="close" size={26} color={palette.text} />
            </Pressable>
          </View>
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
                swatch={option.swatch}
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
  swatch?: string[];
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
      style={({ pressed }) => [
        styles.segment,
        {
          borderColor: active ? palette.primary : palette.border,
          backgroundColor: active ? palette.primary : pressed ? palette.surface : "transparent",
        },
      ]}
    >
      <Text
        style={{
          color: active ? palette.onPrimary : palette.text,
          fontSize: fontSize.md,
          fontWeight: active ? fontWeight.semibold : undefined,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** A row of overlapping dots, each with a hairline so a white or black one stays visible. */
function Swatch({ colors }: { colors: string[] }) {
  const { palette } = useTheme();
  return (
    <View style={styles.swatch}>
      {colors.map((color, index) => (
        <View
          // The same colour can appear twice in one theme (OLED's background and surface).
          // eslint-disable-next-line @eslint-react/no-array-index-key
          key={`${color}-${index}`}
          style={[styles.dot, { backgroundColor: color, borderColor: palette.border }]}
        />
      ))}
    </View>
  );
}

function ModalOption({ label, swatch, active, onPress, testID }: OptionProps) {
  const { palette, fontSize } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.modalOption,
        { borderColor: palette.border, backgroundColor: pressed ? palette.surface : "transparent" },
      ]}
    >
      {swatch !== undefined && <Swatch colors={swatch} />}
      <Text
        style={{
          flex: 1,
          color: active ? palette.primary : palette.text,
          fontSize: fontSize.md,
          fontWeight: active ? fontWeight.bold : undefined,
        }}
      >
        {label}
      </Text>
      {active && <Ionicons name="checkmark" size={20} color={palette.primary} />}
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
  },
  modal: { flex: 1, padding: spacing.lg, gap: spacing.sm },
  modalOptions: { gap: spacing.sm, paddingBottom: spacing.xl },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  modalTitle: { flexShrink: 1, fontWeight: fontWeight.bold },
  close: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  triggerLabel: { flex: 1 },
  swatch: { flexDirection: "row" },
  dot: {
    width: spacing.lg,
    height: spacing.lg,
    marginRight: -spacing.xs,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  modalOption: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
