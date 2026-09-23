/**
 * Roll detail: what is on the roll and everything that can be done with it
 * (spec §2.1 steps 3, 5 and 6).
 *
 * The frame editor, the scan import and the export screens belong to other tickets;
 * this screen only creates the frame record and hands over to their routes.
 */
import {
  nextFrameNo,
  newFrame,
  type Frame,
  type Id,
  type Roll,
  type RollStatus,
} from "@filmnotes/domain";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";

import { ROLLS_NAMESPACE } from "./i18n";
import { StyleSheet, Text, View } from "react-native";
import { useShallow } from "zustand/react/shallow";

import { confirmDestructive } from "../../lib/confirm";
import { now } from "../../lib/clock";
import { useEntity } from "../../store/hooks";
import { selectFramesForRoll, selectRollCascade } from "../../store/selectors";
import { useStore } from "../../store/store";
import {
  Button,
  EmptyState,
  ListItem,
  Screen,
  Section,
  SelectField,
  fontWeight,
  spacing,
  useTheme,
  type SelectOption,
} from "../../ui";
import { frameRowTitle, rollProgress, rollTitle } from "./rollLabel";

/** The life of a roll, in the order it is worked through. */
const STATUS_ORDER: RollStatus[] = ["loaded", "shot", "at_lab", "developed", "archived"];

export interface RollDetailScreenProps {
  rollId: Id;
}

export function RollDetailScreen({ rollId }: RollDetailScreenProps) {
  const { t } = useTranslation(ROLLS_NAMESPACE);
  const roll = useEntity("rolls", rollId);

  if (roll === undefined || roll.deleted !== null) {
    return (
      <Screen testID="roll-detail">
        <EmptyState title={t("notFound")} hint={t("notFoundHint")} testID="roll-detail-not-found" />
      </Screen>
    );
  }

  return <RollDetail roll={roll} />;
}

function RollDetail({ roll }: { roll: Roll }) {
  const { t } = useTranslation(ROLLS_NAMESPACE);
  const { palette, fontSize } = useTheme();
  // Shallow-compared: the selector builds a new array on every call.
  const frames = useStore(useShallow((state) => selectFramesForRoll(state, roll.id)));
  const filmStock = useStore((state) => state.entities.filmStocks[roll.filmStockId]);
  const camera = useStore((state) => state.entities.cameras[roll.cameraId]);
  const upsert = useStore((state) => state.upsert);
  const softDelete = useStore((state) => state.softDelete);

  const progress = rollProgress(roll, frames);
  const full = frames.length >= roll.exposures;

  const statusOptions: SelectOption<RollStatus>[] = STATUS_ORDER.map((status) => ({
    value: status,
    label: t(`status.${status}`),
  }));

  const changeStatus = (next: RollStatus | null) => {
    if (next === null || next === roll.status) return;
    // Leaving "loaded" means the film came out of the camera.
    const unloadedAt = roll.unloadedAt === null && next !== "loaded" ? now() : roll.unloadedAt;
    upsert("rolls", { ...roll, status: next, unloadedAt });
  };

  const addFrame = () => {
    if (camera === undefined || full) return;
    const frame = newFrame({
      rollId: roll.id,
      frameNo: nextFrameNo(frames),
      camera,
      // The frames are ordered by number, so the last one is the shot before.
      previous: frames[frames.length - 1] ?? null,
      now: now(),
    });
    upsert("frames", frame);
    router.push(`/frames/${frame.id}`);
  };

  const deleteRoll = () => {
    confirmDestructive({
      title: t("deleteRoll"),
      message: t("deleteConfirm"),
      confirmLabel: t("actions.delete", { ns: "common" }),
      cancelLabel: t("actions.cancel", { ns: "common" }),
      onConfirm: () => {
        // Frames, their export logs and the roll's scans go with the roll - otherwise they keep
        // syncing and keep their files on the server under a rollId that no longer exists. The
        // sync engine (T-008) pushes each deletion.
        for (const record of selectRollCascade(useStore.getState(), roll.id)) {
          softDelete(record.collection, record.id);
        }
        router.replace("/");
      },
    });
  };

  const isoLine = `${t("iso", { iso: roll.isoSet })} · ${t(`isoSources.${roll.isoSource}`)}${
    roll.pushPullEv === 0 ? "" : ` · ${t("pushPull", { ev: roll.pushPullEv })}`
  }`;

  return (
    <Screen testID="roll-detail">
      <View style={styles.head}>
        <Text
          testID="roll-detail-title"
          style={[styles.title, { color: palette.text, fontSize: fontSize.xl }]}
        >
          {rollTitle(roll, filmStock, t)}
        </Text>
        <Text testID="roll-detail-camera" style={{ color: palette.text, fontSize: fontSize.md }}>
          {camera === undefined ? t("unknownCamera") : `${camera.make} ${camera.model}`}
        </Text>
        <Text testID="roll-detail-iso" style={{ color: palette.textMuted, fontSize: fontSize.sm }}>
          {isoLine}
        </Text>
        <Text
          testID="roll-detail-progress"
          style={{ color: palette.textMuted, fontSize: fontSize.sm }}
        >
          {t("progress", progress)}
        </Text>
      </View>

      <Section title={t("status.label")}>
        <SelectField
          label={t("status.label")}
          value={roll.status}
          options={statusOptions}
          onChange={changeStatus}
          testID="roll-detail-status"
        />
      </Section>

      <Section title={t("frames")}>
        {frames.length === 0 ? (
          <EmptyState title={t("noFrames")} testID="roll-detail-no-frames" />
        ) : (
          frames.map((frame) => <FrameRow key={frame.id} frame={frame} />)
        )}
        <Button
          title={t("addFrame")}
          onPress={addFrame}
          disabled={full || camera === undefined}
          testID="roll-detail-add-frame"
        />
      </Section>

      <Section title={t("sections.actions")}>
        <Button
          title={t("importScans")}
          variant="secondary"
          onPress={() => router.push(`/scans/${roll.id}`)}
          testID="roll-detail-import-scans"
        />
        <Button
          title={t("exportRoll")}
          variant="secondary"
          onPress={() => router.push(`/export/roll/${roll.id}`)}
          testID="roll-detail-export"
        />
        <Button
          title={t("edit")}
          variant="secondary"
          onPress={() => router.push(`/rolls/${roll.id}/edit`)}
          testID="roll-detail-edit"
        />
        <Button
          title={t("deleteRoll")}
          variant="danger"
          onPress={deleteRoll}
          testID="roll-detail-delete"
        />
      </Section>
    </Screen>
  );
}

function FrameRow({ frame }: { frame: Frame }) {
  return (
    <ListItem
      testID={`frame-item-${frame.id}`}
      title={frameRowTitle(frame)}
      onPress={() => router.push(`/frames/${frame.id}`)}
    />
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.xs },
  title: { fontWeight: fontWeight.bold },
});
