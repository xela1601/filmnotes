/**
 * The equipment tab: one group per equipment type, with the records the user owns
 * (spec §3.3 – "Equipment (list/edit per type)").
 *
 * The screen knows nothing about the individual fields; it renders `displayName` and a
 * short technical summary and hands over to the generic editor.
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useActive } from '../../store/hooks';
import { EmptyState, ListItem, Screen, useTheme } from '../../ui';
import {
  EQUIPMENT_TYPES,
  displayName,
  readField,
  type EquipmentRecord,
  type EquipmentType,
} from './descriptors';
import './i18n';

/** The subset of i18next's `t` the summaries need. */
type Translate = (key: string, params?: Record<string, string | number>) => string;

const asNumber = (value: unknown): number | null => (typeof value === 'number' ? value : null);
const asText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * The technical one-liner under the name, e.g. `"35–70 mm · f/4"`.
 * Undefined while the record does not carry the data it needs.
 */
function summaryOf(type: EquipmentType, record: EquipmentRecord, t: Translate): string | undefined {
  switch (type) {
    case 'cameras': {
      const format = asText(readField(record, 'format'));
      if (format === '') return undefined;
      const year = asNumber(readField(record, 'year'));
      return year === null
        ? t('summaries.camera', { format })
        : t('summaries.cameraWithYear', { format, year });
    }
    case 'lenses': {
      const min = asNumber(readField(record, 'focalMinMm'));
      const max = asNumber(readField(record, 'focalMaxMm'));
      const aperture = asNumber(readField(record, 'maxAperture'));
      if (min === null || max === null || aperture === null || min === 0) return undefined;
      return min === max
        ? t('summaries.focalFixed', { focal: min, aperture })
        : t('summaries.focalZoom', { min, max, aperture });
    }
    case 'filters': {
      const thread = asNumber(readField(record, 'threadMm'));
      const kind = asText(readField(record, 'type'));
      if (thread === null || thread === 0 || kind === '') return undefined;
      return t('summaries.filter', { thread, type: kind });
    }
    case 'flashes': {
      const guideNumber = asNumber(readField(record, 'guideNumberIso100M'));
      if (guideNumber === null) return undefined;
      return t('summaries.flash', { guideNumber });
    }
    default: {
      const iso = asNumber(readField(record, 'iso'));
      const process = asText(readField(record, 'process'));
      if (iso === null || iso === 0) return undefined;
      return t('summaries.filmStock', { iso, process });
    }
  }
}

export function EquipmentListScreen() {
  const { t } = useTranslation('equipment');
  const [type, setType] = useState<EquipmentType>('cameras');
  const records = useActive(type);

  const sorted = useMemo(
    () =>
      [...records].sort((a, b) =>
        displayName(type, a).localeCompare(displayName(type, b)),
      ),
    [records, type],
  );

  const singular = t(`typesSingular.${type}`);

  return (
    <Screen testID="equipment-screen">
      <View style={styles.header}>
        <ScreenTitle title={t('title')} />
        <AddAction label={t('addOf', { type: singular })} type={type} />
      </View>

      <TypeSwitch value={type} onChange={setType} />

      {sorted.length === 0 ? (
        <EmptyState title={t('empty')} hint={t('emptyHint')} testID="equipment-empty" />
      ) : (
        sorted.map((record) => (
          <ListItem
            key={record.id}
            testID={`equipment-item-${record.id}`}
            title={displayName(type, record) === '' ? t('unnamed') : displayName(type, record)}
            subtitle={summaryOf(type, record, t)}
            onPress={() => router.push(`/equipment/${type}/${record.id}`)}
          />
        ))
      )}
    </Screen>
  );
}

function ScreenTitle({ title }: { title: string }) {
  const { palette, fontSize } = useTheme();
  return <Text style={[styles.title, { color: palette.text, fontSize: fontSize.xl }]}>{title}</Text>;
}

/** The "+" in the header; labelled for screen readers because the glyph is not. */
function AddAction({ label, type }: { label: string; type: EquipmentType }) {
  const { palette, fontSize } = useTheme();
  return (
    <Pressable
      testID="equipment-new"
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => router.push(`/equipment/${type}/new`)}
      style={[styles.action, { borderColor: palette.border, backgroundColor: palette.primary }]}
    >
      <Text style={{ color: palette.onPrimary, fontSize: fontSize.lg, fontWeight: '700' }}>+</Text>
    </Pressable>
  );
}

/**
 * Segmented switch over the five types. Written out instead of using `SelectField`
 * because it is navigation, not a form field, and all five stay visible.
 */
function TypeSwitch({
  value,
  onChange,
}: {
  value: EquipmentType;
  onChange: (type: EquipmentType) => void;
}) {
  const { t } = useTranslation('equipment');
  const { palette, fontSize } = useTheme();

  return (
    <View style={styles.switchRow}>
      {EQUIPMENT_TYPES.map((type) => {
        const active = type === value;
        return (
          <Pressable
            key={type}
            testID={`equipment-type-${type}`}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(type)}
            style={[
              styles.segment,
              {
                borderColor: palette.border,
                backgroundColor: active ? palette.primary : 'transparent',
              },
            ]}
          >
            <Text
              style={{ color: active ? palette.onPrimary : palette.text, fontSize: fontSize.sm }}
            >
              {t(`types.${type}`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { fontWeight: '700' },
  action: {
    minWidth: 48,
    minHeight: 48,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segment: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
