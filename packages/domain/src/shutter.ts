/**
 * Shutter speed math.
 *
 * A `ShutterSpeed` is the string the camera displays: a fraction (`"1/125"`), whole seconds with
 * the camera's quote mark (`"2\""`), a half stop (`"1\"5"` = 1.5 s, `"0\"7"` = 0.7 s) or `"bulb"`.
 * Everything in this module treats `"bulb"` as the slowest possible speed (an open shutter).
 */
import type { Camera, ExposureMode, ShutterSpeed } from './types';

const BULB = 'bulb';

/** `"1/125"`, also tolerates decimal numerator/denominator. */
const FRACTION_PATTERN = /^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/;
/** `"30\""` and `"1\"5"` – the quote separates whole seconds from tenths. */
const QUOTED_SECONDS_PATTERN = /^(\d+)"(\d*)$/;
/** `"2s"`, `"1.5s"` and the bare number `"2"`. */
const SECONDS_PATTERN = /^(\d+(?:\.\d+)?)\s*s?$/i;

/** True for the bulb setting, written in any capitalisation. */
export function isBulb(value: ShutterSpeed | null): boolean {
  return value !== null && value.trim().toLowerCase() === BULB;
}

/**
 * Exposure time of a displayed shutter speed in seconds.
 * Returns `null` for `"bulb"` (open ended) and for anything that cannot be parsed.
 */
export function parseShutterSpeed(value: ShutterSpeed): number | null {
  const text = value.trim();
  if (text === '' || isBulb(text)) return null;

  const fraction = FRACTION_PATTERN.exec(text);
  if (fraction) {
    const numerator = Number(fraction[1]);
    const denominator = Number(fraction[2]);
    if (denominator === 0) return null;
    return numerator / denominator;
  }

  const quoted = QUOTED_SECONDS_PATTERN.exec(text);
  if (quoted) {
    const whole = quoted[1] ?? '0';
    const tenths = quoted[2] === undefined || quoted[2] === '' ? '0' : quoted[2];
    return Number(`${whole}.${tenths}`);
  }

  const seconds = SECONDS_PATTERN.exec(text);
  if (seconds) return Number(seconds[1]);

  return null;
}

/**
 * The speeds a 35 mm camera can display, from the fastest to the slowest, in whole and half
 * stops. `formatShutterSpeed` snaps to this ladder so that it is the exact inverse of
 * `parseShutterSpeed` for every value a camera shows.
 */
const LADDER: readonly ShutterSpeed[] = [
  '1/8000', '1/6000', '1/4000', '1/3000', '1/2000', '1/1500', '1/1000', '1/750',
  '1/500', '1/350', '1/250', '1/180', '1/125', '1/90', '1/60', '1/45',
  '1/30', '1/20', '1/15', '1/10', '1/8', '1/6', '1/4', '1/3', '1/2',
  '0"7', '1"', '1"5', '2"', '3"', '4"', '6"', '8"', '12"', '15"', '20"', '30"',
];

interface LadderEntry {
  label: ShutterSpeed;
  seconds: number;
}

const LADDER_ENTRIES: readonly LadderEntry[] = LADDER.map((label) => ({
  label,
  seconds: parseShutterSpeed(label) ?? 0,
}));

const FASTEST = LADDER_ENTRIES[0] as LadderEntry;
const SLOWEST = LADDER_ENTRIES[LADDER_ENTRIES.length - 1] as LadderEntry;

/** Formats seconds the way the camera displays them, without the ladder. */
function formatFreely(seconds: number): ShutterSpeed {
  if (seconds < 1) return `1/${Math.round(1 / seconds)}`;
  const tenths = Math.round(seconds * 10) % 10;
  const whole = Math.floor(Math.round(seconds * 10) / 10);
  return tenths === 0 ? `${whole}"` : `${whole}"${tenths}`;
}

/**
 * Inverse of `parseShutterSpeed` for every speed between 1/8000 s and 30 s: the value is snapped
 * to the nearest whole or half stop of the camera ladder. Durations outside that range are
 * formatted freely; an infinite duration is `"bulb"`.
 */
export function formatShutterSpeed(seconds: number): ShutterSpeed {
  if (Number.isNaN(seconds) || seconds <= 0) return FASTEST.label;
  if (!Number.isFinite(seconds)) return BULB;
  if (seconds < FASTEST.seconds / 1.05 || seconds > SLOWEST.seconds * 1.05) {
    return formatFreely(seconds);
  }
  let best = FASTEST;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const entry of LADDER_ENTRIES) {
    const distance = Math.abs(Math.log(seconds / entry.seconds));
    if (distance < bestDistance) {
      best = entry;
      bestDistance = distance;
    }
  }
  return best.label;
}

/** Duration used for ordering: bulb and unparsable values are the slowest. */
function durationOf(value: ShutterSpeed): number {
  return parseShutterSpeed(value) ?? Number.POSITIVE_INFINITY;
}

/** Sort comparator: negative if `a` is the shorter (faster) exposure. */
export function compareShutterSpeeds(a: ShutterSpeed, b: ShutterSpeed): number {
  const durationA = durationOf(a);
  const durationB = durationOf(b);
  if (durationA === durationB) return 0;
  return durationA < durationB ? -1 : 1;
}

/** True if `a` exposes longer than `b`. */
export function isSlowerThan(a: ShutterSpeed, b: ShutterSpeed): boolean {
  return durationOf(a) > durationOf(b);
}

/**
 * True if the camera offers bulb in that mode. An empty `bulbOnlyInModes` means the camera does
 * not restrict bulb at all; an unknown mode only gets bulb in that unrestricted case.
 */
export function isBulbAllowedInMode(camera: Camera, mode: ExposureMode | null): boolean {
  if (camera.bulbOnlyInModes.length === 0) return true;
  return mode !== null && camera.bulbOnlyInModes.includes(mode);
}

/**
 * Speeds selectable in the given mode, fastest first and `"bulb"` last.
 *
 * S and M only offer the whole stops the photographer can dial in; P and A (and an unknown mode,
 * which the UI treats like P) additionally get the half stops the camera picks automatically.
 */
export function shutterSpeedsForMode(camera: Camera, mode: ExposureMode | null): ShutterSpeed[] {
  const manualOnly = mode === 'S' || mode === 'M';
  const candidates = manualOnly
    ? camera.shutterSpeedsManual
    : [...camera.shutterSpeedsManual, ...camera.shutterSpeedsAutoExtra];
  const unique = [...new Set(candidates)];
  return unique
    .filter((speed) => !isBulb(speed) || isBulbAllowedInMode(camera, mode))
    .sort(compareShutterSpeeds);
}
