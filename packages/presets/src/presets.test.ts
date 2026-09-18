import { ID_PATTERN, type Camera, type SyncedRecord } from '@filmnotes/domain';
import {
  loadEquipmentPresets,
  loadFilmStockPresets,
  materialize,
  seedRecords,
} from './index';

const NOW = '2026-09-18T10:00:00.000Z';

function first<T>(values: T[], label: string): T {
  const value = values[0];
  if (value === undefined) throw new Error(`expected at least one ${label}`);
  return value;
}

describe('loadEquipmentPresets', () => {
  it('ships the Minolta 7000 AF kit', () => {
    const bundles = loadEquipmentPresets();
    expect(bundles).toHaveLength(1);

    const kit = first(bundles, 'bundle');
    expect(kit.id).toBe('minolta-7000af-kit');
    expect(kit.version).toBeGreaterThanOrEqual(1);
    expect(kit.cameras).toHaveLength(1);
    expect(kit.lenses).toHaveLength(3);
    expect(kit.filters).toHaveLength(7);
    expect(kit.flashes).toHaveLength(1);
  });
});

describe('loadFilmStockPresets', () => {
  it('returns the film stock catalogue', () => {
    expect(loadFilmStockPresets().length).toBeGreaterThanOrEqual(20);
  });
});

describe('materialize', () => {
  it('adds the sync fields without touching the preset payload', () => {
    const preset = first(first(loadEquipmentPresets(), 'bundle').cameras, 'camera');
    const camera = materialize<Camera>(preset, NOW);

    expect(camera).toMatchObject({
      id: preset.id,
      model: preset.model,
      created: NOW,
      updated: NOW,
      deleted: null,
      owner: null,
    });
  });

  it('accepts an owner id', () => {
    const preset = first(first(loadEquipmentPresets(), 'bundle').cameras, 'camera');
    const ownerId = 'ownr00000000000';
    expect(materialize<Camera>(preset, NOW, ownerId).owner).toBe(ownerId);
  });

  it('does not mutate the preset record', () => {
    const preset = first(first(loadEquipmentPresets(), 'bundle').cameras, 'camera');
    materialize<Camera>(preset, NOW);
    expect(Object.keys(preset)).not.toContain('created');
  });
});

describe('seedRecords', () => {
  it('materializes every collection', () => {
    const seed = seedRecords(NOW);

    expect(seed.cameras).toHaveLength(1);
    expect(seed.lenses).toHaveLength(3);
    expect(seed.filters).toHaveLength(7);
    expect(seed.flashes).toHaveLength(1);
    expect(seed.filmStocks.length).toBeGreaterThanOrEqual(20);

    const all: SyncedRecord[] = [
      ...seed.cameras,
      ...seed.lenses,
      ...seed.filters,
      ...seed.flashes,
      ...seed.filmStocks,
    ];
    for (const record of all) {
      expect({ id: record.id, valid: ID_PATTERN.test(record.id) }).toMatchObject({ valid: true });
      expect(record).toMatchObject({ created: NOW, updated: NOW, deleted: null, owner: null });
    }
  });

  it('keeps ids unique across all seeded collections', () => {
    const seed = seedRecords(NOW);
    const ids = [
      ...seed.cameras,
      ...seed.lenses,
      ...seed.filters,
      ...seed.flashes,
      ...seed.filmStocks,
    ].map((record) => record.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
