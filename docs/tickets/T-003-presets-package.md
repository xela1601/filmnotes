# T-003 – Presets package (`@filmnotes/presets`)

**Wave:** 1
**Depends on:** T-001 (types only)
**Owns:** `packages/presets/**`

**Goal:** Versioned JSON presets for the owner's Minolta 7000 AF kit and a catalogue of common 135 film stocks, plus a loader that turns them into `SyncedRecord`s for seeding the app store and the backend. Schema-validated by tests so JSON typos fail CI.

**Interfaces produced:**

```ts
// packages/presets/src/index.ts
interface PresetBundle {
  id: string;                 // 'minolta-7000af-kit'
  name: string;               // 'Minolta 7000 AF – Familienausrüstung'
  version: number;            // bump when data changes
  cameras: PresetRecord<Camera>[];   // records carry a stable 15-char id but no sync fields
  lenses: PresetRecord<Lens>[];
  filters: PresetRecord<Filter>[];
  flashes: PresetRecord<Flash>[];
}
type PresetRecord<T extends SyncedRecord> = Omit<T, 'created' | 'updated' | 'deleted' | 'owner'>;
loadEquipmentPresets(): PresetBundle[]           // all bundles shipped in data/
loadFilmStockPresets(): PresetRecord<FilmStock>[]
materialize<T extends SyncedRecord>(record: PresetRecord<T>, now: ISODateTime, owner?: Id | null): T
seedRecords(now: ISODateTime): { cameras: Camera[]; lenses: Lens[]; filters: Filter[]; flashes: Flash[]; filmStocks: FilmStock[] }
```

## Files

```
packages/presets/package.json        name @filmnotes/presets, dependency "@filmnotes/domain": "*"
packages/presets/tsconfig.json       extends base, references ../domain
packages/presets/jest.config.js      displayName 'presets', preset ts-jest
packages/presets/data/minolta-7000af-kit.json
packages/presets/data/film-stocks.json
packages/presets/src/index.ts
packages/presets/src/schema.ts       zod schemas mirroring the domain types
packages/presets/src/presets.test.ts
packages/presets/src/data.test.ts
```

Add `zod` (^3.23) as dependency of this package.

## Data content

**`minolta-7000af-kit.json`** – transcribe `Minolta_7000_AF_Preset.md` §9 into the domain shapes. Stable ids (exactly 15 chars, lowercase alnum):

| record                           | id                |
| -------------------------------- | ----------------- |
| camera Minolta 7000 AF           | `cam0minolta7000` |
| lens AF Zoom 35-70 f/4           | `lens0min3570f40` |
| lens AF 50 f/1.7                 | `lens0min50f1700` |
| lens AF Zoom 70-210 f/4          | `lens0min70210f4` |
| flash Program Flash 2800 AF      | `flash0min2800af` |
| filter Hama UV 390 49 (on 35-70) | `filt0hamauv49a0` |
| filter Hama UV 390 49 (on 50)    | `filt0hamauv49b0` |
| filter Hama UV 390 55            | `filt0hamauv5500` |
| filter Kenko Skylight 49         | `filt0kenkosky49` |
| filter Kenko PL linear 49        | `filt0kenkopl490` |
| filter Kenko Center Focus 49S    | `filt0kenkocf490` |
| filter Kenko Two Field Focus 49S | `filt0kenkotff49` |

Camera fields: `exposureModes ['P','A','S','M']`, shutter lists and `bulbOnlyInModes ['M']` as in the source, `exposureCompensation {min:-4,max:4,step:0.5,notInModes:['M']}`, `iso {min:25,max:6400,stepEv:0.333,dxAuto:true}`, `focusModes ['AF','M']`, `driveModes ['S','C','ST']`, `flashSync '1/100'`, `metering 'TTL center-weighted'`, `conditionNotes` (3 entries from source), `defaultsForNewFrame {exposureMode:'P', driveMode:'S', focusMode:'AF', exposureCompensationEv:0, programShift:false, aeLock:false, lensId:'lens0min3570f40', filterIds:['filt0hamauv49a0'], flashId:null, support:'handheld'}`. Lenses: aperture lists, threads (49/49/55), `handheldMinShutter` `'1/60'`,`'1/60'`,`'1/250'`, `hasHood` only for 70-210, `defaultFilterIds` per source. Filters: `afCompatible` `'yes'|'no'|'limited'`, Kenko PL `exposureFactorEv 1.5`, `warning` text in English ("Autofocus of the 7000 AF does not work with a linear polarizer"), `mountedOnLensId` for the three UV filters.

**`film-stocks.json`** – ids `film0` + 10 chars, e.g. `film0kodakgold2`. Entries (name, maker, iso, process, color, exposures 36, dxCoded true unless noted):
Kodak Gold 200 · Kodak ColorPlus 200 · Kodak Ultramax 400 · Kodak Portra 400 · Kodak Portra 160 · Kodak Ektar 100 · Fujifilm 200 · Fujifilm 400 · CineStill 400D · CineStill 800T · Ilford HP5 Plus 400 (BW) · Ilford FP4 Plus 125 (BW) · Ilford Delta 400 (BW) · Kentmere Pan 400 (BW) · AgfaPhoto APX 100 (BW) · AgfaPhoto APX 400 Professional (BW, `dxCoded: null`, notes "verify ISO in LCD after loading") · Fomapan 200 Creative (BW) · Fomapan 400 Action (BW) · Wolfen NC200 · Wolfen NC500 · Kodak Ektachrome E100 (E6) · Fujifilm Velvia 50 (E6).

## Steps

- [ ] **Step 1: package files** (mirror T-001's domain package; `"dependencies": {"@filmnotes/domain": "*", "zod": "^3.23.8"}`). `npm install` at root. Commit `chore(presets): add package skeleton`.
- [ ] **Step 2: schema.ts with zod schemas** for `PresetRecord<Camera|Lens|Filter|Flash|FilmStock>` and `PresetBundle`; export `ID_SCHEMA = z.string().regex(/^[a-z0-9]{15}$/)`.
- [ ] **Step 3: data.test.ts (failing)** – loads both JSON files with `require`, parses with the schemas (`safeParse` → `expect(result.success).toBe(true)` and print `result.error` on failure), asserts: all ids unique across the bundle; every `defaultFilterIds`, `mountedOnLensId`, `defaultsForNewFrame.lensId/filterIds` reference existing ids; each filter's `threadMm` equals the `filterThreadMm` of `mountedOnLensId` when set; at least 20 film stocks; `Kodak Gold 200` exists with `iso 200, process 'C41', color true`.
- [ ] **Step 4: write the JSON data** until the test passes. Commit `feat(presets): Minolta 7000 AF kit and film stock catalogue`.
- [ ] **Step 5: presets.test.ts (failing)** – `loadEquipmentPresets()` returns 1 bundle with 1 camera, 3 lenses, 7 filters, 1 flash; `materialize(rec, now)` adds `created=updated=now, deleted=null, owner=null`; `seedRecords(now).filmStocks.length ≥ 20`; every seeded record satisfies `ID_PATTERN`.
- [ ] **Step 6: implement index.ts** (`import kit from '../data/minolta-7000af-kit.json'` needs `resolveJsonModule`, already in base tsconfig). Run, commit `feat(presets): loader and seed helpers`.

**Done when:** `npm test -w @filmnotes/presets` green; `npx tsc -p packages/presets --noEmit` clean.
