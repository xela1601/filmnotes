/**
 * Which image formats count as lab scans, and which of them the server actually stores.
 *
 * One table, because there used to be four and they disagreed: the in-app picker accepted
 * `.heic`, the desktop CLI did not, the export loader knew a fifth default, and the server's
 * `scans.file` field allows something else again. The visible symptom was an import that ran
 * for minutes and then reported a file name without a reason.
 *
 * `SERVER_SCAN_MIME_TYPES` mirrors the `mimeTypes` of the `scans.file` field in
 * `backend/pb_migrations/1758150000_init_collections.js`. Change one, change the other.
 */

/** Extension (without the dot) → MIME type, for everything a lab might hand out. */
export const SCAN_MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  tif: "image/tiff",
  tiff: "image/tiff",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

/** What PocketBase's `scans.file` field accepts. HEIC is deliberately not among them. */
export const SERVER_SCAN_MIME_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/tiff",
  "image/webp",
];

/** What a lab delivers unless the file name says otherwise. */
export const DEFAULT_SCAN_MIME_TYPE = "image/jpeg";

/** The MIME type of a file name, or `null` when the extension is not an image format at all. */
export function scanMimeType(fileName: string): string | null {
  const extension = /\.([a-z0-9]+)$/i.exec(fileName)?.[1]?.toLowerCase() ?? "";
  return SCAN_MIME_BY_EXTENSION[extension] ?? null;
}

/** True for a file the `scans.file` field will accept; HEIC is rejected by the server. */
export function isServerScanMimeType(mimeType: string): boolean {
  return SERVER_SCAN_MIME_TYPES.includes(mimeType);
}

/** True for a file name the import should pick up at all (including the ones the server rejects). */
export function isScanFileName(fileName: string): boolean {
  return scanMimeType(fileName) !== null;
}
