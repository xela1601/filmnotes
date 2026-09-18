/**
 * The pure model behind the roll create/edit screen.
 *
 * The screen keeps a `RollFormValues` in state, runs `validateRollForm` on save and
 * only then turns the values into a `Roll`. Everything here is free of React and of
 * the store, so the rules are unit-tested without rendering anything.
 */
import {
  newId,
  type Camera,
  type FilmStock,
  type ISODateTime,
  type Id,
  type IsoSource,
  type Roll,
} from "@filmnotes/domain";

/** Film speeds the form accepts – wider than any real stock, narrow enough to catch typos. */
export const ISO_MIN = 6;
export const ISO_MAX = 12800;

/** The number of exposures a 135 roll can have. */
export type Exposures = 24 | 36;

export interface RollFormValues {
  cameraId: Id | null;
  filmStockId: Id | null;
  isoSet: number | null;
  isoSource: IsoSource;
  exposures: Exposures;
  pushPullEv: number;
  /** Empty while the date field holds something unparseable, which `validateRollForm` flags. */
  loadedAt: ISODateTime;
  lab: string;
  notes: string;
}

/** Error code per field; doubles as the i18n key suffix `errors.<code>`. */
export type RollFormErrors = Partial<Record<keyof RollFormValues, "required" | "iso_range">>;

/**
 * A fresh form: the first camera, no film stock yet, a full roll read by DX.
 *
 * `filmStocks` is part of the ticket's interface but deliberately unused – the
 * photographer picks the film explicitly, there is no sensible default for it.
 */
export function defaultRollForm(
  cameras: Camera[],
  filmStocks: FilmStock[],
  now: ISODateTime,
): RollFormValues {
  void filmStocks;
  return {
    cameraId: cameras[0]?.id ?? null,
    filmStockId: null,
    isoSet: null,
    isoSource: "DX",
    exposures: 36,
    pushPullEv: 0,
    loadedAt: now,
    lab: "",
    notes: "",
  };
}

/** Picking a film stock fills in its nominal speed and, if it states one, its length. */
export function applyFilmStock(values: RollFormValues, stock: FilmStock): RollFormValues {
  return {
    ...values,
    filmStockId: stock.id,
    isoSet: stock.iso,
    exposures: stock.exposures ?? values.exposures,
  };
}

export function validateRollForm(values: RollFormValues): RollFormErrors {
  const errors: RollFormErrors = {};

  if (values.cameraId === null) errors.cameraId = "required";
  if (values.filmStockId === null) errors.filmStockId = "required";
  if (values.isoSet === null) {
    errors.isoSet = "required";
  } else if (values.isoSet < ISO_MIN || values.isoSet > ISO_MAX) {
    errors.isoSet = "iso_range";
  }
  if (values.loadedAt === "") errors.loadedAt = "required";

  return errors;
}

/**
 * Builds the record to store. Call `validateRollForm` first: the empty fallbacks below
 * only exist because the value type allows nulls the validated form no longer contains.
 */
export function rollFromForm(
  values: RollFormValues,
  existing: Roll | null,
  now: ISODateTime,
): Roll {
  const lab = values.lab.trim();

  return {
    id: existing?.id ?? newId(),
    created: existing?.created ?? now,
    updated: now,
    deleted: existing?.deleted ?? null,
    owner: existing?.owner ?? null,
    cameraId: values.cameraId ?? "",
    filmStockId: values.filmStockId ?? "",
    isoSet: values.isoSet ?? 0,
    isoSource: values.isoSource,
    exposures: values.exposures,
    pushPullEv: values.pushPullEv,
    // The status is advanced on the roll detail screen, never in the form.
    status: existing?.status ?? "loaded",
    loadedAt: values.loadedAt,
    unloadedAt: existing?.unloadedAt ?? null,
    lab: lab === "" ? null : lab,
    notes: values.notes,
  };
}

/** Fills the form for editing an existing roll. */
export function formFromRoll(roll: Roll): RollFormValues {
  return {
    cameraId: roll.cameraId,
    filmStockId: roll.filmStockId,
    isoSet: roll.isoSet,
    isoSource: roll.isoSource,
    exposures: roll.exposures,
    pushPullEv: roll.pushPullEv,
    loadedAt: roll.loadedAt,
    lab: roll.lab ?? "",
    notes: roll.notes,
  };
}

const DATE_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The `YYYY-MM-DD` part shown in the load date field; empty for an empty timestamp. */
export function dateInputFromIso(iso: ISODateTime): string {
  return iso.slice(0, 10);
}

/** Turns a `YYYY-MM-DD` input into midnight UTC, or null while it is not a real date. */
export function isoFromDateInput(text: string): ISODateTime | null {
  const match = DATE_INPUT_PATTERN.exec(text.trim());
  if (match === null) return null;

  const iso = `${text.trim()}T00:00:00.000Z`;
  const parsed = new Date(iso);
  // Date() happily rolls 2026-02-30 over into March, so compare it back.
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== iso) return null;
  return iso;
}
