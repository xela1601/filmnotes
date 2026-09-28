# T-024 – Lab profiles: the app stops assuming one lab

**Wave:** backlog, ready to start — the owner's decisions were taken on 2026-09-27
**Depends on:** nothing (but T-022 is rebased onto this one, see "What this does to T-022")
**Owns:** `packages/domain/src/labProfile.*`, `packages/domain/src/types.ts` (`Roll`),
`packages/presets/data/lab-profiles.json`, `packages/presets/src/schema.ts`,
`automation/n8n/filmnotes-scan-import.json`, `docs/automation.md`, `docs/workflow.md`;
since 2026-09-28 also `packages/domain/src/scanMatching.*` and a new migration in
`backend/pb_migrations/` for `rolls.labProfileId`

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

- **Scan file names decide the frame, where the profile says how.** A profile may carry a pattern
  that pulls the frame number out of a scan's file name — dm's is `Neg\.Nr\.(\d+)`, from
  `_Bild000_Neg.Nr.25.jpg`. When it matches, the file goes to the frame with that number; where
  it does not (a home scanner's `IMG_0001.JPG`, a roll without profile), the natural order stays
  exactly as it is. Owner's decision, 2026-09-28, after the first dm roll: 12 scans on negatives
  25–36 that the natural order would have put on frames 1–12. The cost: the edge number printed
  on a negative and the camera's frame counter can differ by one — a camera that winds a little
  further than the lab expects shifts every frame. The review screen's existing shift is the
  correction for that, and the profile is where an offset would go once one is measured.

- **The dm download template goes into the public profile, `apiAccessKey` included.** The key is a
  single constant in dm's own public page source, the same for every customer, so it identifies
  nothing about the owner. Owner's decision, 2026-09-28. What is _not_ public is the Secure-ID —
  a per-order credential — and the branch identifiers `config`/`shop`, which stay out of tracked
  files as `docs/automation.md` already requires.

- **The Secure-ID is used once and never stored.** It is asked for when the download runs, fills
  the profile's download template for that one request, and is not written to the roll, the
  server, a log or the store. Owner's decision, 2026-09-28: "Einmal runterladen und dann
  vergessen". The cost: a second download of the same order means typing it again from the
  insert — within six weeks, after which it is worthless anyway.

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

## Measured on 2026-09-28, with order 540996 collected

The owner photographed the insert from the pickup bag; the download was fetched once from the
sandbox with its credentials. The Secure-ID and the full order number are deliberately **not**
recorded here — they are live credentials until the deletion date, and this repository is public.

**1. The download is a plain URL — answered, yes.**

- The insert says: open `foto.dm.de/download` (the QR code encodes only
  `https://foto.dm.de/fotos/analog/download.html?ofqrscan=true`, no credentials), enter the
  **12-digit order number** and the **Secure-ID**, and the images arrive "als ZIP-Ordner". It
  also prints the deletion date — six weeks, as expected.
- The form is not a session. Its page script builds
  `https://api.cewe-myphotos.com/api/imageCD/{orderId}/{secureId}` and
  - `GET` on it, with the headers `apiAccessKey` and `clientVersion: 1.0.0`, is the availability
    check: `200` and `{"labId":"<orderId>","orderTs":…,"deletedAtTs":…}` (epoch milliseconds).
  - appending `/download?aak=<apiAccessKey>&clientVersion=1.0.0` returns the ZIP
    (`application/zip`, 47 MB for 12 images), no cookie, no redirect chain.
  - `apiAccessKey` is one constant in dm's public page source, not per customer.
- It lives on **CEWE** (`api.cewe-myphotos.com`), not on `spot.photoprintit.com` like the status
  API. A profile therefore needs a download template of its own; the CLI's existing URL source
  can take the result as it is.
- **The order number has two halves**, `NNNNNN-NNNNNN`. The second half is the `order` the status
  API knows (540996); the first half is _not_ the `shop` parameter of the status URL — what it
  identifies is unknown. So the roll has to keep the full 12 digits, and the status check uses the
  part after the dash.

**2. Does `config` vary per branch?** Not answered by this delivery — one order, one branch. It
no longer shapes this ticket: the status template takes `config` as a parameter like `shop`, so the
answer only decides where the value is kept, and that is [T-022](T-022-lab-order-status-in-app.md)'s
roll form. The question moves there.

**3. Resolution — answered: 2088 × 1392 px (2.9 MP), JPEG**, 2.4–4.9 MB each. Twice the
third-party figure of 1.5 MP, still far below a home film scanner. `docs/workflow.md` gets the
number (step 6).

**Found on the way — the file names carry the negative number.** The ZIP holds
`_Bild000_Neg.Nr.25.jpg` … `_Bild011_Neg.Nr.36.jpg`: a running index from 0 and the edge number
of the negative. dm scans only frames that carry an image — this roll had 12, on negatives 25–36,
and 12 prints came with it. `matchScansToFrames` hands the n-th file to the n-th frame, so today
the file of negative 25 is proposed for frame 1 and the whole roll is off by 24. The number is
right there in the name; reading it is a profile property ("scan file names carry the frame
number, pattern `Neg\.Nr\.(\d+)`"), not a dm special case in code. The owner decided the
same day to read it (see "Decisions taken"); it is step 3b.

## Steps

- [x] **Step 0: measure.** Answer the three questions above and record the findings _in this
      ticket_ before writing code. The shape of steps 1 and 2 depends on the first two.
- [x] **Step 1: the domain type.** `LabProfile` in `packages/domain` — id, name, an optional
      status endpoint (URL template plus the names of the parameters it needs), an optional
      download endpoint (URL template; for dm `…/imageCD/{orderId}/{secureId}/download?aak=…`),
      an optional file-name frame pattern, and notes. ~~The status template takes the part of the
      order number after the dash.~~ Measured 2026-09-28: the status API answers the same for
      `540996`, the full `NNNNNN-540996` and the digits without the dash, so the roll keeps the
      order number exactly as printed and nothing splits it.
      `Roll` gains `labProfileId: Id | null`, and the backend a migration for it — the schema
      guard of T-023 fails otherwise. Failing test first: a profile without any endpoint is
      valid, and a roll with no profile is valid.
- [x] **Step 2: the profile data.** `packages/presets/data/lab-profiles.json` with dm as the first
      entry, a `labProfilePresetSchema` in `packages/presets/src/schema.ts` (strict, like every
      other one), the compile-time `Extends` proof, and the data test. ~~Seeded as its own bundle
      id, `lab-profiles`, so an existing installation picks it up.~~ **Changed 2026-09-28:** the
      profiles are read from `@filmnotes/presets` directly and not seeded into the store. Seeding
      would make them a synced collection — store, sync mapping, a PocketBase collection and the
      T-023 guard — for a read-only list with one entry that no screen edits. A roll points at a
      profile by its preset id. When a user-defined profile is wanted, seeding is the step that
      adds it, and nothing here stands in its way.
- [x] **Step 3: the lab client.** A pure function taking a profile and a roll's identifiers,
      returning `{ stateCode, stateText, date, orderNo, deliveryText }` or a typed error (no
      profile, no status endpoint, no order, network down, unexpected shape). Tested against the
      recorded `DELIVERED` fixture from order 540996 and against a profile that has no endpoint.
      _Done 2026-09-28 as `fetchLabOrderStatus` in `labProfile.ts`, the network passed in. The
      fixture is the answer of 2026-09-28 with branch address, customer and shop number replaced.
      That answer also lists what was ordered: "Colorentwicklung Amateur m.Bildbest" and
      "12 × 10x15 Farbbild" — development *with picture selection*, so the lab printed and charged
      only the frames that carried an image. Worth knowing for the next roll's order envelope._
- [x] **Step 3b: scans find their frame by name.** `matchScansToFrames` takes the profile's
      pattern (or none). Failing test first, with the twelve real dm names: `Neg.Nr.25` … `36`
      land on frames 25–36, a name the pattern misses and a roll without pattern keep the
      natural order, two files claiming one frame leave the second unassigned rather than
      guessing. The app import and `filmnotes-import` both pass the roll's profile through.
- [x] **Step 3c: the roll form offers the lab.** "Labor": _kein Labor_ or one of the profiles,
      default none. Without it nothing ever sets `labProfileId` and the "Done when" below is not
      reachable; no step had it. T-022 step 3 adds the lab-specific fields next to it.
- [x] **Step 3d: the CLI downloads through the profile.** `filmnotes-import --roll <id>
--lab-download` fills the roll's profile download template with the roll's order number and
      the Secure-ID and imports the result as a URL source. The Secure-ID is used for that one
      request and never written anywhere (decision above) — not to the roll, a log, or the
      `--json` output.

      _Changed while building it, 2026-09-28:_ the plan said `--secure-id <id>`; a flag would
      have put the code into the shell history — the opposite of "use once, forget". So
      `--lab-download` asks for it in a hidden prompt, like the password, and cuts it (and the URL
      carrying it) out of any error message. Step 3b's rule for mixed names, as built: a name
      without a number, a second claim on one frame, or a frame the roll does not have stays
      unassigned; only a pattern that matches _no_ name falls back to the natural order.

- [x] **Step 4: the workflow loses its mail branch.** Delete the twelve nodes from "Lab mail
      arrives" to "Mail: needs a human" in `automation/n8n/filmnotes-scan-import.json`. The
      schedule branch stays exactly as it is. Import the result into n8n once to prove the JSON
      still loads.

      _Done 2026-09-28:_ 20 nodes → 8, every remaining connection checked to point at an existing
      node, the workflow renamed "filmnotes – lab order status" and its description and the one
      code comment that pointed at the mail branch rewritten. **Not done: the import into n8n** —
      there is no n8n in the sandbox (and no Docker to run one). The owner's re-import is the
      check; the JSON is valid and the schedule branch's nodes are unchanged byte for byte apart
      from that comment.

- [x] **Step 5: `docs/automation.md` says what is true.** The mail section goes; the Secure-ID
      insert, the measured status sequence and the profile concept take its place. The five
      environment variables lose the ones only the mail branch used.
- [x] **Step 6: `docs/workflow.md` gets the self-scan route** as an equal option next to the lab:
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
