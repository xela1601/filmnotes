# T-001 – Monorepo scaffold + domain type contracts

**Wave:** 0 (integrator, run alone before anything else)
**Depends on:** none
**Owns:** all root files, `packages/domain/package.json`, `packages/domain/tsconfig.json`, `packages/domain/jest.config.js`, `packages/domain/src/types.ts`, `packages/domain/src/id.ts`, `packages/domain/src/index.ts`, `.gitignore`, `CLAUDE.md`

**Goal:** A working npm-workspaces monorepo with TypeScript + Jest configured, where `npm test` runs every workspace, and the shared domain types exist so Wave 1 tickets can be implemented in parallel against one contract.

**Interfaces produced:** everything in `packages/domain/src/types.ts` (below) and `newId(): string`.

## Files

```
package.json                      workspaces, root scripts
tsconfig.base.json                strict TS shared by all workspaces
jest.config.js                    root: projects = workspaces
.gitignore
.npmrc                            already exists: cache=.npm-cache
CLAUDE.md                         repo conventions for agents
packages/domain/package.json
packages/domain/tsconfig.json
packages/domain/jest.config.js
packages/domain/src/types.ts
packages/domain/src/id.ts
packages/domain/src/id.test.ts
packages/domain/src/index.ts
```

## Steps

- [ ] **Step 1: root package.json**

```json
{
  "name": "filmnotes",
  "private": true,
  "version": "0.1.0",
  "description": "Per-frame notes for analogue film rolls – Expo app + PocketBase backend",
  "license": "MIT",
  "workspaces": ["packages/*", "apps/*", "tools/*"],
  "scripts": {
    "test": "jest",
    "typecheck": "tsc -b packages/domain packages/presets packages/exporters tools/scan-import",
    "lint": "eslint . --ext .ts,.tsx"
  },
  "devDependencies": {
    "@types/jest": "^29.5.12",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.5",
    "typescript": "^5.6.3"
  }
}
```

(Use the current stable versions `npm view <pkg> version` reports; the ones above are floors.)

- [ ] **Step 2: tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

- [ ] **Step 3: root jest.config.js**

```js
/** Runs every workspace's own jest config as a project. */
module.exports = {
  projects: ["<rootDir>/packages/*", "<rootDir>/apps/*", "<rootDir>/tools/*"],
};
```

- [ ] **Step 4: .gitignore**

```
node_modules/
.npm-cache/
dist/
build/
coverage/
.expo/
.expo-shared/
*.log
.DS_Store
backend/bin/
backend/pb_data/
backend/test/pb_data_*/
.env
.env.*
!.env.example
.claude/worktrees/
```

- [ ] **Step 5: packages/domain package files**

`packages/domain/package.json`

```json
{
  "name": "@filmnotes/domain",
  "version": "0.1.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": { "test": "jest" }
}
```

`packages/domain/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist", "composite": true },
  "include": ["src"]
}
```

`packages/domain/jest.config.js`

```js
module.exports = {
  displayName: "domain",
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
};
```

- [ ] **Step 6: Write the failing test for `newId`**

`packages/domain/src/id.test.ts`

```ts
import { newId, ID_PATTERN } from "./id";

describe("newId", () => {
  it("returns 15 lowercase alphanumeric characters (PocketBase id format)", () => {
    const id = newId();
    expect(id).toMatch(ID_PATTERN);
    expect(id).toHaveLength(15);
  });

  it("is unique across many calls", () => {
    const ids = new Set(Array.from({ length: 5000 }, () => newId()));
    expect(ids.size).toBe(5000);
  });
});
```

- [ ] **Step 7: Run it – must fail** – `npm test -w @filmnotes/domain` → "Cannot find module './id'".

- [ ] **Step 8: Implement `id.ts`**

```ts
/** PocketBase's default record id format: 15 lowercase alphanumerics. */
export const ID_PATTERN = /^[a-z0-9]{15}$/;

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  // globalThis.crypto exists in Node ≥ 19, browsers and React Native (via expo-crypto polyfill).
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

export function newId(): string {
  const bytes = randomBytes(15);
  let id = "";
  for (const byte of bytes) id += ALPHABET[byte % ALPHABET.length];
  return id;
}
```

- [ ] **Step 9: Run – must pass.**

- [ ] **Step 10: Write `types.ts` – THE contract for all other tickets. Copy verbatim.**

```ts
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
```

- [ ] **Step 11: `index.ts`**

```ts
export * from "./types";
export * from "./id";
```

- [ ] **Step 12: CLAUDE.md (repo root)**

```markdown
# filmnotes – agent conventions

- Read `docs/superpowers/specs/2026-09-18-analogue-photography-app-design.md` and your ticket in `docs/tickets/` before touching code.
- TDD: failing test → run → implement → run → commit. Root `npm test` must pass before you report done.
- English everywhere in code/docs/commits; UI text only via i18n keys (`de` default, `en`).
- Conventional commits, scoped by workspace: feat|fix|test|chore|docs(domain|presets|exporters|app|backend|cli).
- Stay inside the paths your ticket owns. Do not edit root config files; add dependencies to your workspace's package.json and run `npm install` at the repo root.
- Ids: `newId()` from `@filmnotes/domain`. Dates: ISO strings in UTC.
- Never commit secrets, `pb_data`, `node_modules`, or `backend/bin`.
```

- [ ] **Step 13: Install and verify** – `npm install` (root), then `npm test` → domain tests pass. `npx tsc -p packages/domain --noEmit` → no errors.

- [ ] **Step 14: Commit**

```bash
git add package.json package-lock.json tsconfig.base.json jest.config.js .gitignore .npmrc CLAUDE.md packages/domain
git commit -m "chore: scaffold npm-workspaces monorepo with domain type contracts"
```
