/**
 * The backend schema has to match the domain types.
 *
 * The PocketBase migrations run in PocketBase's own JS VM, which cannot import this package, so
 * they restate the domain's field names and unions by hand. This test is what holds the two
 * together (T-023).
 *
 * It does not read one migration as text: the schema is the result of *all* of them
 * (`rolls.labOrderId` only exists in the third), so it replays every file in
 * `backend/pb_migrations` in order against a small stand-in for PocketBase's migration API and
 * compares what comes out. The stand-in knows only what the migrations use; anything else fails
 * loudly and has to be added below.
 *
 * The domain side is typed: `ALL_FIELDS` and `SELECT_VALUES` are object literals checked against
 * `types.ts`, so a field or union member added there fails to compile here until it is listed.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";

import { SERVER_SCAN_MIME_TYPES } from "./scanFormats";
import type {
  AfCompatibility,
  AfResult,
  CollectionName,
  DriveMode,
  EntityMap,
  ExposureMode,
  FilmProcess,
  FlashHead,
  FocusMode,
  IsoSource,
  RollStatus,
  Support,
  SyncedRecord,
} from "./types";
import { PB_COLLECTION } from "./types";

const MIGRATIONS_DIR = join(__dirname, "..", "..", "..", "backend", "pb_migrations");

// ---------------------------------------------------------------------------------------------
// The domain side
// ---------------------------------------------------------------------------------------------

/** Every member of a string union, checked by the compiler in both directions. */
function members<T extends string>(values: Record<T, true>): T[] {
  return Object.keys(values) as T[];
}

type DomainFields<K extends CollectionName> = Record<
  Exclude<keyof EntityMap[K], keyof SyncedRecord>,
  true
>;

/** The domain fields of every collection, without the sync fields every record carries. */
const ALL_FIELDS = {
  cameras: {
    make: true,
    model: true,
    aliases: true,
    year: true,
    format: true,
    mount: true,
    exposureModes: true,
    shutterSpeedsManual: true,
    shutterSpeedsAutoExtra: true,
    bulbOnlyInModes: true,
    exposureCompensation: true,
    iso: true,
    focusModes: true,
    driveModes: true,
    flashSync: true,
    metering: true,
    notes: true,
    conditionNotes: true,
    defaultsForNewFrame: true,
  },
  lenses: {
    make: true,
    model: true,
    focalMinMm: true,
    focalMaxMm: true,
    maxAperture: true,
    minAperture: true,
    apertureValues: true,
    filterThreadMm: true,
    minFocusM: true,
    macroNote: true,
    weightG: true,
    defaultFilterIds: true,
    handheldMinShutter: true,
    hasHood: true,
  },
  filters: {
    make: true,
    model: true,
    threadMm: true,
    type: true,
    exposureFactorEv: true,
    afCompatible: true,
    warning: true,
    mountedOnLensId: true,
  },
  flashes: {
    make: true,
    model: true,
    guideNumberIso100M: true,
    powerLevels: true,
    headPositions: true,
    afIlluminator: true,
    sync: true,
    notes: true,
  },
  filmStocks: {
    name: true,
    maker: true,
    iso: true,
    process: true,
    color: true,
    exposures: true,
    dxCoded: true,
    notes: true,
  },
  rolls: {
    cameraId: true,
    filmStockId: true,
    isoSet: true,
    isoSource: true,
    exposures: true,
    pushPullEv: true,
    status: true,
    loadedAt: true,
    unloadedAt: true,
    lab: true,
    labOrderId: true,
    notes: true,
  },
  frames: {
    rollId: true,
    frameNo: true,
    takenAt: true,
    lensId: true,
    focalLengthMm: true,
    exposureMode: true,
    shutterSpeed: true,
    aperture: true,
    exposureCompensationEv: true,
    programShift: true,
    aeLock: true,
    focusMode: true,
    afResult: true,
    driveMode: true,
    flashId: true,
    flashHead: true,
    flashPower: true,
    flashOk: true,
    filterIds: true,
    lensHood: true,
    support: true,
    beepWarning: true,
    light: true,
    subject: true,
    location: true,
    notes: true,
  },
  scans: {
    rollId: true,
    frameId: true,
    fileName: true,
    sortIndex: true,
    file: true,
    width: true,
    height: true,
    importedAt: true,
  },
  exportLogs: {
    frameId: true,
    target: true,
    externalId: true,
    url: true,
    exportedAt: true,
  },
} satisfies { [K in CollectionName]: DomainFields<K> };

/**
 * Every `select` field on the server and the union it has to carry, keyed `collection.field`
 * with the PocketBase collection name. A select field missing here fails the test too.
 */
const SELECT_VALUES: Record<string, string[]> = {
  "filters.afCompatible": members<AfCompatibility>({ yes: true, no: true, limited: true }),
  "film_stocks.process": members<FilmProcess>({ C41: true, BW: true, E6: true }),
  "rolls.isoSource": members<IsoSource>({ DX: true, manual: true }),
  "rolls.status": members<RollStatus>({
    loaded: true,
    shot: true,
    at_lab: true,
    developed: true,
    archived: true,
  }),
  "frames.exposureMode": members<ExposureMode>({ P: true, A: true, S: true, M: true }),
  "frames.focusMode": members<FocusMode>({ AF: true, M: true }),
  "frames.afResult": members<AfResult>({ green: true, red_blink: true, manual: true }),
  "frames.driveMode": members<DriveMode>({ S: true, C: true, ST: true }),
  "frames.flashHead": members<FlashHead>({ direct: true, bounce: true }),
  "frames.support": members<Support>({ handheld: true, braced: true, tripod: true, beanbag: true }),
};

/** Sync bookkeeping the server adds to every collection (`id` is PocketBase's own). */
const SERVER_SYNC_FIELDS = ["deleted", "clientUpdated", "owner", "created", "updated"];

// ---------------------------------------------------------------------------------------------
// The server side: replay the migrations
// ---------------------------------------------------------------------------------------------

interface ServerField {
  name: string;
  type: string;
  values?: string[];
  mimeTypes?: string[];
  [option: string]: unknown;
}

class FieldList {
  private readonly fields: ServerField[] = [];

  constructor(initial: ServerField[] = []) {
    for (const field of initial) this.add(field);
  }

  /** Like PocketBase's `FieldsList.add`: a field with the same name is replaced in place. */
  add(...fields: ServerField[]): void {
    for (const field of fields) {
      const index = this.fields.findIndex((existing) => existing.name === field.name);
      if (index === -1) this.fields.push({ ...field });
      else this.fields[index] = { ...field };
    }
  }

  getByName(name: string): ServerField | undefined {
    return this.fields.find((field) => field.name === name);
  }

  removeByName(name: string): void {
    const index = this.fields.findIndex((field) => field.name === name);
    if (index !== -1) this.fields.splice(index, 1);
  }

  all(): ServerField[] {
    return [...this.fields];
  }
}

class Collection {
  readonly name: string;
  readonly fields: FieldList;
  indexes: string[];

  constructor(options: { name: string; fields?: ServerField[]; indexes?: string[] }) {
    this.name = options.name;
    this.fields = new FieldList(options.fields);
    this.indexes = [...(options.indexes ?? [])];
  }

  addIndex(name: string): void {
    this.indexes.push(name);
  }

  removeIndex(name: string): void {
    this.indexes = this.indexes.filter((index) => !index.includes(name));
  }
}

/** `new TextField({...})` and friends: a typed field is a plain field with its type set. */
const FIELD_CLASSES = Object.fromEntries(
  [
    ["TextField", "text"],
    ["NumberField", "number"],
    ["BoolField", "bool"],
    ["DateField", "date"],
    ["JSONField", "json"],
    ["SelectField", "select"],
    ["FileField", "file"],
    ["RelationField", "relation"],
    ["AutodateField", "autodate"],
  ].map(([className, type]) => [
    className,
    function (this: ServerField, options: Omit<ServerField, "type">) {
      Object.assign(this, options, { type });
    },
  ]),
);

/** Refuses every call the stand-in does not know, instead of silently doing nothing. */
function strict<T extends object>(target: T, what: string): T {
  return new Proxy(target, {
    get(object, property) {
      if (property in object) return object[property as keyof T];
      throw new Error(
        `the migration replay in backendSchema.test.ts does not implement ${what}.${String(property)}`,
      );
    },
  });
}

/** Applies every migration's `up` in file order and returns the resulting collections. */
function replayMigrations(): Map<string, Collection> {
  const collections = new Map<string, Collection>([["users", new Collection({ name: "users" })]]);
  const find = (nameOrId: string): Collection => {
    const collection = collections.get(nameOrId);
    if (!collection) throw new Error(`no collection ${nameOrId}`);
    return collection;
  };
  const app = strict(
    {
      findCollectionByNameOrId: find,
      save: (collection: Collection) => void collections.set(collection.name, collection),
      delete: (collection: Collection) => void collections.delete(collection.name),
      // The replay has no records: a migration that checks its data finds none, and one that
      // copies it between columns has nothing to copy.
      findRecordsByFilter: () => [],
      db: () => strict({ newQuery: () => strict({ execute: () => undefined }, "query") }, "db"),
    },
    "app",
  );

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".js"))
    .sort();
  for (const file of files) {
    let up: ((app: unknown) => void) | undefined;
    runInNewContext(readFileSync(join(MIGRATIONS_DIR, file), "utf8"), {
      migrate: (upFn: (app: unknown) => void) => {
        up = upFn;
      },
      Collection: function (this: unknown, options: ConstructorParameters<typeof Collection>[0]) {
        return strict(new Collection(options), "collection");
      },
      ...FIELD_CLASSES,
    });
    if (!up) throw new Error(`${file} does not call migrate()`);
    up(app);
  }

  collections.delete("users");
  return collections;
}

const server = replayMigrations();

function serverField(collection: string, field: string): ServerField | undefined {
  return server.get(collection)?.fields.getByName(field);
}

const sorted = (values: readonly string[] | undefined): string[] => [...(values ?? [])].sort();

// ---------------------------------------------------------------------------------------------

describe("the backend schema", () => {
  it("has exactly the domain's collections", () => {
    expect(sorted([...server.keys()])).toEqual(sorted(Object.values(PB_COLLECTION)));
  });

  it.each(Object.keys(ALL_FIELDS) as CollectionName[])(
    "%s has exactly the domain's fields, plus the sync fields",
    (name) => {
      const collection = PB_COLLECTION[name];
      const domain = Object.keys(ALL_FIELDS[name]);
      const onServer = (server.get(collection)?.fields.all() ?? []).map((field) => field.name);
      const syncFields = onServer.filter((field) => SERVER_SYNC_FIELDS.includes(field));

      // Named rather than two bare lists, so a failure says which field on which side.
      expect({
        collection,
        missingOnServer: domain.filter((field) => !onServer.includes(field)),
        notInDomain: onServer.filter(
          (field) => !domain.includes(field) && !SERVER_SYNC_FIELDS.includes(field),
        ),
        missingSyncFields: SERVER_SYNC_FIELDS.filter((field) => !syncFields.includes(field)),
      }).toEqual({ collection, missingOnServer: [], notInDomain: [], missingSyncFields: [] });
    },
  );

  it.each(Object.keys(SELECT_VALUES))("%s is a select with the domain's values", (key) => {
    const [collection = "", field = ""] = key.split(".");
    const onServer = serverField(collection, field);

    expect({ field: key, type: onServer?.type, values: sorted(onServer?.values) }).toEqual({
      field: key,
      type: "select",
      values: sorted(SELECT_VALUES[key]),
    });
  });

  it("has no select field the domain does not know about", () => {
    const selects = [...server.values()].flatMap((collection) =>
      collection.fields
        .all()
        .filter((field) => field.type === "select")
        .map((field) => `${collection.name}.${field.name}`),
    );

    expect(selects.filter((key) => !(key in SELECT_VALUES))).toEqual([]);
  });

  it("stores exactly the scan formats the domain calls server formats", () => {
    expect(sorted(serverField("scans", "file")?.mimeTypes)).toEqual(sorted(SERVER_SCAN_MIME_TYPES));
  });
});
