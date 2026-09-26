# Install and configure OpenCode, Codex CLI and Claude Code to use New API (Windows).
#
# Usage:
#   $env:NEW_API_KEY="sk-..."; powershell -ExecutionPolicy Bypass -File install.ps1
#   powershell -ExecutionPolicy Bypass -File install.ps1 -NewApiKey sk-...
#
# Parameters/env:
#   NEW_API_BASE   default https://ai.higan-sakura.com
#   NEW_API_MODEL  default DeepSeek-V4.1-Flash
#   NEW_API_KEY    required
param(
  [string]$NewApiBase  = $env:NEW_API_BASE,
  [string]$NewApiModel = $env:NEW_API_MODEL,
  [string]$NewApiKey   = $env:NEW_API_KEY
)
$ErrorActionPreference = "Stop"
if (-not $NewApiBase)  { $NewApiBase  = "https://ai.higan-sakura.com" }
if (-not $NewApiModel) { $NewApiModel = "DeepSeek-V4.1-Flash" }
if (-not $NewApiKey)   { Write-Error "NEW_API_KEY is required"; exit 1 }

Write-Host "==> installing CLIs (opencode, codex, claude) via npm"
if (Get-Command npm -ErrorAction SilentlyContinue) {
  npm install -g opencode-ai "@openai/codex" "@anthropic-ai/claude-code"
} else {
  Write-Warning "npm not found; install Node.js (https://nodejs.org) then re-run"
}

function Backup([string]$Path) {
  if (Test-Path $Path) {
    Copy-Item -Force $Path ("{0}.bak.{1}" -f $Path, (Get-Date -Format "yyyyMMddHHmmss"))
  }
}

Write-Host "==> configuring OpenCode"
$ocDir = Join-Path $HOME ".config\opencode"
New-Item -ItemType Directory -Force -Path $ocDir | Out-Null
$ocFile = Join-Path $ocDir "opencode.jsonc"
Backup $ocFile
@"
{
  "`$schema": "https://opencode.ai/config.json",
  "provider": {
    "new-api": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "New API",
      "options": { "baseURL": "$NewApiBase/v1", "apiKey": "$NewApiKey" },
      "models": { "$NewApiModel": { "name": "$NewApiModel" } }
    }
  }
}
"@ | Set-Content -Encoding utf8 $ocFile

Write-Host "==> configuring Codex CLI"
$cxDir = Join-Path $HOME ".codex"
New-Item -ItemType Directory -Force -Path $cxDir | Out-Null
$cxFile = Join-Path $cxDir "config.toml"
Backup $cxFile
@"
model = "$NewApiModel"
model_provider = "new-api"

[model_providers.new-api]
name = "New API"
base_url = "$NewApiBase/v1"
env_key = "NEW_API_KEY"
wire_api = "chat"
"@ | Set-Content -Encoding utf8 $cxFile

Write-Host "==> configuring Claude Code"
$clDir = Join-Path $HOME ".claude"
New-Item -ItemType Directory -Force -Path $clDir | Out-Null
$clFile = Join-Path $clDir "settings.json"
Backup $clFile
@"
{
  "env": {
    "ANTHROPIC_BASE_URL": "$NewApiBase",
    "ANTHROPIC_AUTH_TOKEN": "$NewApiKey",
    "ANTHROPIC_MODEL": "$NewApiModel"
  }
}
"@ | Set-Content -Encoding utf8 $clFile

[Environment]::SetEnvironmentVariable("NEW_API_KEY", $NewApiKey, "User")
$env:NEW_API_KEY = $NewApiKey

Write-Host ""
Write-Host "Done."
Write-Host "  New API base : $NewApiBase"
Write-Host "  Model        : $NewApiModel"
Write-Host "Open a new terminal so NEW_API_KEY is available for Codex."
