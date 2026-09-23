/**
 * The glue between an export screen and `runFrameExport`.
 *
 * It is the only place that reaches for the things a pure export run must not know about: the
 * live store, the secure store, the PocketBase client and the OS share sheet. Both export screens
 * use it, so they differ only in what they show, not in how they export.
 *
 * The state is read with `useStore.getState()` on every run instead of being captured in the
 * closure: the roll screen exports a dozen frames in a row and each run has to see the
 * `ExportLog` the previous one wrote.
 */
import type { Frame } from "@filmnotes/domain";
import { shareExporter, type ExportImage, type ExportResult } from "@filmnotes/exporters";
import { useCallback } from "react";

import { configForExporter } from "./exporterConfig";
import { loadScanImage } from "./loadScanImage";
import { runFrameExport } from "./runExport";
import { shareOut } from "./shareOut";
import * as clock from "../../lib/clock";
import { openServerSession } from "../../sync/session";
import { selectScanForFrame } from "../../store/selectors";
import type { AppState } from "../../store/store";
import { useStore } from "../../store/store";

export interface FrameExportRequest {
  frame: Frame;
  /** Id of a registered exporter, e.g. `wordPressExporter.id`. */
  exporterId: string;
  /** The caption as edited in the screen; omitted builds it from the settings. */
  caption?: string;
}

/**
 * The scan bytes for a frame, or null when it has no uploaded scan (or no server to load it
 * from – files live on the server only). The share package gets the 1600 px thumbnail, a blog
 * post the full scan.
 */
async function imageFor(
  exporterId: string,
  state: AppState,
  frame: Frame,
): Promise<ExportImage | null> {
  const scan = selectScanForFrame(state, frame.id);
  const serverUrl = state.settings.serverUrl;
  if (scan === null || scan.file === null || serverUrl === null) return null;

  // Scan files are protected, so loading one needs the logged-in session rather than a bare
  // URL builder; without credentials there is no image to attach.
  const session = await openServerSession();
  if (session === null) return null;

  const size = exporterId === shareExporter.id ? "1600" : "full";
  return loadScanImage(session.client, scan, size);
}

/**
 * Returns a function that exports one frame: resolve config and image, run the export (which
 * writes the `ExportLog`), and hand a share payload to the OS.
 */
export function useFrameExporter(): (request: FrameExportRequest) => Promise<ExportResult> {
  return useCallback(async ({ frame, exporterId, caption }: FrameExportRequest) => {
    const state = useStore.getState();

    return runFrameExport({
      exporterId,
      frame,
      state,
      config: await configForExporter(exporterId, state),
      image: await imageFor(exporterId, state, frame),
      // Read from the global scope at call time so a test can replace it.
      fetch: (input, init) => fetch(input, init),
      upsert: state.upsert,
      now: clock.now,
      caption,
      deliver: shareOut,
    });
  }, []);
}
