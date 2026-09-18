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
 *
 * The file field is `protected`, so the URL also needs a short-lived token (`useFileToken`);
 * until it arrives - and without a server or credentials - there is no URL to show.
 */
import { PB_COLLECTION } from "@filmnotes/domain";
import type { Id } from "@filmnotes/domain";
import { useMemo } from "react";

import { createPocketBaseClient } from "../../sync/client";
import { useFileToken } from "../../sync/useFileToken";
import { selectScanForFrame } from "../../store/selectors";
import { useStore } from "../../store/store";

/** The size PocketBase renders the preview at; wide enough for a list row on a tablet. */
export const SCAN_THUMB_SIZE = "200x200";

export function useScanThumb(frameId: Id): string | null {
  const serverUrl = useStore((state) => state.settings.serverUrl);
  const scan = useStore((state) => selectScanForFrame(state, frameId));
  const token = useFileToken();

  return useMemo(() => {
    if (serverUrl === null || scan === null || scan.file === null || token === null) return null;
    return createPocketBaseClient(serverUrl).fileUrl(
      PB_COLLECTION.scans,
      scan.id,
      scan.file,
      SCAN_THUMB_SIZE,
      token,
    );
  }, [serverUrl, scan, token]);
}
