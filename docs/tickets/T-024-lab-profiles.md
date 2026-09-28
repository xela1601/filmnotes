# T-024 – Lab profiles: the app stops assuming one lab

**Wave:** backlog, ready to start — the owner's decisions were taken on 2026-09-27
**Depends on:** nothing (but T-022 is rebased onto this one, see "What this does to T-022")
**Owns:** `packages/domain/src/labProfile.*`, `packages/domain/src/types.ts` (`Roll`),
`packages/presets/data/lab-profiles.json`, `packages/presets/src/schema.ts`,
`automation/n8n/filmnotes-scan-import.json`, `docs/automation.md`, `docs/workflow.md`

**Goal:** make the way a roll gets from the camera to its digital frames a _choice_ — a drugstore
lab, a mail-order lab, or a scanner on the owner's own desk — instead of one path with dm wired
into the code.

## Why

Two findings from 2026-09-27 broke the assumption the automation was built on.

**1. The lab mail does not exist.** `docs/automation.md` triggers the whole scan import from an
IMAP node, "Lab mail arrives", carrying a download link. The owner never gave dm an e-mail
address, so that mail has never arrived and never will. dm delivers the digital images a different
way: the pickup bag contains an **insert with a Secure-ID and the order number** plus a link to
`foto.dm.de`, and the download is valid six weeks. The credential is printed on paper, in a bag,
in a shop — the one step in the chain that no workflow can reach.

The real trigger is already in the workflow and already works: the six-hourly status poll. Order
540996 was measured through its full life on 2026-09-21/25/26 — `PROCESSING` → `SHIPPED` →
`DELIVERED` — and `DELIVERED` correctly falls through the "still working on it" list and reports.

**2. There is more than one route, and there will be more than one owner.** The owner scans at
home with a standalone Kodak film scanner, may use a mail-order lab for the frames that deserve
it, and expects other people to use this app eventually — "jeder hat seinen eigenen Weg"
(2026-09-27). The spec has said so from the start: _"lab APIs can be added later behind the same
import interface"_ (design spec, line 22). `Roll.labOrderId` and the dm status URL are the first
place where that principle would be broken, because T-022 as written puts dm's `shop` parameter
on the roll itself.

The import side already keeps the promise — `filmnotes-import` takes a folder, a ZIP or a URL, and
the `DCIM/` layout a standalone scanner writes to a card is the same shape as the drugstore CD the
README already documents. **Self-scanning therefore needs no new code at all**, only a place in
the documentation. What needs generalising is the _lab_ side.

## Decisions taken

- **A lab is a profile, and profiles are preset data.** Film stocks and the camera kit are already
  JSON under `packages/presets/data/`, validated by a strict Zod schema and seeded into the store.
  A lab profile joins them. The dm profile carries the status URL template; no hostname, no query
  parameter and no lab name appears in application code. Owner's decision, 2026-09-27.

  The cost of it: a second lab with a different API shape is not just another row — a profile can
  describe _where_ to ask, not _how_ to parse an unknown answer. This ticket buys the separation,
  not a universal lab client, and says so rather than pretending otherwise.

- **A roll may have no lab at all.** `labProfileId` is nullable, and null is the normal state for
  a roll the owner develops or scans themselves. Nothing about lab orders appears on such a roll.
  Owner's decision, 2026-09-27.

- **The IMAP branch is deleted, not disabled.** Twelve nodes go, including the Code node "Extract
  order and download link" whose two regular expressions were never run against a real mail. The
  owner chose removal over keeping dead wiring for a hypothetical future lab: a reader of
  `docs/automation.md` should not have to work out which half of the document is fiction. Owner's
  decision, 2026-09-27. Should a mail-delivering lab ever turn up, the branch is in the git
  history and the profile concept is the place it would hang from.

- **The automated _import_ loses its trigger with it, and that is accepted.** "Run
  filmnotes-import" and "PocketBase: roll is developed" only ever ran off the mail. With the
  Secure-ID on paper and the owner scanning at home, the import is a command the owner runs — as
  `docs/automation.md` always said it could be. The status poll keeps telling them when to go.

## Open questions, to be answered by measurement rather than by the owner

- **Can the dm download be fetched with the Secure-ID?** To be measured when order 540996 is
  collected: what the insert holds, what the download URL looks like, whether it lives on
  `spot.photoprintit.com` like the status API, and whether it yields a ZIP. If it is a plain URL,
  a profile can carry a download template too and the CLI's existing URL source does the rest; if
  it is a session behind a form, it stays a manual download and the profile says so. **Do not
  design the download field before this is measured.**
- **Does `config` vary per branch?** Carried over from T-022 step 0 unchanged. It decides whether
  `config` is one constant in the dm profile or a per-roll field.
- **What resolution are the dm scans really?** Third-party reports say CEWE scans 35 mm at about
  1.5 MP. Opening one downloaded file settles it and belongs in `docs/workflow.md` next to the
  self-scan route, so the choice between routes rests on a number rather than on hearsay.

## Steps

- [ ] **Step 0: measure.** Answer the three questions above and record the findings _in this
      ticket_ before writing code. The shape of steps 1 and 2 depends on the first two.
- [ ] **Step 1: the domain type.** `LabProfile` in `packages/domain` — id, name, an optional
      status endpoint (URL template plus the names of the parameters it needs) and notes. `Roll`
      gains `labProfileId: Id | null`. Failing test first: a profile without a status endpoint is
      valid, and a roll with no profile is valid.
- [ ] **Step 2: the profile data.** `packages/presets/data/lab-profiles.json` with dm as the first
      entry, a `labProfilePresetSchema` in `packages/presets/src/schema.ts` (strict, like every
      other one), the compile-time `Extends` proof, and the data test. Seeded as its own bundle
      id, `lab-profiles`, so an existing installation picks it up.
- [ ] **Step 3: the lab client.** A pure function taking a profile and a roll's identifiers,
      returning `{ stateCode, stateText, date, orderNo, deliveryText }` or a typed error (no
      profile, no status endpoint, no order, network down, unexpected shape). Tested against the
      recorded `DELIVERED` fixture from order 540996 and against a profile that has no endpoint.
- [ ] **Step 4: the workflow loses its mail branch.** Delete the twelve nodes from "Lab mail
      arrives" to "Mail: needs a human" in `automation/n8n/filmnotes-scan-import.json`. The
      schedule branch stays exactly as it is. Import the result into n8n once to prove the JSON
      still loads.
- [ ] **Step 5: `docs/automation.md` says what is true.** The mail section goes; the Secure-ID
      insert, the measured status sequence and the profile concept take its place. The five
      environment variables lose the ones only the mail branch used.
- [ ] **Step 6: `docs/workflow.md` gets the self-scan route** as an equal option next to the lab:
      one folder per roll, scan in shooting order, `--dry-run` first, then the import. Say plainly
      what the trade is — a standalone scanner bakes its conversion into a JPEG, and the negatives
      remain the archive.
- [ ] **Step 7:** changeset (`minor` — new capability and a changed workflow), `npm test`,
      `npm run lint`, `npm run format`.

## What this does to T-022

T-022 keeps its feature — a "Laborstatus prüfen" action on the roll — and loses its data design.
Its recorded decision of 2026-09-25, _"two new optional fields next to `labOrderId`"_, is
superseded by the owner's decision of 2026-09-27: the shop id and the status URL belong to a
profile, and only the identifiers that genuinely differ per roll stay on the roll. T-022 now
**depends on T-024**, and its steps 1 and 2 are done here instead. Its steps 3 and 4 — the form
field, the action, the cached branch label from `deliveryText` — are untouched and stay there.

That ordering is deliberate: building T-022 first would put dm's query parameters on `Roll` and
then take them off again one ticket later.

**Done when:** a lab profile can be chosen on a roll or left empty, the dm status check runs
through the profile with no lab name in application code, the n8n workflow contains nothing that
waits for a mail, both documents describe the routes that actually exist, and the full gate is
green.
