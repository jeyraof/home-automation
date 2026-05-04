#!/usr/bin/env zsh

set -euo pipefail

SCRIPT_PATH="${0:A}"
SCRIPT_DIR="${SCRIPT_PATH:h}"
PROJECT_ROOT="${SCRIPT_DIR:h}"

cd "$PROJECT_ROOT"
mkdir -p "$PROJECT_ROOT/logs"

if command -v mise >/dev/null 2>&1; then
  MISE_BIN="$(command -v mise)"
elif [[ -x "/opt/homebrew/bin/mise" ]]; then
  MISE_BIN="/opt/homebrew/bin/mise"
elif [[ -x "$HOME/.local/bin/mise" ]]; then
  MISE_BIN="$HOME/.local/bin/mise"
elif [[ -x "$HOME/.mise/bin/mise" ]]; then
  MISE_BIN="$HOME/.mise/bin/mise"
else
  echo "mise not found. Install mise or add it to PATH." >&2
  exit 127
fi

exec "$MISE_BIN" exec -- node src/cli.js ustock quote 두나무 --send

