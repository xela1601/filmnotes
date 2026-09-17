# Custom Docker Sandboxes template for developing filmnotes with Claude Code.
# Build and load into the sandbox runtime's own image store (on the host, outside any sandbox):
#   docker build -t filmnotes-sbx:latest sandbox/
#   docker save filmnotes-sbx:latest -o /tmp/filmnotes-sbx.tar
#   sbx template load /tmp/filmnotes-sbx.tar
# Use:
#   sbx env run            (sbxenv.yaml references this tag)
#   sbx run -t filmnotes-sbx:latest claude --kit ./sandbox/kit
FROM docker/sandbox-templates:claude-code

ARG TARGETARCH
ARG PB_VERSION=0.40.4

# System-level tools: root
USER root
RUN apt-get update \
 && apt-get install -y --no-install-recommends unzip zip jq sqlite3 \
 && rm -rf /var/lib/apt/lists/*

# PocketBase binary for backend integration tests (no Docker inside the sandbox).
RUN mkdir -p /opt/pocketbase \
 && curl -fsSL -o /tmp/pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip" \
 && unzip -o /tmp/pb.zip pocketbase -d /opt/pocketbase \
 && rm /tmp/pb.zip \
 && chmod 755 /opt/pocketbase/pocketbase \
 && /opt/pocketbase/pocketbase --version

ENV FILMNOTES_PB_BIN=/opt/pocketbase/pocketbase \
    EXPO_NO_TELEMETRY=1 \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false

# User-level tools: agent. Expo needs Node >= 20; fail the build early if the base image is older.
USER agent
RUN node -e 'const v=+process.versions.node.split(".")[0]; if (v<20) { console.error("Node >= 20 required, got", process.version); process.exit(1) } console.log("node", process.version)' \
 && npm --version
