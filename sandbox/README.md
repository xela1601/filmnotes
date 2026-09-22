# Sandbox setup (Docker Sandboxes / `sbx`)

Development of filmnotes runs with Claude Code **inside** a Docker Sandbox, not on the host.

| File                                    | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Dockerfile`                            | Custom template based on `docker/sandbox-templates:claude-code`: adds unzip/zip/jq/sqlite3 and the PocketBase binary (`/opt/pocketbase/pocketbase`).                                                                                                                                                                                                                                                                                                     |
| `kit/spec.yaml`                         | Mixin kit (spec v2) applied at sandbox creation: env vars, install commands (no-ops when the template already has the tools), network allow-list, agent instructions, and two generated files: `~/.gitconfig` (identity `github@alexander-schreiner.de`, mirrors the host's `~/.gitconfig-github-xela1601`, **no GPG signing** – the private key stays on the host) and `~/.ssh/config` (GitHub via the deploy key that `sbxenv.yaml` mounts read-only). |
| `proxy/with-proxy.sh`, `proxy/relay.js` | Run a command with a working proxy: the sandbox proxy requires Basic auth on `CONNECT`, which npm cannot send (`407 Proxy Authentication Required`). `relay.js` is a local proxy that injects the credentials; `with-proxy.sh` starts it, exports `http(s)_proxy` and runs the given command. Needed for `npm install`, `npx expo install`, downloads.                                                                                                   |
| `mise`, `install-mise.sh`               | [mise](https://mise.jdx.dev) wrapper: fetches the binary from GitHub (mise.jdx.dev is not on the allow-list), redirects mise's data dirs to `$TMPDIR` (`$HOME` is read-only, and tar extraction fails on the virtiofs bind mount) and routes downloads through the proxy wrapper. Tools and tasks are declared in `../mise.toml`.                                                                                                                        |
| `../sbxenv.yaml`                        | Declarative environment: agent, template, kit, bind-mounted workspace, read-only mount of `~/.ssh/id_github`, ports 8081/8090.                                                                                                                                                                                                                                                                                                                           |

## One-time

The sandbox runtime (`sandboxd`) has its own image store – images built in Docker Desktop are not visible to it,
so the template has to be exported and loaded once (repeat after changing the Dockerfile):

```bash
docker build -t filmnotes-sbx:latest sandbox/                 # on the host
docker save filmnotes-sbx:latest -o /tmp/filmnotes-sbx.tar
sbx template load /tmp/filmnotes-sbx.tar
sbx template ls                                               # must list filmnotes-sbx:latest
sbx kit validate ./sandbox/kit
```

Alternative without a custom image: comment out `sandboxOptions.template` in `sbxenv.yaml`; the kit's install
commands then download the tools at sandbox creation.

## Every session

```bash
sbx env plan     # optional preview
sbx env run      # creates (or re-attaches to) the sandbox and starts Claude Code
```

Inside Claude Code: "Follow docs/HANDOFF.md".

Without the custom image: `sbx run claude --kit ./sandbox/kit` – the kit's install commands then download the tools at creation time.

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
- `~/.ssh/id_github` is bind-mounted read-only at its absolute host path; the sandbox's `~/.ssh/config` uses it as `IdentityFile`. The key never gets copied into the image or a template snapshot.
- `.claude/settings.json` enables Claude Code's own command sandbox on macOS; inside the container it degrades gracefully if bubblewrap is missing.
