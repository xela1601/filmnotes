# @filmnotes/mobile

## 0.2.0-alpha.0

### Minor Changes

- 5b3cd2f: The frame editor asks for the exposure and carries the rest over.

  A new frame inherits everything from the frame before that is still true when you wind on: lens,
  focal length, filters, flash, modes, support, light — and now the exposure itself (time, aperture,
  compensation) and the context (subject, place). What stays empty is what you observed about _that_
  frame (AF lamp, flash ok, beep, notes); what is reset is what the camera resets itself (program
  shift, AE lock).

  Because of that the screen could shrink to what actually changes: mode, time, aperture, notes. Optics,
  focus and transport, flash and context sit behind one "Mehr Details" switch that remembers its state,
  and that opens by itself when an error is hiding in it. Collapsed, a frame fits on one phone screen.

- 797ef87: One deployable image, published on a version tag.

  `ghcr.io/xela1601/filmnotes` carries the PocketBase binary for the platform (amd64 and arm64), the
  schema migrations and the web app in `pb_public` — so the server hands out app and API from one
  origin, and the two cannot be half-updated. On the home server a release is now
  `docker compose pull && docker compose up -d`.

  Pushing a semver tag to main builds and pushes it. The workflow refuses to publish a tag that is
  not valid semantic versioning, that does not sit on main, or that disagrees with the version in the
  workspaces — and a pre-release never takes the `latest` tag.

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

- 5b3cd2f: Scan files are protected on the server.

  The scan _records_ were owner-only from the start, the image bytes were not: anyone who knew a file
  URL could fetch them without a token. The `scans.file` field is `protected` now, and the app fetches
  a short-lived file token for thumbnails and for the export.

  **Needs a server restart**: migration `1758600000_protect_scan_files` applies it. Older app versions
  cannot show scans afterwards, because they send no token — update both together.

### Patch Changes

- 5b3cd2f: Quality gates for the work itself: ESLint 10 and Prettier with type-aware linting outside the app,
  `npm run typecheck` covering the Expo app as well, and a guided screenshot tour that drives the
  exported web bundle in a real browser (`mise run screenshots`, 13 scenes in light and dark) with a
  browser-free dry run for CI (`mise run check:tour`). The tour earned its keep immediately: it found
  the boot crash and the unreachable picker listed above.
- 5b3cd2f: Dates and times are local, not UTC.

  Timestamps are stored as UTC instants, which is right for storage and wrong for everything a
  photographer reads: a frame shot at 00:30 in Munich was dated the day before — in the editor, in the
  caption and in the WordPress post. Everything visible now goes through the device's own time zone,
  and the exporters date a frame by its local calendar day.

  The date and time fields are strict about what they accept: "9:5" used to become midnight and
  2026-13-45 became February 2027, both silently. Both are reported now and block saving until they
  are a real date.

- 5b3cd2f: The scan import is repeatable and says what went wrong.

  - Running an import again skips the files that already have an uploaded scan instead of creating a
    second record and a second copy for every one of them. A second press is now a retry of the
    failures, which is what it always looked like.
  - Every failure carries its reason, and a format the server refuses (HEIC from a phone) is reported
    before anything is uploaded rather than as a bare file name two requests later.
  - One rule decides which scan belongs to a frame — the newest uploaded one. Three code paths
    disagreed before, and the disagreement could produce a WordPress draft with no image at all,
    logged as a success.

- 5b3cd2f: The smaller things that were wrong.

  - Every new frame showed the literal text "undefined, undefined" where the coordinates go.
  - Typing a decimal into an equipment field ate the point: an f/1.7 lens became f/17.
  - The ISO steppers move in tens; the film scale has no use for single steps.
  - The picker could not be scrolled, so the last of the Minolta's 18 shutter speeds — "bulb" — was
    unreachable on a phone screen.
  - "Alles zurücksetzen" left the app without a camera or a film stock until it was restarted, so not
    a single roll could be created.
  - Deleting a roll takes its scans and export logs with it instead of leaving them on the server.
  - The equipment editor refuses a camera without exposure modes or shutter speeds and a lens without
    apertures — all three produced equipment the frame editor could not work with.
  - A camera record without its frame defaults no longer throws; a cancelled share is no longer logged
    as an export; a time zone the runtime cannot name no longer takes the whole app down at boot.

- 5b3cd2f: Sync no longer loses changes silently.

  - The watermark for "what is new on the server" comes from the newest record the server sent, not
    from the device clock. A phone running two minutes fast used to store a watermark in the server's
    future and never saw those changes again.
  - The first sync of an installation uploads exactly the seeded equipment the server is missing, and
    retries it on the next run when one record fails. Seed records carry no outbox entry, so the old
    all-or-nothing upload was their only chance.
  - A local edit that the server version replaced is counted and shown, instead of disappearing.
  - The persisted state is merged over complete defaults and carries a schema version, so a payload
    written before a collection existed cannot hydrate the app into an unusable state.

- Updated dependencies [5b3cd2f]
- Updated dependencies [5b3cd2f]
- Updated dependencies [5b3cd2f]
- Updated dependencies [5b3cd2f]
- Updated dependencies [5b3cd2f]
  - @filmnotes/domain@0.2.0-alpha.0
  - @filmnotes/presets@0.2.0-alpha.0
  - @filmnotes/exporters@0.2.0-alpha.0
