# Sandbox setup (Docker Sandboxes / `sbx`)

Development of filmnotes runs with Claude Code **inside** a Docker Sandbox, not on the host.

| File | Purpose |
|---|---|
| `Dockerfile` | Custom template based on `docker/sandbox-templates:claude-code`: adds unzip/zip/jq/sqlite3 and the PocketBase binary (`/opt/pocketbase/pocketbase`). |
| `kit/spec.yaml` | Mixin kit (spec v2) applied at sandbox creation: env vars, install commands (no-ops when the template already has the tools), network allow-list, agent instructions, and two generated files: `~/.gitconfig` (identity `github@alexander-schreiner.de`, mirrors the host's `~/.gitconfig-github-xela1601`, **no GPG signing** – the private key stays on the host) and `~/.ssh/config` (GitHub via the deploy key that `sbxenv.yaml` mounts read-only). |
| `proxy/with-proxy.sh`, `proxy/relay.js` | Run a command with a working proxy: the sandbox proxy requires Basic auth on `CONNECT`, which npm cannot send (`407 Proxy Authentication Required`). `relay.js` is a local proxy that injects the credentials; `with-proxy.sh` starts it, exports `http(s)_proxy` and runs the given command. Needed for `npm install`, `npx expo install`, downloads. |
| `mise`, `install-mise.sh` | [mise](https://mise.jdx.dev) wrapper: fetches the binary from GitHub (mise.jdx.dev is not on the allow-list), redirects mise's data dirs to `$TMPDIR` (`$HOME` is read-only, and tar extraction fails on the virtiofs bind mount) and routes downloads through the proxy wrapper. Tools and tasks are declared in `../mise.toml`. |
| `../sbxenv.yaml` | Declarative environment: agent, template, kit, bind-mounted workspace, read-only mount of `~/.ssh/id_github`, ports 8081/8090. |

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

## Notes

- The workspace is bind-mounted at the same absolute path, so `git commit` inside the sandbox writes to this checkout. Commits are unsigned; sign or rebase on the host if signing is required.
- `~/.ssh/id_github` is bind-mounted read-only at its absolute host path; the sandbox's `~/.ssh/config` uses it as `IdentityFile`. The key never gets copied into the image or a template snapshot.
- `.claude/settings.json` enables Claude Code's own command sandbox on macOS; inside the container it degrades gracefully if bubblewrap is missing.
