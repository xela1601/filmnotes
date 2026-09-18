/**
 * Loads the bytes of a scan so an exporter can upload or share it.
 *
 * Scan files live on the server only (see the spec, §3.3): the app holds the record and asks
 * PocketBase for the file when it is needed. `'1600'` requests the server-side thumbnail, which
 * is what the share package wants – a full 60 MB lab scan is neither shareable nor needed.
 *
 * Only `fileUrl` of the `SyncClient` (T-008) is used, and the module imports its type alone, so
 * loading an image never pulls the ESM-only PocketBase SDK into a test.
 */
import { DEFAULT_SCAN_MIME_TYPE, scanMimeType } from "@filmnotes/domain";
import type { Scan } from "@filmnotes/domain";
import type { ExportImage } from "@filmnotes/exporters";

import type { SyncClient } from "../../sync/client";

/** Full file, or the 1600 px thumbnail PocketBase renders on demand. */
export type ScanImageSize = "full" | "1600";

/** PocketBase thumb format: 1600 px wide, height scaled proportionally. */
const THUMB_1600 = "1600x0";

/**
 * The part of the sync client an image load needs; a full `SyncClient` satisfies it.
 *
 * `fileToken` is in there because `scans.file` is a protected field: the bytes only come out
 * with a token, and a caller that is already logged in is the one that can get it.
 */
export type ScanFileUrls = Pick<SyncClient, "fileUrl" | "fileToken">;

/** Lab scans are JPEG unless the name or the server says otherwise. */
function mimeTypeFromName(fileName: string): string {
  return scanMimeType(fileName) ?? DEFAULT_SCAN_MIME_TYPE;
}

function mimeTypeOf(header: string | null, fileName: string): string {
  const type = header?.split(";")[0]?.trim().toLowerCase() ?? "";
  return type.startsWith("image/") ? type : mimeTypeFromName(fileName);
}

/** The url of a scan file, or null while the scan has not been uploaded. */
export function scanImageUrl(
  client: ScanFileUrls,
  scan: Scan,
  size: ScanImageSize,
  token?: string,
): string | null {
  if (scan.file === null) return null;
  return client.fileUrl(
    "scans",
    scan.id,
    scan.file,
    size === "1600" ? THUMB_1600 : undefined,
    token,
  );
}

/**
 * Downloads a scan as an `ExportImage`. The image keeps the name the scan was imported under, so
 * a WordPress media library entry is called `img001.jpg` and not `img001_a1b2c3.jpg`.
 */
export async function loadScanImage(
  client: ScanFileUrls,
  scan: Scan,
  size: ScanImageSize,
): Promise<ExportImage> {
  if (scan.file === null) {
    throw new Error(`scan ${scan.id} has not been uploaded yet, there is nothing to export`);
  }
  const url = scanImageUrl(client, scan, size, await client.fileToken());
  if (url === null) {
    throw new Error(`scan ${scan.id} has not been uploaded yet, there is nothing to export`);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`could not load the scan of ${scan.fileName} (HTTP ${response.status})`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  return {
    bytes,
    mimeType: mimeTypeOf(response.headers.get("content-type"), scan.fileName),
    fileName: scan.fileName,
  };
}
