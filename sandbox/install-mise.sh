#!/usr/bin/env bash
# Installs the mise binary to sandbox/bin/mise (git-ignored).
# mise.jdx.dev is not on the sandbox network allow-list, so the GitHub release is used.
set -euo pipefail

version="${MISE_VERSION:-v2026.9.10}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

case "$(uname -m)" in
  aarch64|arm64) arch="arm64" ;;
  x86_64|amd64)  arch="x64" ;;
  *) echo "unsupported architecture: $(uname -m)" >&2; exit 1 ;;
esac

mkdir -p "$here/bin"
"$here/proxy/with-proxy.sh" curl -fsSL \
  -o "$here/bin/mise" \
  "https://github.com/jdx/mise/releases/download/${version}/mise-${version}-linux-${arch}-musl"
chmod +x "$here/bin/mise"
"$here/bin/mise" --version
