/**
 * Uploading the planned scans into PocketBase.
 *
 * Every file becomes one record in the `scans` collection plus a multipart upload into its
 * `file` field – the same two steps the app's sync client does (`apps/mobile/src/sync/client.ts`),
 * because PocketBase needs the record id before a file can be attached to it.
 *
 * One broken file must not cost the rest of the roll, so each file is uploaded on its own and a
 * failure is collected instead of thrown.
 */
import { readFile } from "node:fs/promises";

import type { Id, ScanAssignment } from "@filmnotes/domain";
import { newId } from "@filmnotes/domain";

import type { ImageFile } from "./files";

/** The collection of the `scans` records, narrowed to what the upload needs. */
export interface ScanCollection {
  create(data: Record<string, unknown>): Promise<{ id: string }>;
  /** `FormData` carries the scan file; a plain object patches fields (the repair below). */
  update(id: string, data: FormData | Record<string, unknown>): Promise<unknown>;
}

/** The slice of the PocketBase SDK `uploadPlan` uses, so tests can pass a fake. */
export interface PocketBaseLike {
  collection(name: string): ScanCollection;
}

/** Progress output, one line per file. */
export type Log = (message: string) => void;

export interface UploadSummary {
  uploaded: number;
  /** File names that could not be uploaded, in plan order. */
  failed: string[];
}

/** The PocketBase collection the scan records live in (see `PB_COLLECTION` in the domain). */
const SCANS = "scans";
/** The file field of that collection. */
const FILE_FIELD = "file";

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Marks a record whose file never arrived as deleted, and says so for the log.
 *
 * A scan record without a file would reach the app through the next sync as a scan without an
 * image, so it is soft-deleted – exactly the repair `uploadScans` does in the app. Best effort:
 * the connection that just failed is the same one this needs.
 */
async function softDelete(
  pb: PocketBaseLike,
  recordId: string | null,
  timestamp: string,
): Promise<string> {
  if (recordId === null) return "";
  try {
    await pb.collection(SCANS).update(recordId, {
      id: recordId,
      deleted: timestamp,
      updated: timestamp,
      clientUpdated: timestamp,
    });
    return ` (scan ${recordId} was marked deleted again)`;
  } catch {
    return ` (scan ${recordId} has no file and could not be cleaned up)`;
  }
}

/**
 * Uploads every planned file as a scan of `rollId`, owned by `ownerId`.
 *
 * Files the plan left unassigned are uploaded too, with `frameId: null`: the scan is safely on
 * the server and can be attached to a frame in the app's review screen.
 *
 * `created`/`updated` are left to PocketBase (autodate fields); `clientUpdated` carries our own
 * timestamp for the last-write-wins sync, exactly as `toRemote` in the app does.
 */
export async function uploadPlan(
  pb: PocketBaseLike,
  ownerId: Id,
  rollId: Id,
  files: ImageFile[],
  assignments: ScanAssignment[],
  log: Log,
): Promise<UploadSummary> {
  const fileByName = new Map(files.map((file) => [file.name, file]));
  const ordered = [...assignments].sort((a, b) => a.sortIndex - b.sortIndex);

  let uploaded = 0;
  const failed: string[] = [];

  for (const assignment of ordered) {
    const file = fileByName.get(assignment.fileName);
    if (file === undefined) {
      failed.push(assignment.fileName);
      log(`${assignment.fileName}: no such file in the source`);
      continue;
    }

    const target = assignment.frameNo === null ? "(unassigned)" : `#${assignment.frameNo}`;
    let recordId: string | null = null;
    let timestamp = new Date().toISOString();
    try {
      const bytes = await readFile(file.path);
      timestamp = new Date().toISOString();
      const created = await pb.collection(SCANS).create({
        id: newId(),
        rollId,
        frameId: assignment.frameId,
        fileName: file.name,
        sortIndex: assignment.sortIndex,
        importedAt: timestamp,
        deleted: null,
        owner: ownerId,
        clientUpdated: timestamp,
      });
      recordId = created.id;

      const form = new FormData();
      form.append(FILE_FIELD, new Blob([bytes], { type: file.mimeType }), file.name);
      await pb.collection(SCANS).update(created.id, form);

      uploaded += 1;
      log(`${file.name} -> ${target} (scan ${created.id})`);
    } catch (error) {
      failed.push(assignment.fileName);
      const repaired = await softDelete(pb, recordId, timestamp);
      log(`${file.name}: ${messageOf(error)}${repaired}`);
    }
  }

  return { uploaded, failed };
}
