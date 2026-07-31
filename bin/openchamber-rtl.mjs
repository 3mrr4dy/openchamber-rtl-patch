#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(dirname(fileURLToPath(import.meta.url)));

const COMMANDS = {
  install: ["install-openchamber-rtl.mjs"],
  restore: ["uninstall-openchamber-rtl.mjs"],
  status: ["status-openchamber-rtl.mjs"],
  update: ["smart-update-openchamber.mjs"],
};

function printHelp() {
  console.log(`OpenChamber RTL CLI

Usage:
  openchamber-rtl <command> [options]

Commands:
  install       Enable or repair RTL and save an official app backup
  restore       Restore the official signed OpenChamber app
  status        Show patch, signature, and backup state
  update        Prepare a safe update and reapply RTL after restart

Options:
  --json        Emit machine-readable JSON (status only)
  -h, --help    Show this help

Examples:
  openchamber-rtl install
  openchamber-rtl status --json
  openchamber-rtl update
`);
}

function runCommand(command, args) {
  const script = COMMANDS[command]?.[0];
  if (!script) {
    printHelp();
    process.exitCode = 2;
    return;
  }
  if (command !== "status" && args.length > 0) {
    console.error(`Unknown option for ${command}: ${args[0]}`);
    process.exitCode = 2;
    return;
  }
  if (command === "status" && args.some((arg) => arg !== "--json")) {
    console.error("status accepts only --json");
    process.exitCode = 2;
    return;
  }
  execFileSync(process.execPath, [join(SCRIPT_DIR, script), ...args], { stdio: "inherit" });
}

const [command = "help", ...args] = process.argv.slice(2);
if (command === "-h" || command === "--help" || command === "help") {
  printHelp();
} else if (command === "--version" || command === "-v") {
  console.log("openchamber-rtl 1.1.0");
} else {
  runCommand(command, args);
}
