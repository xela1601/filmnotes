/**
 * Labels for the roll screens.
 *
 * Kept free of React and of i18next: the one translated fragment (the fallback for a
 * film stock that is no longer in the store) is passed in as `t`.
 */
import type { FilmStock, Frame, Roll } from "@filmnotes/domain";

/** The subset of i18next's `t` these labels need. */
export type Translate = (key: string) => string;

/** How much of a frame's notes fits into a list row. */
export const FRAME_NOTES_MAX = 40;

const MISSING = "–";

/** e.g. `"Kodak Gold 200 · 2026-09-18"`. */
export function rollTitle(roll: Roll, filmStock: FilmStock | undefined, t: Translate): string {
  const name = filmStock?.name ?? t("unknownFilm");
  return `${name} · ${roll.loadedAt.slice(0, 10)}`;
}

/** How many frames of the roll are shot – rendered as `"12 / 36"`. */
export function rollProgress(roll: Roll, frames: Frame[]): { shot: number; total: number } {
  return {
    shot: frames.filter((frame) => frame.deleted === null).length,
    total: roll.exposures,
  };
}

/** e.g. `"#7 · 1/125 · f/5.6 · Bridge in the morning fog"`. */
export function frameRowTitle(frame: Frame): string {
  const parts = [
    `#${frame.frameNo}`,
    frame.shutterSpeed ?? MISSING,
    frame.aperture === null ? MISSING : `f/${frame.aperture}`,
  ];

  const notes = frame.notes.trim();
  if (notes !== "") {
    parts.push(notes.length > FRAME_NOTES_MAX ? `${notes.slice(0, FRAME_NOTES_MAX)}…` : notes);
  }

  return parts.join(" · ");
}
