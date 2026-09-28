#!/usr/bin/env bash
# Prints the GitHub token for the filmnotes sandbox from Bitwarden, nothing else.
#
# Used by ../../sbxenv.yaml (secrets.github.command): sbx runs it on the host when the
# sandbox is created and hands the value to the proxy, which injects it for GitHub; inside
# the sandbox GH_TOKEN only holds a placeholder.
#
# Item: "My Vault" > GitHub > "sbx-filmnotes". Two layouts are understood: an item named
# "sbx-filmnotes" (token = login password, else a custom field "token"/"sbx-filmnotes", else
# the notes), or an item named "GitHub" with a custom field "sbx-filmnotes".
# Diagnose on the host: sandbox/host/bw-github-token.sh | wc -c   (prints only the length)
#
# Needs an unlocked vault: BW_SESSION must be set (make -C sandbox sbx-create does
# `bw unlock` in the same shell when it is not).
set -euo pipefail

ITEM="${BW_GITHUB_ITEM:-sbx-filmnotes}"
FALLBACK_ITEM="${BW_GITHUB_FALLBACK_ITEM:-GitHub}"
FIELD="${BW_GITHUB_FIELD:-sbx-filmnotes}"

command -v bw >/dev/null || { echo "bw (Bitwarden CLI) is not installed: brew install bitwarden-cli" >&2; exit 1; }
command -v jq >/dev/null || { echo "jq is not installed: brew install jq" >&2; exit 1; }

status=$(bw status 2>/dev/null | jq -r '.status // "unknown"')
case "$status" in
  unlocked) ;;
  locked)          echo "Bitwarden vault is locked: export BW_SESSION=\$(bw unlock --raw)" >&2; exit 1 ;;
  unauthenticated) echo "Bitwarden CLI is not logged in: bw login, then export BW_SESSION=\$(bw unlock --raw)" >&2; exit 1 ;;
  *)               echo "Bitwarden CLI status is '$status'" >&2; exit 1 ;;
esac

# Sync first: the CLI works on a local cache, and a field added in the app after the last
# sync is invisible until then. Needs network; a failed sync is not fatal.
bw sync >/dev/null 2>&1 || true

# bw get item needs a unique name match, which "GitHub" rarely is. bw list items --search
# returns every candidate; pick by structure instead of by name.
token=""
candidates=$(bw list items --search "$ITEM" 2>/dev/null || echo '[]')
token=$(printf '%s' "$candidates" | jq -r --arg n "$ITEM" --arg f "$FIELD" '
  [ .[] | select(.name == $n) ] | first // empty |
  ( (.login.password // empty),
    ((.fields // [])[] | select(.name == "token" or .name == $f) | .value // empty),
    (.notes // empty) ) | select(. != null and . != "")' 2>/dev/null | head -n 1)

if [ -z "$token" ]; then
  candidates=$(bw list items --search "$FALLBACK_ITEM" 2>/dev/null || echo '[]')
  matches=$(printf '%s' "$candidates" | jq -c --arg f "$FIELD" '[ .[] | select(any((.fields // [])[]; .name == $f)) ]' 2>/dev/null || echo '[]')
  count=$(printf '%s' "$matches" | jq 'length')
  case "$count" in
    1) token=$(printf '%s' "$matches" | jq -r --arg f "$FIELD" '.[0].fields[] | select(.name == $f) | .value // empty' | head -n 1) ;;
    0) echo "Bitwarden: no item named '$ITEM' and no item matching '$FALLBACK_ITEM' with a custom field '$FIELD'. Candidates: $(printf '%s' "$candidates" | jq -r '[.[].name] | join(", ")')" >&2; exit 1 ;;
    *) echo "Bitwarden: $count items matching '$FALLBACK_ITEM' carry a field '$FIELD': $(printf '%s' "$matches" | jq -r '[.[].name] | join(", ")'). Set BW_GITHUB_FALLBACK_ITEM to the exact name." >&2; exit 1 ;;
  esac
fi
printf '%s' "$token"
