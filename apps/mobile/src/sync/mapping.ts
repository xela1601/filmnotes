/**
 * Translation between the app's domain entities and PocketBase records.
 *
 * Both directions are pure, so the whole conflict logic in `engine.ts` can be tested
 * without a server.
 *
 * Two things make this more than a spread:
 *
 *  - **Timestamps.** PocketBase owns `created`/`updated` (autodate fields, server time).
 *    The client's own `updated` therefore travels in `clientUpdated`, which is what
 *    last-write-wins compares. `fromRemote` folds it back into `updated`.
 *  - **Empty values.** PocketBase answers with `''` for unset text and date fields, `0`
 *    for unset numbers, `false` for unset booleans and `null` for unset json, and it
 *    formats dates as `YYYY-MM-DD HH:mm:ss.SSSZ`. The field table below says how to read
 *    each field back, so `''` becomes `null` where the domain type is nullable.
 *
 * Known limitation: an unset *nullable number* (`Frame.aperture`, `Camera.year`, …) comes
 * back from a real server as `0`, and an unset nullable bool as `false` – PocketBase does
 * not distinguish "absent" from "zero" for those field types. Records written by this app
 * always carry a value, so this only shows up for records edited in the admin UI.
 */
import type { CollectionName, EntityOf, Id, ISODateTime, SyncedRecord } from "@filmnotes/domain";

import type { RemoteRecord } from "./client";

/** How a remote value is read back into the domain type; `?` marks a nullable field. */
type FieldKind =
  | "text"
  | "text?"
  | "number"
  | "number?"
  | "bool"
  | "bool?"
  | "date"
  | "date?"
  | "json"
  | "jsonArray";

/** Every field of an entity except the ones `SyncedRecord` already covers. */
type FieldSpec<K extends CollectionName> = {
  [F in Exclude<keyof EntityOf<K>, keyof SyncedRecord>]-?: FieldKind;
};

/**
 * The payload fields of every collection, mirroring the schema of
 * `backend/pb_migrations/1758150000_init_collections.js`. The mapped type above makes the
 * compiler reject a missing or misspelled field, so schema and mapping cannot drift.
 */
const FIELD_SPECS: { [K in CollectionName]: FieldSpec<K> } = {
  cameras: {
    make: "text",
    model: "text",
    aliases: "jsonArray",
    year: "number?",
    format: "text",
    mount: "text?",
    exposureModes: "jsonArray",
    shutterSpeedsManual: "jsonArray",
    shutterSpeedsAutoExtra: "jsonArray",
    bulbOnlyInModes: "jsonArray",
    exposureCompensation: "json",
    iso: "json",
    focusModes: "jsonArray",
    driveModes: "jsonArray",
    flashSync: "text?",
    metering: "text",
    notes: "text",
    conditionNotes: "jsonArray",
    defaultsForNewFrame: "json",
  },
  lenses: {
    make: "text",
    model: "text",
    focalMinMm: "number",
    focalMaxMm: "number",
    maxAperture: "number",
    minAperture: "number",
    apertureValues: "jsonArray",
    filterThreadMm: "number?",
    minFocusM: "number?",
    macroNote: "text?",
    weightG: "number?",
    defaultFilterIds: "jsonArray",
    handheldMinShutter: "text?",
    hasHood: "bool",
  },
  filters: {
    make: "text",
    model: "text",
    threadMm: "number",
    type: "text",
    exposureFactorEv: "number",
    afCompatible: "text",
    warning: "text?",
    mountedOnLensId: "text?",
  },
  flashes: {
    make: "text",
    model: "text",
    guideNumberIso100M: "number?",
    powerLevels: "jsonArray",
    headPositions: "jsonArray",
    afIlluminator: "bool",
    sync: "text?",
    notes: "text",
  },
  filmStocks: {
    name: "text",
    maker: "text",
    iso: "number",
    process: "text",
    color: "bool",
    exposures: "number?",
    dxCoded: "bool?",
    notes: "text",
  },
  rolls: {
    cameraId: "text",
    filmStockId: "text",
    isoSet: "number",
    isoSource: "text",
    exposures: "number",
    pushPullEv: "number",
    status: "text",
    loadedAt: "date",
    unloadedAt: "date?",
    lab: "text?",
    notes: "text",
  },
  frames: {
    rollId: "text",
    frameNo: "number",
    takenAt: "date?",
    lensId: "text?",
    focalLengthMm: "number?",
    exposureMode: "text?",
    shutterSpeed: "text?",
    aperture: "number?",
    exposureCompensationEv: "number",
    programShift: "bool",
    aeLock: "bool",
    focusMode: "text?",
    afResult: "text?",
    driveMode: "text?",
    flashId: "text?",
    flashHead: "text?",
    flashPower: "text?",
    flashOk: "bool?",
    filterIds: "jsonArray",
    lensHood: "bool",
    support: "text?",
    beepWarning: "bool",
    light: "text?",
    subject: "text?",
    location: "json",
    notes: "text",
  },
  scans: {
    rollId: "text",
    frameId: "text?",
    fileName: "text",
    sortIndex: "number",
    file: "text?",
    width: "number?",
    height: "number?",
    importedAt: "date",
  },
  exportLogs: {
    frameId: "text",
    target: "text",
    externalId: "text?",
    url: "text?",
    exportedAt: "date",
  },
};

/**
 * The server's own `updated` stamp of a remote record, as an ISO instant.
 *
 * The sync watermark is taken from this and never from a device clock: PocketBase compares the
 * filter against its own column (see `latestRemoteUpdate` in engine.ts).
 */
export function remoteUpdatedAt(remote: RemoteRecord): ISODateTime | null {
  return asDate(remote.updated);
}

/** The payload field names of a collection, in schema order. */
export function payloadFields(collection: CollectionName): string[] {
  return Object.keys(FIELD_SPECS[collection]);
}

const TIMEZONE = /(?:Z|[+-]\d{2}:?\d{2})$/;

/** Reads a PocketBase date (`2026-09-18 10:00:00.000Z`) as an ISO UTC string. */
function asDate(value: unknown): ISODateTime | null {
  if (typeof value !== "string" || value === "") return null;
  let text = value.replace(" ", "T");
  // PocketBase stores UTC; older versions omit the designator, which `Date` would
  // otherwise read as local time.
  if (!TIMEZONE.test(text)) text += "Z";
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function asText(value: unknown): string | null {
  if (typeof value === "string") return value === "" ? null : value;
  // A number or boolean in a text field is a server-side type slip worth keeping; an object
  // (an expanded relation, a nested error payload) would stringify to "[object Object]" and
  // silently write that into the entity, so it is dropped instead.
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  if (typeof value === "boolean") return String(value);
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function coerce(value: unknown, kind: FieldKind): unknown {
  switch (kind) {
    case "text":
      return typeof value === "string" ? value : (asText(value) ?? "");
    case "text?":
      return asText(value);
    case "number":
      return asNumber(value) ?? 0;
    case "number?":
      return asNumber(value);
    case "bool":
      return value === true;
    case "bool?":
      return value === null || value === undefined || value === "" ? null : value === true;
    case "date":
      return asDate(value) ?? "";
    case "date?":
      return asDate(value);
    case "jsonArray":
      return Array.isArray(value) ? value : [];
    case "json":
      return value === undefined ? null : value;
  }
}

/**
 * Domain entity → PocketBase payload: adds `owner` and `clientUpdated`, keeps the
 * client id and every other field as it is.
 *
 * `created` and `updated` are sent too, but PocketBase ignores them (autodate fields);
 * they are part of the payload only so that the mapping stays symmetric.
 */
export function toRemote<K extends CollectionName>(
  collection: K,
  record: EntityOf<K>,
  ownerId: Id,
): RemoteRecord {
  const source = record as unknown as Record<string, unknown>;
  const remote: Record<string, unknown> = {};
  for (const field of payloadFields(collection)) remote[field] = source[field];

  return {
    ...remote,
    id: record.id,
    created: record.created,
    updated: record.updated,
    deleted: record.deleted,
    owner: ownerId,
    clientUpdated: record.updated,
  };
}

/**
 * PocketBase record → domain entity: `updated` comes from `clientUpdated` (the server
 * `updated` is only a fallback for records that were not written by this app), `owner`
 * from the remote record, and unknown fields (`collectionId`, `expand`, …) are dropped.
 */
export function fromRemote<K extends CollectionName>(
  collection: K,
  remote: RemoteRecord,
): EntityOf<K> {
  const entity: Record<string, unknown> = {};
  const spec: Record<string, FieldKind> = FIELD_SPECS[collection];
  for (const [field, kind] of Object.entries(spec)) entity[field] = coerce(remote[field], kind);

  const serverUpdated = asDate(remote.updated);
  const created = asDate(remote.created) ?? serverUpdated ?? "";

  entity.id = String(remote.id);
  entity.created = created;
  entity.updated = asDate(remote.clientUpdated) ?? serverUpdated ?? created;
  entity.deleted = asDate(remote.deleted);
  entity.owner = asText(remote.owner);

  // The field table above is exhaustive per collection, so the assembled object has
  // exactly the shape of `EntityOf<K>`; TypeScript cannot see that through the generic.
  return entity as unknown as EntityOf<K>;
}
