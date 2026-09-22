# syntax=docker/dockerfile:1

# The deployable filmnotes server: PocketBase with the schema migrations, serving the web app
# from its own `pb_public`.
#
# One image on purpose. App and API are not independent - the protected scan files needed a new
# backend *and* a new app in the same step - so shipping them together means a version that cannot
# be half-updated, and app and API on one origin, which is also the end of the CORS question.
#
# Built and pushed by .github/workflows/publish.yml on a semver tag; `docker build .` from a
# checkout does the same thing.

ARG PB_VERSION=0.40.4
ARG NODE_VERSION=22

# --------------------------------------------------------------------------- the web bundle
# `--platform=$BUILDPLATFORM`: the bundle is static output and identical on every architecture, so
# it is built once, natively, instead of once per target under emulation.
FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-alpine AS web
ENV EXPO_NO_TELEMETRY=1 CI=1
WORKDIR /src

# The manifests first, so the install layer survives every change that is not a dependency change.
COPY package.json package-lock.json .npmrc ./
COPY packages/domain/package.json packages/domain/
COPY packages/presets/package.json packages/presets/
COPY packages/exporters/package.json packages/exporters/
COPY apps/mobile/package.json apps/mobile/
COPY tools/scan-import/package.json tools/scan-import/
COPY backend/package.json backend/
RUN npm ci

COPY . .
WORKDIR /src/apps/mobile
RUN npx expo export --platform web --output-dir /web

# --------------------------------------------------------------------------- the server binary
FROM alpine:3.20 AS download
ARG PB_VERSION
ARG TARGETARCH
RUN apk add --no-cache ca-certificates unzip wget
# TARGETARCH is Docker's name (amd64/arm64); PocketBase uses the same spelling.
RUN wget -O /tmp/pocketbase.zip \
      "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip" \
 && unzip /tmp/pocketbase.zip -d /pb/ \
 && chmod +x /pb/pocketbase

# --------------------------------------------------------------------------- what actually runs
FROM alpine:3.20
RUN apk add --no-cache ca-certificates wget

COPY --from=download /pb/pocketbase /pb/pocketbase
COPY backend/pb_migrations /pb/pb_migrations
# `--indexFallback` is on by default, which is the single-page rule the router needs: a reload on
# /rolls/abc has to answer with index.html.
COPY --from=web /web /pb/pb_public

EXPOSE 8090
VOLUME ["/pb/pb_data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --spider http://127.0.0.1:8090/api/health || exit 1

CMD ["/pb/pocketbase", "serve", \
     "--http=0.0.0.0:8090", \
     "--dir=/pb/pb_data", \
     "--migrationsDir=/pb/pb_migrations", \
     "--publicDir=/pb/pb_public"]
