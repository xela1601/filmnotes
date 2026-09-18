/**
 * Field descriptors for the equipment editor (spec §3.1: equipment is user data and
 * therefore extensible in the app).
 *
 * Every piece of equipment is edited by the same generic screen: the descriptors below
 * say which fields a type has and how each one is entered, the screen only switches on
 * `kind`. Adding a field to a record type therefore means adding one line here – no new
 * screen, no new form component.
 *
 * Nested record fields are addressed with a dotted key (`iso.max`), read with
 * `readField` and patched with `writeField`.
 */
import {
  isBulb,
  newId,
  parseShutterSpeed,
  type Camera,
  type EntityOf,
  type FilmStock,
  type Filter,
  type Flash,
  type ISODateTime,
  type Lens,
} from "@filmnotes/domain";

/** The collections that hold equipment; the route parameter `[type]` carries one of these. */
export type EquipmentType = "cameras" | "lenses" | "filters" | "flashes" | "filmStocks";

export const EQUIPMENT_TYPES: EquipmentType[] = [
  "cameras",
  "lenses",
  "filters",
  "flashes",
  "filmStocks",
];

/** A record of one of the equipment collections. */
export type EquipmentRecord = Camera | Lens | Filter | Flash | FilmStock;

/** How a field is entered. The editor renders one component per kind. */
export type FieldKind =
  | "text"
  | "number"
  | "boolean"
  | "select"
  | "multiselect"
  | "stringList"
  | "numberList"
  | "shutterList";

/**
 * How a chosen option maps back onto the record:
 * `tristate` is a `boolean | null` entered as yes/no/unknown.
 */
export type OptionValueType = "string" | "number" | "boolean" | "tristate";

export interface FieldOption {
  value: string;
  /** i18n key of the option label; the raw value is shown when it is absent. */
  labelKey?: string;
}

export interface FieldDescriptor {
  /** Record key, dotted for nested fields (`exposureCompensation.min`). */
  key: string;
  kind: FieldKind;
  /** i18n key in the `equipment` namespace, always below `fields.`. */
  labelKey: string;
  required?: boolean;
  /** Fixed options of a select/multiselect field. */
  options?: FieldOption[];
  min?: number;
  max?: number;
  step?: number;
  /** Options are the records of that collection – that is how equipment references equipment. */
  optionsFrom?: EquipmentType;
  /** How a selected option is stored; defaults to `string`. */
  valueType?: OptionValueType;
  /** The record accepts `null`, so an emptied field is stored as null instead of ''/0. */
  nullable?: boolean;
  /** Free text over several lines (notes). */
  multiline?: boolean;
  /** A single shutter speed: validated like the entries of a shutter list. */
  shutter?: boolean;
}

const EXPOSURE_MODE_OPTIONS: FieldOption[] = [
  { value: "P" },
  { value: "A" },
  { value: "S" },
  { value: "M" },
];

const FOCUS_MODE_OPTIONS: FieldOption[] = [
  { value: "AF", labelKey: "options.focusModes.AF" },
  { value: "M", labelKey: "options.focusModes.M" },
];

const DRIVE_MODE_OPTIONS: FieldOption[] = [
  { value: "S", labelKey: "options.driveModes.S" },
  { value: "C", labelKey: "options.driveModes.C" },
  { value: "ST", labelKey: "options.driveModes.ST" },
];

const SUPPORT_OPTIONS: FieldOption[] = [
  { value: "handheld", labelKey: "options.support.handheld" },
  { value: "braced", labelKey: "options.support.braced" },
  { value: "tripod", labelKey: "options.support.tripod" },
  { value: "beanbag", labelKey: "options.support.beanbag" },
];

const YES_NO_UNKNOWN_OPTIONS: FieldOption[] = [
  { value: "yes", labelKey: "options.tristate.yes" },
  { value: "no", labelKey: "options.tristate.no" },
  { value: "unknown", labelKey: "options.tristate.unknown" },
];

const CAMERA_FIELDS: FieldDescriptor[] = [
  { key: "make", kind: "text", labelKey: "fields.make", required: true },
  { key: "model", kind: "text", labelKey: "fields.model", required: true },
  { key: "aliases", kind: "stringList", labelKey: "fields.aliases" },
  { key: "year", kind: "number", labelKey: "fields.year", nullable: true, min: 1850, max: 2100 },
  { key: "format", kind: "text", labelKey: "fields.format" },
  { key: "mount", kind: "text", labelKey: "fields.mount", nullable: true },
  {
    key: "exposureModes",
    required: true,
    kind: "multiselect",
    labelKey: "fields.exposureModes",
    options: EXPOSURE_MODE_OPTIONS,
  },
  {
    key: "shutterSpeedsManual",
    kind: "shutterList",
    labelKey: "fields.shutterSpeedsManual",
    required: true,
  },
  { key: "shutterSpeedsAutoExtra", kind: "shutterList", labelKey: "fields.shutterSpeedsAutoExtra" },
  {
    key: "bulbOnlyInModes",
    kind: "multiselect",
    labelKey: "fields.bulbOnlyInModes",
    options: EXPOSURE_MODE_OPTIONS,
  },
  {
    key: "exposureCompensation.min",
    kind: "number",
    labelKey: "fields.exposureCompensationMin",
    step: 0.5,
  },
  {
    key: "exposureCompensation.max",
    kind: "number",
    labelKey: "fields.exposureCompensationMax",
    step: 0.5,
  },
  {
    key: "exposureCompensation.step",
    kind: "number",
    labelKey: "fields.exposureCompensationStep",
    step: 0.5,
    min: 0,
  },
  { key: "iso.min", kind: "number", labelKey: "fields.isoMin", min: 0 },
  { key: "iso.max", kind: "number", labelKey: "fields.isoMax", min: 0 },
  {
    key: "focusModes",
    kind: "multiselect",
    labelKey: "fields.focusModes",
    options: FOCUS_MODE_OPTIONS,
  },
  {
    key: "driveModes",
    kind: "multiselect",
    labelKey: "fields.driveModes",
    options: DRIVE_MODE_OPTIONS,
  },
  { key: "flashSync", kind: "text", labelKey: "fields.flashSync", nullable: true, shutter: true },
  { key: "metering", kind: "text", labelKey: "fields.metering" },
  { key: "notes", kind: "text", labelKey: "fields.notes", multiline: true },
  { key: "conditionNotes", kind: "stringList", labelKey: "fields.conditionNotes" },
  {
    key: "defaultsForNewFrame.exposureMode",
    kind: "select",
    labelKey: "fields.defaultExposureMode",
    options: EXPOSURE_MODE_OPTIONS,
    nullable: true,
  },
  {
    key: "defaultsForNewFrame.driveMode",
    kind: "select",
    labelKey: "fields.defaultDriveMode",
    options: DRIVE_MODE_OPTIONS,
    nullable: true,
  },
  {
    key: "defaultsForNewFrame.focusMode",
    kind: "select",
    labelKey: "fields.defaultFocusMode",
    options: FOCUS_MODE_OPTIONS,
    nullable: true,
  },
  {
    key: "defaultsForNewFrame.support",
    kind: "select",
    labelKey: "fields.defaultSupport",
    options: SUPPORT_OPTIONS,
    nullable: true,
  },
  {
    key: "defaultsForNewFrame.lensId",
    kind: "select",
    labelKey: "fields.defaultLens",
    optionsFrom: "lenses",
    nullable: true,
  },
  {
    key: "defaultsForNewFrame.filterIds",
    kind: "multiselect",
    labelKey: "fields.defaultFilters",
    optionsFrom: "filters",
  },
  {
    key: "defaultsForNewFrame.flashId",
    kind: "select",
    labelKey: "fields.defaultFlash",
    optionsFrom: "flashes",
    nullable: true,
  },
  {
    key: "defaultsForNewFrame.exposureCompensationEv",
    kind: "number",
    labelKey: "fields.defaultExposureCompensation",
    step: 0.5,
  },
  {
    key: "defaultsForNewFrame.programShift",
    kind: "boolean",
    labelKey: "fields.defaultProgramShift",
  },
  { key: "defaultsForNewFrame.aeLock", kind: "boolean", labelKey: "fields.defaultAeLock" },
];

const LENS_FIELDS: FieldDescriptor[] = [
  { key: "make", kind: "text", labelKey: "fields.make", required: true },
  { key: "model", kind: "text", labelKey: "fields.model", required: true },
  { key: "focalMinMm", kind: "number", labelKey: "fields.focalMinMm", min: 0 },
  { key: "focalMaxMm", kind: "number", labelKey: "fields.focalMaxMm", min: 0 },
  { key: "maxAperture", kind: "number", labelKey: "fields.maxAperture", min: 0, step: 0.1 },
  { key: "minAperture", kind: "number", labelKey: "fields.minAperture", min: 0, step: 0.1 },
  { key: "apertureValues", kind: "numberList", labelKey: "fields.apertureValues", required: true },
  {
    key: "filterThreadMm",
    kind: "number",
    labelKey: "fields.filterThreadMm",
    nullable: true,
    min: 0,
  },
  { key: "minFocusM", kind: "number", labelKey: "fields.minFocusM", nullable: true, step: 0.1 },
  { key: "macroNote", kind: "text", labelKey: "fields.macroNote", nullable: true },
  { key: "weightG", kind: "number", labelKey: "fields.weightG", nullable: true, min: 0 },
  {
    key: "handheldMinShutter",
    kind: "text",
    labelKey: "fields.handheldMinShutter",
    nullable: true,
    shutter: true,
  },
  { key: "hasHood", kind: "boolean", labelKey: "fields.hasHood" },
  {
    key: "defaultFilterIds",
    kind: "multiselect",
    labelKey: "fields.defaultFilterIds",
    optionsFrom: "filters",
  },
];

const FILTER_FIELDS: FieldDescriptor[] = [
  { key: "make", kind: "text", labelKey: "fields.make", required: true },
  { key: "model", kind: "text", labelKey: "fields.model", required: true },
  { key: "threadMm", kind: "number", labelKey: "fields.threadMm", min: 0 },
  { key: "type", kind: "text", labelKey: "fields.type" },
  {
    key: "exposureFactorEv",
    kind: "number",
    labelKey: "fields.exposureFactorEv",
    step: 0.5,
    min: 0,
  },
  {
    key: "afCompatible",
    kind: "select",
    labelKey: "fields.afCompatible",
    options: [
      { value: "yes", labelKey: "options.afCompatible.yes" },
      { value: "no", labelKey: "options.afCompatible.no" },
      { value: "limited", labelKey: "options.afCompatible.limited" },
    ],
  },
  { key: "warning", kind: "text", labelKey: "fields.warning", nullable: true, multiline: true },
  {
    key: "mountedOnLensId",
    kind: "select",
    labelKey: "fields.mountedOnLensId",
    optionsFrom: "lenses",
    nullable: true,
  },
];

const FLASH_FIELDS: FieldDescriptor[] = [
  { key: "make", kind: "text", labelKey: "fields.make", required: true },
  { key: "model", kind: "text", labelKey: "fields.model", required: true },
  {
    key: "guideNumberIso100M",
    kind: "number",
    labelKey: "fields.guideNumberIso100M",
    nullable: true,
    min: 0,
  },
  { key: "powerLevels", kind: "stringList", labelKey: "fields.powerLevels" },
  {
    key: "headPositions",
    kind: "multiselect",
    labelKey: "fields.headPositions",
    options: [
      { value: "direct", labelKey: "options.headPositions.direct" },
      { value: "bounce", labelKey: "options.headPositions.bounce" },
    ],
  },
  { key: "afIlluminator", kind: "boolean", labelKey: "fields.afIlluminator" },
  { key: "sync", kind: "text", labelKey: "fields.sync", nullable: true, shutter: true },
  { key: "notes", kind: "text", labelKey: "fields.notes", multiline: true },
];

const FILM_STOCK_FIELDS: FieldDescriptor[] = [
  { key: "name", kind: "text", labelKey: "fields.name", required: true },
  { key: "maker", kind: "text", labelKey: "fields.maker", required: true },
  { key: "iso", kind: "number", labelKey: "fields.iso", required: true, min: 0 },
  {
    key: "process",
    kind: "select",
    labelKey: "fields.process",
    options: [{ value: "C41" }, { value: "BW" }, { value: "E6" }],
  },
  { key: "color", kind: "boolean", labelKey: "fields.color" },
  {
    key: "exposures",
    kind: "select",
    labelKey: "fields.exposures",
    options: [{ value: "24" }, { value: "36" }],
    valueType: "number",
    nullable: true,
  },
  {
    key: "dxCoded",
    kind: "select",
    labelKey: "fields.dxCoded",
    options: YES_NO_UNKNOWN_OPTIONS,
    valueType: "tristate",
  },
  { key: "notes", kind: "text", labelKey: "fields.notes", multiline: true },
];

export const DESCRIPTORS: Record<EquipmentType, FieldDescriptor[]> = {
  cameras: CAMERA_FIELDS,
  lenses: LENS_FIELDS,
  filters: FILTER_FIELDS,
  flashes: FLASH_FIELDS,
  filmStocks: FILM_STOCK_FIELDS,
};

export function isEquipmentType(value: string): value is EquipmentType {
  return (EQUIPMENT_TYPES as string[]).includes(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The value of a (possibly nested) descriptor key; `undefined` when the key is absent. */
export function readField(record: EquipmentRecord, key: string): unknown {
  let current: unknown = record;
  for (const part of key.split(".")) {
    if (!isPlainObject(current)) return undefined;
    current = current[part];
  }
  return current;
}

function writeNested(
  source: Record<string, unknown>,
  path: string[],
  value: unknown,
): Record<string, unknown> {
  const [head, ...rest] = path;
  if (head === undefined) return source;
  if (rest.length === 0) return { ...source, [head]: value };

  const nested = source[head];
  return {
    ...source,
    [head]: writeNested(isPlainObject(nested) ? nested : {}, rest, value),
  };
}

/** A copy of `record` with the (possibly nested) descriptor key set to `value`. */
export function writeField<T extends EquipmentRecord>(record: T, key: string, value: unknown): T {
  // The descriptors are the only source of keys, so the shape stays the record's own;
  // the cast is the price of patching a statically unknown key path.
  const patched = writeNested(record as unknown as Record<string, unknown>, key.split("."), value);
  return patched as unknown as T;
}

/**
 * A fresh record of `type`, ready to be edited.
 *
 * Everything the user has to fill in starts empty. The camera's exposure compensation
 * and ISO ranges are the exception: they bound the fields of the frame editor (T-007),
 * so a brand-new camera gets the usual 35 mm SLR ranges instead of a dead 0…0.
 */
export function emptyRecord<T extends EquipmentType>(type: T, now: ISODateTime): EntityOf<T> {
  const sync = { id: newId(), created: now, updated: now, deleted: null, owner: null };

  switch (type) {
    case "cameras": {
      const camera: Camera = {
        ...sync,
        make: "",
        model: "",
        aliases: [],
        year: null,
        format: "135",
        mount: null,
        exposureModes: [],
        shutterSpeedsManual: [],
        shutterSpeedsAutoExtra: [],
        bulbOnlyInModes: [],
        exposureCompensation: { min: -3, max: 3, step: 0.5, notInModes: [] },
        iso: { min: 25, max: 6400, stepEv: 1 / 3, dxAuto: true },
        focusModes: [],
        driveModes: [],
        flashSync: null,
        metering: "",
        notes: "",
        conditionNotes: [],
        defaultsForNewFrame: {
          exposureMode: null,
          driveMode: null,
          focusMode: null,
          exposureCompensationEv: 0,
          programShift: false,
          aeLock: false,
          lensId: null,
          filterIds: [],
          flashId: null,
          support: null,
        },
      };
      return camera as EntityOf<T>;
    }
    case "lenses": {
      const lens: Lens = {
        ...sync,
        make: "",
        model: "",
        focalMinMm: 0,
        focalMaxMm: 0,
        maxAperture: 0,
        minAperture: 0,
        apertureValues: [],
        filterThreadMm: null,
        minFocusM: null,
        macroNote: null,
        weightG: null,
        defaultFilterIds: [],
        handheldMinShutter: null,
        hasHood: false,
      };
      return lens as EntityOf<T>;
    }
    case "filters": {
      const filter: Filter = {
        ...sync,
        make: "",
        model: "",
        threadMm: 0,
        type: "",
        exposureFactorEv: 0,
        afCompatible: "yes",
        warning: null,
        mountedOnLensId: null,
      };
      return filter as EntityOf<T>;
    }
    case "flashes": {
      const flash: Flash = {
        ...sync,
        make: "",
        model: "",
        guideNumberIso100M: null,
        powerLevels: [],
        headPositions: [],
        afIlluminator: false,
        sync: null,
        notes: "",
      };
      return flash as EntityOf<T>;
    }
    default: {
      const stock: FilmStock = {
        ...sync,
        name: "",
        maker: "",
        iso: 0,
        process: "C41",
        color: true,
        exposures: 36,
        dxCoded: null,
        notes: "",
      };
      return stock as EntityOf<T>;
    }
  }
}

/**
 * The option value that stands for the record's current value, or null when nothing
 * is selected. Selects always work on strings; `valueType` says what is stored.
 */
export function encodeOption(field: FieldDescriptor, value: unknown): string | null {
  switch (field.valueType ?? "string") {
    case "number":
      return typeof value === "number" ? String(value) : null;
    case "boolean":
      return value === true ? "yes" : value === false ? "no" : null;
    case "tristate":
      return value === true ? "yes" : value === false ? "no" : "unknown";
    default:
      return typeof value === "string" && value !== "" ? value : null;
  }
}

/** The value to store for a chosen option; the inverse of `encodeOption`. */
export function decodeOption(field: FieldDescriptor, selected: string | null): unknown {
  const valueType = field.valueType ?? "string";

  if (selected === null) return valueType === "string" && field.nullable !== true ? "" : null;

  switch (valueType) {
    case "number": {
      const parsed = Number(selected);
      return Number.isFinite(parsed) ? parsed : null;
    }
    case "boolean":
      return selected === "yes";
    case "tristate":
      return selected === "yes" ? true : selected === "no" ? false : null;
    default:
      return selected;
  }
}

/** Error code per descriptor key; doubles as the i18n key suffix `errors.<code>`. */
export type RecordErrors = Record<string, "required" | "invalid">;

/** True for a shutter speed the domain can parse; `bulb` is a valid setting, not a time. */
function isShutterSpeed(value: string): boolean {
  return isBulb(value) || parseShutterSpeed(value) !== null;
}

function validateField(field: FieldDescriptor, value: unknown): "required" | "invalid" | null {
  if (field.kind === "text") {
    const text = typeof value === "string" ? value.trim() : "";
    if (field.required === true && text === "") return "required";
    if (field.shutter === true && text !== "" && !isShutterSpeed(text)) return "invalid";
    return null;
  }

  if (field.kind === "number") {
    const number = typeof value === "number" ? value : null;
    if (field.required === true && (number === null || number === 0)) return "required";
    if (number === null) return null;
    // A declared min/max is the field's range – the camera's compensation min is
    // negative on purpose, so only declared bounds are enforced.
    if (!Number.isFinite(number)) return "invalid";
    if (field.min !== undefined && number < field.min) return "invalid";
    if (field.max !== undefined && number > field.max) return "invalid";
    return null;
  }

  if (field.kind === "shutterList") {
    const entries = Array.isArray(value) ? value : [];
    if (field.required === true && entries.length === 0) return "required";
    const allParseable = entries.every(
      (entry) => typeof entry === "string" && isShutterSpeed(entry),
    );
    return allParseable ? null : "invalid";
  }

  // The list kinds the editor offers. An empty *required* list is what produced equipment that
  // the app accepted and the frame editor could not use: a camera without exposure modes or a
  // lens without apertures leaves those pickers empty, with nothing saying why.
  if (field.kind === "multiselect" || field.kind === "stringList" || field.kind === "numberList") {
    const entries = Array.isArray(value) ? value : [];
    if (field.required === true && entries.length === 0) return "required";
    return null;
  }

  return null;
}

/**
 * Checks a record the way the editor does before saving: an empty error map means
 * "ready to store".
 */
export function validateRecord<T extends EquipmentType>(
  type: T,
  record: EntityOf<T>,
): RecordErrors {
  const errors: RecordErrors = {};

  for (const field of DESCRIPTORS[type]) {
    const code = validateField(field, readField(record, field.key));
    if (code !== null) errors[field.key] = code;
  }

  if (type === "lenses") {
    const min = readField(record, "focalMinMm");
    const max = readField(record, "focalMaxMm");
    if (typeof min === "number" && typeof max === "number" && min > max) {
      errors.focalMaxMm = "invalid";
    }
  }

  return errors;
}

/** What the list and the other screens call the record; empty while it is unnamed. */
export function displayName<T extends EquipmentType>(type: T, record: EntityOf<T>): string {
  if (type === "filmStocks") {
    const name = readField(record, "name");
    return typeof name === "string" ? name.trim() : "";
  }

  const make = readField(record, "make");
  const model = readField(record, "model");
  return [typeof make === "string" ? make : "", typeof model === "string" ? model : ""]
    .map((part) => part.trim())
    .filter((part) => part !== "")
    .join(" ");
}
