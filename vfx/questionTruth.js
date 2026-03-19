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

function buildStyles() {
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

    /* Timer bar */
    #qtt-timer {
        position: absolute; left: 80%; top: 1.5%; z-index: 2;
        text-align: center;
        font-size: clamp(16px, 3vh, 36px);
        font-weight: 700;
        letter-spacing: 6px;
        color: #ffcc00;
        text-shadow: 0 0 12px #ffaa00, 0 0 3px #ffdd00;
        padding: clamp(6px, 1.2vh, 16px) 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        flex-shrink: 0;
    }
    #qtt-timer.qtt-urgent {
        color: #ff3300;
        text-shadow: 0 0 12px #ff0000, 0 0 3px #ff5500;
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

    /* Question section */
    .qtt-question-section {
        padding: clamp(14px, 2.8vh, 36px) clamp(20px, 4vw, 60px);
        border-bottom: 2px solid rgba(255, 255, 255, 0.12);
        flex-shrink: 0;
    }
    .qtt-question-text {
        font-size: clamp(14px, 2.6vh, 32px);
        font-weight: 400;
        font-family: "Noto Sans JP", sans-serif;
        color: rgba(255, 255, 255, 0.95);
        line-height: 1.45;
        letter-spacing: 0.01em;
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
        border-radius: 4px;
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
        overflow: hidden;
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

    /* Revolver cylinder decoration */
    .qtt-revolver {
        position: absolute;
        bottom: -6%;
        left: -4%;
        width: clamp(280px, 38vw, 560px);
        pointer-events: none;
        z-index: 0;
        transform-origin: center;
        filter:
            sepia(1) hue-rotate(285deg) saturate(6) brightness(1.2)
            drop-shadow(0 0 18px rgba(255, 0, 200, 0.75))
            drop-shadow(0 0 45px rgba(255, 0, 200, 0.45));
        opacity: 0.88;
    }

    /* Health display */
    .qtt-health {
        display: flex;
        gap: 6px;
        padding: clamp(6px, 1vh, 10px) 16px;
        border-bottom: 1px solid rgba(255, 0, 255, 0.2);
        font-size: 18px;
        flex-shrink: 0;
    }
    .qtt-heart {
        color: #ff2244;
        text-shadow: 0 0 8px rgba(255, 30, 60, 0.8), 0 0 20px rgba(255, 0, 50, 0.4);
        transition: opacity 0.2s ease, filter 0.2s ease;
    }
    .qtt-heart.qtt-heart-lost {
        opacity: 0.2;
        filter: grayscale(1);
        text-shadow: none;
    }

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
            <img class="qtt-banner-img" src="${extensionFolderPath}/assets/got-it-banner.png" alt="Got It"/>
        </div>
    </div>`;
}

export function createQuestionTruthController({ extensionFolderPath = '', getTruthBullets = null, awardMonocoins = null, deductMonocoins = null, restoreTheme = null } = {}) {

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
        styleEl.textContent = buildStyles();
        document.head.appendChild(styleEl);

        const hasTimer = time > 0;
        const totalMs  = time * 1000;

        const MAX_HEALTH = 5;
        let health = MAX_HEALTH;
        const heartHTML = '<span class="qtt-heart">❤</span>'.repeat(MAX_HEALTH);

        const overlay = document.createElement("div");
        overlay.id = QTT_ID;
        overlay.innerHTML = `
            <img class="qtt-revolver" src="${extensionFolderPath}/assets/revolver-cylinder.png" alt=""/>
            ${hasTimer ? `<div id="qtt-timer">00:${String(Math.floor(time)).padStart(2,'0')}:000</div>` : ''}
            <div class="qtt-body">
                <div class="qtt-list-panel">
                    <div class="qtt-list-header">
                        <img class="qtt-list-header-icon" src="${extensionFolderPath}/assets/bullets.svg" alt=""/>
                        TRUTH BULLETS
                    </div>
                    <div class="qtt-health">${heartHTML}</div>
                    <div class="qtt-list-items">
                        ${bullets.length
                            ? bullets.map((b, i) => `<div class="qtt-bullet-item" data-idx="${i}"><img class="qtt-bullet-icon" src="${extensionFolderPath}/assets/artillery-shell.svg" alt=""/>${b.title}</div>`).join('')
                            : '<div class="qtt-empty">NO TRUTH BULLETS</div>'
                        }
                    </div>
                </div>
                <div class="qtt-right-panel">
                    <div class="qtt-question-section">
                        <div class="qtt-question-text">${question}</div>
                    </div>
                    <div class="qtt-detail-section">
                        <div class="qtt-detail-placeholder">SELECT A TRUTH BULLET</div>
                    </div>
                </div>
            </div>`;

        document.body.appendChild(overlay);
        requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add("qtt-on")));

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
                overlay.querySelectorAll(".qtt-heart").forEach((el, i) => {
                    el.classList.toggle("qtt-heart-lost", i >= health);
                });
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
