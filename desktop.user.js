// ==UserScript==
// @name         Minimalist Focus (Ultra Minimal)
// @version      8.4
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

    const CONFIG = {
        SPEEDS: [1, 1.25, 1.5, 2, 0.5, 0.75],
        MAX_Z_INDEX: 2147483647
    };

    let state = {
        currentSpeedIdx: 0
    };

    const findVideoNuclear = () => {
        const candidates = document.querySelectorAll('video, canvas');
        for (const el of candidates) {
            const rect = el.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) continue;

            const isLargeEnough = el.tagName === 'VIDEO'
            ? rect.height > 100
            : rect.width > 400;

            const style = window.getComputedStyle(el);
            const isVisible = style.display !== 'none'
            && style.visibility !== 'hidden'
            && style.opacity !== '0';

            if (isLargeEnough && isVisible) return el;
        }
        return null;
    };

    const launchFocus = (video) => {
        if (document.getElementById('p-wrap')) return;

        const originalSpeed = video.playbackRate;

        document.body.replaceChildren();

        document.body.style.cssText = 'background: #000 !important; margin: 0 !important; overflow: hidden !important; width: 100vw; height: 100vh;';

        const style = document.createElement('style');
        style.id = 'p-styles';
        style.textContent = `
        html, body { background: #000 !important; }
        #p-wrap { position: fixed; inset: 0; display: flex; justify-content: center; align-items: center; background: #000; }
        video, canvas { object-fit: contain !important; outline: none !important; }
        video:not(.portrait) { width: 75% !important; height: auto !important; }
        video.portrait { width: auto !important; height: 75vh !important; }
        #s-ind { position: fixed; top: 20px; right: 20px; color: #888; font-family: monospace; cursor: pointer; z-index: ${CONFIG.MAX_Z_INDEX}; font-size: 14px; transition: color 0.2s; padding: 8px 12px; background: rgba(0,0,0,0.5); border-radius: 4px; }
        #s-ind:hover { color: #fff; }
        `;
        document.head.appendChild(style);

        const wrap = document.createElement('div');
        wrap.id = 'p-wrap';

        const speedInd = document.createElement('div');
        speedInd.id = 's-ind';
        speedInd.innerText = `${originalSpeed}X`;

        speedInd.addEventListener('click', () => {
            state.currentSpeedIdx = (state.currentSpeedIdx + 1) % CONFIG.SPEEDS.length;
            video.playbackRate = CONFIG.SPEEDS[state.currentSpeedIdx];
            speedInd.innerText = `${CONFIG.SPEEDS[state.currentSpeedIdx]}X`;
        });

        document.body.appendChild(wrap);
        document.body.appendChild(speedInd);
        wrap.appendChild(video);

        // Add a category based on the aspect ratio when video metadata is uploaded
        const applyOrientationClass = () => {
            if (video.videoWidth && video.videoHeight) {
                if (video.videoHeight > video.videoWidth) {
                    video.classList.add('portrait');
                } else {
                    video.classList.remove('portrait');
                }
            }
        };

        if (video.readyState >= 1) {
            applyOrientationClass();
        } else {
            video.addEventListener('loadedmetadata', applyOrientationClass);
        }

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

    // ========== FIXED SEARCH BUTTON (Collapsed by default) ==========
    const injectSearchButton = () => {
        if (document.getElementById('iso-search-host')) return;

        const host = document.createElement('div');
        host.id = 'iso-search-host';
        host.style.cssText = `
        position: fixed !important;
        top: 10px !important;
        right: 10px !important;
        z-index: ${CONFIG.MAX_Z_INDEX} !important;
        display: flex !important;
        align-items: center !important;
        gap: 4px !important;
        background: rgba(0, 0, 0, 0.7) !important;
        border-radius: 6px !important;
        padding: 2px 4px !important;
        `;

        // Main Button
        const btn = document.createElement('button');
        btn.id = 'iso-focus-btn';
        btn.innerText = 'VideoFocus';
        btn.style.cssText = `
        all: unset !important;
        color: #fff !important;
        font-size: 11px !important;
        font-weight: 500 !important;
        cursor: pointer !important;
        padding: 4px 8px !important;
        min-width: 36px !important;
        text-align: center !important;
        background: rgba(0, 0, 0, 0.85) !important;
        border-radius: 4px !important;
        transition: background 0.2s !important;
        white-space: nowrap !important;
        display: none !important;
        `;
        btn.addEventListener('mouseover', () => btn.style.background = 'rgba(255,255,255,0.2)');
        btn.addEventListener('mouseout', () => btn.style.background = 'rgba(0, 0, 0, 0.85)');

        btn.addEventListener('click', () => {
            const video = findVideoNuclear();
            if (video) {
                const isIframe = window.self !== window.top;
                if (isIframe) {
                    const a = document.createElement('a');
                    a.href = window.location.href;
                    a.rel = 'referrer';
                    a.target = '_blank';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                } else {
                    launchFocus(video);
                }
            } else {
                const isIframe = window.self !== window.top;
                if (isIframe) {
                    alert('No video found in this frame.\nUse the button on the main page or click "VideoFocus" there.');
                } else {
                    alert('No video found on this page.\nIf the video is inside an iframe, try clicking the play button first or check the iframe directly.');
                }
            }
        });

        // Toggle Button
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'iso-toggle-btn';
        toggleBtn.innerText = '▶';
        toggleBtn.style.cssText = `
        all: unset !important;
        color: #ccc !important;
        font-size: 10px !important;
        cursor: pointer !important;
        padding: 4px 6px !important;
        background: transparent !important;
        border-radius: 4px !important;
        transition: all 0.2s !important;
        `;
        toggleBtn.addEventListener('mouseover', () => toggleBtn.style.background = 'rgba(255,255,255,0.1)');
        toggleBtn.addEventListener('mouseout', () => toggleBtn.style.background = 'transparent');

        let isCollapsed = true;
        toggleBtn.addEventListener('click', () => {
            isCollapsed = !isCollapsed;
            if (isCollapsed) {
                btn.style.display = 'none';
                toggleBtn.innerText = '▶';
                host.style.padding = '2px 4px';
            } else {
                btn.style.display = 'block';
                toggleBtn.innerText = '◀';
                host.style.padding = '2px';
            }
        });

        host.appendChild(btn);
        host.appendChild(toggleBtn);
        (document.body || document.documentElement).appendChild(host);
    };

    // Place the button when the page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectSearchButton);
    } else {
        injectSearchButton();
    }
})();
