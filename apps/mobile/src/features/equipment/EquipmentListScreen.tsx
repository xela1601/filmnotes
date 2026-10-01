/**
 * The equipment tab: one group per equipment type, with the records the user owns
 * (spec §3.3 – "Equipment (list/edit per type)").
 *
 * The screen knows nothing about the individual fields; it renders `displayName` and a
 * short technical summary and hands over to the generic editor.
 */
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { EQUIPMENT_NAMESPACE } from "./i18n";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useActive } from "../../store/hooks";
import { EmptyState, ListItem, Screen, fontWeight, radius, spacing, useTheme } from "../../ui";
import {
  EQUIPMENT_TYPES,
  displayName,
  readField,
  type EquipmentRecord,
  type EquipmentType,
} from "./descriptors";

/** The subset of i18next's `t` the summaries need. */
type Translate = (key: string, params?: Record<string, string | number>) => string;

const asNumber = (value: unknown): number | null => (typeof value === "number" ? value : null);
const asText = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/**
 * The technical one-liner under the name, e.g. `"35–70 mm · f/4"`.
 * Undefined while the record does not carry the data it needs.
 */
function summaryOf(type: EquipmentType, record: EquipmentRecord, t: Translate): string | undefined {
  switch (type) {
    case "cameras": {
      const format = asText(readField(record, "format"));
      if (format === "") return undefined;
      const year = asNumber(readField(record, "year"));
      return year === null
        ? t("summaries.camera", { format })
        : t("summaries.cameraWithYear", { format, year });
    }
    case "lenses": {
      const min = asNumber(readField(record, "focalMinMm"));
      const max = asNumber(readField(record, "focalMaxMm"));
      const aperture = asNumber(readField(record, "maxAperture"));
      if (min === null || max === null || aperture === null || min === 0) return undefined;
      return min === max
        ? t("summaries.focalFixed", { focal: min, aperture })
        : t("summaries.focalZoom", { min, max, aperture });
    }
    case "filters": {
      const thread = asNumber(readField(record, "threadMm"));
      const kind = asText(readField(record, "type"));
      if (thread === null || thread === 0 || kind === "") return undefined;
      return t("summaries.filter", { thread, type: kind });
    }
    case "flashes": {
      const guideNumber = asNumber(readField(record, "guideNumberIso100M"));
      if (guideNumber === null) return undefined;
      return t("summaries.flash", { guideNumber });
    }
    default: {
      const iso = asNumber(readField(record, "iso"));
      const process = asText(readField(record, "process"));
      if (iso === null || iso === 0) return undefined;
      return t("summaries.filmStock", { iso, process });
    }
  }
}

export function EquipmentListScreen() {
  const { t } = useTranslation(EQUIPMENT_NAMESPACE);
  const [type, setType] = useState<EquipmentType>("cameras");
  const records = useActive(type);

  const sorted = useMemo(
    () => [...records].sort((a, b) => displayName(type, a).localeCompare(displayName(type, b))),
    [records, type],
  );

  const singular = t(`typesSingular.${type}`);

  return (
    <Screen
      title={t("title")}
      titleAction={<AddAction label={t("addOf", { type: singular })} type={type} />}
      testID="equipment-screen"
    >
      <TypeSwitch value={type} onChange={setType} />

      {sorted.length === 0 ? (
        <EmptyState title={t("empty")} hint={t("emptyHint")} testID="equipment-empty" />
      ) : (
        sorted.map((record) => (
          <ListItem
            key={record.id}
            testID={`equipment-item-${record.id}`}
            title={displayName(type, record) === "" ? t("unnamed") : displayName(type, record)}
            subtitle={summaryOf(type, record, t)}
            onPress={() => router.push(`/equipment/${type}/${record.id}`)}
          />
        ))
      )}
    </Screen>
  );
}

/** The "+" next to the title; labelled for screen readers because the icon is not. */
function AddAction({ label, type }: { label: string; type: EquipmentType }) {
  const { palette } = useTheme();
  return (
    <Pressable
      testID="equipment-new"
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => router.push(`/equipment/${type}/new`)}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: palette.primary, opacity: pressed ? 0.82 : 1 },
      ]}
    >
      <Ionicons name="add" size={26} color={palette.onPrimary} />
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
  const { t } = useTranslation(EQUIPMENT_NAMESPACE);
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
            style={({ pressed }) => [
              styles.segment,
              {
                borderColor: active ? palette.primary : palette.border,
                backgroundColor: active
                  ? palette.primary
                  : pressed
                    ? palette.surface
                    : "transparent",
              },
            ]}
          >
            <Text
              style={{
                color: active ? palette.onPrimary : palette.text,
                fontSize: fontSize.sm,
                fontWeight: active ? fontWeight.semibold : undefined,
              }}
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
  action: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  switchRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  segment: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
});
