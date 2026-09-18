/** 15-char lowercase alphanumeric, see id.ts */
export type Id = string;
/** ISO-8601 UTC timestamp, e.g. 2026-09-18T10:00:00.000Z */
export type ISODateTime = string;

/** Fields every synced record carries. `deleted` is a soft-delete marker. */
export interface SyncedRecord {
  id: Id;
  created: ISODateTime;
  updated: ISODateTime;
  deleted: ISODateTime | null;
  /** PocketBase user id; null while running without a server. */
  owner: Id | null;
}

export type ExposureMode = "P" | "A" | "S" | "M";
export type FocusMode = "AF" | "M";
export type AfResult = "green" | "red_blink" | "manual";
export type DriveMode = "S" | "C" | "ST";
export type FlashHead = "direct" | "bounce";
export type Support = "handheld" | "braced" | "tripod" | "beanbag";
export type AfCompatibility = "yes" | "no" | "limited";
export type FilmProcess = "C41" | "BW" | "E6";
export type RollStatus = "loaded" | "shot" | "at_lab" | "developed" | "archived";
export type IsoSource = "DX" | "manual";

/**
 * Shutter speed as displayed on the camera:
 * fractions "1/125", whole seconds `2"`, half stops `1"5` (=1.5 s) / `0"7`, or "bulb".
 * Parsing/formatting lives in shutter.ts (T-002).
 */
export type ShutterSpeed = string;

export interface FrameDefaults {
  exposureMode: ExposureMode | null;
  driveMode: DriveMode | null;
  focusMode: FocusMode | null;
  exposureCompensationEv: number;
  programShift: boolean;
  aeLock: boolean;
  lensId: Id | null;
  filterIds: Id[];
  flashId: Id | null;
  support: Support | null;
}

export interface Camera extends SyncedRecord {
  make: string;
  model: string;
  aliases: string[];
  year: number | null;
  format: string; // "135"
  mount: string | null;
  exposureModes: ExposureMode[];
  /** Whole-stop speeds selectable in S/M, including "bulb" if supported. */
  shutterSpeedsManual: ShutterSpeed[];
  /** Additional half-stop values the camera can pick automatically in P/A. */
  shutterSpeedsAutoExtra: ShutterSpeed[];
  bulbOnlyInModes: ExposureMode[];
  exposureCompensation: { min: number; max: number; step: number; notInModes: ExposureMode[] };
  iso: { min: number; max: number; stepEv: number; dxAuto: boolean };
  focusModes: FocusMode[];
  driveModes: DriveMode[];
  flashSync: ShutterSpeed | null;
  metering: string;
  notes: string;
  conditionNotes: string[];
  defaultsForNewFrame: FrameDefaults;
}

export interface Lens extends SyncedRecord {
  make: string;
  model: string;
  focalMinMm: number;
  focalMaxMm: number;
  maxAperture: number; // widest, e.g. 1.7
  minAperture: number; // smallest, e.g. 22
  apertureValues: number[];
  filterThreadMm: number | null;
  minFocusM: number | null;
  macroNote: string | null;
  weightG: number | null;
  defaultFilterIds: Id[];
  /** Slowest speed considered safe hand-held, e.g. "1/60". */
  handheldMinShutter: ShutterSpeed | null;
  hasHood: boolean;
}

export interface Filter extends SyncedRecord {
  make: string;
  model: string;
  threadMm: number;
  /** free text category: UV, skylight, polarizer_linear, effect_center_soft, ... */
  type: string;
  exposureFactorEv: number;
  afCompatible: AfCompatibility;
  warning: string | null;
  mountedOnLensId: Id | null;
}

export interface Flash extends SyncedRecord {
  make: string;
  model: string;
  guideNumberIso100M: number | null;
  powerLevels: string[]; // ["Hi", "Lo"]
  headPositions: FlashHead[];
  afIlluminator: boolean;
  sync: ShutterSpeed | null;
  notes: string;
}

export interface FilmStock extends SyncedRecord {
  name: string;
  maker: string;
  iso: number;
  process: FilmProcess;
  color: boolean;
  exposures: 24 | 36 | null;
  dxCoded: boolean | null;
  notes: string;
}

export interface Roll extends SyncedRecord {
  cameraId: Id;
  filmStockId: Id;
  isoSet: number;
  isoSource: IsoSource;
  exposures: 24 | 36;
  pushPullEv: number;
  status: RollStatus;
  loadedAt: ISODateTime;
  unloadedAt: ISODateTime | null;
  lab: string | null;
  notes: string;
}

export interface FrameLocation {
  name: string | null;
  lat: number | null;
  lon: number | null;
}

export interface Frame extends SyncedRecord {
  rollId: Id;
  frameNo: number;
  takenAt: ISODateTime | null;
  lensId: Id | null;
  focalLengthMm: number | null;
  exposureMode: ExposureMode | null;
  shutterSpeed: ShutterSpeed | null;
  aperture: number | null;
  exposureCompensationEv: number;
  programShift: boolean;
  aeLock: boolean;
  focusMode: FocusMode | null;
  afResult: AfResult | null;
  driveMode: DriveMode | null;
  flashId: Id | null;
  flashHead: FlashHead | null;
  flashPower: string | null;
  flashOk: boolean | null;
  filterIds: Id[];
  lensHood: boolean;
  support: Support | null;
  beepWarning: boolean;
  light: string | null; // sun, cloudy, shade, indoor_window, indoor_artificial, night, backlight, snow_beach – free
  subject: string | null; // portrait, landscape, street, sport, macro, group, night, other – free
  location: FrameLocation | null;
  notes: string;
}

export interface Scan extends SyncedRecord {
  rollId: Id;
  frameId: Id | null;
  fileName: string;
  sortIndex: number;
  /** PocketBase file name (server-side); null until uploaded. */
  file: string | null;
  width: number | null;
  height: number | null;
  importedAt: ISODateTime;
}

export interface ExportLog extends SyncedRecord {
  frameId: Id;
  target: string; // 'wordpress' | 'share' | future ids
  externalId: string | null;
  url: string | null;
  exportedAt: ISODateTime;
}

export type CollectionName =
  | "cameras"
  | "lenses"
  | "filters"
  | "flashes"
  | "filmStocks"
  | "rolls"
  | "frames"
  | "scans"
  | "exportLogs";

export interface EntityMap {
  cameras: Camera;
  lenses: Lens;
  filters: Filter;
  flashes: Flash;
  filmStocks: FilmStock;
  rolls: Roll;
  frames: Frame;
  scans: Scan;
  exportLogs: ExportLog;
}
export type EntityOf<K extends CollectionName> = EntityMap[K];

/** Maps store collection names to PocketBase collection names. */
export const PB_COLLECTION: Record<CollectionName, string> = {
  cameras: "cameras",
  lenses: "lenses",
  filters: "filters",
  flashes: "flashes",
  filmStocks: "film_stocks",
  rolls: "rolls",
  frames: "frames",
  scans: "scans",
  exportLogs: "export_logs",
};

export type IssueLevel = "error" | "warning" | "info";
export interface ValidationIssue {
  level: IssueLevel;
  /** stable code, doubles as i18n key suffix: validation.<code> */
  code: string;
  field: keyof Frame | null;
  params: Record<string, string | number>;
}

/** Everything validateFrame needs besides the frame itself. */
export interface FrameContext {
  camera: Camera;
  roll: Roll;
  lens: Lens | null;
  filters: Filter[];
  flash: Flash | null;
  /** other frames of the same roll (for frameNo uniqueness) */
  siblingFrames: Frame[];
}
