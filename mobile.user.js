// ==UserScript==
// @name         Mobil Focus (v4.0 - Mobile Enhanced)
// @version      4.0
// @description  Mobile optimized with touch gestures, larger controls, PiP, volume control and progress bar
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
    const TOUCH_SEEK_STEP = 5;
    let currentSpeedIdx = 0;
    let debounceTimer = null;
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };
    
    // Touch gesture state
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let touchStartVolume = 0;
    let isSwipeGesture = false;
    let lastTapTime = 0;
    let swipeDirection = null;

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

        // Styles - Mobile optimized
        const style = document.createElement('style');
        style.innerHTML = `
        @media (max-width: 768px) {
            html { background: #000 !important; }
            body { background: #000 !important; }
            #p-wrap { position: fixed; inset: 0; display: flex; justify-content: center; align-items: center; background: #000; touch-action: none; }
            #p-controls { 
                position: fixed; bottom: 0; left: 0; right: 0; 
                background: linear-gradient(transparent, rgba(0,0,0,0.9)); 
                padding: 30px 15px 40px; 
                z-index: 2147483647;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 15px;
            }
            video, canvas { 
                max-width: 100% !important; 
                max-height: calc(100vh - 250px) !important; 
                width: 100% !important; 
                height: auto !important; 
                object-fit: contain !important; 
                outline: none !important;
                touch-action: pan-y;
            }
            #s-ind { 
                position: fixed; top: 15px; right: 15px; 
                color: #888; font-family: monospace; 
                cursor: pointer; z-index: 2147483647; 
                font-size: 16px; transition: color 0.2s;
                padding: 12px 16px;
                background: rgba(0,0,0,0.6);
                border-radius: 8px;
            }
            #s-ind:active { color: #fff; }
            .ctrl-btn { 
                all: unset; color: #fff; font-family: monospace; 
                cursor: pointer; 
                transition: background 0.2s, transform 0.1s; 
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .ctrl-btn:active { transform: scale(0.95); background: rgba(255,255,255,0.3); }
            #v-slider { 
                width: 120px !important; 
                height: 8px !important; 
                cursor: pointer; accent-color: #fff; 
                margin: 0 12px;
                -webkit-appearance: none;
                background: rgba(255,255,255,0.3);
                border-radius: 4px;
            }
            #v-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 24px;
                height: 24px;
                background: #fff;
                border-radius: 50%;
                cursor: pointer;
            }
            #p-bar { 
                position: fixed; bottom: 160px; left: 15px; right: 15px; 
                height: 8px; background: rgba(255,255,255,0.2); 
                cursor: pointer; border-radius: 4px; 
                z-index: 2147483647; 
                transition: height 0.2s; 
            }
            #p-bar:active { height: 12px; }
            #p-fill { height: 100%; background: #fff; border-radius: 4px; width: 0; transition: width 0.1s linear; }
            #p-time { color: #888; font-family: monospace; font-size: 14px; margin-left: 0; }
            .kbd { display: none; }
            #pip-btn { position: fixed; top: 15px; left: 15px; z-index: 2147483647; padding: 12px 16px; background: rgba(0,0,0,0.6); border-radius: 8px; }
            .main-controls { display: flex !important; align-items: center; justify-content: center; gap: 20px !important; }
            .secondary-controls { display: flex !important; align-items: center; justify-content: center; gap: 15px !important; flex-wrap: wrap; }
            .time-wrapper { display: flex !important; align-items: center; gap: 15px; }
        }
        @media (min-width: 769px) {
            html { background: #000 !important; }
            body { background: #000 !important; }
            #p-wrap { position: fixed; inset: 0; display: flex; justify-content: center; align-items: center; background: #000; }
            #p-controls { position: fixed; bottom: 0; left: 0; right: 0; background: linear-gradient(transparent, rgba(0,0,0,0.8)); padding: 20px; z-index: 2147483647; }
            video, canvas { max-width: 100% !important; max-height: calc(100vh - 200px) !important; width: auto !important; height: auto !important; object-fit: contain !important; outline: none !important; }
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
            .main-controls { display: flex !important; }
            .secondary-controls { display: flex !important; }
            .time-wrapper { display: block; }
        }
        #gesture-indicator {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0,0,0,0.8);
            color: #fff;
            padding: 20px 40px;
            border-radius: 12px;
            font-family: monospace;
            font-size: 24px;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.2s;
            z-index: 2147483646;
        }
        #gesture-indicator.show { opacity: 1; }
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

        // Gesture indicator
        const gestureIndicator = document.createElement('div');
        gestureIndicator.id = 'gesture-indicator';
        gestureIndicator.innerText = '';
        document.body.appendChild(gestureIndicator);

        // Show gesture feedback
        let gestureTimeout;
        function showGesture(text, icon) {
            gestureIndicator.innerHTML = icon + '<br>' + text;
            gestureIndicator.classList.add('show');
            clearTimeout(gestureTimeout);
            gestureTimeout = setTimeout(() => {
                gestureIndicator.classList.remove('show');
            }, 600);
        }

        // Control buttons - Mobile optimized layout
        const mainControls = document.createElement('div');
        mainControls.className = 'main-controls';
        
        const secondaryControls = document.createElement('div');
        secondaryControls.className = 'secondary-controls';

        const playPauseBtn = document.createElement('button');
        playPauseBtn.className = 'ctrl-btn';
        playPauseBtn.innerHTML = '&#10074;&#10074; <span class="kbd">[Space]</span>';
        playPauseBtn.style.cssText = 'font-size: 24px !important; padding: 16px !important; width: 64px !important; height: 64px !important;';
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
        seekBackBtn.innerHTML = `&#9194; ${TOUCH_SEEK_STEP}`;
        seekBackBtn.style.cssText = 'font-size: 18px !important; padding: 12px !important; width: 48px !important; height: 48px !important;';
        seekBackBtn.onclick = () => { 
            video.currentTime = Math.max(0, video.currentTime - TOUCH_SEEK_STEP); 
            showGesture(`-${TOUCH_SEEK_STEP}s`, '⏪');
        };

        const seekFwdBtn = document.createElement('button');
        seekFwdBtn.className = 'ctrl-btn';
        seekFwdBtn.innerHTML = `${TOUCH_SEEK_STEP} &#9193;`;
        seekFwdBtn.style.cssText = 'font-size: 18px !important; padding: 12px !important; width: 48px !important; height: 48px !important;';
        seekFwdBtn.onclick = () => { 
            video.currentTime = Math.min(video.duration, video.currentTime + TOUCH_SEEK_STEP); 
            showGesture(`+${TOUCH_SEEK_STEP}s`, '⏩');
        };

        const muteBtn = document.createElement('button');
        muteBtn.className = 'ctrl-btn';
        muteBtn.innerHTML = '&#9834; <span class="kbd">[M]</span>';
        muteBtn.style.cssText = 'font-size: 16px !important; padding: 10px !important; width: 44px !important; height: 44px !important;';
        muteBtn.onclick = () => {
            video.muted = !video.muted;
            muteBtn.innerHTML = video.muted ? '&#9835;' : '&#9834;';
            showGesture(video.muted ? '🔇 Sessiz' : '🔊 Ses', video.muted ? '🔇' : '🔊');
        };

        const fullscreenBtn = document.createElement('button');
        fullscreenBtn.className = 'ctrl-btn';
        fullscreenBtn.innerHTML = '&#9974;';
        fullscreenBtn.style.cssText = 'font-size: 16px !important; padding: 10px !important; width: 44px !important; height: 44px !important;';
        fullscreenBtn.onclick = () => {
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
            } else {
                document.documentElement.requestFullscreen().catch(() => {});
            }
        };

        // Time wrapper
        const timeWrapper = document.createElement('div');
        timeWrapper.className = 'time-wrapper';
        
        const volumeWrapper = document.createElement('div');
        volumeWrapper.style.cssText = 'display: flex; align-items: center; gap: 8px;';
        
        const volumeIcon = document.createElement('span');
        volumeIcon.innerHTML = '🔊';
        volumeIcon.style.cssText = 'font-size: 16px;';
        
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
            volumeIcon.innerHTML = video.volume === 0 ? '🔇' : video.volume < 0.5 ? '🔉' : '🔊';
        };

        volumeWrapper.appendChild(volumeIcon);
        volumeWrapper.appendChild(volumeSlider);
        timeWrapper.appendChild(timeDisplay);
        timeWrapper.appendChild(volumeWrapper);

        // Build main controls (play/pause in center with seek buttons)
        mainControls.appendChild(seekBackBtn);
        mainControls.appendChild(playPauseBtn);
        mainControls.appendChild(seekFwdBtn);

        // Build secondary controls
        secondaryControls.appendChild(muteBtn);
        secondaryControls.appendChild(volumeSlider);
        secondaryControls.appendChild(fullscreenBtn);

        controls.appendChild(progressBar);
        controls.appendChild(timeDisplay);
        controls.appendChild(mainControls);
        controls.appendChild(secondaryControls);
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

        // Touch gesture support for video
        let controlsTimeout;
        let controlsVisible = true;

        const showControls = () => {
            controlsVisible = true;
            controls.style.opacity = '1';
            speedInd.style.opacity = '1';
            pipBtn.style.opacity = '1';
            clearTimeout(controlsTimeout);
            controlsTimeout = setTimeout(() => {
                if (controlsVisible) {
                    controls.style.opacity = '0';
                    speedInd.style.opacity = '0';
                    pipBtn.style.opacity = '0';
                }
            }, 3000);
        };

        wrap.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            touchStartTime = video.currentTime;
            touchStartVolume = video.volume;
            isSwipeGesture = false;
            swipeDirection = null;
            
            // Double tap detection
            const now = Date.now();
            if (now - lastTapTime < 300) {
                const rect = wrap.getBoundingClientRect();
                const tapX = touchStartX - rect.left;
                const videoWidth = rect.width;
                
                if (tapX < videoWidth / 2) {
                    // Double tap left - rewind
                    video.currentTime = Math.max(0, video.currentTime - 10);
                    showGesture('-10s', '⏪');
                } else {
                    // Double tap right - forward
                    video.currentTime = Math.min(video.duration, video.currentTime + 10);
                    showGesture('+10s', '⏩');
                }
                lastTapTime = 0;
            } else {
                lastTapTime = now;
            }
        }, { passive: true });

        wrap.addEventListener('touchmove', (e) => {
            const deltaX = e.touches[0].clientX - touchStartX;
            const deltaY = e.touches[0].clientY - touchStartY;
            
            // Determine swipe direction if not set
            if (!swipeDirection && (Math.abs(deltaX) > 30 || Math.abs(deltaY) > 30)) {
                swipeDirection = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical';
                isSwipeGesture = true;
            }
            
            if (isSwipeGesture) {
                e.preventDefault();
                
                if (swipeDirection === 'horizontal') {
                    // Horizontal swipe - seek
                    const seekDelta = (deltaX / wrap.getBoundingClientRect().width) * video.duration * 0.5;
                    const newTime = Math.max(0, Math.min(video.duration, touchStartTime + seekDelta));
                    video.currentTime = newTime;
                    
                    const percent = (newTime / video.duration) * 100;
                    progressFill.style.width = percent + '%';
                    
                    const direction = deltaX > 0 ? 'forward' : 'back';
                    const icon = direction === 'forward' ? '⏩' : '⏪';
                    const seconds = Math.round(Math.abs(seekDelta));
                    showGesture(`${deltaX > 0 ? '+' : '-'}${seconds}s`, icon);
                } else {
                    // Vertical swipe - volume (right side for volume, left side for brightness)
                    const rect = wrap.getBoundingClientRect();
                    const isRightSide = touchStartX > rect.width / 2;
                    
                    if (isRightSide) {
                        const volumeDelta = -deltaY / rect.height;
                        const newVolume = Math.max(0, Math.min(1, touchStartVolume + volumeDelta));
                        video.volume = newVolume;
                        video.muted = false;
                        
                        showGesture(`${Math.round(newVolume * 100)}%`, '🔊');
                    }
                }
            }
        }, { passive: false });

        wrap.addEventListener('touchend', () => {
            isSwipeGesture = false;
            swipeDirection = null;
        }, { passive: true });

        // Tap to show/hide controls
        wrap.addEventListener('click', (e) => {
            if (e.target === wrap || e.target === video) {
                showControls();
            }
        });

        // Show controls initially
        showControls();

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

