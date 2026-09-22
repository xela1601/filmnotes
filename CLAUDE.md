# filmnotes – agent conventions

- Read `docs/superpowers/specs/2026-09-18-analogue-photography-app-design.md` and your ticket in `docs/tickets/` before touching code.
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
