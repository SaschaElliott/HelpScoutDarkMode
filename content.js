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
    ::selection {
      background-color: #264f78 !important;
      color: #ffffff !important;
    }
    @media print {
      html, body { filter: none !important; }
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
        // Fix emoji in newly added thread items and search/conversation list rows
        if (node.classList && (
          node.classList.contains('thread-item') ||
          node.classList.contains('is-theme-default') ||
          node.classList.contains('preview') ||
          /ConversationCell/i.test(node.className)
        )) fixThreadEmoji(node);
        node.querySelectorAll && node.querySelectorAll(
          '.thread-item, .is-theme-default, .preview, [class*="ConversationCell"]'
        ).forEach(fixThreadEmoji);
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
  // AI Translate selection highlight fix
  // The OS renders the selection highlight outside the CSS filter pipeline,
  // so ::selection CSS cannot fix the white appearance.
  // Instead: when the translate dialog opens we capture the selection range,
  // mark the selected slate-string spans with data-hs-translate-sel, and use
  // CSS to show a visible highlight on those spans.  We also make ::selection
  // transparent (via body[data-hs-translating]) so the OS white box is hidden.
  // -------------------------------------------------------------------------
  // Save the last editor selection so we can restore it after the toolbar click
  // clears the native selection before the translate dialog fully opens.
  let _savedTranslateRange = null;

  function markTranslateSelection() {
    if (document.body.hasAttribute('data-hs-translating')) return;
    const editor = document.querySelector('[data-slate-editor="true"]');
    if (!editor) return;

    // Prefer the live selection; fall back to the last saved one.
    let range = null;
    try {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) range = sel.getRangeAt(0);
    } catch (_) {}
    if (!range) range = _savedTranslateRange;
    if (!range) return;

    let marked = false;
    try {
      // Target [data-slate-leaf="true"] — the element that actually turns white.
      editor.querySelectorAll('[data-slate-leaf="true"]').forEach(span => {
        if (range.intersectsNode(span)) {
          span.setAttribute('data-hs-translate-sel', '');
          marked = true;
        }
      });
    } catch (_) {}
    if (marked) document.body.setAttribute('data-hs-translating', '');
  }

  function clearTranslateSelection() {
    document.body.removeAttribute('data-hs-translating');
    document.querySelectorAll('[data-hs-translate-sel]').forEach(el => {
      el.removeAttribute('data-hs-translate-sel');
    });
  }

  function watchTranslateDialog() {
    const DIALOG_SEL = '[aria-labelledby="aiAssistDialogTitle"]';

    // Keep the saved range up to date whenever the user selects text in the editor.
    document.addEventListener('selectionchange', () => {
      try {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) return;
        const range = sel.getRangeAt(0);
        const editor = document.querySelector('[data-slate-editor="true"]');
        if (editor && editor.contains(range.commonAncestorContainer)) {
          _savedTranslateRange = range.cloneRange();
        }
      } catch (_) {}
    });

    new MutationObserver(() => {
      const dialog = document.querySelector(DIALOG_SEL);
      if (dialog && dialog.classList.contains('is-open')) {
        markTranslateSelection();
      } else {
        clearTranslateSelection();
      }
    }).observe(document.body, {
      childList: true, subtree: true,
      attributes: true, attributeFilter: ['class']
    });
  }

  // -------------------------------------------------------------------------
  // Selection style override for AI Translate
  // Injected as a <style> tag so it loads last and wins the cascade over
  // HelpScout's own ::selection rules.
  // The Slate editor is double-inverted (html + editor filter = net 0), so
  // the values here are the actual desired display colors (#264f78 bg, white text).
  // -------------------------------------------------------------------------
  function injectSelectionStyle() {
    if (document.getElementById('hs-dark-selection')) return;
    const s = document.createElement('style');
    s.id = 'hs-dark-selection';
    // Appended to <body> so it sits later in the cascade than any <head> styles,
    // including HelpScout's dynamically injected ones.
    // Target the actual Slate text spans directly for maximum specificity.
    s.textContent = `
      [data-slate-editor="true"] [data-slate-string="true"]::selection,
      [data-slate-editor="true"] [data-slate-leaf="true"]::selection,
      [data-slate-editor="true"] span::selection,
      [data-slate-editor="true"]::selection {
        background-color: #264f78 !important;
        color: #ffffff !important;
      }
    `;
    document.body.appendChild(s);
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
    // Overlay, toggle, and selection style only belong in the top-level frame.
    // Sidebar widgets (Shopify, Birdie, etc.) are iframes — skip them.
    if (window === window.top) {
      createOverlay();
      createToggle();
      injectSelectionStyle();
      watchTranslateDialog();
    }
    document.querySelectorAll(
      '.thread-item, .is-theme-default, .preview, [class*="ConversationCell"]'
    ).forEach(fixThreadEmoji);
  }

  if (document.body) {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }

  // SPA navigation support (top-level frame only)
  if (window === window.top) {
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
  }

})();
