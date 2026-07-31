import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const runtime = fs.readFileSync(new URL("../openchamber-rtl-patch.js", import.meta.url), "utf8");

test("runtime enables RTL when any RTL character appears, even after English text", () => {
  assert.match(runtime, /function shouldApplyRtl/);
  assert.match(runtime, /RTL_CHAR_RE\.test\(text\)/);
  assert.doesNotMatch(runtime, /firstStrong/i);
});

test("runtime keeps code-like surfaces LTR", () => {
  assert.match(runtime, /data-component="markdown-code"/);
  assert.match(runtime, /pre,\s*code/);
  assert.match(runtime, /direction:\s*ltr !important/);
});

test("runtime uses scoped data attributes instead of flipping the whole app", () => {
  assert.match(runtime, /data-openchamber-rtl/);
  assert.doesNotMatch(runtime, /document\.documentElement\.dir\s*=/);
  assert.doesNotMatch(runtime, /document\.body\.dir\s*=/);
});

test("runtime scans text nodes so message markup without known classes is handled", () => {
  assert.match(runtime, /createTreeWalker/);
  assert.match(runtime, /SHOW_TEXT/);
  assert.match(runtime, /nearestTextSurface/);
});

test("runtime treats Arabic suggestion cards as RTL surfaces", () => {
  assert.match(runtime, /SUGGESTION_SELECTOR/);
  assert.match(runtime, /button\[aria-label\*='suggest'/i);
  assert.match(runtime, /\.oc-draft-starters button/);
  assert.match(runtime, /pencil-ai-2/);
  assert.match(runtime, /data-openchamber-rtl-suggestion/);
});

test("runtime batches mutation roots instead of cancelling earlier scans", () => {
  assert.match(runtime, /pendingScanRoots/);
  assert.match(runtime, /pendingScanRoots\.add/);
  assert.doesNotMatch(runtime, /cancelAnimationFrame\(scheduleScan\.frame\)/);
});

test("runtime avoids broad container alignment that can move surrounding UI", () => {
  assert.doesNotMatch(runtime, /data-openchamber-rtl-container/);
  assert.doesNotMatch(runtime, /\[class\*='chat' i\]/);
  assert.doesNotMatch(runtime, /\[class\*='message' i\]/);
  assert.doesNotMatch(runtime, /markContainer/);
});
