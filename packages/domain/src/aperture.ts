/** Aperture helpers: which f-numbers a lens offers and whether a value is one of them. */
import type { Lens } from "./types";

/** Tolerance for comparing f-numbers that were rounded for display (f/4.8, f/6.7, ...). */
const EPSILON = 1e-6;

/** The f-numbers engraved on the lens, fastest first. Without a lens nothing is known. */
export function apertureValuesForLens(lens: Lens | null): number[] {
  return lens === null ? [] : [...lens.apertureValues];
}

/**
 * True if the aperture can be set on the lens. An unknown lens – or one without a recorded
 * scale – imposes no restriction, so any value passes.
 */
export function isValidAperture(lens: Lens | null, aperture: number): boolean {
  if (lens === null || lens.apertureValues.length === 0) return true;
  return lens.apertureValues.some((value) => Math.abs(value - aperture) < EPSILON);
}
