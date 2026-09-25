# HANDOFF – how to continue this project in a fresh Claude Code session

Last rewritten 2026-09-25. It described bootstrapping the repository until then — `git init`,
waves 0–3 — which has been wrong for weeks and would have told a fresh session to re-initialise
an existing repository. If what you read here no longer matches what you find, fix this file in
the same session; a handoff that lies is worse than none.

## Where the project stands

The application is built and merged. T-001 to T-014 delivered the monorepo, the domain rules,
the presets, the PocketBase backend, the Expo app with roll/frame/equipment/scan/export UI, the
sync engine, the CLI and the docs; T-017 added themes. The gate is green: **695 tests**, ESLint
and Prettier clean.

The three sandbox tickets are closed too. Inside the sandbox you can `ssh` and `git push` over
the deploy key, and open PRs with `gh`, all from an ordinary Bash tool call.

**Nothing is waiting on the owner.** Four tickets are decided and ready to start:

| Ticket                                            | What it is                                  | Note                                               |
| ------------------------------------------------- | ------------------------------------------- | -------------------------------------------------- |
| [T-023](tickets/T-023-backend-domain-drift.md)    | Guard the backend schema against `types.ts` | smallest; protects the other three                 |
| [T-022](tickets/T-022-lab-order-status-in-app.md) | Lab order status in the app                 | step 0 measures the `config` parameter first       |
| [T-015](tickets/T-015-scan-metadata.md)           | Frame metadata into the scans (EXIF)        | XMP is a later pass                                |
| [T-016](tickets/T-016-native-tab-bar.md)          | Native tab bar                              | **step 4 needs the owner's Mac**, not this sandbox |

Each ticket carries the owner's decision _and what it costs_. Do not re-open a decision that is
recorded there; if you think one is wrong, say so and let the owner choose again.

## 0. Context to load first

1. `docs/tickets/README.md` — the board: status of every ticket, the global constraints.
2. `CLAUDE.md` in the repo root — conventions, git remotes, how to run commands that need the
   network. Read it before the first `npm install`.
3. Your ticket in `docs/tickets/`.
4. `docs/superpowers/specs/2026-09-18-analogue-photography-app-design.md` — the design, when the
   ticket argues from it.

`prompt.md` holds the owner's original brief. Owner decisions already taken, do not re-ask:
Expo + TypeScript; offline-first with PocketBase sync; single user now, multi-user-ready schema;
scans via folder/ZIP import; auto-match by filename with manual correction; exporters WordPress
plus share package; code and docs English, UI `de`+`en`; TDD; conventional commits.

## 1. Check the environment

```bash
make -C sandbox doctor     # from the host: tools, mounts, network policy, git identity, GitHub
```

From inside a Claude Code Bash call, run `sandbox-doctor` directly — but note its GitHub check
reports `[info] … name resolution` there, because the script as a whole is not in
`excludedCommands` and its inner `ssh` lands back in Claude Code's own tunnel. Via `make doctor`
the same check passes. That is expected, not a fault; see
`docs/tickets/done/T-021-sandbox-ssh-double-proxy.md`.

Docker is **not** available inside the sandbox. The PocketBase binary is at `$FILMNOTES_PB_BIN`.

## 2. Work the ticket

TDD, as the board says: failing test → run → implement → run → commit, ticking the step's
checkbox in the same commit as the work. Stay inside the paths your ticket lists under **Owns**.

Before reporting done: `npm test`, `npm run lint`, `npm run format` at the repo root. Anything a
user would notice also needs a changeset (`mise run changeset`) in the same commit.

Commands that touch the network need the proxy wrapper — `sandbox/proxy/with-proxy.sh npm install`.
`git`, `curl` and Node's `fetch` do not. `CLAUDE.md` has the details and the Expo `$HOME` caveat.

## 3. Land the work

`main` is protected: no direct push, no force push, no branch deletion on it. The route is

```bash
git checkout -b <type>/<slug>
git push -u deploy <branch>                      # deploy = SSH, the deploy key
gh pr create --repo xela1601/filmnotes --fill    # works since T-020
```

`git push origin` over HTTPS fails by design — the API token carries no `Contents` permission.
**Merging stays the owner's call** unless they ask for it. They squash-merge, so afterwards
reset your local `main` to `deploy/main` rather than merging it back.

## 4. If something about GitHub breaks

Look at the credential on the host, never at `GH_TOKEN` inside the sandbox — that is a
placeholder the proxy swaps, and reading it tells you nothing. The token comes from Bitwarden at
sandbox creation (`secrets.github.command` in `sbxenv.yaml`), so a locked vault at
`make -C sandbox sbx-create` is the usual cause. `docs/tickets/done/T-020-sandbox-gh-cli-access.md`
records the whole diagnosis, including two measurements that look like evidence and are not.

## 5. Report to the owner

German is fine. Say what was done, what the tests show, what you decided on their behalf, and
what is still open — including anything you could not verify from inside the sandbox.
