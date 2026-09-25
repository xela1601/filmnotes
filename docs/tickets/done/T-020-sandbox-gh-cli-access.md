# T-020 – A scoped token so `gh` works from inside the sandbox

**Wave:** out of band — infrastructure, requested by the owner on 2026-09-23
**Depends on:** [T-019](T-019-sandbox-push-access.md)
**Owns:** nothing structural in the repository; a `CLAUDE.md` note at the end, plus host steps in
the GitHub web interface and `sbx secret set`

**Goal:** `gh pr create` / `gh pr merge` work from inside the sandbox, using a credential scoped
to just this repository — the same principle as the deploy key in T-019, applied to the GitHub
API instead of git.

**Status:** done — verified 2026-09-25. `gh` authenticates, a PR was opened from inside the
sandbox, and the scope was proven by what the token is _refused_: `403` on every repository and
every permission outside this repo's pull requests.

## Why

`gh auth status` fails with `Bad credentials` from inside the sandbox: whatever `GH_TOKEN` it
currently carries is invalid — see "What was actually broken" below for what it turned out to
be. Beyond just fixing that, a deploy key can never cover this either
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

  **Superseded on 2026-09-25 by something better, done by the owner:** the token is read from
  Bitwarden at creation instead of being set by hand. `sbxenv.yaml` declares
  `secrets.github.command: ./sandbox/host/bw-github-token.sh`, and a binding injects the value
  for `github.com` and `api.github.com`. Two things this buys over `sbx secret set`: a recreated
  sandbox is authenticated with no manual step to forget — which is exactly the failure this
  ticket spent two sessions on — and no credential is ever typed into a shell or left in its
  history. The vault has to be unlocked; `make -C sandbox sbx-create` does that first when it is
  not.

- **`deploy` remains the push path.** This ticket only adds what's needed for
  `gh pr create` / `gh pr merge`; nothing about pushing branches changes.

## What was actually broken — measured and then fixed, 2026-09-25

The owner asked why this still failed after a sandbox restart. Measured from inside the sandbox,
_before_ the PAT was set:

| Probe                                              | Result                                                 |
| -------------------------------------------------- | ------------------------------------------------------ |
| `curl https://api.github.com/user`, no auth header | **401 Requires authentication**                        |
| `curl …/repos/xela1601/filmnotes`, no auth header  | 200 — but the repo is public now, so this is anonymous |
| `curl` with a bogus `Authorization: Bearer`        | 401 — the proxy does not replace a header that exists  |
| `git push --dry-run origin`                        | **`could not read Username for 'https://github.com'`** |
| `ssh -T git@github.com`, `git push deploy`         | works                                                  |

So **the proxy's GitHub credential injection is dead altogether**, not just for `gh`: HTTPS git
is gone with it. What still works is the T-019 deploy key over SSH, which is a separate
mechanism and never depended on this.

The token the sandbox carries is 40 characters and starts `gho_` — an OAuth token, i.e. the
output of `gh auth token` on the owner's host. That is precisely the path this ticket rejected
in "Why", arriving through the root `CLAUDE.md`'s documented
`sbx secret set github -t "$(gh auth token)"`. It was fresh on 2026-09-24, which is why `gh`
worked then and reported `admin` permissions (the finding recorded on the branch
`docs/t-020-sandbox-gh-cli-access`, commit `9443de9`, which is **not merged into main**).
`gho_` tokens rotate on the host; the snapshot handed to the sandbox aged out with it. One
expired token takes out both paths at once.

This strengthens the case for the fine-grained PAT rather than weakening it: per the decision
above it has **no expiration**, so it cannot rot the way the `gho_` snapshot did.

### What `GH_TOKEN` inside the sandbox actually is

Not a credential. It is a **placeholder the sbx proxy swaps for the real secret**: its value did
not change when the owner set the PAT, yet the same string went from `Bad credentials` to
authenticating. That also explains the third row of the table — a self-invented bearer is not
the placeholder, so it is passed through untouched and rejected. What is in the container's
environment is therefore not worth inspecting; the only thing that decides anything is the
secret on the host.

### The false alarm, and the measurement that actually settles scope

With the PAT set, the first two things this session looked at both said "account-wide" and both
were wrong. They are written down because they are easy to repeat:

- **`repo.permissions` reflects the authenticated _user's_ role on the repo, not the token's
  grant.** `admin: true` on `filmnotes` means the owner owns `filmnotes`. It says nothing about
  what the token may do.
- **`GET /user/repos` listed 11 repositories.** All public, so nothing was disclosed that a
  stranger could not read anyway. Visibility is not capability.

Scope is only decided by asking for something the grant excludes:

| Probe                                             | Result   |
| ------------------------------------------------- | -------- |
| list PRs on `filmnotes` — what the PAT is _for_   | **200**  |
| collaborators of `xela1601/homebrew-tap`          | **403**  |
| collaborators of `xela1601/OpenSlides`            | **403**  |
| deploy keys of `filmnotes` itself (needs `admin`) | **403**  |
| private repositories reachable                    | **none** |

Pull requests on one repository, and a wall everywhere else. That is the scoping this ticket was
written to get, and it is the check worth repeating if the credential is ever replaced —
`gh auth status` succeeding proves nothing on its own, which is exactly how the session on
2026-09-24 talked itself into declaring this done.

### Still true after the fix

- **`git push origin` over HTTPS stays broken**, by design: the PAT carries no `Contents`
  permission. Pushing goes through `deploy` over SSH (T-019), which never depended on any of
  this.
- **Steps 2 and 3 are obsolete as written.** They describe `sbx secret set`, which the owner
  replaced with the Bitwarden secret command above. They are left in place as the record of what
  was planned; what to actually do now is put the token in the vault item and recreate.
- The branch `docs/t-020-sandbox-gh-cli-access` claims the proxy authenticates API traffic
  account-wide. That was a correct reading of a stale account token in September; with the PAT
  in place it is false. **It must not be merged as it stands** — its content is superseded by
  this section.

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

- [x] **Step 3: set it globally too**, so the next sandbox recreate doesn't need this repeated:

      sbx secret set github -t "<paste the token>"

  This takes effect on the _next_ recreate, not the current sandbox — that's what step 2 is for.

### Back in the sandbox — for the agent, after step 2

- [x] **Step 4:** confirm the identity and the scope:

      gh auth status
      gh api repos/xela1601/filmnotes --jq .permissions

  Expect a logged-in account, and confirm the token can't reach anything outside this repo (e.g.
  a call that lists the owner's repositories should not enumerate anything beyond `filmnotes`,
  the way an account-scoped token would).

- [x] **Step 5:** prove the whole loop with a real PR — push a branch via `deploy`, then

      gh pr create --repo xela1601/filmnotes --fill

- [x] **Step 6:** record the working agreement in `CLAUDE.md`: push branches via `deploy`,
      open/manage PRs via `gh` now that it works; merging stays the owner's call unless they ask
      the agent to do it directly.

**Done when:** `gh auth status` succeeds, `gh pr create` opens a real PR against `filmnotes`, and
a spot-check confirms the token cannot see or act on the owner's other repositories.
