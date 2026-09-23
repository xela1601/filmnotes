# T-018 – Should `@filmnotes/domain` be consumable outside the monorepo?

**Wave:** backlog — one decision, then either a small ticket or none at all
**Depends on:** nothing
**Owns:** `packages/domain/package.json`, `packages/domain/tsconfig.json`, the root `typecheck`
script, `tools/scan-import/bin/filmnotes-import.cjs`

**Goal:** Decide whether the domain package stays source-only or gains a build, and act on it.

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

## The decision

- **(a) Leave it source-only.** Delete the second sentence of the claim, keep the purity guard.
  Costs nothing, and the CLI keeps needing `tsx` at runtime. _Proposed until something outside the
  monorepo actually wants the package._
- **(b) Add a Node build.** `packages/domain/tsconfig.build.json` emitting CommonJS to `dist/`,
  conditional `exports` (`"react-native"` and the TypeScript path staying on source, `require`/
  `import` on `dist`), a `build` script, and `dist` in `.gitignore`. Then `filmnotes-import` can
  drop `tsx` and start faster, and the package could be published one day.

## Steps, if (b)

- [ ] **Step 1:** the build config and the `exports` conditions. Verify with
      `node -e "require('@filmnotes/domain')"` after a build.
- [ ] **Step 2:** prove the rest still resolves source — `npm test`, `npm run typecheck`,
      `mise run check:web` — and that a _stale_ `dist` cannot be picked up by the tests.
- [ ] **Step 3:** drop `tsx/cjs` from the CLI entry point and check `filmnotes-import --help`.
- [ ] **Step 4:** a CI step that fails if `dist` is missing where it is needed.

**Done when:** the command in "The finding" prints an id, and the full gate is green.
