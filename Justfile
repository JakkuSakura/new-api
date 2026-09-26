set shell := ["bash", "-eu", "-o", "pipefail", "-c"]

version := `cat VERSION`
binary := "new-api"
deploy_root := "/opt/new-api"
service := "new-api.service"
hosts := "jakku-aws-tky-1 hs-wf-1-llm"

# Default: build web + binary, then deploy to every host.
deploy: build
    #!/usr/bin/env bash
    set -euo pipefail
    for h in {{hosts}}; do
        echo "==> deploying {{binary}} to $h"
        scp -q {{binary}} "$h:/tmp/{{binary}}.new"
        ssh "$h" "sudo install -o newapi -g newapi -m 0755 /tmp/{{binary}}.new {{deploy_root}}/{{binary}} && rm -f /tmp/{{binary}}.new && sudo systemctl restart {{service}} && (systemctl is-active {{service}} || true)"
    done
    echo "deployed to: {{hosts}}"

# Build the Go binary with the web bundle embedded.
build: build-web
    CGO_ENABLED=0 GOEXPERIMENT=greenteagc GOOS=linux GOARCH=amd64 \
        go build -ldflags "-s -w -X 'github.com/QuantumNous/new-api/common.Version={{version}}'" -o {{binary}} .

# Build the web frontend (output embedded from web/dist).
build-web:
    cd web && bun install --frozen-lockfile
    cd web && DISABLE_ESLINT_PLUGIN=true VITE_REACT_APP_VERSION={{version}} bun run build

# Deploy to a single host: just deploy-to higan-sakura.com
deploy-to host: build
    #!/usr/bin/env bash
    set -euo pipefail
    scp -q {{binary}} "{{host}}:/tmp/{{binary}}.new"
    ssh "{{host}}" "sudo install -o newapi -g newapi -m 0755 /tmp/{{binary}}.new {{deploy_root}}/{{binary}} && rm -f /tmp/{{binary}}.new && sudo systemctl restart {{service}} && (systemctl is-active {{service}} || true)"

deploy-ai: (deploy-to "jakku-aws-tky-1")
deploy-cn: (deploy-to "hs-wf-1-llm")

# Restart the service on every host without redeploying.
restart:
    #!/usr/bin/env bash
    set -euo pipefail
    for h in {{hosts}}; do
        echo "==> restarting {{service}} on $h"
        ssh "$h" "sudo systemctl restart {{service}} && (systemctl is-active {{service}} || true)"
    done

status:
    #!/usr/bin/env bash
    for h in {{hosts}}; do
        echo "== $h =="
        ssh "$h" "(systemctl is-active {{service}} || true); ls -l {{deploy_root}}/{{binary}}"
    done
