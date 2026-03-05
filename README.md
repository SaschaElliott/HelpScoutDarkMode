# HelpScout Dark Mode — Chrome Extension

A comprehensive dark mode for [secure.helpscout.com](https://secure.helpscout.com), built as a Manifest V3 Chrome extension.

## Installation

1. Click the green **Code** button on this page → **Download ZIP**
2. Unzip the downloaded file
3. Open Chrome and go to `chrome://extensions/`
4. Enable **Developer mode** (toggle in the top-right corner)
5. Click **Load unpacked** and select the unzipped folder
6. On the extension's detail page, find **Site access** and turn the toggle **on** for `secure.helpscout.com`
7. Navigate to HelpScout — dark mode is active immediately

## Toggle dark mode

A small **☀** button appears in the bottom-right corner of every HelpScout page. Click it to flip dark mode off/on without uninstalling. Your preference persists across sessions.

## What's covered

- Top header bar (logo, search, nav icons)
- Left sidebar (mailboxes, folders, conversation list, unread badges)
- Conversation thread — customer and agent messages, timestamps, avatars
- Reply composer and toolbar
- Reply composer inner iframe (rich-text editor) — styled via MutationObserver injection
- Customer profile right panel — name, email, previous conversations, custom fields
- Tags, assignee dropdowns, status badges, conversation labels
- Modals, dropdowns, tooltips
- Emoji/reaction chips — dark pill with hover glow; emoji characters preserve their native colors
- Scrollbars
- Charts and reports pages

## Customising colors

Colors are defined as CSS custom properties at the top of `styles.css`:

```css
:root {
  --hs-bg:            #1c1a17;
  --hs-surface:       #242220;
  --hs-elevated:      #2c2a27;
  --hs-border:        #3a3835;
  --hs-border-active: #4a4845;
  --hs-text:          #e8e4de;
  --hs-text-muted:    #b0a99f;
  --hs-accent:        #4aabea;
}
```

Edit those values, then go to `chrome://extensions/` and click the reload icon on the extension to apply changes.

## File structure

```
HelpScoutDarkMode/
├── manifest.json      — Manifest V3 config
├── styles.css         — Dark mode CSS
├── content.js         — iframe injection + toggle button
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## Technical approach

The extension applies `filter: invert(1) hue-rotate(180deg)` to the `<html>` element, which darkens the entire page regardless of HelpScout's internal CSS class names (which use CSS-in-JS and change between deploys). Images and videos are double-inverted to restore their natural colors. A MutationObserver watches for dynamically added iframes (the reply editor loads late) and injects matching dark styles directly into their documents. SPA navigation is handled by intercepting `history.pushState` and `history.replaceState`.
