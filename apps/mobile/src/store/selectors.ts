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
} from '@filmnotes/domain';

import type { AppState } from './store';

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
  return selectActive(state, 'rolls').sort((a, b) => b.loadedAt.localeCompare(a.loadedAt));
}

/** Active frames of a roll, ordered by frame number. */
export function selectFramesForRoll(state: AppState, rollId: Id): Frame[] {
  return selectActive(state, 'frames')
    .filter((frame) => frame.rollId === rollId)
    .sort((a, b) => a.frameNo - b.frameNo);
}

/** Active scans of a roll, ordered by their import sort index. */
export function selectScansForRoll(state: AppState, rollId: Id): Scan[] {
  return selectActive(state, 'scans')
    .filter((scan) => scan.rollId === rollId)
    .sort((a, b) => a.sortIndex - b.sortIndex);
}

/** Everything `validateFrame` (T-002) needs; null when roll or camera are unknown. */
export function selectFrameContext(state: AppState, frame: Frame): FrameContext | null {
  const roll = byId(state, 'rolls', frame.rollId);
  if (roll === null) return null;
  const camera = byId(state, 'cameras', roll.cameraId);
  if (camera === null) return null;

  return {
    camera,
    roll,
    lens: byId(state, 'lenses', frame.lensId),
    filters: selectFiltersOf(state, frame),
    flash: byId(state, 'flashes', frame.flashId),
    siblingFrames: selectFramesForRoll(state, frame.rollId).filter((f) => f.id !== frame.id),
  };
}

function selectFiltersOf(state: AppState, frame: Frame): Filter[] {
  const filters: Filter[] = [];
  for (const id of frame.filterIds) {
    const filter = byId(state, 'filters', id);
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
  const roll = byId(state, 'rolls', frame.rollId);
  if (roll === null) return null;
  const camera = byId(state, 'cameras', roll.cameraId);
  if (camera === null) return null;
  const filmStock = byId(state, 'filmStocks', roll.filmStockId);
  if (filmStock === null) return null;

  return {
    camera,
    lens: byId(state, 'lenses', frame.lensId),
    filters: selectFiltersOf(state, frame),
    filmStock,
    roll,
  };
}
