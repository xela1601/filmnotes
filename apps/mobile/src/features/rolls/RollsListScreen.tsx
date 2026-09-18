/**
 * The app's home screen: every roll, newest first (spec §3.3).
 */
import type { Roll } from "@filmnotes/domain";
import { router } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useShallow } from "zustand/react/shallow";

import { useActive } from "../../store/hooks";
import { useStore } from "../../store/store";
import { selectFramesForRoll } from "../../store/selectors";
import { EmptyState, ListItem, Screen, useTheme } from "../../ui";
import "./i18n";
import { rollProgress, rollTitle } from "./rollLabel";

export function RollsListScreen() {
  const { t } = useTranslation("rolls");
  const rolls = useActive("rolls");

  const sorted = useMemo(
    () => [...rolls].sort((a, b) => b.loadedAt.localeCompare(a.loadedAt)),
    [rolls],
  );

  return (
    <Screen testID="rolls-screen">
      <View style={styles.header}>
        <ScreenTitle title={t("title")} />
        <NewRollAction label={t("new")} />
      </View>

      {sorted.length === 0 ? (
        <EmptyState title={t("empty")} hint={t("emptyHint")} testID="rolls-empty" />
      ) : (
        sorted.map((roll) => <RollRow key={roll.id} roll={roll} />)
      )}
    </Screen>
  );
}

function ScreenTitle({ title }: { title: string }) {
  const { palette, fontSize } = useTheme();
  return (
    <Text style={[styles.title, { color: palette.text, fontSize: fontSize.xl }]}>{title}</Text>
  );
}

/** The "+" in the header; labelled for screen readers because the glyph is not. */
function NewRollAction({ label }: { label: string }) {
  const { palette, fontSize } = useTheme();
  return (
    <Pressable
      testID="rolls-new"
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => router.push("/rolls/new")}
      style={[styles.action, { borderColor: palette.border, backgroundColor: palette.primary }]}
    >
      <Text style={{ color: palette.onPrimary, fontSize: fontSize.lg, fontWeight: "700" }}>+</Text>
    </Pressable>
  );
}

function RollRow({ roll }: { roll: Roll }) {
  const { t } = useTranslation("rolls");
  const filmStock = useStore((state) => state.entities.filmStocks[roll.filmStockId]);
  // Shallow-compared: the selector builds a new array on every call.
  const frames = useStore(useShallow((state) => selectFramesForRoll(state, roll.id)));
  const progress = rollProgress(roll, frames);

  return (
    <ListItem
      testID={`roll-item-${roll.id}`}
      title={rollTitle(roll, filmStock, t)}
      subtitle={t("progress", progress)}
      right={
        <StatusChip status={t(`status.${roll.status}`)} testID={`roll-item-${roll.id}-status`} />
      }
      onPress={() => router.push(`/rolls/${roll.id}`)}
    />
  );
}

export function StatusChip({ status, testID }: { status: string; testID?: string }) {
  const { palette, fontSize } = useTheme();
  return (
    <Text
      testID={testID}
      style={[
        styles.chip,
        {
          color: palette.text,
          backgroundColor: palette.surface,
          borderColor: palette.border,
          fontSize: fontSize.sm,
        },
      ]}
    >
      {status}
    </Text>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  title: { fontWeight: "700" },
  action: {
    minWidth: 48,
    minHeight: 48,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  chip: {
    overflow: "hidden",
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontWeight: "600",
  },
});
