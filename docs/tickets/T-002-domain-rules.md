# T-002 – Domain rules & helpers (`@filmnotes/domain`)

**Wave:** 1
**Depends on:** T-001
**Owns:** `packages/domain/src/**` except `types.ts`, `id.ts`, `index.ts` (you may only *append* exports to `index.ts`).

**Goal:** Framework-free, fully unit-tested functions for shutter-speed math, aperture/shutter option lists, frame validation (spec §3.2 rules 1–10), frame defaults, natural-sort scan matching and caption building.

**Interfaces produced (exact names, used by T-006/T-007/T-009/T-010/T-013):**

```ts
// shutter.ts
parseShutterSpeed(value: ShutterSpeed): number | null   // seconds; null for "bulb" or unparsable
formatShutterSpeed(seconds: number): ShutterSpeed        // inverse for values ≥ 1/8000 … 30
compareShutterSpeeds(a: ShutterSpeed, b: ShutterSpeed): number  // negative if a is shorter (faster)
isSlowerThan(a: ShutterSpeed, b: ShutterSpeed): boolean          // a longer than b
shutterSpeedsForMode(camera: Camera, mode: ExposureMode | null): ShutterSpeed[]  // sorted fastest→slowest, "bulb" last

// aperture.ts
apertureValuesForLens(lens: Lens | null): number[]
isValidAperture(lens: Lens | null, aperture: number): boolean

// frameDefaults.ts
newFrame(input: { rollId: Id; frameNo: number; camera: Camera; previous: Frame | null; now: ISODateTime }): Frame
nextFrameNo(frames: Frame[]): number

// validation.ts
validateFrame(frame: Frame, ctx: FrameContext): ValidationIssue[]

// scanMatching.ts
naturalCompare(a: string, b: string): number
matchScansToFrames(fileNames: string[], frames: Frame[]): ScanAssignment[]
interface ScanAssignment { fileName: string; sortIndex: number; frameId: Id | null; frameNo: number | null }
shiftAssignments(assignments: ScanAssignment[], frames: Frame[], fromSortIndex: number, direction: 1 | -1): ScanAssignment[]

// caption.ts
buildCaption(input: CaptionInput): string
interface CaptionInput { frame: Frame; roll: Roll; camera: Camera; lens: Lens | null; filters: Filter[]; filmStock: FilmStock; template?: string; hashtags?: string[]; locale?: 'de' | 'en' }
DEFAULT_CAPTION_TEMPLATE: string

// fixtures.ts (exported for other packages' tests)
makeCamera(overrides?: Partial<Camera>): Camera   // Minolta 7000 AF shaped
makeLens(overrides?: Partial<Lens>): Lens         // 35-70 f/4
makeFilter(overrides?: Partial<Filter>): Filter   // Hama UV 49
makeFlash(overrides?: Partial<Flash>): Flash
makeFilmStock(overrides?: Partial<FilmStock>): FilmStock
makeRoll(overrides?: Partial<Roll>): Roll
makeFrame(overrides?: Partial<Frame>): Frame
```

## Files

```
packages/domain/src/shutter.ts / shutter.test.ts
packages/domain/src/aperture.ts / aperture.test.ts
packages/domain/src/frameDefaults.ts / frameDefaults.test.ts
packages/domain/src/validation.ts / validation.test.ts
packages/domain/src/scanMatching.ts / scanMatching.test.ts
packages/domain/src/caption.ts / caption.test.ts
packages/domain/src/fixtures.ts
packages/domain/src/index.ts  (append exports)
```

## Steps (TDD, one commit per file pair)

- [ ] **Step 1: fixtures.ts** – build realistic records with all `SyncedRecord` fields (`created`/`updated` = `'2026-09-18T00:00:00.000Z'`, `deleted: null`, `owner: null`). Camera fixture values from `Minolta_7000_AF_Preset.md` §9: `shutterSpeedsManual: ['30"','15"','8"','4"','2"','1"','1/2','1/4','1/8','1/15','1/30','1/60','1/125','1/250','1/500','1/1000','1/2000','bulb']`, `shutterSpeedsAutoExtra: ['20"','12"','6"','3"','1"5','0"7','1/3','1/6','1/10','1/20','1/45','1/90','1/180','1/350','1/750','1/1500']`, `bulbOnlyInModes: ['M']`, `exposureCompensation: {min:-4,max:4,step:0.5,notInModes:['M']}`, `flashSync: '1/100'`. Lens fixture: 35-70, `apertureValues: [4,4.8,5.6,6.7,8,9.5,11,13,16,19,22]`, `filterThreadMm: 49`, `handheldMinShutter: '1/60'`. Commit: `test(domain): add record fixtures`.

- [ ] **Step 2: shutter.test.ts** – cases:
  - `parseShutterSpeed('1/125')` → `0.008` (use `toBeCloseTo`), `'2"'` → 2, `'1"5'` → 1.5, `'0"7'` → 0.7, `'30"'` → 30, `'1/2'` → 0.5, `'bulb'` → null, `'abc'` → null, `'2s'` → 2, `'1.5s'` → 1.5.
  - `formatShutterSpeed(0.008)` → `'1/125'`, `(2)` → `'2"'`, `(1.5)` → `'1"5'`, `(0.5)` → `'1/2'`.
  - `compareShutterSpeeds('1/250','1/60') < 0`, `isSlowerThan('1/30','1/60') === true`, `isSlowerThan('1/125','1/60') === false`, `isSlowerThan('bulb','1/60') === true` (bulb counts as slowest).
  - `shutterSpeedsForMode(camera,'M')` equals manual list sorted fastest→slowest with `'bulb'` last; `('S')` excludes `'bulb'` (because `bulbOnlyInModes` is `['M']`); `('P')` = manual (without bulb) ∪ autoExtra sorted; `(null)` same as `'P'`.
- [ ] **Step 3: run → fail. Step 4: implement shutter.ts. Step 5: run → pass. Step 6: commit** `feat(domain): shutter speed parsing and ordering`.

- [ ] **Step 7: aperture.test.ts** – `apertureValuesForLens(null)` → `[]`; with lens → the list; `isValidAperture(lens, 5.6)` true, `(lens, 1.7)` false, `(null, 8)` true (unknown lens = no restriction). Implement, commit `feat(domain): aperture helpers`.

- [ ] **Step 8: frameDefaults.test.ts**
  - `nextFrameNo([])` → 1; with frames 1,2,3 → 4; with 1,3 → 4 (max+1, gaps are left alone).
  - `newFrame` with `previous: null` copies `camera.defaultsForNewFrame` (mode, drive, focus, lensId, filterIds, flashId, support, comp, shift, aeLock), sets `takenAt: now`, `created/updated: now`, `frameNo`, `rollId`, `notes: ''`, `id` matching `ID_PATTERN`, all other fields null/false/[].
  - `newFrame` with `previous` carries over from previous: `lensId, focalLengthMm, filterIds, flashId, flashHead, flashPower, exposureMode, focusMode, driveMode, support, lensHood, light`; does **not** copy `shutterSpeed, aperture, notes, location, takenAt, afResult, flashOk, beepWarning, subject, exposureCompensationEv (reset to camera default), programShift, aeLock`.
  Implement, commit `feat(domain): new frame defaults`.

- [ ] **Step 9: validation.test.ts** – one `it` per rule, each asserting the exact issue `{level, code, field}`; also an "all good" frame returns `[]`. Codes (use exactly):

| # | code | level | field | condition |
|---|---|---|---|---|
| 1 | `bulb_only_in_m` | error | shutterSpeed | shutter `bulb` and mode not in `camera.bulbOnlyInModes` |
| 2 | `aperture_not_on_lens` | error | aperture | lens set and aperture not in `lens.apertureValues` |
| 3 | `filter_thread_mismatch` | error | filterIds | any filter `threadMm !== lens.filterThreadMm` (params: `{filter: model, filterThread, lensThread}`) |
| 4 | `polarizer_blocks_af` | warning | focusMode | focusMode `AF` and any filter with `afCompatible === 'no'` |
| 5 | `flash_forces_sync_speed` | info | shutterSpeed | flash set, mode `M`, shutter faster than `camera.flashSync` (params `{sync}`) |
| 6 | `compensation_ignored_in_m` | info | exposureCompensationEv | comp ≠ 0 and mode in `camera.exposureCompensation.notInModes` |
| 7 | `handheld_shake_risk` | warning | shutterSpeed | support `handheld` (or null), lens with `handheldMinShutter`, shutter slower than it (params `{limit}`) |
| 8 | `focal_length_out_of_range` | error | focalLengthMm | lens set and focal outside `[focalMinMm, focalMaxMm]` |
| 9a | `frame_no_out_of_range` | error | frameNo | frameNo < 1 or > roll.exposures |
| 9b | `frame_no_duplicate` | error | frameNo | another sibling (different id, not deleted) has same frameNo |
| 10 | `shutter_not_available` | error | shutterSpeed | shutter not in `shutterSpeedsForMode(camera, mode)` (skip if shutter null) |

  Implement `validation.ts` as one small function per rule collected in an array, commit `feat(domain): frame validation rules`.

- [ ] **Step 10: scanMatching.test.ts**
  - `naturalCompare('img2.jpg','img10.jpg') < 0`, case-insensitive, `'000001.jpg' < '000002.jpg'`.
  - `matchScansToFrames(['b10.jpg','b2.jpg','b1.jpg'], frames 1..3)` → sortIndex 0..2 assigned to frameNo 1,2,3 in natural order (b1,b2,b10).
  - more scans than frames → surplus `frameId: null, frameNo: null`; fewer scans → only first n frames used; deleted frames ignored; frames sorted by frameNo regardless of input order.
  - `shiftAssignments(list, frames, fromSortIndex: 1, direction: 1)`: every assignment with sortIndex ≥ 1 moves to the next frameNo (last one becomes unassigned if no frame left); `direction: -1` moves back, but never below frameNo of the previous assignment (no duplicates: if the target frame is taken, the shift is a no-op and the input is returned unchanged).
  Implement, commit `feat(domain): scan to frame matching`.

- [ ] **Step 11: caption.test.ts** – `DEFAULT_CAPTION_TEMPLATE` is
  ```
  {{filmStock}} · {{camera}} · {{lens}}{{#focal}} @ {{focal}}mm{{/focal}}
  {{#exposure}}{{exposure}}{{/exposure}}{{#filters}} · {{filters}}{{/filters}}
  {{#location}}📍 {{location}}{{/location}}{{#date}} · {{date}}{{/date}}
  {{notes}}
  {{hashtags}}
  ```
  Implement a tiny mustache-like renderer supporting `{{key}}` and `{{#key}}…{{/key}}` (section rendered only when key non-empty) – do not add a dependency. Variables: `filmStock` (`"Kodak Gold 200"`), `camera` (`"Minolta 7000 AF"`), `lens` (`"Minolta AF Zoom 35-70mm f/4"` or `''`), `focal`, `exposure` (`"f/5.6 · 1/125 · P"` – only parts present), `filters` (models joined with `", "`), `location` (`location.name`), `date` (`takenAt` formatted `YYYY-MM-DD` for `en`, `DD.MM.YYYY` for `de`), `notes`, `hashtags` (`#analog #35mm …` from input, default `['#analog', '#35mm', '#filmphotography']` + film maker slug e.g. `#kodakgold200`). Collapse ≥ 3 newlines to 2 and trim. Tests: full frame renders all lines; frame without lens/location omits those parts; custom template works. Commit `feat(domain): caption builder`.

- [ ] **Step 12: append to `index.ts`**: `export * from './shutter'; … './aperture'; './frameDefaults'; './validation'; './scanMatching'; './caption'; './fixtures';` – run root `npm test`, commit `chore(domain): export public API`.

**Done when:** `npm test -w @filmnotes/domain` green, coverage for `validation.ts` and `shutter.ts` ≥ 90 % (`npx jest --coverage` in the package), no `any`.
