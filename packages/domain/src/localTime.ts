/**
 * Local calendar time of an instant.
 *
 * Every timestamp in this app is stored as an ISO instant in UTC, which is right for storage and
 * wrong for everything a photographer reads: a frame shot on 19 September at 00:30 in Munich is
 * `2026-09-18T22:30:00.000Z`, and slicing the ISO string - which is what the caption builder, the
 * WordPress exporter and the frame editor all used to do - puts it on the 18th, an hour and a half
 * before it was taken. Everything the user sees or types therefore goes through this module.
 *
 * `Intl.DateTimeFormat` does the work: it is in every JS runtime this app targets (Hermes with
 * `hermes-intl`, every browser, Node), and it knows the zone database, so there is no dependency
 * and no hand-rolled DST arithmetic.
 */
import type { ISODateTime } from "./types";

/** `2026-09-18` */
export type LocalDate = string;
/** `22:30` */
export type LocalTime = string;

export interface LocalParts {
  date: LocalDate;
  time: LocalTime;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

/** True for a zone `Intl` actually accepts. */
function isUsable(timeZone: string | undefined): timeZone is string {
  if (typeof timeZone !== "string" || timeZone === "") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * The zone to compute with, or `undefined` for "whatever the runtime's default is".
 *
 * A runtime that cannot *name* its zone still has one: Node with `TZ=CEST-2` formats correctly
 * but answers `undefined`, and a container without `/etc/localtime` answers `Etc/Unknown` -
 * which, handed back to `Intl`, throws a `RangeError`. Unguarded that took the whole app down on
 * the first date it formatted (found by running the exported bundle in Chromium). Passing
 * `undefined` on keeps the runtime's own default, which is the time the user reads on the device.
 */
function usable(timeZone: string | undefined): string | undefined {
  return isUsable(timeZone) ? timeZone : undefined;
}

/**
 * The name of the zone the device is in, for display and logging - `"UTC"` when the runtime
 * cannot name one. The functions below do not use it: they leave an unnamed zone to the runtime.
 */
export function deviceTimeZone(): string {
  const zone: string | undefined = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return isUsable(zone) ? zone : "UTC";
}

/** The numeric parts of an instant in a zone, via the one formatter that knows the zone rules. */
function partsOf(utcMs: number, timeZone: string | undefined): Record<string, number> {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: usable(timeZone),
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, number> = {};
  for (const { type, value } of formatter.formatToParts(new Date(utcMs))) {
    if (type !== "literal") parts[type] = Number(value);
  }
  // `hour12: false` still renders midnight as 24 in some ICU versions.
  if (parts.hour === 24) parts.hour = 0;
  return parts;
}

/** How far `timeZone` is ahead of UTC at that instant, in milliseconds. */
function offsetAt(utcMs: number, timeZone: string | undefined): number {
  const parts = partsOf(utcMs, timeZone);
  const asUtc = Date.UTC(
    parts.year as number,
    (parts.month as number) - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Two digits, for the fields the user reads and types. */
function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * The local calendar date and clock time of an instant, or `null` when the timestamp is not one.
 */
export function localParts(instant: ISODateTime | null, timeZone?: string): LocalParts | null {
  if (instant === null) return null;
  const utcMs = Date.parse(instant);
  if (Number.isNaN(utcMs)) return null;
  const parts = partsOf(utcMs, timeZone);
  return {
    date: `${String(parts.year).padStart(4, "0")}-${pad(parts.month as number)}-${pad(parts.day as number)}`,
    time: `${pad(parts.hour as number)}:${pad(parts.minute as number)}`,
  };
}

/**
 * Local date (`2026-09-19`) and time (`00:30`) back into the stored instant.
 *
 * Returns `null` for anything that is not a real local time: a malformed field, a month of 13, a
 * 31st of February - the calendar overflow that silently turned `2026-13-45` into February 2027.
 *
 * The offset is looked up twice because the first lookup uses the wrong instant by exactly the
 * offset, which matters on the two DST switch days.
 */
export function instantFromLocal(
  date: LocalDate,
  time: LocalTime,
  timeZone?: string,
): ISODateTime | null {
  const day = DATE_PATTERN.exec(date.trim());
  const clock = TIME_PATTERN.exec(time.trim());
  if (day === null || clock === null) return null;

  const [year, month, dayOfMonth] = [Number(day[1]), Number(day[2]), Number(day[3])];
  const [hour, minute] = [Number(clock[1]), Number(clock[2])];
  if (month < 1 || month > 12 || dayOfMonth < 1 || dayOfMonth > 31) return null;
  if (hour > 23 || minute > 59) return null;

  const wallClock = Date.UTC(year, month - 1, dayOfMonth, hour, minute);
  // Date.UTC rolls a 31st of February over into March; a real date survives the round trip.
  const rolled = new Date(wallClock);
  if (
    rolled.getUTCFullYear() !== year ||
    rolled.getUTCMonth() !== month - 1 ||
    rolled.getUTCDate() !== dayOfMonth
  ) {
    return null;
  }

  const firstGuess = wallClock - offsetAt(wallClock, timeZone);
  const instant = wallClock - offsetAt(firstGuess, timeZone);
  return new Date(instant).toISOString();
}

/** The local calendar date of an instant, as the locale writes it. */
export function formatLocalDate(
  instant: ISODateTime | null,
  locale: "de" | "en",
  timeZone?: string,
): string {
  const parts = localParts(instant, timeZone);
  if (parts === null) return "";
  const [year, month, day] = parts.date.split("-") as [string, string, string];
  return locale === "en" ? `${year}-${month}-${day}` : `${day}.${month}.${year}`;
}
