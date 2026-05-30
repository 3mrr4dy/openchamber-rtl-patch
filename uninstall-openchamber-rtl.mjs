#!/usr/bin/env node
import { copyFileSync, existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const APP_PATH = "/Applications/OpenChamber.app";
const ASSETS_DIR = `${APP_PATH}/Contents/Resources/web-dist/assets`;
const STATE_PATH = join(homedir(), "Library/Application Support/OpenChamber RTL Patch/state.json");

function run(command, args, options = {}) {
  return execFileSync(command, args, { stdio: "inherit", ...options });
}

function stopOpenChamberIfRunning() {
  try {
    run("osascript", ["-e", 'tell application "OpenChamber" to quit']);
  } catch {
    // OpenChamber may not be running.
  }
}

function adHocResignApp() {
  try {
    run("codesign", ["--force", "--deep", "--sign", "-", APP_PATH]);
  } catch {
    console.warn("Warning: ad-hoc codesign failed.");
  }
}

function removePatchAssets() {
  if (!existsSync(ASSETS_DIR)) return;
  for (const entry of readdirSync(ASSETS_DIR)) {
    if (/^openchamber-rtl-patch.*\.js$/.test(entry)) {
      rmSync(join(ASSETS_DIR, entry), { force: true });
    }
  }
}

if (!existsSync(STATE_PATH)) {
  throw new Error(`No OpenChamber RTL patch state found at ${STATE_PATH}`);
}

const state = JSON.parse(readFileSync(STATE_PATH, "utf8"));
const backupIndexHtml = join(state.backupDir, "index.html");
const backupMiniChatHtml = join(state.backupDir, "mini-chat.html");
const targetIndexHtml = state.htmlFiles?.["index.html"] || `${APP_PATH}/Contents/Resources/web-dist/index.html`;
const targetMiniChatHtml = state.htmlFiles?.["mini-chat.html"] || `${APP_PATH}/Contents/Resources/web-dist/mini-chat.html`;

if (!existsSync(backupIndexHtml) || !existsSync(backupMiniChatHtml)) {
  throw new Error(`Backup files are missing from ${state.backupDir}`);
}

console.log("Stopping OpenChamber if it is running...");
stopOpenChamberIfRunning();
console.log("Restoring original OpenChamber HTML files...");
copyFileSync(backupIndexHtml, targetIndexHtml);
copyFileSync(backupMiniChatHtml, targetMiniChatHtml);
removePatchAssets();
console.log("Re-signing OpenChamber locally...");
adHocResignApp();
console.log("OpenChamber RTL patch removed. Reopen OpenChamber.");
