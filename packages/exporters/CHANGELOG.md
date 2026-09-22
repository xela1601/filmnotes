# @filmnotes/exporters

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

### Patch Changes

- 5b3cd2f: Dates and times are local, not UTC.

  Timestamps are stored as UTC instants, which is right for storage and wrong for everything a
  photographer reads: a frame shot at 00:30 in Munich was dated the day before — in the editor, in the
  caption and in the WordPress post. Everything visible now goes through the device's own time zone,
  and the exporters date a frame by its local calendar day.

  The date and time fields are strict about what they accept: "9:5" used to become midnight and
  2026-13-45 became February 2027, both silently. Both are reported now and block saving until they
  are a real date.

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

- Updated dependencies [5b3cd2f]
- Updated dependencies [5b3cd2f]
- Updated dependencies [5b3cd2f]
- Updated dependencies [5b3cd2f]
- Updated dependencies [5b3cd2f]
  - @filmnotes/domain@0.2.0-alpha.0
