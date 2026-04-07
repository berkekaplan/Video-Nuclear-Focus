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

        // Toggle button
        const toggle = document.createElement('div');
        toggle.id = 'iso-portal-toggle';
        toggle.innerHTML = '&#9654;';
        toggle.style.cssText = `
            padding: 8px 10px !important;
            color: #fff !important;
            cursor: pointer !important;
            font-family: monospace !important;
            font-size: 14px !important;
            border-right: 1px solid #555 !important;
            user-select: none !important;
        `;

        // Main button
        const btn = document.createElement('button');
        btn.innerText = isIframe ? 'EXTRACT' : 'FOCUS';
        btn.style.cssText = `
            all: unset !important;
            padding: 10px 14px !important;
            color: #fff !important;
            cursor: pointer !important;
            font-family: monospace !important;
            font-size: 14px !important;
            white-space: nowrap !important;
            min-width: 44px !important;
            min-height: 44px !important;
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

    // Main focus mode - optimized for mobile
    function launchFocus(video) {
        if (document.getElementById('p-wrap')) return;

        cleanup();

        const originalSpeed = video.playbackRate;
        const originalVolume = video.volume;

        // Replace body content
        document.body.replaceChildren();
        document.body.style.cssText = 'background: #000 !important; margin: 0 !important; overflow: hidden !important; width: 100vw; height: 100vh;';

        // Styles - mobile optimized with fullscreen video and bottom controls
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
            #p-controls { 
                position: fixed; 
                bottom: 0; 
                left: 0; 
                right: 0; 
                background: linear-gradient(transparent, rgba(0,0,0,0.9)); 
                padding: 40px 10px 20px; 
                z-index: 2147483647; 
            }
            #s-ind { 
                position: fixed; 
                top: 20px; 
                right: 20px; 
                color: #888; 
                font-family: monospace; 
                cursor: pointer; 
                z-index: 2147483647; 
                font-size: 14px; 
                background: rgba(0,0,0,0.5);
                padding: 4px 8px;
                border-radius: 4px;
            }
            .ctrl-btn { 
                all: unset; 
                color: #fff; 
                font-family: monospace; 
                font-size: 14px; 
                cursor: pointer; 
                padding: 10px 12px; 
                border-radius: 4px; 
                min-width: 44px;
                min-height: 44px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .ctrl-btn:active { background: rgba(255,255,255,0.3); }
            #v-slider { width: 80px; height: 4px; cursor: pointer; accent-color: #fff; margin: 0 8px; }
            #p-bar { 
                position: fixed; 
                bottom: 90px; 
                left: 10px; 
                right: 10px; 
                height: 4px; 
                background: rgba(255,255,255,0.3); 
                cursor: pointer; 
                border-radius: 2px; 
                z-index: 2147483647; 
            }
            #p-fill { height: 100%; background: #fff; border-radius: 2px; width: 0; transition: width 0.1s linear; }
            #p-time { color: #888; font-family: monospace; font-size: 12px; margin-left: 10px; }
            .kbd { font-size: 10px; color: #666; margin-left: 4px; }
            #pip-btn { margin-left: 10px; }
        `;
        document.head.appendChild(style);

        // Wrap container
        const wrap = document.createElement('div');
        wrap.id = 'p-wrap';

        // Set video to fullscreen
        video.id = 'p-video';
        video.style.cssText = 'width: 100vw !important; height: 100vh !important; object-fit: contain !important;';
        video.removeAttribute('controls');

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
        speedInd.innerHTML = `${originalSpeed}X`;

        // PiP button
        const pipBtn = document.createElement('button');
        pipBtn.id = 'pip-btn';
        pipBtn.className = 'ctrl-btn';
        pipBtn.innerHTML = 'PiP';

        const pipSupported = document.pictureInPictureEnabled && video.requestPictureInPicture;
        if (!pipSupported) {
            pipBtn.style.display = 'none';
        } else {
            pipBtn.onclick = async () => {
                try {
                    if (document.pictureInPictureElement) {
                        await document.exitPictureInPicture();
                    } else {
                        await video.requestPictureInPicture();
                    }
                } catch (err) {
                    console.log('PiP error:', err);
                }
            };
        }

        // Control buttons - mobile friendly
        const btnContainer = document.createElement('div');
        btnContainer.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap;';

        const playPauseBtn = document.createElement('button');
        playPauseBtn.className = 'ctrl-btn';
        playPauseBtn.innerHTML = '&#10074;&#10074;';
        playPauseBtn.onclick = () => {
            if (video.paused) {
                video.play();
                playPauseBtn.innerHTML = '&#10074;&#10074;';
            } else {
                video.pause();
                playPauseBtn.innerHTML = '&#9654;';
            }
        };

        const seekBackBtn = document.createElement('button');
        seekBackBtn.className = 'ctrl-btn';
        seekBackBtn.innerHTML = `-${SEEK_STEP}`;
        seekBackBtn.onclick = () => { video.currentTime = Math.max(0, video.currentTime - SEEK_STEP); };

        const seekFwdBtn = document.createElement('button');
        seekFwdBtn.className = 'ctrl-btn';
        seekFwdBtn.innerHTML = `+${SEEK_STEP}`;
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
        muteBtn.innerHTML = '&#9834;';
        muteBtn.onclick = () => {
            video.muted = !video.muted;
            muteBtn.innerHTML = video.muted ? '&#9835;' : '&#9834;';
        };

        const fullscreenBtn = document.createElement('button');
        fullscreenBtn.className = 'ctrl-btn';
        fullscreenBtn.innerHTML = '&#9974;';
        fullscreenBtn.onclick = async () => {
            try {
                if (document.fullscreenElement) {
                    await document.exitFullscreen();
                } else {
                    await document.documentElement.requestFullscreen();
                }
            } catch (err) {
                console.log('Fullscreen error:', err);
            }
        };

        // Speed controls
        const speedBtn = document.createElement('button');
        speedBtn.className = 'ctrl-btn';
        speedBtn.innerHTML = `${SPEEDS[0]}X`;
        speedBtn.onclick = () => {
            currentSpeedIdx = (currentSpeedIdx + 1) % SPEEDS.length;
            video.playbackRate = SPEEDS[currentSpeedIdx];
            speedBtn.innerHTML = `${SPEEDS[currentSpeedIdx]}X`;
            speedInd.innerHTML = `${SPEEDS[currentSpeedIdx]}X`;
        };

        btnContainer.appendChild(playPauseBtn);
        btnContainer.appendChild(seekBackBtn);
        btnContainer.appendChild(seekFwdBtn);
        btnContainer.appendChild(muteBtn);
        btnContainer.appendChild(volumeSlider);
        btnContainer.appendChild(speedBtn);
        btnContainer.appendChild(pipBtn);
        btnContainer.appendChild(fullscreenBtn);

        controls.appendChild(progressBar);
        controls.appendChild(timeDisplay);
        controls.appendChild(btnContainer);

        // Append elements
        document.body.appendChild(wrap);
        document.body.appendChild(controls);
        document.body.appendChild(speedInd);
        wrap.appendChild(video);

        // Progress bar interaction
        progressBar.onclick = (e) => {
            const rect = progressBar.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            video.currentTime = percent * video.duration;
        };

        // Update progress - using addEventListener instead of ontimeupdate
        const updateProgress = () => {
            if (video.duration) {
                const percent = (video.currentTime / video.duration) * 100;
                progressFill.style.width = percent + '%';
                const currMin = Math.floor(video.currentTime / 60);
                const currSec = Math.floor(video.currentTime % 60);
                const durMin = Math.floor(video.duration / 60);
                const durSec = Math.floor(video.duration % 60);
                timeDisplay.innerText = `${currMin}:${currSec.toString().padStart(2, '0')} / ${durMin}:${durSec.toString().padStart(2, '0')}`;
            }
            requestAnimationFrame(updateProgress);
        };
        requestAnimationFrame(updateProgress);

        // Play/Pause state sync
        video.onplay = () => { playPauseBtn.innerHTML = '&#10074;&#10074;'; };
        video.onpause = () => { playPauseBtn.innerHTML = '&#9654;'; };

        // Escape on mobile
        window.onkeydown = (e) => {
            if (e.key === 'Escape') location.reload();
        };

        // Try to play, show tap message if autoplay blocked
        video.play().catch(() => {
            const tapMsg = document.createElement('div');
            tapMsg.innerText = '▶ Oynatmak için tıkla';
            tapMsg.style.cssText = `
                position: fixed;
                bottom: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0,0,0,0.8);
                color: white;
                padding: 16px 24px;
                border-radius: 30px;
                font-family: monospace;
                font-size: 18px;
                z-index: 2147483647;
                cursor: pointer;
            `;
            document.body.appendChild(tapMsg);
            tapMsg.onclick = () => {
                video.play();
                tapMsg.remove();
            };
            setTimeout(() => tapMsg.remove(), 10000);
        });
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
