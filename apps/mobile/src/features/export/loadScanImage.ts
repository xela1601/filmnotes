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
import type { Scan } from '@filmnotes/domain';
import type { ExportImage } from '@filmnotes/exporters';

import type { SyncClient } from '../../sync/client';

/** Full file, or the 1600 px thumbnail PocketBase renders on demand. */
export type ScanImageSize = 'full' | '1600';

/** PocketBase thumb format: 1600 px wide, height scaled proportionally. */
const THUMB_1600 = '1600x0';

/** The part of the sync client an image load needs; a full `SyncClient` satisfies it. */
export type ScanFileUrls = Pick<SyncClient, 'fileUrl'>;

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  tif: 'image/tiff',
  tiff: 'image/tiff',
};

/** Lab scans are JPEG unless the name or the server says otherwise. */
const DEFAULT_MIME_TYPE = 'image/jpeg';

function mimeTypeFromName(fileName: string): string {
  const extension = /\.([a-z0-9]+)$/i.exec(fileName)?.[1]?.toLowerCase() ?? '';
  return MIME_BY_EXTENSION[extension] ?? DEFAULT_MIME_TYPE;
}

/**
 * The image mime type: the `Content-Type` of the response when it names an image (PocketBase
 * sends the type of the rendered thumbnail), otherwise a guess from the file name.
 */
function mimeTypeOf(header: string | null, fileName: string): string {
  const type = header?.split(';')[0]?.trim().toLowerCase() ?? '';
  return type.startsWith('image/') ? type : mimeTypeFromName(fileName);
}

/** The url of a scan file, or null while the scan has not been uploaded. */
export function scanImageUrl(
  client: ScanFileUrls,
  scan: Scan,
  size: ScanImageSize,
): string | null {
  if (scan.file === null) return null;
  return client.fileUrl('scans', scan.id, scan.file, size === '1600' ? THUMB_1600 : undefined);
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
  const url = scanImageUrl(client, scan, size);
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
    mimeType: mimeTypeOf(response.headers.get('content-type'), scan.fileName),
    fileName: scan.fileName,
  };
}
