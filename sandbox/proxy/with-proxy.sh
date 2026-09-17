#!/usr/bin/env bash
# Run a command with a working HTTP(S) proxy inside the Docker Sandbox.
#
# Why: the sandbox proxy at $HTTPS_PROXY requires Basic auth on CONNECT. curl and Node's
# fetch handle that, but npm (9.x) does not and fails with "407 Proxy Authentication
# Required". relay.js is a tiny local proxy that injects the Proxy-Authorization header
# and forwards to the sandbox proxy. Each Bash invocation gets its own network namespace,
# so the relay has to be started inside the same command as the tool that uses it.
#
# Usage: sandbox/proxy/with-proxy.sh npm install
#        sandbox/proxy/with-proxy.sh npx expo install expo-router
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
port_file="$(mktemp)"
node "$here/relay.js" --port-file "$port_file" >/dev/null 2>&1 &
relay_pid=$!
trap 'kill "$relay_pid" 2>/dev/null || true; rm -f "$port_file"' EXIT

for _ in $(seq 1 100); do
  [ -s "$port_file" ] && break
  sleep 0.1
done
port="$(cat "$port_file")"
[ -n "$port" ] || { echo "proxy relay failed to start" >&2; exit 1; }

export http_proxy="http://127.0.0.1:$port"
export https_proxy="$http_proxy"
export HTTP_PROXY="$http_proxy"
export HTTPS_PROXY="$http_proxy"
export npm_config_proxy="$http_proxy"
export npm_config_https_proxy="$http_proxy"
export no_proxy="localhost,127.0.0.1,::1"
export NO_PROXY="$no_proxy"

"$@"
