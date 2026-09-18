/**
 * Versioned equipment and film stock presets plus the helpers that turn them
 * into store records.
 *
 * The JSON in `data/` is hand-written, so it is parsed through the zod schemas
 * once at load time: the loaders can only ever hand out data that matches the
 * domain types. The returned arrays are shared and must be treated as
 * read-only – `materialize` and `seedRecords` always build new objects.
 */
import type {
  Camera,
  FilmStock,
  Filter,
  Flash,
  Id,
  ISODateTime,
  Lens,
  SyncedRecord,
} from '@filmnotes/domain';
import minoltaKit from '../data/minolta-7000af-kit.json';
import filmStockCatalogue from '../data/film-stocks.json';
import {
  filmStockPresetsSchema,
  presetBundleSchema,
  type PresetBundle,
  type PresetRecord,
} from './schema';

export * from './schema';

/** Seed data for every collection that is shipped with the app. */
export interface SeedRecords {
  cameras: Camera[];
  lenses: Lens[];
  filters: Filter[];
  flashes: Flash[];
  filmStocks: FilmStock[];
}

let equipmentBundles: PresetBundle[] | null = null;
let filmStockPresets: PresetRecord<FilmStock>[] | null = null;

/** All equipment bundles shipped in `data/`. */
export function loadEquipmentPresets(): PresetBundle[] {
  equipmentBundles ??= [presetBundleSchema.parse(minoltaKit)];
  return equipmentBundles;
}

/** The catalogue of common 135 film stocks shipped in `data/`. */
export function loadFilmStockPresets(): PresetRecord<FilmStock>[] {
  filmStockPresets ??= filmStockPresetsSchema.parse(filmStockCatalogue);
  return filmStockPresets;
}

/**
 * Turns a preset record into a full store record by adding the sync fields.
 * `owner` stays null while the app runs without a server.
 */
export function materialize<T extends SyncedRecord>(
  record: PresetRecord<T>,
  now: ISODateTime,
  owner: Id | null = null,
): T {
  return { ...record, created: now, updated: now, deleted: null, owner } as T;
}

/** Materializes every shipped preset, e.g. to seed an empty store on first launch. */
export function seedRecords(now: ISODateTime, owner: Id | null = null): SeedRecords {
  const bundles = loadEquipmentPresets();
  return {
    cameras: bundles.flatMap((bundle) => bundle.cameras.map((record) => materialize<Camera>(record, now, owner))),
    lenses: bundles.flatMap((bundle) => bundle.lenses.map((record) => materialize<Lens>(record, now, owner))),
    filters: bundles.flatMap((bundle) => bundle.filters.map((record) => materialize<Filter>(record, now, owner))),
    flashes: bundles.flatMap((bundle) => bundle.flashes.map((record) => materialize<Flash>(record, now, owner))),
    filmStocks: loadFilmStockPresets().map((record) => materialize<FilmStock>(record, now, owner)),
  };
}
