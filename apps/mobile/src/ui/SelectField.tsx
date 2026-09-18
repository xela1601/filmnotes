import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { FieldLabel } from './FieldLabel';
import { useTheme } from './theme';

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

  const segmented = options.length <= SEGMENTED_MAX_OPTIONS;
  const selected = options.find((option) => option.value === value) ?? null;
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
          {options.map((option) => (
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
        <Text style={{ color: selected === null ? palette.textMuted : palette.text, fontSize: fontSize.md }}>
          {selected?.label ?? '–'}
        </Text>
      </Pressable>
      <Modal visible={pickerOpen} animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <View style={[styles.modal, { backgroundColor: palette.background }]}>
          <Text style={[styles.modalTitle, { color: palette.text, fontSize: fontSize.lg }]}>
            {label}
          </Text>
          {nullable && (
            <ModalOption
              testID={testID === undefined ? undefined : `${testID}-option-none`}
              label="–"
              active={value === null}
              onPress={() => select(null)}
            />
          )}
          {options.map((option) => (
            <ModalOption
              key={String(option.value)}
              testID={optionTestID(option)}
              label={option.label}
              active={option.value === value}
              onPress={() => select(option.value)}
            />
          ))}
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
          backgroundColor: active ? palette.primary : 'transparent',
        },
      ]}
    >
      <Text
        style={{ color: active ? palette.onPrimary : palette.text, fontSize: fontSize.md }}
      >
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
          fontWeight: active ? '700' : '400',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { gap: 4 },
  segments: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segment: {
    minHeight: 44,
    minWidth: 48,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trigger: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
  },
  modal: { flex: 1, padding: 16, gap: 8 },
  modalTitle: { fontWeight: '700', marginBottom: 8 },
  modalOption: {
    minHeight: 48,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
