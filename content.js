/**
 * HelpScout Dark Mode — content.js
 */

(function () {
  'use strict';

  const STORAGE_KEY    = 'hs-dark-mode-enabled';
  const TOGGLE_ID      = 'hs-dark-toggle';
  const DISABLED_CLASS = 'hs-dark-disabled';

  // CSS injected directly into reply-editor iframes
  const IFRAME_STYLES = `
    html { filter: invert(1) hue-rotate(180deg) !important; }
    body {
      filter: invert(1) hue-rotate(180deg) !important;
      background-color: #2c2a27 !important;
      color: #e8e4de !important;
    }
    a { color: #4aabea !important; }
    blockquote, .gmail_quote {
      background: #2c2a27 !important;
      border-left: 3px solid #4a4845 !important;
      color: #b0a99f !important;
    }
    ::-webkit-scrollbar { width: 8px; }
    ::-webkit-scrollbar-track { background: #242220; }
    ::-webkit-scrollbar-thumb { background: #4a4845; border-radius: 4px; }
    [contenteditable], [role="textbox"], .ProseMirror, .public-DraftEditor-content {
      background: #2c2a27 !important;
      color: #e8e4de !important;
      caret-color: #e8e4de !important;
    }
  `;

  // -------------------------------------------------------------------------
  // Inject styles into an iframe's contentDocument
  // -------------------------------------------------------------------------
  function injectIntoDoc(doc) {
    if (!doc || !doc.head) return;
    if (doc.getElementById('hs-dark-iframe')) return;
    try {
      const s = doc.createElement('style');
      s.id = 'hs-dark-iframe';
      s.textContent = IFRAME_STYLES;
      doc.head.appendChild(s);
    } catch (_) {}
  }

  function tryIframe(iframe) {
    const inject = () => {
      try {
        const doc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
        if (doc && doc.readyState !== 'loading') {
          injectIntoDoc(doc);
        } else if (doc) {
          doc.addEventListener('DOMContentLoaded', () => injectIntoDoc(doc));
        }
      } catch (_) {}
    };
    inject();
    iframe.addEventListener('load', inject);
  }

  function scanIframes() {
    document.querySelectorAll('iframe').forEach(tryIframe);
  }

  // -------------------------------------------------------------------------
  // MutationObserver for dynamically added iframes and thread items
  // -------------------------------------------------------------------------
  new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.tagName === 'IFRAME') tryIframe(node);
        node.querySelectorAll && node.querySelectorAll('iframe').forEach(tryIframe);
        // Fix emoji in newly added thread items
        if (node.classList && node.classList.contains('thread-item')) fixThreadEmoji(node);
        node.querySelectorAll && node.querySelectorAll('.thread-item').forEach(fixThreadEmoji);
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  // -------------------------------------------------------------------------
  // Emoji fix — wrap plain Unicode emoji in thread items with a correcting
  // span so they get 2 inversions (html + span) = identity = original colors.
  // Only splits text nodes; never touches elements or layout.
  // -------------------------------------------------------------------------
  const EMOJI_RE = /(\p{Extended_Pictographic}\p{Emoji_Modifier}?)/gu;

  function fixThreadEmoji(root) {
    if (isDarkEnabled && !isDarkEnabled()) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) {
      if (!n.textContent.match(EMOJI_RE)) continue;
      if (n.parentElement && n.parentElement.closest('[data-slate-editor]')) continue;
      if (n.parentElement && n.parentElement.closest('[data-hs-emoji]')) continue;
      nodes.push(n);
    }
    for (const textNode of nodes) wrapEmojiInNode(textNode);
  }

  function wrapEmojiInNode(textNode) {
    const text = textNode.textContent;
    const re = new RegExp(EMOJI_RE.source, 'gu');
    const frag = document.createDocumentFragment();
    let last = 0, match;
    while ((match = re.exec(text)) !== null) {
      if (match.index > last) frag.appendChild(document.createTextNode(text.slice(last, match.index)));
      const span = document.createElement('span');
      span.setAttribute('data-hs-emoji', '');
      span.style.cssText = 'filter:invert(1) hue-rotate(180deg);display:inline';
      span.textContent = match[0];
      frag.appendChild(span);
      last = re.lastIndex;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    if (frag.childNodes.length > 1) textNode.parentNode.replaceChild(frag, textNode);
  }

  // -------------------------------------------------------------------------
  // Dark mode state — stored on <html> class
  // -------------------------------------------------------------------------
  function isDarkEnabled() {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === null ? true : v === 'true';
  }

  function applyState(enabled) {
    document.documentElement.classList.toggle(DISABLED_CLASS, !enabled);
    const btn = document.getElementById(TOGGLE_ID);
    if (btn) {
      btn.textContent = enabled ? '☀' : '🌙';
      btn.title = enabled ? 'Disable dark mode' : 'Enable dark mode';
    }
  }

  // -------------------------------------------------------------------------
  // Softening overlay (lifts blacks to gray without shifting hues)
  // -------------------------------------------------------------------------
  function createOverlay() {
    if (document.getElementById('hs-dark-overlay')) return;
    const el = document.createElement('div');
    el.id = 'hs-dark-overlay';
    document.body.appendChild(el);
  }

  // -------------------------------------------------------------------------
  // Toggle button
  // -------------------------------------------------------------------------
  function createToggle() {
    if (document.getElementById(TOGGLE_ID)) return;
    const btn = document.createElement('button');
    btn.id = TOGGLE_ID;
    btn.textContent = isDarkEnabled() ? '☀' : '🌙';
    btn.title = isDarkEnabled() ? 'Disable dark mode' : 'Enable dark mode';
    btn.addEventListener('click', () => {
      const next = !isDarkEnabled();
      localStorage.setItem(STORAGE_KEY, String(next));
      applyState(next);
    });
    document.body.appendChild(btn);
  }

  // -------------------------------------------------------------------------
  // Init
  // -------------------------------------------------------------------------
  function init() {
    scanIframes();
    applyState(isDarkEnabled());
    createOverlay();
    createToggle();
    document.querySelectorAll('.thread-item').forEach(fixThreadEmoji);
  }

  if (document.body) {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }

  // SPA navigation support
  const patch = (orig) => function (...args) {
    orig.apply(this, args);
    requestAnimationFrame(() => {
      if (!document.getElementById('hs-dark-overlay')) createOverlay();
      if (!document.getElementById(TOGGLE_ID)) createToggle();
      applyState(isDarkEnabled());
      scanIframes();
    });
  };
  history.pushState    = patch(history.pushState);
  history.replaceState = patch(history.replaceState);
  window.addEventListener('popstate', () => {
    requestAnimationFrame(() => {
      if (!document.getElementById('hs-dark-overlay')) createOverlay();
      if (!document.getElementById(TOGGLE_ID)) createToggle();
      applyState(isDarkEnabled());
      scanIframes();
    });
  });

})();
