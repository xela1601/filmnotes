---
"@filmnotes/mobile": minor
"@filmnotes/domain": minor
"@filmnotes/presets": minor
"@filmnotes/exporters": minor
"@filmnotes/scan-import": minor
"@filmnotes/backend": minor
---

filmnotes, first pre-release: per-frame notes for analogue film rolls.

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
