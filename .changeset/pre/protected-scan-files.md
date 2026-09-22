---
"@filmnotes/backend": minor
"@filmnotes/mobile": minor
---

Scan files are protected on the server.

The scan _records_ were owner-only from the start, the image bytes were not: anyone who knew a file
URL could fetch them without a token. The `scans.file` field is `protected` now, and the app fetches
a short-lived file token for thumbnails and for the export.

**Needs a server restart**: migration `1758600000_protect_scan_files` applies it. Older app versions
cannot show scans afterwards, because they send no token — update both together.
