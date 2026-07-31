#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

run_menu() {
  while true; do
    echo
    echo "OpenChamber RTL"
    echo "1) Enable / repair RTL"
    echo "2) Restore official app"
    echo "3) Smart update (restore, update, reapply RTL)"
    echo "4) Show status"
    echo "5) Exit"
    read -r -p "Choose an option: " choice
    case "$choice" in
      1) node "$SCRIPT_DIR/install-openchamber-rtl.mjs"; read -r -p "Press Enter to continue..." _ ;;
      2) node "$SCRIPT_DIR/uninstall-openchamber-rtl.mjs"; read -r -p "Press Enter to continue..." _ ;;
      3) node "$SCRIPT_DIR/smart-update-openchamber.mjs"; read -r -p "Press Enter to continue..." _ ;;
      4) node "$SCRIPT_DIR/status-openchamber-rtl.mjs"; read -r -p "Press Enter to continue..." _ ;;
      5|q|Q) return 0 ;;
      *) echo "Unknown option." ;;
    esac
  done
}

case "${1:-}" in
  --menu|menu)
    run_menu
    ;;
  --smart-update|smart-update|update)
    node "$SCRIPT_DIR/smart-update-openchamber.mjs"
    ;;
  --status|status)
    node "$SCRIPT_DIR/status-openchamber-rtl.mjs"
    ;;
  --restore|restore|uninstall)
    node "$SCRIPT_DIR/uninstall-openchamber-rtl.mjs"
    ;;
  ""|install)
    node "$SCRIPT_DIR/install-openchamber-rtl.mjs"
    ;;
  *)
    echo "Usage: $0 [install|--restore|--smart-update|--status|--menu]" >&2
    exit 2
    ;;
esac
