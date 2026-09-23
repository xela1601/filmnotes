# T-019 – The sandbox gets its own, repository-scoped push access

**Wave:** out of band — infrastructure, requested by the owner on 2026-09-23
**Depends on:** nothing
**Owns:** `sbxenv.yaml`, `sandbox/kit/spec.yaml`, `.git/config` (the remote), plus steps on the
host and in the GitHub web interface that no agent can perform

**Goal:** The agent can push from inside the sandbox, and the credential it uses opens exactly one
repository. `main` cannot be changed without a pull request, and no release can be triggered by
accident.

## Why

The key currently mounted into the sandbox is **the owner's account key**, not a deploy key,
although both `sbxenv.yaml` and the kit describe it as one. GitHub confirms it:

```bash
eval "$GIT_SSH_COMMAND -T git@github.com"
# Hi xela1601! You've successfully authenticated, but GitHub does not provide shell access.
```

A deploy key would answer `Hi xela1601/filmnotes!`. So the sandbox — and anything running in it,
including every npm dependency — currently holds read and write access to **every repository the
owner has**. That is far more than this project needs, and it is true today whether or not the
agent ever pushes.

The second half is not about the key at all: a credential with write access is only as safe as
what the repository allows it to do. Without a rule on `main`, "push access" also means "may
rewrite history".

## Decisions taken

- **Deploy key, not a fine-grained token.** Smallest possible scope, no expiry to maintain,
  revocable on its own. The cost is that a deploy key cannot use the GitHub API, so the agent can
  push a branch but cannot open the pull request; GitHub e-mails the owner a button for that.
- **Pull request required on `main`.** The agent's push rights become proposal rights. The point
  is not distrust: on the night this was written, a shell chain broke after a failed `tar`, the
  `cd` into the scratch copy never ran, and the following commands edited the real working tree.
  It was noticed and undone. A branch rule makes that class of accident structurally harmless.
- **A separate remote, `deploy`,** instead of repointing `origin`. The working tree is bind-mounted
  from the host, so `.git/config` is shared: changing `origin` would change it for the host too.

## Steps

### In the repository

- [x] **Step 1:** `sandbox/kit/spec.yaml` points `IdentityFile` at
      `~/.ssh/id_filmnotes_deploy`.
- [x] **Step 2: `sbxenv.yaml`, one line — the owner has to do this.** The agent cannot: the
      sandbox mounts its own definition read-only (`Errno 30: Read-only file system`), which is
      correct, since that file decides what enters the sandbox in the first place. Change

          - path: /Users/alexander.schreiner/.ssh/id_github

      to

          - path: /Users/alexander.schreiner/.ssh/id_filmnotes_deploy

### On the host — for the owner

- [x] **Step 3: push what is already here.** Eight commits are unpushed, and after step 6 a direct
      push to `main` is no longer possible. From the host, in this checkout:

      git push origin main

- [x] **Step 4: create the deploy key.** It must have no passphrase — the sandbox has no agent to
      unlock it:

      ssh-keygen -t ed25519 -f ~/.ssh/id_filmnotes_deploy -C "filmnotes sandbox" -N ""

- [x] **Step 5: register it, with write access.** Copy the **public** half:

      pbcopy < ~/.ssh/id_filmnotes_deploy.pub

  Then github.com/xela1601/filmnotes → Settings → Deploy keys → Add deploy key. Title e.g.
  "filmnotes sandbox", tick **Allow write access**.

- [x] **Step 6: protect `main`.** github.com/xela1601/filmnotes → Settings → Rules → Rulesets →
      New branch ruleset:

  - Name `main`, Enforcement **Active**, Target branches → Include default branch
  - ✓ Require a pull request before merging — **Required approvals: 0** (you merge your own)
  - ✓ Block force pushes
  - ✓ Restrict deletions
  - Bypass list → add **Repository admin**, so your own pushes from the host still work. A deploy
    key can never be given a bypass, so the agent stays inside the rule.

- [x] **Step 7: protect the release tags.** New ruleset, Target **tags**, pattern `v*`:
      ✓ Restrict creations, bypass: Repository admin. The Publish workflow is triggered by a
      `v*` tag, so this is what keeps the agent from ever starting a release build.

- [ ] **Step 8: recreate the sandbox** so the new mount takes effect (`sbx env run`, or however
      this sandbox is started). The old key disappears from it at that moment.

### The rulesets are not enforced — and what that changed

Steps 6 and 7 were done, and GitHub answered: _"Your rulesets won't be enforced on this private
repository until you move to GitHub Team organization account."_ Branch and tag rules only take
effect on private repositories under a paid plan; on public ones they are free. The two rulesets
are saved and will start working the moment the repository is public.

The owner chose to make the repository public rather than pay for a plan. That turns the
scrubbing of private data from a nicety into a precondition, because publishing exposes the whole
history, not the current state.

- [x] **Step 6a: scan the entire history.** No `.env` was ever committed; no blob of any commit
      contains a token, a key or a real password (the password-shaped strings are test fixtures).
- [x] **Step 6b: scrub what is not secret but is private.** The mail host, the sender address and
      the lab's shop identifiers are placeholders now; `automation/n8n/local-values.md` keeps the
      mapping and is git-ignored.
- [x] **Step 6c: rewrite the history** so the old values are gone from every commit, not just from
      the tip. Verified: all 15 real refs are clean. A bundle of the pre-rewrite state and
      `refs/original/*` are the way back.
- [ ] **Step 6d: force-push, and delete the two refs that would keep the old history alive.**

      The owner weighed replacing the repository against force-pushing and chose the force-push:
      the scrubbed values are a mail host and a shop code, not credentials, and recreating the
      repository would mean setting up the deploy key and both rulesets again. The residual risk
      is accepted and is written down here rather than left implicit: objects that a force-push
      makes unreachable are still retrievable by SHA, and GitHub does not collect them on request.

      What is **not** optional is the other two refs. Both descend from the commit that introduced
      the values, so as long as they exist the old commits are not merely lingering — they are
      reachable, and in a public repository anyone can simply browse to them. Deleting them is
      what makes the rewrite worth anything:

          git push --force origin main
          git push origin :refs/tags/v0.2.0-alpha.0
          git push origin --delete changeset-release/main

      The tag was due to go anyway: it points at a commit that fails CI, and its SHA changed in
      the rewrite. `v0.2.0-alpha.1` gets cut once main is green. The changeset branch is a stale
      release PR and regenerates itself on the next run.

- [ ] **Step 6e: make the repository public**, so the two rulesets from steps 6 and 7 start being
      enforced. Then, in this checkout, `refs/original/*` and the reflog still hold the old values
      locally; clearing them and running `git gc --prune=now` finishes the job on this side.

### Back in the sandbox — for the agent, after step 8

- [ ] **Step 9:** add the remote and prove the key works and is scoped:

      git remote add deploy github-xela1601:xela1601/filmnotes.git
      eval "$GIT_SSH_COMMAND -T git@github.com"   # must say: Hi xela1601/filmnotes!

- [ ] **Step 10:** push a branch and confirm that a direct push to `main` is refused:

      git push deploy HEAD:refs/heads/test/push-access
      git push deploy HEAD:main                  # must be rejected by the ruleset

- [ ] **Step 11:** delete the test branch, and record the working agreement in `CLAUDE.md`: the
      agent pushes branches to `deploy` and never to `main`.

**Done when:** `Hi xela1601/filmnotes!` is what GitHub answers, a branch push succeeds, a `main`
push is refused, and `~/.ssh/id_github` is no longer visible inside the sandbox.

## Afterwards

- **Remove the account key from the sandbox for good.** Once this works, nothing needs
  `~/.ssh/id_github` in here. If another project's sandbox mounts it the same way, it has the same
  problem.
- `kits-agent-context/filmnotes-dev.md` (outside this repository) still says "the read-only
  mounted deploy key". It was never a deploy key; after this ticket it is one. Worth correcting so
  the next reader is not misled the way this one was.
- The residual risk that remains by design: whatever is mounted into the sandbox can be read by
  anything running in it. Scope is the mitigation, not secrecy.
