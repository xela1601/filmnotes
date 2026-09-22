# T-015 – Frame metadata into the scan files (EXIF/XMP)

**Wave:** backlog (nothing depends on it, it depends on everything that exists)
**Depends on:** T-002 (domain records, `parseShutterSpeed`, `localTime`), T-009/T-013 (the scans and
their frame assignment), T-010/T-011 (the export path the files leave through)
**Owns:** `packages/domain/src/frameMetadata.ts` (+ test), `tools/scan-import/src/tag.ts` (+ test),
the tagging seam in `packages/exporters/**`

**Goal:** What the photographer wrote down in the field ends up _in the picture_. A scan that leaves
filmnotes — downloaded, shared, or posted to WordPress — carries camera, lens, exposure, film, place
and notes as EXIF/XMP, so Lightroom, Photos, immich, a NAS or a blog can read it without knowing
this app exists. A roll shot on a camera that records nothing becomes a set of files that look as if
it had.

## Why it is worth doing

The per-frame record is the whole point of the app, and today it lives only in filmnotes. Everywhere
the images go afterwards they are metadata-free JPEGs from the lab. Writing the data into the files
makes it survive the app: it is readable in 20 years with any tool, and it is what turns "notes
about a picture" into "a picture that knows what it is".

## What is written where

Standard tags first — they are what ordinary tools read with zero special support. Everything with no
standard home goes into XMP, under the **AnalogExif** namespace `http://analogexif.sourceforge.net/ns/`,
which is what the established film tools (AnalogExif, EZ Exif) read and write.

| filmnotes                               | Tag                                                              |
| --------------------------------------- | ---------------------------------------------------------------- |
| camera make / model                     | `Exif.Make`, `Exif.Model`                                        |
| lens make / model                       | `Exif.LensMake`, `Exif.LensModel`                                |
| `focalLengthMm`                         | `Exif.FocalLength` (135 film: `FocalLengthIn35mmFilm` the same)  |
| `shutterSpeed`                          | `Exif.ExposureTime` (rational; `bulb` → omitted, see below)      |
| `aperture`                              | `Exif.FNumber`                                                   |
| `exposureMode` P/A/S/M                  | `Exif.ExposureProgram` (2 / 3 / 4 / 1)                           |
| `exposureCompensationEv`                | `Exif.ExposureBiasValue`                                         |
| `roll.isoSet`                           | `Exif.PhotographicSensitivity`                                   |
| `takenAt`                               | `Exif.DateTimeOriginal` **+ `OffsetTimeOriginal`** (local time!) |
| `location.lat/lon`                      | `Exif.GPSLatitude/GPSLongitude` + their `Ref` tags               |
| `location.name`                         | `Iptc4xmpCore:Location`                                          |
| `notes`                                 | `Exif.ImageDescription` + `dc:description`                       |
| film stock, process, push/pull, lab     | XMP AnalogExif: `Film`, `FilmMaker`, `DevelopProcess`, `Lab`     |
| roll id, `frameNo`                      | XMP AnalogExif: `RollId`, `FrameNumber`                          |
| filters, flash, support, light, subject | XMP AnalogExif free fields + `dc:subject` keywords               |
| the app                                 | `xmp:CreatorTool = "filmnotes"`                                  |

## Decisions the owner has to make first

1. **Where does the tagged file end up?** Three ways, and the ticket cannot start without a choice:
   - **(a) On the way out only** — the stored scan stays as the lab delivered it; export, share and
     download write the metadata into the copy that leaves. Nothing is rewritten, notes edited later
     are always included. _Proposed default._
   - **(b) Once, into the stored file** — a `filmnotes-tag` run rewrites the scans on the server, so
     the archive itself carries the data. Costs an upload per scan and freezes the notes as they were.
   - **(c) At import time** — cheapest (one write), but a note written afterwards never reaches the
     file.
2. **GPS in published pictures?** A WordPress post with the exact coordinates of your flat is a
   different thing from a JPEG on your NAS. Proposal: GPS is written on download/share, and the
   WordPress exporter strips it unless a setting says otherwise.
3. **XMP now or later?** EXIF alone (step 1) covers camera, lens, exposure, ISO, date and GPS with a
   dependency-free library. Film stock, lab and the rest need XMP, which needs a bigger tool — worth
   it, but it can follow.

## Technical approach

- **The metadata itself is pure domain logic**: `frameMetadata(frame, roll, camera, lens, filters,
filmStock, timeZone)` returns a plain, tested object — no file handling, no library. That is where
  the mapping table above lives, and it is the only part that needs to be right.
- **Writing EXIF: `piexifjs`** (pure JavaScript, JPEG only, rewrites the APP1 segment and leaves the
  pixel data untouched — lossless, which matters for a 1.6 MP lab scan). Works in Node _and_ in the
  app bundle, so the same writer serves the CLI and the export.
- **Writing XMP: ExifTool through WebAssembly** (`@uswriting/exiftool`) in the CLI, where the extra
  weight is free. No native binary, no Perl.
- **Shutter speeds:** `parseShutterSpeed` already turns `1/125`, `30"` and `1"5` into seconds;
  `ExposureTime` is a rational, so 1/125 stays 1/125 and 1.5 s becomes 3/2. `bulb` has no numeric
  value: it is left out of EXIF and written as an XMP note instead.
- **Only JPEG for now.** That is what dm and Rossmann deliver (confirmed: JPEG, ~1536×1024). TIFF and
  WebP are refused with a clear message rather than silently skipped.

## Files

```
packages/domain/src/frameMetadata.ts, frameMetadata.test.ts     the mapping, pure
packages/exporters/src/embedMetadata.ts, .test.ts               piexifjs writer + the export seam
tools/scan-import/src/tag.ts, tag.test.ts                       `filmnotes-tag` subcommand
docs/workflow.md                                                what ends up in the file
```

## Steps

- [ ] **Step 1: `frameMetadata.test.ts`** – a fully filled frame maps to every tag of the table;
      `bulb` leaves `ExposureTime` out; a frame without a lens/location omits those tags instead of
      writing empty ones; `DateTimeOriginal` is the _local_ time with a matching `OffsetTimeOriginal`.
      Implement, commit `feat(domain): frame metadata for EXIF/XMP`.
- [ ] **Step 2: `embedMetadata.test.ts`** – writing into a fixture JPEG and reading it back produces
      the same values; the pixel data is byte-identical to the input; a non-JPEG is refused.
      Implement with piexifjs, commit `feat(exporters): write EXIF into an exported scan`.
- [ ] **Step 3: the export path** – share package and WordPress upload go through it; GPS obeys
      decision 2. Tests in `runExport.test.ts`. Commit `feat(app): exported scans carry their frame`.
- [ ] **Step 4: `filmnotes-tag`** – `filmnotes-tag --roll <id> <folder>` writes the metadata into the
      local copies (decision 1a) or, with `--upload`, replaces the stored files (1b). XMP through the
      WASM ExifTool. Commit `feat(cli): tag scans with their frame metadata`.
- [ ] **Step 5: docs** – `docs/workflow.md` §5 gets "what is in the file afterwards", with an
      `exiftool` output as the example. Commit `docs: metadata in exported scans`.

**Done when:** `npm test` green; a scan exported from the app opens in Lightroom/Photos with camera,
lens, exposure, ISO and date filled; `exiftool` shows the XMP film fields; and the original file on
the server is byte-identical unless `--upload` was used.

## Risks and things to watch

- **Metadata makes a picture more personal, not less.** GPS and the place name leave the device with
  every share. Decision 2 is the whole mitigation, and it belongs in the settings, not in a comment.
- **piexifjs is unmaintained** (last release years ago) but small and doing one thing; the fallback is
  the same WASM ExifTool the CLI uses, at the cost of bundle size in the app.
- **A scan without a frame** (the import left it unassigned) gets roll-level metadata only. That is
  the correct answer, not an error.
- **Re-tagging** an already tagged file must be idempotent — write, do not append.
