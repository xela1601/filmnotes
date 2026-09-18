# @filmnotes/scan-import

`filmnotes-import` – the desktop side of the lab hand-off. It takes the folder or ZIP the lab
returned, matches the files onto the frames of a roll, shows the proposal, asks once and uploads
the scans to PocketBase.

It is the same matching the app uses (`matchScansToFrames` from `@filmnotes/domain`), so a roll
imported from the terminal looks exactly like one imported on the phone – including the review
screen, where a wrong mapping can still be shifted.

## Usage

```bash
npx filmnotes-import --server <url> --email <address> --roll <rollId> <folder|zip>
```

| Option                | Meaning                                                                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `--server <url>`      | PocketBase base URL, e.g. `https://pb.example.com`                                                                           |
| `--email <address>`   | The app user; it becomes the `owner` of every created scan                                                                   |
| `--password <secret>` | Password. Prefer `FILMNOTES_PASSWORD` or the prompt – a command line is visible in the process list and in the shell history |
| `--roll <rollId>`     | Id of the roll the scans belong to (copy it from the app, 15 characters)                                                     |
| `-y`, `--yes`         | Do not ask for confirmation – for cron-like scripts                                                                          |
| `--dry-run`           | Print the plan and exit without uploading anything                                                                           |
| `-h`, `--help`        | Show the usage                                                                                                               |

`--flag value` and `--flag=value` are both accepted.

| Environment variable | Meaning                                         |
| -------------------- | ----------------------------------------------- |
| `FILMNOTES_PASSWORD` | The password, used when `--password` is omitted |

If neither is set, the CLI asks for the password and does not echo what is typed.

| Exit code | Meaning                                                                                  |
| --------- | ---------------------------------------------------------------------------------------- |
| `0`       | Everything was uploaded (or `--dry-run`, or `--help`)                                    |
| `1`       | The import did not happen (login failed, unknown roll, declined prompt) or a file failed |
| `2`       | A usage mistake; the usage text is printed to stderr                                     |

### Sources

- **Folder** – searched recursively, so the `DCIM/100LAB/` layout of a CD works as it is.
- **`.zip`** – extracted into a temp directory that is removed again at the end.

Accepted extensions are `.jpg`, `.jpeg`, `.png`, `.tif`, `.tiff` and `.webp` (the mime types
PocketBase's `scans.file` field allows); everything else in the source – `index.txt`, thumbnails,
the `__MACOSX` resource forks of a zip – is ignored. Files are ordered like a file browser orders
them, so `img2.jpg` comes before `img10.jpg`.

## The routine: a drugstore CD

```bash
# 1. The roll came back from the lab, its scans are on a CD or a stick.
cp -r /Volumes/PHOTO_CD/DCIM ~/scans/2026-09-kodak-gold-200

# 2. Look up the roll id in the app (roll detail screen) and check the plan first.
export FILMNOTES_PASSWORD='…'          # or let the CLI ask
npx filmnotes-import \
  --server https://pb.example.com \
  --email me@example.com \
  --roll 7t3k9ab12cd34ef \
  --dry-run ~/scans/2026-09-kodak-gold-200

# # | file      | frame        | notes
# --+-----------+--------------+----------------------------
# 1 | img1.jpg  | #1           | Harbour, backlit, polarizer
# 2 | img2.jpg  | #2           | Same spot, one stop down
# 3 | img10.jpg | (unassigned) |

# 3. Looks right? Run it for real (leave out --yes to be asked once).
npx filmnotes-import \
  --server https://pb.example.com \
  --email me@example.com \
  --roll 7t3k9ab12cd34ef \
  --yes ~/scans/2026-09-kodak-gold-200

# 4. Open the roll in the app, correct the mapping if the lab dropped a frame, export.
```

A ZIP works the same way: `… --roll 7t3k9ab12cd34ef ~/scans/roll-2026-09.zip`.

If the lab returned more files than the roll has frames, the surplus is listed as
`(unassigned)`. Those files are uploaded too, with an empty `frameId`, so nothing is lost and
they can be attached to a frame in the app.

## What it writes

One record per file in the `scans` collection, created with a client-generated 15-character id:

| Field                         | Value                                                            |
| ----------------------------- | ---------------------------------------------------------------- |
| `rollId`                      | `--roll`                                                         |
| `frameId`                     | The matched frame, or empty for an unassigned file               |
| `fileName`                    | The name in the source (a repeated base name gets a `-2` suffix) |
| `sortIndex`                   | Position in the natural order, starting at 0                     |
| `file`                        | The uploaded image                                               |
| `importedAt`, `clientUpdated` | Time of the import (UTC)                                         |
| `owner`                       | The user behind `--email`                                        |

`width`/`height` stay empty: the CLI does not decode the images. Existing records are never
touched – the only exception is a record whose file upload failed, which is marked deleted again
so the app never sees a scan without an image. Running the import twice therefore creates a
second set of scans: check with `--dry-run` first.

## Development

```bash
npm test -w @filmnotes/scan-import      # unit tests (no server needed)
npm run build -w @filmnotes/scan-import # tsc -b: type check plus declarations in dist/
npm run import -w @filmnotes/scan-import -- --help
```

The binary (`bin/filmnotes-import.cjs`) registers [tsx](https://tsx.is) and runs `src/cli.ts`,
because the workspace packages of this monorepo are source packages: `@filmnotes/domain` points
its `main` at `src/index.ts` with extensionless, bundler-style imports, which plain Node cannot
load. `npx tsx src/cli.ts …` does the same thing directly.

The modules are kept small and side-effect free on purpose: `args.ts` (command line), `files.ts`
(folder/zip), `plan.ts` (matching and the table), `upload.ts` (PocketBase writes), `main.ts` (the
flow, with the terminal and the server injected) and `cli.ts`/`pb.ts` (the real wiring, the only
place that touches the ESM-only `pocketbase` SDK).

Against a local backend from `backend/`:

```bash
npm run fetch-pb -w @filmnotes/backend && backend/scripts/serve.sh   # 127.0.0.1:8090
npx filmnotes-import --server http://127.0.0.1:8090 --email … --roll … --dry-run ./scans
```
