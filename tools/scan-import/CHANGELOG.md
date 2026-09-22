# @filmnotes/scan-import

## 0.2.0-alpha.0

### Minor Changes

- 5b3cd2f: filmnotes, first pre-release: per-frame notes for analogue film rolls.

  Load a roll into the camera, create it in the app from a film preset, and from then on every shot
  gets a short record — exposure mode, time, aperture, lens, focal length, filters, flash, support,
  light, subject, place and a free note. The domain rules check the combination while you type and
  warn about the classic mistakes: a linear polarizer against the autofocus, a shutter speed below the
  lens's hand-held limit, bulb outside mode M, an aperture the lens does not have.

  Weeks later the lab returns the developed roll. Import the folder or ZIP, the files are matched onto
  the frames by natural filename order, correct the mapping where the lab dropped a frame, and the
  images are uploaded. Each frame then carries its notes _and_ its scan, and can be exported as a
  WordPress draft or as a share package with a caption built from a template.

  Runs on iOS, Android and in the browser from one Expo code base, German and English, offline-first:
  a self-hosted PocketBase is only needed for sync across devices, for the scan files and for export
  logs. A desktop CLI (`filmnotes-import`) does the scan import from a computer.

- 5b3cd2f: The lab's order number ties a delivery to a roll, and the import can start from a link.

  A roll carries the lab's own order number ("Auftragsnummer Labor", migration
  `1758700000_roll_lab_order_id`), and the scan-import CLI accepts an http(s) URL as its source — so
  the download link the lab mails arrives in the app in one step, by hand or from a workflow.
  `--json` prints one line of counts and failures for a caller that is a program.

  `automation/n8n/filmnotes-scan-import.json` is an optional, importable workflow: the mail with the
  link triggers it, the order number finds the roll, the CLI does the upload, the roll moves to
  "developed" and a summary comes back by mail; a second branch asks the lab about open orders. n8n
  does transport and notification only — the upload stays the one code path the app and the CLI share.

### Patch Changes

- 5b3cd2f: The scan import is repeatable and says what went wrong.

  - Running an import again skips the files that already have an uploaded scan instead of creating a
    second record and a second copy for every one of them. A second press is now a retry of the
    failures, which is what it always looked like.
  - Every failure carries its reason, and a format the server refuses (HEIC from a phone) is reported
    before anything is uploaded rather than as a bare file name two requests later.
  - One rule decides which scan belongs to a frame — the newest uploaded one. Three code paths
    disagreed before, and the disagreement could produce a WordPress draft with no image at all,
    logged as a success.

- Updated dependencies [5b3cd2f]
- Updated dependencies [5b3cd2f]
- Updated dependencies [5b3cd2f]
- Updated dependencies [5b3cd2f]
- Updated dependencies [5b3cd2f]
  - @filmnotes/domain@0.2.0-alpha.0
