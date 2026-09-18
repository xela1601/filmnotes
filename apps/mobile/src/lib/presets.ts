/**
 * TODO(T-003): replace this whole module with a re-export of `@filmnotes/presets`:
 *
 *   export type { PresetBundle, PresetRecord } from '@filmnotes/presets';
 *   export { loadEquipmentPresets, loadFilmStockPresets, materialize, seedRecords } from '@filmnotes/presets';
 *
 * `@filmnotes/presets` (T-003) is not merged into this worktree yet, so the public
 * shape of that package is stubbed here with the record ids documented in the T-003
 * ticket. Only this file has to change once the package exists.
 */
import type {
  Camera,
  Filter,
  FilmStock,
  Flash,
  Id,
  ISODateTime,
  Lens,
  SyncedRecord,
} from '@filmnotes/domain';

/** A preset record carries a stable id but none of the sync bookkeeping fields. */
export type PresetRecord<T extends SyncedRecord> = Omit<T, 'created' | 'updated' | 'deleted' | 'owner'>;

export interface PresetBundle {
  id: string;
  name: string;
  version: number;
  cameras: PresetRecord<Camera>[];
  lenses: PresetRecord<Lens>[];
  filters: PresetRecord<Filter>[];
  flashes: PresetRecord<Flash>[];
}

/** Film stocks are not part of an equipment bundle; they seed under this bundle id. */
export const FILM_STOCK_BUNDLE_ID = 'film-stocks';

const MINOLTA_KIT: PresetBundle = {
  id: 'minolta-7000af-kit',
  name: 'Minolta 7000 AF – Familienausrüstung',
  version: 1,
  cameras: [
    {
      id: 'cam0minolta7000',
      make: 'Minolta',
      model: '7000 AF',
      aliases: ['Maxxum 7000', 'Alpha 7000'],
      year: 1985,
      format: '135',
      mount: 'Minolta A',
      exposureModes: ['P', 'A', 'S', 'M'],
      shutterSpeedsManual: [
        '30"', '15"', '8"', '4"', '2"', '1"', '1/2', '1/4', '1/8', '1/15', '1/30',
        '1/60', '1/125', '1/250', '1/500', '1/1000', '1/2000', 'bulb',
      ],
      shutterSpeedsAutoExtra: [
        '20"', '12"', '6"', '3"', '1"5', '0"7', '1/3', '1/6', '1/10', '1/20',
        '1/45', '1/90', '1/180', '1/350', '1/750', '1/1500',
      ],
      bulbOnlyInModes: ['M'],
      exposureCompensation: { min: -4, max: 4, step: 0.5, notInModes: ['M'] },
      iso: { min: 25, max: 6400, stepEv: 0.333, dxAuto: true },
      focusModes: ['AF', 'M'],
      driveModes: ['S', 'C', 'ST'],
      flashSync: '1/100',
      metering: 'TTL center-weighted',
      notes: '',
      conditionNotes: [],
      defaultsForNewFrame: {
        exposureMode: 'P',
        driveMode: 'S',
        focusMode: 'AF',
        exposureCompensationEv: 0,
        programShift: false,
        aeLock: false,
        lensId: 'lens0min3570f40',
        filterIds: ['filt0hamauv49a0'],
        flashId: null,
        support: 'handheld',
      },
    },
  ],
  lenses: [
    {
      id: 'lens0min3570f40',
      make: 'Minolta',
      model: 'AF Zoom 35-70mm f/4',
      focalMinMm: 35,
      focalMaxMm: 70,
      maxAperture: 4,
      minAperture: 22,
      apertureValues: [4, 4.8, 5.6, 6.7, 8, 9.5, 11, 13, 16, 19, 22],
      filterThreadMm: 49,
      minFocusM: 0.8,
      macroNote: null,
      weightG: 255,
      defaultFilterIds: ['filt0hamauv49a0'],
      handheldMinShutter: '1/60',
      hasHood: false,
    },
    {
      id: 'lens0min50f1700',
      make: 'Minolta',
      model: 'AF 50mm f/1.7',
      focalMinMm: 50,
      focalMaxMm: 50,
      maxAperture: 1.7,
      minAperture: 22,
      apertureValues: [1.7, 2, 2.4, 2.8, 3.4, 4, 4.8, 5.6, 6.7, 8, 9.5, 11, 13, 16, 19, 22],
      filterThreadMm: 49,
      minFocusM: 0.45,
      macroNote: null,
      weightG: 235,
      defaultFilterIds: ['filt0hamauv49b0'],
      handheldMinShutter: '1/60',
      hasHood: false,
    },
    {
      id: 'lens0min70210f4',
      make: 'Minolta',
      model: 'AF Zoom 70-210mm f/4',
      focalMinMm: 70,
      focalMaxMm: 210,
      maxAperture: 4,
      minAperture: 32,
      apertureValues: [4, 4.8, 5.6, 6.7, 8, 9.5, 11, 13, 16, 19, 22, 27, 32],
      filterThreadMm: 55,
      minFocusM: 1.1,
      macroNote: null,
      weightG: 685,
      defaultFilterIds: ['filt0hamauv5500'],
      handheldMinShutter: '1/250',
      hasHood: true,
    },
  ],
  filters: [
    {
      id: 'filt0hamauv49a0',
      make: 'Hama',
      model: 'UV 390 (O-Haze) 49',
      threadMm: 49,
      type: 'UV',
      exposureFactorEv: 0,
      afCompatible: 'yes',
      warning: null,
      mountedOnLensId: 'lens0min3570f40',
    },
    {
      id: 'filt0hamauv49b0',
      make: 'Hama',
      model: 'UV 390 (O-Haze) 49',
      threadMm: 49,
      type: 'UV',
      exposureFactorEv: 0,
      afCompatible: 'yes',
      warning: null,
      mountedOnLensId: 'lens0min50f1700',
    },
    {
      id: 'filt0hamauv5500',
      make: 'Hama',
      model: 'UV 390 (O-Haze) 55',
      threadMm: 55,
      type: 'UV',
      exposureFactorEv: 0,
      afCompatible: 'yes',
      warning: null,
      mountedOnLensId: 'lens0min70210f4',
    },
    {
      id: 'filt0kenkosky49',
      make: 'Kenko',
      model: 'Skylight 1B 49',
      threadMm: 49,
      type: 'skylight',
      exposureFactorEv: 0,
      afCompatible: 'yes',
      warning: null,
      mountedOnLensId: null,
    },
    {
      id: 'filt0kenkopl490',
      make: 'Kenko',
      model: 'PL (linear) 49',
      threadMm: 49,
      type: 'polarizer_linear',
      exposureFactorEv: 1.5,
      afCompatible: 'no',
      warning: 'Autofocus of the 7000 AF does not work with a linear polarizer',
      mountedOnLensId: null,
    },
    {
      id: 'filt0kenkocf490',
      make: 'Kenko',
      model: 'Center Focus 49S',
      threadMm: 49,
      type: 'effect_center_soft',
      exposureFactorEv: 0,
      afCompatible: 'limited',
      warning: null,
      mountedOnLensId: null,
    },
    {
      id: 'filt0kenkotff49',
      make: 'Kenko',
      model: 'Two Field Focus 49S',
      threadMm: 49,
      type: 'effect_two_field',
      exposureFactorEv: 0,
      afCompatible: 'limited',
      warning: null,
      mountedOnLensId: null,
    },
  ],
  flashes: [
    {
      id: 'flash0min2800af',
      make: 'Minolta',
      model: 'Program Flash 2800 AF',
      guideNumberIso100M: 28,
      powerLevels: ['Hi', 'Lo'],
      headPositions: ['direct', 'bounce'],
      afIlluminator: true,
      sync: '1/100',
      notes: '',
    },
  ],
};

interface FilmStockSeed {
  id: Id;
  name: string;
  maker: string;
  iso: number;
  process: FilmStock['process'];
  color: boolean;
  dxCoded?: boolean | null;
  notes?: string;
}

const FILM_STOCK_SEEDS: FilmStockSeed[] = [
  { id: 'film0kodakgold2', name: 'Kodak Gold 200', maker: 'Kodak', iso: 200, process: 'C41', color: true },
  { id: 'film0kodakcplus', name: 'Kodak ColorPlus 200', maker: 'Kodak', iso: 200, process: 'C41', color: true },
  { id: 'film0kodakumax4', name: 'Kodak Ultramax 400', maker: 'Kodak', iso: 400, process: 'C41', color: true },
  { id: 'film0kodakptra4', name: 'Kodak Portra 400', maker: 'Kodak', iso: 400, process: 'C41', color: true },
  { id: 'film0kodakptra1', name: 'Kodak Portra 160', maker: 'Kodak', iso: 160, process: 'C41', color: true },
  { id: 'film0kodakektr1', name: 'Kodak Ektar 100', maker: 'Kodak', iso: 100, process: 'C41', color: true },
  { id: 'film0fuji200000', name: 'Fujifilm 200', maker: 'Fujifilm', iso: 200, process: 'C41', color: true },
  { id: 'film0fuji400000', name: 'Fujifilm 400', maker: 'Fujifilm', iso: 400, process: 'C41', color: true },
  { id: 'film0cinestl40d', name: 'CineStill 400D', maker: 'CineStill', iso: 400, process: 'C41', color: true },
  { id: 'film0cinestl80t', name: 'CineStill 800T', maker: 'CineStill', iso: 800, process: 'C41', color: true },
  { id: 'film0ilfordhp5b', name: 'Ilford HP5 Plus 400', maker: 'Ilford', iso: 400, process: 'BW', color: false },
  { id: 'film0ilfordfp4b', name: 'Ilford FP4 Plus 125', maker: 'Ilford', iso: 125, process: 'BW', color: false },
  { id: 'film0ilforddlt4', name: 'Ilford Delta 400', maker: 'Ilford', iso: 400, process: 'BW', color: false },
  { id: 'film0kentmere40', name: 'Kentmere Pan 400', maker: 'Kentmere', iso: 400, process: 'BW', color: false },
  { id: 'film0agfaapx100', name: 'AgfaPhoto APX 100', maker: 'AgfaPhoto', iso: 100, process: 'BW', color: false },
  {
    id: 'film0agfaapx400',
    name: 'AgfaPhoto APX 400 Professional',
    maker: 'AgfaPhoto',
    iso: 400,
    process: 'BW',
    color: false,
    dxCoded: null,
    notes: 'verify ISO in LCD after loading',
  },
  { id: 'film0fomapan200', name: 'Fomapan 200 Creative', maker: 'Foma', iso: 200, process: 'BW', color: false },
  { id: 'film0fomapan400', name: 'Fomapan 400 Action', maker: 'Foma', iso: 400, process: 'BW', color: false },
  { id: 'film0wolfennc20', name: 'Wolfen NC200', maker: 'ORWO', iso: 200, process: 'C41', color: true },
  { id: 'film0wolfennc50', name: 'Wolfen NC500', maker: 'ORWO', iso: 400, process: 'C41', color: true },
  { id: 'film0kodakekt10', name: 'Kodak Ektachrome E100', maker: 'Kodak', iso: 100, process: 'E6', color: true },
  { id: 'film0fujivelv50', name: 'Fujifilm Velvia 50', maker: 'Fujifilm', iso: 50, process: 'E6', color: true },
];

const FILM_STOCKS: PresetRecord<FilmStock>[] = FILM_STOCK_SEEDS.map((seed) => ({
  id: seed.id,
  name: seed.name,
  maker: seed.maker,
  iso: seed.iso,
  process: seed.process,
  color: seed.color,
  exposures: 36,
  dxCoded: seed.dxCoded === undefined ? true : seed.dxCoded,
  notes: seed.notes ?? '',
}));

/** All equipment bundles shipped with the app. */
export function loadEquipmentPresets(): PresetBundle[] {
  return [MINOLTA_KIT];
}

/** The film stock catalogue (seeded under the `film-stocks` bundle id). */
export function loadFilmStockPresets(): PresetRecord<FilmStock>[] {
  return FILM_STOCKS;
}

/** Turns a preset record into a storable entity by adding the sync bookkeeping fields. */
export function materialize<T extends SyncedRecord>(
  record: PresetRecord<T>,
  now: ISODateTime,
  owner: Id | null = null,
): T {
  return { ...record, created: now, updated: now, deleted: null, owner } as T;
}

/** Convenience helper: every preset record materialised in one go. */
export function seedRecords(now: ISODateTime): {
  cameras: Camera[];
  lenses: Lens[];
  filters: Filter[];
  flashes: Flash[];
  filmStocks: FilmStock[];
} {
  const bundles = loadEquipmentPresets();
  return {
    cameras: bundles.flatMap((b) => b.cameras.map((r) => materialize<Camera>(r, now))),
    lenses: bundles.flatMap((b) => b.lenses.map((r) => materialize<Lens>(r, now))),
    filters: bundles.flatMap((b) => b.filters.map((r) => materialize<Filter>(r, now))),
    flashes: bundles.flatMap((b) => b.flashes.map((r) => materialize<Flash>(r, now))),
    filmStocks: loadFilmStockPresets().map((r) => materialize<FilmStock>(r, now)),
  };
}
