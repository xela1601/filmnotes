# HANDOFF – how to continue this project in a fresh Claude Code session

This file exists because the planning session ran on the macOS host inside the Claude Code
sandbox, which forbids creating `.git` in the project directory. Development runs inside a
Docker Sandbox started with `sbx env run` from this directory (see `sandbox/README.md`;
`sbxenv.yaml` wires the custom template, the kit with git identity, ports and SSH agent).
Follow the steps below in order.

## 0. Context to load first

1. `prompt.md` – the owner's original brief (German).
2. `docs/superpowers/specs/2026-09-18-analogue-photography-app-design.md` – the approved design.
3. `docs/tickets/README.md` – ticket index, waves, ownership rules, global constraints.
4. `CLAUDE.md` in the repo root (created by T-001; until then the conventions are in the ticket index).

Owner decisions already taken (do not re-ask): Expo + TypeScript; offline-first with PocketBase sync;
single user now, multi-user-ready schema; scans via folder/ZIP import (no lab API exists);
auto-match by filename + manual correction; exporters WordPress + share package, extensible;
code/docs English, UI de+en; TDD; conventional commits; parallel agents, one ticket each.

## 1. Environment check (inside the Docker sandbox)

```bash
node --version      # ≥ 20 required (22 preferred)
npm --version
git --version
unzip -v | head -1  # optional, used by backend fetch script
```

Docker is **not** available inside the sandbox; the backend is tested with the PocketBase binary.
The sandbox provides it at `$FILMNOTES_PB_BIN` (`/opt/pocketbase/pocketbase`); T-004's fetch script
must use that path when the variable is set and only download otherwise.

If `.claude/settings.json` (Claude Code sandbox settings from the host) causes warnings in the
container (bubblewrap missing), that is expected: `failIfUnavailable` is false. Do not delete the
file – the owner decides about it.

## 2. Initialise git (first thing, nothing else before)

```bash
git init -b main
git config user.name            # must print "Alexander Schreiner" (from the kit's ~/.gitconfig)
git config user.email           # must print github@alexander-schreiner.de – if not, stop and tell the owner
git add prompt.md Minolta_7000_AF_Preset.md docs .claude .npmrc sandbox sbxenv.yaml
git commit -m "docs: project brief, design spec, ticket plan and sandbox setup"
```

Commit trailer for every commit: `Co-Authored-By: Claude <noreply@anthropic.com>` (use the model
name the session reports).

## 3. Wave 0 – T-001 yourself (sequential)

Execute `docs/tickets/done/T-001-monorepo-scaffold.md` step by step in the main session. It creates the
type contracts everything else depends on. Verify `npm test` and commit as specified.

## 4. Waves 1–3 – parallel subagents in worktrees

Use the `superpowers:subagent-driven-development` skill. For each ticket of the current wave:

1. Create a worktree + branch: `git worktree add .claude/worktrees/T-00X -b ticket/T-00X-<slug> main`
   (`.claude/worktrees/` is git-ignored by T-001).
2. Dispatch one subagent with `isolation: "worktree"` or pointing at that path. Its prompt must contain:
   the ticket file path, the spec path, the ticket index (constraints), the instruction to run
   `npm install` at its worktree root once, TDD, commits with conventional messages, and to report
   back: commits made, test output summary, any request for shared-file changes (root config,
   `app.json`), open questions.
3. When a wave's agents report done: for each branch in dependency order
   `git merge --no-ff ticket/T-00X-…` into `main`, resolve conflicts (shared files only:
   `package-lock.json`, `app.json`, `apps/mobile/package.json`), run `npm install && npm test`
   at the root, fix or send back to the agent, commit the merge.
4. Apply the agents' requested shared-file changes yourself (e.g. `expo-location` plugin in
   `app.json`, `backend` exclusion in root jest config) in a small `chore:` commit.
5. Remove merged worktrees: `git worktree remove .claude/worktrees/T-00X`.

Wave order and dependencies are in `docs/tickets/README.md`. Wave 1 = T-002, T-003, T-004, T-005
in parallel. Wave 2 = T-006, T-007, T-008, T-010. Wave 3 = T-009, T-011, T-012, T-013, then T-014.

Rules for the agents (copy into every prompt):

- Only edit paths under your ticket's **Owns**. Never edit root config or another ticket's files.
- Failing test first. Root `npm test` green before reporting done.
- If a needed interface from another ticket is missing in your worktree (because that ticket is not
  merged yet), stub it locally under your own paths with a `// TODO(T-00X)` comment and tell the
  integrator; do not implement another ticket's scope.
- Use `npx expo install` for Expo packages, plain `npm install <pkg> -w <workspace>` otherwise.
- Do not run `docker`, do not touch `backend/pb_data`, never commit secrets.

## 5. Verification before declaring the project done

- `npm test` at root is green, `npm run typecheck` clean.
- `npx expo export --platform web -w @filmnotes/mobile` succeeds.
- Backend smoke test green with the fetched binary.
- Core scenario (spec §2.1 steps 1–4) walked through in the web build; steps 5–6 with the local
  PocketBase and 3 sample JPEGs (generate them with a tiny script; do not download images).
- `docs/workflow.md` and `docs/deployment.md` exist and match the real scripts.

## 6. Report to the owner (German is fine)

List: merged tickets, test counts, what was verified manually, decisions taken on their behalf
(add them to spec §7), open items, and the exact commands to run the web app and the backend.
