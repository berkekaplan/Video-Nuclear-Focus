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
        btn.innerText = isIframe ? 'EXTRACT' : 'FOCUS';
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

    // Main focus mode - add speed overlay without replacing page
    function launchFocus(video) {
        if (document.getElementById('iso-speed-overlay')) return;

        const originalSpeed = video.playbackRate;

        // Just add a floating speed button, don't replace page content
        const speedBtn = document.createElement('div');
        speedBtn.id = 'iso-speed-overlay';
        speedBtn.style.cssText = `
            position: fixed !important;
            top: 10px !important;
            right: 10px !important;
            color: #fff !important;
            font-family: monospace !important;
            cursor: pointer !important;
            z-index: 2147483647 !important;
            font-size: 13px !important;
            background: rgba(0,0,0,0.7) !important;
            padding: 6px 10px !important;
            border-radius: 4px !important;
            border: 1px solid rgba(255,255,255,0.3) !important;
            box-shadow: 0 2px 6px rgba(0,0,0,0.5) !important;
        `;
        speedBtn.innerHTML = `${originalSpeed}X`;
        
        speedBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            currentSpeedIdx = (currentSpeedIdx + 1) % SPEEDS.length;
            video.playbackRate = SPEEDS[currentSpeedIdx];
            speedBtn.innerHTML = `${SPEEDS[currentSpeedIdx]}X`;
        };

        (document.body || document.documentElement).appendChild(speedBtn);

        // Escape to remove overlay
        window.onkeydown = (e) => {
            if (e.key === 'Escape') {
                speedBtn.remove();
            }
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
