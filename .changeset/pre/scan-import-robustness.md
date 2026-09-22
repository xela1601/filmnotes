---
"@filmnotes/mobile": patch
"@filmnotes/domain": patch
"@filmnotes/scan-import": patch
---

The scan import is repeatable and says what went wrong.

- Running an import again skips the files that already have an uploaded scan instead of creating a
  second record and a second copy for every one of them. A second press is now a retry of the
  failures, which is what it always looked like.
- Every failure carries its reason, and a format the server refuses (HEIC from a phone) is reported
  before anything is uploaded rather than as a bare file name two requests later.
- One rule decides which scan belongs to a frame — the newest uploaded one. Three code paths
  disagreed before, and the disagreement could produce a WordPress draft with no image at all,
  logged as a success.
