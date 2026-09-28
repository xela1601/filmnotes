---
"@filmnotes/backend": minor
---

The server now refuses frame values the app does not know: exposure mode, focus mode, AF result,
drive mode, flash head and support are fixed lists on the server too, not free text. The update
carries a migration. If a stored frame already holds a value outside those lists, the server
does not start and names the records - fix or clear them in the admin UI, then start again.
