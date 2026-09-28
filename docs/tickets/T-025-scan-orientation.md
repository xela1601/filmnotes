# T-025 – Scans that arrive upside down

**Wave:** backlog — **waiting on the owner** (questions below), written 2026-09-28
**Depends on:** T-009/T-013 (scan import, app and CLI); touches T-015 (EXIF writing) and T-024
(lab profiles), see "Decided so far"
**Owns:** to be settled with the answers — likely `packages/domain/src/scanUpload.*`, the scan
review in `apps/mobile/src/features/scans/**`, `tools/scan-import/src/**`

**Goal:** a roll whose scans come back rotated can be put the right way up once, in filmnotes,
instead of in every tool the images later pass through.

## Why

The first dm roll (order 540996, collected 2026-09-28) came back with all twelve scans rotated by
180°. Measured on the files, not on a viewer:

- the pixels themselves are upside down — there is **no EXIF `Orientation` tag** at all, so no
  viewer will ever show them the right way on its own;
- every file says `Make=allcop`, `Model=fastScan 20`, a strip scanner that pulls the whole film
  through: the same rotation on every frame fits a strip fed the other way round, which would be
  one decision at the lab per roll, not per frame;
- one roll is one measurement. Whether dm _always_ delivers them this way is not known, so a
  "dm rotates by 180°" rule in the lab profile would be a guess today.

Everything downstream inherits the problem: the scan review, the frame detail, the WordPress
export and the share package would all show the picture upside down.

## Decided so far

Nothing — the questions come first. What the ticket proposes, for the owner to accept or change:

- **A rotation in the scan review**, for all scans of the import at once and for a single scan
  (0 / 90 / 180 / 270), because the evidence says "per roll" and a home scanner can get single
  frames wrong.
- **Non-destructive, via the EXIF `Orientation` tag** written into the uploaded file rather than
  re-encoding the pixels. JPEG cannot be rotated by 180° truly losslessly at 2088 × 1392 (neither
  side is a multiple of the 16-pixel block), and a re-encode costs quality on files that are
  already small. The tag is what T-015 writes into the same files anyway; this is one more tag
  there. Browsers, iOS, Android and WordPress honour it.
- **No profile default yet.** If later rolls show dm rotates every time, the profile gains a
  default rotation then — with the rolls that prove it.

## Questions for the owner

1. **Is this worth doing in the app at all**, or is rotating in the Photos app good enough for
   now? The ticket costs a review control, the tag writing, and a test per import path.
2. **Tag or pixels?** The tag is lossless and cheap; its risk is a tool that ignores it and shows
   the image upside down again (rare today, but real for some older image tools). Rotating the
   pixels is always right everywhere and costs one re-encode.
3. **Does the rotation belong to the file or to the frame?** Written into the file, it travels
   with every download. Stored on the `Scan` record instead, it needs a migration and every
   export has to apply it.

## Steps

To be written once the questions are answered.
