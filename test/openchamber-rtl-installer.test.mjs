import assert from "node:assert/strict";
import test from "node:test";

import {
  OPENCHAMBER_RTL_SCRIPT_RE,
  hasOpenChamberRtlScript,
  injectRtlScriptIntoHtml,
  shouldReuseExistingBackup,
} from "../install-openchamber-rtl.mjs";

test("injects OpenChamber RTL script before body close", () => {
  const html = "<html><body><div id=\"root\"></div></body></html>";

  const result = injectRtlScriptIntoHtml(html, "/assets/openchamber-rtl-patch-abc123.js");

  assert.match(result, /<script defer src="\/assets\/openchamber-rtl-patch-abc123\.js"><\/script>\s*<\/body>/);
});

test("replaces old OpenChamber RTL script tags instead of duplicating them", () => {
  const html = [
    "<html><body>",
    "<script defer src=\"/assets/openchamber-rtl-patch-old.js\"></script>",
    "<div id=\"root\"></div>",
    "</body></html>",
  ].join("");

  const result = injectRtlScriptIntoHtml(html, "/assets/openchamber-rtl-patch-new.js");

  assert.equal([...result.matchAll(OPENCHAMBER_RTL_SCRIPT_RE)].length, 1);
  assert.match(result, /openchamber-rtl-patch-new\.js/);
  assert.doesNotMatch(result, /openchamber-rtl-patch-old\.js/);
});

test("refuses to patch html without a body close", () => {
  assert.throws(
    () => injectRtlScriptIntoHtml("<html><body><div id=\"root\"></div>", "/assets/openchamber-rtl-patch.js"),
    /<\/body>/,
  );
});

test("reuses backup only when current files are already patched", () => {
  assert.equal(shouldReuseExistingBackup({ backupExists: true, currentIsPatched: true, currentHash: "a", backupHash: "b" }), true);
  assert.equal(shouldReuseExistingBackup({ backupExists: true, currentIsPatched: false, currentHash: "a", backupHash: "a" }), true);
  assert.equal(shouldReuseExistingBackup({ backupExists: true, currentIsPatched: false, currentHash: "a", backupHash: "b" }), false);
  assert.equal(shouldReuseExistingBackup({ backupExists: false, currentIsPatched: false, currentHash: "a", backupHash: "a" }), false);
});

test("detects OpenChamber RTL scripts without regex state leaks", () => {
  const patched = '<script defer src="/assets/openchamber-rtl-patch-abc.js"></script>';
  assert.equal(hasOpenChamberRtlScript(patched), true);
  assert.equal(hasOpenChamberRtlScript(patched), true);
  assert.equal(hasOpenChamberRtlScript("<html></html>"), false);
});
