# Sandbox setup (Docker Sandboxes / `sbx`)

Development of filmnotes runs with Claude Code **inside** a Docker Sandbox, not on the host.

## Requirements (host)

| #   | What                                                                 | Why                                                                | Check                                                      |
| --- | -------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------- |
| 1   | **Docker Desktop**, daemon running                                   | builds the template image                                          | `docker info`                                              |
| 2   | **Docker Sandboxes** (`sbx`), daemon started                         | the sandbox itself                                                 | `sbx daemon status` -> running, else `sbx daemon start -d` |
| 3   | **Deploy key** `~/.ssh/id_filmnotes_deploy` for `xela1601/filmnotes` | pushes from inside the sandbox; mounted read-only at its host path | `ls ~/.ssh/id_filmnotes_deploy`                            |
| 4   | **GNU make**                                                         | the targets in `sandbox/Makefile`                                  | `make --version`                                           |
| 5   | Network access to **Docker Hub** and **GitHub**                      | base image, PocketBase binary                                      | only while building                                        |

Nothing else: no Node on the host, no `op`, no secrets. The environment file names no user;
`make` passes your home directory (`--env-arg home=$HOME`) and the Expo host port
(`EXPO_PORT`, default 8082; the sandbox side stays 8081) to `sbxenv.yaml`.

| File                                    | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Dockerfile`                            | Custom template based on `docker/sandbox-templates:claude-code`: adds unzip/zip/jq/sqlite3 and the PocketBase binary (`/opt/pocketbase/pocketbase`).                                                                                                                                                                                                                                                                                                     |
| `kit/spec.yaml`                         | Mixin kit (spec v2) applied at sandbox creation: env vars, install commands (no-ops when the template already has the tools), network allow-list, agent instructions, and two generated files: `~/.gitconfig` (identity `github@alexander-schreiner.de`, mirrors the host's `~/.gitconfig-github-xela1601`, **no GPG signing** – the private key stays on the host) and `~/.ssh/config` (GitHub via the deploy key that `sbxenv.yaml` mounts read-only). |
| `proxy/with-proxy.sh`, `proxy/relay.js` | Run a command with a working proxy: the sandbox proxy requires Basic auth on `CONNECT`, which npm cannot send (`407 Proxy Authentication Required`). `relay.js` is a local proxy that injects the credentials; `with-proxy.sh` starts it, exports `http(s)_proxy` and runs the given command. Needed for `npm install`, `npx expo install`, downloads.                                                                                                   |
| `mise`, `install-mise.sh`               | [mise](https://mise.jdx.dev) wrapper: fetches the binary from GitHub (mise.jdx.dev is not on the allow-list), redirects mise's data dirs to `$TMPDIR` (`$HOME` is read-only, and tar extraction fails on the virtiofs bind mount) and routes downloads through the proxy wrapper. Tools and tasks are declared in `../mise.toml`.                                                                                                                        |
| `../sbxenv.yaml`                        | Declarative environment: agent, template, kit with its arguments, bind-mounted workspace, read-only mount of `~/.ssh/id_filmnotes_deploy` (under the `home` argument), ports 8081 (host side via the `expoPort` argument, default 8082) and 8090.                                                                                                                                                                                                        |
| `Makefile`                              | The host-side handgrips: `sbx-build`, `sbx-plan`, `sbx-create`, `sbx-run`, `sbx-rm`, `sbx-recreate`, `skills-import`, `doctor`, `shell`, `ports`. Passes `home` and `expoPort` so nobody forgets them. Tasks _inside_ the sandbox stay in `../mise.toml`.                                                                                                                                                                                                |
| `kit/files/home/`                       | Files the kit drops under `/home/agent` at creation: `sandbox-doctor` (`make doctor`: tools, mounts, network policy, git identity, GitHub over the deploy key) and `statusline.sh`, the Claude Code status line `[filmnotes] model \| repo branch* \| ctx 42% (84k/200k)`, registered in the sandbox `settings.json` at every start.                                                                                                                     |

## One-time

The sandbox runtime (`sandboxd`) has its own image store – images built in Docker Desktop are not visible to it,
so the template has to be exported and loaded once (repeat after changing the Dockerfile):

```bash
make -C sandbox sbx-build        # docker build + sbx template load; lists the template afterwards
make -C sandbox sbx-plan         # what would be created: mounts, arguments, ports
make -C sandbox skills-import    # ~/.claude/skills into the sbx store (all sandboxes)
make -C sandbox sbx-create
make -C sandbox doctor           # self-test inside the sandbox
```

Alternative without a custom image: comment out `sandboxOptions.template` in `sbxenv.yaml`; the kit's install
commands then download the tools at sandbox creation.

## Every session

```bash
make -C sandbox sbx-run          # creates (or re-attaches to) the sandbox and starts Claude Code
```

Inside Claude Code: "Follow docs/HANDOFF.md".

Calling sbx directly works too, the arguments just have to come along:
`sbx env run --env-arg home=$HOME --env-arg expoPort=8082` (from the repo root). Without them sbx asks.
Changes to `kit/spec.yaml` only take effect in a new sandbox: `make -C sandbox sbx-recreate`.

Expo web is therefore at `http://127.0.0.1:8082` on the host (8081 is taken there by a JBoss with a port
offset); `make -C sandbox sbx-create EXPO_PORT=8083` picks another one. If a create fails with
"port not available … remove provisioned secrets", run `make -C sandbox sbx-rm` before the next
attempt: the half-created environment keeps the old port mapping. Never free a published port with `kill-port`:
the host-side listener belongs to the sbx daemon, killing it takes every sandbox down. Use
`sbx ports filmnotes --unpublish 8081` or `sbx stop filmnotes`.

## Daily commands inside the sandbox

```bash
sandbox/mise install                      # provision the pinned toolchain (node)
sandbox/mise run test                     # npm test at the repo root
sandbox/proxy/with-proxy.sh npm install   # anything that talks to a registry
```

## Headless browser

The screenshot tour (`mise run screenshots`) drives the exported web build in a real Chromium, and
that works from inside the sandbox - including from an agent's Bash tool. Two things have to be in
place:

- **The download host** `cdn.playwright.dev` must be allowed (it is in `kit/spec.yaml`; a running
  sandbox that predates the entry needs `sbx policy allow network cdn.playwright.dev` on the host,
  or a recreate).
- **The shared libraries** Chrome links against. They are in the `Dockerfile`, so a rebuilt image
  brings them; an older image needs them once:

  ```bash
  sudo apt-get update -qq && sudo apt-get install -y --no-install-recommends \
    libglib2.0-0t64 libnss3 libdbus-1-3 libatk1.0-0t64 libatk-bridge2.0-0t64 libatspi2.0-0t64 \
    libgbm1 libasound2t64 libxkbcommon0 libx11-6 libxcb1 libxcomposite1 libxdamage1 libxext6 \
    libxfixes3 libxrandr2 fonts-liberation
  ```

  `npx playwright install-deps` installs the same set and also needs root.

`$HOME` is read-only, so the run sets `XDG_CACHE_HOME` itself - without it fontconfig prints an
error per glyph run. `mise run check:tour` walks the identical scenes in jsdom and needs no browser
at all.

## Notes

- The workspace is bind-mounted at the same absolute path, so `git commit` inside the sandbox writes to this checkout. Commits are unsigned; sign or rebase on the host if signing is required.
- `~/.ssh/id_filmnotes_deploy` is bind-mounted read-only at its absolute host path (`<home>/.ssh/id_filmnotes_deploy`, from the `home` argument); the sandbox's `~/.ssh/config` uses it as `IdentityFile`. The key never gets copied into the image or a template snapshot.
- The skills store (`~/.claude/skills` inside the sandbox) is sbx's shared store, filled from the host's `~/.claude/skills` by `make -C sandbox skills-import`, not a mount of the host directory. A running sandbox sees imports live.
- `.claude/settings.json` enables Claude Code's own command sandbox on macOS; inside the container it degrades gracefully if bubblewrap is missing.
- **SSH to GitHub runs outside Claude Code's command sandbox** (`sandbox.excludedCommands`: `git push/fetch/pull/ls-remote`, `ssh`). Inside that sandbox every connection is tunnelled by HTTP `CONNECT` through the sbx proxy (`HTTPS_PROXY`), and the sbx proxy treats a `CONNECT` as TLS: the SSH banner makes it drop the connection (`Connection closed by UNKNOWN port 65535`, daemon log: "Cannot read request from mitm'd client github.com:22"). Outside the command sandbox the same commands use sbx's transparent forwarding for port 22, which works. They still run inside the sbx VM, so the isolation boundary is unchanged.
