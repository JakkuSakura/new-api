#!/usr/bin/env sh
# Install and configure OpenCode, Codex CLI and Claude Code to use New API.
#
# Usage:
#   curl -fsSL https://ai.higan-sakura.com/install.sh | NEW_API_KEY=sk-... sh
#   NEW_API_KEY=sk-... sh install.sh
#
# Env:
#   NEW_API_BASE   default https://ai.higan-sakura.com
#   NEW_API_MODEL  default DeepSeek-V4.1-Flash
#   NEW_API_KEY    required
set -eu

NEW_API_BASE="${NEW_API_BASE:-https://ai.higan-sakura.com}"
NEW_API_MODEL="${NEW_API_MODEL:-DeepSeek-V4.1-Flash}"
NEW_API_KEY="${NEW_API_KEY:-}"

if [ -z "${NEW_API_KEY}" ]; then
  echo "error: NEW_API_KEY is required" >&2
  echo "usage: NEW_API_KEY=sk-... sh install.sh" >&2
  exit 1
fi

have() { command -v "$1" >/dev/null 2>&1; }

echo "==> installing CLIs (opencode, codex, claude) via npm"
if have npm; then
  npm install -g opencode-ai @openai/codex @anthropic-ai/claude-code ||
    echo "warn: npm install failed; install the CLIs manually"
else
  echo "warn: npm not found; install Node.js (https://nodejs.org) then re-run"
fi

backup() {
  if [ -f "$1" ]; then cp -f "$1" "$1.bak.$(date +%Y%m%d%H%M%S)"; fi
}

echo "==> configuring OpenCode"
mkdir -p "$HOME/.config/opencode"
backup "$HOME/.config/opencode/opencode.jsonc"
cat > "$HOME/.config/opencode/opencode.jsonc" <<EOF
{
  "\$schema": "https://opencode.ai/config.json",
  "provider": {
    "new-api": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "New API",
      "options": { "baseURL": "${NEW_API_BASE}/v1", "apiKey": "${NEW_API_KEY}" },
      "models": { "${NEW_API_MODEL}": { "name": "${NEW_API_MODEL}" } }
    }
  }
}
EOF

echo "==> configuring Codex CLI"
mkdir -p "$HOME/.codex"
backup "$HOME/.codex/config.toml"
cat > "$HOME/.codex/config.toml" <<EOF
model = "${NEW_API_MODEL}"
model_provider = "new-api"

[model_providers.new-api]
name = "New API"
base_url = "${NEW_API_BASE}/v1"
env_key = "NEW_API_KEY"
wire_api = "chat"
EOF

echo "==> configuring Claude Code"
mkdir -p "$HOME/.claude"
backup "$HOME/.claude/settings.json"
cat > "$HOME/.claude/settings.json" <<EOF
{
  "env": {
    "ANTHROPIC_BASE_URL": "${NEW_API_BASE}",
    "ANTHROPIC_AUTH_TOKEN": "${NEW_API_KEY}",
    "ANTHROPIC_MODEL": "${NEW_API_MODEL}"
  }
}
EOF

for rc in "$HOME/.profile" "$HOME/.zshrc" "$HOME/.bashrc"; do
  [ -e "$rc" ] || continue
  if ! grep -q "NEW_API_KEY" "$rc" 2>/dev/null; then
    printf '\nexport NEW_API_KEY=%s\n' "${NEW_API_KEY}" >> "$rc"
  fi
done

echo
echo "Done."
echo "  New API base : ${NEW_API_BASE}"
echo "  Model        : ${NEW_API_MODEL}"
echo "Restart your shell so NEW_API_KEY is exported for Codex."
