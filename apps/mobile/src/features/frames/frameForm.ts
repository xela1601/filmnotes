/**
 * Pure rules of the frame edit form.
 *
 * Everything in this module is a plain function over domain records so that the screen itself
 * stays a thin composition: which fields the exposure mode leaves to the photographer, which
 * focal lengths and filters the mounted lens offers, and what changes when the lens is swapped.
 */
import type { ExposureMode, Filter, Frame, Id, Lens } from '@filmnotes/domain';

/** Which exposure fields the photographer dials in himself in a given mode. */
export interface EditableFields {
  /** The shutter speed is set on the camera (S, M – and while the mode is unknown). */
  shutter: boolean;
  /** The aperture is set on the camera (A, M – and while the mode is unknown). */
  aperture: boolean;
  /** Program shift exists in P only: it moves the camera's time/aperture pair. */
  programShift: boolean;
  /** Exposure compensation works in every automatic mode, but not in M. */
  compensation: boolean;
}

/**
 * The fields a mode leaves editable.
 *
 * P lets the camera pick both time and aperture, so only program shift and compensation remain.
 * A and S each open the half the photographer controls. M opens both and switches off the two
 * automation helpers – in M the camera applies neither a program shift nor a compensation.
 * An unknown mode restricts nothing but program shift, which is meaningless without P.
 */
export function editableFields(mode: ExposureMode | null): EditableFields {
  switch (mode) {
    case 'P':
      return { shutter: false, aperture: false, programShift: true, compensation: true };
    case 'A':
      return { shutter: false, aperture: true, programShift: false, compensation: true };
    case 'S':
      return { shutter: true, aperture: false, programShift: false, compensation: true };
    case 'M':
      return { shutter: true, aperture: true, programShift: false, compensation: false };
    default:
      return { shutter: true, aperture: true, programShift: false, compensation: true };
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
  const kept = lens === null ? [...frame.filterIds] : frame.filterIds.filter((id) => fittingIds.has(id));
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
  'sun',
  'cloudy',
  'shade',
  'indoor_window',
  'indoor_artificial',
  'night',
  'backlight',
  'snow_beach',
];

/** Subject kinds offered for `Frame.subject` (the field itself stays free text). */
export const SUBJECT_OPTIONS: string[] = [
  'portrait',
  'landscape',
  'street',
  'sport',
  'macro',
  'group',
  'night',
  'other',
];
