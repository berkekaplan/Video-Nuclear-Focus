// ==UserScript==
// @name         Minimalist Focus (v7.3.4 - Time Limited Optimized)
// @version      7.3.4
// @description  Performance optimized: Search stops after 5 seconds.
// @author       Admin
// @match        *://*/*
// @exclude      *://*.youtube.com/*
// @exclude      *://*.google.com/*
// @exclude      *://*.reddit.com/*
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

            host.style.cssText = `position:fixed!important; top:50px!important; right:10px!important; z-index:2147483647!important; display:flex; align-items:center; background:rgba(0,0,0,0.8); border:2px solid #fff; border-radius:5px;`;

            const shadow = host.attachShadow({mode: 'open'});
            const isIframe = (window.self !== window.top);

            const toggle = document.createElement('div');
            toggle.innerText = '>';

            toggle.style.cssText = `padding:8px 10px; color:#fff; cursor:pointer; font-family:monospace; font-size:14px; border-right:1px solid #555; user-select:none;`;

            const btn = document.createElement('button');
            btn.innerText = isIframe ? 'EXTRACT' : 'FOCUS';

            btn.style.cssText = `all:unset!important; padding:8px 16px!important; color:#fff!important; cursor:pointer!important; font-family:monospace!important; font-size:14px!important; font-weight:bold!important; white-space:nowrap;`;

            let isOpen = true;
            toggle.onclick = () => {
                isOpen = !isOpen;
                btn.style.display = isOpen ? 'block' : 'none';
                toggle.innerText = isOpen ? '>' : '<';
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
            #s-ind { position:fixed; top:20px; right:20px; color:#444; font-family:monospace; cursor:pointer; z-index:2147483647; font-size:14px; }
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
