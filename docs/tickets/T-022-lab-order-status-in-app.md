# T-022 – Show the lab's order status in the app

**Wave:** backlog, not scheduled — needs the owner decisions below before it starts
**Depends on:** nothing
**Owns:** `packages/domain/src/types.ts` (`Roll`), `apps/mobile/src/features/rolls/**`

**Goal:** see the photo lab's order status for a roll from inside the app, not only by waiting for
the n8n automation's e-mail.

## Why

`docs/automation.md` (T-014) documents an n8n workflow that polls
`spot.photoprintit.com/spotapi/orderInfo/forShop?config=…&shop=…&order=…` every 6 hours and
e-mails when the status changes. That's the only place this API is called today —
`Roll.labOrderId` is a plain text field the workflow reads to match mail to a roll; nothing in
`apps/mobile` calls the lab, and no ticket has covered doing so. Checked against a real answer
from a dm order:

```json
{
  "summaryStateCode": "SHIPPED",
  "summaryStateText": "Dein Auftrag wird in die Filiale geliefert und liegt in den nächsten 1-4 Werktagen für Dich zur Abholung bereit.",
  "summaryDate": "2026-09-25",
  "orderNo": "540996",
  "deliveryText": "dm-drogerie markt\nBahnhofstraße 27\n82131 Gauting"
}
```

## Decisions taken

- **On-demand, not automatic.** A "Laborstatus prüfen" action on the roll (detail screen or
  wherever fits once someone builds this) fetches live and shows `summaryStateText` +
  `summaryDate`. No background polling inside the app - the n8n workflow already does that
  server-side.
- **The identifiers live on the roll, not in settings.** Two new optional fields next to
  `labOrderId`: the order number (already exists) and a shop id (`shop` in the URL, e.g. `D4J0`).
  The owner's own call, against the alternative of one global settings screen - a roll can move
  between shops, and most people use more than one branch over time.
- **The shop id needs a friendly label.** `D4J0` means nothing on its own; the owner wants a
  mapping to something like "DM Gauting Bahnhofstr. 27" shown instead of the raw code wherever it
  appears. Not decided: where that mapping lives (see open questions).

## Open questions - ask the owner before starting

- **The notification.** The owner also wants to be told when the status *changed* since the last
  check, not just see it on demand - which needs somewhere to remember the last-seen status per
  roll (a new field?) and something that triggers the comparison (on app open? a manual
  refresh-all?). This is more than "on demand" as scoped above and needs its own shape before it's
  buildable.
- **`config` (e.g. `1320` in the URL).** `docs/automation.md` treats `config` and `shop` as a
  pair that "identify your lab's branch", but the owner only asked for a per-roll *shop* field.
  Is `config` the same for every dm branch (so one constant, or one app-level setting, is enough),
  or does it vary too and belongs on the roll alongside `shop`?
- **Where the shop-id → label mapping lives.** A small settings screen the owner maintains
  themselves (pick a label when adding a shop id once, then choose from a list on each roll after
  that), or something simpler (free-text label typed alongside the code on the roll form, no
  shared list)? The mapping is inherently personal - it names the owner's own local labs, not
  something with a public registry.

**Done when:** these are answered and turned into steps; until then this stays in the backlog.
