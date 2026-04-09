const BAR_COUNT = 6;
const POLL_INTERVAL_MS = 500;

// WeakMap so we never call createMediaElementSource twice on the same element
const elementSources = new WeakMap();


// Play modes cycle: sequential → shuffle → loop
const PLAY_MODES = ['sequential', 'shuffle', 'loop'];
const MODE_ICONS  = { sequential: '&#x2192;', shuffle: '&#x21C4;', loop: '&#x21BB;' };
const MODE_LABELS = { sequential: 'Play sequentially', shuffle: 'Shuffle', loop: 'Loop track' };

export function createAudioVisualizerController({ getAudioElement, assetsBasePath, getGameState, onPrev, onTogglePause, onNext, onShuffle, getPlayMode, onSetPlayMode, getIsPaused, getPlaylistLabel }) {
    let audioCtx        = null;
    let analyser        = null;
    let fftData         = null;
    let rafId           = null;
    let pollTimer       = null;
    let root            = null;
    let canvasEl        = null;
    let ctx             = null;
    let titleEl         = null;
    let pauseBtnEl      = null;
    let modeBtnEl       = null;
    let playlistLabelEl = null;
    let isVisible       = false;
    let suppressed      = false;

    // Layer element references for swapping
    let imgClock        = null;
    let imgMorning      = null;  // day/night icon (rocks)
    let imgWings        = null;
    let imgWisps        = null;
    let imgCradle       = null;
    let imgScroller     = null;

    let lastInvestigation = null;
    let lastIsNight       = null;

    // ── DOM ────────────────────────────────────────────────────

    function buildDOM() {
        root = document.createElement('div');
        root.id = 'dangan-bgm-display';
        root.setAttribute('aria-label', 'Now Playing');
        root.setAttribute('aria-live', 'polite');

        const base = assetsBasePath + '/assets/bgm-display';

        // Layer order (back → front): time-cradle, backing-wisps+canvas, daily-life-morning, wings, clock, text-scroller
        root.innerHTML = `
            <div class="dbgm-layer dbgm-cradle" aria-hidden="true">
                <img src="${base}/time-cradle.png" alt="" draggable="false" />
            </div>
            <div class="dbgm-layer dbgm-wisps" aria-hidden="true">
                <img src="${base}/backing-wisps.png" alt="" draggable="false" />
            </div>
            <canvas class="dbgm-canvas" aria-hidden="true"></canvas>
            <div class="dbgm-layer dbgm-morning" aria-hidden="true">
                <img src="${base}/daily-life-morning.png" alt="" draggable="false" />
            </div>
            <div class="dbgm-layer dbgm-wings" aria-hidden="true">
                <img src="${base}/wings.png" alt="" draggable="false" />
            </div>
            <div class="dbgm-layer dbgm-clock" aria-hidden="true">
                <img src="${base}/daily-life-clock.png" alt="" draggable="false" />
            </div>
            <div class="dbgm-layer dbgm-scroller" aria-hidden="true">
                <img src="${base}/text-scroller.png" alt="" draggable="false" />
                <div class="dbgm-titlebar-text-container"><span class="dbgm-titlebar-text"></span></div>
            </div>
            <div class="dbgm-controls" aria-label="BGM controls">
                <span class="dbgm-playlist-label" aria-live="polite"></span>
                <div class="dbgm-ctrl-btns">
                    <button class="dbgm-ctrl-btn dbgm-mode-btn" data-action="mode" aria-label="Play mode: sequential">&#x2192;</button>
                    <button class="dbgm-ctrl-btn" data-action="prev" aria-label="Previous track">&#x23EE;</button>
                    <button class="dbgm-ctrl-btn dbgm-ctrl-pause" data-action="pause" aria-label="Pause">&#x23F8;</button>
                    <button class="dbgm-ctrl-btn" data-action="next" aria-label="Next track">&#x23ED;</button>
                </div>
            </div>
        `;

        document.body.appendChild(root);

        imgClock    = root.querySelector('.dbgm-clock img');
        imgMorning  = root.querySelector('.dbgm-morning img');
        imgWings    = root.querySelector('.dbgm-wings img');
        imgWisps    = root.querySelector('.dbgm-wisps img');
        imgCradle   = root.querySelector('.dbgm-cradle img');
        imgScroller = root.querySelector('.dbgm-scroller img');
        canvasEl    = root.querySelector('.dbgm-canvas');
        titleEl     = root.querySelector('.dbgm-titlebar-text');
        pauseBtnEl      = root.querySelector('.dbgm-ctrl-pause');
        modeBtnEl       = root.querySelector('.dbgm-mode-btn');
        playlistLabelEl = root.querySelector('.dbgm-playlist-label');

        root.querySelector('[data-action="prev"]').addEventListener('click', () => onPrev?.());
        root.querySelector('[data-action="pause"]').addEventListener('click', () => onTogglePause?.());
        root.querySelector('[data-action="next"]').addEventListener('click', () => {
            const mode = getPlayMode?.() ?? 'sequential';
            if (mode === 'shuffle') onShuffle?.();
            else onNext?.(); // sequential and loop both advance to the next track on manual press
        });
        modeBtnEl.addEventListener('click', () => {
            const current = getPlayMode?.() ?? 'sequential';
            const next = PLAY_MODES[(PLAY_MODES.indexOf(current) + 1) % PLAY_MODES.length];
            onSetPlayMode?.(next);
            updateModeBtn();
        });

        updateModeBtn();

        syncCanvasSize();
        window.addEventListener('resize', syncCanvasSize);
    }

    function updateModeBtn() {
        if (!modeBtnEl) return;
        const mode = getPlayMode?.() ?? 'sequential';
        modeBtnEl.innerHTML = MODE_ICONS[mode] ?? MODE_ICONS.sequential;
        modeBtnEl.setAttribute('aria-label', MODE_LABELS[mode] ?? 'Play mode');
        modeBtnEl.classList.toggle('dbgm-mode-active', mode !== 'sequential');
    }

    function syncCanvasSize() {
        if (!canvasEl || !root) return;
        canvasEl.width  = root.offsetWidth  || 300;
        canvasEl.height = root.offsetHeight || 120;
        ctx = canvasEl.getContext('2d');
    }

    // ── Asset swapping ─────────────────────────────────────────

    function updateAssets() {
        const state = getGameState?.() ?? { isInvestigation: false, isNight: false };
        const { isInvestigation, isNight } = state;

        if (isInvestigation === lastInvestigation && isNight === lastIsNight) return;
        lastInvestigation = isInvestigation;
        lastIsNight       = isNight;

        const base   = assetsBasePath + '/assets/bgm-display';
        const prefix = isInvestigation ? 'deadly-life' : 'daily-life';

        imgClock.src   = `${base}/${prefix}-clock.png`;

        const timeOfDay = isNight ? 'night' : 'morning';
        imgMorning.src = `${base}/${prefix}-${timeOfDay}.png`;

        // Phase classes drive the playlist label colour via CSS.
        root?.classList.toggle('dbgm-phase-investigation', !!isInvestigation);
        root?.classList.toggle('dbgm-phase-night',         !isInvestigation && !!isNight);
    }

    // ── Song title ─────────────────────────────────────────────

    function updateTitle() {
        if (!titleEl) return;

        // Primary: derive from what the audio element is actually playing.
        // The select can fall out of sync when Dynamic Audio's fillBGMSelect()
        // wipes injected options (e.g. the interjection BGM), so always trust the src.
        const audioEl = document.getElementById('audio_bgm');
        const src = audioEl instanceof HTMLAudioElement ? (audioEl.src || '') : '';
        let name = '';

        if (src) {
            try {
                name = new URL(src).pathname.split('/').pop() || '';
            } catch (_) {
                name = src.split('/').pop();
            }
            name = name.replace(/\.[^.]+$/, '');
            try { name = decodeURIComponent(name); } catch (_) {}
        }

        // Fallback: use the select label when nothing is playing yet.
        if (!name) {
            const select = document.getElementById('audio_bgm_select');
            if (select) {
                const opt = select.options[select.selectedIndex];
                if (opt) {
                    name = opt.text || opt.value || '';
                    name = name.split('/').pop().replace(/\.[^.]+$/, '');
                    try { name = decodeURIComponent(name); } catch (_) {}
                }
            }
        }

        name = name.replace(/^asset:\s*/i, '');
        titleEl.textContent = name;

        if (playlistLabelEl) {
            playlistLabelEl.textContent = getPlaylistLabel?.() ?? '';
        }
    }

    // ── Audio context ──────────────────────────────────────────

    function ensureAnalyser(audioEl) {
        if (analyser) return true;
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return false;

            if (!audioCtx || audioCtx.state === 'closed') {
                audioCtx = new AC();
            }

            let src = elementSources.get(audioEl);
            if (!src) {
                src = audioCtx.createMediaElementSource(audioEl);
                elementSources.set(audioEl, src);
            }

            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 512;
            analyser.smoothingTimeConstant = 0.82;
            fftData = new Uint8Array(analyser.frequencyBinCount);

            src.connect(analyser);
            analyser.connect(audioCtx.destination);

            // Resume immediately if the browser suspends the context (e.g. when a
            // new Audio() SFX fires and triggers an audio-focus / autoplay check).
            audioCtx.addEventListener('statechange', () => {
                if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
            });

            return true;
        } catch (e) {
            console.warn('[Dangan][BGMDisplay]', e.message);
            analyser = null;
            return false;
        }
    }

    // ── Render loop ────────────────────────────────────────────

    function draw() {
        if (!isVisible) { rafId = null; return; }
        rafId = requestAnimationFrame(draw);

        if (!ctx || !analyser) return;
        if (audioCtx?.state === 'suspended') audioCtx.resume();

        const W = canvasEl.width;
        const H = canvasEl.height;
        ctx.clearRect(0, 0, W, H);

        const bins     = analyser.frequencyBinCount; // 256
        if (!fftData || fftData.length !== bins) fftData = new Uint8Array(bins);
        analyser.getByteFrequencyData(fftData);
        const data     = fftData;

        // Skip the first 4 bins (DC / rumble) and use up to 60% of spectrum.
        // Use logarithmic spacing so each bar covers a balanced frequency range,
        // and average a window of bins per bar for more even reactivity.
        const binStart = 4;
        const binEnd   = Math.floor(bins * 0.60);
        const logMin   = Math.log(binStart + 1);
        const logMax   = Math.log(binEnd + 1);

        // 6 bars fanning upward from the centre-bottom — crowning like a semicircle
        const { isInvestigation, isNight } = getGameState?.() ?? {};
        const barColor = isInvestigation        ? 'rgba(255,20,180,0.90)'
                       : isNight                ? '#93ff2c'
                       :                          '#4a8aff';

        // Origin: bottom-centre, just above the scroller strip
        const originX    = W / 2;
        const originY    = H - 2;
        const spreadHalf = (35 * Math.PI) / 180;  // ±35° from vertical-up
        const maxBarLen  = H * 0.90;

        for (let i = 0; i < BAR_COUNT; i++) {
            // Logarithmic bin edges for this bar
            const t0  = i       / BAR_COUNT;
            const t1  = (i + 1) / BAR_COUNT;
            const lo  = Math.round(Math.exp(logMin + t0 * (logMax - logMin))) - 1;
            const hi  = Math.round(Math.exp(logMin + t1 * (logMax - logMin))) - 1;
            // Average all bins in the window
            let sum = 0;
            const count = Math.max(1, hi - lo);
            for (let b = lo; b < hi; b++) sum += data[b];
            const amp = (sum / count) / 255;
            const len = amp * maxBarLen;
            if (len < 1) continue;

            const t     = BAR_COUNT > 1 ? i / (BAR_COUNT - 1) : 0.5;
            // canvas angle: -PI/2 = up; fan from left to right
            const angle = -Math.PI / 2 + (-spreadHalf + t * 2 * spreadHalf);
            const barW  = 10 + amp * 6;
            const halfW = barW / 2;

            ctx.save();
            ctx.translate(originX, originY);
            ctx.rotate(angle + Math.PI / 2);
            ctx.fillStyle = barColor;
            ctx.fillRect(-halfW, -len, barW, len);
            ctx.restore();
        }
    }

    // ── Show / hide ────────────────────────────────────────────

    function setVisible(v) {
        if (suppressed && v) return; // stay hidden while suppressed
        if (isVisible === v) return;
        isVisible = v;
        if (v) {
            root?.classList.remove('dbgm-hiding');
            root?.classList.add('dbgm-active');
            updateTitle();
            updateAssets();
            setTimeout(syncCanvasSize, 400);
            if (!rafId) draw();
        } else {
            if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
            root?.classList.remove('dbgm-active');
            root?.classList.add('dbgm-hiding');
            setTimeout(() => root?.classList.remove('dbgm-hiding'), 400);
        }
    }

    // ── Poll ───────────────────────────────────────────────────

    function poll() {
        const el = getAudioElement();
        if (!el || el.ended) {
            setVisible(false);
            return;
        }
        if (el.paused) {
            // Stay visible while paused so controls remain accessible
            if (!isVisible) return;
            if (pauseBtnEl) pauseBtnEl.innerHTML = '&#x23F5;'; // ▶
            return;
        }
        if (!ensureAnalyser(el)) {
            setVisible(false);
            return;
        }
        if (pauseBtnEl) pauseBtnEl.innerHTML = '&#x23F8;'; // ⏸
        updateTitle();
        updateAssets();
        setVisible(true);
    }

    // ── Public API ─────────────────────────────────────────────

    function init() {
        buildDOM();
        let lastPoll = 0;
        const rafPoll = (now) => {
            if (now - lastPoll >= POLL_INTERVAL_MS) { lastPoll = now; poll(); }
            pollTimer = requestAnimationFrame(rafPoll);
        };
        pollTimer = requestAnimationFrame(rafPoll);
    }

    function destroy() {
        cancelAnimationFrame(pollTimer);
        if (rafId) cancelAnimationFrame(rafId);
        window.removeEventListener('resize', syncCanvasSize);
        root?.remove();
        analyser?.disconnect();
        analyser = null;
        fftData  = null;
        if (audioCtx && audioCtx.state !== 'closed') audioCtx.close().catch(() => {});
        audioCtx = null;
    }

    function hide() { setVisible(false); }
    function suppress()   { suppressed = true;  setVisible(false); }
    function unsuppress() { suppressed = false; }

    return { init, destroy, hide, suppress, unsuppress };
}
