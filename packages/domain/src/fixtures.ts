/**
 * Realistic record fixtures for unit tests.
 *
 * The equipment values mirror the Minolta 7000 AF preset document (§9) so that tests in this
 * package and in dependent packages argue about the same, real hardware. Every fixture is a
 * fully populated record; `overrides` replaces single fields.
 */
import type { Camera, FilmStock, Filter, Flash, Frame, Id, ISODateTime, Lens, Roll } from "./types";

/** Fixed timestamp used for `created`, `updated` and other dates of all fixtures. */
export const FIXTURE_NOW: ISODateTime = "2026-09-18T00:00:00.000Z";

/** Builds a deterministic, PocketBase-shaped id (15 lowercase alphanumerics) from a seed. */
function fixedId(seed: string): Id {
  return seed.padEnd(15, "0").slice(0, 15);
}

export const CAMERA_ID: Id = fixedId("camera1");
export const LENS_ID: Id = fixedId("lens1");
export const FILTER_ID: Id = fixedId("filter1");
export const FLASH_ID: Id = fixedId("flash1");
export const FILM_STOCK_ID: Id = fixedId("filmstock1");
export const ROLL_ID: Id = fixedId("roll1");
export const FRAME_ID: Id = fixedId("frame1");

/** The `SyncedRecord` part every fixture shares. */
function syncedRecord(id: Id): {
  id: Id;
  created: ISODateTime;
  updated: ISODateTime;
  deleted: null;
  owner: null;
} {
  return { id, created: FIXTURE_NOW, updated: FIXTURE_NOW, deleted: null, owner: null };
}

/** Minolta 7000 AF – the camera the whole preset document is about. */
export function makeCamera(overrides: Partial<Camera> = {}): Camera {
  return {
    ...syncedRecord(CAMERA_ID),
    make: "Minolta",
    model: "7000 AF",
    aliases: ["Maxxum 7000", "Alpha 7000"],
    year: 1985,
    format: "135",
    mount: "Minolta A / Sony A",
    exposureModes: ["P", "A", "S", "M"],
    shutterSpeedsManual: [
      '30"',
      '15"',
      '8"',
      '4"',
      '2"',
      '1"',
      "1/2",
      "1/4",
      "1/8",
      "1/15",
      "1/30",
      "1/60",
      "1/125",
      "1/250",
      "1/500",
      "1/1000",
      "1/2000",
      "bulb",
    ],
    shutterSpeedsAutoExtra: [
      '20"',
      '12"',
      '6"',
      '3"',
      '1"5',
      '0"7',
      "1/3",
      "1/6",
      "1/10",
      "1/20",
      "1/45",
      "1/90",
      "1/180",
      "1/350",
      "1/750",
      "1/1500",
    ],
    bulbOnlyInModes: ["M"],
    exposureCompensation: { min: -4, max: 4, step: 0.5, notInModes: ["M"] },
    iso: { min: 25, max: 6400, stepEv: 0.333, dxAuto: true },
    focusModes: ["AF", "M"],
    driveModes: ["S", "C", "ST"],
    flashSync: "1/100",
    metering: "TTL center-weighted",
    notes: "",
    conditionNotes: ["Top LCD has black spots, still readable"],
    defaultsForNewFrame: {
      exposureMode: "P",
      driveMode: "S",
      focusMode: "AF",
      exposureCompensationEv: 0,
      programShift: false,
      aeLock: false,
      lensId: LENS_ID,
      filterIds: [FILTER_ID],
      flashId: null,
      support: "handheld",
    },
    ...overrides,
  };
}

/** Minolta AF Zoom 35-70mm f/4 – the default lens of the preset. */
export function makeLens(overrides: Partial<Lens> = {}): Lens {
  return {
    ...syncedRecord(LENS_ID),
    make: "Minolta",
    model: "AF Zoom 35-70mm f/4",
    focalMinMm: 35,
    focalMaxMm: 70,
    maxAperture: 4,
    minAperture: 22,
    apertureValues: [4, 4.8, 5.6, 6.7, 8, 9.5, 11, 13, 16, 19, 22],
    filterThreadMm: 49,
    minFocusM: 1,
    macroNote: "Macro at 35 mm, approx. 1:4",
    weightG: 255,
    defaultFilterIds: [FILTER_ID],
    handheldMinShutter: "1/60",
    hasHood: false,
    ...overrides,
  };
}

/** Hama UV 390 (O-Haze), 49 mm – mounted on the 35-70 by default. */
export function makeFilter(overrides: Partial<Filter> = {}): Filter {
  return {
    ...syncedRecord(FILTER_ID),
    make: "Hama",
    model: "UV 390 (O-Haze)",
    threadMm: 49,
    type: "UV",
    exposureFactorEv: 0,
    afCompatible: "yes",
    warning: null,
    mountedOnLensId: LENS_ID,
    ...overrides,
  };
}

/** Minolta Program Flash 2800 AF. */
export function makeFlash(overrides: Partial<Flash> = {}): Flash {
  return {
    ...syncedRecord(FLASH_ID),
    make: "Minolta",
    model: "Program Flash 2800 AF",
    guideNumberIso100M: 28,
    powerLevels: ["Hi", "Lo"],
    headPositions: ["direct", "bounce"],
    afIlluminator: true,
    sync: "1/100",
    notes: "",
    ...overrides,
  };
}

/** Kodak Gold 200 – a common C41 consumer film. */
export function makeFilmStock(overrides: Partial<FilmStock> = {}): FilmStock {
  return {
    ...syncedRecord(FILM_STOCK_ID),
    name: "Kodak Gold 200",
    maker: "Kodak",
    iso: 200,
    process: "C41",
    color: true,
    exposures: 36,
    dxCoded: true,
    notes: "",
    ...overrides,
  };
}

export function makeRoll(overrides: Partial<Roll> = {}): Roll {
  return {
    ...syncedRecord(ROLL_ID),
    cameraId: CAMERA_ID,
    filmStockId: FILM_STOCK_ID,
    isoSet: 200,
    isoSource: "DX",
    exposures: 36,
    pushPullEv: 0,
    status: "loaded",
    loadedAt: FIXTURE_NOW,
    unloadedAt: null,
    lab: null,
    labOrderId: null,
    notes: "",
    ...overrides,
  };
}

/** A frame that raises no validation issue with the other fixtures. */
export function makeFrame(overrides: Partial<Frame> = {}): Frame {
  return {
    ...syncedRecord(FRAME_ID),
    rollId: ROLL_ID,
    frameNo: 1,
    takenAt: FIXTURE_NOW,
    lensId: LENS_ID,
    focalLengthMm: 50,
    exposureMode: "P",
    shutterSpeed: "1/125",
    aperture: 5.6,
    exposureCompensationEv: 0,
    programShift: false,
    aeLock: false,
    focusMode: "AF",
    afResult: "green",
    driveMode: "S",
    flashId: null,
    flashHead: null,
    flashPower: null,
    flashOk: null,
    filterIds: [FILTER_ID],
    lensHood: false,
    support: "handheld",
    beepWarning: false,
    light: null,
    subject: null,
    location: null,
    notes: "",
    ...overrides,
  };
}
