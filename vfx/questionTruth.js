const QTT_ID    = "dangan-qtt-overlay";
const QTT_STYLE = "dangan-qtt-style";

function ensureNotoSansJP() {
    if (!document.querySelector('link[href*="Noto+Sans+JP"]')) {
        const link = document.createElement("link");
        link.rel  = "stylesheet";
        link.href = "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap";
        document.head.appendChild(link);
    }
}

function buildStyles({ extensionFolderPath = '' } = {}) {
    const panelImg = `${extensionFolderPath}/assets/images/minigames/aa-panel.png`;
    return `
    #${QTT_ID} {
        position: fixed;
        inset: 0;
        z-index: 2147483645;
        background: rgba(0, 0, 10, 0.92);
        display: flex; flex-direction: column;
        font-family: "Orbitron", "Arial", sans-serif;
        color: #fff;
        opacity: 0; transition: opacity 280ms ease;
        pointer-events: none;
        overflow: hidden;
    }
    #${QTT_ID}.qtt-on { opacity: 1; pointer-events: auto; }

    /* CRT scanlines */
    #${QTT_ID}::before {
        content: "";
        position: absolute; inset: 0;
        background: repeating-linear-gradient(
            0deg, transparent 0px, transparent 3px,
            rgba(80, 0, 100, 0.04) 3px, rgba(80, 0, 100, 0.04) 4px
        );
        pointer-events: none; z-index: 0;
    }

    /* Neon top/bottom border pulse */
    #${QTT_ID}::after {
        content: "";
        position: absolute; inset: 0;
        background:
            linear-gradient(90deg, transparent, #ff00ff, #aa00ff, #ff00ff, transparent) top    / 100% 2px no-repeat,
            linear-gradient(90deg, transparent, #ff00ff, #aa00ff, #ff00ff, transparent) bottom / 100% 2px no-repeat;
        pointer-events: none; z-index: 3;
        animation: qttBorderPulse 2s ease-in-out infinite;
    }
    @keyframes qttBorderPulse {
        0%, 100% {
            box-shadow:
                0 -1px 14px rgba(255,0,255,0.5), 0 -1px 30px rgba(180,0,255,0.3),
                0  1px 14px rgba(255,0,255,0.5), 0  1px 30px rgba(180,0,255,0.3);
            opacity: 0.8;
        }
        50% {
            box-shadow:
                0 -1px 26px rgba(255,0,255,0.9), 0 -1px 55px rgba(180,0,255,0.7),
                0  1px 26px rgba(255,0,255,0.9), 0  1px 55px rgba(180,0,255,0.7);
            opacity: 1;
        }
    }

    /* Timer panel — bottom-right, framed by panel.png (mirrored + flipped
     * so the decorative corner artwork points inward). */
    #qtt-timer-area {
        position: absolute;
        bottom: 16px; right: 16px;
        width: 280px;
        padding: 38px 38px;
        z-index: 6;
        pointer-events: none;
    }
    #qtt-timer-area::before {
        content: "";
        position: absolute;
        inset: 0;
        background-image: url("${panelImg}");
        background-size: 100% 100%;
        background-repeat: no-repeat;
        transform: scale(-1, -1);
        transform-origin: center;
        pointer-events: none;
        z-index: -1;
    }
    #qtt-timer-label {
        font-family: "Orbitron", "Impact", monospace;
        font-size: 11px;
        letter-spacing: 3px;
        color: rgba(255, 180, 100, 0.7);
        margin-bottom: 4px;
    }
    #qtt-timer {
        font-family: "Orbitron", "Courier New", ui-monospace, monospace;
        font-size: 28px;
        font-weight: 700;
        letter-spacing: 3px;
        color: #ffaa00;
        text-shadow: 0 0 12px #ff8800, 0 0 3px #ffcc00;
        font-variant-numeric: tabular-nums;
        font-feature-settings: "tnum" 1;
        text-align: left;
        line-height: 1;
        white-space: nowrap;
    }
    #qtt-timer.qtt-urgent {
        color: #ff3300;
        text-shadow: 0 0 14px #ff0000, 0 0 3px #ff5500;
        animation: qttBlink 0.45s ease-in-out infinite;
    }
    @keyframes qttBlink { 0%,100%{opacity:1;} 50%{opacity:0.4;} }

    /* Body: two columns */
    .qtt-body {
        position: relative; z-index: 1;
        flex: 1; display: flex; min-height: 0;
    }

    /* ---- LEFT PANEL ---- */
    .qtt-list-panel {
        width: clamp(180px, 30%, 340px);
        display: flex; flex-direction: column;
        border-right: 2px solid rgba(255, 0, 255, 0.35);
        background: rgba(0, 0, 20, 0.55);
        flex-shrink: 0;
    }
    .qtt-list-header {
        padding: clamp(8px, 1.4vh, 14px) 16px;
        font-size: clamp(9px, 1.3vh, 13px);
        letter-spacing: 0.14em;
        color: rgba(255, 80, 255, 0.85);
        border-bottom: 1px solid rgba(255, 0, 255, 0.2);
        text-shadow: 0 0 8px rgba(255, 0, 255, 0.6);
        flex-shrink: 0;
        display: flex; align-items: center; gap: 8px;
    }
    .qtt-list-header-icon {
        width: 18px; height: 18px;
        object-fit: contain;
        filter: brightness(0) invert(1) sepia(1) hue-rotate(268deg) saturate(12) brightness(0.85) opacity(0.85);
        flex-shrink: 0;
    }
    .qtt-list-items {
        flex: 1; overflow-y: auto;
        padding: 6px 8px;
        scroll-behavior: smooth;
    }
    .qtt-list-items::-webkit-scrollbar { width: 3px; }
    .qtt-list-items::-webkit-scrollbar-thumb {
        background: rgba(255, 0, 255, 0.4); border-radius: 2px;
    }
    .qtt-bullet-icon {
        width: 20px; height: 20px;
        object-fit: contain;
        filter: brightness(0) invert(1) opacity(0.75) sepia(1) hue-rotate(240deg) saturate(4);
        flex-shrink: 0;
    }
    .qtt-bullet-item {
        display: flex; align-items: center; gap: 8px;
        padding: clamp(5px, 1vh, 10px) 12px;
        margin-bottom: 3px;
        cursor: pointer;
        font-size: clamp(11px, 1.55vh, 15px);
        letter-spacing: 0.06em;
        background: rgba(255, 255, 255, 0.04);
        border-left: 3px solid transparent;
        transition: background 0.1s ease, border-color 0.1s ease, transform 0.1s ease;
        line-height: 1.3;
    }
    .qtt-bullet-item:hover,
    .qtt-bullet-item.qtt-focused {
        background: rgba(255, 0, 255, 0.12);
        border-left-color: rgba(255, 0, 255, 0.9);
        transform: translateX(3px);
    }
    .qtt-bullet-item.qtt-focused {
        background: rgba(255, 0, 255, 0.18);
        text-shadow: 0 0 8px rgba(255, 100, 255, 0.5);
    }
    .qtt-empty {
        opacity: 0.35; font-size: clamp(10px, 1.4vh, 13px);
        text-align: center; margin-top: 24px; letter-spacing: 0.1em;
    }

    /* ---- RIGHT PANEL ---- */
    .qtt-right-panel {
        flex: 1; display: flex; flex-direction: column; min-width: 0;
    }

    /* Question section.  Right padding reserves ~340 px for the status bar
     * (320 px wide + 10 px right inset + small gap) so the title wraps
     * before it can pass beneath it.  min-height is exactly two lines of
     * question text + the vertical padding, so the section is the same
     * height whether the question is one line or two. */
    .qtt-question-section {
        padding: clamp(14px, 2.8vh, 36px) clamp(340px, 32vw, 360px) clamp(14px, 2.8vh, 36px) clamp(20px, 4vw, 60px);
        border-bottom: 2px solid rgba(255, 255, 255, 0.12);
        flex-shrink: 0;
        box-sizing: border-box;
        min-height: calc(clamp(14px, 2.6vh, 32px) * 1.45 * 2 + clamp(14px, 2.8vh, 36px) * 2);
    }
    .qtt-question-text {
        font-size: clamp(14px, 2.6vh, 32px);
        font-weight: 400;
        font-family: "Quickend", "Boldonse", "Orbitron", "Rajdhani", monospace;
        color: rgba(255, 255, 255, 0.95);
        line-height: 1.45;
        letter-spacing: 0.01em;
    }

    /* Hint button — sits beneath the question text, left-aligned. Reveals
     * the answer as "A-b" (uppercase first letter, lowercase last) on click. */
    .qtt-hint-btn {
        display: inline-block;
        margin-top: clamp(10px, 1.6vh, 18px);
        padding: 6px 16px;
        font-family: "Quickend", "Boldonse", "Orbitron", "Rajdhani", monospace;
        font-size: clamp(11px, 1.4vh, 14px);
        letter-spacing: 3px;
        color: #ffcc00;
        background: rgba(40, 20, 0, 0.7);
        border: 1px solid rgba(255, 200, 0, 0.6);
        border-radius: 4px;
        text-shadow: 0 0 10px rgba(255, 200, 0, 0.55);
        box-shadow: 0 0 14px rgba(255, 180, 0, 0.25);
        cursor: pointer;
        pointer-events: auto;
        transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
    }
    .qtt-hint-btn:hover {
        background: rgba(70, 35, 0, 0.85);
        border-color: rgba(255, 220, 80, 0.95);
        color: #ffe080;
    }
    .qtt-hint-btn[disabled] {
        cursor: default;
        opacity: 0.85;
    }
    .qtt-hint-display {
        display: inline-block;
        margin-top: clamp(10px, 1.6vh, 18px);
        padding: 6px 16px;
        font-family: "Quickend", "Boldonse", "Orbitron", "Rajdhani", monospace;
        font-size: clamp(11px, 1.4vh, 14px);
        letter-spacing: 6px;
        font-weight: 700;
        color: #ffcc00;
        text-shadow: 0 0 12px rgba(255, 200, 0, 0.75);
    }
    /* Decoy X-letters flanking the revealed hint — gray, no glow. */
    .qtt-hint-x {
        color: #888888;
        text-shadow: none;
    }

    /* Detail section */
    .qtt-detail-section {
        flex: 1; padding: clamp(12px, 2.2vh, 28px) clamp(20px, 4vw, 60px);
        overflow-y: auto; display: flex; flex-direction: row;
        align-items: flex-start; gap: clamp(20px, 3vw, 50px);
    }
    .qtt-detail-text {
        flex: 1; min-width: 0; display: flex; flex-direction: column;
    }
    .qtt-detail-placeholder {
        opacity: 0.28; font-size: clamp(11px, 1.6vh, 16px);
        letter-spacing: 0.12em; margin-top: 16px; text-align: center;
    }
    .qtt-detail-title {
        font-size: clamp(16px, 3.2vh, 38px);
        font-weight: 700;
        font-family: "Noto Sans JP", sans-serif;
        text-align: left;
        margin-bottom: clamp(10px, 1.8vh, 22px);
        color: #fff;
        text-shadow: 0 0 20px rgba(255, 0, 255, 0.5);
    }
    .qtt-detail-description {
        font-size: clamp(12px, 1.7vh, 18px);
        font-family: "Noto Sans JP", sans-serif;
        line-height: 1.65; color: rgba(255, 255, 255, 0.82);
        letter-spacing: 0.01em;
    }
    .qtt-detail-image {
        width: clamp(360px, 54vw, 780px);
        flex-shrink: 0;
        align-self: flex-start;
        object-fit: contain;
        border-radius: 64px;
        border: 1px solid rgba(255, 0, 255, 0.3);
        box-shadow: 0 0 16px rgba(255, 0, 255, 0.25);
        transform: skewX(4deg) skewY(8deg);
        transform-origin: top left;
    }

    /* Shared damage flash */
    #qtt-damage-flash {
        position: fixed; inset: 0;
        z-index: 2147483646;
        pointer-events: none;
        background: rgba(220, 0, 0, 0.55);
        animation: qttDamageFlash 0.2s ease-out forwards;
    }
    @keyframes qttDamageFlash {
        0%   { opacity: 0; }
        20%  { opacity: 1; }
        100% { opacity: 0; }
    }

    /* Got It banner prefill */
    #dangan-qtt-prefill {
        position: fixed;
        top: 33.33%; left: 0; right: 0; height: 33.34%;
        z-index: 2147483646;
        background: #000;
        pointer-events: none;
        transform: scaleX(0);
        transform-origin: center;
        transition: transform 0.045s ease-out;
    }

    /* Got It banner */
    #dangan-qtt-banner {
        position: fixed;
        top: 33.33%; height: 33.34%;
        left: 0; right: 0;
        z-index: 2147483647;
        pointer-events: none;
        overflow: visible;
        opacity: 1; transition: opacity 0.5s ease;
        border-top: 6px solid #000;
        border-bottom: 6px solid #000;
        animation: qttBannerShadowPulse 1.2s ease-in-out infinite;
    }
    @keyframes qttBannerShadowPulse {
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
    #dangan-qtt-banner-inner {
        position: absolute; top: 0; bottom: 0;
        left: 100%; width: 100%;
        display: flex; align-items: center; justify-content: center;
        overflow: hidden;
        transition: left 0.325s cubic-bezier(0.22, 0.61, 0.36, 1);
    }
    .qtt-banner-img {
        width: 100%; height: 100%;
        object-fit: cover; object-position: center;
        display: block;
    }

    /* Revolver cylinder decoration — wrapper takes the position so the
       ring-line overlays (siblings of .qtt-revolver) share the same box. */
    .qtt-revolver-wrap {
        position: absolute;
        bottom: -6%;
        left: -4%;
        width: clamp(280px, 38vw, 560px);
        aspect-ratio: 1;
        pointer-events: none;
        z-index: 0;
        filter:
            sepia(1) hue-rotate(285deg) saturate(6) brightness(1.2)
            drop-shadow(0 0 18px rgba(255, 0, 200, 0.75))
            drop-shadow(0 0 45px rgba(255, 0, 200, 0.45));
        opacity: 0.88;
    }
    .qtt-revolver {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: contain;
        pointer-events: none;
        transform-origin: center;
    }

    /* Health display — NSD-style: a status-bar.png graphic in the top-right
     * with SVG-masked hearts (pink, drains right→left) overlaid above it,
     * and an all-black stars silhouette below the hearts. */
    .qtt-health {
        position: absolute;
        top: 10px;
        right: 10px;
        width: clamp(320px, 30vw, 320px);
        aspect-ratio: 770 / 442;
        pointer-events: none;
        z-index: 5;
    }
    .qtt-status-bar {
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
    .qtt-hp-gauge,
    .qtt-stars-gauge {
        position: absolute;
        pointer-events: none;
        z-index: 2;
    }
    /* Hearts + stars positions mirror NSD viewport-pixel offsets, converted
     * to percentages of the 320 × ~183.6 status-bar bounding box.
     *   NSD status-bar: top:10  right:10 width:320
     *   NSD hearts    : top:37  right:16 width:230
     *     → top  = (37  − 10) / 183.6 ≈ 14.7%
     *       right = (16  − 10) / 320  ≈  1.875%
     *       width = 230 / 320         =  71.875%
     *   NSD stars     : top:110 right:46 width:200
     *     → top  = (110 − 10) / 183.6 ≈ 54.5%
     *       right = (46  − 10) / 320  =  11.25%
     *       width = 200 / 320         =  62.5% */
    .qtt-hp-gauge {
        top: 14.7%;
        right: 1.875%;
        width: 71.875%;
        aspect-ratio: 420.62 / 162.12;
    }
    .qtt-stars-gauge {
        top: 54.5%;
        right: 11.25%;
        width: 62.5%;
        aspect-ratio: 831.39 / 183.14;
    }

    .qtt-hp-bg, .qtt-hp-fg-wrap, .qtt-hp-fg,
    .qtt-stars-bg {
        position: absolute;
        inset: 0;
    }
    .qtt-hp-bg, .qtt-hp-fg,
    .qtt-stars-bg {
        -webkit-mask-repeat: no-repeat;
                mask-repeat: no-repeat;
        -webkit-mask-position: center;
                mask-position: center;
        -webkit-mask-size: contain;
                mask-size: contain;
    }
    .qtt-hp-bg     { background: #000; }
    .qtt-hp-fg-wrap {
        filter:
            drop-shadow(0 0 6px  rgba(255,  55, 196, 0.9))
            drop-shadow(0 0 14px rgba(255,  55, 196, 0.55));
        transition: filter 0.18s ease;
    }
    .qtt-hp-fg     {
        background: #ff37c4;
        clip-path: inset(0 calc(100% - var(--gauge-pct, 100%)) 0 0);
        transition: clip-path 180ms ease;
    }
    /* Stars row: silhouette only — never glows or fills with colour. */
    .qtt-stars-bg  { background: #000; }

    body.qtt-shaking { animation: qttScreenShake 80ms steps(2, end) infinite; }
    @keyframes qttScreenShake {
        0%   { translate: 0px 0px; }
        15%  { translate: -6px  3px; }
        30%  { translate:  5px -4px; }
        50%  { translate: -4px  2px; }
        70%  { translate:  6px -3px; }
        85%  { translate: -5px  4px; }
        100% { translate:  0px  0px; }
    }
    body.qtt-shaking #qtt-timer {
        animation: qttTimerStatic 80ms steps(2, end) infinite;
    }
    @keyframes qttTimerStatic {
        0%   { translate:  0px  0px; }
        15%  { translate:  6px -3px; }
        30%  { translate: -5px  4px; }
        50%  { translate:  4px -2px; }
        70%  { translate: -6px  3px; }
        85%  { translate:  5px -4px; }
        100% { translate:  0px  0px; }
    }
    `;
}

function buildBannerHtml(extensionFolderPath) {
    return `<div id="dangan-qtt-banner">
        <div id="dangan-qtt-banner-inner">
            <img class="qtt-banner-img" src="${extensionFolderPath}/assets/images/minigames/got-it-banner.png" alt="Got It"/>
        </div>
    </div>`;
}

export function createQuestionTruthController({ extensionFolderPath = '', getTruthBullets = null, awardMonocoins = null, deductMonocoins = null, restoreTheme = null, getPlayerSpriteUrl = null } = {}) {

    function destroy() {
        document.getElementById(QTT_ID)?.remove();
        document.getElementById(QTT_STYLE)?.remove();
        document.getElementById("dangan-qtt-banner")?.remove();
    }

    async function showGotItBanner() {
        const correctAudio = new Audio(`${extensionFolderPath}/assets/monokuma/question-answered-correctly.wav`);
        correctAudio.play().catch(() => {});

        // Prefill the banner area with black expanding from the centre
        document.getElementById("dangan-qtt-prefill")?.remove();
        const prefill = document.createElement("div");
        prefill.id = "dangan-qtt-prefill";
        document.body.appendChild(prefill);
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        prefill.style.transform = "scaleX(1)";
        await new Promise(r => setTimeout(r, 55));

        document.getElementById("dangan-qtt-banner")?.remove();
        document.body.insertAdjacentHTML("beforeend", buildBannerHtml(extensionFolderPath));
        const banner = document.getElementById("dangan-qtt-banner");
        const inner  = document.getElementById("dangan-qtt-banner-inner");

        // Player approval sprite overlay
        if (typeof getPlayerSpriteUrl === 'function') {
            const spriteUrl = await getPlayerSpriteUrl('approval');
            if (spriteUrl) {
                const spriteEl = document.createElement('img');
                spriteEl.src = spriteUrl;
                spriteEl.alt = '';
                spriteEl.style.cssText = 'position:absolute;bottom:-1475px;left:70%;transform:translateX(-50%);height:650%;width:auto;object-fit:contain;object-position:center bottom;pointer-events:none;filter:drop-shadow(rgb(255,255,255) 0px 0px 50px);';
                inner.appendChild(spriteEl);
            }
        }

        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        inner.style.left = "0%";

        await new Promise(r => setTimeout(r, 350));

        await new Promise(r => setTimeout(r, 3000));

        banner.style.opacity = "0";
        prefill.style.transition = "opacity 0.5s ease";
        prefill.style.opacity = "0";
        await new Promise(r => setTimeout(r, 520));
        banner.remove();
        prefill.remove();
        document.getElementById(QTT_STYLE)?.remove();
    }

    async function run({ question, answer, time = 0 }) {
        destroy();
        ensureNotoSansJP();

        const bullets = getTruthBullets?.() ?? [];

        const styleEl = document.createElement("style");
        styleEl.id = QTT_STYLE;
        styleEl.textContent = buildStyles({ extensionFolderPath });
        document.head.appendChild(styleEl);

        const hasTimer = time > 0;
        const totalMs  = time * 1000;

        const MAX_HEALTH = 5;
        let health = MAX_HEALTH;
        const heartsMaskUrl = `url("${extensionFolderPath}/assets/classtrial/hearts.svg")`;
        const starsMaskUrl  = `url("${extensionFolderPath}/assets/classtrial/stars.svg")`;
        // NSD hearts svg has 3 hearts; for our 5-HP scale we just map the ratio
        // directly onto the clip-path percentage.
        const healthPct = () => Math.max(0, Math.min(100, (health / MAX_HEALTH) * 100));
        const healthHTML = `
            <img class="qtt-status-bar" src="${extensionFolderPath}/assets/classtrial/status-bar.png" alt="" draggable="false"/>
            <div class="qtt-hp-gauge">
                <div class="qtt-hp-bg"></div>
                <div class="qtt-hp-fg-wrap"><div class="qtt-hp-fg"></div></div>
            </div>
            <div class="qtt-stars-gauge">
                <div class="qtt-stars-bg"></div>
            </div>
        `;

        const overlay = document.createElement("div");
        overlay.id = QTT_ID;
        overlay.innerHTML = `
            <div class="qtt-revolver-wrap">
                <img class="dangan-cyl-line dangan-cyl-line--1" src="${extensionFolderPath}/assets/images/minigames/cylinder-lines-1.webp" alt=""/>
                <img class="dangan-cyl-line dangan-cyl-line--4" src="${extensionFolderPath}/assets/images/minigames/cylinder-lines-4.webp" alt=""/>
                <img class="dangan-cyl-line dangan-cyl-line--2" src="${extensionFolderPath}/assets/images/minigames/cylinder-lines-2.webp" alt=""/>
                <img class="dangan-cyl-line dangan-cyl-line--3" src="${extensionFolderPath}/assets/images/minigames/cylinder-lines-3.webp" alt=""/>
                <img class="qtt-revolver" src="${extensionFolderPath}/assets/images/minigames/danganronpa-2x2-revolver-cylinder.webp" alt=""/>
            </div>
            ${hasTimer ? `
                <div id="qtt-timer-area">
                    <div id="qtt-timer-label">TIME</div>
                    <div id="qtt-timer">00:${String(Math.floor(time)).padStart(2,'0')}:000</div>
                </div>
            ` : ''}
            <div class="qtt-health">${healthHTML}</div>
            <div class="qtt-body">
                <div class="qtt-list-panel">
                    <div class="qtt-list-header">
                        <img class="qtt-list-header-icon" src="${extensionFolderPath}/assets/icons/bullets.svg" alt=""/>
                        TRUTH BULLETS
                    </div>
                    <div class="qtt-list-items">
                        ${bullets.length
                            ? bullets.map((b, i) => `<div class="qtt-bullet-item" data-idx="${i}"><img class="qtt-bullet-icon" src="${extensionFolderPath}/assets/icons/artillery-shell.svg" alt=""/>${b.title}</div>`).join('')
                            : '<div class="qtt-empty">NO TRUTH BULLETS</div>'
                        }
                    </div>
                </div>
                <div class="qtt-right-panel">
                    <div class="qtt-question-section">
                        <div class="qtt-question-text">${question}</div>
                        <button type="button" class="qtt-hint-btn" id="qtt-hint-btn">HINT</button>
                    </div>
                    <div class="qtt-detail-section">
                        <div class="qtt-detail-placeholder">SELECT A TRUTH BULLET</div>
                    </div>
                </div>
            </div>`;

        document.body.appendChild(overlay);
        requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add("qtt-on")));

        // Apply the NSD heart + star SVG masks now that the gauge elements
        // exist in the DOM, then seed the gauge at full HP.
        for (const sel of ['.qtt-hp-bg', '.qtt-hp-fg']) {
            const el = overlay.querySelector(sel);
            if (!el) continue;
            el.style.webkitMaskImage = heartsMaskUrl;
            el.style.maskImage       = heartsMaskUrl;
        }
        const starsBgEl = overlay.querySelector('.qtt-stars-bg');
        if (starsBgEl) {
            starsBgEl.style.webkitMaskImage = starsMaskUrl;
            starsBgEl.style.maskImage       = starsMaskUrl;
        }
        const hpGaugeEl = overlay.querySelector('.qtt-hp-gauge');
        if (hpGaugeEl) hpGaugeEl.style.setProperty('--gauge-pct', `${healthPct()}%`);

        if (!bullets.length) return null;

        const hoverSfx = `${extensionFolderPath}/assets/sfx/ui/sfx_hover.mp3`;
        const clickSfx = `${extensionFolderPath}/assets/sfx/ui/sfx_click.mp3`;
        function playHover() { const a = new Audio(hoverSfx); a.play().catch(() => {}); }
        function playClick() { const a = new Audio(clickSfx); a.play().catch(() => {}); }

        let startTs  = null;
        let rafId    = null;
        let resolved = false;

        // Normalise answer for comparison
        const answerNorm = answer.trim().toLowerCase();

        // Hint button — reveals the answer as "A-b" (uppercase first letter,
        // lowercase last letter, separated by a dash). One-shot: the button
        // is replaced in place with the revealed text once clicked.
        const hintBtn = overlay.querySelector('#qtt-hint-btn');
        if (hintBtn) {
            const rawAnswer = String(answer || '').trim();
            // Strip whitespace/punctuation so we always grab actual letters
            // (e.g. "The Locked Door" → "T-r", not "T- ").
            const letters = rawAnswer.replace(/[^A-Za-z0-9]/g, '');
            if (letters.length >= 1) {
                hintBtn.addEventListener('click', () => {
                    if (resolved) return;
                    const first = letters.charAt(0).toUpperCase();
                    const last  = letters.length > 1
                        ? letters.charAt(letters.length - 1).toLowerCase()
                        : '?';
                    const display = document.createElement('span');
                    display.className = 'qtt-hint-display';

                    // Decoy X-letters flanking the revealed hint to obscure
                    // the answer's length.  Counts are randomised each click.
                    const beforeCount = 2 + Math.floor(Math.random() * 4); // 2–5
                    const afterCount  = 2 + Math.floor(Math.random() * 4); // 2–5
                    const beforeStr   = Array(beforeCount).fill('X').join('-') + '-';
                    const afterStr    = '-' + Array(afterCount).fill('X').join('-');

                    const beforeSpan = document.createElement('span');
                    beforeSpan.className = 'qtt-hint-x';
                    beforeSpan.textContent = beforeStr;

                    const afterSpan = document.createElement('span');
                    afterSpan.className = 'qtt-hint-x';
                    afterSpan.textContent = afterStr;

                    display.appendChild(beforeSpan);
                    display.appendChild(document.createTextNode(`${first}-${last}`));
                    display.appendChild(afterSpan);

                    hintBtn.replaceWith(display);
                });
            } else {
                hintBtn.disabled = true;
                hintBtn.style.opacity = '0.35';
                hintBtn.style.cursor  = 'default';
            }
        }
        function triggerIncorrectEffects() {
            deductMonocoins?.(5, "question truth wrong answer");
            const wrongAudio = new Audio(`${extensionFolderPath}/assets/monokuma/incorrect-answer.wav`);

            document.body.classList.add("qtt-shaking");
            const flashEl = document.createElement("div");
            flashEl.id = "qtt-damage-flash";
            document.body.appendChild(flashEl);
            document.body.classList.remove("dangan-theme-daily","dangan-theme-night","dangan-theme-investigation","dangan-theme-damaged");
            document.body.classList.add("dangan-theme-damaged");
            setTimeout(() => flashEl.remove(), 200);

            function cleanupWrong() {
                document.body.classList.remove("qtt-shaking");
                document.getElementById(QTT_STYLE)?.remove();
                document.body.classList.add("dangan-recovering");
                document.body.classList.remove("dangan-theme-damaged");
                restoreTheme?.();
                setTimeout(() => document.body.classList.remove("dangan-recovering"), 1500);
            }

            wrongAudio.addEventListener("loadedmetadata", () => {
                const stopShakeAt = Math.max(0, (wrongAudio.duration - 0.5) * 1000);
                setTimeout(() => document.body.classList.remove("qtt-shaking"), stopShakeAt);
            });
            wrongAudio.addEventListener("ended", cleanupWrong);
            wrongAudio.play().catch(cleanupWrong);
        }

        return new Promise(resolve => {

            const itemEls    = [...overlay.querySelectorAll(".qtt-bullet-item")];
            const detailEl   = overlay.querySelector(".qtt-detail-section");
            const revolverEl = overlay.querySelector(".qtt-revolver");
            let focusedIdx   = 0;

            // Spin loop — 20 deg/s clockwise, navigation jumps lerp smoothly
            let revolverAngle  = 0;
            let revolverTarget = 0;
            let spinRafId = null;
            const SPIN_SPEED = 20 / 60;
            const LERP = 0.1;
            function spinTick() {
                revolverTarget += SPIN_SPEED;
                revolverAngle += (revolverTarget - revolverAngle) * LERP;
                if (revolverEl) revolverEl.style.transform = `skewX(8deg) skewY(14deg) rotate(${revolverAngle}deg)`;
                spinRafId = requestAnimationFrame(spinTick);
            }
            spinRafId = requestAnimationFrame(spinTick);

            function setFocus(i, direction = 0) {
                itemEls.forEach(el => el.classList.remove("qtt-focused"));
                focusedIdx = ((i % itemEls.length) + itemEls.length) % itemEls.length;
                const el = itemEls[focusedIdx];
                el.classList.add("qtt-focused");
                el.scrollIntoView({ block: "nearest", behavior: "smooth" });

                if (direction !== 0) revolverTarget += direction * 40;

                // Update detail panel
                const bullet = bullets[focusedIdx];
                detailEl.innerHTML = `
                    <div class="qtt-detail-text">
                        <div class="qtt-detail-title">${bullet.title}</div>
                        ${bullet.description ? `<div class="qtt-detail-description">${bullet.description}</div>` : ''}
                    </div>
                    ${bullet.image ? `<img class="qtt-detail-image" src="${bullet.image}" alt="${bullet.title}"/>` : ''}`;
            }

            function dismiss() {
                const el = document.getElementById(QTT_ID);
                if (!el) return;
                el.style.transition = "opacity 250ms ease";
                el.style.opacity = "0";
                setTimeout(() => el.remove(), 270);
            }

            function updateHealthDisplay() {
                const gauge = overlay.querySelector('.qtt-hp-gauge');
                if (gauge) gauge.style.setProperty('--gauge-pct', `${healthPct()}%`);
            }

            function triggerDamage() {
                deductMonocoins?.(5, "question truth wrong answer");
                const flashEl = document.createElement("div");
                flashEl.id = "qtt-damage-flash";
                document.body.appendChild(flashEl);
                document.body.classList.add("qtt-shaking");
                setTimeout(() => flashEl.remove(), 200);
                setTimeout(() => document.body.classList.remove("qtt-shaking"), 350);
                new Audio(`${extensionFolderPath}/assets/monokuma/incorrect-answer.wav`).play().catch(() => {});
            }

            function selectCurrent() {
                if (resolved) return;
                const bullet = bullets[focusedIdx];
                const isCorrect = bullet.title.trim().toLowerCase() === answerNorm;
                if (isCorrect) {
                    resolved = true;
                    if (rafId) cancelAnimationFrame(rafId);
                    if (spinRafId) cancelAnimationFrame(spinRafId);
                    document.removeEventListener("keydown", onKey);
                    window.removeEventListener("keydown", onArrowSuppress, { capture: true });
                    dismiss();
                    awardMonocoins?.(5, "question truth correct answer");
                    showGotItBanner().then(() => resolve(true));
                } else {
                    health--;
                    updateHealthDisplay();
                    if (health <= 0) {
                        resolved = true;
                        if (rafId) cancelAnimationFrame(rafId);
                        if (spinRafId) cancelAnimationFrame(spinRafId);
                        document.removeEventListener("keydown", onKey);
                        window.removeEventListener("keydown", onArrowSuppress, { capture: true });
                        dismiss();
                        triggerIncorrectEffects();
                        resolve(false);
                    } else {
                        triggerDamage();
                    }
                }
            }

            function onKey(e) {
                if (resolved) return;
                switch (e.key) {
                    case "ArrowUp":   e.preventDefault(); setFocus(focusedIdx - 1, -1); playHover(); break;
                    case "ArrowDown": e.preventDefault(); setFocus(focusedIdx + 1,  1); playHover(); break;
                    case "Enter":     e.preventDefault(); playClick(); selectCurrent(); break;
                }
            }

            // Suppress left/right arrows entirely while Question Truth is on
            // screen — they're not used by this minigame and would otherwise
            // leak through to other listeners (trial speaker swap, NSD nav, etc.).
            // Capture-phase listener with stopImmediatePropagation so it runs
            // before any other handler can react.
            function onArrowSuppress(e) {
                if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                }
            }
            window.addEventListener("keydown", onArrowSuppress, { capture: true });

            // Timer tick
            if (hasTimer) {
                function tick(ts) {
                    if (!startTs) startTs = ts;
                    const elapsed   = ts - startTs;
                    const remaining = Math.max(0, totalMs - elapsed);

                    const timerEl = document.getElementById("qtt-timer");
                    if (timerEl) {
                        const mins   = Math.floor(remaining / 60000);
                        const secs   = Math.floor((remaining % 60000) / 1000);
                        const millis = Math.floor(remaining % 1000);
                        timerEl.textContent =
                            String(mins).padStart(2,'0') + ':' +
                            String(secs).padStart(2,'0') + ':' +
                            String(millis).padStart(3,'0');
                        timerEl.classList.toggle("qtt-urgent", remaining < 10000);
                    }

                    if (remaining <= 0) {
                        if (!resolved) {
                            resolved = true;
                            if (spinRafId) cancelAnimationFrame(spinRafId);
                            document.removeEventListener("keydown", onKey);
                            window.removeEventListener("keydown", onArrowSuppress, { capture: true });
                            dismiss();
                            triggerIncorrectEffects();
                            resolve(null);
                        }
                        return;
                    }
                    rafId = requestAnimationFrame(tick);
                }
                rafId = requestAnimationFrame(tick);
            }

            setFocus(0);
            document.addEventListener("keydown", onKey);

            itemEls.forEach(el => {
                el.addEventListener("mouseenter", () => {
                    if (resolved) return;
                    const idx = Number(el.dataset.idx);
                    if (idx !== focusedIdx) { setFocus(idx, idx > focusedIdx ? 1 : -1); playHover(); }
                });
                el.addEventListener("click", () => {
                    if (resolved) return;
                    setFocus(Number(el.dataset.idx));
                    playClick();
                    selectCurrent();
                });
            });
        });
    }

    return { run };
}
