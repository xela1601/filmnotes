import type { AppState } from './store';
import {
  selectActive,
  selectEquipmentForCaption,
  selectFrameContext,
  selectFramesForRoll,
  selectRollsSorted,
  selectScansForRoll,
} from './selectors';
import { createAppStore } from './store';
import {
  makeCamera,
  makeFilmStock,
  makeFilter,
  makeFlash,
  makeFrame,
  makeLens,
  makeRoll,
  makeScan,
} from '../testing/fixtures';

function stateWith(seed: (store: ReturnType<typeof createAppStore>) => void): AppState {
  const store = createAppStore({
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  });
  seed(store);
  return store.getState();
}

describe('selectors', () => {
  describe('selectActive', () => {
    it('drops soft-deleted records', () => {
      const state = stateWith((store) => {
        store.getState().applyRemote('lenses', [
          makeLens({ id: 'lens00000000001' }),
          makeLens({ id: 'lens00000000002', deleted: '2026-09-18T12:00:00.000Z' }),
        ]);
      });

      expect(selectActive(state, 'lenses').map((l) => l.id)).toEqual(['lens00000000001']);
    });
  });

  describe('selectRollsSorted', () => {
    it('sorts by loadedAt, newest first', () => {
      const state = stateWith((store) => {
        store.getState().applyRemote('rolls', [
          makeRoll({ id: 'roll00000000001', loadedAt: '2026-01-01T00:00:00.000Z' }),
          makeRoll({ id: 'roll00000000003', loadedAt: '2026-03-01T00:00:00.000Z' }),
          makeRoll({ id: 'roll00000000002', loadedAt: '2026-02-01T00:00:00.000Z' }),
          makeRoll({
            id: 'roll00000000004',
            loadedAt: '2026-04-01T00:00:00.000Z',
            deleted: '2026-05-01T00:00:00.000Z',
          }),
        ]);
      });

      expect(selectRollsSorted(state).map((r) => r.id)).toEqual([
        'roll00000000003',
        'roll00000000002',
        'roll00000000001',
      ]);
    });
  });

  describe('selectFramesForRoll', () => {
    it('returns the roll\'s active frames ordered by frame number', () => {
      const state = stateWith((store) => {
        store.getState().applyRemote('frames', [
          makeFrame({ id: 'frame0000000003', frameNo: 3 }),
          makeFrame({ id: 'frame0000000001', frameNo: 1 }),
          makeFrame({ id: 'frame0000000002', frameNo: 2, deleted: '2026-09-18T12:00:00.000Z' }),
          makeFrame({ id: 'frame0000000009', frameNo: 1, rollId: 'roll00000000002' }),
        ]);
      });

      expect(selectFramesForRoll(state, 'roll00000000001').map((f) => f.frameNo)).toEqual([1, 3]);
    });
  });

  describe('selectScansForRoll', () => {
    it('returns the roll\'s active scans ordered by sortIndex', () => {
      const state = stateWith((store) => {
        store.getState().applyRemote('scans', [
          makeScan({ id: 'scan00000000002', sortIndex: 2 }),
          makeScan({ id: 'scan00000000001', sortIndex: 1 }),
          makeScan({ id: 'scan00000000003', sortIndex: 3, deleted: '2026-09-18T12:00:00.000Z' }),
          makeScan({ id: 'scan00000000009', sortIndex: 0, rollId: 'roll00000000002' }),
        ]);
      });

      expect(selectScansForRoll(state, 'roll00000000001').map((s) => s.id)).toEqual([
        'scan00000000001',
        'scan00000000002',
      ]);
    });
  });

  describe('selectFrameContext', () => {
    const frame = makeFrame({
      id: 'frame0000000001',
      frameNo: 1,
      lensId: 'lens0min3570f40',
      filterIds: ['filt0hamauv49a0', 'filt0kenkopl490'],
      flashId: 'flash0min2800af',
    });

    function seededState(): AppState {
      return stateWith((store) => {
        store.getState().applyRemote('cameras', [makeCamera()]);
        store.getState().applyRemote('rolls', [makeRoll()]);
        store.getState().applyRemote('lenses', [makeLens()]);
        store.getState().applyRemote('filters', [
          makeFilter({ id: 'filt0hamauv49a0' }),
          makeFilter({ id: 'filt0kenkopl490', afCompatible: 'no' }),
        ]);
        store.getState().applyRemote('flashes', [makeFlash()]);
        store.getState().applyRemote('frames', [
          frame,
          makeFrame({ id: 'frame0000000002', frameNo: 2 }),
          makeFrame({ id: 'frame0000000003', frameNo: 3, deleted: '2026-09-18T12:00:00.000Z' }),
          makeFrame({ id: 'frame0000000009', frameNo: 1, rollId: 'roll00000000002' }),
        ]);
      });
    }

    it('assembles camera, roll, lens, filters, flash and siblings', () => {
      const context = selectFrameContext(seededState(), frame);

      expect(context).not.toBeNull();
      expect(context?.camera.id).toBe('cam0minolta7000');
      expect(context?.roll.id).toBe('roll00000000001');
      expect(context?.lens?.id).toBe('lens0min3570f40');
      expect(context?.filters.map((f) => f.id)).toEqual(['filt0hamauv49a0', 'filt0kenkopl490']);
      expect(context?.flash?.id).toBe('flash0min2800af');
      expect(context?.siblingFrames.map((f) => f.id)).toEqual(['frame0000000002']);
    });

    it('returns null when the roll is missing', () => {
      const state = stateWith((store) => {
        store.getState().applyRemote('cameras', [makeCamera()]);
      });
      expect(selectFrameContext(state, frame)).toBeNull();
    });

    it('returns null when the camera is missing', () => {
      const state = stateWith((store) => {
        store.getState().applyRemote('rolls', [makeRoll()]);
      });
      expect(selectFrameContext(state, frame)).toBeNull();
    });
  });

  describe('selectEquipmentForCaption', () => {
    it('returns the records the caption builder needs', () => {
      const frame = makeFrame({ lensId: 'lens0min3570f40', filterIds: ['filt0hamauv49a0'] });
      const state = stateWith((store) => {
        store.getState().applyRemote('cameras', [makeCamera()]);
        store.getState().applyRemote('rolls', [makeRoll()]);
        store.getState().applyRemote('lenses', [makeLens()]);
        store.getState().applyRemote('filters', [makeFilter({ id: 'filt0hamauv49a0' })]);
        store.getState().applyRemote('filmStocks', [makeFilmStock()]);
      });

      const equipment = selectEquipmentForCaption(state, frame);

      expect(equipment?.camera.id).toBe('cam0minolta7000');
      expect(equipment?.filmStock.id).toBe('film0kodakgold2');
      expect(equipment?.lens?.id).toBe('lens0min3570f40');
      expect(equipment?.filters).toHaveLength(1);
      expect(equipment?.roll.id).toBe('roll00000000001');
    });

    it('returns null when the film stock is missing', () => {
      const state = stateWith((store) => {
        store.getState().applyRemote('cameras', [makeCamera()]);
        store.getState().applyRemote('rolls', [makeRoll()]);
      });

      expect(selectEquipmentForCaption(state, makeFrame())).toBeNull();
    });
  });
});
