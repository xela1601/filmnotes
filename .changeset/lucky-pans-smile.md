---
"@filmnotes/backend": patch
---

The compose file is `backend/compose.yaml` (was `docker-compose.yml`), which is the name Docker
Compose itself prefers. On the server, `git pull` picks it up without any change to the commands —
`docker compose` finds it by itself.
