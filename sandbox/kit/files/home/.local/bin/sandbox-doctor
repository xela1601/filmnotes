#!/usr/bin/env bash
# Self-test of the filmnotes sandbox (sbx). Runs inside the sandbox: make -C sandbox doctor
# or sbx exec filmnotes -- sandbox-doctor. Checks tools, mounts, the network policy and the
# git setup. Reports instead of aborting.
set -uo pipefail

ok=0
fail=0

check_tool() {
  local tool="$1" version_cmd="${2:---version}"
  if command -v "$tool" >/dev/null 2>&1; then
    printf '  [ok]   %-12s %s\n' "$tool" "$("$tool" $version_cmd 2>&1 | head -1)"
    ok=$((ok + 1))
  else
    printf '  [MISSING] %-12s\n' "$tool"
    fail=$((fail + 1))
  fi
}

check_path() {
  local path="$1" label="$2"
  if [ -e "$path" ]; then
    printf '  [ok]   %-26s %s\n' "$label" "$path"
    ok=$((ok + 1))
  else
    printf '  [MISSING] %-26s %s\n' "$label" "$path"
    fail=$((fail + 1))
  fi
}

http_code() {
  curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$@" 2>/dev/null || echo 000
}

echo "== Tools =="
check_tool node
check_tool npm
check_tool git
check_tool curl
check_tool jq
check_tool sqlite3
check_tool unzip -v
check_tool claude --version
if [ -x "${FILMNOTES_PB_BIN:-/nonexistent}" ]; then
  printf '  [ok]   %-12s %s\n' "pocketbase" "$("$FILMNOTES_PB_BIN" --version 2>&1 | head -1)"; ok=$((ok + 1))
else
  echo "  [MISSING] pocketbase   FILMNOTES_PB_BIN=${FILMNOTES_PB_BIN:-unset}"; fail=$((fail + 1))
fi

echo
echo "== Mounts (host paths, from the kit) =="
check_path "${FILMNOTES_REPO:-/unset}/package.json"                 "repository"
check_path "${FILMNOTES_HOST_HOME:-/unset}/.ssh/id_filmnotes_deploy" "deploy key (ro)"
check_path "${HOME}/.ssh/config"                                    "ssh config (kit)"
check_path "${HOME}/.gitconfig"                                     "git identity (kit)"
check_path "${HOME}/.claude/skills"                                 "skills store (sbx)"

echo
echo "== Network (default deny with allow-list) =="
code=$(http_code https://example.com)
if [ "$code" = "403" ]; then
  echo "  [ok]   example.com -> 403 (blocked by the proxy, as intended)"; ok=$((ok + 1))
else
  echo "  [FAIL] example.com -> $code (expected 403 from the proxy)"; fail=$((fail + 1))
fi
for host in registry.npmjs.org github.com api.expo.dev; do
  code=$(http_code "https://$host/")
  case "$code" in
    403|000|502) echo "  [FAIL] $host -> $code (allow-list in kit/spec.yaml? proxy? offline?)"; fail=$((fail + 1)) ;;
    *)           echo "  [ok]   $host -> $code"; ok=$((ok + 1)) ;;
  esac
done

echo
echo "== Git =="
if [ -n "${FILMNOTES_REPO:-}" ] && git -C "$FILMNOTES_REPO" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  printf '  [ok]   branch %s, identity %s <%s>\n' \
    "$(git -C "$FILMNOTES_REPO" branch --show-current)" \
    "$(git -C "$FILMNOTES_REPO" config user.name)" "$(git -C "$FILMNOTES_REPO" config user.email)"; ok=$((ok + 1))
else
  echo "  [FAIL] repository is not a git work tree (FILMNOTES_REPO=${FILMNOTES_REPO:-unset})"; fail=$((fail + 1))
fi
if out=$(timeout 20 ssh -o BatchMode=yes -o ConnectTimeout=10 -T git@github.com 2>&1); then :; fi
if printf '%s' "$out" | grep -q "successfully authenticated"; then
  echo "  [ok]   GitHub accepts the deploy key"; ok=$((ok + 1))
else
  echo "  [info] GitHub over SSH not verified: $(printf '%s' "$out" | head -1)"
fi

echo
echo "Result: ${ok} ok, ${fail} problem(s)."
[ "$fail" -eq 0 ]
