// ==UserScript==
// @name         Minimalist Focus (v1.7.4 - Mobile)
// @version      1.7.4
// @description  Performance optimized: Search stops after 5 seconds.
// @author       Admin
// @match         *://*/*
// @exclude       *://*.youtube.com/*
// @exclude       *://*.google.com/*
// @exclude       *://*.reddit.com/*
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
    let searchTimeoutTimer = null;

    const cleanupButtons = () => {
        const host = document.getElementById('iso-portal-host');
        if (host) host.remove();
    };

        function findVideoNuclear() {
            const candidates = Array.from(document.querySelectorAll('video, canvas'));

            for (let el of candidates) {
                const rect = el.getBoundingClientRect();

                const isVisible = rect.width > 0 && rect.height > 0;
                const isLargeEnough = (el.tagName === 'VIDEO' ? rect.height > 100 : rect.width > 400);
                const style = window.getComputedStyle(el);
                const isNotHidden = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';

                if (isVisible && isLargeEnough && isNotHidden) return el;
            }
            return null;
        }
        function injectButton(video) {
            if (document.getElementById('iso-portal-host')) return;

            const host = document.createElement('div');
            host.id = 'iso-portal-host';
            const isIframe = (window.self !== window.top);

            host.style.cssText = `position:fixed!important; top:80px!important; right:10px!important; z-index:2147483647!important; display:flex; align-items:center; background:rgba(0,0,0,0.85); border:1px solid #fff; border-radius:4px; touch-action: manipulation;`;

            const shadow = host.attachShadow({mode: 'open'});

            const toggle = document.createElement('div');
            toggle.innerText = '>';

            toggle.style.cssText = `padding:12px 15px; color:#fff; cursor:pointer; font-family:monospace; font-size:12px; border-right:1px solid #555; user-select:none; -webkit-tap-highlight-color:transparent;`;

            const btn = document.createElement('button');
            btn.innerText = isIframe ? 'EXTRACT' : 'FOCUS';

            btn.style.cssText = `all:unset!important; padding:12px 20px!important; color:#fff!important; cursor:pointer!important; font-family:monospace!important; font-size:12px!important; font-weight:bold!important; white-space:nowrap; -webkit-tap-highlight-color:transparent;`;

            let isOpen = true;
            toggle.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                isOpen = !isOpen;
                btn.style.display = isOpen ? 'block' : 'none';
                toggle.innerText = isOpen ? '>' : '<';
            };

            btn.onclick = (e) => {
                e.preventDefault();
                e.stopImmediatePropagation();
                if (isIframe) {
                    const url = window.location.href;
                    const newWindow = window.open(url, '_blank');
                    if (!newWindow) {
                        const a = document.createElement('a');
                        a.href = url;
                        a.target = '_blank';
                        a.click();
                    }
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

            clearTimeout(searchTimeoutTimer);

            cleanupButtons();
            const originalSpeed = video.playbackRate;

            window.onscroll = null;
            window.onresize = null;
            document.onmousemove = null;

            document.body.replaceChildren();
            document.body.style.cssText = 'background:#000!important; margin:0!important; overflow:hidden!important; width:100vw; height:100vh;';

            const style = document.createElement('style');
            style.innerHTML = `
            html { background: #000 !important; }
            #p-wrap { position:fixed; inset:0; display:flex; justify-content:center; align-items:center; background:#000; }
            video, canvas { max-width:100%!important; max-height:100%!important; width:auto!important; height:auto!important; object-fit:contain!important; outline:none!important; }
            #s-ind {
            position:fixed; top:30px; right:30px; color:#fff; font-family:monospace;
            cursor:pointer; z-index:2147483647; font-size:24px; font-weight:bold;
            background:rgba(255,255,255,0.2); padding:15px; border-radius:10px;
            }
            `;
            document.head.appendChild(style);

            const wrap = document.createElement('div');
            wrap.id = 'p-wrap';
            const speedInd = document.createElement('div');
            speedInd.id = 's-ind';
            speedInd.innerText = originalSpeed + 'X';

            document.body.appendChild(wrap);
            document.body.appendChild(speedInd);
            wrap.appendChild(video);

            speedInd.onclick = () => {
                currentSpeedIdx = (currentSpeedIdx + 1) % SPEEDS.length;
                video.playbackRate = SPEEDS[currentSpeedIdx];
                speedInd.innerText = SPEEDS[currentSpeedIdx] + 'X';
            };

            window.onkeydown = (e) => { if (e.key === 'Escape') location.reload(); };
            video.controls = true;
            video.play().catch(() => {});
        }

        const handleMutation = () => {

            if (document.getElementById('iso-portal-host') || document.getElementById('p-wrap')) return;

            const target = findVideoNuclear();
            if (target) injectButton(target);

            if (!target) {
                clearTimeout(window.retryTimer);
                window.retryTimer = setTimeout(handleMutation, 2000);
            }
        };

        observer = new MutationObserver(() => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(handleMutation, 800);
        });

        observer.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true
        });

        handleMutation();

        searchTimeoutTimer = setTimeout(() => {
            if (observer) {
                observer.disconnect();
                clearTimeout(window.retryTimer);
            }
        }, 5000);
})();
