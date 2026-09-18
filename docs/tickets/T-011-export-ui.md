# T-011 – Export UI

**Wave:** 3
**Depends on:** T-007 (frame screen exists), T-010 (exporters), T-009 (scans for images; optional – export works without image for share text)
**Owns:** `apps/mobile/src/features/export/**`, `apps/mobile/app/export/**`, `apps/mobile/app/settings/wordpress.tsx`

**Goal:** Export one frame or all frames-with-scans of a roll: choose exporter, preview and edit the caption, run the export, store an `ExportLog`, and for the share exporter open the OS share sheet (or copy text + download image on web). WordPress settings screen stores site URL, username and application password (secure store).

**Interfaces consumed:** `listExporters`, `getExporter`, `wordPressExporter`, `shareExporter`, `ExportInput` (T-010); `buildCaption`, `DEFAULT_CAPTION_TEMPLATE` (T-002); `selectEquipmentForCaption`, settings `captionTemplate`, `hashtags`, `wordpress*` (T-005); `SyncClient.fileUrl` + `selectScansForRoll` (T-008/T-009) to fetch scan bytes.

**Interfaces produced:**

```ts
// src/features/export/exportModel.ts (pure)
captionFor(state: AppState, frame: Frame): string | null                     // buildCaption with settings template/hashtags/locale
exportInputFor(state, frame, image: ExportImage | null): ExportInput | null
// src/features/export/loadScanImage.ts
loadScanImage(client: SyncClient, scan: Scan, size: 'full' | '1600'): Promise<ExportImage>   // fetch(fileUrl(… thumb '1600x0')) → bytes
// src/features/export/runExport.ts
runFrameExport(deps: { exporterId; frame; state; config; image; fetch; upsert; now }): Promise<ExportResult>   // writes ExportLog on success
// src/features/export/shareOut.ts
shareOut(payload: { text: string; image: ExportImage | null }): Promise<void>  // native: write image to cache + expo-sharing.shareAsync(uri, {dialogTitle}); text copied with expo-clipboard first. web: navigator.share if available else clipboard + download link
```

## Files

```
src/features/export/i18n.ts (+ export.de.json, export.en.json)
src/features/export/exportModel.ts, exportModel.test.ts
src/features/export/loadScanImage.ts, loadScanImage.test.ts
src/features/export/runExport.ts, runExport.test.ts
src/features/export/shareOut.ts, shareOut.web.ts
src/features/export/ExportFrameScreen.tsx, ExportFrameScreen.test.tsx
src/features/export/ExportRollScreen.tsx, ExportRollScreen.test.tsx
src/features/export/WordPressSettingsScreen.tsx, WordPressSettingsScreen.test.tsx
app/export/frame/[frameId].tsx, app/export/roll/[rollId].tsx, app/settings/wordpress.tsx
```

Dependencies: `expo-sharing`, `expo-clipboard`, `@filmnotes/exporters "*"`.

## Steps

- [ ] **Step 1: exportModel.test.ts** – caption uses custom template/hashtags from settings and `de` date format when locale de; null when roll/camera missing. Implement, commit `feat(app): export input model`.
- [ ] **Step 2: runExport.test.ts** – fake exporter resolves → `ExportLog` upserted with `target`, `externalId`, `url`, `exportedAt = now`; rejects → no log, error propagated. Implement, commit `feat(app): run export and log it`.
- [ ] **Step 3: loadScanImage.test.ts** – mocked fetch returns bytes with content-type; file name derived from scan `fileName`. Implement, commit `feat(app): load scan image for export`.
- [ ] **Step 4: WordPressSettingsScreen.test.tsx** – saves site URL/username to settings, app password to `secureStore`; "Test connection" GETs `/wp-json/wp/v2/users/me` with Basic auth (mocked fetch) and shows the display name or the error. Implement, commit `feat(app): WordPress settings`.
- [ ] **Step 5: ExportFrameScreen.test.tsx** – lists exporters (Share, WordPress); WordPress disabled with hint when not configured; caption preview editable; "Export" with Share calls `shareOut` with text + image (image null when frame has no scan → still allowed); with WordPress calls exporter with config from settings/secure store and shows the resulting link; previous exports listed from `exportLogs`. Implement, commit `feat(app): export frame screen`.
- [ ] **Step 6: ExportRollScreen.test.tsx** – lists frames that have an uploaded scan with checkboxes (all selected by default), exporter picker, runs exports sequentially with progress `n / total`, collects failures. Implement, commit `feat(app): export roll screen`.
- [ ] **Step 7: translations + routes** (`export.de.json`: `title: "Exportieren"`, `share: "Teilen (Bild + Text)"`, `wordpress: "WordPress-Entwurf"`, `notConfigured: "WordPress ist nicht eingerichtet."`, …). Commit `feat(app): export routes and translations`.

**Done when:** tests green; integrator manual check: share export copies caption and opens the share sheet on iOS simulator / prints payload on web.
