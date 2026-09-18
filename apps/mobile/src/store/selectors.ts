import type {
  Camera,
  CollectionName,
  EntityOf,
  FilmStock,
  Filter,
  Frame,
  FrameContext,
  Id,
  Lens,
  Roll,
  Scan,
} from "@filmnotes/domain";

import type { AppState } from "./store";

/** All records of a collection that are not soft-deleted. */
export function selectActive<K extends CollectionName>(
  state: AppState,
  collection: K,
): EntityOf<K>[] {
  return Object.values(state.entities[collection]).filter((record) => record.deleted === null);
}

function byId<K extends CollectionName>(
  state: AppState,
  collection: K,
  id: Id | null,
): EntityOf<K> | null {
  if (id === null) return null;
  const record = state.entities[collection][id];
  return record !== undefined && record.deleted === null ? record : null;
}

/** Rolls, newest first (by `loadedAt`). */
export function selectRollsSorted(state: AppState): Roll[] {
  return selectActive(state, "rolls").sort((a, b) => b.loadedAt.localeCompare(a.loadedAt));
}

/** Active frames of a roll, ordered by frame number. */
export function selectFramesForRoll(state: AppState, rollId: Id): Frame[] {
  return selectActive(state, "frames")
    .filter((frame) => frame.rollId === rollId)
    .sort((a, b) => a.frameNo - b.frameNo);
}

/** Active scans of a roll, ordered by their import sort index. */
export function selectScansForRoll(state: AppState, rollId: Id): Scan[] {
  return selectActive(state, "scans")
    .filter((scan) => scan.rollId === rollId)
    .sort((a, b) => a.sortIndex - b.sortIndex);
}

/**
 * The scan a frame's image comes from: the newest *uploaded* one.
 *
 * There used to be two answers to this question - the export screen took the first by sort index
 * and did not care whether the file had been uploaded, the thumbnail took the newest import and
 * did. A frame scanned twice therefore showed one image and exported another, and when the
 * export's pick had no file the WordPress draft was created without any image at all and logged
 * as a success. One selector, used by the thumbnail, the export screen and the exporter.
 *
 * Returns the record itself (not a derived array), so the store's identity check keeps a hook
 * using it from re-rendering on every unrelated change.
 */
export function selectScanForFrame(state: AppState, frameId: Id): Scan | null {
  let newest: Scan | null = null;
  for (const scan of Object.values(state.entities.scans)) {
    if (scan.deleted !== null || scan.frameId !== frameId || scan.file === null) continue;
    if (newest === null || scan.importedAt > newest.importedAt) newest = scan;
  }
  return newest;
}

/**
 * Everything a deleted roll takes with it, in the order it should be written.
 *
 * Deleting a roll used to soft-delete the roll and its frames only, leaving the roll's scans and
 * the frames' export logs alive: they kept syncing, kept their (up to 50 MB) files on the server
 * and pointed at a `rollId` that no longer resolves.
 */
export function selectRollCascade(
  state: AppState,
  rollId: Id,
): { collection: "frames" | "scans" | "exportLogs" | "rolls"; id: Id }[] {
  const frames = selectFramesForRoll(state, rollId);
  const frameIds = new Set(frames.map((frame) => frame.id));

  return [
    ...selectActive(state, "exportLogs")
      .filter((log) => frameIds.has(log.frameId))
      .map((log) => ({ collection: "exportLogs" as const, id: log.id })),
    ...selectScansForRoll(state, rollId).map((scan) => ({
      collection: "scans" as const,
      id: scan.id,
    })),
    ...frames.map((frame) => ({ collection: "frames" as const, id: frame.id })),
    { collection: "rolls" as const, id: rollId },
  ];
}

/** Everything `validateFrame` (T-002) needs; null when roll or camera are unknown. */
export function selectFrameContext(state: AppState, frame: Frame): FrameContext | null {
  const roll = byId(state, "rolls", frame.rollId);
  if (roll === null) return null;
  const camera = byId(state, "cameras", roll.cameraId);
  if (camera === null) return null;

  return {
    camera,
    roll,
    lens: byId(state, "lenses", frame.lensId),
    filters: selectFiltersOf(state, frame),
    flash: byId(state, "flashes", frame.flashId),
    siblingFrames: selectFramesForRoll(state, frame.rollId).filter((f) => f.id !== frame.id),
  };
}

function selectFiltersOf(state: AppState, frame: Frame): Filter[] {
  const filters: Filter[] = [];
  for (const id of frame.filterIds) {
    const filter = byId(state, "filters", id);
    if (filter !== null) filters.push(filter);
  }
  return filters;
}

export interface CaptionEquipment {
  camera: Camera;
  lens: Lens | null;
  filters: Filter[];
  filmStock: FilmStock;
  roll: Roll;
}

/** Records `buildCaption` (T-002) needs; null when roll, camera or film stock are unknown. */
export function selectEquipmentForCaption(state: AppState, frame: Frame): CaptionEquipment | null {
  const roll = byId(state, "rolls", frame.rollId);
  if (roll === null) return null;
  const camera = byId(state, "cameras", roll.cameraId);
  if (camera === null) return null;
  const filmStock = byId(state, "filmStocks", roll.filmStockId);
  if (filmStock === null) return null;

  return {
    camera,
    lens: byId(state, "lenses", frame.lensId),
    filters: selectFiltersOf(state, frame),
    filmStock,
    roll,
  };
}
