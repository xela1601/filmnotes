# T-023 – The backend copies the domain's constants, and only a comment holds them together

**Wave:** backlog, ready to start — the owner's decisions were taken on 2026-09-25
**Depends on:** nothing
**Owns:** `backend/pb_migrations/**` (a new migration only, never an edit to a released one),
`packages/domain/src/**` (a guard test), possibly `scripts/`

**Goal:** The PocketBase schema and `packages/domain/src/types.ts` cannot drift apart silently.

## Why

Found on 2026-09-25 while surveying who consumes `@filmnotes/domain` (the survey that closed
[T-018](done/T-018-domain-package-consumable.md)). The backend does not import the domain package
and never can: its migrations run in PocketBase's own goja VM, which has no npm resolution. So it
restates the domain's data by hand, and today nothing checks that the two still agree.

What is duplicated:

| Domain                                                            | Copy in the backend                                        |
| ----------------------------------------------------------------- | ---------------------------------------------------------- |
| `SERVER_SCAN_MIME_TYPES`, `packages/domain/src/scanFormats.ts:26` | `backend/pb_migrations/1758150000_init_collections.js:176` |
| `RollStatus` (`loaded`/`shot`/`at_lab`/`developed`/`archived`)    | `…init_collections.js:125`                                 |
| `FilmProcess` (`C41`/`BW`/`E6`)                                   | `…init_collections.js:109`                                 |
| `IsoSource` (`DX`/`manual`)                                       | `…init_collections.js:122`                                 |
| `AfCompatibility` (`yes`/`no`/`limited`)                          | `…init_collections.js:85`                                  |
| every collection's field names                                    | `…init_collections.js:33-196`                              |

The whole guarantee is prose. `packages/domain/src/scanFormats.ts:9` says _"Change one, change the
other"_, and the migration's header comment (`:3`) says _"Field names mirror
`packages/domain/src/types.ts` exactly"_. Both are true today and neither is enforced.

**A second, sharper finding:** the server does not enforce the domain unions at all.
`exposureMode`, `focusMode`, `afResult`, `driveMode` and `support` are untyped `text()` fields
(`…init_collections.js:140,146-148,155`), and `frameNo` is a plain `num()` (`:136`). Validation
happens only in the client. A sync bug, a second client, or a hand-edited record can put anything
in those columns and PocketBase will accept it. That is arguably the bigger risk of the two, and
it is a separate choice from the drift guard — enforcing them means the schema has to be changed,
not just checked.

## Decisions taken by the owner, 2026-09-25

**Codegen was dropped before it reached the owner.** Migrations here are additive — there are
three, and every schema change is a new file — so `1758150000_init_collections.js` is frozen and
cannot be generated from `types.ts` after the fact. Generating would only ever apply to future
migrations, which leaves today's duplication exactly as it is. Detection is the only thing that
helps the existing schema, so the guard is a test and there was nothing left to choose.

1. **The guard covers field names too, not only the enums.** The migration's header comment
   claims it mirrors `types.ts` _"exactly"_; the test holds it to that. It costs more test code
   and has to be extended whenever a field is added — accepted, because a renamed or forgotten
   field is the same class of bug as a diverged enum and fails just as late.

2. **The server will reject invalid values.** A new migration turns the five untyped `text()`
   fields into `select()` fields carrying the domain's values, so PocketBase refuses nonsense
   instead of storing it. Chosen over leaving validation to the client, which was defensible only
   while the app is the single writer.

   What it costs, stated plainly: the migration runs against live data, so whatever `pb_data`
   already holds has to be inspected before it does — a stricter schema rejects a record it
   previously accepted. And every future member added to one of these unions needs a migration,
   not just a TypeScript edit. That is the price of the server knowing the rule.

## Steps

- [x] **Step 1: the guard test.** Failing test first, in `packages/domain`. It reads
      `backend/pb_migrations/1758150000_init_collections.js` as text and asserts against the
      domain: the four enum lists (`status`, `process`, `isoSource`, `afCompatible`), the
      `scans.file` MIME list, and every collection's field names. Commit
      `test(domain): the backend schema has to match the domain types`.

      _Delivered 2026-09-28 as `packages/domain/src/backendSchema.test.ts`, with one change to
      the plan:_ it does not read the init migration as text but **replays every file in
      `backend/pb_migrations` in order** (in `node:vm`, against a small stand-in for PocketBase's
      migration API) and compares the resulting schema. Reading one file as text was already
      wrong on the day it was written — `rolls.labOrderId` exists only in the third migration —
      and after step 5 the init file would still say `text("exposureMode")`. The stand-in throws
      on any API call it does not implement, so a future migration cannot slip past it silently.
      The domain side is two object literals typed against `types.ts` (`Record<keyof …, true>`),
      so a new field or union member does not compile until the test lists it. On top of the
      plan it also fails on a `select` field the domain has no union for, and checks that every
      collection carries the sync fields.

- [x] **Step 2: watch it fail on purpose.** Change one side, confirm the test breaks and names
      which list and which value, restore. A guard nobody has seen fail is not known to work.

      _Done 2026-09-28, six mutations, each restored afterwards:_

      | Mutation                                             | What the gate said                                                   |
      | ---------------------------------------------------- | -------------------------------------------------------------------- |
      | `"at_lab"` → `"atlab"` in the init migration          | `rolls.status` values: `- "at_lab"` / `+ "atlab"`                    |
      | `text("lab")` deleted from the init migration         | `rolls`: `missingOnServer: ["lab"]`                                  |
      | `"image/webp"` deleted from `SERVER_SCAN_MIME_TYPES`  | scan formats: `+ "image/webp"`                                       |
      | `labProfileId` added to `Roll` in `types.ts`          | TS2741: `Property 'labProfileId' is missing … DomainFields<"rolls">` |
      | `"lost"` added to `RollStatus`                        | TS2345: `Property 'lost' is missing … Record<RollStatus, true>`      |
      | `support` turned into a `select` in the migration     | unknown selects: `["frames.support"]`                                |

- [x] **Step 3: retire the prose.** The comments standing in for the guard —
      `packages/domain/src/scanFormats.ts:9` ("Change one, change the other") and the migration's
      header claim — become pointers at the test instead of promises nobody can keep.
- [ ] **Step 4: find out what the live data holds.** Before writing the migration, query the
      distinct values of `exposureMode`, `focusMode`, `afResult`, `driveMode` and `support` in
      `pb_data`. Record them here. If anything outside the unions is already stored, decide what
      happens to it — the migration cannot simply be applied over it.

      _Open, 2026-09-28: it needs the owner's server._ The live `pb_data` is a Docker volume on
      the home server and not reachable from the sandbox, so the values were not queried. What
      stands in for the query meanwhile: the migration checks the data itself before it changes
      anything, and on a value outside the unions it **refuses to run and names every record**
      (`<id>: exposureMode = "Av"; …`). Measured with the real binary: the migration runs in one
      transaction, so nothing is half-converted, and PocketBase then does not start. What to do
      with such a value was therefore _not_ decided on the owner's behalf — the default is "stop
      and ask", not "clear it".

      To answer this step without touching the server, run the new migration against a copy of
      a volume snapshot (`docs/deployment.md`, "6. Backup and restore"):

      ```bash
      mkdir -p /tmp/pb-check && tar -xzf filmnotes-pb-<date>.tar.gz -C /tmp/pb-check
      backend/bin/pocketbase migrate up --dir /tmp/pb-check --migrationsDir backend/pb_migrations
      ```

      `Applied 1759050000_frames_select_unions.js` means the live data is clean; otherwise the
      error lists the records. The values found belong in this step, and the box ticked with them.

- [x] **Step 5: the migration.** A new file turning those five fields into `select()` with the
      domain's values, up and down. The backend smoke test covers that a valid record still
      writes and an invalid one is now refused. Commit
      `feat(backend): the server enforces the domain's unions`.

      _Delivered 2026-09-28 as `backend/pb_migrations/1759050000_frames_select_unions.js`._
      Three things the plan did not say:
      - **Six fields, not five.** `flashHead` (`direct`/`bounce`) is a union field stored as
        free text too; the survey above missed it. The owner's decision — the server rejects
        invalid values — covers it for the same reason, so it is in.
      - **A type cannot be changed in place.** PocketBase answers `Field type cannot be changed`
        for a select with the text field's id, and a new field under the old name drops the
        column with its data. So the migration renames each field out of the way, adds the
        select, copies the values in SQL and removes the old field; `down` does the same back.
      - **A second backend test**, `backend/test/frame-unions.test.mjs`, because the smoke test
        only sees an empty database. It brings a database to the migration before, seeds frames,
        then applies the new one the way a deploy does: valid values survive, `down` restores
        text fields with their values, a foreign value stops it with the record named and leaves
        the schema untouched. The smoke test got `3b`: all six valid values write, each foreign
        one is refused with a `400` naming the field.

      `backend/test/**` and `backend/README.md` are outside this ticket's **Owns**; step 5 and 6
      name them, so they were taken as included.

- [x] **Step 6:** changeset (`minor` — it carries a migration), and a line in the backend docs
      saying that adding a union member now needs one too.

      _Done 2026-09-28:_ `.changeset/frames-refuse-foreign-values.md`, and "Changing the schema"
      in `backend/README.md` names the guard test, the enforced unions and what to do when the
      migration refuses to run.

**Done when:** changing an enum value on one side and not the other fails the gate, and the
server refuses a roll whose `exposureMode` is not one of the four the domain allows.
