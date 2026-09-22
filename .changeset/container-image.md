---
"@filmnotes/backend": minor
"@filmnotes/mobile": minor
---

One deployable image, published on a version tag.

`ghcr.io/xela1601/filmnotes` carries the PocketBase binary for the platform (amd64 and arm64), the
schema migrations and the web app in `pb_public` — so the server hands out app and API from one
origin, and the two cannot be half-updated. On the home server a release is now
`docker compose pull && docker compose up -d`.

Pushing a semver tag to main builds and pushes it. The workflow refuses to publish a tag that is
not valid semantic versioning, that does not sit on main, or that disagrees with the version in the
workspaces — and a pre-release never takes the `latest` tag.
