/**
 * The generic equipment editor.
 *
 * There is no hand-written form per equipment type: the screen walks the descriptors of
 * the type it was given and renders one component per `kind`. A field added to
 * `DESCRIPTORS` therefore appears here, in every language, without touching this file.
 */
import type { Id } from '@filmnotes/domain';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { now } from '../../lib/clock';
import { confirmDestructive } from '../../lib/confirm';
import { useActive, useEntity } from '../../store/hooks';
import { useStore } from '../../store/store';
import {
  Button,
  EmptyState,
  MultiSelectField,
  NumberField,
  Screen,
  Section,
  SelectField,
  SwitchField,
  TextField,
  useTheme,
  type SelectOption,
} from '../../ui';
import { ListField } from './ListField';
import {
  DESCRIPTORS,
  decodeOption,
  displayName,
  emptyRecord,
  encodeOption,
  isEquipmentType,
  readField,
  validateRecord,
  writeField,
  type EquipmentRecord,
  type EquipmentType,
  type FieldDescriptor,
  type RecordErrors,
} from './descriptors';
import './i18n';

export interface EquipmentEditScreenProps {
  type: EquipmentType;
  /** The record to edit; `null` creates a new one. */
  id: Id | null;
}

/** Shown for a record (or a `[type]` segment) that does not exist. */
function NotFound() {
  const { t } = useTranslation('equipment');
  return (
    <Screen testID="equipment-editor">
      <EmptyState
        title={t('notFound')}
        hint={t('notFoundHint')}
        testID="equipment-editor-not-found"
      />
    </Screen>
  );
}

/**
 * What the `/equipment/[type]/…` routes render: the path segments are strings, so the
 * type is checked here before the editor is given a typed collection name.
 */
export function EquipmentEditRoute({
  type,
  id,
}: {
  type: string | undefined;
  id: string | undefined;
}) {
  if (type === undefined || !isEquipmentType(type)) return <NotFound />;
  return <EquipmentEditScreen type={type} id={id === undefined || id === 'new' ? null : id} />;
}

export function EquipmentEditScreen({ type, id }: EquipmentEditScreenProps) {
  const found = useEntity(type, id);
  const existing = found !== undefined && found.deleted === null ? found : null;

  if (id !== null && existing === null) return <NotFound />;

  // Remounts once the record is known, so the fields start from its values.
  return <EquipmentFields key={existing?.id ?? 'new'} type={type} existing={existing} />;
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? (value as unknown[]) : [];
}

const asStringList = (value: unknown): string[] =>
  asList(value).filter((entry): entry is string => typeof entry === 'string');

const asNumberList = (value: unknown): number[] =>
  asList(value).filter((entry): entry is number => typeof entry === 'number');

const asText = (value: unknown): string => (typeof value === 'string' ? value : '');

const asNumber = (value: unknown): number | null => (typeof value === 'number' ? value : null);

/** What an emptied text field stores: null where the record allows it, else "". */
function textToValue(field: FieldDescriptor, text: string): string | null {
  return field.nullable === true && text.trim() === '' ? null : text;
}

/** What a cleared number field stores: null where the record allows it, else 0. */
function numberToValue(field: FieldDescriptor, value: number | null): number | null {
  if (value !== null) return value;
  return field.nullable === true ? null : 0;
}

function EquipmentFields({
  type,
  existing,
}: {
  type: EquipmentType;
  existing: EquipmentRecord | null;
}) {
  const { t } = useTranslation('equipment');
  const { palette, fontSize } = useTheme();
  const upsert = useStore((state) => state.upsert);
  const softDelete = useStore((state) => state.softDelete);

  // Equipment references equipment (a lens has default filters, a filter sits on a lens),
  // so every collection is available as an option source.
  const sources: Record<EquipmentType, EquipmentRecord[]> = {
    cameras: useActive('cameras'),
    lenses: useActive('lenses'),
    filters: useActive('filters'),
    flashes: useActive('flashes'),
    filmStocks: useActive('filmStocks'),
  };

  const [record, setRecord] = useState<EquipmentRecord>(
    () => existing ?? emptyRecord(type, now()),
  );
  const [errors, setErrors] = useState<RecordErrors>({});

  const singular = t(`typesSingular.${type}`);

  const patch = (field: FieldDescriptor, value: unknown) => {
    setRecord((current) => writeField(current, field.key, value));
  };

  const optionsOf = (field: FieldDescriptor): SelectOption<string>[] => {
    const from = field.optionsFrom;
    if (from !== undefined) {
      return sources[from].map((candidate) => ({
        value: candidate.id,
        label: displayName(from, candidate) === '' ? t('unnamed') : displayName(from, candidate),
      }));
    }
    return (field.options ?? []).map((option) => ({
      value: option.value,
      label: option.labelKey === undefined ? option.value : t(option.labelKey),
    }));
  };

  const save = () => {
    const found = validateRecord(type, record);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    upsert(type, record);
    router.back();
  };

  const remove = () => {
    confirmDestructive({
      title: t('deleteOf', { type: singular }),
      message: t('deleteConfirm'),
      confirmLabel: t('actions.delete', { ns: 'common' }),
      cancelLabel: t('actions.cancel', { ns: 'common' }),
      onConfirm: () => {
        softDelete(type, record.id);
        router.replace('/equipment');
      },
    });
  };

  const renderField = (field: FieldDescriptor) => {
    const testID = `equipment-field-${field.key}`;
    const label = t(field.labelKey);
    const value = readField(record, field.key);

    switch (field.kind) {
      case 'text':
        return (
          <TextField
            label={label}
            value={asText(value)}
            onChangeText={(text) => patch(field, textToValue(field, text))}
            multiline={field.multiline}
            testID={testID}
          />
        );
      case 'number':
        return (
          <NumberField
            label={label}
            value={asNumber(value)}
            onChange={(next) => patch(field, numberToValue(field, next))}
            step={field.step}
            min={field.min}
            max={field.max}
            testID={testID}
          />
        );
      case 'boolean':
        return (
          <SwitchField
            label={label}
            value={value === true}
            onChange={(next) => patch(field, next)}
            testID={testID}
          />
        );
      case 'select':
        return (
          <SelectField<string>
            label={label}
            value={encodeOption(field, value)}
            options={optionsOf(field)}
            onChange={(selected) => patch(field, decodeOption(field, selected))}
            nullable={field.nullable}
            testID={testID}
          />
        );
      case 'multiselect':
        return (
          <MultiSelectField<string>
            label={label}
            values={asStringList(value)}
            options={optionsOf(field)}
            onChange={(next) => patch(field, next)}
            testID={testID}
          />
        );
      case 'numberList':
        return (
          <ListField
            label={label}
            values={asNumberList(value)}
            numeric
            onChange={(next) => patch(field, next.filter((entry) => typeof entry === 'number'))}
            testID={testID}
          />
        );
      default:
        return (
          <ListField
            label={label}
            values={asStringList(value)}
            onChange={(next) => patch(field, next.map((entry) => String(entry)))}
            testID={testID}
          />
        );
    }
  };

  return (
    <Screen
      title={existing === null ? t('newTitle', { type: singular }) : t('editTitle', { type: singular })}
      testID="equipment-editor"
    >
      <Section title={singular}>
        {DESCRIPTORS[type].map((field) => (
          <View key={field.key}>
            {renderField(field)}
            {errors[field.key] !== undefined && (
              <Text
                testID={`equipment-error-${field.key}`}
                style={[styles.error, { color: palette.danger, fontSize: fontSize.sm }]}
              >
                {t(`errors.${errors[field.key] ?? 'invalid'}`)}
              </Text>
            )}
          </View>
        ))}
      </Section>

      <Button title={t('actions.save', { ns: 'common' })} onPress={save} testID="equipment-save" />
      <Button
        title={t('actions.cancel', { ns: 'common' })}
        variant="secondary"
        onPress={() => router.back()}
        testID="equipment-cancel"
      />
      {existing !== null && (
        <Button
          title={t('deleteOf', { type: singular })}
          variant="danger"
          onPress={remove}
          testID="equipment-delete"
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { fontWeight: '600', marginTop: 4 },
});
