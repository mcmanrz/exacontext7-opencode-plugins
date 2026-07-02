#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[+]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
err()  { echo -e "${RED}[-]${NC} $*" >&2; }

PKG="exacontext7-opencode-plugins"
EXA_FLAGS=()
CTX7_FLAGS=()
DRY_FLAG=""
MODE="--install"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --uninstall|-u)
      MODE="--uninstall"
      log "Uninstalling $PKG ..."
      ;;
    --help|-h)
      echo "Usage: $0 [--install | --uninstall] [--dry-run]"
      echo "       [--exa-keys key1,key2] [--context7-keys key3]"
      echo ""
      echo "Installs or removes exacontext7-opencode-plugins from your global"
      echo "opencode config (~/.config/opencode/opencode.jsonc)."
      echo ""
      echo "Each service supports round-robin rotation across multiple API keys"
      echo "via KeyPool. Separate scopes prevent cross-service key contamination."
      exit 0
      ;;
    --dry-run)
      DRY_FLAG="--dry-run"
      ;;
    --exa-keys)
      EXA_FLAGS=("--exa-keys" "$2")
      shift
      ;;
    --context7-keys)
      CTX7_FLAGS=("--context7-keys" "$2")
      shift
      ;;
    *)
      shift
      ;;
  esac
  shift 2>/dev/null || true
done

if ! command -v node &>/dev/null; then
  err "Node.js is required. Install it from https://nodejs.org"
  exit 1
fi

if ! command -v npm &>/dev/null; then
  err "npm is required (bundled with Node.js)."
  exit 1
fi

log "Installing npm package globally ..."
npm install -g "$PKG" 2>&1 | tail -1

log "Updating opencode global config ..."

node -e "require('$PKG/dist/install.js')" \
  "$MODE" \
  $DRY_FLAG \
  "${EXA_FLAGS[@]}" \
  "${CTX7_FLAGS[@]}"

log "Done! Plugin '$PKG' is now configured."
log "Your Exa and Context7 tools will load on next opencode restart."
