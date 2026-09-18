/**
 * Frame validation – the camera-specific rules of the design spec (§3.2, rules 1–10).
 *
 * Every rule is a small function that returns the issues it found; `validateFrame` runs them in
 * the order of the spec. Issues never block saving, the UI renders them by `code` through the
 * i18n key `validation.<code>`.
 */
import { isValidAperture } from "./aperture";
import {
  compareShutterSpeeds,
  isBulb,
  isBulbAllowedInMode,
  isSlowerThan,
  shutterSpeedsForMode,
} from "./shutter";
import type { Frame, FrameContext, IssueLevel, ValidationIssue } from "./types";

type Rule = (frame: Frame, context: FrameContext) => ValidationIssue[];

function issue(
  level: IssueLevel,
  code: string,
  field: keyof Frame | null,
  params: Record<string, string | number> = {},
): ValidationIssue {
  return { level, code, field, params };
}

/** 1. Bulb is only available in the modes the camera offers it in (usually M). */
const bulbOnlyInM: Rule = (frame, { camera }) => {
  if (frame.shutterSpeed === null || !isBulb(frame.shutterSpeed)) return [];
  if (isBulbAllowedInMode(camera, frame.exposureMode)) return [];
  return [issue("error", "bulb_only_in_m", "shutterSpeed")];
};

/** 2. The aperture has to exist on the mounted lens. */
const apertureOnLens: Rule = (frame, { lens }) => {
  if (lens === null || frame.aperture === null) return [];
  if (isValidAperture(lens, frame.aperture)) return [];
  return [issue("error", "aperture_not_on_lens", "aperture")];
};

/** 3. Every filter has to match the filter thread of the lens. */
const filterThread: Rule = (frame, { lens, filters }) => {
  if (lens === null || lens.filterThreadMm === null) return [];
  const lensThread = lens.filterThreadMm;
  return filters
    .filter((filter) => filter.threadMm !== lensThread)
    .map((filter) =>
      issue("error", "filter_thread_mismatch", "filterIds", {
        filter: filter.model,
        filterThread: filter.threadMm,
        lensThread,
      }),
    );
};

/** 4. A linear polarizer (or any filter marked incompatible) disables the autofocus. */
const polarizerBlocksAf: Rule = (frame, { filters }) => {
  if (frame.focusMode !== "AF") return [];
  if (!filters.some((filter) => filter.afCompatible === "no")) return [];
  return [issue("warning", "polarizer_blocks_af", "focusMode")];
};

/** 5. With flash in M the camera falls back to its sync speed. */
const flashForcesSyncSpeed: Rule = (frame, { camera }) => {
  const sync = camera.flashSync;
  if (frame.flashId === null || frame.exposureMode !== "M" || sync === null) return [];
  if (frame.shutterSpeed === null || isBulb(frame.shutterSpeed)) return [];
  if (compareShutterSpeeds(frame.shutterSpeed, sync) >= 0) return [];
  return [issue("info", "flash_forces_sync_speed", "shutterSpeed", { sync })];
};

/** 6. Exposure compensation has no effect in the modes the camera lists. */
const compensationIgnoredInM: Rule = (frame, { camera }) => {
  if (frame.exposureCompensationEv === 0 || frame.exposureMode === null) return [];
  if (!camera.exposureCompensation.notInModes.includes(frame.exposureMode)) return [];
  return [issue("info", "compensation_ignored_in_m", "exposureCompensationEv")];
};

/**
 * 7. Hand-held below the lens limit risks camera shake.
 *
 * A frame without a recorded support counts as hand-held: that is how the camera preset starts
 * every frame, and a warning the photographer can dismiss by saying "tripod" is more useful than
 * silence while the field is still empty.
 */
const handheldShakeRisk: Rule = (frame, { lens }) => {
  const limit = lens?.handheldMinShutter ?? null;
  if (limit === null || frame.shutterSpeed === null) return [];
  if (frame.support !== null && frame.support !== "handheld") return [];
  if (!isSlowerThan(frame.shutterSpeed, limit)) return [];
  return [issue("warning", "handheld_shake_risk", "shutterSpeed", { limit })];
};

/** 8. The focal length has to be inside the zoom range of the lens. */
const focalLengthInRange: Rule = (frame, { lens }) => {
  if (lens === null || frame.focalLengthMm === null) return [];
  if (frame.focalLengthMm >= lens.focalMinMm && frame.focalLengthMm <= lens.focalMaxMm) return [];
  return [issue("error", "focal_length_out_of_range", "focalLengthMm")];
};

/** 9a. The frame number has to be on the roll. */
const frameNoInRange: Rule = (frame, { roll }) => {
  if (frame.frameNo >= 1 && frame.frameNo <= roll.exposures) return [];
  return [issue("error", "frame_no_out_of_range", "frameNo")];
};

/** 9b. No two frames of a roll share a frame number. */
const frameNoUnique: Rule = (frame, { siblingFrames }) => {
  const duplicate = siblingFrames.some(
    (sibling) =>
      sibling.id !== frame.id && sibling.deleted === null && sibling.frameNo === frame.frameNo,
  );
  return duplicate ? [issue("error", "frame_no_duplicate", "frameNo")] : [];
};

/** 10. The speed has to be selectable on the camera in that mode. Bulb is rule 1's business. */
const shutterAvailable: Rule = (frame, { camera }) => {
  if (frame.shutterSpeed === null || isBulb(frame.shutterSpeed)) return [];
  if (shutterSpeedsForMode(camera, frame.exposureMode).includes(frame.shutterSpeed)) return [];
  return [issue("error", "shutter_not_available", "shutterSpeed")];
};

const RULES: readonly Rule[] = [
  bulbOnlyInM,
  apertureOnLens,
  filterThread,
  polarizerBlocksAf,
  flashForcesSyncSpeed,
  compensationIgnoredInM,
  handheldShakeRisk,
  focalLengthInRange,
  frameNoInRange,
  frameNoUnique,
  shutterAvailable,
];

/** All issues of a frame, in the rule order of the spec. An empty list means "nothing to say". */
export function validateFrame(frame: Frame, context: FrameContext): ValidationIssue[] {
  return RULES.flatMap((rule) => rule(frame, context));
}
