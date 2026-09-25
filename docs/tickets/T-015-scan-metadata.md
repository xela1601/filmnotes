# T-015 – Frame metadata into the scan files (EXIF/XMP)

**Wave:** backlog, ready to start — the owner's three decisions were taken on 2026-09-25
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

## Decisions taken by the owner, 2026-09-25

1. **The scan is tagged at import time — option (c).** The metadata is written once, into the file
   that gets stored, and the archive carries it from then on.

   The owner chose this over the ticket's own proposal (a, tag only the copy that leaves) with the
   consequence stated: **a note, a place name or a correction written after the import never
   reaches the file.** The picture keeps the metadata as it was on import day. That is a real cost
   in an app whose whole point is a notebook filled in afterwards, and it was accepted knowingly —
   the value here is "the archive is complete the moment it exists", not "the file always matches
   the app".

   Two things follow for the implementation:

   - The writer is needed at import (`tools/scan-import`, and the in-app import path), not only in
     the export. Step 4 below moves forward rather than being the last step.
   - Re-tagging must stay possible for the day this decision is regretted: `filmnotes-tag` keeps
     its `--roll` form so an existing archive can be rewritten with the current notes. It is not
     wired into anything automatic, it just has to work when called.

2. **GPS is written, but the WordPress exporter strips it** unless a setting says otherwise. A post
   with the exact coordinates of your flat is a different thing from a JPEG on your own NAS.

3. **EXIF first, XMP second.** Steps 1–3 with piexifjs cover camera, lens, exposure, ISO, date and
   GPS — the fields that Lightroom, Photos, immich and the Finder actually display, with a
   dependency-free library that runs in the app bundle as well as in the CLI. Film stock, developing
   process, push/pull and lab have no EXIF home at all; they need XMP under the AnalogExif
   namespace and therefore the WASM ExifTool, which is free in the CLI and expensive in the app.
   That becomes its own pass once the EXIF half is in the owner's hands.

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
- [ ] **Step 3: the import path** – decision 1(c): the scan is tagged as it is imported, so the
      stored file carries the metadata. Both entry points, the CLI import and the in-app one. A
      scan whose frame is not yet assigned gets roll-level metadata only and is not an error.
      Commit `feat(app): imported scans carry their frame`.
- [ ] **Step 4: the export path** – share package and WordPress upload re-write the metadata with
      the state at export time, so a picture that leaves is never staler than the app; GPS obeys
      decision 2 and the WordPress exporter strips it. Tests in `runExport.test.ts`. Commit
      `feat(app): exported scans carry their frame`.
- [ ] **Step 5: `filmnotes-tag`** – `filmnotes-tag --roll <id> <folder>` re-tags an existing
      archive with the current notes, and with `--upload` replaces the stored files on the server.
      Not automatic: this is the escape hatch decision 1(c) needs, because notes written after the
      import do not otherwise reach the file. Commit `feat(cli): tag scans with their frame
metadata`.
- [ ] **Step 6: docs** – `docs/workflow.md` §5 gets "what is in the file afterwards", with an
      `exiftool` output as the example, and says plainly that a note added after the import needs
      `filmnotes-tag` to reach the archive. Commit `docs: metadata in imported and exported scans`.
- [ ] **Step 7 (own pass): XMP.** The AnalogExif fields — film stock, developing process,
      push/pull, lab, roll id, frame number — through the WASM ExifTool in the CLI. Decision 3
      keeps this out of the first delivery.

**Done when:** `npm test` green; an imported scan opens in Lightroom/Photos with camera, lens,
exposure, ISO and date filled; the pixel data is byte-identical to what the lab delivered; and a
picture exported to WordPress carries no GPS unless the setting says otherwise.

## Risks and things to watch

- **Metadata makes a picture more personal, not less.** GPS and the place name leave the device with
  every share. Decision 2 is the whole mitigation, and it belongs in the settings, not in a comment.
- **piexifjs is unmaintained** (last release years ago) but small and doing one thing; the fallback is
  the same WASM ExifTool the CLI uses, at the cost of bundle size in the app.
- **A scan without a frame** (the import left it unassigned) gets roll-level metadata only. That is
  the correct answer, not an error.
- **Re-tagging** an already tagged file must be idempotent — write, do not append.
