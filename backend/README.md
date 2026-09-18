# filmnotes backend (PocketBase)

PocketBase 0.40.x with the filmnotes schema as a versioned JS migration. It stores the synced
copy of rolls, frames, equipment and lab scans; the Expo app works fully offline and only needs
this server for sync, scan storage and export logging.

```
backend/
  pb_migrations/1758150000_init_collections.js   the schema (up + down)
  scripts/fetch-pocketbase.mjs                   provides bin/pocketbase for local dev
  scripts/serve.sh                               local dev server (mise task `backend`)
  test/smoke.test.mjs                            integration test against the real binary
  Dockerfile, docker-compose.yml, .env.example   deployment on the home server
```

`bin/` and `pb_data/` are git-ignored: the binary is fetched, the data is local.

## Collections

`cameras`, `lenses`, `filters`, `flashes`, `film_stocks`, `rolls`, `frames`, `scans`,
`export_logs`. Field names are exactly the camelCase names from
`packages/domain/src/types.ts`, so the sync layer maps records 1:1.

Conventions that apply to all of them:

| field                 | meaning                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                  | PocketBase's 15-char id; clients generate it with `newId()` and send it on create, so records exist offline before they are uploaded |
| `owner`               | relation to `users`, cascade delete; the only real relation in the schema                                                            |
| `deleted`             | soft-delete marker, `null` while the record is alive, so deletions can sync                                                          |
| `clientUpdated`       | the client's own `updated` timestamp, used for last-write-wins; PocketBase's `updated` stays server time                             |
| `created` / `updated` | PocketBase autodate fields (server time)                                                                                             |

References between our own records (`cameraId`, `rollId`, `lensId`, `filterIds`, …) are plain
text ids, **not** PocketBase relations: an offline-created frame must be able to point at an
offline-created roll before either of them reaches the server.

Every collection uses the same API rules:

- list / view / update / delete: `@request.auth.id != "" && owner = @request.auth.id`
- create: additionally `@request.body.owner = @request.auth.id`, so nobody can file a record
  under a foreign owner.

Note that PocketBase applies a list rule as a **query filter**: an anonymous list request is
answered with `200` and an empty page instead of `401`. No data leaks, but clients must not treat
`200` as "authenticated".

Indexes exist on `owner` for every collection and additionally on `frames.rollId`,
`scans.rollId`, `scans.frameId` and `export_logs.frameId`.

`scans.file` is a single-file field (max 50 MB, `image/jpeg|png|tiff|webp`) and is
**protected**: the bytes are only served with a short-lived token from `POST /api/files/token`,
so knowing a file URL is not enough to read someone's scans. The app fetches that token with its
own session (`useFileToken`). Thumbnails are rendered by PocketBase:
`GET /api/files/scans/<recordId>/<fileName>?thumb=200x200&token=<token>`.

## Local development

```bash
npm run fetch-pb -w @filmnotes/backend   # once: provides backend/bin/pocketbase
npm run start:dev -w @filmnotes/backend  # or: mise run backend
```

`fetch-pb` symlinks `$FILMNOTES_PB_BIN` when that points at an executable (the Docker sandbox
ships PocketBase at `/opt/pocketbase/pocketbase`) and otherwise downloads the release matching
your OS/arch. Override the version with `PB_VERSION=0.40.4`.

`mise run backend` calls `scripts/serve.sh`, which serves on `127.0.0.1:8090` (override with
`PB_HTTP`) using `pb_data/` and `pb_migrations/`. `npm run start:dev` is the same thing with
PocketBase's `--dev` logging.

### First run

1. Start the server and open <http://127.0.0.1:8090/_/>.
2. Create the **superuser** (admin UI account) — either through the link the server prints on
   first start, or with
   `backend/bin/pocketbase superuser upsert you@example.com "<password>" --dir backend/pb_data`.
3. In the admin UI create the single **app user** in the `users` collection (email + password).
   That is the account the app logs in with; there is no registration UI, and the app stores the
   token in expo-secure-store (localStorage on web).

Every record the app uploads gets that user as `owner`.

### Changing the schema

Never edit the collections in the admin UI on the server — the schema is versioned. Add a new
file to `pb_migrations/` (`<unixtime>_<what>.js`) with an `up` and a `down` function; it is
applied automatically on the next start. To try a revert locally:

```bash
backend/bin/pocketbase migrate down 1 --dir backend/pb_data --migrationsDir backend/pb_migrations
```

## Tests

```bash
npm test -w @filmnotes/backend
```

`test/smoke.test.mjs` uses `node:test` (not Jest), starts the real binary on a free port with a
throwaway data directory, and checks that the 9 collections exist, that a client-generated id
survives a create, that frames are filterable by `rollId`, that a second user and anonymous
callers see nothing, and that a scan upload returns a servable `200x200` thumbnail. Without
`bin/pocketbase` the test **skips** instead of failing, so a fresh checkout stays green.

## Deployment (home server)

```bash
cd backend
cp .env.example .env && $EDITOR .env
docker compose up -d --build
docker compose run --rm filmnotes-pb /pb/pocketbase superuser upsert \
  "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD" --dir /pb/pb_data
```

The image downloads PocketBase for the build platform's `TARGETARCH` and copies `pb_migrations`
in; migrations run on every container start, so a new schema version ships with a new image.

The service listens on `127.0.0.1:8090` only. Put it behind the existing reverse proxy with TLS
and forward to that port — the app needs the public HTTPS URL, and PocketBase's file and realtime
endpoints need normal proxying (no buffering limits below 50 MB, so uploads are not truncated).

To encrypt the settings table (SMTP/S3 credentials) at rest, set a 32-character
`PB_ENCRYPTION_KEY` in `.env` and uncomment the `command:` block in `docker-compose.yml`. Once
enabled, the key must never be lost: without it PocketBase cannot read its own settings.

### Backups

Everything lives in the `pb_data` volume (SQLite database plus uploaded scans). Either use
PocketBase's own backups (admin UI → Settings → Backups, optionally to S3) or snapshot the
volume:

```bash
docker compose stop filmnotes-pb
docker run --rm -v filmnotes_pb_data:/data -v "$PWD":/backup alpine \
  tar czf /backup/filmnotes-pb-$(date +%F).tar.gz -C /data .
docker compose start filmnotes-pb
```

Stopping the container first keeps the SQLite files consistent. Restore by extracting the archive
back into the volume. Check the actual volume name with `docker volume ls` — Compose prefixes it
with the project directory name.

### Upgrading PocketBase

Bump `PB_VERSION` in `docker-compose.yml` (and `PB_VERSION_DEFAULT` in
`scripts/fetch-pocketbase.mjs` so local dev matches), then `docker compose up -d --build`. Back
up the volume first; PocketBase migrates its own system tables on start.
