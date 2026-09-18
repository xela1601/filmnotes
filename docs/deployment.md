# Deployment

The server side of filmnotes is a single PocketBase container on the home server, behind the
reverse proxy that is already there. The app is offline-first, so this is optional — but without
it there is no sync between phone and browser, no scan storage and no export log.

This document is the runbook. The reference for the schema, the API rules and local development
is [`../backend/README.md`](../backend/README.md); it is not repeated here.

```
Phone / browser ──HTTPS──▶ reverse proxy ──HTTP──▶ 127.0.0.1:8090  filmnotes-pb container
                             (existing, TLS)                        └── volume pb_data
                                                                        SQLite + scan files
```

## 1. Prerequisites

- Docker with Compose v2 on the server. **Docker is not available inside the development
  sandbox** — the image is built on the server, and everything in this document runs there.
- A DNS name and a TLS certificate on the existing reverse proxy, e.g. `pb.example.org`.
- The repository checked out on the server (only `backend/` is needed).

HTTPS is not optional in practice:

- the web build is served over HTTPS, and a browser refuses to call an `http://` API from an
  `https://` page (mixed content);
- the phone needs a name that resolves outside the home network, otherwise scans can only be
  uploaded while you are at home;
- PocketBase auth tokens travel in the `Authorization` header on every request.

## 2. Bring the server up

```bash
cd backend
cp .env.example .env && $EDITOR .env      # see the table below
docker compose up -d --build
docker compose logs -f filmnotes-pb       # the migration runs on the first start
```

The image downloads the PocketBase release for the build platform's `TARGETARCH` and copies
`pb_migrations/` in. `docker-compose.yml` publishes the port as `127.0.0.1:8090:8090` **on
purpose**: PocketBase must never be reachable directly from the network. It has a healthcheck on
`/api/health`, so `docker compose ps` shows whether it is actually serving.

### Environment variables

| Variable | Where | Meaning |
|---|---|---|
| `PB_ADMIN_EMAIL` | `backend/.env` | superuser address, used once by the bootstrap command in step 3 |
| `PB_ADMIN_PASSWORD` | `backend/.env` | superuser password, used once in step 3 |
| `PB_ENCRYPTION_KEY` | `backend/.env` | exactly 32 characters (`openssl rand -hex 16`); encrypts the PocketBase settings table (SMTP/S3 credentials) at rest. Only takes effect once the `command:` block in `docker-compose.yml` is uncommented. **Once enabled the key must never be lost** — without it PocketBase cannot read its own settings |
| `PB_VERSION` | `docker-compose.yml` (`build.args`) | the PocketBase release that goes into the image, currently `0.40.4` |
| `PB_HTTP` | local development only | listen address of `backend/scripts/serve.sh`, default `127.0.0.1:8090` |
| `PB_VERSION`, `FILMNOTES_PB_BIN` | local development only | read by `npm run fetch-pb -w @filmnotes/backend` — see `backend/README.md` |

The app itself needs no environment variables: server URL, account and WordPress credentials are
entered in the UI and stored on the device.

### Reverse proxy

Forward the public host to `127.0.0.1:8090` and keep it boring:

- **Body size**: allow at least 50 MB. `scans.file` accepts up to 52 428 800 bytes, and a proxy
  default of 1–10 MB truncates lab scans with an opaque `413`.
- **Timeouts**: an upload of a handful of full-resolution scans over a slow uplink takes a while;
  a 30 s read timeout is not enough.
- Pass `Host` and `X-Forwarded-Proto` through as usual.
- No WebSocket or SSE configuration is needed: the app never subscribes to PocketBase's realtime
  endpoint, it syncs on demand.

### CORS

PocketBase's `serve` defaults to `--origins` = `[*]`, so it answers cross-origin requests from
any host and the web build can be served from a different name than the API without any change.
If you want to narrow it down, uncomment the `command:` block in `docker-compose.yml` and add the
flag to the argument list:

```yaml
      - --origins=https://filmnotes.example.org
```

Native apps are not affected by CORS at all, so this only concerns the web build.

## 3. Create the users

There are two different things called "user":

1. The **superuser** — the admin UI account. Create it once:

   ```bash
   docker compose run --rm filmnotes-pb /pb/pocketbase superuser upsert \
     "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD" --dir /pb/pb_data
   ```

   Then open `https://pb.example.org/_/` and log in.

2. The **app user** — one record in the `users` collection, created by hand in the admin UI
   (Collections → `users` → New record: email + password, "Verified" is not required). There is
   no registration UI; this is the account the app logs in with, and it becomes the `owner` of
   every record. All API rules are `owner = @request.auth.id`, so a second app user would see an
   empty app.

Then, in the app: tab **"Einstellungen" → "Server"**, enter the `https://` URL, e-mail and
password and press **"Verbinden"**. The first sync against an empty server uploads the seeded
equipment and film stocks, so the server is populated by the first device that connects — do not
seed it by hand.

## 4. Hosting the web build

The web app is a static bundle; build it on a machine with the toolchain (not on the server):

```bash
cd apps/mobile
npx expo export --platform web        # writes apps/mobile/dist/
```

Inside the development sandbox it needs a writable home and the proxy wrapper:

```bash
HOME="$TMPDIR/expo-home" ../../sandbox/proxy/with-proxy.sh npx expo export --platform web
```

`app.json` sets `web.output: "single"`, i.e. a single-page app: **every** unknown path must fall
back to `index.html`, or a reload on `/rolls/abc` returns a 404. Copy `dist/` to any web server
that does that (nginx `try_files $uri /index.html;`, Caddy `try_files`, GitHub Pages with a
404 fallback, …).

PocketBase can serve it itself — `serve` has `--publicDir` (default `pb_public` next to the
binary) and `--indexFallback` is on by default, which is exactly the SPA rule. The shipped
`docker-compose.yml` does **not** mount such a directory, so if you want that, add a bind mount
and copy the build in:

```yaml
    volumes:
      - pb_data:/pb/pb_data
      - ./web:/pb/pb_public:ro     # then: rsync -a apps/mobile/dist/ server:backend/web/
```

That serves app and API from one origin, which also makes the CORS question disappear.

## 5. Updating PocketBase

Migrations are applied automatically (`--automigrate` defaults to true), so a schema change ships
with a new image and needs no manual step.

1. Back the volume up first (§6).
2. Bump `PB_VERSION` in `backend/docker-compose.yml` — both under `build.args` and in the `image:`
   tag — and `PB_VERSION_DEFAULT` in `backend/scripts/fetch-pocketbase.mjs`, so local development
   uses the same release.
3. `docker compose up -d --build`, then `docker compose logs -f filmnotes-pb`.

PocketBase migrates its own system tables on start; watch the log for migration errors before
declaring it done. Never edit collections in the admin UI on the server — the schema is versioned
in `backend/pb_migrations/`, and the next image build would overwrite the difference.

## 6. Backup and restore

Everything is in the `pb_data` volume: the SQLite database *and* the uploaded scan files. The
scans exist nowhere else — the app only caches thumbnails by URL — so this is the one backup that
matters.

Either use PocketBase's own backups (admin UI → Settings → Backups, with an optional S3 target
and a schedule), or snapshot the volume:

```bash
cd backend
docker compose stop filmnotes-pb
docker run --rm -v filmnotes_pb_data:/data -v "$PWD":/backup alpine \
  tar czf /backup/filmnotes-pb-$(date +%F).tar.gz -C /data .
docker compose start filmnotes-pb
```

Stopping the container first keeps the SQLite files consistent. Check the real volume name with
`docker volume ls`: Compose prefixes it with the project directory name.

### Restore

```bash
cd backend
docker compose down                                    # container gone, volume kept
docker run --rm -v filmnotes_pb_data:/data alpine sh -c 'rm -rf /data/* /data/..?* 2>/dev/null'
docker run --rm -v filmnotes_pb_data:/data -v "$PWD":/backup alpine \
  tar xzf /backup/filmnotes-pb-2026-09-18.tar.gz -C /data
docker compose up -d
```

Restoring an archive that was taken with an older PocketBase release is fine — the container
migrates on start. Restoring a *newer* one into an older image is not.

A backup made through the admin UI is restored through the admin UI (Settings → Backups → the
restore action), which is the easier path if the server still starts.

After a restore the devices are ahead of the server for everything they changed in the meantime.
Sync resolves that by last-write-wins on `clientUpdated`, so open the app on every device and run
**"Jetzt synchronisieren"** once; local changes win over the older restored copies.

## 7. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| App shows **"Anmeldung fehlgeschlagen. Adresse und Zugangsdaten prüfen."** | Wrong URL, wrong password, or the URL is not reachable. Check `https://<host>/api/health` in a browser first |
| Sync fails after weeks of not using the app (`401`) | The stored auth token expired. The app validates it with `authRefresh` and, if that fails, logs in again with the password it kept on the device — so this normally heals itself. It does not if the password changed on the server: then open "Einstellungen" → "Server" and press **"Verbinden"** again. The user only ever sees **"Synchronisierung fehlgeschlagen."**, never the status code |
| A list request returns `200` with an empty result although data exists | PocketBase applies the list rule as a query filter, so an unauthenticated list is answered with an empty page, not `401`. It means "not logged in", not "no data" |
| Upload of a scan fails with `413` | Proxy body limit below 50 MB — see §2 |
| A `.heic`/`.HEIC` file is rejected | `scans.file` allows `image/jpeg`, `image/png`, `image/tiff` and `image/webp` only. Convert first (`heif-convert`, macOS Preview, or ask the lab for JPEG) |
| Scan import in the app says **"Für Scans wird ein konfigurierter Server benötigt."** | No server configured on that device — the image files live on the server, so import needs one |
| Container restarts in a loop after enabling encryption | `PB_ENCRYPTION_KEY` is not exactly 32 characters, or it changed after the settings were first encrypted |
| `docker compose up` cannot download PocketBase | The build stage fetches the release from `github.com`; the server needs outbound HTTPS to it |

For the day-to-day routine — when sync runs, how to force it, what to do when the lab scans
arrive — see [`workflow.md`](workflow.md).
