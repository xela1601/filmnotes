/**
 * Zod schemas mirroring the domain types for the JSON data shipped in `data/`.
 *
 * The schemas describe `PresetRecord<T>` – a domain record without the sync
 * bookkeeping fields, which only exist once a record is materialized into the
 * store. Every schema is `strict()` so a typo in the JSON (an unknown or
 * misspelled key) fails the data tests instead of silently disappearing.
 */
import { z } from 'zod';
import type {
  Camera,
  Filter,
  FilmStock,
  Flash,
  Lens,
  SyncedRecord,
} from '@filmnotes/domain';

/** A preset record carries a stable id but none of the sync fields. */
export type PresetRecord<T extends SyncedRecord> = Omit<T, 'created' | 'updated' | 'deleted' | 'owner'>;

/** PocketBase record id format, see `ID_PATTERN` in @filmnotes/domain. */
export const ID_SCHEMA = z.string().regex(/^[a-z0-9]{15}$/);

const exposureModeSchema = z.enum(['P', 'A', 'S', 'M']);
const focusModeSchema = z.enum(['AF', 'M']);
const driveModeSchema = z.enum(['S', 'C', 'ST']);
const supportSchema = z.enum(['handheld', 'braced', 'tripod', 'beanbag']);
const flashHeadSchema = z.enum(['direct', 'bounce']);
const afCompatibilitySchema = z.enum(['yes', 'no', 'limited']);
const filmProcessSchema = z.enum(['C41', 'BW', 'E6']);
/** Camera-style shutter speed string, e.g. "1/125", `2"`, `1"5`, "bulb". */
const shutterSpeedSchema = z.string();
const exposuresSchema = z.union([z.literal(24), z.literal(36), z.null()]);

const frameDefaultsSchema = z
  .object({
    exposureMode: exposureModeSchema.nullable(),
    driveMode: driveModeSchema.nullable(),
    focusMode: focusModeSchema.nullable(),
    exposureCompensationEv: z.number(),
    programShift: z.boolean(),
    aeLock: z.boolean(),
    lensId: ID_SCHEMA.nullable(),
    filterIds: z.array(ID_SCHEMA),
    flashId: ID_SCHEMA.nullable(),
    support: supportSchema.nullable(),
  })
  .strict();

export const cameraPresetSchema = z
  .object({
    id: ID_SCHEMA,
    make: z.string().min(1),
    model: z.string().min(1),
    aliases: z.array(z.string()),
    year: z.number().int().nullable(),
    format: z.string().min(1),
    mount: z.string().nullable(),
    exposureModes: z.array(exposureModeSchema).min(1),
    shutterSpeedsManual: z.array(shutterSpeedSchema).min(1),
    shutterSpeedsAutoExtra: z.array(shutterSpeedSchema),
    bulbOnlyInModes: z.array(exposureModeSchema),
    exposureCompensation: z
      .object({
        min: z.number(),
        max: z.number(),
        step: z.number().positive(),
        notInModes: z.array(exposureModeSchema),
      })
      .strict(),
    iso: z
      .object({
        min: z.number().positive(),
        max: z.number().positive(),
        stepEv: z.number().positive(),
        dxAuto: z.boolean(),
      })
      .strict(),
    focusModes: z.array(focusModeSchema).min(1),
    driveModes: z.array(driveModeSchema).min(1),
    flashSync: shutterSpeedSchema.nullable(),
    metering: z.string(),
    notes: z.string(),
    conditionNotes: z.array(z.string()),
    defaultsForNewFrame: frameDefaultsSchema,
  })
  .strict();

export const lensPresetSchema = z
  .object({
    id: ID_SCHEMA,
    make: z.string().min(1),
    model: z.string().min(1),
    focalMinMm: z.number().positive(),
    focalMaxMm: z.number().positive(),
    maxAperture: z.number().positive(),
    minAperture: z.number().positive(),
    apertureValues: z.array(z.number().positive()).min(1),
    filterThreadMm: z.number().positive().nullable(),
    minFocusM: z.number().positive().nullable(),
    macroNote: z.string().nullable(),
    weightG: z.number().positive().nullable(),
    defaultFilterIds: z.array(ID_SCHEMA),
    handheldMinShutter: shutterSpeedSchema.nullable(),
    hasHood: z.boolean(),
  })
  .strict();

export const filterPresetSchema = z
  .object({
    id: ID_SCHEMA,
    make: z.string().min(1),
    model: z.string().min(1),
    threadMm: z.number().positive(),
    type: z.string().min(1),
    exposureFactorEv: z.number(),
    afCompatible: afCompatibilitySchema,
    warning: z.string().nullable(),
    mountedOnLensId: ID_SCHEMA.nullable(),
  })
  .strict();

export const flashPresetSchema = z
  .object({
    id: ID_SCHEMA,
    make: z.string().min(1),
    model: z.string().min(1),
    guideNumberIso100M: z.number().positive().nullable(),
    powerLevels: z.array(z.string()),
    headPositions: z.array(flashHeadSchema),
    afIlluminator: z.boolean(),
    sync: shutterSpeedSchema.nullable(),
    notes: z.string(),
  })
  .strict();

export const filmStockPresetSchema = z
  .object({
    id: ID_SCHEMA,
    name: z.string().min(1),
    maker: z.string().min(1),
    iso: z.number().positive(),
    process: filmProcessSchema,
    color: z.boolean(),
    exposures: exposuresSchema,
    dxCoded: z.boolean().nullable(),
    notes: z.string(),
  })
  .strict();

export const presetBundleSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    version: z.number().int().positive(),
    cameras: z.array(cameraPresetSchema),
    lenses: z.array(lensPresetSchema),
    filters: z.array(filterPresetSchema),
    flashes: z.array(flashPresetSchema),
  })
  .strict();

export const filmStockPresetsSchema = z.array(filmStockPresetSchema);

export type PresetBundle = z.infer<typeof presetBundleSchema>;

/**
 * Compile-time proof that the schemas and the domain types stay in sync:
 * both directions of assignability are checked, so an added, removed or
 * retyped domain field breaks the build here.
 */
type Extends<A extends B, B> = true;
type _CameraOut = Extends<z.infer<typeof cameraPresetSchema>, PresetRecord<Camera>>;
type _CameraIn = Extends<PresetRecord<Camera>, z.infer<typeof cameraPresetSchema>>;
type _LensOut = Extends<z.infer<typeof lensPresetSchema>, PresetRecord<Lens>>;
type _LensIn = Extends<PresetRecord<Lens>, z.infer<typeof lensPresetSchema>>;
type _FilterOut = Extends<z.infer<typeof filterPresetSchema>, PresetRecord<Filter>>;
type _FilterIn = Extends<PresetRecord<Filter>, z.infer<typeof filterPresetSchema>>;
type _FlashOut = Extends<z.infer<typeof flashPresetSchema>, PresetRecord<Flash>>;
type _FlashIn = Extends<PresetRecord<Flash>, z.infer<typeof flashPresetSchema>>;
type _FilmStockOut = Extends<z.infer<typeof filmStockPresetSchema>, PresetRecord<FilmStock>>;
type _FilmStockIn = Extends<PresetRecord<FilmStock>, z.infer<typeof filmStockPresetSchema>>;
