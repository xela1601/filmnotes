# filmnotes PocketBase image for the home server.
#
# Built on the server (`docker compose build`), never inside the agent sandbox.
# The schema travels with the image as JS migrations and is applied on every start.

ARG PB_VERSION=0.40.4

FROM alpine:3.20 AS download
ARG PB_VERSION
ARG TARGETARCH
RUN apk add --no-cache ca-certificates unzip wget
# TARGETARCH is Docker's name (amd64/arm64); PocketBase uses the same spelling.
RUN wget -O /tmp/pocketbase.zip \
      "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip" \
 && unzip /tmp/pocketbase.zip -d /pb/ \
 && chmod +x /pb/pocketbase

FROM alpine:3.20
RUN apk add --no-cache ca-certificates wget
COPY --from=download /pb/pocketbase /pb/pocketbase
COPY pb_migrations /pb/pb_migrations

EXPOSE 8090
VOLUME ["/pb/pb_data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --spider http://127.0.0.1:8090/api/health || exit 1

CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/pb/pb_data", "--migrationsDir=/pb/pb_migrations"]
