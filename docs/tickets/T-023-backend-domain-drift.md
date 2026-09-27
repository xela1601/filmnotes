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

- [ ] **Step 1: the guard test.** Failing test first, in `packages/domain`. It reads
      `backend/pb_migrations/1758150000_init_collections.js` as text and asserts against the
      domain: the four enum lists (`status`, `process`, `isoSource`, `afCompatible`), the
      `scans.file` MIME list, and every collection's field names. Commit
      `test(domain): the backend schema has to match the domain types`.
- [ ] **Step 2: watch it fail on purpose.** Change one side, confirm the test breaks and names
      which list and which value, restore. A guard nobody has seen fail is not known to work.
- [ ] **Step 3: retire the prose.** The comments standing in for the guard —
      `packages/domain/src/scanFormats.ts:9` ("Change one, change the other") and the migration's
      header claim — become pointers at the test instead of promises nobody can keep.
- [ ] **Step 4: find out what the live data holds.** Before writing the migration, query the
      distinct values of `exposureMode`, `focusMode`, `afResult`, `driveMode` and `support` in
      `pb_data`. Record them here. If anything outside the unions is already stored, decide what
      happens to it — the migration cannot simply be applied over it.
- [ ] **Step 5: the migration.** A new file turning those five fields into `select()` with the
      domain's values, up and down. The backend smoke test covers that a valid record still
      writes and an invalid one is now refused. Commit
      `feat(backend): the server enforces the domain's unions`.
- [ ] **Step 6:** changeset (`minor` — it carries a migration), and a line in the backend docs
      saying that adding a union member now needs one too.

**Done when:** changing an enum value on one side and not the other fails the gate, and the
server refuses a roll whose `exposureMode` is not one of the four the domain allows.
