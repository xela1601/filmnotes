# Changesets

Every change that a _user_ would notice gets a file in here, written while the change is being
made — not reconstructed from the git log at release time.

```bash
mise run changeset          # write one (interactive: which packages, which bump, what changed)
mise run changeset:status   # what is waiting for the next release
mise run release            # apply them: bump versions, write CHANGELOG.md, sync app.json
```

**Which bump?** The product is pre-1.0, so the scale is one notch gentler than it will be later:

| Bump      | Use it for                                                                          |
| --------- | ----------------------------------------------------------------------------------- |
| **minor** | a new capability, a changed workflow, anything that needs a migration or a re-login |
| **patch** | a fix, a smaller correction, a wording change                                       |
| **major** | nothing yet — it would mean 1.0.0. That is a decision, not a side effect            |

All `@filmnotes/*` workspaces are a **fixed group**: they always carry the same number, because
they are one product, not six libraries. Naming any one of them in a changeset moves all of them;
name the ones the change is actually about, since that is what the changelog entry is filed under.

Nothing is published to a registry (`access: restricted`, every workspace is private). "Release"
here means: the version in `package.json`, `app.json` and the changelog, plus a git tag.
