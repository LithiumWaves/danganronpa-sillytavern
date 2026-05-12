const QT_ID    = "dangan-qt-overlay";
const QT_STYLE = "dangan-qt-style";

function buildStyles() {
    return `
    #${QT_ID} {
        position: fixed;
        left: 0; right: 0;
        top: 33.33%; height: 33.34%;
        z-index: 2147483645;
        background: rgba(0, 5, 22, 0.91);
        display: flex; flex-direction: column;
        align-items: flex-start; justify-content: center;
        padding: 0 0 0 400px;
        opacity: 0; transition: opacity 280ms ease;
        pointer-events: none;
        font-family: "Orbitron", "Impact", sans-serif;
        overflow: hidden;
    }
    #${QT_ID}.qt-on { opacity: 1; pointer-events: auto; }

    /* CRT scanlines */
    #${QT_ID}::before {
        content: "";
        position: absolute; inset: 0;
        background: repeating-linear-gradient(
            0deg, transparent 0px, transparent 3px,
            rgba(0, 80, 255, 0.05) 3px, rgba(0, 80, 255, 0.05) 4px
        );
        pointer-events: none; z-index: 0;
    }

    /* Neon border glow at top and bottom */
    #${QT_ID}::after {
        content: "";
        position: absolute; inset: 0;
        background:
            linear-gradient(90deg, transparent, #00aaff, #0055ff, #00aaff, transparent) top    / 100% 3px no-repeat,
            linear-gradient(90deg, transparent, #00aaff, #0055ff, #00aaff, transparent) bottom / 100% 3px no-repeat;
        box-shadow:
            0 -1px 18px #00ddff, 0 -1px 40px #0088ff, 0 -1px 70px rgba(0, 140, 255, 0.8),
            0  1px 18px #00ddff, 0  1px 40px #0088ff, 0  1px 70px rgba(0, 140, 255, 0.8);
        pointer-events: none;
        animation: qtBorderPulse 1.8s ease-in-out infinite;
    }
    @keyframes qtBorderPulse {
        0%, 100% {
            box-shadow:
                0 -1px 18px #00ddff, 0 -1px 40px #0088ff, 0 -1px 70px rgba(0, 140, 255, 0.8),
                0  1px 18px #00ddff, 0  1px 40px #0088ff, 0  1px 70px rgba(0, 140, 255, 0.8);
            opacity: 1;
        }
        50% {
            box-shadow:
                0 -1px 30px #ffffff, 0 -1px 60px #00eeff, 0 -1px 100px rgba(0, 180, 255, 1),
                0  1px 30px #ffffff, 0  1px 60px #00eeff, 0  1px 100px rgba(0, 180, 255, 1);
            opacity: 1;
        }
    }

    .qt-inner {
        position: relative; z-index: 1;
        display: flex; flex-direction: column;
        align-items: flex-start;
        gap: 0;
        width: 100%;
    }

    .qt-answer-heading {
        font-family: "Orbitron", sans-serif;
        font-size: clamp(14px, 3vh, 30px);
        font-weight: 900;
        font-style: italic;
        letter-spacing: 3px;
        margin-bottom: clamp(2px, 0.5vh, 6px);
        line-height: 1;
    }
    /* Slightly larger leading "A" — adds visual emphasis to the heading. */
    .qt-answer-heading > span:first-child {
        font-size: 1.18em;
    }
    .qt-answer-heading > span {
        transition: color 90ms linear, text-shadow 90ms linear;
    }
    .qta-green  { color: #44ff88; text-shadow: 0 0 8px #44ff88, 0 0 22px #00ee55, 0 0 50px #00aa33; }
    .qta-yellow { color: #ffee00; text-shadow: 0 0 8px #ffee00, 0 0 22px #ddbb00, 0 0 50px #aa8800; }
    .qta-pink   { color: #ff44cc; text-shadow: 0 0 8px #ff44cc, 0 0 22px #ee00aa, 0 0 50px #bb0077; }
    .qta-blue   { color: #44aaff; text-shadow: 0 0 8px #44aaff, 0 0 22px #0077ee, 0 0 50px #0044aa; }
    /* Flicker state — each letter independently snaps to muted grey, then
     * back to its neon colour at random intervals. */
    .qt-answer-heading > span.qta-flicker {
        color: rgba(170, 170, 180, 0.55) !important;
        text-shadow: none !important;
    }

    .qt-title {
        font-size: clamp(10px, 1.4vh, 16px);
        font-weight: 400;
        color: rgba(180, 210, 255, 0.85);
        letter-spacing: 1px;
        margin-bottom: clamp(3px, 0.7vh, 10px);
        max-width: 70%;
        line-height: 1.3;
        text-shadow: 0 0 10px rgba(80, 140, 255, 0.5);
    }

    .qt-options {
        display: flex; flex-direction: column; gap: clamp(1px, 0.3vh, 4px);
    }

    .qt-option {
        display: flex; align-items: center; gap: clamp(8px, 1.2vw, 16px);
        cursor: pointer;
        padding: clamp(2px, 0.5vh, 6px) 12px clamp(2px, 0.5vh, 6px) 6px;
        border-left: 2px solid rgba(0, 120, 255, 0.25);
        background: transparent;
        transition: background 120ms ease, border-color 120ms ease, transform 80ms ease;
        user-select: none;
    }
    .qt-option:hover,
    .qt-option.qt-focused {
        background: rgba(0, 100, 255, 0.18);
        border-left-color: rgba(0, 180, 255, 0.85);
        transform: translateX(4px);
    }
    .qt-option:active { transform: translateX(8px); }

    .qt-num {
        font-size: clamp(12px, 2.2vh, 26px);
        font-weight: 900;
        font-style: italic;
        color: #eecc00;
        min-width: clamp(16px, 2vh, 28px);
        text-align: right;
        text-shadow: 0 0 8px rgba(255, 200, 0, 0.6);
        line-height: 1;
    }

    .qt-option-text {
        font-size: clamp(11px, 1.8vh, 22px);
        font-weight: 600;
        color: #ffffff;
        letter-spacing: 1px;
        text-shadow: 0 1px 3px rgba(0,0,0,0.8);
        line-height: 1.1;
    }

    /* Timer — in normal flow below options */
    #qt-timer {
        position: relative;
        margin-top: 24px;
        font-size: clamp(11px, 1.8vh, 24px);
        font-weight: 700;
        letter-spacing: 4px;
        color: #ffaa00;
        text-shadow: 0 0 10px #ff8800, 0 0 3px #ffcc00;
        z-index: 2;
    }
    #qt-timer.qt-urgent {
        color: #ff3300;
        text-shadow: 0 0 10px #ff0000, 0 0 3px #ff5500;
        animation: qtBlink 0.45s ease-in-out infinite;
    }
    @keyframes qtBlink { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

    @keyframes qtScreenShake {
        0%   { translate: 0px 0px; }
        10%  { translate: -6px  3px; }
        20%  { translate:  5px -4px; }
        30%  { translate: -4px  2px; }
        40%  { translate:  6px -3px; }
        50%  { translate: -5px  4px; }
        60%  { translate:  4px -2px; }
        70%  { translate: -3px  3px; }
        80%  { translate:  5px -4px; }
        90%  { translate: -4px  2px; }
        100% { translate:  0px  0px; }
    }
    body.qt-shaking { animation: qtScreenShake 80ms steps(2, end) infinite; }

    #qt-damage-flash {
        position: fixed; inset: 0;
        z-index: 2147483640;
        pointer-events: none;
        background: rgba(220, 0, 0, 0.55);
        animation: qtDamageFlash 0.2s ease-out forwards;
    }
    @keyframes qtDamageFlash {
        0%   { opacity: 0; }
        20%  { opacity: 1; }
        100% { opacity: 0; }
    }
    /* Hourglass */
    #qt-hourglass {
        position: absolute;
        left: 275px;
        top: 50%;
        transform: translateY(-50%);
        width: clamp(36px, 5.5vh, 60px);
        height: clamp(54px, 8vh, 90px);
        pointer-events: none;
        z-index: 1;
        filter: drop-shadow(0 0 6px #0088ff) drop-shadow(0 0 12px #004499);
    }

    /* GOT IT banner prefill */
    #dangan-qt-prefill {
        position: fixed;
        top: 33.33%; left: 0; right: 0; height: 33.34%;
        z-index: 2147483646;
        background: #000;
        pointer-events: none;
        transform: scaleX(0);
        transform-origin: center;
        transition: transform 0.045s ease-out;
    }

    /* GOT IT banner */
    #dangan-qt-banner {
        position: fixed;
        top: 33.33%; left: 0; right: 0; height: 33.34%;
        z-index: 2147483647;
        pointer-events: none;
        overflow: visible;
        opacity: 1;
        transition: opacity 0.5s ease;
        border-top: 6px solid #000;
        border-bottom: 6px solid #000;
        animation: qtBannerShadowPulse 1.2s ease-in-out infinite;
    }
    @keyframes qtBannerShadowPulse {
        0%, 100% {
            box-shadow:
                0 -12px 32px rgba(0,0,0,0.95),
                0 -4px  10px rgba(0,0,0,1),
                0  12px 32px rgba(0,0,0,0.95),
                0  4px  10px rgba(0,0,0,1);
        }
        50% {
            box-shadow:
                0 -24px 60px rgba(0,0,0,1),
                0 -8px  20px rgba(0,0,0,1),
                0  24px 60px rgba(0,0,0,1),
                0  8px  20px rgba(0,0,0,1);
        }
    }
    #dangan-qt-banner-inner {
        position: absolute;
        top: 0; bottom: 0;
        left: 100%;
        width: 100%;
        display: flex; align-items: center; justify-content: center;
        overflow: hidden;
        transition: left 0.325s cubic-bezier(0.22, 0.61, 0.36, 1);
    }
    .qt-banner-img {
        width: 100%; height: 100%;
        object-fit: cover;
        object-position: center;
        display: block;
    }

    /* Health display — NSD-style: status-bar.png graphic pinned to the
     * viewport's top-right, with the SVG-masked hearts gauge overlaid
     * above it (pink, drains right→left) and an all-black stars silhouette
     * below the hearts. */
    .qt-health {
        position: fixed;
        top: 10px;
        right: 10px;
        width: clamp(320px, 30vw, 320px);
        aspect-ratio: 770 / 442;
        pointer-events: none;
        z-index: 6;
    }
    .qt-status-bar {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: contain;
        pointer-events: none;
        user-select: none;
        -webkit-user-drag: none;
        z-index: 1;
    }
    .qt-hp-gauge,
    .qt-stars-gauge {
        position: absolute;
        pointer-events: none;
        z-index: 2;
    }
    /* Positions converted from NSD viewport-pixel offsets to fractions of
     * the 320 × ~183.6 status-bar bounding box, matching Question Truth. */
    .qt-hp-gauge {
        top: 14.7%;
        right: 1.875%;
        width: 71.875%;
        aspect-ratio: 420.62 / 162.12;
    }
    .qt-stars-gauge {
        top: 54.5%;
        right: 11.25%;
        width: 62.5%;
        aspect-ratio: 831.39 / 183.14;
    }
    .qt-hp-bg, .qt-hp-fg-wrap, .qt-hp-fg,
    .qt-stars-bg {
        position: absolute;
        inset: 0;
    }
    .qt-hp-bg, .qt-hp-fg,
    .qt-stars-bg {
        -webkit-mask-repeat: no-repeat;
                mask-repeat: no-repeat;
        -webkit-mask-position: center;
                mask-position: center;
        -webkit-mask-size: contain;
                mask-size: contain;
    }
    .qt-hp-bg      { background: #000; }
    .qt-hp-fg-wrap {
        filter:
            drop-shadow(0 0 6px  rgba(255,  55, 196, 0.9))
            drop-shadow(0 0 14px rgba(255,  55, 196, 0.55));
        transition: filter 0.18s ease;
    }
    .qt-hp-fg      {
        background: #ff37c4;
        clip-path: inset(0 calc(100% - var(--gauge-pct, 100%)) 0 0);
        transition: clip-path 180ms ease;
    }
    /* Stars row: silhouette only — never glows or fills with colour. */
    .qt-stars-bg   { background: #000; }

    /* Wrong (eliminated) option */
    .qt-option.qt-wrong {
        opacity: 0.3;
        pointer-events: none;
        cursor: default;
    }
    `;
}

function buildHourglass() {
    return `<svg id="qt-hourglass" viewBox="0 0 100 160" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <clipPath id="qt-top-clip"><polygon points="12,12 88,12 63,72 37,72"/></clipPath>
            <clipPath id="qt-bot-clip"><polygon points="37,88 63,88 88,148 12,148"/></clipPath>
            <filter id="qt-hg-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2.5" result="b"/>
                <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
        </defs>
        <!-- Frame outline -->
        <g filter="url(#qt-hg-glow)" stroke="#00ccff" stroke-width="2.5" fill="none" stroke-linejoin="round">
            <polygon points="12,12 88,12 63,72 37,72" fill="rgba(0,80,160,0.12)"/>
            <polygon points="37,88 63,88 88,148 12,148" fill="rgba(0,80,160,0.12)"/>
            <line x1="37" y1="72" x2="37" y2="88" stroke-width="2"/>
            <line x1="63" y1="72" x2="63" y2="88" stroke-width="2"/>
            <line x1="6" y1="10" x2="94" y2="10" stroke-width="3"/>
            <line x1="6" y1="150" x2="94" y2="150" stroke-width="3"/>
            <!-- Corner brackets -->
            <polyline points="6,10 6,20" stroke-width="3"/>
            <polyline points="94,10 94,20" stroke-width="3"/>
            <polyline points="6,150 6,140" stroke-width="3"/>
            <polyline points="94,150 94,140" stroke-width="3"/>
        </g>
        <!-- Sand top (pink/magenta, drains as time passes) -->
        <rect id="qt-sand-top" x="0" y="12" width="100" height="60"
              fill="rgba(255,50,180,0.82)" clip-path="url(#qt-top-clip)"/>
        <!-- Sand bottom (fills as time passes) -->
        <rect id="qt-sand-bot" x="0" y="148" width="100" height="0"
              fill="rgba(255,50,180,0.88)" clip-path="url(#qt-bot-clip)"/>
        <!-- Drip line from neck to bottom -->
        <line x1="50" y1="80" x2="50" y2="148"
              stroke="rgba(255,50,180,0.88)" stroke-width="2"
              stroke-linecap="round"/>
        <!-- Drip at neck -->
        <circle id="qt-drip" cx="50" cy="80" r="2.2" fill="rgba(255,50,180,0.88)"/>
    </svg>`;
}

function buildBanner(extensionFolderPath = '') {
    return `<div id="dangan-qt-banner">
        <div id="dangan-qt-banner-inner">
            <img class="qt-banner-img" src="${extensionFolderPath}/assets/images/minigames/got-it-banner.png" alt="Got It"/>
        </div>
    </div>`;
}

export function createQuestionTimeController({ extensionFolderPath = '', awardMonocoins = null, deductMonocoins = null, restoreTheme = null, getPlayerSpriteUrl = null } = {}) {

    function destroy() {
        document.getElementById(QT_ID)?.remove();
        document.getElementById(QT_STYLE)?.remove();
        document.getElementById("dangan-qt-banner")?.remove();
    }

    async function run({ title, time, answers, correct }) {
        destroy();

        const styleEl = document.createElement("style");
        styleEl.id = QT_STYLE;
        styleEl.textContent = buildStyles();
        document.head.appendChild(styleEl);

        const MAX_HEALTH = 4;
        let health = MAX_HEALTH;
        const heartsMaskUrl = `url("${extensionFolderPath}/assets/classtrial/hearts.svg")`;
        const starsMaskUrl  = `url("${extensionFolderPath}/assets/classtrial/stars.svg")`;
        const healthPct = () => Math.max(0, Math.min(100, (health / MAX_HEALTH) * 100));

        const overlay = document.createElement("div");
        overlay.id = QT_ID;
        overlay.innerHTML = `
            ${buildHourglass()}
            <div class="qt-inner">
                <div class="qt-answer-heading"><span class="qta-green">A</span><span class="qta-yellow">N</span><span class="qta-pink">S</span><span class="qta-blue">W</span><span class="qta-green">E</span><span class="qta-yellow">R</span></div>
                <div class="qt-title">${title}</div>
                <div class="qt-options">
                    ${answers.map((ans, i) => `
                        <div class="qt-option" data-idx="${i + 1}">
                            <span class="qt-num">${i + 1}</span>
                            <span class="qt-option-text">${ans}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="qt-health">
                <img class="qt-status-bar" src="${extensionFolderPath}/assets/classtrial/status-bar.png" alt="" draggable="false"/>
                <div class="qt-hp-gauge">
                    <div class="qt-hp-bg"></div>
                    <div class="qt-hp-fg-wrap"><div class="qt-hp-fg"></div></div>
                </div>
                <div class="qt-stars-gauge">
                    <div class="qt-stars-bg"></div>
                </div>
            </div>
            <div id="qt-timer">00:${String(Math.floor(time)).padStart(2,'0')}:000</div>`;

        document.body.appendChild(overlay);
        requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add("qt-on")));

        // Apply the NSD heart + star SVG masks once the gauge elements are
        // in the DOM, then seed the gauge at full HP.
        for (const sel of ['.qt-hp-bg', '.qt-hp-fg']) {
            const el = overlay.querySelector(sel);
            if (!el) continue;
            el.style.webkitMaskImage = heartsMaskUrl;
            el.style.maskImage       = heartsMaskUrl;
        }
        const starsBgEl = overlay.querySelector('.qt-stars-bg');
        if (starsBgEl) {
            starsBgEl.style.webkitMaskImage = starsMaskUrl;
            starsBgEl.style.maskImage       = starsMaskUrl;
        }
        const hpGaugeEl = overlay.querySelector('.qt-hp-gauge');
        if (hpGaugeEl) hpGaugeEl.style.setProperty('--gauge-pct', `${healthPct()}%`);

        // ── ANSWER heading: random neon → grey flicker per letter ────────
        // Each span is scheduled independently. When fired, the letter
        // snaps to the grey state (.qta-flicker) for 60–140 ms before
        // returning to its base neon colour.  Idle gap is 300–2200 ms so
        // the heading rarely flickers more than one or two letters at once
        // but every letter still gets hit over time.  Stops rescheduling
        // when the overlay is no longer in the DOM.
        const headingSpans = overlay.querySelectorAll('.qt-answer-heading > span');
        function scheduleFlicker(span) {
            const idleGap = 300 + Math.random() * 1900;
            setTimeout(() => {
                if (!span.isConnected) return;
                span.classList.add('qta-flicker');
                const onTime = 60 + Math.random() * 80;
                setTimeout(() => {
                    if (!span.isConnected) return;
                    span.classList.remove('qta-flicker');
                    scheduleFlicker(span);
                }, onTime);
            }, idleGap);
        }
        headingSpans.forEach(scheduleFlicker);

        const totalMs   = time * 1000;
        let startTs  = null;
        let rafId    = null;
        let resolved = false;

        return new Promise(resolve => {

            function triggerIncorrectEffects() {
                deductMonocoins?.(5, "question time wrong answer");
                const wrongAudio = new Audio(`${extensionFolderPath}/assets/monokuma/incorrect-answer.wav`);

                // Flash + shake + damage theme all at once
                document.body.classList.add("qt-shaking");
                const flashEl = document.createElement("div");
                flashEl.id = "qt-damage-flash";
                document.body.appendChild(flashEl);
                document.body.classList.remove("dangan-theme-daily","dangan-theme-night","dangan-theme-investigation","dangan-theme-damaged");
                document.body.classList.add("dangan-theme-damaged");
                setTimeout(() => flashEl.remove(), 200);

                function cleanupWrong() {
                    document.body.classList.remove("qt-shaking");
                    document.getElementById(QT_STYLE)?.remove();
                    document.body.classList.add("dangan-recovering");
                    document.body.classList.remove("dangan-theme-damaged");
                    restoreTheme?.();
                    setTimeout(() => document.body.classList.remove("dangan-recovering"), 1500);
                }

                wrongAudio.addEventListener("loadedmetadata", () => {
                    const stopShakeAt = Math.max(0, (wrongAudio.duration - 0.5) * 1000);
                    setTimeout(() => document.body.classList.remove("qt-shaking"), stopShakeAt);
                });
                wrongAudio.addEventListener("ended", cleanupWrong);
                wrongAudio.play().catch(cleanupWrong);
            }

            function tick(ts) {
                if (!startTs) startTs = ts;
                const elapsed   = ts - startTs;
                const remaining = Math.max(0, totalMs - elapsed);
                const frac      = Math.min(1, elapsed / totalMs);

                updateTimer(remaining);
                updateHourglass(frac);

                if (remaining <= 0) {
                    if (!resolved) {
                        resolved = true;
                        document.removeEventListener("keydown", onKey);
                        dismiss();
                        triggerIncorrectEffects();
                        resolve(null);
                    }
                    return;
                }
                rafId = requestAnimationFrame(tick);
            }

            rafId = requestAnimationFrame(tick);

            const optionEls = [...overlay.querySelectorAll(".qt-option")];
            const numOptions = optionEls.length;
            let focusedIdx = 0; // 0-based index into optionEls

            function setFocus(i, dir = 1) {
                let next = ((i % numOptions) + numOptions) % numOptions;
                for (let t = 0; t < numOptions; t++) {
                    if (!optionEls[next].classList.contains("qt-wrong")) break;
                    next = ((next + dir) % numOptions + numOptions) % numOptions;
                }
                optionEls.forEach(el => el.classList.remove("qt-focused"));
                focusedIdx = next;
                optionEls[focusedIdx].classList.add("qt-focused");
            }

            function updateHealthDisplay() {
                const gauge = overlay.querySelector('.qt-hp-gauge');
                if (gauge) gauge.style.setProperty('--gauge-pct', `${healthPct()}%`);
            }

            function triggerDamage() {
                deductMonocoins?.(5, "question time wrong answer");
                const flashEl = document.createElement("div");
                flashEl.id = "qt-damage-flash";
                document.body.appendChild(flashEl);
                document.body.classList.add("qt-shaking");
                setTimeout(() => flashEl.remove(), 200);
                setTimeout(() => document.body.classList.remove("qt-shaking"), 350);
                new Audio(`${extensionFolderPath}/assets/monokuma/incorrect-answer.wav`).play().catch(() => {});
            }

            function selectOption(idx) { // 1-based
                if (resolved) return;
                const optEl = optionEls.find(e => Number(e.dataset.idx) === idx);
                if (optEl?.classList.contains("qt-wrong")) return;
                if (idx === correct) {
                    resolved = true;
                    cancelAnimationFrame(rafId);
                    document.removeEventListener("keydown", onKey);
                    dismiss();
                    awardMonocoins?.(5, "question time correct answer");
                    showGotItBanner().then(() => resolve(true));
                } else {
                    optEl?.classList.add("qt-wrong");
                    health--;
                    updateHealthDisplay();
                    if (health <= 0) {
                        resolved = true;
                        cancelAnimationFrame(rafId);
                        document.removeEventListener("keydown", onKey);
                        dismiss();
                        triggerIncorrectEffects();
                        resolve(false);
                    } else {
                        triggerDamage();
                        setFocus(focusedIdx + 1, 1);
                    }
                }
            }

            function playHover() { const a = new Audio(hoverSfx); a.play().catch(() => {}); }
            function playClick() { const a = new Audio(clickSfx); a.play().catch(() => {}); }

            function onKey(e) {
                if (resolved) return;
                switch (e.key) {
                    case "ArrowUp":
                        e.preventDefault();
                        setFocus(focusedIdx - 1, -1);
                        playHover();
                        break;
                    case "ArrowDown":
                        e.preventDefault();
                        setFocus(focusedIdx + 1, 1);
                        playHover();
                        break;
                    case "Enter":
                        e.preventDefault();
                        playClick();
                        selectOption(Number(optionEls[focusedIdx].dataset.idx));
                        break;
                    case "1": case "2": case "3": case "4": {
                        const n = Number(e.key);
                        if (n >= 1 && n <= numOptions && !optionEls[n - 1].classList.contains("qt-wrong")) { playClick(); selectOption(n); }
                        break;
                    }
                }
            }

            const hoverSfx = `${extensionFolderPath}/assets/sfx/ui/sfx_hover.mp3`;
            const clickSfx = `${extensionFolderPath}/assets/sfx/ui/sfx_click.mp3`;

            setFocus(0);
            document.addEventListener("keydown", onKey);

            optionEls.forEach(el => {
                el.addEventListener("mouseenter", () => playHover());
                el.addEventListener("click", () => { playClick(); selectOption(Number(el.dataset.idx)); });
            });
        });
    }

    function updateTimer(ms) {
        const el = document.getElementById("qt-timer");
        if (!el) return;
        const mins  = Math.floor(ms / 60000);
        const secs  = Math.floor((ms % 60000) / 1000);
        const millis = Math.floor(ms % 1000);
        el.textContent =
            String(mins).padStart(2,'0') + ':' +
            String(secs).padStart(2,'0') + ':' +
            String(millis).padStart(3,'0');
        el.classList.toggle("qt-urgent", ms < 10000);
    }

    function updateHourglass(frac) {
        // frac 0→1: top drains, bottom fills
        const top = document.getElementById("qt-sand-top");
        const bot = document.getElementById("qt-sand-bot");
        if (top) {
            // Rect descends inside clip: y rises from 12 to 72
            const y = 12 + frac * 60;
            const h = Math.max(0, 72 - y);
            top.setAttribute("y", y.toFixed(1));
            top.setAttribute("height", h.toFixed(1));
        }
        if (bot) {
            // Rect grows upward inside clip: y descends from 148 to 88
            const fillH = frac * 60;
            bot.setAttribute("y",      (148 - fillH).toFixed(1));
            bot.setAttribute("height", fillH.toFixed(1));
        }
    }

    function dismiss() {
        const el = document.getElementById(QT_ID);
        if (!el) return;
        el.style.transition = "opacity 250ms ease";
        el.style.opacity    = "0";
        setTimeout(() => { el.remove(); }, 270);
    }

    async function showGotItBanner() {
        const correctAudio = new Audio(`${extensionFolderPath}/assets/monokuma/question-answered-correctly.wav`);
        correctAudio.play().catch(() => {});

        // Prefill the banner area with black expanding from the centre
        document.getElementById("dangan-qt-prefill")?.remove();
        const prefill = document.createElement("div");
        prefill.id = "dangan-qt-prefill";
        document.body.appendChild(prefill);
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        prefill.style.transform = "scaleX(1)";
        await new Promise(r => setTimeout(r, 55));

        document.getElementById("dangan-qt-banner")?.remove();
        document.body.insertAdjacentHTML("beforeend", buildBanner(extensionFolderPath));
        const banner = document.getElementById("dangan-qt-banner");
        const inner  = document.getElementById("dangan-qt-banner-inner");

        // Player approval sprite overlay
        if (typeof getPlayerSpriteUrl === 'function') {
            const spriteUrl = await getPlayerSpriteUrl('approval');
            if (spriteUrl) {
                const spriteEl = document.createElement('img');
                spriteEl.src = spriteUrl;
                spriteEl.alt = '';
                spriteEl.style.cssText = 'position:absolute;bottom:-1370px;left:70%;transform:translateX(-50%);height:650%;width:auto;object-fit:contain;object-position:center bottom;pointer-events:none;filter:drop-shadow(rgb(255,255,255) 0px 0px 50px);';
                inner.appendChild(spriteEl);
            }
        }

        // Two-frame delay so the initial `left: 100%` is painted before we transition
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

        // Slide inner content in from right to covering full width
        inner.style.transition = "left 0.325s cubic-bezier(0.22, 0.61, 0.36, 1)";
        inner.style.left       = "0%";

        // Wait for slide to complete, then linger for 3 seconds
        await new Promise(r => setTimeout(r, 350));

        // ── Debug freeze (TEMPORARY) ──────────────────────────────────
        // Pause here instead of lingering / fading out so the Got It!
        // banner stays on-screen for styling.  Pointer-events flip to
        // `auto` and the wrap accepts a single click to dismiss; flip
        // DEBUG_FREEZE_GOT_IT_BANNER to `false` to restore normal playback.
        const DEBUG_FREEZE_GOT_IT_BANNER = true;
        if (DEBUG_FREEZE_GOT_IT_BANNER) {
            banner.setAttribute('data-frozen', '1');
            banner.style.pointerEvents = 'auto';
            banner.style.cursor        = 'pointer';
            await new Promise(resolveClick => {
                banner.addEventListener('click', () => resolveClick(), { once: true });
            });
        } else {
            await new Promise(r => setTimeout(r, 3000));
        }

        // Fade out
        banner.style.transition = "opacity 0.5s ease";
        banner.style.opacity = "0";
        prefill.style.transition = "opacity 0.5s ease";
        prefill.style.opacity = "0";

        await new Promise(r => setTimeout(r, 520));
        banner.remove();
        prefill.remove();
        document.getElementById(QT_STYLE)?.remove();
    }

    return { run };
}
