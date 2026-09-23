# T-009 – Scan import & review UI

**Status:** delivered. Verified on 2026-09-23: every file the ticket names exists and the full gate is green (`npm test`, `npm run lint`, `npm run format:check`, `npm run typecheck`).

**Wave:** 3
**Depends on:** T-006 (roll detail link), T-008 (client upload), T-002 (`matchScansToFrames`, `shiftAssignments`)
**Owns:** `apps/mobile/src/features/scans/**`, `apps/mobile/app/scans/**`

**Goal:** From a roll, pick scan files (multiple images or one ZIP), auto-match them to frames by natural filename order, review and correct the mapping side by side with the frame notes, then upload to PocketBase `scans`. Afterwards roll and frame screens can show thumbnails (expose a hook for that).

**Interfaces consumed:** `matchScansToFrames`, `shiftAssignments`, `ScanAssignment` (T-002); `SyncClient.uploadFile/create/fileUrl` via `createPocketBaseClient` (T-008); store `upsert('scans', …)`, `selectScansForRoll`, `selectFramesForRoll` (T-005).

**Interfaces produced:**

```ts
// src/features/scans/pickScans.ts
export interface PickedFile { name: string; uri: string; mimeType: string; size: number; blob?: Blob }
pickScanFiles(): Promise<PickedFile[]>            // expo-document-picker, multiple, images + application/zip
expandZip(file: PickedFile): Promise<PickedFile[]> // fflate.unzip → in-memory blobs (web) / files written to FileSystem.cacheDirectory (native); ignores non-image entries and __MACOSX
// src/features/scans/importModel.ts (pure)
buildAssignments(files: PickedFile[], frames: Frame[]): ScanAssignment[]
moveAssignment(a: ScanAssignment[], frames: Frame[], sortIndex: number, direction: 1 | -1): ScanAssignment[]  // delegates to shiftAssignments
assignTo(a: ScanAssignment[], sortIndex: number, frameId: Id | null): ScanAssignment[]   // explicit pick; unassigns any other scan on that frame
// src/features/scans/uploadScans.ts
uploadScans(deps: { client: SyncClient; ownerId: Id; rollId: Id; files: PickedFile[]; assignments: ScanAssignment[]; upsert; now }): Promise<{ uploaded: number; failed: string[] }>
//  creates Scan record (id = newId(), file null) → uploadFile(scans, id, 'file', …) → upsert local record with returned file name; continues on error.
// src/features/scans/useScanThumb.ts
useScanThumb(frameId: Id): string | null   // url via client.fileUrl(..., '200x200') when server configured and scan uploaded
```

## Files

```
src/features/scans/i18n.ts (+ scans.de.json, scans.en.json)
src/features/scans/pickScans.ts, pickScans.test.ts (fflate zip fixture built in the test)
src/features/scans/importModel.ts, importModel.test.ts
src/features/scans/uploadScans.ts, uploadScans.test.ts
src/features/scans/useScanThumb.ts
src/features/scans/ScanImportScreen.tsx, ScanImportScreen.test.tsx
app/scans/[rollId].tsx → <ScanImportScreen/>
```

Dependencies (add to `apps/mobile/package.json`, use `npx expo install` for expo ones): `expo-document-picker`, `expo-file-system`, `expo-image`, `fflate`.

## Steps

- [x] **Step 1: importModel.test.ts (failing)** – files `['scan_10.jpg','scan_2.jpg','scan_1.jpg']` with frames 1..3 → assignments in natural order; `assignTo(list, 0, frame3.id)` moves scan 0 to frame 3 and unassigns the scan previously on frame 3; `moveAssignment` shifts. Implement, commit `feat(app): scan import model`.
- [x] **Step 2: pickScans.test.ts** – build a zip in the test with `fflate.zipSync({ 'a/1.jpg': bytes, '__MACOSX/._1.jpg': bytes, 'readme.txt': bytes })`; `expandZip` returns exactly one `PickedFile` named `1.jpg` with `mimeType image/jpeg`. Mock `expo-document-picker` for `pickScanFiles` (canceled → `[]`). Implement, commit `feat(app): pick and unzip scan files`.
- [x] **Step 3: uploadScans.test.ts** – fake client records `create` + `uploadFile` calls; 3 files, second upload throws → `uploaded 2`, `failed ['scan_2.jpg']`, local store has 2 scans with `file` set and `frameId` from assignments (unassigned scan gets `frameId null`). Implement, commit `feat(app): upload scans to PocketBase`.
- [x] **Step 4: ScanImportScreen.test.tsx** – no server configured → explanation + link to `/settings/server`; with server: "Pick files" (mocked picker returns 3 files) shows 3 rows `thumbnail | file name | → #frameNo notes…` with ▲/▼/✕ controls; ▼ on row 0 shifts; ✕ unassigns; "Upload" calls `uploadScans` and shows result; roll status is set to `developed` after a successful upload if it was `at_lab`/`shot`. Implement screen (two-column rows: `expo-image` preview from `uri`, frame summary from store, controls). Commit `feat(app): scan import review screen`.
- [x] **Step 5: useScanThumb + translations** (`scans.de.json`: `title: "Scans importieren"`, `pick: "Dateien wählen"`, `upload: "Hochladen"`, `needServer: "Für Scans wird ein konfigurierter Server benötigt."`, …). Commit `feat(app): scan thumbnails and translations`.

**Done when:** tests green; integrator check with the local PocketBase: import a folder of 3 JPEGs for a 3-frame roll, verify files in admin UI and thumbnails on the frame screen (T-007 may read `useScanThumb` in a follow-up – do not edit T-007 files here).
