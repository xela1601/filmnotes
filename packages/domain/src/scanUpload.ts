/**
 * The three-step dance every scan upload goes through, in one place.
 *
 * A scan needs two requests - the record first, so the file field has a record to go into, then
 * the bytes - and a failure between them leaves a record without an image, which the next sync
 * would hand to the app as a scan that shows nothing. So the half-written record is marked
 * deleted again, best effort, on the same connection that just failed.
 *
 * The app (`apps/mobile/src/features/scans/uploadScans.ts`) and the desktop CLI
 * (`tools/scan-import/src/upload.ts`) both did this, separately and identically, down to the
 * comment. They keep their own record building and their own reporting; the sequence lives here.
 *
 * No IO of its own: the caller passes the three operations, which is what makes this testable
 * without a server and lets it sit in the framework-free domain package.
 */
import type { ISODateTime, Scan } from "./types";

/** The three server operations an upload needs, in whatever form the caller has them. */
export interface ScanUploadPort<File> {
  /** Creates the scan record. */
  createRecord(scan: Scan): Promise<void>;
  /** Posts the bytes into the file field; answers with the name the server stored them under. */
  uploadFile(scan: Scan, file: File): Promise<string | null>;
  /** Marks a record whose file never arrived as deleted. May fail; that is not an error. */
  markDeleted(scan: Scan, at: ISODateTime): Promise<void>;
}

export type ScanUploadOutcome =
  /** `scan.file` carries the name the server stored the bytes under. */
  { status: "uploaded"; scan: Scan } | { status: "failed"; reason: string; repaired: boolean };

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message !== "") return error.message;
  return String(error);
}

/**
 * Creates the record, uploads the bytes, and repairs the orphan if the bytes do not arrive.
 *
 * `fallbackFileName` is used when the server does not answer with a name of its own (the app
 * sends the imported name, PocketBase usually appends a random suffix to it).
 */
export async function uploadOneScan<File>(
  port: ScanUploadPort<File>,
  scan: Scan,
  file: File,
  at: ISODateTime,
): Promise<ScanUploadOutcome> {
  let recordExists = false;
  try {
    await port.createRecord(scan);
    recordExists = true;
    const storedName = await port.uploadFile(scan, file);
    return {
      status: "uploaded",
      scan: {
        ...scan,
        file: storedName === null || storedName === "" ? scan.fileName : storedName,
      },
    };
  } catch (error) {
    const reason = messageOf(error);
    // Nothing to repair when the record was never created - and no point in spending another
    // request on the connection that just refused this one.
    if (!recordExists) return { status: "failed", reason, repaired: false };
    try {
      await port.markDeleted(scan, at);
      return { status: "failed", reason, repaired: true };
    } catch {
      // Either the record was never created, or the server is gone. Nothing left to do.
      return { status: "failed", reason, repaired: false };
    }
  }
}

/** The id a newly created scan record carries, for callers that log it. */
export function scanUploadLabel(scan: Scan, frameNo: number | null): string {
  const target = frameNo === null ? "(unassigned)" : `#${frameNo}`;
  return `${scan.fileName} -> ${target} (scan ${scan.id})`;
}
