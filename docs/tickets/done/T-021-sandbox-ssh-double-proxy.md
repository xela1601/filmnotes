# T-021 – SSH to GitHub died inside Claude Code's own command sandbox

**Wave:** out of band — infrastructure, found while verifying T-019/T-020 on 2026-09-23/25
**Depends on:** [T-019](T-019-sandbox-push-access.md)
**Owns:** `.claude/settings.json`, `sandbox/Dockerfile`, `sandbox/kit/spec.yaml`, `sbxenv.yaml`,
`sandbox/README.md`, `sandbox/Makefile`, `sandbox/kit/files/**`

**Status:** done — verified 2026-09-25 from inside a Claude Code Bash tool call (see the last step).

**Goal:** `git push`/`git fetch`/`ssh` to GitHub work from inside a normal Claude Code Bash tool
call in the sandbox, not just when run some other way (`sbx exec`, a shell outside Claude Code).

## Why

After T-019's deploy key started working, SSH to GitHub stopped working - consistently, for over
a full day, across many retries and one full sandbox recreate. Two sessions worth of elimination:

- Not a GitHub outage: `ssh -T git@github.com` from the host (no sandbox, no proxy) answered
  normally the whole time.
- Not the network being down generally: `curl`/`gh` to `api.github.com` kept answering `200`
  throughout, from the same sandbox, the same session.
- Not an `sbx` policy block: `sbx policy log` had no entry at all for `github.com:22`, blocked or
  allowed, for this sandbox.
- Not a GitHub or `sbx` rate limit, and not an IPv4/IPv6 stack mismatch (both ruled out once the
  actual cause was found, see below).

The actual cause, found by tracing the `sbx` daemon log directly: `.claude/settings.json` enables
Claude Code's own command-level sandbox, which tunnels every network connection a Bash tool call
makes through `HTTPS_PROXY` via HTTP `CONNECT` - including SSH's own `ProxyCommand`
(`socat - PROXY:localhost:%h:%p,...`) to `github.com:22`. The `sbx` proxy on the other end treats
every `CONNECT` as the start of a TLS handshake. SSH sends its own protocol banner instead, and
the proxy chokes on it:

```
HTTP Proxy Logger sandbox=filmnotes: Cannot read request from mitm'd client github.com:22
  malformed HTTP request "SSH-2.0-OpenSSH_10.2p1 Ubuntu-2ubuntu3.5"
```

Two proxies stacked on the same connection, and the inner one speaks a protocol the outer one
can't parse. Run the same `ssh` command a layer further out - `sbx exec filmnotes -- ssh -T
git@github.com`, bypassing Claude Code's command sandbox - and `sbx`'s own transparent dialer for
port 22 handles it fine (`sbx policy log` then shows `github.com:22 transparent`). That path was
never broken; only the doubly-proxied one was.

## Decisions taken

- **`sandbox.excludedCommands` in `.claude/settings.json`**, not disabling the command sandbox
  entirely: `git push`, `git fetch`, `git pull`, `git ls-remote`, `git remote update`, `ssh`,
  `ssh-keyscan` run outside Claude Code's own network tunnel. They still run inside the `sbx` VM -
  the isolation boundary that matters (T-019's whole point) is unchanged, only the redundant
  second tunnel is removed for the commands that can't tolerate it.
- **Fixed alongside: the checked-in sandbox config no longer names a specific person.**
  `sbxenv.yaml` and `sandbox/kit/spec.yaml` hardcoded
  `/Users/alexander.schreiner/.ssh/id_filmnotes_deploy`. Tracing this bug meant reading both files
  closely enough that the hardcoded path was hard to miss; fixing it while already in there was
  cheaper than opening a second ticket for the same two files. Both now take a `home` argument
  (`--env-arg home=$HOME`), and a `expoPort` argument replaces the other hardcoded assumption
  (port 8081 always free on the host).
- **A `Makefile` and `sandbox-doctor` self-test**, so the `--env-arg` pair isn't retyped from
  memory every session and a broken sandbox says what's broken instead of failing a random later
  command. Ergonomics, not required for the fix itself.

## Steps

- [x] Trace the failure to its root cause (daemon log, comparing the tunnelled and untunnelled
      path for the same command).
- [x] Add `sandbox.excludedCommands` to `.claude/settings.json`.
- [x] Parameterize `sbxenv.yaml` and `sandbox/kit/spec.yaml` with `home` (required) and
      `expoPort` (default `8081`) instead of the hardcoded path and port.
- [x] Add `sandbox/Makefile` (`sbx-build`, `sbx-plan`, `sbx-create`, `sbx-run`, `sbx-rm`,
      `sbx-recreate`, `skills-import`, `doctor`, `shell`, `ports`) and the `sandbox-doctor`
      self-test.
- [x] Move `sandbox-doctor` out of the image and into the kit (`sandbox/kit/files/home/`), and
      put the Claude Code status line next to it. See "Delivered by the kit, not the image".
- [x] Default the Expo host port to `8082`. `8081` is taken on this host by a JBoss with a port
      offset, so every `sbx-create` needed `EXPO_PORT=8082` typed from memory; the sandbox side
      stays `8081`. `sandbox/README.md` also notes that a failed create keeps its port mapping -
      `make -C sandbox sbx-rm` before retrying.
- [x] Update `sandbox/README.md`: host requirements table, the `make` targets, the port-conflict
      and skills-store notes, and the excluded-commands explanation under "Notes".
- [x] Verified via `sbx exec` (outside Claude Code's command sandbox): `ssh -T git@github.com`
      answers `Hi xela1601/filmnotes!`, `git fetch deploy --dry-run` and
      `git push --dry-run deploy main` both exit `0`.
- [x] **Verified from inside a Claude Code Bash tool call** on 2026-09-25, after the session
      restart that makes `.claude/settings.json` take effect: `ssh -T git@github.com` answers
      `Hi xela1601/filmnotes!`, and the commit stuck since T-020 landed -
      `git push deploy docs/t-020-sandbox-gh-cli-access` → `9e1f4db..9443de9`.

## Delivered by the kit, not the image

`sandbox-doctor` first lived in `sandbox/Dockerfile` (`COPY scripts/doctor.sh`), which meant every
change to it needed `make -C sandbox sbx-build` and a recreate. It is a script, not a tool the
image provides, so it moved to `sandbox/kit/files/home/.local/bin/` - the kit writes it at
creation, and the same mechanism now also delivers `~/.claude/statusline.sh`
(`[filmnotes] model | repo branch* | ctx 42% (84k/200k)`), which a setup command registers in the
sandbox's `settings.json` at every start, idempotently.

Two consequences worth knowing:

- `make doctor` on a sandbox that predates this kit says so and names the fix
  (`make sbx-recreate`), rather than failing with a bare "command not found".
- Run `sandbox-doctor` from a Claude Code Bash call and its GitHub check reports
  `[info] … Temporary failure in name resolution`: the script as a whole is not in
  `excludedCommands`, so its inner `ssh` is back inside the tunnel this ticket is about. Via
  `make doctor` (i.e. `sbx exec`) the same check passes. It is an `[info]`, not a `[FAIL]`, on
  purpose.

**Done when:** a `git push`/`git fetch`/`ssh` to GitHub, run as an ordinary Claude Code Bash tool
call (not `sbx exec`, not the host), succeeds - proven by landing the stuck T-020 correction
commit this way.
