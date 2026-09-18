/**
 * The frame edit screen - core scenario step 4 of the spec (§2.1).
 *
 * The screen owns the edited frame, the validation and the two save paths; what the five
 * sections look like is in `./sections`. Every change recomputes `validateFrame`, and only
 * pressing "save" writes to the store.
 */
import { newFrame, nextFrameNo, validateFrame } from "@filmnotes/domain";
import type { Camera, Frame, FrameContext, Id, Roll } from "@filmnotes/domain";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

import { confirmDestructive } from "../../lib/confirm";
import { now } from "../../lib/clock";
import { useActive, useEntity } from "../../store/hooks";
import { selectFramesForRoll } from "../../store/selectors";
import { useStore } from "../../store/store";
import { Button, EmptyState, IssueList, Screen, Section } from "../../ui";
import { FRAMES_NAMESPACE } from "./i18n";
import { applyLensChange, parseTakenAt, takenAtFields } from "./frameForm";
import { ContextSection } from "./sections/ContextSection";
import { ExposureSection } from "./sections/ExposureSection";
import { FlashSection } from "./sections/FlashSection";
import { FocusSection } from "./sections/FocusSection";
import { OpticsSection } from "./sections/OpticsSection";
import { useLocation } from "./useLocation";

function isPresent<T>(value: T | undefined): value is T {
  return value !== undefined;
}

/**
 * Resolves the route parameter and the records the editor needs. The editor itself is keyed by
 * the frame id so that navigating to the next frame starts with fresh local state.
 */
export function FrameEditScreen() {
  const { t } = useTranslation(FRAMES_NAMESPACE);
  const { frameId } = useLocalSearchParams<{ frameId?: string }>();
  const frame = useEntity("frames", frameId ?? null);
  const roll = useEntity("rolls", frame?.rollId ?? null);
  const camera = useEntity("cameras", roll?.cameraId ?? null);

  if (frame === undefined || frame.deleted !== null || roll === undefined || camera === undefined) {
    return (
      <Screen testID="frame-edit">
        <EmptyState title={t("notFound")} hint={t("notFoundHint")} testID="frame-not-found" />
      </Screen>
    );
  }

  return <FrameEditor key={frame.id} initial={frame} roll={roll} camera={camera} />;
}

interface FrameEditorProps {
  initial: Frame;
  roll: Roll;
  camera: Camera;
}

function FrameEditor({ initial, roll, camera }: FrameEditorProps) {
  const { t } = useTranslation(FRAMES_NAMESPACE);

  const [frame, setFrame] = useState<Frame>(initial);
  const initialTakenAt = takenAtFields(initial.takenAt);
  const [takenDate, setTakenDate] = useState(initialTakenAt.date);
  const [takenTime, setTakenTime] = useState(initialTakenAt.time);
  const [locationHint, setLocationHint] = useState<string | null>(null);

  const lenses = useActive("lenses");
  const allFilters = useActive("filters");
  const flashes = useActive("flashes");
  const allFrames = useActive("frames");
  const upsert = useStore((state) => state.upsert);
  const softDelete = useStore((state) => state.softDelete);
  const { busy: locating, requestPosition } = useLocation();

  const patch = (changes: Partial<Frame>) => setFrame((current) => ({ ...current, ...changes }));

  const lens = lenses.find((candidate) => candidate.id === frame.lensId) ?? null;
  const flash = flashes.find((candidate) => candidate.id === frame.flashId) ?? null;

  const mountedFilters = useMemo(
    () => frame.filterIds.map((id) => allFilters.find((f) => f.id === id)).filter(isPresent),
    [frame.filterIds, allFilters],
  );
  const siblingFrames = useMemo(
    () => allFrames.filter((other) => other.rollId === frame.rollId && other.id !== frame.id),
    [allFrames, frame.rollId, frame.id],
  );
  const context: FrameContext = useMemo(
    () => ({ camera, roll, lens, filters: mountedFilters, flash, siblingFrames }),
    [camera, roll, lens, mountedFilters, flash, siblingFrames],
  );
  const issues = useMemo(() => validateFrame(frame, context), [frame, context]);
  const takenAt = useMemo(() => parseTakenAt(takenDate, takenTime), [takenDate, takenTime]);
  // A frame is saved with an open warning, but never with a timestamp the fields cannot express:
  // that used to store midnight or the wrong month without saying anything.
  const blocked = issues.some((issue) => issue.level === "error") || takenAt.kind === "invalid";

  const title = t("title", { no: frame.frameNo, total: roll.exposures });
  const isLastFrame = frame.frameNo >= roll.exposures;

  /** Writes the edited frame (including the two time fields) to the store. */
  const persist = (): Frame => {
    const saved: Frame = {
      ...frame,
      takenAt: takenAt.kind === "ok" ? takenAt.instant : null,
    };
    upsert("frames", saved);
    return saved;
  };

  const onSave = () => {
    persist();
    router.back();
  };

  /** Saves and immediately opens the following frame, which inherits the camera's setup. */
  const onSaveNext = () => {
    const saved = persist();
    const next = newFrame({
      rollId: saved.rollId,
      frameNo: nextFrameNo(selectFramesForRoll(useStore.getState(), saved.rollId)),
      camera,
      previous: saved,
      now: now(),
    });
    upsert("frames", next);
    router.replace(`/frames/${next.id}`);
  };

  const onDelete = () => {
    confirmDestructive({
      title: t("delete"),
      message: t("deleteConfirm"),
      confirmLabel: t("actions.delete", { ns: "common" }),
      cancelLabel: t("actions.cancel", { ns: "common" }),
      onConfirm: () => {
        softDelete("frames", frame.id);
        router.back();
      },
    });
  };

  const onLensChange = (lensId: Id | null) => {
    const chosen = lenses.find((candidate) => candidate.id === lensId) ?? null;
    setFrame((current) => applyLensChange(current, chosen, allFilters));
  };

  const onFlashChange = (flashId: Id | null) => {
    // Head, power and the exposure check only exist together with a flash unit.
    patch(
      flashId === null
        ? { flashId: null, flashHead: null, flashPower: null, flashOk: null }
        : { flashId },
    );
  };

  const onLocationName = (name: string) => {
    const trimmed = name.trim() === "" ? null : name;
    const lat = frame.location?.lat ?? null;
    const lon = frame.location?.lon ?? null;
    patch(
      trimmed === null && lat === null && lon === null
        ? { location: null }
        : { location: { name: trimmed, lat, lon } },
    );
  };

  const onUseCurrentPosition = async () => {
    const result = await requestPosition();
    if (result.status === "granted") {
      setLocationHint(null);
      patch({ location: { name: frame.location?.name ?? null, lat: result.lat, lon: result.lon } });
      return;
    }
    setLocationHint(result.status === "denied" ? t("location.denied") : t("location.unavailable"));
  };

  return (
    <Screen title={title} testID="frame-edit">
      <Stack.Screen options={{ title }} />

      <ExposureSection frame={frame} camera={camera} lens={lens} patch={patch} />
      <OpticsSection
        frame={frame}
        lens={lens}
        lenses={lenses}
        allFilters={allFilters}
        patch={patch}
        onLensChange={onLensChange}
      />
      <FocusSection frame={frame} camera={camera} patch={patch} />
      <FlashSection
        frame={frame}
        flash={flash}
        flashes={flashes}
        patch={patch}
        onFlashChange={onFlashChange}
      />
      <ContextSection
        frame={frame}
        patch={patch}
        onLocationName={onLocationName}
        onUseCurrentPosition={() => void onUseCurrentPosition()}
        locating={locating}
        locationHint={locationHint}
        takenDate={takenDate}
        takenTime={takenTime}
        setTakenDate={setTakenDate}
        setTakenTime={setTakenTime}
        takenAt={takenAt}
      />

      {issues.length > 0 && (
        <Section title={t("sections.issues")} testID="frame-section-issues">
          <IssueList issues={issues} testID="frame-issues" />
        </Section>
      )}

      <View style={styles.actions}>
        <Button title={t("save")} onPress={onSave} disabled={blocked} testID="frame-save" />
        {!isLastFrame && (
          <Button
            title={t("saveNext")}
            variant="secondary"
            onPress={onSaveNext}
            disabled={blocked}
            testID="frame-save-next"
          />
        )}
        <Button
          title={t("export")}
          variant="secondary"
          onPress={() => router.push(`/export/frame/${frame.id}`)}
          testID="frame-export"
        />
        <Button title={t("delete")} variant="danger" onPress={onDelete} testID="frame-delete" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: 8 },
});
