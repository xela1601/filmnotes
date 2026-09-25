#!/usr/bin/env bash
# Claude Code status line: [sandbox] model | repo branch* | ctx 42% (84k/200k)
#
# Reads the session JSON from stdin (see https://code.claude.com/docs/en/statusline).
# Same script on the host (~/.claude/statusline.sh) and in the sandboxes (delivered by
# the kit); the sandbox name comes from SANDBOX_NAME, which sbx sets, "host" otherwise.
# Needs jq and git. Kept cheap: no git status over the whole tree, only diff --quiet.
set -uo pipefail

input=$(cat)
jqq() { printf '%s' "$input" | jq -r "$1" 2>/dev/null; }

model=$(jqq '.model.display_name // "?"')
cwd=$(jqq '.workspace.current_dir // ""')
pct=$(jqq '.context_window.used_percentage // 0' | cut -d. -f1)
used=$(jqq '(.context_window.current_usage // {}) | ((.input_tokens // 0) + (.cache_creation_input_tokens // 0) + (.cache_read_input_tokens // 0))')
size=$(jqq '.context_window.context_window_size // 0')

# ANSI colours; Claude Code renders them.
dim=$'\033[2m'; bold=$'\033[1m'; reset=$'\033[0m'
cyan=$'\033[36m'; green=$'\033[32m'; yellow=$'\033[33m'; red=$'\033[31m'; magenta=$'\033[35m'

where="${SANDBOX_NAME:-host}"
line="${magenta}[${where}]${reset} ${bold}${model}${reset}"

# Repository, branch, dirty marker. Untracked files are ignored on purpose (cost).
if [ -n "$cwd" ] && [ -d "$cwd" ]; then
  top=$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null || true)
  if [ -n "$top" ]; then
    branch=$(git -C "$cwd" --no-optional-locks branch --show-current 2>/dev/null || true)
    [ -n "$branch" ] || branch=$(git -C "$cwd" --no-optional-locks rev-parse --short HEAD 2>/dev/null || echo "?")
    dirty=""
    if ! git -C "$cwd" --no-optional-locks diff --quiet 2>/dev/null \
       || ! git -C "$cwd" --no-optional-locks diff --cached --quiet 2>/dev/null; then
      dirty="${yellow}*${reset}"
    fi
    line+=" ${dim}|${reset} ${cyan}$(basename "$top")${reset} ${branch}${dirty}"
  else
    line+=" ${dim}|${reset} ${cyan}$(basename "$cwd")${reset}"
  fi
fi

# Context: colour flips at 70 and 90 percent.
if [ "$pct" -ge 90 ] 2>/dev/null; then col=$red
elif [ "$pct" -ge 70 ] 2>/dev/null; then col=$yellow
else col=$green; fi
k() { awk -v n="$1" 'BEGIN { if (n >= 1000000) printf "%.1fM", n/1000000; else if (n >= 1000) printf "%dk", n/1000; else printf "%d", n }'; }
if [ "${size:-0}" -gt 0 ] 2>/dev/null; then
  line+=" ${dim}|${reset} ${col}ctx ${pct}%${reset} ${dim}($(k "$used")/$(k "$size"))${reset}"
else
  line+=" ${dim}|${reset} ${col}ctx ${pct}%${reset}"
fi

printf '%s\n' "$line"
