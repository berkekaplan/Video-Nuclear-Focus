// ==UserScript==
// @name         Mobil Focus (v5.5 - Minimal)
// @version      5.5
// @description  Minimalist video player for mobile with volume, progress bar and swipe gestures
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
    const SEEK_STEP = 5;
    let currentSpeedIdx = 0;
    let debounceTimer = null;

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

    // Inject floating buttons
    function injectButton(video) {
        if (document.getElementById('iso-portal-host')) return;

        const isIframe = window.self !== window.top;

        const host = document.createElement('div');
        host.id = 'iso-portal-host';
        
        host.style.cssText = `
            position: fixed !important;
            top: 80px !important;
            right: 10px !important;
            z-index: 2147483647 !important;
            display: flex !important;
            gap: 4px !important;
            align-items: center !important;
        `;

        // Focus button (minimal)
        const focusBtn = document.createElement('button');
        focusBtn.className = 'iso-btn iso-focus';
        focusBtn.innerText = '▶';
        focusBtn.title = 'FOCUS';
        focusBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            launchFocus(video);
        };

        // Extract button (only in iframe, minimal)
        let extractBtn = null;
        if (isIframe) {
            extractBtn = document.createElement('button');
            extractBtn.className = 'iso-btn iso-extract';
            extractBtn.innerText = '⬆';
            extractBtn.title = 'EXTRACT';
            extractBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const a = document.createElement('a');
                a.href = window.location.href;
                a.rel = 'referrer';
                a.target = '_blank';
                document.body.appendChild(a);
                a.click();
                a.remove();
            };
        }

        // Apply minimal styles
        const style = document.createElement('style');
        style.id = 'iso-host-style';
        style.textContent = `
            .iso-btn {
                all: unset !important;
                color: #fff !important;
                font-size: 12px !important;
                font-weight: 600 !important;
                cursor: pointer !important;
                padding: 4px 8px !important;
                min-width: 28px !important;
                min-height: 28px !important;
                text-align: center !important;
                background: rgba(0, 0, 0, 0.85) !important;
                border-radius: 4px !important;
            }
        `;
        document.head.appendChild(style);

        // Add buttons in order
        if (extractBtn) host.appendChild(extractBtn);
        host.appendChild(focusBtn);
        
        (document.body || document.documentElement).appendChild(host);
    }

    // Main focus mode - keeps native controls working
    function launchFocus(video) {
        if (document.getElementById('p-wrap')) return;

        cleanup();
        const originalSpeed = video.playbackRate;
        const originalVolume = video.volume;

        // Store original video parent and position
        const originalParent = video.parentElement;
        const originalNextSibling = video.nextSibling;

        // Create focus overlay without replacing body
        const wrap = document.createElement('div');
        wrap.id = 'p-wrap';
        wrap.style.cssText = 'position: fixed !important; inset: 0 !important; display: flex !important; justify-content: center !important; align-items: center !important; background: #000 !important; z-index: 2147483640 !important;';

        // Styles - Mobile minimalist
        const style = document.createElement('style');
        style.innerHTML = `
            * { box-sizing: border-box; }
            #p-wrap { pointer-events: auto !important; }
            video { pointer-events: auto !important; }
            #p-controls { position: fixed; bottom: 0; left: 0; right: 0; padding: 15px; display: flex; flex-direction: column; gap: 10px; z-index: 2147483647; pointer-events: auto !important; }
            .ctrl-btn { all: unset; color: #fff; font-size: 11px; cursor: pointer; padding: 6px 8px; white-space: nowrap; pointer-events: auto !important; }
            #v-slider { width: 60px; height: 3px; accent-color: #fff; pointer-events: auto !important; }
            #p-bar { width: 100%; min-height: 32px; display: flex; align-items: center; padding: 14px 0; pointer-events: auto !important; }
            #p-bar-inner { width: 100%; height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; cursor: pointer; position: relative; pointer-events: auto !important; }
            #p-fill { height: 100%; background: #fff; border-radius: 2px; width: 0; pointer-events: auto !important; }
            #p-time { color: #fff; font-size: 11px; white-space: nowrap; pointer-events: auto !important; }
            #s-ind { position: fixed; top: 15px; right: 15px; color: #fff; font-size: 12px; cursor: pointer; z-index: 2147483647; padding: 6px; }
            #fs-btn { position: fixed; top: 15px; left: 15px; z-index: 2147483647; }
        `;
        document.head.appendChild(style);

        // Controls container
        const controls = document.createElement('div');
        controls.id = 'p-controls';

        // Progress bar
        const progressBar = document.createElement('div');
        progressBar.id = 'p-bar';
        const progressBarInner = document.createElement('div');
        progressBarInner.id = 'p-bar-inner';
        const progressFill = document.createElement('div');
        progressFill.id = 'p-fill';
        progressBarInner.appendChild(progressFill);
        progressBar.appendChild(progressBarInner);

        // Time display
        const timeDisplay = document.createElement('span');
        timeDisplay.id = 'p-time';
        timeDisplay.innerText = '0:00 / 0:00';

        // Speed indicator
        const speedInd = document.createElement('div');
        speedInd.id = 's-ind';
        speedInd.innerText = originalSpeed + 'x';

        // Fullscreen button
        const fsBtn = document.createElement('button');
        fsBtn.id = 'fs-btn';
        fsBtn.className = 'ctrl-btn';
        fsBtn.innerText = '⛶';
        fsBtn.onclick = () => {
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
            } else {
                document.documentElement.requestFullscreen().catch(() => {});
            }
        };

        // Play/Pause button
        const playPauseBtn = document.createElement('button');
        playPauseBtn.className = 'ctrl-btn';
        playPauseBtn.innerText = '❚❚';
        playPauseBtn.onclick = () => {
            if (video.paused) {
                video.play();
                playPauseBtn.innerText = '❚❚';
            } else {
                video.pause();
                playPauseBtn.innerText = '▶';
            }
        };

        // Seek buttons
        const seekBackBtn = document.createElement('button');
        seekBackBtn.className = 'ctrl-btn';
        seekBackBtn.innerText = '-' + SEEK_STEP;
        seekBackBtn.onclick = () => { video.currentTime = Math.max(0, video.currentTime - SEEK_STEP); };

        const seekFwdBtn = document.createElement('button');
        seekFwdBtn.className = 'ctrl-btn';
        seekFwdBtn.innerText = '+' + SEEK_STEP;
        seekFwdBtn.onclick = () => { video.currentTime = Math.min(video.duration, video.currentTime + SEEK_STEP); };

        // Mute button with text
        const muteBtn = document.createElement('button');
        muteBtn.className = 'ctrl-btn';
        muteBtn.innerText = 'MUTE';
        muteBtn.onclick = () => {
            video.muted = !video.muted;
            muteBtn.innerText = video.muted ? 'UNMUTE' : 'MUTE';
        };

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
            muteBtn.innerText = 'MUTE';
        };

        // Exit button
        const exitBtn = document.createElement('button');
        exitBtn.className = 'ctrl-btn';
        exitBtn.innerText = '✕';
        exitBtn.style.cssText = 'all: unset; color: #fff; font-size: 14px; cursor: pointer; padding: 6px 10px; pointer-events: auto !important;';
        exitBtn.onclick = () => {
            // Restore video to original position
            if (originalParent) {
                if (originalNextSibling) {
                    originalParent.insertBefore(video, originalNextSibling);
                } else {
                    originalParent.appendChild(video);
                }
            }
            // Remove overlay
            wrap.remove();
            controls.remove();
            style.remove();
            video.style.cssText = '';
        };

        // Controls row
        const controlsRow = document.createElement('div');
        controlsRow.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 6px;';
        controlsRow.appendChild(exitBtn);
        controlsRow.appendChild(fsBtn);
        controlsRow.appendChild(speedInd);
        controlsRow.appendChild(seekBackBtn);
        controlsRow.appendChild(playPauseBtn);
        controlsRow.appendChild(seekFwdBtn);
        controlsRow.appendChild(muteBtn);
        controlsRow.appendChild(volumeSlider);

        // Bottom row with time
        const bottomRow = document.createElement('div');
        bottomRow.style.cssText = 'display: flex; align-items: center; gap: 10px;';
        bottomRow.appendChild(progressBar);
        bottomRow.appendChild(timeDisplay);

        controls.appendChild(bottomRow);
        controls.appendChild(controlsRow);

        // Add overlay and move video
        document.body.appendChild(wrap);
        document.body.appendChild(controls);
        wrap.appendChild(video);

        // Apply video styles
        video.style.cssText = 'max-width: 100% !important; max-height: calc(100vh - 180px) !important; width: 100% !important; height: auto !important; object-fit: contain !important;';

        // Enable native controls
        video.controls = true;

        // Speed change
        speedInd.onclick = () => {
            currentSpeedIdx = (currentSpeedIdx + 1) % SPEEDS.length;
            video.playbackRate = SPEEDS[currentSpeedIdx];
            speedInd.innerText = SPEEDS[currentSpeedIdx] + 'x';
        };

        // Progress bar seek
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
                timeDisplay.innerText = currMin + ':' + currSec.toString().padStart(2, '0') + ' / ' + durMin + ':' + durSec.toString().padStart(2, '0');
            }
        };

        // Touch gestures for seek
        let touchStartX = 0;
        let touchStartTime = 0;
        let isSwiping = false;

        wrap.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartTime = video.currentTime;
            isSwiping = false;
        }, { passive: true });

        wrap.addEventListener('touchmove', (e) => {
            const deltaX = e.touches[0].clientX - touchStartX;
            if (Math.abs(deltaX) > 50 && !isSwiping) {
                isSwiping = true;
            }
            if (isSwiping) {
                e.preventDefault();
                const seekDelta = (deltaX / wrap.getBoundingClientRect().width) * video.duration * 0.5;
                video.currentTime = Math.max(0, Math.min(video.duration, touchStartTime + seekDelta));
                const percent = (video.currentTime / video.duration) * 100;
                progressFill.style.width = percent + '%';
            }
        }, { passive: false });

        wrap.addEventListener('touchend', () => {
            isSwiping = false;
        }, { passive: true });

        // Keyboard shortcuts (Escape only for mobile)
        window.onkeydown = (e) => {
            if (e.key === 'Escape') location.reload();
        };

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
    window.addEventListener('beforeunload', cleanup);
})();
