/**
 * The real `ImportClient`, on top of the `pocketbase` JS SDK.
 *
 * The SDK is ESM-only while this workspace compiles to CommonJS (it has to run as a plain
 * `node dist/cli.js`), so it is loaded with a dynamic `import()` – which `module: Node16` keeps
 * intact in the CommonJS output. That also keeps the SDK out of the unit tests: `main` takes its
 * client from `deps`, and only `cli.ts` ever reaches this module.
 */
import type { Frame, Id, ISODateTime } from "@filmnotes/domain";

import type { ImportClient } from "./main";

/** A record as PocketBase returns it: unset text/date fields are `''`, unset json is `null`. */
interface RemoteRecord {
  id: string;
  [field: string]: unknown;
}

/** The auth collection the single app user lives in (see `backend/README.md`). */
const USERS_COLLECTION = "users";
const FRAMES_COLLECTION = "frames";

const TIMEZONE = /(?:Z|[+-]\d{2}:?\d{2})$/;

/**
 * Reads a PocketBase date (`2026-09-18 10:00:00.000Z`) as an ISO UTC string, like
 * `apps/mobile/src/sync/mapping.ts` does. `''` (the value of an unset date field) becomes `null`.
 */
function asDate(value: unknown): ISODateTime | null {
  if (typeof value !== "string" || value === "") return null;
  let text = value.replace(" ", "T");
  if (!TIMEZONE.test(text)) text += "Z";
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Builds a domain `Frame` from a PocketBase record.
 *
 * Only the four fields the import actually uses are read – `id` and `frameNo` for the matching,
 * `deleted` to skip removed frames, `notes` for the plan table. Everything else gets a neutral
 * default: the CLI never displays or writes a frame, and a half-correct camera setting in a
 * temporary object would be worse than an obvious placeholder. The full, tested translation is
 * `fromRemote` in `apps/mobile/src/sync/mapping.ts`.
 */
function frameFromRecord(record: RemoteRecord): Frame {
  return {
    id: record.id,
    created: asDate(record.created) ?? "",
    updated: asDate(record.clientUpdated) ?? asDate(record.updated) ?? "",
    deleted: asDate(record.deleted),
    owner: asText(record.owner) === "" ? null : asText(record.owner),
    rollId: asText(record.rollId),
    frameNo: asNumber(record.frameNo),
    notes: asText(record.notes),
    takenAt: null,
    lensId: null,
    focalLengthMm: null,
    exposureMode: null,
    shutterSpeed: null,
    aperture: null,
    exposureCompensationEv: 0,
    programShift: false,
    aeLock: false,
    focusMode: null,
    afResult: null,
    driveMode: null,
    flashId: null,
    flashHead: null,
    flashPower: null,
    flashOk: null,
    filterIds: [],
    lensHood: false,
    support: null,
    beepWarning: false,
    light: null,
    subject: null,
    location: null,
  };
}

/**
 * Connects to `server` and returns the client `main` works with.
 *
 * Auto-cancellation is switched off for the same reason as in the app: the CLI issues several
 * requests against the same endpoint (one `update` per scan) and the SDK would otherwise cancel
 * the pending one.
 */
export async function createPocketBaseClient(server: string): Promise<ImportClient> {
  const { default: PocketBase } = await import("pocketbase");
  const pb = new PocketBase(server);
  pb.autoCancellation(false);

  return {
    collection: (name: string) => pb.collection(name),

    async authWithPassword(email: string, password: string): Promise<{ userId: Id }> {
      const auth = await pb.collection(USERS_COLLECTION).authWithPassword(email, password);
      return { userId: auth.record.id };
    },

    async listFrames(rollId: Id): Promise<Frame[]> {
      // Deliberately no filter on a date field: PocketBase compares date filters lexically
      // against its own `YYYY-MM-DD HH:mm:ss.SSSZ` form, so a filter built from an ISO string
      // silently matches nothing. The (few) deleted frames of a roll are dropped in memory.
      const records = await pb.collection(FRAMES_COLLECTION).getFullList<RemoteRecord>({
        filter: pb.filter("rollId = {:rollId}", { rollId }),
        sort: "frameNo",
      });
      return records.map(frameFromRecord);
    },
  };
}
