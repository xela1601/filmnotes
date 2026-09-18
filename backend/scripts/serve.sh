#!/usr/bin/env bash
# Runs the local PocketBase instance for development (mise task `backend`).
#
# Expects backend/bin/pocketbase; run `npm run fetch-pb -w @filmnotes/backend` once to get it.
# Data lives in backend/pb_data (git-ignored), the schema comes from backend/pb_migrations.
set -euo pipefail

backend_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$backend_dir"

if [[ ! -x bin/pocketbase ]]; then
  echo "backend: bin/pocketbase is missing - run 'npm run fetch-pb -w @filmnotes/backend'" >&2
  exit 1
fi

exec bin/pocketbase serve \
  --http "${PB_HTTP:-127.0.0.1:8090}" \
  --dir pb_data \
  --migrationsDir pb_migrations \
  "$@"
