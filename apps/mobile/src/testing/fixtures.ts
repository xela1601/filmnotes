/**
 * Record builders for the app's own tests.
 *
 * `@filmnotes/domain` exports equivalent builders, but with neutral ids. These use the
 * ids of the shipped presets (`cam0minolta7000`, `lens0min3570f40`, …), so a fixture
 * record and a seeded record are interchangeable in store and selector tests. Use the
 * domain fixtures for anything that tests domain behaviour.
 */
import type { Camera, Filter, FilmStock, Flash, Frame, Lens, Roll, Scan } from "@filmnotes/domain";

export const FIXTURE_NOW = "2026-09-18T10:00:00.000Z";

const sync = { created: FIXTURE_NOW, updated: FIXTURE_NOW, deleted: null, owner: null } as const;

export function makeCamera(overrides: Partial<Camera> = {}): Camera {
  return {
    id: "cam0minolta7000",
    ...sync,
    make: "Minolta",
    model: "7000 AF",
    aliases: [],
    year: 1985,
    format: "135",
    mount: "Minolta A",
    exposureModes: ["P", "A", "S", "M"],
    shutterSpeedsManual: ["1/60", "1/125", "1/250", "bulb"],
    shutterSpeedsAutoExtra: ["1/90", "1/180"],
    bulbOnlyInModes: ["M"],
    exposureCompensation: { min: -4, max: 4, step: 0.5, notInModes: ["M"] },
    iso: { min: 25, max: 6400, stepEv: 0.333, dxAuto: true },
    focusModes: ["AF", "M"],
    driveModes: ["S", "C", "ST"],
    flashSync: "1/100",
    metering: "TTL center-weighted",
    notes: "",
    conditionNotes: [],
    defaultsForNewFrame: {
      exposureMode: "P",
      driveMode: "S",
      focusMode: "AF",
      exposureCompensationEv: 0,
      programShift: false,
      aeLock: false,
      lensId: "lens0min3570f40",
      filterIds: ["filt0hamauv49a0"],
      flashId: null,
      support: "handheld",
    },
    ...overrides,
  };
}

export function makeLens(overrides: Partial<Lens> = {}): Lens {
  return {
    id: "lens0min3570f40",
    ...sync,
    make: "Minolta",
    model: "AF Zoom 35-70mm f/4",
    focalMinMm: 35,
    focalMaxMm: 70,
    maxAperture: 4,
    minAperture: 22,
    apertureValues: [4, 5.6, 8, 11, 16, 22],
    filterThreadMm: 49,
    minFocusM: 0.8,
    macroNote: null,
    weightG: 255,
    defaultFilterIds: [],
    handheldMinShutter: "1/60",
    hasHood: false,
    ...overrides,
  };
}

export function makeFilter(overrides: Partial<Filter> = {}): Filter {
  return {
    id: "filt0hamauv49a0",
    ...sync,
    make: "Hama",
    model: "UV 390 49",
    threadMm: 49,
    type: "UV",
    exposureFactorEv: 0,
    afCompatible: "yes",
    warning: null,
    mountedOnLensId: null,
    ...overrides,
  };
}

export function makeFlash(overrides: Partial<Flash> = {}): Flash {
  return {
    id: "flash0min2800af",
    ...sync,
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

export function makeFilmStock(overrides: Partial<FilmStock> = {}): FilmStock {
  return {
    id: "film0kodakgold2",
    ...sync,
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
    id: "roll00000000001",
    ...sync,
    cameraId: "cam0minolta7000",
    filmStockId: "film0kodakgold2",
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

export function makeFrame(overrides: Partial<Frame> = {}): Frame {
  return {
    id: "frame0000000001",
    ...sync,
    rollId: "roll00000000001",
    frameNo: 1,
    takenAt: FIXTURE_NOW,
    lensId: null,
    focalLengthMm: null,
    exposureMode: null,
    shutterSpeed: null,
    aperture: null,
    exposureCompensationEv: 0,
    programShift: false,
    aeLock: false,
    focusMode: null,
    afResult: null,
    driveMode: null,
    flashId: null,
    flashHead: null,
    flashPower: null,
    flashOk: null,
    filterIds: [],
    lensHood: false,
    support: null,
    beepWarning: false,
    light: null,
    subject: null,
    location: null,
    notes: "",
    ...overrides,
  };
}

export function makeScan(overrides: Partial<Scan> = {}): Scan {
  return {
    id: "scan00000000001",
    ...sync,
    rollId: "roll00000000001",
    frameId: null,
    fileName: "img001.jpg",
    sortIndex: 0,
    file: null,
    width: null,
    height: null,
    importedAt: FIXTURE_NOW,
    ...overrides,
  };
}
