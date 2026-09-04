#!/usr/bin/env bash
set -Eeuo pipefail

# Build and deploy one image without copying local configuration or source files.
# The remote compose project remains authoritative for ports, volumes, and env.

REMOTE="${DEPLOY_REMOTE:-ubuntu@higan-sakura.com}"
REMOTE_DIR="${DEPLOY_DIR:-/opt/new-api}"
COMPOSE_FILE="${DEPLOY_COMPOSE_FILE:-docker-compose.yml}"
IMAGE_NAME="${DEPLOY_IMAGE:-calciumion/new-api:latest}"
PLATFORM="${DEPLOY_PLATFORM:-linux/amd64}"
TAG="${DEPLOY_TAG:-$(git rev-parse --short HEAD)}"
ARCHIVE="${TMPDIR:-/tmp}/new-api-${TAG}.tar.gz"

if command -v docker >/dev/null 2>&1; then
  CONTAINER_CLI=docker
elif command -v podman >/dev/null 2>&1; then
  CONTAINER_CLI=podman
else
  echo "error: docker or podman is required" >&2
  exit 1
fi

echo "Building $IMAGE_NAME (platform $PLATFORM) with $CONTAINER_CLI"
"$CONTAINER_CLI" build --platform "$PLATFORM" -t "$IMAGE_NAME" .
"$CONTAINER_CLI" save "$IMAGE_NAME" | gzip -c > "$ARCHIVE"

echo "Uploading image to $REMOTE:$REMOTE_DIR"
ssh -o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new "$REMOTE" "mkdir -p '$REMOTE_DIR'"
scp -q -o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new "$ARCHIVE" "$REMOTE:$REMOTE_DIR/$(basename "$ARCHIVE")"

REMOTE_ARCHIVE="$REMOTE_DIR/$(basename "$ARCHIVE")"
ssh -o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new "$REMOTE" \
  "set -e; cd '$REMOTE_DIR'; if docker info >/dev/null 2>&1; then DOCKER=docker; elif sudo -n docker info >/dev/null 2>&1; then DOCKER='sudo -n docker'; else echo 'error: remote user cannot access Docker' >&2; exit 1; fi; gzip -dc '$REMOTE_ARCHIVE' | \$DOCKER load; if command -v docker-compose >/dev/null 2>&1; then if [ \"\$DOCKER\" = docker ]; then docker-compose -f '$COMPOSE_FILE' up -d --no-deps --force-recreate new-api; else sudo -n docker-compose -f '$COMPOSE_FILE' up -d --no-deps --force-recreate new-api; fi; else \$DOCKER compose -f '$COMPOSE_FILE' up -d --no-deps --force-recreate new-api; fi; rm -f '$REMOTE_ARCHIVE'; \$DOCKER ps --filter name=^/new-api$ --format '{{.Names}} {{.Status}}'"

rm -f "$ARCHIVE"
echo "Deployment complete: $REMOTE (commit $TAG)"
