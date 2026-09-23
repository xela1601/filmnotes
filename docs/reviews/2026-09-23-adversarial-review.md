# Attack protocol: the filmnotes repository

Date: 2026-09-23. Generator: Opus 5 (the session that wrote most of this code).
Attackers: seven, Sonnet, fresh context each, no access to the generator's reasoning or diffs.
Referee: Opus 5, fresh context, twice.
Rounds: 2. **Stop reason: the round limit was not reached — round 2 still produced VALID findings,
so the artifact is not proven quiet.** A third round is warranted and has not been run.

An agent that reviews its own work confirms it. This review split the job into three roles with
opposed incentives: the generator built the artifact, an attacker only wins by producing a
reproducible failure, and a referee decides against a written specification whether a failure
counts. An opinion is not a finding; an executed attack is.

## Specification

30 claims in round 1, extended to 35 in round 2 when the themes were added. They are derived from
`README.md`, `CLAUDE.md`, `docs/*.md` and the project's stated goal of being easy to maintain and
extend — not invented for the review.

- **A1–A5** layering: the domain package is pure and consumable; the workspace graph is acyclic
  and one-directional; every cross-workspace import is declared; shared logic exists once; every
  workspace's suite runs alone.
- **B1–B7** extensibility: a film stock is data only; an export target needs one registration
  point; a string is one key per language; the locales have identical key sets; no literal UI text;
  a locale is a bounded change; visual style lives in one place.
- **C1–C5** single source of truth: schema versus sync mapping; scan formats across app and CLI;
  one version everywhere; ids and timestamps; YAML file extensions.
- **D1–D8** pipeline: the time zone is pinned before the workers start; a wrong zone fails loudly;
  no image without green checks on the tagged commit; the checks are defined once; the tag is
  validated before anything is built; a manual re-publish verifies the tag; every reference
  resolves; the gate is green at HEAD.
- **E1–E6** documentation and secrets: the README's commands run as written; the runbook names
  only what exists; "Current limits" is accurate; the layout tree matches; no committed secret;
  every relative link resolves.
- **F1–F5** themes (round 2): every palette meets WCAG AA; the choice is applied and survives a
  restart; a fixed-scheme theme stays in its scheme; adding a theme is one file; the picker offers
  all of them.

## Findings

17 candidates over two rounds. **Every one arrived with an executed repro and observed output**,
so none was dropped as a hypothesis. The referee upheld 15, rejected 1 and returned 1 as a gap in
the specification itself.

| #      | Claim | Verdict  | Severity | Fix                                                              | Re-run                          |
| ------ | ----- | -------- | -------- | ---------------------------------------------------------------- | ------------------------------- |
| R1-F1  | A1    | VALID    | major    | not fixed at the cause — see T-018; purity guarded by a new test | guard passes, claim still fails |
| R1-F2  | A4    | INVALID  | —        | two different transport adapters, not copies                     | —                               |
| R1-F3  | B2    | VALID    | major    | one table in `features/export/exporterConfig.ts`                 | passes                          |
| R1-F4  | B6    | VALID    | major    | the language wiring is one file, `i18n/resources.ts`             | passes                          |
| R1-F5  | B7    | VALID    | major    | `ui/themes.ts` + 23 files converted + two guard tests            | passes                          |
| R1-F6  | C2    | VALID    | major    | the CLI reads the same accepted-type list as the app             | passes                          |
| R1-F7  | D6    | VALID    | major    | the ancestry check tests the tagged commit, not `GITHUB_SHA`     | passes                          |
| R1-F8  | D5    | VALID    | minor    | `scripts/check-release-version.mjs` walks every manifest         | passes                          |
| R1-F9  | E1    | VALID    | minor    | the README no longer enumerates the mise tasks                   | passes                          |
| R1-F10 | E2    | VALID    | major    | the Compose project is named, so the volume name is stable       | passes                          |
| R1-F11 | E4    | VALID    | minor    | the layout tree lists every tracked top-level directory          | passes                          |
| R1-F12 | E3    | VALID    | major    | README and workflow.md describe the foreground sync correctly    | passes                          |
| R2-F1  | D7    | VALID    | minor    | the Dockerfile comment names `publish.yaml`                      | passes                          |
| R2-F2  | D7    | VALID    | minor    | both `.env.example` files name `compose.yaml`                    | passes                          |
| R2-F3  | E2    | SPEC GAP | —        | fixed anyway: §5 described a build the server does not do        | passes                          |
| R2-F4  | B6    | VALID    | major    | the language picker derives from `SUPPORTED_LANGUAGES`           | passes                          |
| R2-F5  | B7    | VALID    | major    | font weight and letter spacing are tokens; guard extended        | passes                          |

### The three that were worth the whole exercise

**R1-F7 — an off-main tag would have been published.** `publish.yaml` checked
`git merge-base --is-ancestor "$GITHUB_SHA" origin/main`, and on a `workflow_dispatch` re-publish
`GITHUB_SHA` is the commit of the _branch the run was started from_, not the tag being built. The
attacker built a scratch repository with a tag on an orphan commit and ran the step verbatim:

```
PASSED - step does not reject, although tag v9.9.9-rogue (df2d533…) is not on main
```

Fixed by testing `git rev-parse HEAD`, which is the tag, because the checkout above it is at the
tag. The guard that was supposed to mean "only what CI has seen gets published" now means it.

**R1-F12 — the README described a feature that does not behave that way.** "Sync is manual and
lives on one screen. Nothing syncs at app start or in the background." In fact `useSync()` is
mounted in the root layout and an `AppState` listener syncs on every return to the foreground,
throttled to once a minute. The code is deliberate and says so; the documentation had simply never
caught up. Both documents now describe it.

**R2-F4 — a repair that did not go far enough.** Round 1 found that adding a language meant editing
six files and fixed it down to one. Round 2 then showed that a language registered in that one
file still never appears in the settings screen, because the picker hard-coded
`["system", "de", "en"]` — two lines above a theme picker built from `THEME_IDS` with a comment
explaining that a theme must "appear by existing". This is the argument for a second round: the
most likely place for a new defect is the place that was just repaired.

## Hypotheses

Reported but not executed, so not judged. They are leads, not findings.

- **B1** — whether a schema violation reported as `path: [22, "iso"]` is usable in a catalogue of
  100+ entries, where the array index alone is hard to act on.
- **B5** — dynamic keys built from template literals (`validation.${issue.code}`,
  `${prefix}.${value}`) were spot-checked, not exhaustively enumerated against both locales.
- **F1** — `onPrimary` on `danger` (the destructive button) is outside the four pairings the claim
  names and was never measured.
- **D3/D4** — the `check:web` and `check:tour` jobs were read, not run against a deliberately
  broken bundle to prove they fail red.
- **D7** — `docker compose up` against `backend/compose.yaml` without a `.env` present; the Docker
  daemon is unavailable in the development sandbox.

## Not attacked

- Anything needing a device or a simulator: the app's actual appearance, the native modules, and
  therefore all of T-016.
- Anything needing the Docker daemon: the image builds, its layers, its size, whether it runs.
- The PocketBase API rules under a _second_ user — the schema says single-user, and no attacker
  created one.
- The sync engine's conflict resolution under concurrent edits from two devices.
- The n8n automation in `automation/`, which was never executed against a real instance.

## What this cost and what it bought

Seven attackers and two referees, about 900k tokens. It found one defect that would have published
an unverified image, two documents that confidently described behaviour the code does not have,
and — the part that matters for a codebase meant to be extended — three places where adding an
ordinary thing (a language, an export target, a theme) cost more edits than anyone had noticed,
because the person who wrote them knew where all the pieces were.
