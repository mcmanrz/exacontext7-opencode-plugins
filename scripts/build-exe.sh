#!/usr/bin/env bash
set -euo pipefail

echo "Building standalone Windows installer (.exe) via Bun compile..."

if ! command -v bun &>/dev/null; then
  echo "Bun is required for .exe compilation. Install from https://bun.sh"
  exit 1
fi

bun build --compile --target=bun-windows-x64 src/install.ts --outfile dist/install.exe
echo "Done: dist/install.exe ($(du -h dist/install.exe | cut -f1))"
