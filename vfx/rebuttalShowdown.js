const RS_ID = "dangan-rs-overlay";
const RS_STYLE = "dangan-rs-style";

function ensureNotoSansJP() {
    if (!document.querySelector('link[href*="Noto+Sans+JP"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700;900&display=swap";
        document.head.appendChild(link);
    }
}

function escapeHtml(text) {
    return String(text ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function normalizeLabel(value) {
    return String(value || "").trim().toLowerCase();
}

function normalizeDeg(deg) {
    let value = deg;
    while (value > 180) value -= 360;
    while (value < -180) value += 360;
    return value;
}

function lerpAngleDeg(fromDeg, toDeg, t) {
    const delta = normalizeDeg(toDeg - fromDeg);
    return normalizeDeg(fromDeg + (delta * t));
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function lineIntersectsRect(x1, y1, x2, y2, left, top, width, height) {
    const right = left + width;
    const bottom = top + height;
    if (
        (x1 >= left && x1 <= right && y1 >= top && y1 <= bottom)
        || (x2 >= left && x2 <= right && y2 >= top && y2 <= bottom)
    ) return true;
    const edges = [
        [left, top, right, top],
        [right, top, right, bottom],
        [right, bottom, left, bottom],
        [left, bottom, left, top],
    ];
    return edges.some(([ax, ay, bx, by]) => segmentsIntersect(x1, y1, x2, y2, ax, ay, bx, by));
}

function segmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
    const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(den) < 1e-6) return false;
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
    const u = ((x1 - x3) * (y1 - y2) - (y1 - y3) * (x1 - x2)) / den;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

function buildStyles() {
    return `
    #${RS_ID} {
        position: fixed;
        inset: 0;
        z-index: 2147483646;
        background: radial-gradient(140% 100% at 50% 50%, rgba(18,0,35,0.96), rgba(2,0,10,0.98));
        font-family: "Noto Sans JP", "Orbitron", sans-serif;
        color: #fff;
        overflow: hidden;
        opacity: 0;
        transition: opacity 220ms ease;
        user-select: none;
    }
    #${RS_ID}.rs-on { opacity: 1; }
    #${RS_ID} * { box-sizing: border-box; }
    #${RS_ID}::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 4px);
        mix-blend-mode: screen;
        opacity: 0.55;
    }
    .rs-top {
        position: absolute;
        left: 0;
        top: 0;
        right: 0;
        height: 86px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 24px;
        background: linear-gradient(180deg, rgba(0,0,0,0.75), rgba(0,0,0,0));
        z-index: 10;
    }
    .rs-title {
        font-size: clamp(16px, 2.8vh, 34px);
        letter-spacing: 0.12em;
        font-weight: 900;
        text-shadow: 0 0 18px rgba(220,90,255,0.8);
    }
    .rs-stats {
        display: flex;
        align-items: center;
        gap: 16px;
        font-size: clamp(11px, 1.5vh, 16px);
        letter-spacing: 0.06em;
        font-weight: 700;
    }
    .rs-pill {
        border: 1px solid rgba(255,255,255,0.26);
        padding: 6px 10px;
        background: rgba(0,0,0,0.38);
        border-radius: 4px;
        min-width: 110px;
        text-align: center;
    }
    .rs-main {
        position: absolute;
        inset: 86px 0 0 0;
    }
    .rs-arena {
        position: absolute;
        inset: 0;
        overflow: hidden;
        cursor: none;
    }
    .rs-struggle {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 2px;
        background: linear-gradient(180deg, rgba(255,40,40,0), rgba(255,40,40,0.92), rgba(255,40,40,0));
        box-shadow: 0 0 14px rgba(255,40,40,0.7);
        pointer-events: none;
        z-index: 19;
    }
    .rs-line {
        position: absolute;
        left: 0;
        top: 0;
        color: #fff;
        font-size: clamp(40px, 6.2vh, 92px);
        font-weight: 900;
        letter-spacing: 0.03em;
        line-height: 1;
        white-space: nowrap;
        transform: translate3d(0,0,0);
        text-shadow: 0 0 8px rgba(255,255,255,0.85), 0 0 20px rgba(195,72,255,0.65);
        opacity: 0.98;
    }
    .rs-line.rs-cut {
        opacity: 0;
        filter: brightness(2);
        transition: opacity 140ms ease-out, filter 140ms ease-out;
    }
    .rs-line.rs-weakpoint {
        color: #ffe569;
        text-shadow: 0 0 8px rgba(255,255,255,0.98), 0 0 20px rgba(255,236,124,0.95), 0 0 34px rgba(255,205,50,0.82);
    }
    .rs-line.rs-damaged {
        color: #ffc2c2;
        text-shadow: 0 0 6px rgba(255,255,255,0.88), 0 0 16px rgba(255,120,120,0.72);
        opacity: 0.86;
        animation: rsDamagePulse 130ms ease-out;
    }
    @keyframes rsDamagePulse {
        0% { transform: translate3d(0,0,0) scale(1); }
        50% { transform: translate3d(0,0,0) scale(1.03); }
        100% { transform: translate3d(0,0,0) scale(1); }
    }
    .rs-break-shard {
        position: absolute;
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: rgba(255,245,245,0.92);
        pointer-events: none;
        z-index: 33;
        transform-origin: 50% 50%;
        animation: rsBreakShard 260ms ease-out forwards;
    }
    @keyframes rsBreakShard {
        0% { opacity: 1; transform: translate3d(0,0,0) scale(1); }
        100% { opacity: 0; transform: translate3d(var(--dx, 0px), var(--dy, 0px), 0) scale(0.6); }
    }
    .rs-duel {
        position: absolute;
        inset: 0;
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 40;
        background: rgba(0, 0, 0, 0.64);
        backdrop-filter: blur(2px);
    }
    .rs-duel.rs-show {
        display: flex;
        animation: rsDuelFlash 620ms steps(2, end) infinite;
    }
    @keyframes rsDuelFlash {
        0% { background: rgba(0, 0, 0, 0.64); }
        50% { background: rgba(122, 0, 0, 0.58); }
        100% { background: rgba(0, 0, 0, 0.64); }
    }
    .rs-duel-box {
        border: 2px solid rgba(255,120,120,0.85);
        background: rgba(20,0,0,0.72);
        padding: 18px 24px;
        width: min(520px, 82vw);
        display: grid;
        gap: 10px;
        text-align: center;
    }
    .rs-duel-title {
        font-size: clamp(20px, 3.1vh, 42px);
        font-weight: 900;
        letter-spacing: 0.1em;
        text-shadow: 0 0 15px rgba(255,40,40,0.9);
    }
    .rs-duel-sub {
        font-size: clamp(11px, 1.5vh, 16px);
        letter-spacing: 0.07em;
        color: rgba(255,255,255,0.9);
    }
    .rs-duel-meter {
        width: 100%;
        height: 12px;
        border: 1px solid rgba(255,255,255,0.35);
        background: rgba(255,255,255,0.12);
    }
    .rs-duel-fill {
        width: 0%;
        height: 100%;
        background: linear-gradient(90deg, #ff6a6a, #ffd2d2);
    }
    .rs-duel-count {
        font-size: clamp(14px, 2vh, 22px);
        font-weight: 800;
        letter-spacing: 0.08em;
    }
    .rs-cursor {
        position: absolute;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        border: 2px solid rgba(255,255,255,0.95);
        box-shadow: 0 0 14px rgba(255,255,255,0.75);
        pointer-events: none;
        z-index: 30;
        transform: translate(-50%, -50%);
    }
    .rs-blade {
        position: absolute;
        left: 0;
        top: 0;
        width: 100vw;
        height: 2px;
        border-radius: 2px;
        background: linear-gradient(90deg, rgba(95,210,255,0.2), rgba(95,210,255,0.9), rgba(255,255,255,1), rgba(95,210,255,0.9));
        box-shadow: 0 0 14px rgba(95,210,255,0.95), 0 0 34px rgba(95,210,255,0.45);
        pointer-events: none;
        z-index: 30;
        transform-origin: 0 50%;
    }
    .rs-slash {
        position: absolute;
        left: 0;
        top: 0;
        width: 100vw;
        height: 3px;
        border-radius: 2px;
        pointer-events: none;
        z-index: 29;
        opacity: 0;
        background: linear-gradient(90deg, rgba(255,255,255,0), rgba(158,240,255,0.95), rgba(255,255,255,1), rgba(158,240,255,0));
    }
    .rs-slash.rs-active {
        animation: rsSlashFx 180ms ease-out;
    }
    @keyframes rsSlashFx {
        0% { opacity: 0.95; filter: brightness(1.3); }
        100% { opacity: 0; transform: translateX(24px); filter: brightness(2); }
    }
    .rs-phase-panel {
        position: absolute;
        right: 22px;
        bottom: 18px;
        width: clamp(270px, 28vw, 430px);
        max-height: 50vh;
        border: 1px solid rgba(255,255,255,0.2);
        background: rgba(0, 0, 0, 0.5);
        z-index: 20;
        display: none;
        flex-direction: column;
    }
    .rs-phase-panel.rs-show { display: flex; }
    .rs-panel-head {
        padding: 10px 12px;
        font-size: clamp(10px, 1.3vh, 15px);
        font-weight: 700;
        letter-spacing: 0.11em;
        border-bottom: 1px solid rgba(255,255,255,0.2);
        color: rgba(255,255,255,0.92);
    }
    .rs-arg-lines {
        padding: 10px 12px;
        overflow: auto;
        display: grid;
        gap: 8px;
        max-height: 150px;
    }
    .rs-arg-line {
        font-size: clamp(10px, 1.35vh, 15px);
        color: rgba(255,255,255,0.88);
        border-left: 2px solid rgba(255,255,255,0.35);
        padding-left: 8px;
    }
    .rs-bullets {
        overflow: auto;
        display: grid;
        gap: 6px;
        padding: 10px 12px;
    }
    .rs-bullet {
        border: 1px solid rgba(255,255,255,0.2);
        background: rgba(255,255,255,0.03);
        padding: 8px 10px;
        font-size: clamp(10px, 1.35vh, 15px);
        cursor: pointer;
        transition: background 120ms ease, border-color 120ms ease;
    }
    .rs-bullet:hover {
        background: rgba(255,255,255,0.09);
    }
    .rs-bullet.rs-selected {
        border-color: rgba(130,220,255,0.95);
        background: rgba(40,140,190,0.26);
        box-shadow: inset 0 0 0 1px rgba(130,220,255,0.45);
    }
    .rs-between {
        position: absolute;
        inset: 0;
        z-index: 35;
        display: none;
        align-items: center;
        justify-content: center;
        background: rgba(0,0,0,0.74);
    }
    .rs-between.rs-show { display: flex; }
    .rs-between-card {
        width: min(720px, 88vw);
        border: 1px solid rgba(255,255,255,0.24);
        background: rgba(3,3,20,0.92);
        padding: 16px;
        display: grid;
        gap: 10px;
    }
    .rs-between-title {
        font-size: clamp(14px, 2vh, 24px);
        letter-spacing: 0.08em;
        font-weight: 800;
    }
    .rs-between-sub {
        font-size: clamp(11px, 1.4vh, 15px);
        color: rgba(255,255,255,0.78);
    }
    .rs-between-input {
        width: 100%;
        border: 1px solid rgba(255,255,255,0.26);
        background: rgba(0,0,0,0.54);
        color: #fff;
        padding: 10px;
        font-size: 14px;
        outline: none;
    }
    .rs-between-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
    }
    .rs-btn {
        border: 1px solid rgba(255,255,255,0.36);
        background: rgba(255,255,255,0.08);
        color: #fff;
        padding: 8px 12px;
        font-size: 13px;
        cursor: pointer;
    }
    .rs-btn:hover {
        background: rgba(255,255,255,0.18);
    }
    .rs-weak {
        position: absolute;
        left: 50%;
        top: 44%;
        transform: translate(-50%, -50%);
        z-index: 25;
        display: none;
        text-align: center;
    }
    .rs-weak.rs-show { display: block; }
    .rs-weak-label {
        font-size: clamp(10px, 1.2vh, 14px);
        letter-spacing: 0.14em;
        color: rgba(255,255,255,0.82);
        margin-bottom: 8px;
    }
    .rs-weak-core {
        display: inline-block;
        padding: 16px 22px;
        border: 2px solid rgba(255, 95, 95, 0.95);
        background: rgba(65, 0, 0, 0.5);
        font-size: clamp(14px, 2.2vh, 30px);
        font-weight: 900;
        letter-spacing: 0.06em;
        text-shadow: 0 0 16px rgba(255,40,40,0.95);
        box-shadow: 0 0 24px rgba(255,30,30,0.56), inset 0 0 14px rgba(255, 80, 80, 0.45);
    }
    .rs-weak-hint {
        margin-top: 10px;
        font-size: clamp(10px, 1.2vh, 14px);
        color: rgba(255,255,255,0.78);
    }
    .rs-finish-note {
        position: absolute;
        left: 24px;
        bottom: 24px;
        z-index: 21;
        font-size: clamp(11px, 1.4vh, 16px);
        letter-spacing: 0.06em;
        color: rgba(255,255,255,0.88);
        text-shadow: 0 0 12px rgba(255,255,255,0.5);
        display: none;
    }
    .rs-finish-note.rs-show { display: block; }
    .rs-cooldown {
        position: absolute;
        left: 24px;
        bottom: 52px;
        width: min(360px, 42vw);
        height: 6px;
        background: rgba(255,255,255,0.15);
        z-index: 21;
        display: none;
    }
    .rs-cooldown.rs-show { display: block; }
    .rs-cooldown-fill {
        width: 0%;
        height: 100%;
        background: linear-gradient(90deg, #8ed5ff, #fff);
    }
    .rs-result {
        position: absolute;
        inset: 0;
        z-index: 60;
        display: none;
        align-items: center;
        justify-content: center;
        background: rgba(0,0,0,0.72);
        font-size: clamp(26px, 6vh, 72px);
        font-weight: 900;
        letter-spacing: 0.1em;
        text-align: center;
        text-shadow: 0 0 24px rgba(255,255,255,0.8);
    }
    .rs-result.rs-show { display: flex; }
    .rs-result.rs-win {
        color: #b4f6ff;
    }
    .rs-result.rs-loss {
        color: #ff9a9a;
    }
    .rs-counter {
        position: absolute;
        inset: 0;
        z-index: 55;
        display: none;
        align-items: center;
        justify-content: center;
        pointer-events: none;
    }
    .rs-counter-inner {
        width: min(1100px, 100vw);
        height: min(34vh, 300px);
        display: flex;
        align-items: center;
        justify-content: center;
        transform: translateX(-120%);
        opacity: 0;
    }
    .rs-counter-img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        filter: drop-shadow(0 0 24px rgba(95,220,255,0.55));
    }
    .rs-counter.rs-show {
        display: flex;
    }
    .rs-counter.rs-show .rs-counter-inner {
        animation: rsCounterSlide 460ms cubic-bezier(0.22,0.61,0.36,1) forwards;
    }
    @keyframes rsCounterSlide {
        0% { opacity: 0; transform: translateX(-120%); }
        70% { opacity: 1; transform: translateX(2%); }
        100% { opacity: 1; transform: translateX(0%); }
    }
    `;
}

function buildStubPhaseOneLines() {
    return [
        ["There's no way", "you could've", "gone outside!"],
        ["Everyone heard", "the impact in", "the library..."],
        ["The hallway cameras", "were active", "the whole time."],
        ["No one bypasses", "that lock without", "being seen."],
    ];
}

function buildPhaseTwoLineGroups(playerMessage) {
    const userText = String(playerMessage || "").trim();
    const userChunk = userText ? `"${userText.slice(0, 30)}"` : "your claim";
    return [
        { chunks: ["You keep saying", userChunk, "backs your route."] },
        { chunks: ["But the timeline", "still does not", "line up."] },
        { chunks: ["The camera record", "has no trace", "of your path."] },
        { chunks: ["That statement", "contradicts the", "hallway evidence."], weakPointIndex: 1 },
    ];
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function createRebuttalShowdownController({
    extensionFolderPath = "",
    getTruthBullets = null,
    awardMonocoins = null,
    deductMonocoins = null,
} = {}) {
    function destroy() {
        document.getElementById(RS_ID)?.remove();
        document.getElementById(RS_STYLE)?.remove();
    }

    async function run() {
        destroy();
        ensureNotoSansJP();

        const styleEl = document.createElement("style");
        styleEl.id = RS_STYLE;
        styleEl.textContent = buildStyles();
        document.head.appendChild(styleEl);

        const allBullets = (getTruthBullets?.() || []).map((bullet, index) => ({
            id: String(bullet?.id || `tb-${index}`),
            title: String(bullet?.title || "").trim(),
            description: String(bullet?.description || "").trim(),
        })).filter(b => b.title);

        const fallbackBullets = [
            { id: "stub-1", title: "Door Sensor Log", description: "Record of door activation events." },
            { id: "stub-2", title: "Camera Blind Spot", description: "A route that avoids direct camera tracking." },
            { id: "stub-3", title: "Broken Alibi", description: "Contradiction between statement and timestamps." },
        ];
        const bladeOptions = allBullets.length ? allBullets : fallbackBullets;
        const weakPointBlade = bladeOptions[Math.min(2, bladeOptions.length - 1)];
        const weakPointNorm = normalizeLabel(weakPointBlade.title);

        const overlay = document.createElement("div");
        overlay.id = RS_ID;
        overlay.innerHTML = `
            <div class="rs-top">
                <div class="rs-title">REBUTTAL SHOWDOWN</div>
                <div class="rs-stats">
                    <div class="rs-pill" id="rs-phase-label">PHASE 1 · CUTTING</div>
                    <div class="rs-pill" id="rs-cut-label">CUTS 0 / 7</div>
                    <div class="rs-pill" id="rs-miss-label">MISSES 0 / 4</div>
                </div>
            </div>
            <div class="rs-main">
                <div class="rs-arena" id="rs-arena"></div>
                <div class="rs-struggle" id="rs-struggle"></div>
                <div class="rs-cursor" id="rs-cursor"></div>
                <div class="rs-blade" id="rs-blade"></div>
                <div class="rs-slash" id="rs-slash"></div>
                <div class="rs-duel" id="rs-duel">
                    <div class="rs-duel-box">
                        <div class="rs-duel-title">DUEL CLASH</div>
                        <div class="rs-duel-sub">Left-click rapidly to break through.</div>
                        <div class="rs-duel-meter"><div class="rs-duel-fill" id="rs-duel-fill"></div></div>
                        <div class="rs-duel-count" id="rs-duel-count">0 / 18</div>
                    </div>
                </div>
                <div class="rs-between" id="rs-between">
                    <div class="rs-between-card">
                        <div class="rs-between-title">INTERJECTION TURN</div>
                        <div class="rs-between-sub">Type a rebuttal line to bias phase 2 argument text.</div>
                        <input id="rs-between-input" class="rs-between-input" maxlength="220" placeholder="Type your counter-argument..."/>
                        <div class="rs-between-actions">
                            <button id="rs-between-continue" class="rs-btn" type="button">Continue</button>
                        </div>
                    </div>
                </div>
                <div class="rs-weak" id="rs-weak">
                    <div class="rs-weak-label">WEAK POINT REVEALED</div>
                    <div class="rs-weak-core">ALIBI FRACTURE</div>
                    <div class="rs-weak-hint">Select the matching Truth Blade, then right-click on the weak point.</div>
                </div>
                <div class="rs-cooldown" id="rs-cooldown"><div id="rs-cooldown-fill" class="rs-cooldown-fill"></div></div>
                <div class="rs-finish-note" id="rs-finish-note">Right-click Finisher ready</div>
                <div class="rs-phase-panel" id="rs-panel">
                    <div class="rs-panel-head">PHASE 2 ARGUMENT LINES</div>
                    <div class="rs-arg-lines" id="rs-arg-lines"></div>
                    <div class="rs-panel-head">TRUTH BLADES</div>
                    <div class="rs-bullets" id="rs-bullets"></div>
                </div>
                <div class="rs-counter" id="rs-counter">
                    <div class="rs-counter-inner">
                        <img id="rs-counter-img" class="rs-counter-img" alt="COUNTER"/>
                    </div>
                </div>
                <div class="rs-result" id="rs-result"></div>
            </div>
        `;
        document.body.appendChild(overlay);
        requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add("rs-on")));

        const arena = overlay.querySelector("#rs-arena");
        const struggleEl = overlay.querySelector("#rs-struggle");
        const cursorEl = overlay.querySelector("#rs-cursor");
        const bladeEl = overlay.querySelector("#rs-blade");
        const slashEl = overlay.querySelector("#rs-slash");
        const duelEl = overlay.querySelector("#rs-duel");
        const duelFillEl = overlay.querySelector("#rs-duel-fill");
        const duelCountEl = overlay.querySelector("#rs-duel-count");
        const betweenEl = overlay.querySelector("#rs-between");
        const betweenInput = overlay.querySelector("#rs-between-input");
        const betweenContinueBtn = overlay.querySelector("#rs-between-continue");
        const weakEl = overlay.querySelector("#rs-weak");
        const panelEl = overlay.querySelector("#rs-panel");
        const argLinesEl = overlay.querySelector("#rs-arg-lines");
        const bulletsEl = overlay.querySelector("#rs-bullets");
        const cooldownEl = overlay.querySelector("#rs-cooldown");
        const cooldownFillEl = overlay.querySelector("#rs-cooldown-fill");
        const finishNoteEl = overlay.querySelector("#rs-finish-note");
        const phaseLabelEl = overlay.querySelector("#rs-phase-label");
        const cutLabelEl = overlay.querySelector("#rs-cut-label");
        const missLabelEl = overlay.querySelector("#rs-miss-label");
        const counterEl = overlay.querySelector("#rs-counter");
        const counterImgEl = overlay.querySelector("#rs-counter-img");
        const resultEl = overlay.querySelector("#rs-result");
        const counterBannerSrc = `${(extensionFolderPath || "").replace(/\\/g, "/")}/assets/classtrial/counter.png`;
        if (counterImgEl) counterImgEl.src = counterBannerSrc;

        const phaseOneLines = buildStubPhaseOneLines();
        const totalPhaseOneChunks = phaseOneLines.reduce((sum, lineGroup) => sum + lineGroup.length, 0);
        const lanes = [80, 140, 200, 260, 320, 380, 440];
        const lineEntities = new Map();
        let phase = "phase1";
        let lastSpawnTs = 0;
        let spawnIndex = 0;
        let nextPhraseReadyTs = 0;
        let hadActivePhraseChunks = false;
        let phase2Groups = [];
        let phase2SpawnIndex = 0;
        let phase2LastSpawnTs = 0;
        let phase2NextReadyTs = 0;
        let phase2HadActiveChunks = false;
        let phase2WeakPointResolved = false;
        let counterBannerUntil = 0;
        const cutTarget = Math.min(9, totalPhaseOneChunks);
        const missLimit = 4;
        let cuts = 0;
        let misses = 0;
        let duelClicks = 0;
        let lastFormationIndex = -1;
        let duelTriggered = false;
        const duelClickTarget = 18;
        let slashCooldownUntil = 0;
        let finisherCooldownUntil = 0;
        const slashCooldownMs = 240;
        const finisherCooldownMs = 1700;
        let rafId = null;
        let lastTs = 0;
        let running = true;
        let selectedBladeId = bladeOptions[0]?.id || "";
        let playerBetweenMessage = "";
        let resolved = false;
        let finalOutcome = false;
        const edgePadding = 18;
        let struggle = 0.35;
        let controlFreedom = 0.2;
        let cursorX = window.innerWidth * 0.5;
        let cursorY = Math.max(edgePadding, window.innerHeight - edgePadding);
        let bladeAngleDeg = -90;
        let targetCursorX = cursorX;
        let targetCursorY = cursorY;
        let targetBladeAngleDeg = bladeAngleDeg;
        let lastMouseX = cursorX;
        let lastMouseY = cursorY - 300;
        let bladeLength = Math.max(window.innerWidth, Math.hypot(window.innerWidth, window.innerHeight) * 1.35);

        function renderBullets() {
            bulletsEl.innerHTML = bladeOptions.map(option => `
                <button type="button" class="rs-bullet ${selectedBladeId === option.id ? "rs-selected" : ""}" data-id="${escapeHtml(option.id)}">
                    ${escapeHtml(option.title)}
                </button>
            `).join("");
            bulletsEl.querySelectorAll(".rs-bullet").forEach(btn => {
                btn.addEventListener("click", () => {
                    selectedBladeId = String(btn.dataset.id || "");
                    renderBullets();
                });
            });
        }

        function updateHud() {
            cutLabelEl.textContent = `CUTS ${cuts} / ${cutTarget}`;
            missLabelEl.textContent = `MISSES ${misses} / ${missLimit}`;
        }

        function getStruggleShiftPx() {
            return Math.max(120, window.innerWidth * 0.22);
        }

        function getArcHalfAngleDeg() {
            return 12 + (controlFreedom * 58);
        }

        function adjustControlState(successWeight, failureWeight = 0) {
            if (successWeight > 0) {
                struggle = clamp(struggle - (0.14 * successWeight), -1, 1);
                controlFreedom = clamp(controlFreedom + (0.06 * successWeight), 0.14, 1);
            }
            if (failureWeight > 0) {
                struggle = clamp(struggle + (0.18 * failureWeight), -1, 1);
                controlFreedom = clamp(controlFreedom - (0.08 * failureWeight), 0.14, 1);
            }
        }

        function computeBladeAngleFromCursorAndMouse(cx, cy, mx, my) {
            const raw = Math.atan2(my - cy, mx - cx) * 180 / Math.PI;
            const halfArc = getArcHalfAngleDeg();
            return clamp(raw, -90 - halfArc, -90 + halfArc);
        }

        function updateEntityDamageVisual(entity) {
            if (!entity?.el) return;
            const maxHp = Math.max(1, Number(entity.maxHitPoints || 1));
            const hp = Math.max(0, Number(entity.hitPoints || 0));
            const original = String(entity.baseText || entity.text || "");
            if (maxHp <= 1 || hp <= 0) {
                entity.el.textContent = original;
                entity.el.classList.remove("rs-damaged");
            } else {
                const chars = [...original];
                const visibleChars = Math.max(1, Math.floor(chars.length * (hp / maxHp)));
                const vanished = chars.map((ch, idx) => (idx < visibleChars ? ch : " "));
                entity.el.textContent = vanished.join("");
                entity.el.classList.remove("rs-damaged");
                void entity.el.offsetWidth;
                entity.el.classList.add("rs-damaged");
            }
            const rect = entity.el.getBoundingClientRect();
            entity.width = Math.max(50, rect.width);
            entity.height = Math.max(56, rect.height);
        }

        function playBreakEffect(entity, intensity = 1) {
            if (!entity?.el) return;
            const cx = entity.x + (entity.width * 0.5);
            const cy = entity.y + (entity.height * 0.5);
            const count = Math.max(4, Math.floor(8 * intensity));
            for (let i = 0; i < count; i += 1) {
                const shard = document.createElement("span");
                shard.className = "rs-break-shard";
                shard.style.left = `${cx}px`;
                shard.style.top = `${cy}px`;
                const angle = (Math.PI * 2 * i / count) + (Math.random() * 0.4);
                const dist = (16 + Math.random() * 38) * intensity;
                shard.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
                shard.style.setProperty("--dy", `${Math.sin(angle) * dist}px`);
                arena.appendChild(shard);
                setTimeout(() => shard.remove(), 290);
            }
        }

        function syncBladeVisuals() {
            cursorEl.style.left = `${cursorX}px`;
            cursorEl.style.top = `${cursorY}px`;
            bladeEl.style.left = `${cursorX}px`;
            bladeEl.style.top = `${cursorY}px`;
            bladeEl.style.width = `${bladeLength}px`;
            bladeEl.style.transform = `translate(0, -50%) rotate(${bladeAngleDeg}deg)`;
            slashEl.style.width = `${bladeLength}px`;
        }

        function showResult(win, text) {
            resultEl.classList.add("rs-show", win ? "rs-win" : "rs-loss");
            resultEl.textContent = text;
        }

        function removeAllLines() {
            lineEntities.forEach(entity => entity.el.remove());
            lineEntities.clear();
        }

        function updateDuelHud() {
            const safeClicks = Math.min(duelClickTarget, Math.max(0, duelClicks));
            const pct = (safeClicks / duelClickTarget) * 100;
            duelFillEl.style.width = `${pct}%`;
            duelCountEl.textContent = `${safeClicks} / ${duelClickTarget}`;
        }

        function triggerDuelPenalty() {
            if (duelTriggered || phase !== "phase1") return;
            duelTriggered = true;
            phase = "duel";
            removeAllLines();
            duelClicks = 0;
            updateDuelHud();
            phaseLabelEl.textContent = "PENALTY · DUEL";
            duelEl.classList.add("rs-show");
        }

        function handleDuelClick() {
            if (phase !== "duel" || !duelTriggered) return;
            duelClicks += 1;
            updateDuelHud();
            if (duelClicks >= duelClickTarget) {
                duelTriggered = false;
                duelEl.classList.remove("rs-show");
                enterPhaseTwo();
            }
        }

        function spawnLine(now) {
            if (spawnIndex >= phaseOneLines.length) return;
            if (lineEntities.size > 0) return;
            if (now < nextPhraseReadyTs) return;
            if (now - lastSpawnTs < 220) return;
            lastSpawnTs = now;
            const phraseChunks = phaseOneLines[spawnIndex] || [];
            const lane = lanes[(spawnIndex * 2) % lanes.length];
            spawnIndex += 1;
            const formations = [
                {
                    offsets: [[0, 0], [195, 92], [410, 176]],
                    rotations: [0, 0, 0],
                },
                {
                    offsets: [[0, 0], [235, 48], [510, 132]],
                    rotations: [-14, -14, -14],
                },
                {
                    offsets: [[0, 18], [230, 118], [518, 70]],
                    rotations: [12, 12, 12],
                },
                {
                    offsets: [[0, 0], [210, 138], [448, 244]],
                    rotations: [-20, -20, -20],
                },
                {
                    offsets: [[0, 56], [266, 0], [536, 114]],
                    rotations: [18, 18, 18],
                },
                {
                    offsets: [[0, 0], [240, 92], [500, 40]],
                    rotations: [-10, 8, -14],
                },
                {
                    offsets: [[0, 86], [255, 26], [520, 146]],
                    rotations: [14, -10, 16],
                },
                {
                    offsets: [[0, 0], [215, 58], [475, 202]],
                    rotations: [0, -24, -24],
                },
                {
                    offsets: [[0, 24], [286, 114], [562, 8]],
                    rotations: [16, 4, -12],
                },
                {
                    offsets: [[0, 0], [268, 142], [546, 214]],
                    rotations: [-6, -14, -22],
                },
            ];
            let formationIndex = (spawnIndex * 3 + Math.floor(Math.random() * formations.length)) % formations.length;
            if (formationIndex === lastFormationIndex) {
                formationIndex = (formationIndex + 1) % formations.length;
            }
            lastFormationIndex = formationIndex;
            const formation = formations[formationIndex];
            const phraseSpeed = 128 + ((spawnIndex % 4) * 12);
            const arenaHeight = Math.max(220, arena.clientHeight || window.innerHeight);
            const minGapX = 44;
            const minGapY = 28;
            const placedBoxes = [];
            const initialChunks = [];
            phraseChunks.forEach((text, i) => {
                const el = document.createElement("div");
                el.className = "rs-line";
                el.textContent = text;
                arena.appendChild(el);
                const rect = el.getBoundingClientRect();
                const width = Math.max(70, rect.width);
                const height = Math.max(72, rect.height);
                const chunkIndex = Math.min(i, formation.offsets.length - 1);
                const [offsetX, offsetY] = formation.offsets[chunkIndex];
                initialChunks.push({
                    el,
                    text,
                    x: -width - 42 - offsetX,
                    y: lane + offsetY,
                    width,
                    height,
                    speed: phraseSpeed + (i * 6),
                    rotationDeg: formation.rotations[chunkIndex],
                });
            });
            initialChunks.forEach((chunk, i) => {
                let attempts = 0;
                let y = chunk.y;
                const baseY = chunk.y;
                const step = 30;
                while (attempts < 18) {
                    const overlap = placedBoxes.some(box => {
                        const overlapX = chunk.x < (box.x + box.width + minGapX) && (chunk.x + chunk.width + minGapX) > box.x;
                        const overlapY = y < (box.y + box.height + minGapY) && (y + chunk.height + minGapY) > box.y;
                        return overlapX && overlapY;
                    });
                    if (!overlap) break;
                    const dir = (attempts % 2 === 0 ? 1 : -1) * (i % 2 === 0 ? 1 : -1);
                    y = baseY + (Math.ceil((attempts + 1) / 2) * step * dir);
                    y = Math.max(56, Math.min(arenaHeight - chunk.height - 40, y));
                    attempts += 1;
                }
                chunk.y = y;
                placedBoxes.push({ x: chunk.x, y: chunk.y, width: chunk.width, height: chunk.height });
                lineEntities.set(`${Date.now()}-${Math.random()}`, {
                    el: chunk.el,
                    text: chunk.text,
                    baseText: chunk.text,
                    x: chunk.x,
                    y: chunk.y,
                    width: chunk.width,
                    height: chunk.height,
                    speed: chunk.speed,
                    rotationDeg: chunk.rotationDeg,
                    isWeakPoint: false,
                    maxHitPoints: ((spawnIndex + i) % 7 === 0) ? 3 : (((spawnIndex + i) % 3 === 0) ? 2 : 1),
                    hitPoints: ((spawnIndex + i) % 7 === 0) ? 3 : (((spawnIndex + i) % 3 === 0) ? 2 : 1),
                    cut: false,
                });
            });
        }

        function spawnPhaseTwoLine(now) {
            if (phase2SpawnIndex >= phase2Groups.length) return;
            if (lineEntities.size > 0) return;
            if (now < phase2NextReadyTs) return;
            if (now - phase2LastSpawnTs < 200) return;
            phase2LastSpawnTs = now;
            const group = phase2Groups[phase2SpawnIndex] || { chunks: [] };
            const phraseChunks = group.chunks || [];
            const weakPointIndex = Number.isInteger(group.weakPointIndex) ? group.weakPointIndex : -1;
            const lane = lanes[(phase2SpawnIndex * 3 + 1) % lanes.length];
            phase2SpawnIndex += 1;
            const formations = [
                { offsets: [[0, 0], [210, 90], [430, 170]], rotations: [0, 0, 0] },
                { offsets: [[0, 6], [250, 56], [528, 136]], rotations: [-12, -12, -12] },
                { offsets: [[0, 24], [250, 116], [542, 72]], rotations: [10, 10, 10] },
                { offsets: [[0, 0], [214, 138], [470, 236]], rotations: [-18, -18, -18] },
                { offsets: [[0, 58], [282, 0], [560, 118]], rotations: [16, 16, 16] },
            ];
            let formationIndex = (phase2SpawnIndex * 5 + Math.floor(Math.random() * formations.length)) % formations.length;
            if (formationIndex === lastFormationIndex) {
                formationIndex = (formationIndex + 1) % formations.length;
            }
            lastFormationIndex = formationIndex;
            const formation = formations[formationIndex];
            const phraseSpeed = 120 + ((phase2SpawnIndex % 4) * 10);
            const arenaHeight = Math.max(220, arena.clientHeight || window.innerHeight);
            const minGapX = 46;
            const minGapY = 28;
            const placedBoxes = [];
            const initialChunks = [];
            phraseChunks.forEach((text, i) => {
                const el = document.createElement("div");
                el.className = "rs-line";
                if (i === weakPointIndex) el.classList.add("rs-weakpoint");
                el.textContent = text;
                arena.appendChild(el);
                const rect = el.getBoundingClientRect();
                const width = Math.max(70, rect.width);
                const height = Math.max(72, rect.height);
                const chunkIndex = Math.min(i, formation.offsets.length - 1);
                const [offsetX, offsetY] = formation.offsets[chunkIndex];
                initialChunks.push({
                    el,
                    text,
                    x: -width - 42 - offsetX,
                    y: lane + offsetY,
                    width,
                    height,
                    speed: phraseSpeed + (i * 6),
                    rotationDeg: formation.rotations[chunkIndex],
                    isWeakPoint: i === weakPointIndex,
                });
            });
            initialChunks.forEach((chunk, i) => {
                let attempts = 0;
                let y = chunk.y;
                const baseY = chunk.y;
                const step = 30;
                while (attempts < 18) {
                    const overlap = placedBoxes.some(box => {
                        const overlapX = chunk.x < (box.x + box.width + minGapX) && (chunk.x + chunk.width + minGapX) > box.x;
                        const overlapY = y < (box.y + box.height + minGapY) && (y + chunk.height + minGapY) > box.y;
                        return overlapX && overlapY;
                    });
                    if (!overlap) break;
                    const dir = (attempts % 2 === 0 ? 1 : -1) * (i % 2 === 0 ? 1 : -1);
                    y = baseY + (Math.ceil((attempts + 1) / 2) * step * dir);
                    y = Math.max(56, Math.min(arenaHeight - chunk.height - 40, y));
                    attempts += 1;
                }
                chunk.y = y;
                placedBoxes.push({ x: chunk.x, y: chunk.y, width: chunk.width, height: chunk.height });
                lineEntities.set(`${Date.now()}-${Math.random()}`, {
                    el: chunk.el,
                    text: chunk.text,
                    baseText: chunk.text,
                    x: chunk.x,
                    y: chunk.y,
                    width: chunk.width,
                    height: chunk.height,
                    speed: chunk.speed,
                    rotationDeg: chunk.rotationDeg,
                    isWeakPoint: chunk.isWeakPoint,
                    maxHitPoints: 1,
                    hitPoints: 1,
                    cut: false,
                });
            });
        }

        function updateLines(dt) {
            const removeKeys = [];
            const middleX = window.innerWidth * 0.5;
            const accelSpan = Math.max(90, window.innerWidth * 0.16);
            let weakPointPassed = false;
            lineEntities.forEach((entity, key) => {
                if (!entity.cut) {
                    const centerX = entity.x + (entity.width * 0.5);
                    let accelMultiplier = 1.75;
                    if (centerX >= middleX) {
                        const progressPastMiddle = Math.max(0, (centerX - middleX) / accelSpan);
                        accelMultiplier = 9.5 + Math.min(8.5, progressPastMiddle * 8.5);
                    }
                    entity.x += entity.speed * accelMultiplier * dt;
                    entity.el.style.transform = `translate3d(${entity.x}px, ${entity.y}px, 0) rotate(${entity.rotationDeg}deg)`;
                    if (entity.x > window.innerWidth + 16) {
                        if (phase === "phase2" && entity.isWeakPoint && !phase2WeakPointResolved) {
                            weakPointPassed = true;
                        }
                        removeKeys.push(key);
                        misses += 1;
                        adjustControlState(0, 1);
                    }
                }
            });
            removeKeys.forEach(key => {
                const entity = lineEntities.get(key);
                entity?.el.remove();
                lineEntities.delete(key);
            });
            if (weakPointPassed) {
                finish(false);
                return;
            }
            if (phase === "phase1" && lineEntities.size > 0) {
                hadActivePhraseChunks = true;
            } else if (phase === "phase1" && hadActivePhraseChunks) {
                hadActivePhraseChunks = false;
                nextPhraseReadyTs = performance.now() + 170;
            }
            if (phase === "phase2" && lineEntities.size > 0) {
                phase2HadActiveChunks = true;
            } else if (phase === "phase2" && phase2HadActiveChunks) {
                phase2HadActiveChunks = false;
                phase2NextReadyTs = performance.now() + 160;
            }
            if (phase === "phase1" && misses >= missLimit) {
                triggerDuelPenalty();
            }
            updateHud();
        }

        function trySlash(now) {
            if (phase !== "phase1" && phase !== "phase2") return;
            if (duelTriggered) return;
            if (now < slashCooldownUntil) return;
            slashCooldownUntil = now + slashCooldownMs;
            slashEl.classList.remove("rs-active");
            slashEl.style.left = `${cursorX}px`;
            slashEl.style.top = `${cursorY}px`;
            slashEl.style.transform = `translate(0, -50%) rotate(${bladeAngleDeg}deg)`;
            requestAnimationFrame(() => slashEl.classList.add("rs-active"));
            const radians = bladeAngleDeg * Math.PI / 180;
            const x1 = cursorX - Math.cos(radians) * 8;
            const y1 = cursorY - Math.sin(radians) * 8;
            const x2 = cursorX + Math.cos(radians) * bladeLength;
            const y2 = cursorY + Math.sin(radians) * bladeLength;
            lineEntities.forEach((entity, key) => {
                if (entity.cut) return;
                if (lineIntersectsRect(x1, y1, x2, y2, entity.x, entity.y, entity.width, entity.height)) {
                    if (phase === "phase2" && entity.isWeakPoint) {
                        playBreakEffect(entity, 0.8);
                        entity.el.animate([
                            { transform: `translate3d(${entity.x}px, ${entity.y}px, 0) rotate(${entity.rotationDeg}deg) scale(1)` },
                            { transform: `translate3d(${entity.x}px, ${entity.y}px, 0) rotate(${entity.rotationDeg}deg) scale(1.06)` },
                            { transform: `translate3d(${entity.x}px, ${entity.y}px, 0) rotate(${entity.rotationDeg}deg) scale(1)` },
                        ], { duration: 120, easing: "ease-out" });
                        return;
                    }
                    entity.hitPoints = Math.max(0, Number(entity.hitPoints || 1) - 1);
                    if (entity.hitPoints > 0) {
                        playBreakEffect(entity, 0.9);
                        updateEntityDamageVisual(entity);
                        adjustControlState(0.35, 0);
                    } else {
                        playBreakEffect(entity, 1.3);
                        entity.cut = true;
                        entity.el.classList.add("rs-cut");
                        const entityRef = entity;
                        setTimeout(() => {
                            entityRef.el.remove();
                            lineEntities.delete(key);
                            if (lineEntities.size === 0 && hadActivePhraseChunks) {
                                hadActivePhraseChunks = false;
                                nextPhraseReadyTs = performance.now() + 170;
                            }
                        }, 220);
                        cuts += 1;
                        adjustControlState(1, 0);
                        updateHud();
                    }
                }
            });
        }

        async function enterBetweenPhase() {
            phase = "between";
            phaseLabelEl.textContent = "INTERMISSION";
            removeAllLines();
            betweenEl.classList.add("rs-show");
            betweenInput.focus();
            await new Promise(resolve => {
                const submit = () => {
                    playerBetweenMessage = String(betweenInput.value || "").trim();
                    betweenEl.classList.remove("rs-show");
                    betweenContinueBtn.removeEventListener("click", submit);
                    betweenInput.removeEventListener("keydown", onInputKey);
                    resolve();
                };
                const onInputKey = (event) => {
                    if (event.key === "Enter") {
                        event.preventDefault();
                        submit();
                    }
                };
                betweenContinueBtn.addEventListener("click", submit);
                betweenInput.addEventListener("keydown", onInputKey);
            });
            enterPhaseTwo();
        }

        function enterPhaseTwo() {
            phase = "phase2";
            phaseLabelEl.textContent = "PHASE 2 · COUNTER";
            weakEl.classList.remove("rs-show");
            panelEl.classList.add("rs-show");
            cooldownEl.classList.add("rs-show");
            finishNoteEl.classList.add("rs-show");
            removeAllLines();
            phase2Groups = buildPhaseTwoLineGroups(playerBetweenMessage);
            phase2SpawnIndex = 0;
            phase2LastSpawnTs = 0;
            phase2NextReadyTs = 0;
            phase2HadActiveChunks = false;
            phase2WeakPointResolved = false;
            counterBannerUntil = 0;
            argLinesEl.innerHTML = phase2Groups
                .map(group => {
                    const weakIndex = Number.isInteger(group.weakPointIndex) ? group.weakPointIndex : -1;
                    return group.chunks.map((chunk, i) => {
                        const prefix = i === weakIndex ? "⚠ " : "";
                        return `<div class="rs-arg-line">${escapeHtml(prefix + chunk)}</div>`;
                    }).join("");
                })
                .join("");
            renderBullets();
        }

        async function finish(win) {
            if (resolved) return;
            resolved = true;
            finalOutcome = Boolean(win);
            running = false;
            if (rafId) cancelAnimationFrame(rafId);
            overlay.removeEventListener("mousemove", onMouseMove);
            overlay.removeEventListener("mousedown", onMouseDown);
            overlay.removeEventListener("contextmenu", onContextMenu);
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("resize", onResize);
            if (win) {
                awardMonocoins?.(8, "rebuttal showdown clear");
                showResult(true, "ARGUMENT SHATTERED");
            } else {
                deductMonocoins?.(8, "rebuttal showdown failed");
                showResult(false, "REBUTTAL FAILED");
            }
            await delay(1400);
            overlay.classList.remove("rs-on");
            await delay(260);
            destroy();
        }

        function tryCounter(now) {
            if (phase !== "phase2") return;
            if (phase2WeakPointResolved) return;
            const radians = bladeAngleDeg * Math.PI / 180;
            const x1 = cursorX - Math.cos(radians) * 8;
            const y1 = cursorY - Math.sin(radians) * 8;
            const x2 = cursorX + Math.cos(radians) * bladeLength;
            const y2 = cursorY + Math.sin(radians) * bladeLength;
            let hitWeakKey = null;
            lineEntities.forEach((entity, key) => {
                if (hitWeakKey) return;
                if (!entity.isWeakPoint || entity.cut) return;
                const cx = entity.x + (entity.width * 0.5);
                const cy = entity.y + (entity.height * 0.5);
                const pointDistance = Math.abs((y2 - y1) * cx - (x2 - x1) * cy + x2 * y1 - y2 * x1) / Math.max(1, Math.hypot(y2 - y1, x2 - x1));
                const nearLine = pointDistance <= Math.max(28, entity.height * 0.55);
                if (nearLine || lineIntersectsRect(x1, y1, x2, y2, entity.x, entity.y, entity.width, entity.height)) {
                    hitWeakKey = key;
                }
            });
            if (hitWeakKey) {
                finisherCooldownUntil = now + finisherCooldownMs;
                const weakEntity = lineEntities.get(hitWeakKey);
                phase2WeakPointResolved = true;
                counterBannerUntil = performance.now() + 900;
                playBreakEffect(weakEntity, 1.8);
                weakEntity?.el.classList.add("rs-cut");
                setTimeout(() => {
                    weakEntity?.el.remove();
                    lineEntities.delete(hitWeakKey);
                }, 200);
                removeAllLines();
                phase = "counter";
                setTimeout(() => {
                    if (!resolved) finish(true);
                }, 820);
                return;
            }
            if (now < finisherCooldownUntil) return;
            finisherCooldownUntil = now + finisherCooldownMs;
            misses += 1;
            adjustControlState(0, 0.7);
            updateHud();
            if (misses >= missLimit + 2) {
                finish(false);
            }
        }

        function onMouseMove(event) {
            const nx = event.clientX;
            const ny = event.clientY;
            lastMouseX = nx;
            lastMouseY = ny;
            targetBladeAngleDeg = computeBladeAngleFromCursorAndMouse(targetCursorX, targetCursorY, nx, ny);
        }

        function onResize() {
            const shiftPx = getStruggleShiftPx();
            targetCursorX = clamp((window.innerWidth * 0.5) + (struggle * shiftPx), edgePadding, window.innerWidth - edgePadding);
            targetCursorY = Math.max(edgePadding, window.innerHeight - edgePadding);
            targetBladeAngleDeg = computeBladeAngleFromCursorAndMouse(targetCursorX, targetCursorY, lastMouseX, lastMouseY);
            cursorX = targetCursorX;
            cursorY = targetCursorY;
            bladeAngleDeg = targetBladeAngleDeg;
            bladeLength = Math.max(window.innerWidth, Math.hypot(window.innerWidth, window.innerHeight) * 1.35);
            syncBladeVisuals();
        }

        function onMouseDown(event) {
            if (event.button !== 0) return;
            event.preventDefault();
            if (phase === "duel") {
                handleDuelClick();
                return;
            }
            trySlash(performance.now());
        }

        function onContextMenu(event) {
            event.preventDefault();
            if (phase === "duel") return;
            tryCounter(performance.now());
        }

        function onKeyDown(event) {
            if (event.key === "Escape") {
                event.preventDefault();
                finish(false);
            }
        }

        function gameLoop(ts) {
            if (!running) return;
            const dt = lastTs ? Math.min(0.06, (ts - lastTs) / 1000) : 0.016;
            lastTs = ts;
            const shiftPx = getStruggleShiftPx();
            targetCursorX = clamp((window.innerWidth * 0.5) + (struggle * shiftPx), edgePadding, window.innerWidth - edgePadding);
            targetCursorY = Math.max(edgePadding, window.innerHeight - edgePadding);
            targetBladeAngleDeg = computeBladeAngleFromCursorAndMouse(targetCursorX, targetCursorY, lastMouseX, lastMouseY);
            if (struggleEl) {
                struggleEl.style.left = `${targetCursorX}px`;
            }
            const follow = Math.min(1, dt * 18);
            cursorX += (targetCursorX - cursorX) * follow;
            cursorY += (targetCursorY - cursorY) * follow;
            bladeAngleDeg = lerpAngleDeg(bladeAngleDeg, targetBladeAngleDeg, Math.min(1, dt * 14));
            syncBladeVisuals();

            if (phase === "phase1" && !duelTriggered) {
                spawnLine(ts);
                updateLines(dt);
                if (cuts >= cutTarget) {
                    enterBetweenPhase();
                } else if (spawnIndex >= phaseOneLines.length && lineEntities.size === 0 && cuts < cutTarget) {
                    finish(false);
                    return;
                }
            }

            if (phase === "phase2") {
                spawnPhaseTwoLine(ts);
                updateLines(dt);
                if (phase2SpawnIndex >= phase2Groups.length && lineEntities.size === 0 && !phase2WeakPointResolved) {
                    finish(false);
                    return;
                }
                const remain = Math.max(0, finisherCooldownUntil - performance.now());
                const pct = 100 - Math.min(100, remain / finisherCooldownMs * 100);
                cooldownFillEl.style.width = `${pct}%`;
                finishNoteEl.textContent = remain <= 0
                    ? "Right-click COUNTER ready"
                    : `Counter cooldown ${(remain / 1000).toFixed(1)}s`;
            } else {
                cooldownFillEl.style.width = "0%";
            }
            counterEl.classList.toggle("rs-show", performance.now() < counterBannerUntil);

            rafId = requestAnimationFrame(gameLoop);
        }

        syncBladeVisuals();
        updateHud();
        renderBullets();
        overlay.addEventListener("mousemove", onMouseMove);
        overlay.addEventListener("mousedown", onMouseDown);
        overlay.addEventListener("contextmenu", onContextMenu);
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("resize", onResize);
        rafId = requestAnimationFrame(gameLoop);

        return new Promise(resolve => {
            const waitForFinish = async () => {
                while (!resolved) {
                    await delay(80);
                }
                resolve(finalOutcome);
            };
            waitForFinish();
        });
    }

    return { run };
}
