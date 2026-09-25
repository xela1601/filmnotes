# T-022 – Show the lab's order status in the app

**Wave:** backlog, ready to start — the owner's decisions were taken on 2026-09-25
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
- **The shop id needs a friendly label, and the API already provides one.** `D4J0` means nothing
  on its own. Rather than a mapping the owner maintains - a settings screen with a list, or a
  free-text label typed on every roll - the answer takes the branch's name and address from
  `deliveryText` in the response itself and stores it on the roll after the first successful
  check. No list to curate, no code to transcribe, and the label is the lab's own spelling
  instead of ours. Owner's decision, 2026-09-25.

  The cost of it: a roll shows the raw code until it has been checked once. Acceptable, because
  the code is only ever typed together with an order number that is about to be checked anyway.
  The stored label is a cache, not a source - a later check overwrites it.

- **Change detection is out of scope, deliberately.** The owner does want to be told when a
  status _changed_ since the last check, but that needs somewhere to remember the last-seen
  status per roll and something that triggers the comparison (on app open? a refresh-all?). That
  is a second shape, not a detail of this one. T-022 delivers the manual check; the notification
  becomes its own ticket once this is in the owner's hands and it is clear what "changed" should
  actually do. Owner's decision, 2026-09-25.

## Open question, to be answered by measurement rather than by the owner

**Does `config` (e.g. `1320`) vary per branch, the way `shop` does?** `docs/automation.md` treats
`config` and `shop` as a pair identifying the lab's branch, but the owner only asked for a
per-roll _shop_ field and does not know whether `config` is constant. This is a fact about dm's
API, not a preference, so step 1 below settles it empirically instead of asking again.

## Steps

- [ ] **Step 0: find out what `config` is.** Call `orderInfo/forShop` for a known order with the
      known `config` and then with a deliberately wrong one; call it for an order from a second
      branch with the same `config`. If the answer does not depend on it, `config` is one
      constant in the app; if it does, it becomes a third field on the roll next to the order
      number and the shop id. Record the finding here before writing any code - the rest of the
      ticket's shape depends on it.
- [ ] **Step 1: the domain fields.** `shopId` (optional) and the cached `labShopLabel` on `Roll`,
      plus `config` if step 0 says so. Failing test first, in `packages/domain`.
- [ ] **Step 2: the lab client.** A function that takes the identifiers and returns
      `{ stateCode, stateText, date, orderNo, deliveryText }` or a typed error (no order, network
      down, unexpected shape). Pure, tested against the recorded fixture in "Why" above.
- [ ] **Step 3: the roll form.** Shop id next to the existing order number. The label shown is
      the cached one where there is one, the raw code otherwise.
- [ ] **Step 4: the action.** "Laborstatus prüfen" on the roll detail screen: fetch, show
      `summaryStateText` + `summaryDate`, store `deliveryText` as the label. Offline and
      not-found say so instead of failing silently. i18n keys, `de` and `en`.
- [ ] **Step 5:** changeset (`minor` - new capability), `docs/automation.md` gets a line saying
      the app can now ask the same endpoint the n8n workflow polls.

**Done when:** a roll with an order number and a shop id shows its live lab status on demand, the
branch is named rather than coded after the first check, and the full gate is green.
