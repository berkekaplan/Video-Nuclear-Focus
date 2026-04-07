// ==UserScript==
// @name         Mobile Focus (v3.0)
// @version      3.0
// @description  Mobile video focus mode with custom controls
// @author       Admin
// @match        *://*/*
// @grant        GM_openInTab
// @run-at       document-start
// @allFrames    true
// ==/UserScript==

(function() {
    'use strict';

    const SPEEDS = [1, 1.25, 1.5, 2, 0.5, 0.75];
    const SEEK_STEP = 10;
    let currentSpeedIdx = 0;

    let observer = null;
    let retryTimerId = null;
    let debounceTimer = null;

    // Cleanup function
    const cleanup = () => {
        const host = document.getElementById('iso-portal-host');
        if (host) host.remove();
        if (observer) observer.disconnect();
        if (retryTimerId) clearTimeout(retryTimerId);
        if (debounceTimer) clearTimeout(debounceTimer);
        retryTimerId = null;
        debounceTimer = null;
    };

    // Video finder - optimized for mobile
    function findVideoNuclear() {
        const candidates = Array.from(document.querySelectorAll('video, canvas'));
        for (const el of candidates) {
            const rect = el.getBoundingClientRect();
            const isVisible = rect.width > 0 && rect.height > 0;
            const isLargeEnough = (el.tagName === 'VIDEO' ? rect.height > 100 : rect.width > 400);
            const style = window.getComputedStyle(el);
            const isNotHidden = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
            if (isVisible && isLargeEnough && isNotHidden) return el;
        }
        return null;
    }

    // Inject floating button - mobile optimized
    function injectButton(video) {
        if (document.getElementById('iso-portal-host')) return;

        const host = document.createElement('div');
        host.id = 'iso-portal-host';
        host.style.cssText = `
            position: fixed !important;
            top: 50px !important;
            right: 10px !important;
            z-index: 2147483647 !important;
            display: flex !important;
            align-items: center !important;
            background: rgba(0, 0, 0, 0.85) !important;
            border: 1px solid rgba(255, 255, 255, 0.3) !important;
            border-radius: 6px !important;
            padding: 2px !important;
            box-shadow: 0 2px 10px rgba(0,0,0,0.5) !important;
        `;

        const isIframe = (window.self !== window.top);

        // Toggle button - smaller for mobile
        const toggle = document.createElement('div');
        toggle.id = 'iso-portal-toggle';
        toggle.innerHTML = '&#9654;';
        toggle.style.cssText = `
            padding: 4px 6px !important;
            color: #fff !important;
            cursor: pointer !important;
            font-family: monospace !important;
            font-size: 11px !important;
            border-right: 1px solid #555 !important;
            user-select: none !important;
        `;

        // Main button - smaller for mobile (24px minimum for touch)
        const btn = document.createElement('button');
        btn.innerText = isIframe ? 'EXT' : 'FOC';
        btn.style.cssText = `
            all: unset !important;
            padding: 4px 8px !important;
            color: #fff !important;
            cursor: pointer !important;
            font-family: monospace !important;
            font-size: 11px !important;
            white-space: nowrap !important;
            min-width: 24px !important;
            min-height: 24px !important;
        `;

        let isOpen = true;
        toggle.onclick = () => {
            isOpen = !isOpen;
            btn.style.display = isOpen ? 'block' : 'none';
            toggle.innerHTML = isOpen ? '&#9654;' : '&#9664;';
        };

        btn.onclick = (e) => {
            e.preventDefault();
            e.stopImmediatePropagation();
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
        };

        host.appendChild(toggle);
        host.appendChild(btn);
        (document.body || document.documentElement).appendChild(host);
    }

    // Main focus mode - only speed control, keep native player
    function launchFocus(video) {
        if (document.getElementById('p-wrap')) return;

        cleanup();

        const originalSpeed = video.playbackRate;

        // Replace body content
        document.body.replaceChildren();
        document.body.style.cssText = 'background: #000 !important; margin: 0 !important; overflow: hidden !important; width: 100vw; height: 100vh;';

        // Styles - only speed control overlay
        const style = document.createElement('style');
        style.textContent = `
            html { background: #000 !important; }
            body { background: #000 !important; }
            #p-wrap { 
                position: fixed; 
                inset: 0; 
                display: flex; 
                justify-content: center; 
                align-items: center; 
                background: #000; 
            }
            #p-video { 
                width: 100vw !important; 
                height: 100vh !important; 
                object-fit: contain !important; 
                outline: none !important;
            }
            /* Keep native controls visible */
            video::-webkit-media-controls { display: flex !important; }
            video::-webkit-media-controls-overlay-enclosure { display: flex !important; }
            video::-webkit-media-controls-enclosure { display: flex !important; }
            #s-btn { 
                position: fixed; 
                top: 10px; 
                right: 10px; 
                color: #fff; 
                font-family: monospace; 
                cursor: pointer; 
                z-index: 2147483647; 
                font-size: 13px; 
                background: rgba(0,0,0,0.7);
                padding: 6px 10px;
                border-radius: 4px;
                border: 1px solid rgba(255,255,255,0.3);
            }
            #s-btn:active { background: rgba(255,255,255,0.2); }
        `;
        document.head.appendChild(style);

        // Wrap container
        const wrap = document.createElement('div');
        wrap.id = 'p-wrap';

        // Keep video native controls - do NOT remove controls attribute
        video.id = 'p-video';
        video.style.cssText = 'width: 100vw !important; height: 100vh !important; object-fit: contain !important;';

        // Speed control button only
        const speedBtn = document.createElement('div');
        speedBtn.id = 's-btn';
        speedBtn.innerHTML = `${originalSpeed}X`;
        speedBtn.onclick = () => {
            currentSpeedIdx = (currentSpeedIdx + 1) % SPEEDS.length;
            video.playbackRate = SPEEDS[currentSpeedIdx];
            speedBtn.innerHTML = `${SPEEDS[currentSpeedIdx]}X`;
        };

        // Append elements
        document.body.appendChild(wrap);
        document.body.appendChild(speedBtn);
        wrap.appendChild(video);

        // Escape on mobile
        window.onkeydown = (e) => {
            if (e.key === 'Escape') location.reload();
        };
    }

    // Mutation handler
    const handleMutation = () => {
        if (document.getElementById('iso-portal-host') || document.getElementById('p-wrap')) return;
        const target = findVideoNuclear();
        if (target) injectButton(target);
        else {
            if (retryTimerId) clearTimeout(retryTimerId);
            retryTimerId = setTimeout(handleMutation, 2000);
        }
    };

    // Setup observer
    observer = new MutationObserver(() => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(handleMutation, 800);
    });

    // Wait for body to exist
    const initObserver = () => {
        if (document.body) {
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
            handleMutation();
        } else {
            requestAnimationFrame(initObserver);
        }
    };
    initObserver();

    // Cleanup on unload
    window.addEventListener('beforeunload', cleanup);
})();
