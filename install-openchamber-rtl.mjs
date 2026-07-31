#!/usr/bin/env node
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const APP_PATH = "/Applications/OpenChamber.app";
const RESOURCES_DIR = `${APP_PATH}/Contents/Resources`;
const WEB_DIST_DIR = `${RESOURCES_DIR}/web-dist`;
const INDEX_HTML_PATH = `${WEB_DIST_DIR}/index.html`;
const MINI_CHAT_HTML_PATH = `${WEB_DIST_DIR}/mini-chat.html`;
const ASSETS_DIR = `${WEB_DIST_DIR}/assets`;
const STATE_DIR = join(homedir(), "Library/Application Support/OpenChamber RTL Patch");
const STATE_PATH = join(STATE_DIR, "state.json");
const ORIGINAL_APPS_DIR = join(STATE_DIR, "original-apps");
const HTML_FILES = [
  ["index.html", INDEX_HTML_PATH],
  ["mini-chat.html", MINI_CHAT_HTML_PATH],
];

export const OPENCHAMBER_RTL_SCRIPT_RE = /\s*<script\b[^>]*\bsrc=["']\/assets\/openchamber-rtl-patch[^"']*\.js["'][^>]*><\/script>/g;

export function hasOpenChamberRtlScript(html) {
  OPENCHAMBER_RTL_SCRIPT_RE.lastIndex = 0;
  return OPENCHAMBER_RTL_SCRIPT_RE.test(html);
}

export function injectRtlScriptIntoHtml(html, scriptPath) {
  if (!html.includes('id="root"')) {
    throw new Error("Could not find the OpenChamber root element");
  }
  const cleaned = html.replace(OPENCHAMBER_RTL_SCRIPT_RE, "");
  if (cleaned.includes(scriptPath)) return cleaned;
  if (!cleaned.includes("</body>")) {
    throw new Error("Could not find </body> in OpenChamber HTML");
  }
  return cleaned.replace("</body>", `    <script defer src="${scriptPath}"></script>\n  </body>`);
}

export function shouldReuseExistingBackup({ backupExists, currentIsPatched, currentHash, backupHash }) {
  if (!backupExists) return false;
  if (currentIsPatched) return true;
  return currentHash === backupHash;
}

function run(command, args, options = {}) {
  return execFileSync(command, args, { stdio: "inherit", ...options });
}

function output(command, args) {
  return execFileSync(command, args, { encoding: "utf8" }).trim();
}

export function getInstalledOpenChamberVersion() {
  return output("/usr/libexec/PlistBuddy", ["-c", "Print :CFBundleShortVersionString", `${APP_PATH}/Contents/Info.plist`]);
}

export function isOfficiallySignedApp(appPath = APP_PATH) {
  try {
    execFileSync("codesign", ["--verify", "--deep", "--strict", appPath], { stdio: "ignore" });
    const details = execFileSync("/bin/sh", ["-c", `codesign -dvvv --requirements - "$1" 2>&1`, "codesign", appPath], { encoding: "utf8" });
    return /TeamIdentifier=\S+/.test(details) && !/TeamIdentifier=not set/.test(details);
  } catch {
    return false;
  }
}

function copyAppBundle(source, destination) {
  run("ditto", [source, destination]);
}

export function ensureOriginalAppBackup(version = getInstalledOpenChamberVersion()) {
  mkdirSync(ORIGINAL_APPS_DIR, { recursive: true });
  const backupPath = join(ORIGINAL_APPS_DIR, `${version}.app`);
  if (existsSync(backupPath)) return backupPath;
  if (!isOfficiallySignedApp(APP_PATH)) return null;
  console.log(`Saving the official signed OpenChamber ${version} bundle...`);
  copyAppBundle(APP_PATH, backupPath);
  return backupPath;
}

export function readPatchState() {
  return existsSync(STATE_PATH) ? JSON.parse(readFileSync(STATE_PATH, "utf8")) : null;
}

export function writePatchState(state) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);
}

export function prepareOfficialAppForUpdate() {
  const state = readPatchState();
  if (!state?.originalAppPath || !existsSync(state.originalAppPath)) {
    throw new Error("No official signed app backup exists. Install the patch once from an official OpenChamber build first.");
  }
  console.log(`Restoring official signed OpenChamber ${state.originalAppVersion || state.openChamberVersion} before update...`);
  stopOpenChamberIfRunning();
  rmSync(APP_PATH, { recursive: true, force: true });
  copyAppBundle(state.originalAppPath, APP_PATH);
  writePatchState({
    ...state,
    updatePreparedAt: new Date().toISOString(),
    updatePreparedFromVersion: state.openChamberVersion,
  });
  console.log("Official app restored. Start the update from OpenChamber; the smart watcher will reapply RTL after restart.");
}

function sha256Buffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function sha256File(filePath) {
  return sha256Buffer(readFileSync(filePath));
}

function webDistHashFrom(paths) {
  const hash = createHash("sha256");
  for (const [, filePath] of paths) {
    hash.update(basename(filePath));
    hash.update("\0");
    hash.update(readFileSync(filePath));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function backupHash(backupDir) {
  return webDistHashFrom(HTML_FILES.map(([name]) => [name, join(backupDir, name)]));
}

function currentHtmlIsPatched() {
  return HTML_FILES.some(([, filePath]) => hasOpenChamberRtlScript(readFileSync(filePath, "utf8")));
}

function stopOpenChamberIfRunning() {
  try {
    run("osascript", ["-e", 'tell application "OpenChamber" to quit']);
  } catch {
    // OpenChamber may not be running or may not be scriptable.
  }
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      execFileSync("pgrep", ["-f", `${APP_PATH}/Contents/MacOS/OpenChamber$`], { stdio: "ignore" });
      execFileSync("sleep", ["1"]);
    } catch {
      return;
    }
  }
  throw new Error("OpenChamber did not quit cleanly; refusing to replace the app while it is running.");
}

function adHocResignApp() {
  try {
    run("codesign", ["--force", "--deep", "--sign", "-", APP_PATH]);
  } catch {
    console.warn("Warning: ad-hoc codesign failed. If macOS refuses to open OpenChamber, restore with --restore.");
  }
}

function removeOldPatchAssets() {
  if (!existsSync(ASSETS_DIR)) return;
  for (const entry of readdirSync(ASSETS_DIR)) {
    if (/^openchamber-rtl-patch.*\.js$/.test(entry)) {
      rmSync(join(ASSETS_DIR, entry), { force: true });
    }
  }
}

export function installRtlPatch() {
  if (!existsSync(APP_PATH) || !existsSync(WEB_DIST_DIR) || !existsSync(ASSETS_DIR)) {
    throw new Error(`OpenChamber.app was not found at ${APP_PATH} or its web-dist folder is missing`);
  }
  for (const [, filePath] of HTML_FILES) {
    if (!existsSync(filePath)) throw new Error(`Missing ${filePath}`);
  }

  const here = dirname(fileURLToPath(import.meta.url));
  const rtlPatchPath = join(here, "openchamber-rtl-patch.js");
  if (!existsSync(rtlPatchPath)) throw new Error(`Missing ${rtlPatchPath}`);

  mkdirSync(STATE_DIR, { recursive: true });
  const previousState = readPatchState();
  const previousBackupDir = previousState?.backupDir;
  const backupExists = previousBackupDir != null && HTML_FILES.every(([name]) => existsSync(join(previousBackupDir, name)));
  const currentHash = webDistHashFrom(HTML_FILES);
  const previousBackupHash = backupExists ? backupHash(previousBackupDir) : null;
  const currentIsPatched = currentHtmlIsPatched();
  const canReuseBackup = shouldReuseExistingBackup({
    backupExists,
    currentIsPatched,
    currentHash,
    backupHash: previousBackupHash,
  });
  if (currentIsPatched && !canReuseBackup) {
    throw new Error("OpenChamber already appears patched, but the original backup is missing. Restore from a known-good install before patching again.");
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = canReuseBackup ? previousBackupDir : join(STATE_DIR, `backup-${stamp}`);
  const patchHash = sha256File(rtlPatchPath).slice(0, 12);
  const patchFileName = `openchamber-rtl-patch-${patchHash}.js`;
  const patchRelativeSrc = `/assets/${patchFileName}`;
  const patchDestPath = join(ASSETS_DIR, patchFileName);
  const currentVersion = getInstalledOpenChamberVersion();
  const originalAppPath = ensureOriginalAppBackup(currentVersion) || previousState?.originalAppPath || null;

  console.log("Stopping OpenChamber if it is running...");
  stopOpenChamberIfRunning();

  mkdirSync(backupDir, { recursive: true });
  if (canReuseBackup) {
    console.log(`Keeping original backup at ${backupDir}...`);
  } else {
    console.log("Backing up OpenChamber web-dist HTML files...");
    for (const [name, filePath] of HTML_FILES) {
      copyFileSync(filePath, join(backupDir, name));
    }
  }

  console.log("Installing RTL runtime patch...");
  removeOldPatchAssets();
  copyFileSync(rtlPatchPath, patchDestPath);
  for (const [, filePath] of HTML_FILES) {
    const html = readFileSync(filePath, "utf8");
    writeFileSync(filePath, injectRtlScriptIntoHtml(html, patchRelativeSrc));
  }

  writePatchState({
    installedAt: new Date().toISOString(),
    appPath: APP_PATH,
    webDistDir: WEB_DIST_DIR,
    backupDir,
    htmlFiles: Object.fromEntries(HTML_FILES),
    patchFileName,
    openChamberVersion: currentVersion,
    originalAppPath,
    originalAppVersion: originalAppPath ? basename(originalAppPath, ".app") : null,
  });

  console.log("Re-signing OpenChamber locally...");
  adHocResignApp();

  console.log("OpenChamber RTL patch installed. Reopen OpenChamber.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  installRtlPatch();
}
