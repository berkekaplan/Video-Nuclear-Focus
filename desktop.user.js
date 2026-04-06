// ==UserScript==
// @name         Minimalist Focus (v7.4 - Enhanced)
// @version      7.4
// @description  Performance optimized with PiP, keyboard shortcuts, volume control and progress bar
// @author       Admin
// @match        *://*/*
// @exclude      *://*.youtube.com/*
// @grant        GM_openInTab
// @run-at       document-start
// @allFrames    true
// ==/UserScript==

(function() {
    'use strict';
    
    const SPEEDS = [1, 1.25, 1.5, 2, 0.5, 0.75];
    const SEEK_STEP = 10;
    let currentSpeedIdx = 0;
    let debounceTimer = null;
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };

    let observer = null;
    let retryTimerId = null;

    // Cleanup function
    const cleanup = () => {
        const host = document.getElementById('iso-portal-host');
        if (host) host.remove();
        if (observer) observer.disconnect();
        if (retryTimerId) clearTimeout(retryTimerId);
        retryTimerId = null;
    };

    // Video finder
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

    // Inject floating button
    function injectButton(video) {
        if (document.getElementById('iso-portal-host')) return;

        const host = document.createElement('div');
        host.id = 'iso-portal-host';
        host.style.cssText = `
            position: fixed !important;
            top: 50px !important;
            right: 10px !important;
            z-index: 2147483647 !important;
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

        // Drag functionality
        host.addEventListener('mousedown', (e) => {
            if (e.target === host || e.target.id === 'iso-portal-toggle') {
                isDragging = true;
                const rect = host.getBoundingClientRect();
                dragOffset.x = e.clientX - rect.left;
                dragOffset.y = e.clientY - rect.top;
                host.style.opacity = '0.9';
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                host.style.right = 'auto';
                host.style.left = (e.clientX - dragOffset.x) + 'px';
                host.style.top = (e.clientY - dragOffset.y) + 'px';
            }
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            host.style.opacity = '1';
        });

        const shadow = host.attachShadow({ mode: 'open' });
        const isIframe = (window.self !== window.top);

        const toggle = document.createElement('div');
        toggle.id = 'iso-portal-toggle';
        toggle.innerHTML = '&#9654;'; // Play icon
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
        btn.innerText = isIframe ? 'EXTRACT' : 'FOCUS';
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
        toggle.onclick = () => {
            isOpen = !isOpen;
            btn.style.display = isOpen ? 'block' : 'none';
            toggle.innerHTML = isOpen ? '&#9654;' : '&#9664;';
        };

        // Hover effects
        toggle.onmouseover = () => toggle.style.background = 'rgba(255,255,255,0.2)';
        toggle.onmouseout = () => toggle.style.background = 'transparent';
        btn.onmouseover = () => btn.style.background = 'rgba(255,255,255,0.2)';
        btn.onmouseout = () => btn.style.background = 'transparent';

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

    // Main focus mode
    function launchFocus(video) {
        if (document.getElementById('p-wrap')) return;

        cleanup();
        const originalSpeed = video.playbackRate;
        const originalVolume = video.volume;
        const originalMuted = video.muted;

        // Clear all event handlers
        window.onscroll = null;
        window.onresize = null;
        document.onmousemove = null;

        // Replace body content
        document.body.replaceChildren();
        document.body.style.cssText = 'background: #000 !important; margin: 0 !important; overflow: hidden !important; width: 100vw; height: 100vh;';

        // Styles
        const style = document.createElement('style');
        style.innerHTML = `
            html { background: #000 !important; }
            body { background: #000 !important; }
            #p-wrap { position: fixed; inset: 0; display: flex; justify-content: center; align-items: center; background: #000; }
            #p-controls { position: fixed; bottom: 0; left: 0; right: 0; background: linear-gradient(transparent, rgba(0,0,0,0.8)); padding: 20px; z-index: 2147483647; }
            video, canvas { max-width: 100% !important; max-height: calc(100vh - 100px) !important; width: auto !important; height: auto !important; object-fit: contain !important; outline: none !important; }
            #s-ind { position: fixed; top: 20px; right: 20px; color: #888; font-family: monospace; cursor: pointer; z-index: 2147483647; font-size: 14px; transition: color 0.2s; }
            #s-ind:hover { color: #fff; }
            .ctrl-btn { all: unset; color: #fff; font-family: monospace; font-size: 12px; cursor: pointer; padding: 8px 12px; transition: background 0.2s; border-radius: 4px; }
            .ctrl-btn:hover { background: rgba(255,255,255,0.2); }
            #v-slider { width: 80px; height: 4px; cursor: pointer; accent-color: #fff; margin: 0 8px; }
            #p-bar { position: fixed; bottom: 80px; left: 20px; right: 20px; height: 4px; background: rgba(255,255,255,0.2); cursor: pointer; border-radius: 2px; z-index: 2147483647; transition: height 0.2s; }
            #p-bar:hover { height: 6px; }
            #p-fill { height: 100%; background: #fff; border-radius: 2px; width: 0; transition: width 0.1s linear; }
            #p-time { color: #888; font-family: monospace; font-size: 12px; margin-left: 10px; }
            .kbd { font-size: 10px; color: #666; margin-left: 4px; }
            #pip-btn { position: fixed; top: 20px; left: 20px; z-index: 2147483647; }
        `;
        document.head.appendChild(style);

        // Wrap container
        const wrap = document.createElement('div');
        wrap.id = 'p-wrap';

        // Controls container
        const controls = document.createElement('div');
        controls.id = 'p-controls';

        // Progress bar
        const progressBar = document.createElement('div');
        progressBar.id = 'p-bar';
        const progressFill = document.createElement('div');
        progressFill.id = 'p-fill';
        progressBar.appendChild(progressFill);

        // Progress time
        const timeDisplay = document.createElement('span');
        timeDisplay.id = 'p-time';
        timeDisplay.innerText = '0:00 / 0:00';

        // Speed indicator
        const speedInd = document.createElement('div');
        speedInd.id = 's-ind';
        speedInd.innerHTML = `${originalSpeed}X <span class="kbd">[S]</span>`;

        // PiP button
        const pipBtn = document.createElement('button');
        pipBtn.id = 'pip-btn';
        pipBtn.className = 'ctrl-btn';
        pipBtn.innerHTML = 'PiP <span class="kbd">[P]</span>';
        pipBtn.onclick = () => {
            if (document.pictureInPictureElement) {
                document.exitPictureInPicture().catch(() => {});
            } else if (video.requestPictureInPicture) {
                video.requestPictureInPicture().catch(() => {});
            }
        };

        // Control buttons
        const btnContainer = document.createElement('div');
        btnContainer.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 10px;';

        const playPauseBtn = document.createElement('button');
        playPauseBtn.className = 'ctrl-btn';
        playPauseBtn.innerHTML = '&#10074;&#10074; <span class="kbd">[Space]</span>';
        playPauseBtn.onclick = () => {
            if (video.paused) {
                video.play();
                playPauseBtn.innerHTML = '&#10074;&#10074; <span class="kbd">[Space]</span>';
            } else {
                video.pause();
                playPauseBtn.innerHTML = '&#9654; <span class="kbd">[Space]</span>';
            }
        };

        const seekBackBtn = document.createElement('button');
        seekBackBtn.className = 'ctrl-btn';
        seekBackBtn.innerHTML = `-${SEEK_STEP}s <span class="kbd">[←]</span>`;
        seekBackBtn.onclick = () => { video.currentTime = Math.max(0, video.currentTime - SEEK_STEP); };

        const seekFwdBtn = document.createElement('button');
        seekFwdBtn.className = 'ctrl-btn';
        seekFwdBtn.innerHTML = `+${SEEK_STEP}s <span class="kbd">[→]</span>`;
        seekFwdBtn.onclick = () => { video.currentTime = Math.min(video.duration, video.currentTime + SEEK_STEP); };

        const volumeSlider = document.createElement('input');
        volumeSlider.id = 'v-slider';
        volumeSlider.type = 'range';
        volumeSlider.min = '0';
        volumeSlider.max = '1';
        volumeSlider.step = '0.05';
        volumeSlider.value = originalVolume;
        volumeSlider.oninput = (e) => {
            video.volume = parseFloat(e.target.value);
            video.muted = false;
        };

        const muteBtn = document.createElement('button');
        muteBtn.className = 'ctrl-btn';
        muteBtn.innerHTML = '&#9834; <span class="kbd">[M]</span>';
        muteBtn.onclick = () => {
            video.muted = !video.muted;
            muteBtn.innerHTML = video.muted ? '&#9835; <span class="kbd">[M]</span>' : '&#9834; <span class="kbd">[M]</span>';
        };

        const fullscreenBtn = document.createElement('button');
        fullscreenBtn.className = 'ctrl-btn';
        fullscreenBtn.innerHTML = '&#9974; <span class="kbd">[F]</span>';
        fullscreenBtn.onclick = () => {
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
            } else {
                document.documentElement.requestFullscreen().catch(() => {});
            }
        };

        btnContainer.appendChild(speedInd);
        btnContainer.appendChild(playPauseBtn);
        btnContainer.appendChild(seekBackBtn);
        btnContainer.appendChild(seekFwdBtn);
        btnContainer.appendChild(muteBtn);
        btnContainer.appendChild(volumeSlider);
        btnContainer.appendChild(fullscreenBtn);

        controls.appendChild(progressBar);
        controls.appendChild(timeDisplay);
        controls.appendChild(btnContainer);
        controls.appendChild(pipBtn);

        // Append elements
        document.body.appendChild(wrap);
        document.body.appendChild(controls);
        document.body.appendChild(speedInd);
        wrap.appendChild(video);

        // Event handlers
        speedInd.onclick = () => {
            currentSpeedIdx = (currentSpeedIdx + 1) % SPEEDS.length;
            video.playbackRate = SPEEDS[currentSpeedIdx];
            speedInd.innerHTML = `${SPEEDS[currentSpeedIdx]}X <span class="kbd">[S]</span>`;
        };

        // Progress bar interaction
        progressBar.onclick = (e) => {
            const rect = progressBar.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            video.currentTime = percent * video.duration;
        };

        // Update progress
        video.ontimeupdate = () => {
            if (video.duration) {
                const percent = (video.currentTime / video.duration) * 100;
                progressFill.style.width = percent + '%';
                const currMin = Math.floor(video.currentTime / 60);
                const currSec = Math.floor(video.currentTime % 60);
                const durMin = Math.floor(video.duration / 60);
                const durSec = Math.floor(video.duration % 60);
                timeDisplay.innerText = `${currMin}:${currSec.toString().padStart(2, '0')} / ${durMin}:${durSec.toString().padStart(2, '0')}`;
            }
        };

        // Keyboard shortcuts
        window.onkeydown = (e) => {
            if (e.target.tagName === 'INPUT') return;
            switch(e.key) {
                case 'Escape': location.reload(); break;
                case ' ': e.preventDefault(); playPauseBtn.click(); break;
                case 'f': case 'F': fullscreenBtn.click(); break;
                case 'm': case 'M': muteBtn.click(); break;
                case 'p': case 'P': pipBtn.click(); break;
                case 's': case 'S': speedInd.click(); break;
                case 'ArrowLeft': seekBackBtn.click(); break;
                case 'ArrowRight': seekFwdBtn.click(); break;
            }
        };

        video.controls = true;
        video.play().catch(() => {});
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

    observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true
    });

    handleMutation();

    // Cleanup on unload
    window.addEventListener('beforeunload', cleanup);
})();

