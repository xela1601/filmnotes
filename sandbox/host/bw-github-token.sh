#!/usr/bin/env bash
# Prints the GitHub token for the filmnotes sandbox from Bitwarden, nothing else.
#
# Used by ../../sbxenv.yaml (secrets.github.command): sbx runs it on the host when the
# sandbox is created and hands the value to the proxy, which injects it for GitHub; inside
# the sandbox GH_TOKEN only holds a placeholder.
#
# Item: "My Vault" > GitHub > "sbx-filmnotes". The token is taken from, in this order:
# the login password, a custom field named "token" or "sbx-filmnotes", the notes.
#
# Needs an unlocked vault: BW_SESSION must be set (make -C sandbox sbx-create does
# `bw unlock` in the same shell when it is not).
set -euo pipefail

ITEM="${BW_GITHUB_ITEM:-sbx-filmnotes}"

command -v bw >/dev/null || { echo "bw (Bitwarden CLI) is not installed: brew install bitwarden-cli" >&2; exit 1; }
command -v jq >/dev/null || { echo "jq is not installed: brew install jq" >&2; exit 1; }

status=$(bw status 2>/dev/null | jq -r '.status // "unknown"')
case "$status" in
  unlocked) ;;
  locked)          echo "Bitwarden vault is locked: export BW_SESSION=\$(bw unlock --raw)" >&2; exit 1 ;;
  unauthenticated) echo "Bitwarden CLI is not logged in: bw login, then export BW_SESSION=\$(bw unlock --raw)" >&2; exit 1 ;;
  *)               echo "Bitwarden CLI status is '$status'" >&2; exit 1 ;;
esac

item=$(bw get item "$ITEM" 2>/dev/null) || { echo "Bitwarden item '$ITEM' not found (or not unique)" >&2; exit 1; }
token=$(printf '%s' "$item" | jq -r '
  (.login.password // empty),
  ((.fields // [])[] | select(.name == "token" or .name == "sbx-filmnotes") | .value // empty),
  (.notes // empty)
  | select(. != null and . != "")' | head -n 1)

[ -n "$token" ] || { echo "Bitwarden item '$ITEM' holds no password, token field or note" >&2; exit 1; }
printf '%s' "$token"
