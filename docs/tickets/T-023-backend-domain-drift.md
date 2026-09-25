# T-023 – The backend copies the domain's constants, and only a comment holds them together

**Wave:** backlog, not scheduled — needs the owner decision below before it starts
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

## The decision the owner has to make

1. **A guard test, or codegen?**
   - **(a) A test that compares the two.** It reads the migration and asserts that its enum
     values and MIME list match the domain's. Cheap, no new build step, and it fails loudly the
     moment somebody changes one side. It does not stop the drift, it reports it. _Proposed._
   - **(b) Generate the migration's constants from `types.ts`.** A script writes the enum lists
     and the MIME list into a generated file the migration imports, so drift is impossible by
     construction. More machinery, and generated code inside `pb_migrations/` sits awkwardly next
     to the rule that a released migration is never edited.
2. **Enforce the unions server-side, or leave validation to the client?** Turning those `text()`
   fields into `select()` fields with the domain's values would make the server reject nonsense —
   but it needs a _new_ migration against live data (`pb_data` may already hold values that a
   stricter schema rejects), and it hard-codes the unions in a place that then has to be migrated
   again every time one gains a member. Leaving it is defensible if the app stays the only writer.
   This can also be split off into its own ticket if the answer is "yes, but not now".

## Steps, once (1) is answered

- [ ] **Step 1:** the guard — test or generator, per the decision. It must cover the MIME list and
      the four enums in the table above.
- [ ] **Step 2:** make it fail on purpose once (change one side, watch it break), then restore.
      A guard nobody has seen fail is not known to work.
- [ ] **Step 3:** delete the two prose comments that were standing in for it, or reduce them to a
      pointer at the guard.
- [ ] **Step 4 (only if decision 2 says so):** a new migration turning the union fields into
      `select()`, with a check of what `pb_data` currently holds before it runs.

**Done when:** changing an enum value on one side and not the other fails the gate.
