# filmnotes

**Per-frame notes for analogue film rolls.** You load a roll into the camera, create it in the
app, and from then on every shot gets a short record: exposure mode, shutter, aperture, lens,
focal length, filters, flash, support, light, subject, place, time and free-form notes. A new
frame starts from the defaults of your camera preset and from the previous frame of the same
roll, so in the field you only change what actually changed. Domain rules check the combination
while you type and warn about the classic mistakes – a linear polarizer with autofocus, a shutter
speed below the lens's handheld limit, bulb outside mode M, an aperture the lens does not have.

Weeks later the lab returns the developed roll as scans. You import the folder or ZIP, the files
are matched onto the frames by natural filename order, you correct the mapping where the lab
dropped a frame, and the images are uploaded. Each frame then carries its notes *and* its scan,
and can be exported: as a WordPress draft post (image + metadata + notes, published by hand in
WordPress) or as a share package (the scan as it is plus a caption built from a template) for
Instagram, Mastodon or anywhere else the OS share sheet reaches. The app is offline-first — it is
fully usable without a server; a self-hosted [PocketBase](https://pocketbase.io) instance is only
needed for sync across devices, for storing the scan files and for export logs.

Runs on Android, iOS and in the browser from one Expo/React Native code base. UI in German
(default) and English; code, docs and commits in English. Single-user by design for now, but the
schema already carries an `owner` relation.

## Screenshots

Not captured yet. When the first roll is shot, take one screenshot per screen (German UI, dark
and light) and add them here:

| Screen | Route | Why |
|---|---|---|
| Roll list | `/` (tab "Filme") | the entry point, progress per roll |
| New roll | `/rolls/new` | film stock and camera presets |
| Roll detail | `/rolls/[rollId]` | frame list, status, roll actions |
| Frame edit | `/frames/[frameId]` | the core screen, with inline warnings |
| Scan import | `/scans/[rollId]` | matched pairs, thumbnail next to the notes |
| Frame export | `/export/frame/[frameId]` | caption preview and target choice |
| Equipment | `/equipment` (tab "Ausrüstung") | the seeded Minolta kit |
| Settings | `/settings` (tab "Einstellungen") | language, server, WordPress |

## Repository layout

```
analogue_photography/
├── apps/
│   └── mobile/            Expo app (iOS, Android, web): expo-router routes in app/,
│                          feature screens in src/features/, store, sync, UI kit, i18n
├── packages/
│   ├── domain/            pure TypeScript: types, validation rules, shutter/aperture
│   │                      helpers, frame defaults, scan matching, caption builder
│   ├── presets/           JSON presets (the Minolta 7000 AF kit + 22 film stocks) + loader
│   └── exporters/         exporter interface, WordPress exporter, share-package builder
├── backend/               PocketBase: versioned JS migrations, Dockerfile,
│                          docker-compose.yml, integration smoke test
├── tools/
│   └── scan-import/       `filmnotes-import` CLI: import a folder/ZIP of lab scans
├── docs/                  spec, tickets, workflow.md, deployment.md
├── Minolta_7000_AF_Preset.md   source document for the initial preset
└── prompt.md                   the original project brief (German)
```

Everything that is not React Native lives in `packages/*` so it can be unit-tested without a
device. npm workspaces, one Jest project per workspace.

## Quick start

Requirements: Node 22 (pinned in `mise.toml`), npm 10+. Git. Nothing else — the PocketBase
binary is fetched by a script, Docker is only needed on the server.

```bash
npm install          # all workspaces
npm test             # every Jest project (domain, presets, exporters, app, CLI)
npm run typecheck    # tsc -b over packages/* and tools/scan-import
```

`npm run typecheck` does not cover the Expo app (it has no composite build); check it with
`npx tsc -p apps/mobile --noEmit`. **ESLint is not set up yet** – no config, no dependency, and
no `lint` script, so nothing pretends to work. `npx expo lint` inside `apps/mobile` is the
shortest way to add it when you want it.

Run the app in a browser:

```bash
npm run web -w @filmnotes/mobile        # Expo dev server, http://localhost:8081
```

For a device or simulator use `npm run ios`, `npm run android` or `npm run start`
(interactive) in `apps/mobile` — see [`apps/mobile/README.md`](apps/mobile/README.md).

Run a local backend (optional — the app works without it):

```bash
npm run fetch-pb -w @filmnotes/backend    # once: provides backend/bin/pocketbase
npm run start:dev -w @filmnotes/backend   # serves 127.0.0.1:8090 with the migrations
npm test -w @filmnotes/backend            # integration smoke test (skips without the binary)
```

Then create the superuser and the single app user as described in
[`backend/README.md`](backend/README.md), and point the app at the URL under
"Einstellungen → Server".

Import lab scans from the desktop instead of the phone:

```bash
npm run import -w @filmnotes/scan-import -- --help
```

### With mise

CLI tooling and the task runner are managed with [mise](https://mise.jdx.dev); `mise.toml` pins
Node and wraps the commands above:

```bash
mise install         # provision the pinned toolchain
mise tasks           # install, test, test:backend, test:all, typecheck, check:web, import, web, backend
mise run test
mise run web         # Expo for the web on port 8081
mise run backend     # local PocketBase on port 8090
```

Inside the Docker Sandbox used for development, call the wrapper `sandbox/mise` instead of
`mise` and prefix every network-touching command with `sandbox/proxy/with-proxy.sh` — see
[`sandbox/README.md`](sandbox/README.md).

## Building for devices

The repository has no `ios/` or `android/` directory: the native projects are generated from
`app.json` (Expo's continuous native generation). From `apps/mobile`:

```bash
npx expo run:ios        # prebuild + build + launch in the iOS simulator (needs Xcode, macOS)
npx expo run:android    # prebuild + build + launch on a device/emulator (needs the Android SDK)
```

Both require a full native toolchain on the host — neither works inside the development sandbox.
Cloud builds with **EAS** are *not* configured yet: there is no `eas.json` and no Expo account is
referenced anywhere. Setting it up means `npx eas-cli@latest login` and `eas build:configure` in
`apps/mobile` (which writes `eas.json`), then `eas build -p ios` / `-p android`. The bundle
identifier and Android package are already fixed as `de.filmnotes.app`.

The web build is a static bundle and needs no toolchain:

```bash
npx expo export --platform web      # writes apps/mobile/dist/
```

See [`docs/deployment.md`](docs/deployment.md) for serving that `dist/` next to the backend.

## Current limits

Worth knowing before you rely on something that is not there:

- **Sync is manual and lives on one screen.** Nothing syncs at app start or in the background;
  open "Einstellungen" → "Server" and press "Jetzt synchronisieren". See
  [`docs/workflow.md`](docs/workflow.md) §6.
- **Scans need the server.** The image files are only ever stored in PocketBase; the app keeps
  thumbnails by URL. No server, no scan import and no export.
- **HEIC is rejected.** The `scans.file` field accepts `image/jpeg`, `image/png`, `image/tiff`
  and `image/webp` only — ask the lab for JPEG or convert first.
- **WordPress posts are drafts, always.** Categories, tags and the published state are not
  settable from the app; publishing is a manual step in WordPress.
- **Two export targets**: WordPress and a share package (clipboard + OS share sheet). No
  Instagram or Mastodon API integration, and no lab API — scans arrive as files.
- **The caption template and the hashtags have no settings screen yet**, although the export
  screen's hint says they come from the settings. The built-in template is used; the text is
  editable per export.
- **No ESLint setup**, no EAS build configuration, no screenshots.
- **Docker is not available in the development sandbox** — the backend image is built on the
  server; local development runs the PocketBase binary directly.

## Documentation

| Document | Content |
|---|---|
| [`docs/workflow.md`](docs/workflow.md) | the routine: loading a roll → shooting → lab → scan import → export → sync/backup |
| [`docs/deployment.md`](docs/deployment.md) | PocketBase on the home server, users, updates, backups, hosting the web build |
| [`docs/superpowers/specs/2026-09-18-analogue-photography-app-design.md`](docs/superpowers/specs/2026-09-18-analogue-photography-app-design.md) | the approved design spec |
| [`docs/tickets/`](docs/tickets/) | the implementation plan, one file per ticket |
| [`apps/mobile/README.md`](apps/mobile/README.md) | app internals: routes, store, i18n, tests |
| [`backend/README.md`](backend/README.md) | collections, API rules, migrations, local PocketBase |
| [`tools/scan-import/README.md`](tools/scan-import/README.md) | the `filmnotes-import` CLI in detail |
| [`sandbox/README.md`](sandbox/README.md) | the Docker Sandbox used for development |
| [`CLAUDE.md`](CLAUDE.md) | conventions for agents working in this repo |

## Licence

MIT — declared in the root `package.json` (a `LICENSE` file has not been added yet). The Minolta
preset document and the photographs are the owner's own material.
