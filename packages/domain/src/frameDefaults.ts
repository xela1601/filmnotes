/**
 * Defaults for a freshly created frame.
 *
 * A new frame starts from the camera preset (`defaultsForNewFrame`). If the roll already has a
 * frame, the setup of that frame wins for everything that stays mounted on the camera – lens,
 * filters, flash, modes, support. The exposure itself (times, aperture, notes, location) is
 * always empty: it is what the photographer is about to record.
 */
import { newId } from "./id";
import type { Camera, Frame, FrameDefaults, Id, ISODateTime } from "./types";

export interface NewFrameInput {
  rollId: Id;
  frameNo: number;
  camera: Camera;
  /** The frame shot before this one on the same roll, or null for the first frame. */
  previous: Frame | null;
  now: ISODateTime;
}

/** The next free frame number: one past the highest one in use. Gaps are left alone. */
export function nextFrameNo(frames: Frame[]): number {
  const highest = frames
    .filter((frame) => frame.deleted === null)
    .reduce((max, frame) => Math.max(max, frame.frameNo), 0);
  return highest + 1;
}

/**
 * What a camera without a usable `defaultsForNewFrame` starts a frame with.
 *
 * PocketBase answers `null` for an unset json field, so a camera record that was created or
 * blanked in the admin UI arrives without this object - and every `newFrame` on it used to
 * throw on the first property access.
 */
export const EMPTY_FRAME_DEFAULTS: FrameDefaults = {
  exposureMode: null,
  driveMode: null,
  focusMode: null,
  exposureCompensationEv: 0,
  programShift: false,
  aeLock: false,
  lensId: null,
  filterIds: [],
  flashId: null,
  support: null,
};

export function newFrame(input: NewFrameInput): Frame {
  const { rollId, frameNo, camera, previous, now } = input;
  const defaults: FrameDefaults = {
    ...EMPTY_FRAME_DEFAULTS,
    ...(camera.defaultsForNewFrame as FrameDefaults | null | undefined),
  };
  /** Everything that stays mounted/dialled in on the camera between two shots. */
  const carriedOver =
    previous === null
      ? {
          lensId: defaults.lensId,
          focalLengthMm: null,
          filterIds: defaults.filterIds,
          flashId: defaults.flashId,
          flashHead: null,
          flashPower: null,
          exposureMode: defaults.exposureMode,
          focusMode: defaults.focusMode,
          driveMode: defaults.driveMode,
          support: defaults.support,
          lensHood: false,
          light: null,
        }
      : {
          lensId: previous.lensId,
          focalLengthMm: previous.focalLengthMm,
          filterIds: previous.filterIds,
          flashId: previous.flashId,
          flashHead: previous.flashHead,
          flashPower: previous.flashPower,
          exposureMode: previous.exposureMode,
          focusMode: previous.focusMode,
          driveMode: previous.driveMode,
          support: previous.support,
          lensHood: previous.lensHood,
          light: previous.light,
        };

  return {
    id: newId(),
    created: now,
    updated: now,
    deleted: null,
    owner: null,
    rollId,
    frameNo,
    takenAt: now,
    lensId: carriedOver.lensId,
    focalLengthMm: carriedOver.focalLengthMm,
    exposureMode: carriedOver.exposureMode,
    shutterSpeed: null,
    aperture: null,
    exposureCompensationEv: defaults.exposureCompensationEv,
    programShift: defaults.programShift,
    aeLock: defaults.aeLock,
    focusMode: carriedOver.focusMode,
    afResult: null,
    driveMode: carriedOver.driveMode,
    flashId: carriedOver.flashId,
    flashHead: carriedOver.flashHead,
    flashPower: carriedOver.flashPower,
    flashOk: null,
    filterIds: [...carriedOver.filterIds],
    lensHood: carriedOver.lensHood,
    support: carriedOver.support,
    beepWarning: false,
    light: carriedOver.light,
    subject: null,
    location: null,
    notes: "",
  };
}
