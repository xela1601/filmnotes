---
"@filmnotes/mobile": patch
---

Quality gates for the work itself: ESLint 10 and Prettier with type-aware linting outside the app,
`npm run typecheck` covering the Expo app as well, and a guided screenshot tour that drives the
exported web bundle in a real browser (`mise run screenshots`, 13 scenes in light and dark) with a
browser-free dry run for CI (`mise run check:tour`). The tour earned its keep immediately: it found
the boot crash and the unreachable picker listed above.
