# Ticket Index – Analogue Photography Notes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (one fresh subagent per ticket, in its own git worktree) or superpowers:executing-plans. Each ticket file is self-contained; steps use checkbox (`- [ ]`) syntax.

**Goal:** Build an offline-first Expo app (iOS/Android/web) plus a PocketBase backend to record per-frame notes for analogue film rolls, attach lab scans later, and export frames to WordPress or as social-media share packages.

**Architecture:** npm-workspaces monorepo. Pure TypeScript logic in `packages/*` (domain rules, presets, exporters) is framework-free and unit-tested with Jest. The Expo app in `apps/mobile` holds UI, a persisted Zustand store with an outbox, and the sync layer to PocketBase. The backend is PocketBase with versioned JS migrations, deployed in Docker.

**Tech Stack:** Expo SDK (latest stable at scaffold time) + expo-router, TypeScript strict, Zustand (+persist), i18next, PocketBase ≥ 0.40 with `pocketbase` JS SDK, Jest (+ts-jest, jest-expo, @testing-library/react-native), fflate (ZIP), zod (config schemas).

**Spec:** `docs/superpowers/specs/2026-09-18-analogue-photography-app-design.md` – read it first; every ticket argues from it.

## Global Constraints

- Code, comments, commit messages, tickets, docs: **English**. UI strings only through i18n keys, `de` is default, `en` second.
- TypeScript `strict: true` everywhere. No `any` in `packages/*`.
- **TDD:** write the failing test, run it, implement, run again, commit. Root `npm test` must be green before a ticket is declared done.
- Conventional commits: `feat(domain): …`, `test(app): …`, `chore(backend): …`, `docs: …`. Small commits per TDD step where sensible.
- All commands run inside the sandbox. npm uses the project-local cache (`.npmrc` → `cache=.npm-cache`). Never run `npm install` with a different cache location.
- Each agent works **only inside the paths listed under "Owns"** in its ticket. Shared root files (`package.json`, `package-lock.json`, `tsconfig.base.json`, `jest.config.js`) belong to T-001 and afterwards to the integrator. If a ticket needs a new dependency, the agent adds it to **its own workspace's** `package.json` and runs `npm install` from the repo root (the lockfile change is accepted by the integrator).
- Ids are 15-character lowercase alphanumeric strings (`/^[a-z0-9]{15}$/`), generated with `newId()` from `@filmnotes/domain`.
- Package names: `@filmnotes/domain`, `@filmnotes/presets`, `@filmnotes/exporters`, `@filmnotes/mobile`, `@filmnotes/scan-import`.
- Dates are ISO-8601 strings in UTC (`new Date().toISOString()`).

## Waves and dependencies

```
Wave 0 (integrator, sequential)
  T-001 Monorepo scaffold + domain type contracts

Wave 1 (parallel, all depend only on T-001)
  T-002 Domain rules & helpers            packages/domain
  T-003 Presets package                   packages/presets
  T-004 PocketBase backend                backend/
  T-005 Expo app skeleton + store + i18n  apps/mobile (skeleton files only)

Wave 2 (parallel)
  T-006 Roll management UI                apps/mobile/src/features/rolls, app/rolls     needs T-002, T-003, T-005
  T-007 Frame capture & edit UI           apps/mobile/src/features/frames, app/frames   needs T-002, T-003, T-005
  T-008 Sync engine                       apps/mobile/src/sync                          needs T-004, T-005
  T-010 Exporters package                 packages/exporters                            needs T-002

Wave 3 (parallel)
  T-009 Scan import & review UI           apps/mobile/src/features/scans                needs T-006, T-008
  T-011 Export UI                         apps/mobile/src/features/export               needs T-007, T-010
  T-012 Equipment management UI           apps/mobile/src/features/equipment            needs T-005, T-003
  T-013 Scan-import CLI                   tools/scan-import                             needs T-002, T-004
  T-014 Workflow & deployment docs        docs/                                         needs everything (last)
```

```
Backlog (refined, not scheduled - pick one up when it is worth the time)
  T-015 Frame metadata into the scans     packages/domain, packages/exporters, tools/scan-import
  T-016 Native tab bar (Liquid Glass)     apps/mobile/app/(tabs), apps/mobile/e2e
  T-018 Domain package outside the repo?   packages/domain          (one owner decision)
  T-019 Repository-scoped push access      sbxenv.yaml, sandbox/kit (host steps for the owner)
```

Integrator merges each finished ticket branch into `main` in wave order, runs `npm test`, then starts the next wave. Waves 0-3 are merged; what is in the backlog needs a decision from the owner before it starts (each such ticket says which).

**The review behind T-016 and T-018:**
[`docs/reviews/2026-09-23-adversarial-review.md`](../reviews/2026-09-23-adversarial-review.md) —
what was attacked, what was upheld, and what was deliberately not attacked.

**How this board is kept:** a delivered ticket moves to [`done/`](done/), with every step ticked
and a `**Status:**` line saying when it was verified. What is left in this directory is what is
open. Every new requirement becomes a ticket here _before_ it becomes code — including the ones
that arrive in conversation, which is how T-016, T-017 and T-018 came about.

**Where things stand (audited 2026-09-23):** T-001 to T-014 are delivered - every file those
tickets name exists, and the full gate is green. Their step checkboxes had simply never been
ticked, which is bookkeeping and not open work; they are ticked now. **T-015 is the only open
ticket**, and it sits in the backlog on purpose: it needs three decisions from the owner before
anyone starts (see the ticket).

| Ticket                                      | Title                                                   | Owns                                                                                                            | Status  |
| ------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------- |
| [T-001](done/T-001-monorepo-scaffold.md)    | Monorepo scaffold + type contracts                      | root files, `packages/domain/src/types.ts`, `packages/domain/src/id.ts`                                         | done    |
| [T-002](done/T-002-domain-rules.md)         | Domain rules & helpers                                  | `packages/domain/**` (except `types.ts`, `id.ts`)                                                               | done    |
| [T-003](done/T-003-presets-package.md)      | Presets package                                         | `packages/presets/**`                                                                                           | done    |
| [T-004](done/T-004-pocketbase-backend.md)   | PocketBase backend                                      | `backend/**`                                                                                                    | done    |
| [T-005](done/T-005-app-skeleton.md)         | Expo app skeleton, store, i18n                          | `apps/mobile/**` except `src/features/**`                                                                       | done    |
| [T-006](done/T-006-roll-ui.md)              | Roll management UI                                      | `apps/mobile/src/features/rolls/**`, `apps/mobile/app/(tabs)/index.tsx`, `apps/mobile/app/rolls/**`             | done    |
| [T-007](done/T-007-frame-ui.md)             | Frame capture & edit UI                                 | `apps/mobile/src/features/frames/**`, `apps/mobile/app/frames/**`                                               | done    |
| [T-008](done/T-008-sync-engine.md)          | Sync engine                                             | `apps/mobile/src/sync/**`, `apps/mobile/app/settings/server.tsx`                                                | done    |
| [T-009](done/T-009-scan-import-ui.md)       | Scan import & review UI                                 | `apps/mobile/src/features/scans/**`, `apps/mobile/app/scans/**`                                                 | done    |
| [T-010](done/T-010-exporters-package.md)    | Exporters package                                       | `packages/exporters/**`                                                                                         | done    |
| [T-011](done/T-011-export-ui.md)            | Export UI                                               | `apps/mobile/src/features/export/**`, `apps/mobile/app/export/**`, `apps/mobile/app/settings/wordpress.tsx`     | done    |
| [T-012](done/T-012-equipment-ui.md)         | Equipment management UI                                 | `apps/mobile/src/features/equipment/**`, `apps/mobile/app/(tabs)/equipment.tsx`, `apps/mobile/app/equipment/**` | done    |
| [T-013](done/T-013-scan-import-cli.md)      | Scan-import CLI                                         | `tools/scan-import/**`                                                                                          | done    |
| [T-014](done/T-014-docs.md)                 | Workflow & deployment docs                              | `docs/workflow.md`, `docs/deployment.md`, `README.md`                                                           | done    |
| [T-015](T-015-scan-metadata.md)             | Frame metadata into the scans (EXIF/XMP) — _backlog_    | `packages/domain/src/frameMetadata.*`, `packages/exporters/src/embedMetadata.*`, `tools/scan-import/src/tag.*`  | backlog |
| [T-016](T-016-native-tab-bar.md)            | Native tab bar, Liquid Glass on iOS 26 — _backlog_      | `apps/mobile/app/(tabs)/_layout.tsx`, `apps/mobile/e2e/**`                                                      | backlog |
| [T-017](done/T-017-themes.md)               | Themes and design tokens                                | `apps/mobile/src/ui/themes.ts`, every `StyleSheet` under `apps/mobile`                                          | done    |
| [T-018](T-018-domain-package-consumable.md) | Domain package consumable outside the repo? — _backlog_ | `packages/domain/package.json`, `packages/domain/tsconfig.json`                                                 | backlog |
