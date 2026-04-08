// ==UserScript==
// @name         Mobil Focus (Minimal)
// @version      5.11
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

    // ========== CONFIGURATION ==========
    const CONFIG = {
        SPEEDS: [1, 1.25, 1.5, 2, 0.5, 0.75],
        SEEK_STEP: 5,
        RETRY_DELAY: 2000,
        DEBOUNCE_DELAY: 800,
        SEARCH_TIMEOUT: 45000,
        MAX_Z_INDEX: 2147483647,
        PORTRAIT_SCALE: 0.8
    };

    // ========== STATE ==========
    let state = {
        currentSpeedIdx: 0,
        searchStartTime: null,
        // Pinch-to-zoom state
        currentScale: 1,
        initialDistance: 0,
        initialScale: 1
    };

    let observer = null;
    let retryTimerId = null;
    let touchListeners = null;
    let injectButtonStyleAdded = false;

    // ========== CLEANUP ==========
    const cleanup = () => {
        const host = document.getElementById('iso-portal-host');
        if (host) host.remove();
        
        if (observer) {
            observer.disconnect();
            observer = null;
        }
        
        if (retryTimerId) {
            clearTimeout(retryTimerId);
            retryTimerId = null;
        }
        
        // Reset pinch-to-zoom state
        state.currentScale = 1;
        state.initialDistance = 0;
        state.initialScale = 1;
    };

    // ========== FOCUS MODE CLEANUP ==========
    let focusWrap = null;
    const cleanupFocusMode = () => {
        if (focusWrap && touchListeners) {
            focusWrap.removeEventListener('touchstart', touchListeners.onTouchStart);
            focusWrap.removeEventListener('touchmove', touchListeners.onTouchMove);
            focusWrap.removeEventListener('touchend', touchListeners.onTouchEnd);
            touchListeners = null;
            focusWrap = null;
        }
    };

    // ========== VIDEO FINDER ==========
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

    // ========== INJECT BUTTON ==========
    const injectButton = (video) => {
        if (document.getElementById('iso-portal-host')) return;

        const isIframe = window.self !== window.top;

        const host = document.createElement('div');
        host.id = 'iso-portal-host';

        host.style.cssText = `
            position: fixed !important;
            top: 15px !important;
            right: 10px !important;
            z-index: ${CONFIG.MAX_Z_INDEX} !important;
            display: flex !important;
            gap: 6px !important;
        `;

        // Apply base styles (only once)
        if (!injectButtonStyleAdded) {
            const style = document.createElement('style');
            style.id = 'iso-host-style';
            style.textContent = `
                .iso-btn {
                    all: unset !important;
                    color: #fff !important;
                    font-size: 12px !important;
                    font-weight: 600 !important;
                    cursor: pointer !important;
                    padding: 8px 12px !important;
                    min-width: 36px !important;
                    min-height: 36px !important;
                    text-align: center !important;
                    background: rgba(0, 0, 0, 0.85) !important;
                    border-radius: 6px !important;
                    transition: transform 0.1s ease !important;
                    transform-origin: center center !important;
                }
            `;
            document.head.appendChild(style);
            injectButtonStyleAdded = true;
        }

        // Only show relevant button based on context
        if (isIframe) {
            // Iframe: only EXTRACT button
            const extractBtn = document.createElement('button');
            extractBtn.className = 'iso-btn';
            extractBtn.innerText = '⬆ EXTRACT';
            extractBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const a = document.createElement('a');
                a.href = window.location.href;
                a.rel = 'referrer';
                a.target = '_blank';
                document.body.appendChild(a);
                a.click();
                a.remove();
            });
            host.appendChild(extractBtn);
        } else {
            // Not iframe: only FOCUS button
            const focusBtn = document.createElement('button');
            focusBtn.className = 'iso-btn';
            focusBtn.innerText = '▶ FOCUS';
            focusBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                launchFocus(video);
            });
            host.appendChild(focusBtn);
        }

        (document.body || document.documentElement).appendChild(host);
    };

    // ========== FOCUS MODE ==========
    const launchFocus = (video) => {
        if (document.getElementById('p-wrap')) return;

        const originalSpeed = video.playbackRate;
        const originalVolume = video.volume;

        // Cleanup previous focus mode
        cleanupFocusMode();

        // Aggressive cleanup - destroy everything
        document.body.replaceChildren();
        cleanup();

        document.body.style.cssText = 'background: #000 !important; margin: 0 !important; overflow: hidden !important;';

        // Detect screen orientation (portrait = height > width)
        const isPortrait = window.innerHeight > window.innerWidth;

        // Styles - Mobile minimalist
        const style = document.createElement('style');
        style.id = 'p-styles';
        style.textContent = `
            * { box-sizing: border-box; }
            #p-wrap { position: fixed; inset: 0; display: flex; justify-content: center; align-items: center; background: #000; }
            #p-controls { position: fixed; bottom: 0; left: 0; right: 0; padding: 15px; display: flex; flex-direction: column; gap: 10px; z-index: ${CONFIG.MAX_Z_INDEX}; }
            video { max-width: 100% !important; max-height: calc(100vh - 180px) !important; width: 100% !important; height: auto !important; object-fit: contain !important; }
            video.portrait { transform: scale(${CONFIG.PORTRAIT_SCALE}) !important; transform-origin: center center !important; }
            .ctrl-btn { all: unset; color: #fff; font-size: 12px; cursor: pointer; padding: 6px 10px; }
            #v-slider { width: 60px; height: 3px; accent-color: #fff; }
            #p-bar { width: 100%; min-height: 32px; display: flex; align-items: center; padding: 14px 0; }
            #p-bar-inner { width: 100%; height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; cursor: pointer; position: relative; }
            #p-fill { height: 100%; background: #fff; border-radius: 2px; width: 0; }
            #p-time { color: #fff; font-size: 11px; }
            #s-ind { position: fixed; top: 15px; right: 15px; color: #fff; font-size: 12px; cursor: pointer; z-index: ${CONFIG.MAX_Z_INDEX}; padding: 8px; }
            #fs-btn { position: fixed; top: 15px; left: 15px; z-index: ${CONFIG.MAX_Z_INDEX}; }
            video::-webkit-media-controls { display: none !important; }
            video::-webkit-media-controls-enclosure { display: none !important; }
            video::-webkit-media-controls-panel { display: none !important; }
            video::-webkit-media-controls-overlay-enclosure { display: none !important; }
            video::-moz-media-controls { display: none !important; }
            video::-moz-media-controls-enclosure { display: none !important; }
            :fullscreen video { object-fit: contain !important; width: 100vw !important; height: 100vh !important; max-width: 100vw !important; max-height: 100vh !important; transform: none !important; }
            :fullscreen #p-controls { display: flex !important; }
            :fullscreen #s-ind, :fullscreen #fs-btn { font-size: 14px !important; padding: 10px !important; display: block !important; }
            video::-internal-media-controls-overlay-cast-button { display: none !important; }
            video::-webkit-media-controls-remote-cast-button { display: none !important; }
        `;
        document.head.appendChild(style);

        // Wrap container
        const wrap = document.createElement('div');
        wrap.id = 'p-wrap';

        // Controls
        const controls = document.createElement('div');
        controls.id = 'p-controls';

        // Progress bar (with larger touch area)
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
        speedInd.innerText = `${originalSpeed}x`;

        // Fullscreen button
        const fsBtn = document.createElement('button');
        fsBtn.id = 'fs-btn';
        fsBtn.className = 'ctrl-btn';
        fsBtn.innerText = '⛶';
        fsBtn.addEventListener('click', () => {
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
            } else {
                document.documentElement.requestFullscreen().catch(() => {});
            }
        });

        // Play/Pause button
        const playPauseBtn = document.createElement('button');
        playPauseBtn.className = 'ctrl-btn';
        playPauseBtn.innerText = '❚❚';
        playPauseBtn.addEventListener('click', () => {
            if (video.paused) {
                video.play().catch(() => {});
                playPauseBtn.innerText = '❚❚';
            } else {
                video.pause();
                playPauseBtn.innerText = '▶';
            }
        });

        // Seek buttons
        const seekBackBtn = document.createElement('button');
        seekBackBtn.className = 'ctrl-btn';
        seekBackBtn.innerText = `-${CONFIG.SEEK_STEP}`;
        seekBackBtn.addEventListener('click', () => {
            video.currentTime = Math.max(0, video.currentTime - CONFIG.SEEK_STEP);
        });

        const seekFwdBtn = document.createElement('button');
        seekFwdBtn.className = 'ctrl-btn';
        seekFwdBtn.innerText = `+${CONFIG.SEEK_STEP}`;
        seekFwdBtn.addEventListener('click', () => {
            video.currentTime = Math.min(video.duration, video.currentTime + CONFIG.SEEK_STEP);
        });

        // Volume
        const muteBtn = document.createElement('button');
        muteBtn.className = 'ctrl-btn';
        muteBtn.innerText = '🔊';
        muteBtn.addEventListener('click', () => {
            video.muted = !video.muted;
            muteBtn.innerText = video.muted ? '🔇' : '🔊';
        });

        const volumeSlider = document.createElement('input');
        volumeSlider.id = 'v-slider';
        volumeSlider.type = 'range';
        volumeSlider.min = '0';
        volumeSlider.max = '1';
        volumeSlider.step = '0.05';
        volumeSlider.value = originalVolume;
        volumeSlider.addEventListener('input', (e) => {
            video.volume = parseFloat(e.target.value);
            video.muted = false;
            muteBtn.innerText = video.volume === 0 ? '🔇' : '🔊';
        });

        // Controls row
        const controlsRow = document.createElement('div');
        controlsRow.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 8px;';
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

        document.body.appendChild(wrap);
        document.body.appendChild(controls);
        wrap.appendChild(video);

        // Apply portrait class if video is portrait orientation
        if (isPortrait) {
            video.classList.add('portrait');
        }

        // Speed change
        speedInd.addEventListener('click', () => {
            state.currentSpeedIdx = (state.currentSpeedIdx + 1) % CONFIG.SPEEDS.length;
            video.playbackRate = CONFIG.SPEEDS[state.currentSpeedIdx];
            speedInd.innerText = `${CONFIG.SPEEDS[state.currentSpeedIdx]}x`;
        });

        // Progress bar seek
        progressBar.addEventListener('click', (e) => {
            const rect = progressBar.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            video.currentTime = percent * video.duration;
        });

        // Update progress
        video.addEventListener('timeupdate', () => {
            if (!video.duration) return;
            const percent = (video.currentTime / video.duration) * 100;
            progressFill.style.width = `${percent}%`;
            
            const currMin = Math.floor(video.currentTime / 60);
            const currSec = Math.floor(video.currentTime % 60);
            const durMin = Math.floor(video.duration / 60);
            const durSec = Math.floor(video.duration % 60);
            
            timeDisplay.innerText = `${currMin}:${currSec.toString().padStart(2, '0')} / ${durMin}:${durSec.toString().padStart(2, '0')}`;
        });

        // Touch gestures for seek - stored for cleanup
        let touchStartX = 0;
        let touchStartTime = 0;
        let isSwiping = false;

        const onTouchStart = (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartTime = video.currentTime;
            isSwiping = false;
        };

        const onTouchMove = (e) => {
            const deltaX = e.touches[0].clientX - touchStartX;
            if (Math.abs(deltaX) > 50 && !isSwiping) {
                isSwiping = true;
            }
            if (isSwiping) {
                e.preventDefault();
                const seekDelta = (deltaX / wrap.getBoundingClientRect().width) * video.duration * 0.5;
                video.currentTime = Math.max(0, Math.min(video.duration, touchStartTime + seekDelta));
                const percent = (video.currentTime / video.duration) * 100;
                progressFill.style.width = `${percent}%`;
            }
        };

        const onTouchEnd = () => {
            isSwiping = false;
        };

        touchListeners = { onTouchStart, onTouchMove, onTouchEnd };
        focusWrap = wrap;

        wrap.addEventListener('touchstart', onTouchStart, { passive: true });
        wrap.addEventListener('touchmove', onTouchMove, { passive: false });
        wrap.addEventListener('touchend', onTouchEnd, { passive: true });

        // Keyboard shortcuts (Escape only for mobile)
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') location.reload();
        });

        video.controls = true;
        video.play().catch(() => {});
    };

    // ========== MUTATION HANDLER ==========
    const handleMutation = () => {
        if (document.getElementById('iso-portal-host') || document.getElementById('p-wrap')) return;
        
        // Initialize search start time on first call
        if (!state.searchStartTime) {
            state.searchStartTime = Date.now();
        }
        
        // Check if timeout exceeded
        if (Date.now() - state.searchStartTime > CONFIG.SEARCH_TIMEOUT) {
            return; // Stop searching
        }
        
        const target = findVideoNuclear();
        if (target) {
            state.searchStartTime = null; // Reset
            injectButton(target);
        } else {
            if (retryTimerId) clearTimeout(retryTimerId);
            retryTimerId = setTimeout(handleMutation, CONFIG.RETRY_DELAY);
        }
    };

    // ========== INITIALIZATION ==========
    observer = new MutationObserver(() => {
        if (retryTimerId) clearTimeout(retryTimerId);
        retryTimerId = setTimeout(handleMutation, CONFIG.DEBOUNCE_DELAY);
    });

    observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true
    });

    handleMutation();

    window.addEventListener('beforeunload', () => {
        cleanupFocusMode();
        cleanup();
    });
})();
