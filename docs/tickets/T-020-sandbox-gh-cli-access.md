# T-020 – A scoped token so `gh` works from inside the sandbox

**Wave:** out of band — infrastructure, requested by the owner on 2026-09-23
**Depends on:** [T-019](done/T-019-sandbox-push-access.md)
**Owns:** nothing structural in the repository; a `CLAUDE.md` note at the end, plus host steps in
the GitHub web interface and `sbx secret set`

**Goal:** `gh pr create` / `gh pr merge` work from inside the sandbox, using a credential scoped
to just this repository — the same principle as the deploy key in T-019, applied to the GitHub
API instead of git.

## Why

`gh auth status` fails with `Bad credentials` from inside the sandbox: whatever `GH_TOKEN` it
currently carries is invalid. Beyond just fixing that, a deploy key can never cover this either
way — GitHub deploy keys authenticate git-over-SSH only, not the REST/GraphQL API `gh` uses.
Opening or merging a PR needs a second, independent kind of credential.

The path of least resistance the root `CLAUDE.md` documents —
`sbx secret set github -t "$(gh auth token)"` — would hand the sandbox the owner's own
full-scope `gh` token, undoing exactly the scoping T-019 just did. Same mistake, different
transport.

## Decisions taken

- **Fine-grained PAT, one repository, one permission.** `Pull requests: Read and write` only. No
  `Contents`, no `Administration` — pushing already goes through the T-019 deploy key; this token
  is only for the API surface a deploy key can't reach.
- **No expiration date — the owner's explicit call**, against GitHub's own recommendation for
  fine-grained tokens. Trades a renewal chore for none; if this token leaks, its blast radius is
  still just this repo's pull requests, not the account.
- **Delivered via `sbx secret set github`, not a new mechanism.** The root `CLAUDE.md` already
  documents this path for HTTPS git auth, and per that doc it also backs `GH_TOKEN` (and
  therefore `gh`) inside the sandbox. Reusing it means no new plumbing, and it should incidentally
  fix `origin`'s HTTPS push too, which the same invalid token was presumably breaking.
- **`deploy` remains the push path.** This ticket only adds what's needed for
  `gh pr create` / `gh pr merge`; nothing about pushing branches changes.

## Steps

### On the host — for the owner

- [x] **Step 1: create the fine-grained PAT.** github.com → Settings → Developer settings →
      Personal access tokens → Fine-grained tokens → Generate new token.

  - Resource owner: `xela1601`
  - Repository access: **Only select repositories** → `filmnotes`
  - Permissions: **Pull requests: Read and write** (leave everything else at "No access";
    `Metadata: Read-only` gets added automatically — that's required and fine)
  - Expiration: **No expiration**
  - Generate, copy the token (`github_pat_…`) — GitHub shows it exactly once.

- [x] **Step 2: set it for this sandbox** (takes effect immediately, no recreate needed):

      sbx secret set github --sandbox $SANDBOX_NAME -t "<paste the token>"

  Find `$SANDBOX_NAME` from inside the sandbox (also available as `hostname`) — don't guess it
  from the branch name or working-tree path.

- [ ] **Step 3: set it globally too**, so the next sandbox recreate doesn't need this repeated.

  Left undone — step 4 below found that this whole PAT doesn't do what the ticket assumed, so
  there is nothing worth persisting globally yet. See "What actually happened" below.

### Back in the sandbox — for the agent, after step 2

- [x] **Step 4:** confirm the identity and the scope. This did **not** go as planned — see below.

- [x] **Step 5:** prove the whole loop with a real PR — push a branch via `deploy`, then
      `gh pr create --repo xela1601/filmnotes --fill`. This PR (and the T-019 close-out PR
      alongside it) is the proof: both were opened this way.

- [ ] **Step 6:** record the working agreement in `CLAUDE.md`. Partly done — `gh pr create` is
      now documented as working, but the scoping claim that motivated this ticket had to be
      corrected rather than confirmed (see below), so this needs a second look once step 3's
      question is resolved.

### What actually happened

Step 4 (`gh auth status`, `gh api repos/xela1601/filmnotes --jq .permissions`) did not show the
PAT from step 1 at all: `GH_TOKEN` was `gho_sbxproxymanaged…`, a placeholder, and permissions
came back `admin: true` — full access, not `pull-requests: write`. Chasing it down:

    curl -s https://api.github.com/user      # no token, no Authorization header, nothing
    → {"login":"xela1601", ...}               # answers anyway

`/usr/local/share/ca-certificates/proxy-ca.crt` is a **Docker Sandboxes Proxy CA**: the sandbox
does full TLS interception on outbound traffic, and for `api.github.com` it re-signs every
request with its own credential before it leaves — independent of `GH_TOKEN`, `gh auth login`,
or the `sbx secret set github` value from step 2. That credential is not scoped to this repo: it
sees every repository the owner has, including another org's.

So the PAT this ticket asked for is not what makes `gh pr create` work, and can't be, because
nothing running inside the sandbox controls what the proxy injects for that host. The access
that opened this PR was already there before this ticket existed. Step 3 (persisting the PAT
globally) is on hold until it's clear whether it does anything at all, or whether the right next
step lives outside the sandbox entirely — in however Docker Sandboxes' own GitHub connection for
this account is configured.

**Done when:** `gh auth status` succeeds and `gh pr create` opens a real PR against `filmnotes` —
both true, but not for the reason this ticket assumed. Left open: whether the proxy's
account-wide GitHub access can be narrowed to this repo, and if not, whether that's accepted.
