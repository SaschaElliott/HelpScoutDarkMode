# HelpScout Dark Mode — Chrome Extension

A comprehensive dark mode for [app.helpscout.com](https://app.helpscout.com), built as a Manifest V3 Chrome extension.

## Color palette

| Token | Hex | Used for |
|---|---|---|
| `--hs-bg` | `#1c1a17` | Primary page background |
| `--hs-surface` | `#242220` | Elevated panels, sidebar, header |
| `--hs-elevated` | `#2c2a27` | Inputs, cards, dropdowns |
| `--hs-border` | `#3a3835` | Subtle dividers |
| `--hs-border-active` | `#4a4845` | Interactive borders |
| `--hs-text` | `#e8e4de` | Primary text |
| `--hs-text-muted` | `#b0a99f` | Secondary / timestamps |
| `--hs-accent` | `#4aabea` | Links, focus rings, active items |

## What's covered

- Top header bar (logo, search, nav icons)
- Left sidebar (mailboxes, folders, conversation list, unread badges)
- Conversation thread — customer (inbound) and agent (outbound) message bubbles, timestamps, avatars
- Reply composer outer chrome + toolbar (bold/italic/link buttons etc.)
- **Reply composer inner `<iframe>`** — CSS injected directly into the iframe's `contentDocument` via a `MutationObserver` so the rich-text editor area goes dark too
- Customer profile right panel — name, email, previous conversations, custom fields
- Tags, assignee dropdowns, status badges, conversation labels
- Modals and overlay dialogs
- Dropdown menus and tooltips
- Emoji/reaction chips — dark pill with hover glow; emoji characters themselves are **never** inverted or desaturated
- Scrollbars styled via `scrollbar-color` and `::-webkit-scrollbar`
- Internal notes (amber left border), quoted email blocks, code snippets
- Skeleton/loading states, empty states, alert banners

## How to install (unpacked)

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `helpscout-dark-mode` folder (this directory)
5. Navigate to `app.helpscout.com` — dark mode is active immediately

## Toggle dark mode

A small **☀** button appears in the bottom-right corner of every HelpScout page. Click it to flip dark mode off/on. Your preference is saved in `localStorage` and persists across tabs and sessions.

## Customising colors

All colors are defined as CSS custom properties at the top of `styles.css`:

```css
:root {
  --hs-bg:          #1c1a17;
  --hs-surface:     #242220;
  --hs-elevated:    #2c2a27;
  --hs-border:      #3a3835;
  --hs-border-active: #4a4845;
  --hs-text:        #e8e4de;
  --hs-text-muted:  #b0a99f;
  --hs-accent:      #4aabea;
}
```

Edit those values and reload the extension (`chrome://extensions/` → refresh icon) to see changes.

The same tokens are mirrored in the `IFRAME_STYLES` constant inside `content.js` for the reply editor iframe. Update both if you change the palette.

## File structure

```
helpscout-dark-mode/
├── manifest.json      — Manifest V3 config
├── styles.css         — All dark-mode CSS overrides (injected via manifest)
├── content.js         — MutationObserver for iframes + toggle button logic
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## Technical notes

- **Manifest V3** — uses `content_scripts` with `"all_frames": true` so the stylesheet is also applied to same-origin iframes automatically; `content.js` additionally injects a `<style>` block directly into cross-origin iframe `contentDocument`s for the reply editor.
- **MutationObserver** watches `document.documentElement` for any newly added `<iframe>` nodes (the HelpScout reply box is rendered late). When one appears, styles are injected immediately or on its `load` event.
- **SPA navigation** — HelpScout is a single-page app. `history.pushState`, `history.replaceState`, and `popstate` are intercepted to re-attach the toggle button and re-scan for new iframes after each route change.
- **No DOM structure changes** — the extension only injects a `<style>` element and one `<button>` into `document.body`. No existing event listeners, attributes, or DOM nodes are modified.
