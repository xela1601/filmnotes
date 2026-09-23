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

- [ ] **Step 1: create the fine-grained PAT.** github.com → Settings → Developer settings →
      Personal access tokens → Fine-grained tokens → Generate new token.

  - Resource owner: `xela1601`
  - Repository access: **Only select repositories** → `filmnotes`
  - Permissions: **Pull requests: Read and write** (leave everything else at "No access";
    `Metadata: Read-only` gets added automatically — that's required and fine)
  - Expiration: **No expiration**
  - Generate, copy the token (`github_pat_…`) — GitHub shows it exactly once.

- [ ] **Step 2: set it for this sandbox** (takes effect immediately, no recreate needed):

      sbx secret set github --sandbox $SANDBOX_NAME -t "<paste the token>"

  Find `$SANDBOX_NAME` from inside the sandbox (also available as `hostname`) — don't guess it
  from the branch name or working-tree path.

- [ ] **Step 3: set it globally too**, so the next sandbox recreate doesn't need this repeated:

      sbx secret set github -t "<paste the token>"

  This takes effect on the *next* recreate, not the current sandbox — that's what step 2 is for.

### Back in the sandbox — for the agent, after step 2

- [ ] **Step 4:** confirm the identity and the scope:

      gh auth status
      gh api repos/xela1601/filmnotes --jq .permissions

  Expect a logged-in account, and confirm the token can't reach anything outside this repo (e.g.
  a call that lists the owner's repositories should not enumerate anything beyond `filmnotes`,
  the way an account-scoped token would).

- [ ] **Step 5:** prove the whole loop with a real PR — push a branch via `deploy`, then

      gh pr create --repo xela1601/filmnotes --fill

- [ ] **Step 6:** record the working agreement in `CLAUDE.md`: push branches via `deploy`,
      open/manage PRs via `gh` now that it works; merging stays the owner's call unless they ask
      the agent to do it directly.

**Done when:** `gh auth status` succeeds, `gh pr create` opens a real PR against `filmnotes`, and
a spot-check confirms the token cannot see or act on the owner's other repositories.
