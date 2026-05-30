#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

case "${1:-}" in
  --restore|restore|uninstall)
    node "$SCRIPT_DIR/uninstall-openchamber-rtl.mjs"
    ;;
  ""|install)
    node "$SCRIPT_DIR/install-openchamber-rtl.mjs"
    ;;
  *)
    echo "Usage: $0 [--restore]" >&2
    exit 2
    ;;
esac
