# Analogue Photography Notes – Design Spec

**Date:** 2026-09-18
**Status:** approved by owner (delegated: open details decided by the implementing agent and recorded here)
**Working title:** `filmnotes` (repo: `analogue_photography`)

## 1. Purpose

A minimalist app (Android, iOS, web) to record, per frame of an analogue film roll, which equipment and settings were used plus free-form context (place, time, notes). When the developed roll comes back as scans, the scans are attached to the recorded frames and can be exported – initially to a WordPress blog and as a "share package" for social media.

Primary user: the owner (single user, several devices). The design must not preclude multi-user or open-source use later, but no multi-user features are built now.

## 2. Requirements (from the owner's answers)

| Topic                 | Decision                                                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Platforms             | Android, iOS, web from one code base                                                                                                                                                 |
| Stack                 | Expo (React Native) + TypeScript                                                                                                                                                     |
| Data                  | Offline-first on device, sync through a self-hosted backend                                                                                                                          |
| Backend               | PocketBase (single binary, SQLite, file storage, REST API, runs in Docker)                                                                                                           |
| Users                 | One user for now; schema keeps an `owner` relation so multi-user can be added                                                                                                        |
| Scan source           | Unknown yet (roll not developed). Support folder/ZIP import from local files; lab APIs can be added later behind the same import interface                                           |
| Scan → frame matching | Automatic by sorted filename onto frames 1..n, then manual correction screen                                                                                                         |
| Export targets        | 1) WordPress via REST API (draft post + media upload), 2) share package (resized image + caption text) via OS share sheet / clipboard. Exporter interface must allow further targets |
| Language              | Code, docs, commits, tickets in English. UI i18n with German (default) and English                                                                                                   |
| Development           | TDD, semantic commits, several AI agents in parallel (one ticket each), all commands inside the Claude Code sandbox                                                                  |
| Initial data          | Owner's Minolta 7000 AF kit from `Minolta_7000_AF_Preset.md`, extensible with own equipment                                                                                          |

### 2.1 Core scenario (must work end to end)

1. User takes a photo with the Minolta, opens the app.
2. Creates a new roll: picks film stock from presets (e.g. Kodak Gold 200), camera (Minolta 7000 AF), exposures (36), ISO set (DX 200).
3. Adds the first frame: frame number 1 is proposed, defaults from the camera preset (P mode, 35-70 lens, UV filter, AF, drive S, handheld).
4. Edits the frame's metadata: exposure mode, shutter, aperture, focal length, filters, flash, light, subject, location, time, notes. Plausibility warnings are shown inline (e.g. polarizer + AF).
5. Weeks later: roll is marked as developed, scans are imported from a folder/ZIP, auto-matched, corrected where needed.
6. Frames with scans are exported: WordPress draft post, or share package for Instagram/Mastodon.

## 3. Architecture

Monorepo with npm workspaces. Pure TypeScript logic is separated from UI so it can be unit-tested without React Native and so agents can work on separate packages without conflicts.

```
analogue_photography/
├── apps/
│   └── mobile/            Expo app (iOS, Android, web) – expo-router, UI, store, sync, exporters UI
├── packages/
│   ├── domain/            Pure TS: types, validation rules, shutter/aperture helpers, scan matching, caption builder
│   ├── presets/           JSON presets (equipment + film stocks) + loader + schema tests
│   └── exporters/         Exporter interface + WordPress exporter + share-package builder (pure logic, no RN)
├── backend/
│   ├── pb_migrations/     PocketBase JS migrations (collections/schema)
│   ├── pb_hooks/          PocketBase JS hooks (optional, e.g. thumbnails)
│   ├── Dockerfile
│   ├── compose.yaml
│   └── test/              Integration smoke tests against a locally started PocketBase binary
├── tools/
│   └── scan-import/       CLI: import a folder/ZIP of scans for a roll (uses packages/domain + PocketBase SDK)
├── docs/
│   ├── superpowers/specs/ This document
│   ├── tickets/           One markdown file per ticket
│   └── workflow.md        The owner's routine: shooting → notes → lab → import → export
├── Minolta_7000_AF_Preset.md   Source document for the initial preset
└── prompt.md                   Original project brief
```

### 3.1 Data model

All ids are client-generated 15-character lowercase alphanumeric strings (PocketBase default id format), so records can be created offline and pushed later without id remapping. Every synced record carries `created`, `updated` (ISO timestamps set by the client, server keeps its own too) and `deleted` (nullable timestamp, soft delete).

Equipment is user data (so it is extensible in the app), seeded from `packages/presets` on first launch.

```
Camera   { id, make, model, aliases[], format, mount, exposureModes[], shutterSpeedsManual[],
           shutterSpeedsAutoExtra[], bulbOnlyInModes[], apertureStep, exposureCompensation{min,max,step,notInModes[]},
           iso{min,max,stepEv,dxAuto}, focusModes[], driveModes[], flashSync, metering, notes, conditionNotes[] }
Lens     { id, make, model, focalMinMm, focalMaxMm, maxAperture, minAperture, apertureValues[],
           filterThreadMm, minFocusM, macroNote, weightG, defaultFilterIds[], handheldMinShutter, hasHood }
Filter   { id, make, model, threadMm, type, exposureFactorEv, afCompatible: 'yes'|'no'|'limited', warning?, mountedOnLensId? }
Flash    { id, make, model, guideNumberIso100M, powerLevels[], headPositions[], afIlluminator, sync }
FilmStock{ id, name, maker, iso, process: 'C41'|'BW'|'E6', exposures?: 24|36, dxCoded?: boolean, color: boolean, notes? }
Roll     { id, cameraId, filmStockId, isoSet, isoSource: 'DX'|'manual', exposures: 24|36, pushPullEv,
           status: 'loaded'|'shot'|'at_lab'|'developed'|'archived', loadedAt, unloadedAt?, lab?, scanNotes?, notes? }
Frame    { id, rollId, frameNo, takenAt, lensId?, focalLengthMm?, exposureMode?, shutterSpeed?, aperture?,
           exposureCompensationEv, programShift, aeLock, focusMode?, afResult?, driveMode?, flashId?, flashHead?,
           flashPower?, flashOk?, filterIds[], lensHood, support?, beepWarning, light?, subject?,
           location?: { name?, lat?, lon? }, notes }
Scan     { id, rollId, frameId?, fileName, sortIndex, file (PocketBase file field), width?, height?, importedAt }
ExportLog{ id, frameId, target: 'wordpress'|'share'|..., externalId?, url?, exportedAt }
```

Frame defaults for a new frame come from `Camera`-preset defaults (`defaultsForNewFrame`) and from the previous frame of the same roll (lens, filters, mode carry over – the common case is "same setup as last shot").

### 3.2 Domain rules (packages/domain, all unit-tested)

Validation returns a list of `{ level: 'error'|'warning'|'info', code, messageKey, params }`. UI renders them via i18n. Rules from the preset document:

1. `bulb` only in mode M (error).
2. Aperture must be in the selected lens's `apertureValues` (error).
3. Filter thread must equal lens filter thread (error).
4. Linear polarizer + focus mode AF → warning (AF does not work).
5. Flash + mode M + shutter shorter than sync → info "camera forces 1/100".
6. Exposure compensation ≠ 0 in M → info "has no effect".
7. Shutter slower than lens `handheldMinShutter` while support = handheld → warning (shake).
8. Focal length within lens range (error).
9. Frame number within 1..roll.exposures and unique per roll (error).
10. Shutter speed must be in the camera's manual list for S/M, manual+auto lists for P/A (error).

Helpers: parse/format shutter speeds (`"1/125"`, `"2\""`, `"bulb"`), compare shutter durations, list valid apertures for a lens, list shutter speeds for a camera+mode, `matchScansToFrames(scans, frames)` (natural sort by filename, assign to frames ordered by frameNo, surplus scans unassigned), `buildCaption(frame, roll, equipment, template)`.

### 3.3 App (apps/mobile)

- **Routing:** expo-router. Screens: Rolls list → Roll detail (frames list, roll actions) → Frame edit; Roll create/edit; Scan import & review (roll level); Export (frame level and roll level multi-select); Equipment (list/edit per type); Settings (server URL, auth, WordPress credentials, language).
- **State:** Zustand store with `persist` middleware (AsyncStorage on native, localStorage on web). Holds all entities as normalised maps plus an **outbox** of pending changes. Data volume is small (hundreds of frames), so no SQLite is needed. Selectors and reducers are pure functions with unit tests.
- **Sync (`apps/mobile/src/sync`)**: push outbox entries to PocketBase (create/update by id, soft delete), then pull `updated > lastSyncAt` per collection; last-write-wins by `updated`. Manual "Sync now" plus automatic sync on app foreground when a server is configured. Works without server (local only) – server is optional.
- **Scan import UI**: pick files (expo-document-picker, multiple) or a ZIP (unzipped in-app with `fflate`); preview matched pairs (thumbnail + frame notes); actions: shift assignment up/down, unassign, assign to specific frame; upload to PocketBase `scans` (files live only on the server; the app caches thumbnails by URL). Import requires a configured server because files are stored there.
- **Export UI**: choose exporter, preview caption, send. Export log is stored per frame.
- **i18n**: i18next + react-i18next, `de` (default) and `en`, `expo-localization` for the initial choice; overridable in settings.
- **Location/time**: `takenAt` defaults to now, editable. Location is a free-text name plus optional coordinates via one "use current position" button (expo-location, permission on demand only).
- **Design**: minimalist, high contrast, large tap targets (used in the field). Light/dark following the system.

### 3.4 Backend (backend/)

PocketBase ≥ 0.40 in Docker. Collections created through JS migrations (`pb_migrations/*.js`) so the schema is versioned. Collections: `cameras`, `lenses`, `filters`, `flashes`, `film_stocks`, `rolls`, `frames`, `scans`, `export_logs`. Each has an `owner` relation to `users` (nullable now, filled with the single user), API rules restricted to `@request.auth.id != "" && owner = @request.auth.id`.

Auth: single PocketBase user created by the owner in the admin UI; the app logs in with email/password (token stored in expo-secure-store; on web in localStorage). No registration UI.

Deployment: `compose.yaml` with a named volume for `pb_data`, intended for the owner's home server behind the existing reverse proxy. Development/integration tests run the PocketBase binary directly (downloaded to `backend/bin/`, git-ignored) because Docker is not available inside the sandbox.

### 3.5 Exporters (packages/exporters)

```ts
interface Exporter {
  id: string;                                  // 'wordpress' | 'share' | ...
  nameKey: string;                             // i18n key
  configSchema: ZodSchema;                     // what settings it needs
  exportFrame(input: ExportInput, config): Promise<ExportResult>;
}
ExportInput  = { frame, roll, equipment, caption, image: { bytes, mimeType, fileName } }
ExportResult = { externalId?, url?, sharePayload?: { text, imageUri } }
```

- **WordPress**: Application Password auth (Basic). `POST /wp-json/wp/v2/media` (image, alt text, caption), then `POST /wp-json/wp/v2/posts` with `status: 'draft'`, title, content (figure + metadata table + notes), optional category/tags from settings. Pure `fetch`, testable with a mocked fetch.
- **Share package**: builds caption text from a template (film, camera, lens, aperture/shutter, location, notes, hashtags) and hands image + text to `expo-sharing` / `navigator.share` / clipboard in the app layer. The package only builds the payload.

### 3.6 Scan-import CLI (tools/scan-import)

`npx filmnotes-import --roll <rollId> <folder|zip>`: same matching logic, uploads via PocketBase JS SDK, prints the proposed mapping and asks for confirmation. Serves the "routine workflow" from the desktop and is a fallback if in-app upload is inconvenient. Lower priority than the in-app import.

## 4. Testing strategy (TDD)

- `packages/*`: Jest + ts-jest, pure unit tests. Coverage target ≥ 90 % for domain rules.
- `apps/mobile`: jest-expo + @testing-library/react-native for store logic, hooks, and key screens (roll creation, frame editing, validation display). Sync tested with a fake PocketBase client.
- `backend`: integration smoke test: start PocketBase binary on a random port with the migrations, create a user, create roll + frame via REST, assert API rules. Skipped automatically if the binary is missing.
- Every ticket: tests first, then implementation, then `npm test` at the root must be green before commit.

## 5. Development workflow for agents

- One ticket = one branch `ticket/T-00X-slug` in its own git worktree; the agent works only inside the files listed in the ticket's "Owns" section; shared files (`package.json` at root, lockfile) are changed only by the scaffold ticket or by the integrator.
- Conventional commits (`feat(domain): ...`, `test(app): ...`, `chore: ...`), small and per TDD step where sensible.
- Integrator (main session) merges finished branches into `main` in dependency order, runs the full test suite, resolves conflicts.
- All commands run inside the Claude Code sandbox; npm uses the project-local cache (`.npmrc`).

## 6. Out of scope (for now)

Multi-user UI, registration, lab APIs (none public), Instagram/Facebook Graph API, EXIF writing into scans, RAW/TIFF processing, light-meter features, push notifications.

## 7. Decisions made without the owner (recorded for review)

- Zustand + persist instead of SQLite: data is small, simpler to test, works identically on web.
- PocketBase over Supabase: one binary, SQLite, file storage and auth included, trivial to self-host in Docker.
- Client-generated 15-char ids to allow offline creation.
- Server is optional: the app is fully usable locally; sync, scan storage and export need the server/network.
- WordPress posts are created as drafts; publishing stays a manual step in WordPress.
- Film stock catalogue seeded with common 135 films available in German drugstores/online labs (Kodak Gold 200, ColorPlus 200, Ultramax 400, Portra 400, Fujifilm 200/400, Ilford HP5 Plus 400, FP4 Plus 125, Kentmere 400, AgfaPhoto APX 100/400, Fomapan 200/400, Wolfen NC200/NC500, CineStill 400D/800T). All editable.

### 7.1 Added during implementation (2026-09-18)

- **mise-en-place for CLI tooling** (owner's request during the run): `mise.toml` pins Node and holds
  the tasks (`install`, `test`, `test:backend`, `test:all`, `typecheck`, `check:web`, `import`, `web`,
  `backend`). Inside the Docker sandbox they run through `sandbox/mise` – `$HOME` is read-only there
  and tool extraction fails on the virtiofs bind mount, so mise's data dirs go to `$TMPDIR`.
- **Sandbox proxy relay** (`sandbox/proxy/`): the sandbox proxy demands Basic auth on `CONNECT`, which
  npm cannot send. Every network command is prefixed with `sandbox/proxy/with-proxy.sh`.
- **Web persistence uses `localStorage` directly** (`src/store/persistStorage.web.ts`) instead of
  AsyncStorage's web shim: one indirection less on the platform whose storage API is synchronous.
- **The server password is kept in secure storage**, not only the token, so an expired token is renewed
  without asking again. If that is not wanted, `useSync` needs a "log in again" state instead.
- **WordPress metadata labels stay English.** The post is public blog content, so its language should
  follow the blog, not the phone's UI language. Configurable labels would be an optional
  `labels` map on `WordPressConfig`.
- **Frame numbers, focal lengths:** the quick-select marks for the 70-210 include 135 mm although the
  lens barrel is engraved 70/100/150/210 – on a zoom every intermediate setting is real.
- **HEIC:** the in-app import accepts `.heic/.heif` from a ZIP, but the server's `scans.file` field
  allows only jpeg/png/tiff/webp, so such a file fails loudly on upload instead of being skipped.
- **ESLint + Prettier** (owner's decision after the first review round): ESLint 10 flat config at
  the repo root, type-aware `typescript-eslint` for `packages/*`/`tools/*`, `eslint-config-expo` for
  the app, Prettier for the layout with `eslint-config-prettier` between them. Style: double quotes,
  semicolons, two spaces, 100 columns. `unbound-method` is off inside the app because selecting a
  zustand action (`useStore((s) => s.upsert)`) trips it in every screen. The adoption commit
  reformats the whole repository once; `git log --first-parent` stays readable, `git blame -w` skips
  it.
- **Screenshot tour** (`apps/mobile/e2e/tour.mjs`): the scenes are defined once and run through two
  drivers – jsdom (`tour-jsdom.mjs`, no pictures, works everywhere) and Playwright/Chromium
  (`screenshots.mjs`, writes `docs/screenshots/{light,dark}/`). The development sandbox cannot start
  a browser (`socket(AF_UNIX)` is denied), so the jsdom run is what guards the tour in CI and the
  pictures are taken on the host.

### 7.2 Added during the first review round (2026-09-18)

- **Credentials live in a `.env` file** (`.env.example` documents every variable). The CLI reads it
  with Node's own `process.loadEnvFile`; `FILMNOTES_ENV_FILE` points at a file outside the
  repository, which is how the credentials stay out of the bind-mounted Docker Sandbox. The app's
  own secrets stay in the device keychain - an Expo bundle ships to a device, so there is no
  build-time environment that could hold them safely.
- **All timestamps are shown and entered in local time** (`packages/domain/src/localTime.ts`).
  Stored data stays ISO/UTC. The caption and the WordPress post date a frame by its _local_
  calendar day, which is what the photographer means by "the 19th".
- **The exposure is recorded in every mode**, with the label saying whether the camera or the
  photographer chose the value. The alternative (hiding the field the camera controls) lost
  exactly the information the Minolta displays.
- **`scans.file` is protected** (migration 1758600000): the record was owner-only, the bytes were
  not. Images now need a short-lived file token.
- **The sync watermark comes from the data**, never from a device clock, because PocketBase
  filters against its own `updated` column.
- **`Roll.labOrderId`** (owner's decision): the lab's order number on the roll record, which is what
  ties a delivery to a roll. The scan import accepts an http(s) URL as its source, so the lab's
  download link can be imported directly - by hand or from the optional n8n workflow in
  `automation/n8n/`. The CLI stays the only uploader; n8n does transport and notification
  (`docs/automation.md`).
- **The frame editor is compact by default** (owner's decision): mode, time, aperture and the notes
  are on the screen, everything else is behind one remembered "Mehr Details" switch. It only works
  because a new frame inherits the whole setup from the previous one - the two decisions belong
  together. An error opens the details by itself, because the field that blocks saving is usually
  among them.
- **A new frame carries the last used values over** (owner's decision): not just the setup but the
  exposure (time, aperture, compensation) and the context (subject, location) too. What stays empty
  is what was observed about the previous frame (AF result, flash ok, beep, notes); what is reset is
  what the camera resets itself (program shift, AE lock). The trade-off is deliberate: a forgotten
  exposure compensation now follows you down the roll, which is what the camera does as well.
- **The frame editor is compact by default** (owner's decision): mode, time, aperture and the notes
  are on the screen, everything else is behind one remembered "Mehr Details" switch. It only works
  because a new frame inherits the whole setup from the previous one - the two decisions belong
  together. An error opens the details by itself, because the field that blocks saving is usually
  among them.
- **A new frame carries the last used values over** (owner's decision): not only the setup but the
  exposure (time, aperture, compensation) and the context (subject, location). Empty again is what
  was observed about the previous frame (AF result, flash ok, beep, notes); reset is what the camera
  resets itself (program shift, AE lock). The trade-off is deliberate: a forgotten compensation now
  follows you down the roll - exactly as it does on the camera.
- **Found by driving the exported bundle in a real browser** (and by nothing else): an
  `Intl.DateTimeFormat` with the runtime's own `Etc/Unknown` threw a `RangeError` and took the whole
  app down at boot, and the modal picker had no `ScrollView`, so the last of the Minolta's 18
  shutter speeds - "bulb" - could not be reached on a phone screen. Both fixed; the tour is what
  keeps them fixed.
- **@eslint-react replaces eslint-plugin-react** in the app: the latter has no ESLint 10 release
  (jsx-eslint/eslint-plugin-react#4018). `eslint-config-expo` keeps providing the RN globals,
  import resolution and `react-hooks`.

- **Not built, worth knowing:** no settings UI for the caption template and hashtags (the store fields
  exist and the exporters read them), no dedicated "handed to lab" date (goes into the roll notes), no
  caption editing on the roll-level export screen, and export history only on the frame export screen.
