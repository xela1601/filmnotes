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

import type { Id, ISODateTime, Scan, ScanAssignment, ScanUploadPort } from "@filmnotes/domain";
import { newId, scanMimeType, uploadOneScan } from "@filmnotes/domain";

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
 * The three server operations of `uploadOneScan`, on the PocketBase SDK.
 *
 * The sequence itself - record, bytes, and the repair of the half-written record when the bytes
 * do not arrive - lives in `@filmnotes/domain`, so the CLI and the app cannot drift apart.
 */
function portFor(pb: PocketBaseLike, ownerId: Id): ScanUploadPort<ArrayBuffer> {
  return {
    createRecord: async (scan) => {
      await pb.collection(SCANS).create(toRemotePayload(scan, ownerId));
    },
    uploadFile: async (scan, bytes) => {
      const form = new FormData();
      const mimeType = scanMimeType(scan.fileName) ?? "image/jpeg";
      form.append(FILE_FIELD, new Blob([bytes], { type: mimeType }), scan.fileName);
      const updated = await pb.collection(SCANS).update(scan.id, form);
      const stored: unknown = (updated as Record<string, unknown>)[FILE_FIELD];
      return typeof stored === "string" ? stored : null;
    },
    markDeleted: async (scan, at) => {
      await pb.collection(SCANS).update(scan.id, {
        id: scan.id,
        deleted: at,
        updated: at,
        clientUpdated: at,
      });
    },
  };
}

/** The record a scan is created from; `created`/`updated` stay with PocketBase (autodate). */
function toRemotePayload(scan: Scan, ownerId: Id): Record<string, unknown> {
  return {
    id: scan.id,
    rollId: scan.rollId,
    frameId: scan.frameId,
    fileName: scan.fileName,
    sortIndex: scan.sortIndex,
    importedAt: scan.importedAt,
    deleted: null,
    owner: ownerId,
    clientUpdated: scan.updated,
  };
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
    let bytes: ArrayBuffer;
    try {
      // The bytes as a plain ArrayBuffer: a Node `Buffer` may sit on a SharedArrayBuffer, which
      // `Blob` does not accept.
      const read = await readFile(file.path);
      bytes = read.buffer.slice(read.byteOffset, read.byteOffset + read.byteLength);
    } catch (error) {
      failed.push(assignment.fileName);
      log(`${file.name}: ${messageOf(error)}`);
      continue;
    }

    const at: ISODateTime = new Date().toISOString();
    const scan: Scan = {
      id: newId(),
      created: at,
      updated: at,
      deleted: null,
      owner: ownerId,
      rollId,
      frameId: assignment.frameId,
      fileName: file.name,
      sortIndex: assignment.sortIndex,
      file: null,
      width: null,
      height: null,
      importedAt: at,
    };

    const outcome = await uploadOneScan(portFor(pb, ownerId), scan, bytes, at);
    if (outcome.status === "uploaded") {
      uploaded += 1;
      log(`${file.name} -> ${target} (scan ${scan.id})`);
    } else {
      failed.push(assignment.fileName);
      const repaired = outcome.repaired
        ? ` (scan ${scan.id} was marked deleted again)`
        : ` (scan ${scan.id} has no file and could not be cleaned up)`;
      log(`${file.name}: ${outcome.reason}${repaired}`);
    }
  }

  return { uploaded, failed };
}
