---
"@filmnotes/mobile": patch
---

Sync no longer loses changes silently.

- The watermark for "what is new on the server" comes from the newest record the server sent, not
  from the device clock. A phone running two minutes fast used to store a watermark in the server's
  future and never saw those changes again.
- The first sync of an installation uploads exactly the seeded equipment the server is missing, and
  retries it on the next run when one record fails. Seed records carry no outbox entry, so the old
  all-or-nothing upload was their only chance.
- A local edit that the server version replaced is counted and shown, instead of disappearing.
- The persisted state is merged over complete defaults and carries a schema version, so a payload
  written before a collection existed cannot hydrate the app into an unusable state.
