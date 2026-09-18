/**
 * Caption builder for exports and share packages.
 *
 * The template is a tiny subset of mustache – `{{key}}` for a value and `{{#key}}…{{/key}}` for a
 * part that only appears when the value is non-empty – so that users can change the caption
 * layout in the settings without the app depending on a template engine.
 */
import { deviceTimeZone, formatLocalDate } from "./localTime";
import type { Camera, FilmStock, Filter, Frame, Lens, Roll } from "./types";

export interface CaptionInput {
  frame: Frame;
  roll: Roll;
  camera: Camera;
  lens: Lens | null;
  filters: Filter[];
  filmStock: FilmStock;
  /** Defaults to `DEFAULT_CAPTION_TEMPLATE`. */
  template?: string;
  /** Defaults to the generic tags plus a tag for the film stock. */
  hashtags?: string[];
  /** Date format only; the caption itself contains no translated words. Defaults to `de`. */
  locale?: "de" | "en";
  /** Time zone the date is written in. Defaults to the device's - see `localTime.ts`. */
  timeZone?: string;
}

export const DEFAULT_CAPTION_TEMPLATE = [
  "{{filmStock}} · {{camera}} · {{lens}}{{#focal}} @ {{focal}}mm{{/focal}}",
  "{{#exposure}}{{exposure}}{{/exposure}}{{#filters}} · {{filters}}{{/filters}}",
  "{{#location}}📍 {{location}}{{/location}}{{#date}} · {{date}}{{/date}}",
  "{{notes}}",
  "{{hashtags}}",
].join("\n");

export const DEFAULT_HASHTAGS: readonly string[] = ["#analog", "#35mm", "#filmphotography"];

const SEPARATOR = "·";
const SECTION_PATTERN = /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
const VALUE_PATTERN = /\{\{(\w+)\}\}/g;

function render(template: string, values: Record<string, string>): string {
  const withSections = template.replace(
    SECTION_PATTERN,
    (_match: string, key: string, body: string) => (values[key] ? body : ""),
  );
  return withSections.replace(VALUE_PATTERN, (_match: string, key: string) => values[key] ?? "");
}

/** `"Kodak Gold 200"` → `"#kodakgold200"`. */
function hashtagFor(filmStock: FilmStock): string {
  return `#${filmStock.name.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
}

function equipmentName(item: { make: string; model: string } | null): string {
  return item === null ? "" : `${item.make} ${item.model}`.trim();
}

function exposureOf(frame: Frame): string {
  const parts: string[] = [];
  if (frame.aperture !== null) parts.push(`f/${frame.aperture}`);
  if (frame.shutterSpeed !== null && frame.shutterSpeed !== "") parts.push(frame.shutterSpeed);
  if (frame.exposureMode !== null) parts.push(frame.exposureMode);
  return parts.join(` ${SEPARATOR} `);
}

/** Removes the separators a dropped value left behind and the trailing blanks of a line. */
function tidyLine(line: string): string {
  return (
    line
      .replace(new RegExp(`(?:\\s*${SEPARATOR}\\s*){2,}`, "g"), ` ${SEPARATOR} `)
      // A dropped value between two kept ones leaves the gap it used to fill ("A ·  @ 50mm").
      .replace(/ {2,}/g, " ")
      .replace(new RegExp(`^\\s*${SEPARATOR}\\s*`), "")
      .replace(new RegExp(`\\s*${SEPARATOR}\\s*$`), "")
      .trimEnd()
  );
}

export function buildCaption(input: CaptionInput): string {
  const { frame, camera, lens, filters, filmStock } = input;
  const locale = input.locale ?? "de";
  const timeZone = input.timeZone ?? deviceTimeZone();
  const hashtags = input.hashtags ?? [...DEFAULT_HASHTAGS, hashtagFor(filmStock)];

  const values: Record<string, string> = {
    filmStock: filmStock.name,
    camera: equipmentName(camera),
    lens: equipmentName(lens),
    focal: frame.focalLengthMm === null ? "" : String(frame.focalLengthMm),
    exposure: exposureOf(frame),
    filters: filters.map((filter) => filter.model).join(", "),
    location: frame.location?.name ?? "",
    date: formatLocalDate(frame.takenAt, locale, timeZone),
    notes: frame.notes,
    hashtags: hashtags.join(" "),
  };

  return render(input.template ?? DEFAULT_CAPTION_TEMPLATE, values)
    .split("\n")
    .map(tidyLine)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
