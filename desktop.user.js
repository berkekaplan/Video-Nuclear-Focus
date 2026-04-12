// ==UserScript==
// @name         Minimalist Focus (Ultra Minimal)
// @version      8.3
// @description  Aggressively cleans page to focus only on video content
// @author       Admin
// @match        *://*/*
// @exclude      *://*.youtube.com/*
// @grant        GM_openInTab
// @run-at       document-start
// @allFrames    true
// ==/UserScript==

(function() {
    'use strict';

    // ========== CONFIGURATION ==========
    const CONFIG = {
        SPEEDS: [1, 1.25, 1.5, 2, 0.5, 0.75],
        INITIAL_RETRY_DELAY: 2000,
        MAX_RETRY_DELAY: 12000,
        DEBOUNCE_DELAY: 800,
        MAX_Z_INDEX: 2147483647
    };

    // ========== STATE ==========
    let state = {
        currentSpeedIdx: 0,
        isDragging: false,
        dragOffset: { x: 0, y: 0 },
        currentRetryDelay: 2000
    };

    let observer = null;
    let debounceTimerId = null;
    let retryTimerId = null;
    let dragListeners = null;

// ========== CLEANUP ==========
const cleanup = () => {
    const host = document.getElementById('iso-portal-host');
    if (host) host.remove();

    if (observer) {
        observer.disconnect();
        observer = null;
    }

    if (debounceTimerId) {
        clearTimeout(debounceTimerId);
        debounceTimerId = null;
    }

    if (retryTimerId) {
        clearTimeout(retryTimerId);
        retryTimerId = null;
    }

    if (dragListeners) {
        document.removeEventListener('mousemove', dragListeners.onMouseMove);
        document.removeEventListener('mouseup', dragListeners.onMouseUp);
        dragListeners = null;
    }
};

// ========== VIDEO FINDER ==========
const findVideoNuclear = () => {
    const candidates = document.querySelectorAll('video');
    for (const el of candidates) {
        // Skip if element is not visible or has zero dimensions
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) continue;

        // Skip if element is likely an ad (common ad class names)
        const classList = el.className.toLowerCase();
        if (classList.includes('ad') || classList.includes('advertisement') ||
            classList.includes('promo') || classList.includes('banner') ||
            classList.includes('googleads') || classList.includes('doubleclick')) {
            continue;
        }

        // Check if video has valid source
        if (!el.src || el.src.length === 0) {
            // Also check for sources inside video tag
            const hasSource = el.querySelector('source[src]');
            if (!hasSource) continue;
        }

        // Skip very short videos that are likely ads or UI elements
        // (Only check if duration is already available)
        if (el.duration > 0 && el.duration < 3) continue;

        // Check if video is likely content (not UI element)
        const style = window.getComputedStyle(el);
        if (style.position === 'fixed' || style.position === 'absolute') {
            // Check if it's in a reasonable viewing area
            if (rect.top > window.innerHeight * 0.8 || rect.bottom < window.innerHeight * 0.2) {
                continue;
            }
        }

        // Check if video is large enough to be content
        const isLargeEnough = rect.height > 100;
        const isVisible = style.display !== 'none'
        && style.visibility !== 'hidden'
        && style.opacity !== '0';

        if (isLargeEnough && isVisible) return el;
    }
    return null;
};

    // ========== INJECT BUTTON ==========
    const injectButton = (video) => {
        if (document.getElementById('iso-portal-host')) return;

        const host = document.createElement('div');
        host.id = 'iso-portal-host';
        host.style.cssText = `
        position: fixed !important;
        top: 50px !important;
        right: 10px !important;
        z-index: ${CONFIG.MAX_Z_INDEX} !important;
        display: flex;
        align-items: center;
        background: rgba(0, 0, 0, 0.85) !important;
        border: 1px solid rgba(255, 255, 255, 0.3) !important;
        border-radius: 6px !important;
        padding: 2px !important;
        cursor: move !important;
        transition: box-shadow 0.2s, transform 0.2s !important;
        box-shadow: 0 2px 10px rgba(0,0,0,0.5) !important;
        `;

        const onMouseDown = (e) => {
            if (e.target === host || e.target.id === 'iso-portal-toggle') {
                state.isDragging = true;
                const rect = host.getBoundingClientRect();
                state.dragOffset.x = e.clientX - rect.left;
                state.dragOffset.y = e.clientY - rect.top;
                host.style.opacity = '0.9';
            }
        };

        const onMouseMove = (e) => {
            if (state.isDragging) {
                host.style.right = 'auto';
                host.style.left = (e.clientX - state.dragOffset.x) + 'px';
                host.style.top = (e.clientY - state.dragOffset.y) + 'px';
            }
        };

        const onMouseUp = () => {
            state.isDragging = false;
            host.style.opacity = '1';
        };

        dragListeners = { onMouseMove, onMouseUp };

        host.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);

        const shadow = host.attachShadow({ mode: 'open' });
        const isIframe = window.self !== window.top;

        // Only show relevant button based on context
        if (isIframe) {
            // Iframe: only EXTRACT button, no toggle needed
            const btn = document.createElement('button');
            btn.style.cssText = `
            all: unset !important;
            padding: 4px 8px !important;
            color: #fff !important;
            cursor: pointer !important;
            font-family: monospace !important;
            font-size: 10px !important;
            white-space: nowrap;
            background: rgba(0, 0, 0, 0.85) !important;
            border-radius: 6px !important;
            transition: background 0.2s;
            `;
            btn.innerText = 'EXTRACT';
            btn.addEventListener('mouseover', () => btn.style.background = 'rgba(255,255,255,0.2)');
            btn.addEventListener('mouseout', () => btn.style.background = 'rgba(0, 0, 0, 0.85)');
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopImmediatePropagation();
                const a = document.createElement('a');
                a.href = window.location.href;
                a.rel = 'referrer';
                a.target = '_blank';
                document.body.appendChild(a);
                a.click();
                a.remove();
            });
            shadow.appendChild(btn);
        } else {
            // Not iframe: toggle + FOCUS button
            const toggle = document.createElement('div');
            toggle.id = 'iso-portal-toggle';
            toggle.innerHTML = '&#9654;';
            toggle.style.cssText = `
            padding: 4px 6px;
            color: #fff;
            cursor: pointer;
            font-family: monospace;
            font-size: 10px;
            border-right: 1px solid #555;
            user-select: none;
            transition: background 0.2s;
            `;

            const btn = document.createElement('button');
            btn.innerText = 'FOCUS';
            btn.style.cssText = `
            all: unset !important;
            padding: 4px 8px !important;
            color: #fff !important;
            cursor: pointer !important;
            font-family: monospace !important;
            font-size: 10px !important;
            white-space: nowrap;
            transition: background 0.2s;
            `;

            let isOpen = true;
            toggle.addEventListener('click', () => {
                isOpen = !isOpen;
                btn.style.display = isOpen ? 'block' : 'none';
                toggle.innerHTML = isOpen ? '&#9654;' : '&#9664;';
            });

            toggle.addEventListener('mouseover', () => toggle.style.background = 'rgba(255,255,255,0.2)');
            toggle.addEventListener('mouseout', () => toggle.style.background = 'transparent');
            btn.addEventListener('mouseover', () => btn.style.background = 'rgba(255,255,255,0.2)');
            btn.addEventListener('mouseout', () => btn.style.background = 'transparent');

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopImmediatePropagation();
                launchFocus(video);
            });

            shadow.appendChild(toggle);
            shadow.appendChild(btn);
        }

        (document.body || document.documentElement).appendChild(host);
    };

    // ========== FOCUS MODE ==========
    const launchFocus = (video) => {
        if (document.getElementById('p-wrap')) return;

        const originalSpeed = video.playbackRate;

        // Aggressive cleanup - destroy everything
        document.body.replaceChildren();
        cleanup();

        document.body.style.cssText = 'background: #000 !important; margin: 0 !important; overflow: hidden !important; width: 100vw; height: 100vh;';

        // Styles
        const style = document.createElement('style');
        style.id = 'p-styles';
        style.textContent = `
        html, body { background: #000 !important; }
        #p-wrap { position: fixed; inset: 0; display: flex; justify-content: center; align-items: center; background: #000; }
        video, canvas { max-width: 100% !important; max-height: 100vh !important; width: auto !important; height: auto !important; object-fit: contain !important; outline: none !important; }
        #s-ind { position: fixed; top: 20px; right: 20px; color: #888; font-family: monospace; cursor: pointer; z-index: ${CONFIG.MAX_Z_INDEX}; font-size: 14px; transition: color 0.2s; padding: 8px 12px; background: rgba(0,0,0,0.5); border-radius: 4px; }
        #s-ind:hover { color: #fff; }
        `;
        document.head.appendChild(style);

        // Wrap container
        const wrap = document.createElement('div');
        wrap.id = 'p-wrap';

        // Speed indicator
        const speedInd = document.createElement('div');
        speedInd.id = 's-ind';
        speedInd.innerText = `${originalSpeed}X`;

        // Speed control
        speedInd.addEventListener('click', () => {
            state.currentSpeedIdx = (state.currentSpeedIdx + 1) % CONFIG.SPEEDS.length;
            video.playbackRate = CONFIG.SPEEDS[state.currentSpeedIdx];
            speedInd.innerText = `${CONFIG.SPEEDS[state.currentSpeedIdx]}X`;
        });

        // Append to DOM
        document.body.appendChild(wrap);
        document.body.appendChild(speedInd);
        wrap.appendChild(video);

        // Keyboard shortcuts
        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;
            switch(e.key) {
                case 'Escape': location.reload(); break;
                case 's': case 'S': speedInd.click(); break;
            }
        });

        video.controls = true;
        video.play().catch(() => {});
    };

    // ========== MUTATION HANDLER ==========
    const handleMutation = () => {
        if (document.getElementById('iso-portal-host') || document.getElementById('p-wrap')) return;

        const target = findVideoNuclear();
        if (target) {
            state.currentRetryDelay = CONFIG.INITIAL_RETRY_DELAY; // Reset delay
            injectButton(target);
        } else {
            if (retryTimerId) clearTimeout(retryTimerId);
            retryTimerId = setTimeout(handleMutation, state.currentRetryDelay);

            // Gradually increase delay until max limit (Exponential backoff)
            state.currentRetryDelay = Math.min(state.currentRetryDelay * 1.3, CONFIG.MAX_RETRY_DELAY);
        }
    };

    // ========== INITIALIZATION ==========
    observer = new MutationObserver(() => {
        if (debounceTimerId) clearTimeout(debounceTimerId);
        debounceTimerId = setTimeout(handleMutation, CONFIG.DEBOUNCE_DELAY);
    });

    observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true
    });

    handleMutation();

    window.addEventListener('beforeunload', cleanup);
})();
