# filmnotes – agent conventions

- Read `docs/superpowers/specs/2026-09-18-analogue-photography-app-design.md` and your ticket in `docs/tickets/` before touching code.
- TDD: failing test → run → implement → run → commit. Root `npm test` must pass before you report done.
- English everywhere in code/docs/commits; UI text only via i18n keys (`de` default, `en`).
- Conventional commits, scoped by workspace: feat|fix|test|chore|docs(domain|presets|exporters|app|backend|cli).
- Stay inside the paths your ticket owns. Do not edit root config files; add dependencies to your workspace's package.json and run `npm install` at the repo root.
- Ids: `newId()` from `@filmnotes/domain`. Dates: ISO strings in UTC.
- Never commit secrets, `pb_data`, `node_modules`, or `backend/bin`.

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

`git`, `curl` and Node's `fetch` work without the wrapper. The wrapper starts a short-lived local
relay that injects the proxy credentials; every Bash invocation has its own network namespace, so
the relay only lives for the duration of that one command – never start it "once in the background".
