#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const APP_PATH = "/Applications/OpenChamber.app";
const STATE_PATH = join(homedir(), "Library/Application Support/OpenChamber RTL Patch/state.json");

function output(command, args) {
  return execFileSync(command, args, { encoding: "utf8" }).trim();
}

function isOfficiallySigned() {
  try {
    execFileSync("codesign", ["--verify", "--deep", "--strict", APP_PATH], { stdio: "ignore" });
    const details = execFileSync("/bin/sh", ["-c", `codesign -dvvv --requirements - "$1" 2>&1`, "codesign", APP_PATH], { encoding: "utf8" });
    return /TeamIdentifier=\S+/.test(details) && !/TeamIdentifier=not set/.test(details);
  } catch {
    return false;
  }
}

const state = existsSync(STATE_PATH) ? JSON.parse(readFileSync(STATE_PATH, "utf8")) : null;
const indexPath = `${APP_PATH}/Contents/Resources/web-dist/index.html`;
const patched = existsSync(indexPath) && /openchamber-rtl-patch[^"']*\.js/.test(readFileSync(indexPath, "utf8"));

console.log(JSON.stringify({
  appPath: APP_PATH,
  version: output("/usr/libexec/PlistBuddy", ["-c", "Print :CFBundleShortVersionString", `${APP_PATH}/Contents/Info.plist`]),
  rtlPatched: patched,
  officialSignature: isOfficiallySigned(),
  originalAppBackup: state?.originalAppPath || null,
  updatePreparedAt: state?.updatePreparedAt || null,
}, null, 2));
