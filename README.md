# Halation

> A lightweight, local-only ambient glow and frosted glass UI extension for YouTube.

Halation samples the playing video into a tiny hardware-accelerated canvas, generating a real-time reactive glow behind the player or across the entire viewport. It strips away YouTube's opaque interface layers to deliver a clean, translucent frosted-glass aesthetic.

---

## Features

- **Fill the Page Mode:** Projects smooth, diffused ambient light across the entire background.
- **Frosted Glass Interface:** Semi-transparent top masthead, search bar, chip filters, and buttons with real-time backdrop blur.
- **Privacy-First & Local:** Zero analytics, zero network requests, and zero data collection. Everything executes entirely in your browser.
- **Performance Optimized:** Uses `requestVideoFrameCallback` with configurable FPS caps and hardware canvas filtering to keep GPU usage low.
- **Customizable Controls:** Adjust intensity, blur radius, saturation, glow scaling, and framerate on the fly via the popup menu.

---

## Installation

### Developer Mode (Chrome, Brave, Edge, Opera)

1. Clone or download this repository

2. Open your Chromium browser and go to chrome://extensions.

3. Enable Developer mode (toggle in the top-right corner).

4. Click Load unpacked in the top-left corner.

5. Select the halation directory containing manifest.json.

6. Open any YouTube watch page and enjoy.

## Permissions & Security
- storage: Saves your visual preferences locally via chrome.storage.local.
- Host Permissions: Runs exclusively on https://www.youtube.com/*.
