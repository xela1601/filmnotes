/**
 * The thumbnail URL of the scan that belongs to a frame.
 *
 * Scan files live on the server (spec §3.3), so a thumbnail only exists once a server is
 * configured *and* the scan has been uploaded. Everything else – no server, no scan, an
 * import that failed halfway – is `null`, which the frame and roll screens show as "no
 * image yet" rather than a broken picture.
 *
 * PocketBase renders the thumbnail itself from the `thumb` query parameter, so nothing is
 * resized or cached on the device; `expo-image` caches the URL.
 */
import { PB_COLLECTION } from '@filmnotes/domain';
import type { Id, Scan } from '@filmnotes/domain';
import { useMemo } from 'react';

import { createPocketBaseClient } from '../../sync/client';
import { useStore, type AppState } from '../../store/store';

/** The size PocketBase renders the preview at; wide enough for a list row on a tablet. */
export const SCAN_THUMB_SIZE = '200x200';

/**
 * The uploaded scan of a frame, or `null`.
 *
 * Returns the record itself (not a derived array), so the store's default identity check
 * keeps the hook from re-rendering on every unrelated change. A frame that was scanned
 * twice – a re-scan after a bad first attempt – shows the newest import.
 */
function selectScanForFrame(state: AppState, frameId: Id): Scan | null {
  let newest: Scan | null = null;
  for (const scan of Object.values(state.entities.scans)) {
    if (scan.deleted !== null || scan.frameId !== frameId || scan.file === null) continue;
    if (newest === null || scan.importedAt > newest.importedAt) newest = scan;
  }
  return newest;
}

export function useScanThumb(frameId: Id): string | null {
  const serverUrl = useStore((state) => state.settings.serverUrl);
  const scan = useStore((state) => selectScanForFrame(state, frameId));

  return useMemo(() => {
    if (serverUrl === null || scan === null || scan.file === null) return null;
    return createPocketBaseClient(serverUrl).fileUrl(
      PB_COLLECTION.scans,
      scan.id,
      scan.file,
      SCAN_THUMB_SIZE,
    );
  }, [serverUrl, scan]);
}
