/**
 * Defaults for a freshly created frame.
 *
 * A new frame starts from the camera preset (`defaultsForNewFrame`); once the roll has a frame,
 * that frame wins. The rule is "what is still true when you wind on":
 *
 *  - **Carried over** – everything that is still set when the next shot comes: the lens and its
 *    focal length, the filters, the flash and how it is set, the exposure mode, focus and drive
 *    mode, the support, the hood, the light, the exposure itself (time, aperture, compensation),
 *    and where you are and what you are photographing. In a series that is almost everything, so
 *    in the field only what actually changed has to be touched.
 *  - **Empty again** – what you observed about *that* one frame: the AF lamp, whether the flash
 *    was enough, the beep, the notes, and the time of the shot.
 *  - **Reset** – what the camera itself resets between two shots: program shift (cancelled when
 *    the meter switches off) and AE lock (held with a button).
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
  /** Everything that is still set on the camera - and around it - when the film is wound on. */
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
          shutterSpeed: null,
          aperture: null,
          exposureCompensationEv: defaults.exposureCompensationEv,
          subject: null,
          location: null,
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
          shutterSpeed: previous.shutterSpeed,
          aperture: previous.aperture,
          exposureCompensationEv: previous.exposureCompensationEv,
          subject: previous.subject,
          // Copied, not shared: editing the new frame's location must not change the old one.
          location: previous.location === null ? null : { ...previous.location },
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
    shutterSpeed: carriedOver.shutterSpeed,
    aperture: carriedOver.aperture,
    exposureCompensationEv: carriedOver.exposureCompensationEv,
    // The camera resets both between two shots, so a new frame does too.
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
    subject: carriedOver.subject,
    location: carriedOver.location,
    notes: "",
  };
}
