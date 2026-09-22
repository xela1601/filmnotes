---
"@filmnotes/mobile": patch
"@filmnotes/domain": patch
"@filmnotes/exporters": patch
---

The smaller things that were wrong.

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
