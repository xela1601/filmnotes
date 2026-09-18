/**
 * Pure rules of the frame edit form.
 *
 * Everything in this module is a plain function over domain records so that the screen itself
 * stays a thin composition: which fields the exposure mode leaves to the photographer, which
 * focal lengths and filters the mounted lens offers, and what changes when the lens is swapped.
 */
import { instantFromLocal, localParts } from "@filmnotes/domain";
import type { ExposureMode, Filter, Frame, Id, ISODateTime, Lens } from "@filmnotes/domain";

/** Who dialled a value in: the photographer, or the camera's automatic. */
export type SetBy = "photographer" | "camera";

/** Which exposure fields the photographer dials in himself in a given mode. */
export interface ExposureFields {
  /** The shutter speed: dialled in S and M, chosen by the camera in P and A. */
  shutter: SetBy;
  /** The aperture: dialled in A and M, chosen by the camera in P and S. */
  aperture: SetBy;
  /** Program shift exists in P only: it moves the camera's time/aperture pair. */
  programShift: boolean;
  /** Exposure compensation works in every automatic mode, but not in M. */
  compensation: boolean;
}

/**
 * Who sets what in a given exposure mode.
 *
 * Both fields are always *recorded* - the camera shows the time it picked in A and the aperture
 * it picked in S, and writing that down is the whole point of the app (spec §2.1 step 4, and
 * validation rule 10, which accepts the automatic half stops). The mode only decides whether the
 * field is something the photographer dialled in or something he reads off the camera, and
 * whether program shift and compensation apply at all: in M the camera applies neither.
 */
export function exposureFields(mode: ExposureMode | null): ExposureFields {
  switch (mode) {
    case "P":
      return {
        shutter: "camera",
        aperture: "camera",
        programShift: true,
        compensation: true,
      };
    case "A":
      return {
        shutter: "camera",
        aperture: "photographer",
        programShift: false,
        compensation: true,
      };
    case "S":
      return {
        shutter: "photographer",
        aperture: "camera",
        programShift: false,
        compensation: true,
      };
    case "M":
      return {
        shutter: "photographer",
        aperture: "photographer",
        programShift: false,
        compensation: false,
      };
    default:
      // Nothing is known about the mode, so nothing is attributed to the camera.
      return {
        shutter: "photographer",
        aperture: "photographer",
        programShift: false,
        compensation: true,
      };
  }
}

/**
 * Focal lengths engraved on the zoom rings of 35 mm lenses.
 *
 * A zoom ring turns continuously, but the photographer reads off one of these marks, so they
 * are the only values worth offering as buttons.
 */
const FOCAL_MARKS: readonly number[] = [20, 24, 28, 35, 50, 70, 100, 135, 150, 210, 300];

/**
 * The focal lengths selectable for a lens: both ends of the zoom range plus the marks in
 * between, or the single focal length of a prime. Without a lens nothing is known.
 */
export function focalLengthOptions(lens: Lens | null): number[] {
  if (lens === null) return [];
  if (lens.focalMinMm === lens.focalMaxMm) return [lens.focalMinMm];
  const marks = FOCAL_MARKS.filter((mark) => mark > lens.focalMinMm && mark < lens.focalMaxMm);
  return [lens.focalMinMm, ...marks, lens.focalMaxMm];
}

/**
 * The filters that can be screwed onto the mounted lens, in the order they were passed in.
 * A lens without a recorded filter thread – and the state before a lens is chosen – imposes no
 * restriction, because then nothing is known about what fits.
 */
export function filterOptions(filters: Filter[], lens: Lens | null): Filter[] {
  const thread = lens?.filterThreadMm ?? null;
  if (thread === null) return [...filters];
  return filters.filter((filter) => filter.threadMm === thread);
}

/**
 * The frame after swapping the lens: the focal length falls back to the short end of the new
 * lens, filters that do not fit its thread come off, the filters it is normally used with go on,
 * and a hood is only recorded for a lens that has one.
 */
export function applyLensChange(frame: Frame, lens: Lens | null, allFilters: Filter[]): Frame {
  const fitting = filterOptions(allFilters, lens);
  const fittingIds = new Set(fitting.map((filter) => filter.id));
  const kept =
    lens === null ? [...frame.filterIds] : frame.filterIds.filter((id) => fittingIds.has(id));
  const filterIds: Id[] = [...kept];
  for (const id of lens?.defaultFilterIds ?? []) {
    if (!filterIds.includes(id) && fittingIds.has(id)) filterIds.push(id);
  }

  return {
    ...frame,
    lensId: lens?.id ?? null,
    focalLengthMm: lens?.focalMinMm ?? null,
    filterIds,
    lensHood: lens?.hasHood === true ? frame.lensHood : false,
  };
}

/** Light situations offered for `Frame.light` (the field itself stays free text). */
export const LIGHT_OPTIONS: string[] = [
  "sun",
  "cloudy",
  "shade",
  "indoor_window",
  "indoor_artificial",
  "night",
  "backlight",
  "snow_beach",
];

/** Subject kinds offered for `Frame.subject` (the field itself stays free text). */
export const SUBJECT_OPTIONS: string[] = [
  "portrait",
  "landscape",
  "street",
  "sport",
  "macro",
  "group",
  "night",
  "other",
];

/** The two fields the photographer edits, in his own time zone. */
export interface TakenAtFields {
  date: string;
  time: string;
}

/**
 * What the pair of fields currently means.
 *
 * `invalid` is the state that used to be missing: a half-typed time ("9:5") was read as midnight
 * and an impossible date rolled over into the next month, both silently. Now the screen can say
 * so and refuse to save instead of storing a wrong timestamp.
 */
export type TakenAt =
  | { kind: "empty" }
  | { kind: "ok"; instant: ISODateTime }
  | { kind: "invalid"; field: "date" | "time" };

/** `takenAt` split into the two fields, in the device's time zone. */
export function takenAtFields(takenAt: ISODateTime | null, timeZone?: string): TakenAtFields {
  const parts = localParts(takenAt, timeZone);
  return parts === null ? { date: "", time: "" } : { date: parts.date, time: parts.time };
}

/**
 * The two fields back into a timestamp.
 *
 * Both empty means "no time recorded", which is a legitimate state - a frame can be written down
 * without one. Anything else has to parse completely: a date without a time has no instant, and a
 * date the calendar does not have is not a date.
 */
export function parseTakenAt(date: string, time: string, timeZone?: string): TakenAt {
  const trimmedDate = date.trim();
  const trimmedTime = time.trim();
  if (trimmedDate === "" && trimmedTime === "") return { kind: "empty" };
  if (trimmedDate === "") return { kind: "invalid", field: "date" };
  if (trimmedTime === "") return { kind: "invalid", field: "time" };

  const instant = instantFromLocal(trimmedDate, trimmedTime, timeZone);
  if (instant !== null) return { kind: "ok", instant };
  // Which of the two is wrong: the date parses on its own, so blame the time then.
  return instantFromLocal(trimmedDate, "12:00", timeZone) === null
    ? { kind: "invalid", field: "date" }
    : { kind: "invalid", field: "time" };
}
