(function () {
  "use strict";

  const PATCH_ID = "openchamber-rtl-runtime-patch";
  const STYLE_ID = "openchamber-rtl-runtime-style";
  const RTL_CHAR_RE = /[\u0591-\u07ff\ufb1d-\ufdff\ufe70-\ufefc]/;
  const TARGET_SELECTOR = [
    "textarea",
    "input[type='text']",
    "input[type='search']",
    "[contenteditable='true']",
    "[role='textbox']",
    "[data-markdown]",
    "[data-markdown] p",
    "[data-markdown] li",
    "[data-markdown] blockquote",
    ".typography-markdown-body",
    ".typography-body",
    "[class*='message' i]",
    "[class*='chat' i]",
    "[class*='prose' i]",
    "p",
    "li",
    "blockquote",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
  ].join(",");
  const pendingScanRoots = new Set();
  const SKIP_SELECTOR = [
    "pre",
    "code",
    "kbd",
    "samp",
    "var",
    ".cm-editor",
    ".monaco-editor",
    ".hljs",
    "[class~='font-mono']",
    "[class*='terminal' i]",
    "[class*='diff' i]",
    "[data-component='markdown-code']",
    "[data-markdown='mermaid-block']",
    "[data-markdown='table']",
    "[data-language]",
  ].join(",");
  const CONTAINER_SELECTOR = [
    "[data-markdown]",
    ".typography-markdown-body",
    ".typography-body",
    "[class*='message' i]",
    "[class*='chat' i]",
    "[role='textbox']",
  ].join(",");
  const TEXT_SURFACE_SELECTOR = [
    "p",
    "li",
    "blockquote",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    ".typography-markdown-body",
    ".typography-body",
    "[data-markdown]",
    "[class*='message' i]",
    "[class*='chat' i]",
    "[class*='prose' i]",
  ].join(",");

  if (window[PATCH_ID]) return;
  window[PATCH_ID] = true;

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      [data-openchamber-rtl="true"] {
        direction: rtl !important;
        text-align: right !important;
        unicode-bidi: plaintext;
      }

      [data-openchamber-rtl-container="true"] {
        text-align: right !important;
      }

      [data-openchamber-rtl-text-surface="true"] {
        direction: rtl !important;
        text-align: right !important;
        unicode-bidi: plaintext;
      }

      [data-openchamber-rtl-container="true"] p,
      [data-openchamber-rtl-container="true"] li,
      [data-openchamber-rtl-container="true"] blockquote,
      [data-openchamber-rtl-container="true"] .typography-body,
      [data-openchamber-rtl-container="true"] .typography-markdown-body {
        direction: rtl !important;
        text-align: right !important;
        unicode-bidi: plaintext;
      }

      textarea[data-openchamber-rtl="true"],
      input[data-openchamber-rtl="true"],
      [contenteditable="true"][data-openchamber-rtl="true"],
      [role="textbox"][data-openchamber-rtl="true"] {
        direction: rtl !important;
        text-align: right !important;
        unicode-bidi: plaintext;
      }

      pre,
      code,
      kbd,
      samp,
      var,
      .cm-editor,
      .monaco-editor,
      .hljs,
      [class*="terminal" i],
      [class*="diff" i],
      [data-component="markdown-code"],
      [data-markdown="mermaid-block"],
      [data-markdown="table"],
      [data-language] {
        direction: ltr !important;
        text-align: left !important;
        unicode-bidi: isolate;
      }

      [data-openchamber-rtl="true"] pre,
      [data-openchamber-rtl="true"] code,
      [data-openchamber-rtl="true"] kbd,
      [data-openchamber-rtl="true"] samp,
      [data-openchamber-rtl="true"] var {
        direction: ltr !important;
        text-align: left !important;
        unicode-bidi: isolate;
      }
    `;
    document.head.appendChild(style);
  }

  function elementText(element) {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      return element.value || element.placeholder || "";
    }
    return element.innerText || element.textContent || "";
  }

  function isEditable(element) {
    return (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element.isContentEditable ||
      element.getAttribute("role") === "textbox"
    );
  }

  function shouldSkip(element) {
    return Boolean(element.closest(SKIP_SELECTOR));
  }

  function shouldApplyRtl(text) {
    return RTL_CHAR_RE.test(text);
  }

  function isAppShell(element) {
    return element === document.body || element === document.documentElement || element.id === "root";
  }

  function nearestTextSurface(element) {
    if (!(element instanceof HTMLElement) || shouldSkip(element)) return null;
    const explicit = element.closest(TEXT_SURFACE_SELECTOR);
    if (explicit instanceof HTMLElement && !isAppShell(explicit) && !shouldSkip(explicit)) {
      return explicit;
    }

    let current = element;
    while (current && current instanceof HTMLElement && !isAppShell(current)) {
      if (shouldSkip(current)) return null;
      const style = window.getComputedStyle(current);
      if (style.display !== "inline" && style.display !== "contents") return current;
      current = current.parentElement;
    }
    return null;
  }

  function applyTextNodeDirection(textNode) {
    const text = textNode.nodeValue || "";
    if (!shouldApplyRtl(text)) return;
    const parent = textNode.parentElement;
    const surface = nearestTextSurface(parent);
    if (!surface) return;
    surface.dataset.openchamberRtlTextSurface = "true";
    surface.dataset.openchamberRtl = "true";
    surface.setAttribute("dir", "rtl");
    markContainer(surface, true);
  }

  function scanTextNodes(root) {
    const start = root instanceof HTMLElement ? root : document.body;
    if (!start || shouldSkip(start)) return;
    const walker = document.createTreeWalker(start, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!shouldApplyRtl(node.nodeValue || "")) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent || shouldSkip(parent)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let node = walker.nextNode();
    while (node) {
      applyTextNodeDirection(node);
      node = walker.nextNode();
    }
  }

  function markContainer(element, rtl) {
    const container = element.closest(CONTAINER_SELECTOR);
    if (!container || !(container instanceof HTMLElement) || shouldSkip(container)) return;

    if (rtl) {
      container.dataset.openchamberRtlContainer = "true";
      return;
    }

    if (!RTL_CHAR_RE.test(container.innerText || container.textContent || "")) {
      container.removeAttribute("data-openchamber-rtl-container");
    }
  }

  function applyDirection(element) {
    if (!(element instanceof HTMLElement) || shouldSkip(element)) return;
    const text = elementText(element).trim();
    const rtl = shouldApplyRtl(text);

    if (rtl) {
      element.dataset.openchamberRtl = "true";
      element.setAttribute("dir", "rtl");
      markContainer(element, true);
      return;
    }

    if (isEditable(element)) {
      element.removeAttribute("data-openchamber-rtl");
      element.setAttribute("dir", "auto");
      markContainer(element, false);
    }
  }

  function scan(root = document.body) {
    if (!root) return;
    if (root instanceof HTMLElement && root.matches(TARGET_SELECTOR)) {
      applyDirection(root);
    }
    root.querySelectorAll?.(TARGET_SELECTOR).forEach(applyDirection);
    scanTextNodes(root);
  }

  function scheduleScan(root) {
    if (root instanceof HTMLElement) {
      pendingScanRoots.add(root);
    } else {
      pendingScanRoots.add(document.body);
    }
    if (scheduleScan.frame) return;
    scheduleScan.frame = requestAnimationFrame(() => {
      scheduleScan.frame = 0;
      const roots = [...pendingScanRoots];
      pendingScanRoots.clear();
      for (const pendingRoot of roots) scan(pendingRoot);
    });
  }

  installStyle();
  scan();
  setTimeout(() => scan(), 250);
  setTimeout(() => scan(), 1000);
  setTimeout(() => scan(), 2500);

  document.addEventListener("input", (event) => {
    if (event.target instanceof HTMLElement) applyDirection(event.target);
  }, true);

  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "characterData") {
        const parent = mutation.target.parentElement;
        if (parent) scheduleScan(parent);
      }
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement) scheduleScan(node);
      }
    }
  }).observe(document.documentElement, {
    childList: true,
    characterData: true,
    subtree: true,
  });
})();
