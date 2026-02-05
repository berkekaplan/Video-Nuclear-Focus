// ==UserScript==
// @name         Minimalist Focus (v7.3.7 - Balanced Focus)
// @version      7.3.7
// @description  Performance optimized
// @author       Admin
// @match        *://*/*
// @exclude      *://*.youtube.com/*
// @grant        GM_openInTab
// @run-at       document-start
// @allFrames    true
// ==/UserScript==

(function() {
    'use strict';
    const SPEEDS = [1, 1.25, 1.5, 2, 0.5];
    let currentSpeedIdx = 0;
    let debounceTimer = null;
    let observer = null;

    const cleanupButtons = () => {
        const host = document.getElementById('iso-portal-host');
        if (host) host.remove();
    };

    function findVideoNuclear() {
        const vids = Array.from(document.querySelectorAll('video'));
        document.querySelectorAll('*').forEach(el => {
            if (el.shadowRoot) {
                const sv = el.shadowRoot.querySelector('video');
                if (sv) vids.push(sv);
            }
        });

        for (let el of vids) {
            const rect = el.getBoundingClientRect();
            const src = el.currentSrc || el.src || "";
            const isAdTrack = src.includes("googleads") || src.includes("/ads/") || src.includes("doubleclick");
            if (el.duration > 60) return el;
            const isVisible = (el.offsetWidth > 0 || el.offsetHeight > 0);
            const isNotHidden = window.getComputedStyle(el).display !== 'none';
            if (isVisible && isNotHidden && !isAdTrack) return el;
        }
        return null;
    }

    function injectButton(video) {
        if (document.getElementById('iso-portal-host')) return;
        const host = document.createElement('div');
        host.id = 'iso-portal-host';
        host.style.cssText = `position:fixed!important; top:100px!important; right:10px!important; z-index:2147483647!important; display:flex; align-items:center; background:rgba(0,0,0,0.85); border:1px solid #fff; border-radius:8px; overflow:hidden;`;

        const shadow = host.attachShadow({mode: 'open'});
        const isIframe = (window.self !== window.top);

        const toggle = document.createElement('div');
        toggle.innerText = '>';
        toggle.style.cssText = `padding:15px 20px; color:#fff; cursor:pointer; font-family:monospace; font-size:18px; border-right:1px solid #555; user-select:none;`;

        const btn = document.createElement('button');
        btn.innerText = isIframe ? 'EXT' : 'FOC';

        if (isIframe) {
            btn.style.cssText = `all:unset!important; padding:12px 20px!important; color:#fff!important; cursor:pointer!important; font-family:monospace!important; font-size:16px!important; white-space:nowrap;`;
        } else {

            btn.style.cssText = `all:unset!important; padding:18px 34px!important; color:#fff!important; cursor:pointer!important; font-family:monospace!important; font-size:24px!important; font-weight:bold!important; white-space:nowrap;`;
        }

        let isOpen = true;
        toggle.onclick = () => {
            isOpen = !isOpen;
            btn.style.display = isOpen ? 'block' : 'none';
            toggle.innerText = isOpen ? '>' : '<';
        };

        btn.onclick = (e) => {
            e.preventDefault();
            if (isIframe) {
                window.open(window.location.href, '_blank');
            } else {
                launchFocus(video);
            }
        };

        shadow.appendChild(toggle);
        shadow.appendChild(btn);
        (document.body || document.documentElement).appendChild(host);
    }

    function launchFocus(video) {
        if (document.getElementById('p-wrap')) return;
        if (observer) observer.disconnect();
        cleanupButtons();
        const originalSpeed = video.playbackRate;

        document.body.replaceChildren();

        const style = document.createElement('style');
        style.innerHTML = `
            html, body { background: #000 !important; overflow: hidden !important; width: 100vw !important; height: 100vh !important; margin: 0 !important; padding: 0 !important; }
            #p-wrap { position: fixed !important; inset: 0 !important; display: flex !important; justify-content: center !important; align-items: center !important; background: #000 !important; z-index: 2147483646 !important; }
            video { all: initial !important; max-width: 100% !important; max-height: 100% !important; object-fit: contain !important; display: block !important; margin: auto !important; }
            #s-ind { position: fixed; top: 30px; right: 30px; color: #fff; font-family: monospace; z-index: 2147483647; font-size: 24px; padding: 20px; background: rgba(255,255,255,0.15); border-radius: 50%; user-select: none; }
        `;
        document.head.appendChild(style);

        const wrap = document.createElement('div');
        wrap.id = 'p-wrap';
        const speedInd = document.createElement('div');
        speedInd.id = 's-ind';
        speedInd.innerText = originalSpeed + 'X';

        document.body.appendChild(wrap);
        document.body.appendChild(speedInd);

        video.style.cssText = "max-width: 100%; max-height: 100%; position: relative !important;";
        video.controls = true;
        wrap.appendChild(video);

        video.play().catch(() => {});

        speedInd.onclick = () => {
            currentSpeedIdx = (currentSpeedIdx + 1) % SPEEDS.length;
            video.playbackRate = SPEEDS[currentSpeedIdx];
            speedInd.innerText = SPEEDS[currentSpeedIdx] + 'X';
        };
        window.onpopstate = () => location.reload();
        history.pushState(null, null, window.location.href);
    }

    const handleMutation = () => {
        if (document.getElementById('iso-portal-host') || document.getElementById('p-wrap')) return;
        const target = findVideoNuclear();
        if (target) injectButton(target);

        const handleMutation = () => {
            if (document.getElementById('iso-portal-host') || document.getElementById('p-wrap')) return;
            const target = findVideoNuclear();
            if (target) {
                injectButton(target);
            } else {
                clearTimeout(window.retryTimer);
                window.retryTimer = setTimeout(handleMutation, 2000);
            }
        };
    };

    observer = new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(handleMutation, 600);
    });

    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
    handleMutation();
})();

