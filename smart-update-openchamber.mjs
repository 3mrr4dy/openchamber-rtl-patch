#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

import {
  getInstalledOpenChamberVersion,
  installRtlPatch,
  prepareOfficialAppForUpdate,
} from "./install-openchamber-rtl.mjs";

const APP_PATH = "/Applications/OpenChamber.app";
const MAX_WAIT_MS = 30 * 60 * 1000;
const POLL_MS = 2000;

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function openApp() {
  execFileSync("open", ["-a", APP_PATH], { stdio: "inherit" });
}

function appIsRunning() {
  try {
    execFileSync("pgrep", ["-f", `${APP_PATH}/Contents/MacOS/OpenChamber$`], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!existsSync(`${APP_PATH}/Contents/Info.plist`)) {
    throw new Error(`OpenChamber.app was not found at ${APP_PATH}`);
  }

  const previousVersion = getInstalledOpenChamberVersion();
  prepareOfficialAppForUpdate();
  openApp();
  console.log(`Waiting for OpenChamber to move from ${previousVersion} to a newer version.`);
  console.log("Click ‘Restart to Update’ in OpenChamber when it appears. This window must stay open.");

  const deadline = Date.now() + MAX_WAIT_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_MS);
    if (!existsSync(`${APP_PATH}/Contents/Info.plist`)) continue;
    const currentVersion = getInstalledOpenChamberVersion();
    if (currentVersion === previousVersion) continue;

    console.log(`Detected OpenChamber ${currentVersion}. Waiting for the new app to finish launching...`);
    for (let attempt = 0; attempt < 10 && !appIsRunning(); attempt += 1) await sleep(1000);
    installRtlPatch();
    console.log("RTL was reapplied after the update. OpenChamber can now be used normally.");
    return;
  }

  throw new Error("No new OpenChamber version was detected within 30 minutes. The official app was left unpatched and update-safe.");
}

main().catch((error) => {
  console.error(`Smart update failed: ${error.message}`);
  process.exitCode = 1;
});
