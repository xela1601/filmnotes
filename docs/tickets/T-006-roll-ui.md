# T-006 – Roll management UI

**Wave:** 2
**Depends on:** T-002, T-003, T-005
**Owns:** `apps/mobile/src/features/rolls/**`, `apps/mobile/app/(tabs)/index.tsx`, `apps/mobile/app/rolls/**`

**Goal:** Create, list, view, edit and archive rolls. Roll detail shows the frame list and offers "Add frame" (creates the frame via `newFrame` and navigates to T-007's edit route `/frames/[frameId]`), "Import scans" (→ `/scans/[rollId]`, T-009) and "Export roll" (→ `/export/roll/[rollId]`, T-011); those links may point to placeholder routes for now.

**Interfaces consumed:** `useStore`, selectors, `ui/*`, `registerFeatureTranslations` (T-005); `newFrame`, `nextFrameNo`, `newId` (T-002/T-001); `FilmStock`, `Camera` presets are already in the store (seeded).

**Interfaces produced:**
```ts
// src/features/rolls/rollForm.ts  (pure)
interface RollFormValues { cameraId: Id | null; filmStockId: Id | null; isoSet: number | null; isoSource: IsoSource; exposures: 24 | 36; pushPullEv: number; loadedAt: ISODateTime; lab: string; notes: string }
defaultRollForm(cameras: Camera[], filmStocks: FilmStock[], now: ISODateTime): RollFormValues   // first camera, no film, 36, DX
applyFilmStock(values: RollFormValues, stock: FilmStock): RollFormValues   // sets filmStockId, isoSet = stock.iso, exposures if stock.exposures
validateRollForm(values: RollFormValues): Partial<Record<keyof RollFormValues, string>>   // error keys: 'required' | 'iso_range'
rollFromForm(values: RollFormValues, existing: Roll | null, now: ISODateTime): Roll
// src/features/rolls/rollLabel.ts
rollTitle(roll: Roll, filmStock: FilmStock | undefined): string    // "Kodak Gold 200 · 2026-09-18"
rollProgress(roll: Roll, frames: Frame[]): { shot: number; total: number }   // "12 / 36"
```

## Files

```
src/features/rolls/i18n.ts (+ rolls.de.json, rolls.en.json)
src/features/rolls/rollForm.ts, rollForm.test.ts
src/features/rolls/rollLabel.ts, rollLabel.test.ts
src/features/rolls/RollForm.tsx, RollForm.test.tsx
src/features/rolls/RollsListScreen.tsx, RollsListScreen.test.tsx
src/features/rolls/RollDetailScreen.tsx, RollDetailScreen.test.tsx
app/(tabs)/index.tsx            → <RollsListScreen/>
app/rolls/new.tsx               → <RollForm mode="create"/>
app/rolls/[rollId].tsx          → <RollDetailScreen/>
app/rolls/[rollId]/edit.tsx     → <RollForm mode="edit"/>
```

## Steps

- [ ] **Step 1: rollForm.test.ts (failing)** – `defaultRollForm` picks first camera, `exposures 36`, `isoSource 'DX'`, `isoSet null`; `applyFilmStock` with Kodak Gold 200 sets iso 200; `validateRollForm` flags missing camera/film/iso as `'required'`, iso outside 6–12800 as `'iso_range'`; `rollFromForm` for create yields `status 'loaded'`, `id` 15 chars, `created === updated === now`; for edit keeps `id`/`created`/`status`. Implement, commit `feat(app): roll form model`.
- [ ] **Step 2: rollLabel.test.ts** – title uses film stock name + `loadedAt` date part; unknown stock → `"Unknown film"` via i18n key passed in (make `rollTitle` take `t`); progress counts active frames. Implement, commit `feat(app): roll labels`.
- [ ] **Step 3: RollForm.test.tsx (failing)** – render with store containing seeded presets; selecting film stock "Kodak Gold 200" (SelectField) fills ISO 200; pressing Save with missing film shows the `required` message and does not add a roll; valid save adds one roll to `useStore.getState().entities.rolls` and calls `router.replace('/rolls/<id>')` (mock `expo-router`). Implement `RollForm.tsx` (fields: camera select, film stock select grouped colour/BW, ISO number, ISO source segmented, exposures segmented 24/36, push/pull number step 1 range −3…+3, loaded date text `YYYY-MM-DD`, lab, notes). Commit `feat(app): create and edit roll screen`.
- [ ] **Step 4: RollsListScreen.test.tsx** – empty state with hint; two rolls sorted newest first showing title, status chip and progress; pressing an item navigates to `/rolls/<id>`; header "+" navigates to `/rolls/new`. Implement, commit `feat(app): rolls list`.
- [ ] **Step 5: RollDetailScreen.test.tsx** – shows roll title, camera, ISO, status; frame list rows `#{frameNo} · {shutter} · f/{aperture} · {notes first 40 chars}`; pressing "Add frame" creates a frame with `frameNo = nextFrameNo` and defaults from the camera (assert `exposureMode 'P'`, `lensId` of 35-70) and navigates to `/frames/<id>`; "Add frame" is disabled when `frames.length >= roll.exposures`; status can be advanced (`loaded → shot → at_lab → developed → archived`) through a SelectField; "Delete roll" asks for confirmation (`Alert.alert` mocked) then soft-deletes roll **and its frames**. Implement, commit `feat(app): roll detail with frame list`.
- [ ] **Step 6: wire routes + translations** (`rolls.de.json`: e.g. `title: "Filme"`, `new: "Neuer Film"`, `addFrame: "Bild hinzufügen"`, `status.loaded: "eingelegt"`, `status.shot: "belichtet"`, `status.at_lab: "im Labor"`, `status.developed: "entwickelt"`, `status.archived: "archiviert"`, …; en accordingly). Run `npm test -w @filmnotes/mobile`. Commit `feat(app): roll routes and translations`.

**Done when:** tests green, `npx tsc -p apps/mobile --noEmit` clean, the core scenario steps 2 and 3 (spec §2.1) work in the web build (`npx expo export --platform web`).
