# T-018 – Should `@filmnotes/domain` be consumable outside the monorepo?

**Wave:** out of band — one decision, taken on 2026-09-25
**Depends on:** nothing
**Owns:** `packages/domain/package.json`, `packages/domain/tsconfig.json`, the root `typecheck`
script, `tools/scan-import/bin/filmnotes-import.cjs`

**Goal:** Decide whether the domain package stays source-only or gains a build, and act on it.

**Status:** done — decided 2026-09-25, option (a): the package stays source-only. Nothing was
built, which is the point; what the decision rests on is recorded below.

## The finding

An adversarial review upheld this against the claim _"`@filmnotes/domain` is pure TypeScript …
It can be imported and used from a plain Node script"_:

```bash
node -e "const d = require('@filmnotes/domain'); console.log(d.newId())"
# Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../packages/domain/src/types'
```

`main`, `types` and `exports` all point at `src/index.ts`, uncompiled. The package is only ever
loaded through something that transpiles TypeScript: metro for the app, `ts-jest` for the tests,
and `tsx` for the CLI, which is why `tools/scan-import/bin/filmnotes-import.cjs` requires
`tsx/cjs` before anything else.

## Why it was not simply fixed

Repointing the entry at `dist/` is not a one-line change. Jest resolves the package through that
same entry and deliberately transforms its sources (`transformIgnorePatterns` in
`apps/mobile/jest.config.js` allows `@filmnotes`). Making the build output the entry means every
test run depends on a fresh build, and a forgotten build silently tests old code — a bad trade for
a consumer that does not exist: nothing outside this monorepo imports the package, and nothing is
published to a registry.

What was done instead: `packages/domain/src/purity.test.ts` walks the sources and fails if any of
them imports anything outside the package, which is the substance the claim was written for.

## Who actually wants it — surveyed before deciding, 2026-09-25

The question "should it be consumable from outside" is only worth money if somebody outside wants
it. A sweep of every consumer in the repository found this:

- **Nobody outside the monorepo loads it.** Every importer is in `apps/mobile/`,
  `packages/exporters/`, `packages/presets/` or `tools/scan-import/`. Nothing is published to a
  registry.
- **`tools/scan-import` is the one place that pays for the missing build.** It ships as an
  executable, so it carries `tsx` as a _runtime_ dependency (`package.json:22`) and loads it in
  its entry point before anything else (`bin/filmnotes-import.cjs:12`). A transpiler starts on
  every invocation of a CLI that the n8n workflow calls on a schedule. That is the entire
  measurable benefit of (b): start-up time, not a capability anyone lacks.
- **`backend/` could never consume it anyway.** The migrations run in PocketBase's own goja VM,
  which has no npm resolution. A `dist/` changes nothing there.
- **The n8n workflow does not need it either** — it reaches the domain logic indirectly, by
  calling that same CLI (`npm run import -w @filmnotes/scan-import`).

## The decision: (a), the package stays source-only

Confirmed by the owner on 2026-09-25 with the survey above in hand. One beneficiary, and what it
gains is a faster start rather than something it cannot do today — against a real cost on the
other side: with the build output as the package entry, every test run depends on a fresh build,
and a forgotten build silently tests stale code. That trade is bad while the only consumer is
inside the repository and already works.

The purity guard (`packages/domain/src/purity.test.ts`) stays: it is what the original claim was
written for, and it keeps holding regardless of this decision.

**What (b) would have been, if this is ever revisited:**
`packages/domain/tsconfig.build.json` emitting CommonJS to `dist/`, conditional `exports` (the
`"react-native"` and TypeScript conditions staying on source, `require`/`import` pointing at
`dist`), a `build` script, `dist` already in `.gitignore`; then `filmnotes-import` drops `tsx`,
and the package could be published. Revisit it when the CLI's start-up actually hurts, or when
something outside this repository wants the package — neither is true today.

## The finding is left standing, not papered over

`node -e "require('@filmnotes/domain')"` still fails, on purpose. What changes is the claim, not
the code: **`@filmnotes/domain` is pure, not portable.** The adversarial review's A1 asserted both
("pure and consumable"); only the first half is upheld, and
[`docs/reviews/2026-09-23-adversarial-review.md`](../../reviews/2026-09-23-adversarial-review.md)
records that outcome against R1-F1.

## Related, found by the same survey

The backend duplicates domain _constants_ by hand — see
[T-023](../T-023-backend-domain-drift.md). A build of this package would not have fixed that, which
is part of why (b) looked less useful than it first sounds.
