# Video-Nuclear-Focus

A high-performance, minimalist userscript designed to isolate web videos and canvases into a dedicated focus mode. Optimized for Firefox (Desktop & Mobile) via Violentmonkey or Tampermonkey.

## Core Philosophy

Most "cinema mode" extensions fail by merely layering elements. **Video-Nuclear-Focus** takes a radical approach: it identifies the primary media element, strips the DOM of all distractions (Nuclear cleaning), and re-renders only the essential video components to maximize CPU/GPU efficiency and eliminate interface clutter.

## Key Features

* **Nuclear Discovery:** Uses a rational filtering algorithm to find hidden or nested video/canvas elements based on visibility and dimensions.
* **DOM Purification:** Injects a clean, black-box environment by replacing `document.body` content to prevent background script interference.
* **Performance Optimized:** * **Debounced MutationObserver:** High 800ms threshold to reduce CPU overhead during page loads.
* **Memory Management:** Automatic observer disconnection upon entering Focus Mode.


* **Speed Control:** Integrated playback rate toggle (0.5x to 2x).
* **Cross-Platform:** Dedicated logic for both Desktop and Mobile interactions.

## Installation

1. Install a userscript manager (e.g., [Violentmonkey](https://violentmonkey.github.io/)).
2. Create a new script.
3. Copy and paste the code from `desktop.user.js` or `mobile.user.js`.
4. Save and navigate to any video hosting site (excluding YouTube).

## Usage

* **EXTRACT/FOCUS Button:** Found at the top right of the viewport.
* **Extract (Iframes):** Opens the source in a new tab to bypass embed restrictions.
* **Focus (Direct):** Triggers the nuclear isolation mode.


* **Exit:** Press `ESC` to reload the page and restore the original DOM.
* **Speed Toggle:** Click the speed indicator (e.g., `1X`) to cycle through playback speeds.

## Technical Constraints

* **YouTube Exclusion:** Purposely excluded via `@exclude` to avoid conflict with YouTube's complex internal state management.
* **State Reset:** Exiting focus mode requires a page reload to ensure full restoration of the original DOM and global listeners.
