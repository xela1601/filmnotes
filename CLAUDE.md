# filmnotes – agent conventions

- Read `docs/superpowers/specs/2026-09-18-analogue-photography-app-design.md` and your ticket in `docs/tickets/` before touching code.

## The tickets are the requirements

- `docs/tickets/` is the primary source of what is to be built. Open tickets live there; a
  delivered one moves to `docs/tickets/done/` with every step ticked and a `**Status:**` line
  saying when it was verified and how. `docs/tickets/README.md` is the index and carries a status
  column.
- **A new requirement becomes a ticket before it becomes code** - including one that arrives in
  conversation. Write it up, and ask the owner what is genuinely ambiguous _before_ starting:
  what the thing is for, what is explicitly out of scope, which decisions only they can make. A
  ticket that starts with an unasked question produces the wrong software politely.
- **Tick the checkbox when the step is done**, in the same commit as the work, not afterwards from
  memory. An unticked box means open; that is only true if it is kept true.
- A ticket records the decisions behind it, not just the steps: where the requirement came from,
  what was chosen instead of what, and what is deliberately left out.
- TDD: failing test → run → implement → run → commit. Root `npm test` must pass before you report done.
- Before reporting done also run `npm run lint` and `npm run format` (ESLint 10 + Prettier; double quotes, semicolons, two spaces, 100 columns).
- English everywhere in code/docs/commits; UI text only via i18n keys (`de` default, `en`).
- Conventional commits, scoped by workspace: feat|fix|test|chore|docs(domain|presets|exporters|app|backend|cli).
- Every change a user would notice gets a changeset (`mise run changeset`) in the same commit - pre-1.0: `minor` for a new capability, a changed workflow or anything needing a migration, `patch` for a fix. All `@filmnotes/*` workspaces share one version (`fixed` group); `mise run release` bumps them, writes the changelogs and syncs `app.json`.
- Stay inside the paths your ticket owns. Do not edit root config files; add dependencies to your workspace's package.json and run `npm install` at the repo root.
- Ids: `newId()` from `@filmnotes/domain`. Dates: ISO strings in UTC.
- Never commit secrets, `pb_data`, `node_modules`, or `backend/bin`.

## The workspace is on a case-insensitive filesystem

The repository is bind-mounted from macOS, so `rollForm.ts` and `RollForm.tsx` are the _same_
path for module resolution: imports resolve to the wrong file and `tsc` reports TS1149. Never let
two files in one directory differ only in case – suffix the component (`RollFormScreen.tsx`).

## Git remotes

- `origin` is the default HTTPS remote. Reads work; a direct push depends on whatever credential
  the sandbox happens to have at the time and is not guaranteed.
- `deploy` (`git@github.com:xela1601/filmnotes.git`) is the remote to push through. Inside the
  sandbox it resolves via SSH to a deploy key scoped to just this repository - see
  `docs/tickets/done/T-019-sandbox-push-access.md`.
- `main` is protected by a branch ruleset (PR required, no force pushes, no branch/tag deletion):
  a direct push to `main` on either remote is rejected. Push a feature branch to `deploy`, then
  open the PR - `gh pr create` does not work from inside the sandbox (the deploy key has no GitHub
  API access), so use the "Create a pull request" URL that `git push` prints, or ask the owner to
  open it.

## Tooling (mise)

CLI tooling and the task runner are managed with [mise](https://mise.jdx.dev); `mise.toml` pins
Node and defines the project tasks.

```bash
sandbox/mise install        # provision the pinned toolchain
sandbox/mise run test       # = npm test at the repo root
sandbox/mise tasks          # list available tasks
```

On a normal host use plain `mise`; `sandbox/mise` is the wrapper needed inside the Docker Sandbox.

## Running commands that need the network (inside the sandbox)

The sandbox proxy demands Basic auth on CONNECT, which npm cannot provide (it fails with
`407 Proxy Authentication Required`). Prefix every network-touching command with the proxy wrapper:

```bash
sandbox/proxy/with-proxy.sh npm install
sandbox/proxy/with-proxy.sh npx expo install expo-router
```

If an Expo command fails with `ENOENT: … mkdir '/home/agent/.expo'`, give it a writable home:

```bash
HOME="$TMPDIR/expo-home" sandbox/proxy/with-proxy.sh npx expo export --platform web
```

`git`, `curl` and Node's `fetch` work without the wrapper. The wrapper starts a short-lived local
relay that injects the proxy credentials; every Bash invocation has its own network namespace, so
the relay only lives for the duration of that one command – never start it "once in the background".
