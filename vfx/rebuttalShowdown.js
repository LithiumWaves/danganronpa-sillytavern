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

function buildStyles(extensionFolderPath = "") {
    const panelImg = `${(extensionFolderPath || "").replace(/\\/g, "/")}/assets/images/minigames/aa-panel.png`;
    return `
    #${RS_ID} {
        position: fixed;
        inset: 0;
        z-index: 2147483646;
        background: transparent;
        font-family: "Noto Sans JP", "Orbitron", sans-serif;
        color: #fff;
        overflow: hidden;
        opacity: 0;
        transition: opacity 220ms ease;
        user-select: none;
    }
    #${RS_ID}.rs-on { opacity: 1; }
    #${RS_ID}.rs-on::after {
        content: '';
        position: absolute;
        inset: 0;
        background: rgba(0, 140, 30, 0.28);
        pointer-events: none;
        z-index: 50;
    }
    #${RS_ID} * { box-sizing: border-box; }
    .rs-top {
        position: absolute;
        left: 0;
        top: 0;
        right: 0;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        padding: 12px 24px;
        background: linear-gradient(180deg, rgba(0,0,0,0.75), rgba(0,0,0,0));
        z-index: 10;
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
        inset: 0;
    }
    .rs-arena {
        position: absolute;
        inset: 0;
        overflow: hidden;
        cursor: none;
    }
    /* ── Centre struggle / warning tape ─────────────────────────── */
    .rs-struggle {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 0;
        pointer-events: none;
        z-index: 19;
    }
    .rs-tape {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 26px;
        overflow: hidden;
        transition: filter 0.4s ease;
    }
    .rs-tape-left  { right: 0; transform: translateX(-100%); }
    .rs-tape-right { left: -26px; }
    .rs-tape-scroll {
        height: 200%;
        background: repeating-linear-gradient(
            -45deg,
            rgba(255,230,0,0.82) 0px,  rgba(255,230,0,0.82) 11px,
            transparent         11px,  transparent         22px
        );
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 18px;
        padding: 8px 0;
    }
    .rs-tape-left  .rs-tape-scroll { animation: rsTapeDown 6s linear infinite; }
    .rs-tape-right .rs-tape-scroll { animation: rsTapeUp   6s linear infinite; }
    @keyframes rsTapeDown {
        from { transform: translateY(-50%); }
        to   { transform: translateY(0); }
    }
    @keyframes rsTapeUp {
        from { transform: translateY(0); }
        to   { transform: translateY(-50%); }
    }
    /* Glow states on the tape strips */
    .rs-tape.rs-tape-exceed {
        filter: drop-shadow(0 0 10px rgba(0,200,255,0.9)) drop-shadow(0 0 22px rgba(0,150,255,0.6));
    }
    .rs-tape.rs-tape-danger {
        filter: drop-shadow(0 0 10px rgba(255,40,40,0.9)) drop-shadow(0 0 22px rgba(255,0,0,0.6));
    }
    .rs-tape.rs-tape-retreat {
        filter: drop-shadow(0 0 10px rgba(40,220,80,0.9)) drop-shadow(0 0 22px rgba(0,180,40,0.6));
    }
    /* Scrolling text panels outside the tapes */
    .rs-tape-text {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 36px;
        overflow: hidden;
        pointer-events: none;
    }
    .rs-tape-text-left  { right: 52px; }
    .rs-tape-text-right { left: 0px; }
    .rs-tape-text-scroll {
        height: 200%;
        display: flex;
        flex-direction: column;
        will-change: transform;
    }
    .rs-tape-text-group {
        flex: 0 0 50%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-around;
    }
    .rs-tape-text-left  .rs-tape-text-scroll { animation: rsTapeDown 6s linear infinite; }
    .rs-tape-text-right .rs-tape-text-scroll { animation: rsTapeUp   6s linear infinite; }
    .rs-tape-text-word {
        writing-mode: vertical-lr;
        text-orientation: upright;
        font-family: 'Orbitron', sans-serif;
        font-size: 22px;
        font-weight: 900;
        letter-spacing: 0.15em;
        opacity: 0;
        transition: opacity 0.3s ease;
        user-select: none;
    }
    .rs-tape-text-left  .rs-tape-text-word { color: rgba(255,50,50,0.95);  text-shadow: 0 0 8px rgba(255,50,50,0.9),  0 0 20px rgba(255,0,0,0.7);   }
    .rs-tape-text-right .rs-tape-text-word { color: rgba(0,220,255,0.95);  text-shadow: 0 0 8px rgba(0,220,255,0.9),  0 0 20px rgba(0,180,255,0.7); }
    .rs-tape-text.rs-tape-danger .rs-tape-text-word,
    .rs-tape-text.rs-tape-exceed .rs-tape-text-word { opacity: 1; }
    .rs-tape-text-left.rs-tape-retreat  .rs-tape-text-word,
    .rs-tape-text-right.rs-tape-retreat .rs-tape-text-word {
        opacity: 1;
        color: rgba(40,220,80,0.95);
        text-shadow: 0 0 8px rgba(40,220,80,0.9), 0 0 20px rgba(0,180,40,0.7);
    }
    /* Tape colour shifts with state */
    .rs-tape.rs-tape-danger .rs-tape-scroll {
        background: repeating-linear-gradient(
            -45deg,
            rgba(255,40,40,0.85)  0px, rgba(255,40,40,0.85)  11px,
            transparent          11px, transparent           22px
        );
    }
    .rs-tape.rs-tape-exceed .rs-tape-scroll {
        background: repeating-linear-gradient(
            -45deg,
            rgba(0,200,255,0.85) 0px, rgba(0,200,255,0.85) 11px,
            transparent         11px, transparent          22px
        );
    }
    .rs-tape.rs-tape-retreat .rs-tape-scroll {
        background: repeating-linear-gradient(
            -45deg,
            rgba(40,200,80,0.85)  0px, rgba(40,200,80,0.85)  11px,
            transparent          11px, transparent           22px
        );
    }
    .rs-line {
        position: absolute;
        left: 0;
        top: 0;
        z-index: 15;
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
        0% { filter: brightness(1) saturate(0.9); opacity: 0.82; }
        50% { filter: brightness(1.25) saturate(1.1); opacity: 1; }
        100% { filter: brightness(1) saturate(0.9); opacity: 0.86; }
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
    /* Duel state tracker — no visual, just used for .rs-show class toggling */
    .rs-duel { display: none; }
    /* Smooth red flash overlay */
    #rs-duel-flash {
        position: absolute;
        inset: 0;
        background: transparent;
        pointer-events: none;
        z-index: 38;
    }
    #rs-duel-flash.rs-active {
        animation: rsDuelPulse 1s ease-in-out infinite;
    }
    @keyframes rsDuelPulse {
        0%, 100% { background: rgba(180, 0, 0, 0); }
        50%       { background: rgba(180, 0, 0, 0.26); }
    }
    /* Tape shake during duel */
    @keyframes rsTapeLeftShake {
        0%, 100% { transform: translateX(-100%); }
        25%      { transform: translateX(calc(-100% - 4px)); }
        75%      { transform: translateX(calc(-100% + 4px)); }
    }
    @keyframes rsTapeRightShake {
        0%, 100% { transform: none; }
        25%      { transform: translateX(-4px); }
        75%      { transform: translateX(4px); }
    }
    .rs-tape-left.rs-duel-shake  { animation: rsTapeLeftShake  0.14s ease-in-out infinite; }
    .rs-tape-right.rs-duel-shake { animation: rsTapeRightShake 0.14s ease-in-out infinite; }
    /* Portrait shake during duel */
    @keyframes rsPortraitLeftShake {
        0%, 100% { transform: translateX(0); }
        25%      { transform: translateX(-3px); }
        75%      { transform: translateX(3px); }
    }
    @keyframes rsPortraitRightShake {
        0%, 100% { transform: translateX(0); }
        25%      { transform: translateX(3px); }
        75%      { transform: translateX(-3px); }
    }
    #rs-portrait-left.rs-duel-shake  { animation: rsPortraitLeftShake  0.14s ease-in-out infinite; }
    #rs-portrait-right.rs-duel-shake { animation: rsPortraitRightShake 0.14s ease-in-out infinite; }
    /* Red tint on cylinder and bullets during duel */
    #rs-cylinder-container.rs-duel-red { filter: sepia(1) hue-rotate(320deg) saturate(6) brightness(0.9); }
    .rs-bullets.rs-duel-red { filter: hue-rotate(180deg) saturate(2.5); }
    /* Floating duel HUD above right portrait */
    #rs-duel-bar {
        position: absolute;
        right: 5%;
        bottom: 55%;
        width: min(26vw, 260px);
        display: none;
        flex-direction: column;
        align-items: center;
        gap: 7px;
        z-index: 30;
        pointer-events: none;
    }
    #rs-duel-bar.rs-show { display: flex; }
    .rs-duel-bar-title {
        font-size: clamp(16px, 2.4vh, 30px);
        font-weight: 900;
        letter-spacing: 0.12em;
        color: #fff;
        text-shadow: 0 0 14px rgba(255, 60, 60, 0.95), 0 0 32px rgba(255, 0, 0, 0.55);
    }
    .rs-duel-bar-sub {
        font-size: clamp(9px, 1.2vh, 13px);
        letter-spacing: 0.06em;
        color: rgba(255,255,255,0.72);
        text-align: center;
    }
    .rs-duel-bar-meter {
        width: 100%;
        height: 11px;
        border: 1px solid rgba(255,255,255,0.38);
        background: rgba(255,255,255,0.1);
    }
    .rs-duel-bar-fill {
        width: 0%;
        height: 100%;
        background: linear-gradient(90deg, #ff6a6a, #ffd2d2);
        transition: width 0.07s ease;
    }
    .rs-duel-bar-count {
        font-size: clamp(13px, 1.9vh, 22px);
        font-weight: 800;
        letter-spacing: 0.08em;
        color: #fff;
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
        overflow: hidden;
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
        overflow: hidden;
        display: grid;
        gap: 6px;
        padding: 10px 12px;
    }
    /* ── Gameplay truth blade sword items ──────────────────────────── */
    #${RS_ID} .rs-bullet {
        -webkit-appearance: none;
        appearance: none;
        position: relative;
        overflow: hidden;
        display: flex;
        align-items: center;
        padding: 0;
        background: transparent;
        border: none;
        cursor: pointer;
    }
    #${RS_ID} .rs-bullet-handle {
        position: relative;
        z-index: 3;
        flex-shrink: 0;
        width: 36px;
        height: 8px;
        background: linear-gradient(180deg, #3a2010 0%, #5c3418 50%, #3a2010 100%);
        border-radius: 3px 0 0 3px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.82);
        transition: translate 0.14s cubic-bezier(0.22, 0.8, 0.44, 1);
    }
    #${RS_ID} .rs-bullet-handle::after {
        content: '';
        position: absolute;
        inset: 1px 4px;
        background: repeating-linear-gradient(
            90deg,
            rgba(170,100,40,0.55) 0px, rgba(170,100,40,0.55) 2px,
            transparent 2px, transparent 4px
        );
    }
    #${RS_ID} .rs-bullet-tsuba {
        position: relative;
        z-index: 3;
        flex-shrink: 0;
        width: 5px;
        height: 22px;
        background: linear-gradient(180deg, #6a5818, #b89428, #e0bc40, #b89428, #6a5818);
        border-radius: 2px;
        margin-left: -1px;
        box-shadow: 0 0 6px rgba(200,170,50,0.5), 0 2px 4px rgba(0,0,0,0.7);
        transition: translate 0.14s cubic-bezier(0.22, 0.8, 0.44, 1);
    }
    #${RS_ID} .rs-bullet-scabbard {
        position: relative;
        z-index: 2;
        flex: 1;
        height: 22px;
        background: linear-gradient(180deg, #3a0404 0%, #240000 50%, #340404 100%);
        border-radius: 0 5px 5px 0;
        display: flex;
        align-items: center;
        padding: 0 10px 0 6px;
        box-shadow:
            inset 0 1px 0 rgba(150,30,30,0.15),
            inset 0 -1px 0 rgba(0,0,0,0.55),
            inset 2px 0 4px rgba(0,0,0,0.45),
            2px 2px 8px rgba(0,0,0,0.55);
        transition: background 0.18s ease, box-shadow 0.18s ease;
    }
    #${RS_ID} .rs-bullet-scabbard-label {
        font-size: clamp(10px, 1.35vh, 15px);
        font-weight: 700;
        letter-spacing: 0.05em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
        pointer-events: none;
        user-select: none;
        color: rgba(180,100,80,0.52);
        transition: color 0.18s ease, text-shadow 0.18s ease;
    }
    #${RS_ID} .rs-bullet.rs-selected .rs-bullet-scabbard {
        background: linear-gradient(180deg, #7a0a0a 0%, #560000 50%, #6e0808 100%);
        box-shadow:
            inset 0 1px 0 rgba(220,70,70,0.28),
            inset 0 -1px 0 rgba(0,0,0,0.55),
            inset 2px 0 5px rgba(0,0,0,0.45),
            3px 3px 10px rgba(0,0,0,0.65);
    }
    #${RS_ID} .rs-bullet.rs-selected .rs-bullet-scabbard-label {
        color: rgba(255,218,198,0.96);
        text-shadow: 0 0 10px rgba(255,100,60,0.52);
    }
    /* Blade: handle(36) + tsuba(5) - overlap(1) = left:40. Translate keeps it hidden under grip+scabbard. */
    #${RS_ID} .rs-bullet-blade {
        position: absolute;
        left: 40px;
        width: calc(100% - 40px);
        top: 50%;
        z-index: 1;
        height: 12px;
        background: linear-gradient(90deg,
            #708898 0%, #aacce0 20%, #d4eeff 52%, #b8d8ee 76%, #607888 100%
        );
        clip-path: polygon(0% 0%, calc(100% - 8px) 0%, 100% 50%, calc(100% - 8px) 100%, 0% 100%);
        transform: translateY(-50%) translateX(-28px);
        transition: box-shadow 0.14s ease;
        box-shadow: none;
        pointer-events: none;
    }
    /* Unshethe: grip shifts left, opening a gap between tsuba and scabbard where the blade is revealed */
    #${RS_ID} #rs-bullets.rs-charged .rs-bullet.rs-selected .rs-bullet-handle,
    #${RS_ID} #rs-bullets.rs-charged .rs-bullet.rs-selected .rs-bullet-tsuba {
        translate: -28px 0;
    }
    #${RS_ID} #rs-bullets.rs-charged .rs-bullet.rs-selected .rs-bullet-blade {
        box-shadow: 0 0 10px rgba(160,230,255,0.88), 0 0 24px rgba(130,200,255,0.42);
    }
    .rs-between {
        position: absolute;
        inset: 0;
        z-index: 35;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0,0,0,0.74);
        opacity: 0;
        pointer-events: none;
        transition: opacity 280ms ease;
    }
    .rs-between.rs-show { opacity: 1; pointer-events: auto; }
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
    /* Verdict text framed in aa-panel.png, matching the trial victory panels.
     * The image sits on a ::before pseudo so the theme hue-shift filter only
     * touches the panel art, leaving the win/loss glow crisp. */
    .rs-result-panel {
        position: relative;
        padding: 56px 96px;
        white-space: pre-line;
    }
    .rs-result-panel::before {
        content: "";
        position: absolute;
        inset: 0;
        background-image: url("${panelImg}");
        background-size: 100% 100%;
        background-repeat: no-repeat;
        pointer-events: none;
        z-index: -1;
        filter: var(--dgn-overlay-filter, none);
    }
    .rs-result.rs-win {
        color: #b4f6ff;
    }
    .rs-result.rs-loss {
        color: #ff9a9a;
    }
    /* ── Revolver cylinder (bottom-left) ────────────────────────── */
    #rs-cylinder-container {
        position: absolute;
        bottom: -40px;
        left: 30px;
        z-index: 24;
        rotate: -5deg;
        transform-origin: left bottom;
        pointer-events: none;
    }
    #rs-cylinder-container .dangan-cylinder-wrap {
        position: relative;
        width: 320px;
        height: 320px;
        z-index: 0;
    }
    #rs-cylinder-container .dangan-cylinder-index {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-family: 'Orbitron', sans-serif;
        font-size: 36px;
        font-weight: 900;
        color: #00ffff;
        text-shadow:
            0 0 12px rgba(0,255,255,0.9),
            0 0 30px rgba(0,200,255,0.6),
            2px 2px 4px rgba(0,0,0,0.9);
        letter-spacing: 0.05em;
        pointer-events: none;
        z-index: 2;
        transition: color 0.25s ease, text-shadow 0.25s ease;
    }
    #rs-cylinder-container .dangan-cylinder-img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        pointer-events: none;
        transform-origin: center;
        filter:
            sepia(1) hue-rotate(150deg) saturate(6) brightness(1.2)
            drop-shadow(0 0 18px rgba(0,255,255,0.75))
            drop-shadow(0 0 45px rgba(0,200,255,0.45));
        opacity: 0.88;
        transition: filter 0.25s ease;
    }
    #rs-cylinder-container .dangan-bullet-cartridge {
        position: absolute;
        top: calc(50% - 2px);
        transform: translateY(-50%);
        left: 210px;
        height: 36px;
        min-width: 300px;
        padding: 0 48px 0 40px;
        z-index: 1;
        display: flex;
        align-items: center;
        background: linear-gradient(
            90deg,
            rgba(0,28,42,0.97)   0%,
            rgba(0,90,120,0.98)  22%,
            rgba(0,175,200,0.99) 55%,
            rgba(0,155,185,0.98) 80%,
            rgba(0,110,140,0.97) 100%
        );
        border-radius: 36px 58px 58px 36px;
        border: 1px solid rgba(0,255,255,0.35);
        box-shadow:
            inset 0 2px 0 rgba(180,255,255,0.18),
            inset 0 -1px 0 rgba(0,0,0,0.3),
            0 0 18px rgba(0,255,255,0.35),
            4px 8px 28px rgba(0,0,0,0.75);
    }
    #rs-cylinder-container .dangan-bullet-cartridge--adj {
        opacity: 0;
        pointer-events: none;
        scale: 0.88;
        filter: brightness(0.7);
        transition: opacity 0.4s ease;
    }
    #rs-cylinder-container .dangan-bullet-cartridge--above {
        transform: translateY(calc(-50% - 44px));
    }
    #rs-cylinder-container .dangan-bullet-cartridge--below {
        transform: translateY(calc(-50% + 44px));
    }
    #rs-cylinder-container .dangan-bullet-cartridge::before {
        content: '';
        position: absolute;
        top: 0;
        left: 28px;
        right: 48px;
        height: 44%;
        background: linear-gradient(to bottom, rgba(180,255,255,0.14), transparent);
        border-radius: 0 0 50% 50%;
        pointer-events: none;
    }
    #rs-cylinder-container .dangan-bullet-cartridge-name {
        color: #fff8f4;
        font-family: 'Palatino Linotype', 'Book Antiqua', 'Palatino', Georgia, serif;
        font-size: 22px;
        font-weight: 400;
        white-space: nowrap;
        text-shadow:
            0 0 18px rgba(0,255,255,0.7),
            2px 2px 6px rgba(0,0,0,0.95),
            -1px -1px 0 rgba(0,0,0,0.7);
        letter-spacing: 0.02em;
        transition: opacity 0.2s ease;
    }
    /* ── Circular progress ring inside cylinder ─────────────────── */
    #rs-cylinder-container .rs-cyl-progress {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) skewX(8deg) skewY(14deg);
        width: 58%;
        height: 58%;
        pointer-events: none;
        z-index: 3;
        overflow: visible;
    }
    .rs-cyl-progress-bg {
        fill: none;
        stroke: rgba(255,255,255,0.1);
        stroke-width: 7;
    }
    .rs-cyl-progress-ring {
        fill: none;
        stroke: #00ffff;
        stroke-width: 7;
        stroke-linecap: round;
        stroke-dasharray: 251.3;
        stroke-dashoffset: 251.3;
        transform-origin: 50% 50%;
        transform: rotate(-90deg);
        transition: stroke 0.25s ease;
    }
    #rs-cylinder-container .dangan-cylinder-index {
        transition: opacity 0.2s ease, color 0.25s ease, text-shadow 0.25s ease;
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
    /* ── Blade Intro ─────────────────────────────────────────────── */
    #rs-intro {
        position: absolute;
        inset: 0;
        z-index: 50;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: rgba(8, 0, 22, 0.93);
        backdrop-filter: blur(2px);
        opacity: 0;
        transition: opacity 260ms ease;
    }
    #rs-intro.rs-on { opacity: 1; }
    .rs-intro-title {
        font-size: clamp(20px, 3.2vh, 40px);
        font-weight: 900;
        letter-spacing: 0.18em;
        margin-bottom: 6px;
        text-shadow: 0 0 28px rgba(160,100,255,0.9), 0 0 60px rgba(120,60,220,0.5);
    }
    .rs-intro-sub {
        font-size: clamp(10px, 1.4vh, 15px);
        letter-spacing: 0.12em;
        color: rgba(255,255,255,0.52);
        margin-bottom: 38px;
    }
    .rs-intro-list {
        display: flex;
        flex-direction: column;
        gap: 14px;
        align-items: flex-start;
    }
    .rs-intro-item {
        display: flex;
        align-items: center;
        cursor: pointer;
        opacity: 0;
        animation: rsIntroSlideIn 0.38s ease calc(var(--i) * 0.08s) forwards;
        transition: translate 0.16s ease;
    }
    @keyframes rsIntroSlideIn {
        from { opacity: 0; translate: -50px 0; }
        to   { opacity: 1; translate: 0 0; }
    }
    /* ── Handle ──────────────────────────────────────────────────── */
    .rs-intro-handle {
        position: relative;
        z-index: 3;
        flex-shrink: 0;
        width: 52px;
        height: 12px;
        background: linear-gradient(180deg, #3a2010 0%, #5c3418 50%, #3a2010 100%);
        border-radius: 3px 0 0 3px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.82);
        transition: translate 0.14s cubic-bezier(0.22, 0.8, 0.44, 1);
    }
    .rs-intro-handle::after {
        content: '';
        position: absolute;
        inset: 2px 5px;
        background: repeating-linear-gradient(
            90deg,
            rgba(170,100,40,0.55) 0px, rgba(170,100,40,0.55) 3px,
            transparent 3px, transparent 6px
        );
    }
    /* ── Tsuba (guard) ───────────────────────────────────────────── */
    .rs-intro-tsuba {
        position: relative;
        z-index: 3;
        flex-shrink: 0;
        transition: translate 0.14s cubic-bezier(0.22, 0.8, 0.44, 1);
        width: 7px;
        height: 36px;
        background: linear-gradient(180deg, #6a5818, #b89428, #e0bc40, #b89428, #6a5818);
        border-radius: 3px;
        margin-left: -1px;
        box-shadow: 0 0 10px rgba(200,170,50,0.6), 0 2px 6px rgba(0,0,0,0.7);
    }
    /* ── Scabbard ─────────────────────────────────────────────────── */
    .rs-intro-scabbard {
        position: relative;
        z-index: 2;
        flex-shrink: 0;
        width: 250px;
        height: 28px;
        background: linear-gradient(180deg, #7a0a0a 0%, #560000 50%, #6e0808 100%);
        border-radius: 0 8px 8px 0;
        display: flex;
        align-items: center;
        padding: 0 16px 0 8px;
        box-shadow:
            inset 0 1px 0 rgba(220,70,70,0.28),
            inset 0 -1px 0 rgba(0,0,0,0.55),
            inset 2px 0 5px rgba(0,0,0,0.45),
            3px 3px 12px rgba(0,0,0,0.65);
        transition: background 0.22s ease, box-shadow 0.22s ease;
    }
    /* Longitudinal groove */
    .rs-intro-scabbard::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 10px;
        right: 20px;
        height: 1px;
        transform: translateY(-1px);
        background: rgba(0,0,0,0.35);
        pointer-events: none;
    }
    .rs-intro-scabbard::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 10px;
        right: 20px;
        height: 1px;
        transform: translateY(1px);
        background: rgba(200,60,60,0.22);
        pointer-events: none;
    }
    .rs-intro-item:not(.rs-active) .rs-intro-scabbard {
        background: linear-gradient(180deg, #3a0404 0%, #240000 50%, #340404 100%);
        box-shadow:
            inset 0 1px 0 rgba(150,30,30,0.15),
            inset 0 -1px 0 rgba(0,0,0,0.55),
            inset 2px 0 5px rgba(0,0,0,0.45),
            3px 3px 12px rgba(0,0,0,0.55);
    }
    /* ── Scabbard label ──────────────────────────────────────────── */
    .rs-intro-scabbard-label {
        font-family: "Noto Sans JP", sans-serif;
        font-size: clamp(11px, 1.45vh, 15px);
        font-weight: 700;
        letter-spacing: 0.05em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
        pointer-events: none;
        user-select: none;
        color: rgba(180,100,80,0.52);
        transition: color 0.22s ease, text-shadow 0.22s ease;
    }
    .rs-intro-item.rs-active .rs-intro-scabbard-label {
        color: rgba(255,218,198,0.96);
        text-shadow: 0 0 10px rgba(255,100,60,0.52);
    }
    /* ── Blade — absolute, slides out from under scabbard ───────── */
    /* Measurements: handle=52px, tsuba=7px (−1px overlap) → scabbard starts at x≈58 */
    .rs-intro-blade {
        position: absolute;
        left: 58px;
        top: 50%;
        z-index: 1;
        width: 280px;
        height: 12px;
        background: linear-gradient(90deg,
            #708898 0%, #aacce0 20%, #d4eeff 52%, #b8d8ee 76%, #607888 100%
        );
        clip-path: polygon(0% 0%, calc(100% - 14px) 0%, 100% 50%, calc(100% - 14px) 100%, 0% 100%);
        /* Fully under handle + scabbard: left end at x=15 (behind handle), tip at x=295 (behind scabbard) */
        transform: translateY(-50%) translateX(-50px);
        transition: transform 0.14s cubic-bezier(0.22, 0.8, 0.44, 1), box-shadow 0.28s ease;
        box-shadow: none;
        pointer-events: none;
    }
    .rs-intro-item.rs-active .rs-intro-handle,
    .rs-intro-item.rs-active .rs-intro-tsuba {
        translate: -40px 0;
    }
    .rs-intro-item.rs-active .rs-intro-blade {
        /* Grip shifts left 40px, opening a gap between tsuba and scabbard where the blade is revealed */
        transform: translateY(-50%) translateX(-50px);
        box-shadow: 0 0 14px rgba(160,230,255,0.88), 0 0 38px rgba(130,200,255,0.42);
    }
    .rs-intro-hint {
        margin-top: 30px;
        font-size: clamp(10px, 1.3vh, 14px);
        letter-spacing: 0.1em;
        color: rgba(255,255,255,0.36);
    }
    /* ── Top-left HUD (speaker / dots / concentrate) ─────────── */
    #rs-hud-top-left {
        position: absolute;
        top: 18px;
        left: 24px;
        display: flex;
        flex-direction: column;
        gap: 5px;
        z-index: 20;
        pointer-events: none;
    }
    #rs-speaker-name {
        font-size: clamp(22px, 3.2vh, 36px);
        font-weight: 900;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: #00ffff;
        text-shadow: 0 0 15px rgba(0,255,255,0.6), 2px 2px 0 rgba(0,0,0,0.8);
        background: rgba(0,255,255,0.12);
        padding: 5px 18px;
        line-height: 1;
    }
    #rs-section-dots {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        padding-left: 22px;
        padding-top: 3px;
    }
    .rs-section-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: rgba(180,180,180,0.35);
        border: 1px solid rgba(255,255,255,0.2);
        flex-shrink: 0;
        transition: background 0.3s ease, box-shadow 0.3s ease;
    }
    .rs-section-dot.rs-dot-active {
        background: #ffd700;
        border-color: #ffec6e;
        box-shadow: 0 0 6px 2px rgba(255,215,0,0.85), 0 0 14px 4px rgba(255,200,0,0.5);
    }
    #rs-concentrate-wrap {
        padding-left: 22px;
        padding-top: 5px;
        display: flex;
        flex-direction: column;
        gap: 3px;
    }
    #rs-concentrate-label {
        font-size: 10px;
        letter-spacing: 0.15em;
        color: rgba(255,255,255,0.55);
    }
    #rs-concentrate-track {
        width: 140px;
        height: 5px;
        background: rgba(255,255,255,0.12);
        border: 1px solid rgba(255,255,255,0.22);
    }
    #rs-concentrate-fill {
        height: 100%;
        width: 100%;
        background: linear-gradient(90deg, #00ccff, #88eeff);
        transition: width 0.06s linear;
    }
    /* ── Timer ──────────────────────────────────────────────────── */
    #rs-timer-area {
        position: absolute;
        bottom: 22px;
        right: 22px;
        z-index: 22;
        text-align: right;
        pointer-events: none;
    }
    #rs-timer-label {
        font-size: 11px;
        letter-spacing: 0.18em;
        color: rgba(255,255,255,0.52);
        margin-bottom: 2px;
    }
    #rs-timer {
        font-family: "Orbitron", "Impact", monospace;
        font-size: clamp(28px, 4vh, 46px);
        font-weight: 900;
        letter-spacing: 3px;
        color: #ffaa00;
        text-shadow: 0 0 12px rgba(255,140,0,0.7), 0 0 3px rgba(255,200,0,0.9);
    }
    #rs-timer.rs-timer-urgent {
        color: #ff2222;
        text-shadow: 0 0 16px rgba(255,0,0,1), 0 0 4px rgba(255,100,100,0.9);
        animation: rsTimerBlink 0.45s ease-in-out infinite;
    }
    @keyframes rsTimerBlink {
        0%, 100% { opacity: 1; }
        50%       { opacity: 0.3; }
    }
    /* ── Character portraits ─────────────────────────────────────── */
    /* Spotlights — fixed halves, never move with the portrait margin */
    .rs-spotlight {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 50%;
        pointer-events: none;
        z-index: 5;
    }
    #rs-spotlight-left {
        left: 0;
        background:
            radial-gradient(ellipse 80% 120% at 50% -5%,
                rgba(200, 0, 0, 0.75) 0%,
                rgba(180, 0, 0, 0.49) 30%,
                rgba(140, 0, 0, 0.23) 55%,
                transparent 75%
            ),
            radial-gradient(ellipse 80% 120% at 50% 105%,
                rgba(200, 0, 0, 0.75) 0%,
                rgba(180, 0, 0, 0.49) 30%,
                rgba(140, 0, 0, 0.23) 55%,
                transparent 75%
            );
        animation: rsRedSpotPulse 1.1s ease-in-out infinite alternate;
    }
    #rs-spotlight-right {
        right: 0;
        background:
            radial-gradient(ellipse 80% 120% at 50% -5%,
                rgba(0, 80, 200, 0.75) 0%,
                rgba(0, 60, 180, 0.49) 30%,
                rgba(0, 40, 140, 0.23) 55%,
                transparent 75%
            ),
            radial-gradient(ellipse 80% 120% at 50% 105%,
                rgba(0, 80, 200, 0.75) 0%,
                rgba(0, 60, 180, 0.49) 30%,
                rgba(0, 40, 140, 0.23) 55%,
                transparent 75%
            );
        animation: rsBlueSpotPulse 1.1s ease-in-out infinite alternate;
    }
    @keyframes rsRedSpotPulse {
        0%   { opacity: 0.55; }
        100% { opacity: 0.75; }
    }
    @keyframes rsBlueSpotPulse {
        0%   { opacity: 0.55; }
        100% { opacity: 0.75; }
    }
    @keyframes rsPortraitCamLeft {
        0%   { transform: scale(1.0)  translateX(18px) translateY(0px); }
        40%  { transform: scale(1.12) translateX(-10px) translateY(-8px); }
        100% { transform: scale(1.06) translateX(6px)  translateY(4px); }
    }
    @keyframes rsPortraitCamRight {
        0%   { transform: scale(1.0)  translateX(-18px) translateY(0px); }
        40%  { transform: scale(1.12) translateX(10px)  translateY(-8px); }
        100% { transform: scale(1.06) translateX(-6px)  translateY(4px); }
    }
    .rs-portrait {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 50%;
        pointer-events: none;
        overflow: visible;
        transition: margin 0.35s ease;
    }
    #rs-portrait-left  { left: 0;  z-index: 6; }
    #rs-portrait-right { right: 0; z-index: 7; }
    .rs-portrait img {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 85vh; /* overridden per-character by JS */
        object-fit: contain;
        object-position: bottom center;
    }
    #rs-portrait-left img {
        filter: drop-shadow(0 0 18px rgba(180,0,0,0.65));
        transform-origin: center bottom;
        animation: rsPortraitCamLeft 13s ease-in-out infinite alternate;
    }
    #rs-portrait-right img {
        filter: drop-shadow(0 0 18px rgba(0,40,220,0.6));
        transform-origin: center bottom;
        animation: rsPortraitCamRight 11s ease-in-out 2s infinite alternate;
    }
    .rs-portrait-name {
        position: absolute;
        bottom: 6px;
        left: 0;
        right: 0;
        text-align: center;
        font-family: "Noto Sans JP", sans-serif;
        font-size: clamp(9px, 1.2vh, 13px);
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: rgba(255,255,255,0.82);
        text-shadow: 0 0 8px rgba(0,0,0,1), 0 1px 3px rgba(0,0,0,0.9);
        z-index: 2;
        pointer-events: none;
    }
    /* ── Time-gain popup ────────────────────────────────────────── */
    .rs-time-gain {
        position: absolute;
        font-family: "Noto Sans JP", "Orbitron", sans-serif;
        font-weight: 900;
        font-size: clamp(16px, 2.4vh, 28px);
        color: #00ffff;
        text-shadow:
            0 0 14px rgba(0,255,255,0.95),
            0 0 28px rgba(0,200,255,0.6),
            0 2px 4px rgba(0,0,0,0.85);
        pointer-events: none;
        z-index: 34;
        white-space: nowrap;
        transform: translate(-50%, -50%);
        animation: rsTimeGain 1.1s ease-out forwards;
    }
    @keyframes rsTimeGain {
        0%   { opacity: 1;   transform: translate(-50%, -50%)  scale(1.25); }
        18%  { opacity: 1;   transform: translate(-50%, -85%)  scale(1.0); }
        100% { opacity: 0;   transform: translate(-50%, -175%) scale(0.78); }
    }
    /* ── Concentrate overlay ─────────────────────────────────────── */
    #rs-concentrate-overlay {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 28;
        overflow: hidden;
        opacity: 0;
        transition: opacity 180ms ease;
    }
    #rs-concentrate-overlay.rs-active { opacity: 1; }
    #rs-con-bt-vfx {
        position: absolute;
        inset: 0;
        background: radial-gradient(ellipse at center, rgba(0,160,30,0.12) 0%, rgba(0,90,15,0.28) 100%);
        mix-blend-mode: screen;
        pointer-events: none;
    }
    #rs-con-alert-rows {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        justify-content: space-evenly;
        overflow: hidden;
        opacity: 0.2;
    }
    /* ── Rebuttal interjection cinematic ──────────────────────────── */
    #rs-interjection-wrap {
        position: absolute;
        inset: 0;
        z-index: 100;
        pointer-events: none;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .rs-interjection-img {
        position: absolute;
        left: 0;
        bottom: 0;
        width: 100%;
        height: auto;
        object-fit: contain;
        object-position: bottom left;
        will-change: transform, opacity;
    }
    .rs-interjection-sprite {
        position: absolute;
        bottom: 0;
        left: 50%;
        transform-origin: bottom center;
        height: 65vh;
        object-fit: contain;
        object-position: bottom center;
        will-change: transform, opacity;
        filter: drop-shadow(0 0 28px rgba(255,180,0,0.8)) drop-shadow(0 0 60px rgba(255,100,0,0.5));
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
    getSpriteUrl = null,
    getUserAvatarUrl = null,
    getPromeSpritePack = null,
    getCharacterHeightCm = null,
    onWin = null,
} = {}) {
    const RS_UI_SELECTORS = ['#top-bar', '#top-settings-holder', '#sheld', '#right-nav-panel', '#dangan-vn-overlay', '#dangan-group-chat-stage', '#dangan-trial-pre-debate-notif', '#dangan_monopad_button', '#dangan-level-bar', '#dangan-bgm-display', '#dangan-chapter-label', '#dangan-trial-context-panel'];
    const rsHiddenEls = new Map();

    function fadeOutChatUI() {
        document.body.classList.add('dangan-minigame-active');
        for (const sel of RS_UI_SELECTORS) {
            const el = document.querySelector(sel);
            if (!el) continue;
            rsHiddenEls.set(sel, el.style.display || '');
            el.style.transition = 'opacity 0.4s ease';
            el.style.opacity = '0';
            el.style.pointerEvents = 'none';
            setTimeout(() => { if (el) el.style.display = 'none'; }, 420);
        }
        const vnWrapper = document.querySelector('#visual-novel-wrapper');
        if (vnWrapper) vnWrapper.style.visibility = 'hidden';
    }

    function fadeInChatUI() {
        document.body.classList.remove('dangan-minigame-active');
        for (const sel of RS_UI_SELECTORS) {
            const el = document.querySelector(sel);
            if (!el) continue;
            const orig = rsHiddenEls.get(sel) ?? '';
            el.style.display = orig;
            el.style.opacity = '0';
            el.style.pointerEvents = '';
            requestAnimationFrame(() => requestAnimationFrame(() => {
                el.style.transition = 'opacity 0.4s ease';
                el.style.opacity = '';
            }));
        }
        rsHiddenEls.clear();
        const vnWrapper = document.querySelector('#visual-novel-wrapper');
        if (vnWrapper) vnWrapper.style.visibility = '';
    }

    function destroy() {
        document.body.classList.remove('dangan-rs-active');
        fadeInChatUI();
        document.getElementById(RS_ID)?.remove();
        document.getElementById(RS_STYLE)?.remove();
    }

    async function run({
        opponentName = null,
        playerName = null,
        phaseOneLines: phaseOneLinesParam = null,
        initialTimeMs: initialTimeMsParam = null,
        cutTarget: cutTargetParam = null,
        maxBullets: maxBulletsParam = null,
    } = {}) {
        destroy();
        ensureNotoSansJP();

        const styleEl = document.createElement("style");
        styleEl.id = RS_STYLE;
        styleEl.textContent = buildStyles(extensionFolderPath);
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
        const maxBullets = (typeof maxBulletsParam === 'number' && maxBulletsParam > 0) ? maxBulletsParam : null;
        const opponentFirstName = opponentName ? opponentName.trim().split(/\s+/)[0].toUpperCase() : 'CUTTING';

        // ── Audio ────────────────────────────────────────────────────────────
        const SFX_BASE = `${(extensionFolderPath || '').replace(/\\/g, '/')}/assets/sfx/rebuttal`;
        const BGM_PATH = `${(extensionFolderPath || '').replace(/\\/g, '/')}/assets/bgm/Argument -Blade Lock-.mp3`;
        let _bgm = null;

        function playSfx(filename) {
            const a = new Audio(`${SFX_BASE}/${filename}`);
            a.play().catch(() => {});
        }
        function startBgm() {
            if (_bgm) return;
            _bgm = new Audio(BGM_PATH);
            _bgm.loop = true;
            _bgm.play().catch(() => {});
        }
        function stopBgm() {
            if (!_bgm) return;
            _bgm.pause();
            _bgm.src = '';
            _bgm = null;
        }
        // ─────────────────────────────────────────────────────────────────────
        const bladeOptions = (allBullets.length ? allBullets : fallbackBullets).slice(0, maxBullets ?? undefined);
        const weakPointBlade = bladeOptions[Math.min(2, bladeOptions.length - 1)];
        const weakPointNorm = normalizeLabel(weakPointBlade.title);

        const overlay = document.createElement("div");
        overlay.id = RS_ID;
        overlay.innerHTML = `
            <div class="rs-top">
                <div class="rs-stats">
                    <div class="rs-pill" id="rs-phase-label">PHASE 1 · CUTTING</div>
                    <div class="rs-pill" id="rs-cut-label">CUTS 0 / 7</div>
                    <div class="rs-pill" id="rs-miss-label">MISSES 0 / 4</div>
                </div>
            </div>
            <div class="rs-main">
                <div class="rs-arena" id="rs-arena"></div>
                <div class="rs-struggle" id="rs-struggle">
                    <div class="rs-tape rs-tape-left"  id="rs-tape-left"></div>
                    <div class="rs-tape rs-tape-right" id="rs-tape-right"></div>
                    <div class="rs-tape-text rs-tape-text-left"  id="rs-tape-text-left"></div>
                    <div class="rs-tape-text rs-tape-text-right" id="rs-tape-text-right"></div>
                </div>
                <div class="rs-cursor" id="rs-cursor"></div>
                <div class="rs-blade" id="rs-blade"></div>
                <div class="rs-slash" id="rs-slash"></div>
                <div class="rs-duel" id="rs-duel"></div>
                <div id="rs-duel-flash"></div>
                <div id="rs-duel-bar">
                    <div class="rs-duel-bar-meter"><div class="rs-duel-bar-fill" id="rs-duel-bar-fill"></div></div>
                    <div class="rs-duel-bar-count" id="rs-duel-bar-count">0 / 18</div>
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
                <div id="rs-cylinder-container"></div>
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
                <div class="rs-result" id="rs-result"><div class="rs-result-panel"></div></div>
                <div class="rs-spotlight" id="rs-spotlight-left"></div>
                <div class="rs-spotlight" id="rs-spotlight-right"></div>
                <div class="rs-portrait" id="rs-portrait-left">
                    <img id="rs-portrait-left-img" alt="" />
                </div>
                <div class="rs-portrait" id="rs-portrait-right">
                    <img id="rs-portrait-right-img" alt="" />
                </div>
                <div id="rs-concentrate-overlay"></div>
                <div id="rs-hud-top-left">
                    <div id="rs-speaker-name">${opponentFirstName}</div>
                    <div id="rs-section-dots"></div>
                    <div id="rs-concentrate-wrap">
                        <div id="rs-concentrate-label">CONCENTRATE</div>
                        <div id="rs-concentrate-track"><div id="rs-concentrate-fill"></div></div>
                    </div>
                </div>
                <div id="rs-timer-area">
                    <div id="rs-timer-label">TIME</div>
                    <div id="rs-timer">30.00</div>
                </div>
            </div>
        `;
        document.body.classList.add('dangan-rs-active');
        document.body.appendChild(overlay);
        fadeOutChatUI();
        requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add("rs-on")));

        // Stop any Dynamic Audio BGM immediately (e.g. interjection music)
        const dynBgm = document.getElementById('audio_bgm');
        if (dynBgm instanceof HTMLAudioElement && !dynBgm.paused) {
            dynBgm.pause();
        }

        // Play intro SFX, then start RS BGM after 2.5 seconds
        playSfx('rebuttal-showdown-intro-noise.wav');
        setTimeout(() => startBgm(), 2500);

        const arena = overlay.querySelector("#rs-arena");
        const struggleEl = overlay.querySelector("#rs-struggle");
        const cursorEl = overlay.querySelector("#rs-cursor");
        const bladeEl = overlay.querySelector("#rs-blade");
        const slashEl = overlay.querySelector("#rs-slash");
        const duelEl      = overlay.querySelector("#rs-duel");
        const duelFlashEl = overlay.querySelector("#rs-duel-flash");
        const duelBarEl   = overlay.querySelector("#rs-duel-bar");
        const duelFillEl  = overlay.querySelector("#rs-duel-bar-fill");
        const duelCountEl = overlay.querySelector("#rs-duel-bar-count");
        const betweenEl = overlay.querySelector("#rs-between");
        const betweenInput = overlay.querySelector("#rs-between-input");
        const betweenContinueBtn = overlay.querySelector("#rs-between-continue");
        const weakEl = overlay.querySelector("#rs-weak");
        const panelEl = overlay.querySelector("#rs-panel");
        const argLinesEl = overlay.querySelector("#rs-arg-lines");
        const bulletsEl = overlay.querySelector("#rs-bullets");
        const cylinderContainerEl = overlay.querySelector("#rs-cylinder-container");
        const phaseLabelEl = overlay.querySelector("#rs-phase-label");
        const cutLabelEl = overlay.querySelector("#rs-cut-label");
        const missLabelEl = overlay.querySelector("#rs-miss-label");
        const counterEl = overlay.querySelector("#rs-counter");
        const counterImgEl = overlay.querySelector("#rs-counter-img");
        const resultEl = overlay.querySelector("#rs-result");
        const resultPanelEl = overlay.querySelector(".rs-result-panel");
        const counterBannerSrc = `${(extensionFolderPath || "").replace(/\\/g, "/")}/assets/classtrial/counter.png`;
        if (counterImgEl) counterImgEl.src = counterBannerSrc;
        const speakerNameEl       = overlay.querySelector("#rs-speaker-name");
        const sectionDotsEl       = overlay.querySelector("#rs-section-dots");
        const concentrateFillEl   = overlay.querySelector("#rs-concentrate-fill");
        const concentrateOverlay  = overlay.querySelector("#rs-concentrate-overlay");
        if (concentrateOverlay) {
            const btVfx = document.createElement('div');
            btVfx.id = 'rs-con-bt-vfx';
            const btAlert = document.createElement('div');
            btAlert.id = 'rs-con-alert-rows';
            const alertBox = `<div class="hg-alert-box"><div class="hg-alert-word">ALERT</div><div class="hg-alert-concentrating">CONCENTRATING</div></div>`;
            const rowContent = alertBox.repeat(36);
            btAlert.innerHTML = Array.from({ length: 14 }, (_, i) =>
                `<div class="hg-alert-row hg-alert-row-${i % 2 === 0 ? 'l' : 'r'}">${rowContent}</div>`
            ).join('');
            concentrateOverlay.appendChild(btVfx);
            concentrateOverlay.appendChild(btAlert);
        }
        const timerEl             = overlay.querySelector("#rs-timer");
        const portraitLeftImg     = overlay.querySelector("#rs-portrait-left-img");
        const portraitRightImg    = overlay.querySelector("#rs-portrait-right-img");
        const portraitLeftEl      = overlay.querySelector("#rs-portrait-left");
        const portraitRightEl     = overlay.querySelector("#rs-portrait-right");
        const portraitLeftName    = null; // removed
        const portraitRightName   = null; // removed

        const phaseOneLines = (Array.isArray(phaseOneLinesParam) && phaseOneLinesParam.length)
            ? phaseOneLinesParam
            : buildStubPhaseOneLines();
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
        const cutTarget = (typeof cutTargetParam === 'number' && cutTargetParam > 0)
            ? Math.min(cutTargetParam, totalPhaseOneChunks)
            : Math.min(9, totalPhaseOneChunks);
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
        let rsCylAngle = 0;
        let rsCylTarget = 0;
        let rsCylRaf = null;
        // Slow-mo (concentrate)
        const BT_DRAIN_RATE    = 1 / 4;
        const BT_RECHARGE_RATE = 1 / 8;
        let btCharge = 1.0;
        let btConcentrateActive = false;
        let btAudio = null;
        let duelAudio = null;
        let shiftPressed = false;
        let speedModifier = 1.0;
        // Timer
        const INITIAL_TIME_MS = (typeof initialTimeMsParam === 'number' && initialTimeMsParam > 0)
            ? initialTimeMsParam
            : 30000;
        let timeRemaining = INITIAL_TIME_MS;
        let timerLastWall = null;
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

        function getSelectedBladeIndex() {
            const idx = bladeOptions.findIndex(option => option.id === selectedBladeId);
            return idx >= 0 ? idx : 0;
        }

        function cycleBlade(delta) {
            if (!bladeOptions.length) return;
            const current = getSelectedBladeIndex();
            const next = (current + delta + bladeOptions.length) % bladeOptions.length;
            selectedBladeId = bladeOptions[next].id;
            rsCylTarget += delta * 40;
            renderBullets();
            showAdjacentCartridges();
            playSfx('highlight-truth-sword.wav');
        }

        function updateCylinderRing(pct) {
            const ring = document.getElementById('rs-cyl-progress-ring');
            if (ring) {
                const circumference = 251.3;
                ring.style.strokeDashoffset = String(circumference * (1 - pct / 100));
            }
            const charged = pct >= 100;
            const cylIndexEl = cylinderContainerEl?.querySelector('.dangan-cylinder-index');
            if (cylIndexEl) cylIndexEl.style.opacity = charged ? '' : '0';
            if (bulletsEl) bulletsEl.classList.toggle('rs-charged', charged);
        }

        function applyRsCylinderTheme(mod) {
            const img     = document.getElementById('rs-cylinder-img');
            const indexEl = cylinderContainerEl?.querySelector('.dangan-cylinder-index');
            const ring    = document.getElementById('rs-cyl-progress-ring');
            cylinderContainerEl?.querySelectorAll('.dangan-bullet-cartridge').forEach(c => {
                if (mod < 1.0) {
                    c.style.background   = 'linear-gradient(90deg, rgba(50,0,38,0.97) 0%, rgba(145,0,110,0.98) 22%, rgba(210,0,170,0.99) 55%, rgba(195,0,155,0.98) 80%, rgba(155,0,120,0.97) 100%)';
                    c.style.boxShadow    = 'inset 0 2px 0 rgba(255,180,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.3), 0 0 18px rgba(255,0,200,0.45), 4px 8px 28px rgba(0,0,0,0.75)';
                    c.style.borderColor  = 'rgba(255,0,200,0.4)';
                } else {
                    c.style.background   = '';
                    c.style.boxShadow    = '';
                    c.style.borderColor  = '';
                }
            });
            if (img) {
                img.style.filter = mod < 1.0
                    ? 'sepia(1) hue-rotate(285deg) saturate(8) brightness(1.3) drop-shadow(0 0 18px rgba(255,0,200,0.9)) drop-shadow(0 0 45px rgba(255,0,200,0.6))'
                    : '';
            }
            if (indexEl) {
                indexEl.style.color       = mod < 1.0 ? '#ff00cc' : '';
                indexEl.style.textShadow  = mod < 1.0 ? '0 0 12px rgba(255,0,200,0.9), 0 0 30px rgba(255,0,200,0.6), 2px 2px 4px rgba(0,0,0,0.9)' : '';
            }
            if (ring) {
                ring.style.stroke = mod < 1.0 ? '#ff00cc' : '#00ffff';
            }
        }

        let _prevSpeedMod = 1.0;

        let _adjHideTimer = null;
        function showAdjacentCartridges() {
            if (!cylinderContainerEl) return;
            clearTimeout(_adjHideTimer);
            cylinderContainerEl.querySelectorAll('.dangan-bullet-cartridge--adj').forEach(el => {
                el.style.transition = 'opacity 0.15s ease';
                el.style.opacity = '1';
            });
            _adjHideTimer = setTimeout(() => {
                cylinderContainerEl.querySelectorAll('.dangan-bullet-cartridge--adj').forEach(el => {
                    el.style.transition = 'opacity 0.4s ease';
                    el.style.opacity = '0';
                });
            }, 1500);
        }

        function renderBullets() {
            bulletsEl.innerHTML = bladeOptions.map(option => `
                <button type="button" class="rs-bullet ${selectedBladeId === option.id ? "rs-selected" : ""}" data-id="${escapeHtml(option.id)}">
                    <div class="rs-bullet-handle"></div>
                    <div class="rs-bullet-tsuba"></div>
                    <div class="rs-bullet-scabbard">
                        <span class="rs-bullet-scabbard-label">${escapeHtml(option.title)}</span>
                    </div>
                    <div class="rs-bullet-blade"></div>
                </button>
            `).join("");
            bulletsEl.querySelectorAll(".rs-bullet").forEach(btn => {
                btn.style.pointerEvents = 'none';
            });
            renderCylinder();
        }

        function renderCylinder() {
            if (!cylinderContainerEl) return;
            const n = bladeOptions.length;
            if (!n) return;
            const curIdx = getSelectedBladeIndex();
            const cur   = bladeOptions[curIdx];
            const above = bladeOptions[((curIdx - 1) + n) % n];
            const below = bladeOptions[(curIdx + 1) % n];
            const bulletNumber = String(curIdx + 1).padStart(2, '0');

            if (!cylinderContainerEl.querySelector('#rs-cylinder-img')) {
                // First render: build HTML and start the spin RAF
                const cylSrc = `${(extensionFolderPath || '').replace(/\\/g, '/')}/assets/images/minigames/rebuttal-cylinder.svg`;
                cylinderContainerEl.innerHTML = `
                    <div class="dangan-cylinder-wrap">
                        <img id="rs-cylinder-img" class="dangan-cylinder-img" src="${cylSrc}" alt=""/>
                        <svg class="rs-cyl-progress" viewBox="0 0 100 100">
                            <circle class="rs-cyl-progress-bg" cx="50" cy="50" r="40"/>
                            <circle id="rs-cyl-progress-ring" class="rs-cyl-progress-ring" cx="50" cy="50" r="40"/>
                        </svg>
                        <div class="dangan-cylinder-index">${bulletNumber}</div>
                    </div>
                    <div class="dangan-bullet-cartridge dangan-bullet-cartridge--adj dangan-bullet-cartridge--above">
                        <span class="dangan-bullet-cartridge-name">${escapeHtml(above?.title || '')}</span>
                    </div>
                    <div class="dangan-bullet-cartridge dangan-bullet-cartridge--active">
                        <span class="dangan-bullet-cartridge-name">${escapeHtml(cur?.title || 'NO BLADES')}</span>
                    </div>
                    <div class="dangan-bullet-cartridge dangan-bullet-cartridge--adj dangan-bullet-cartridge--below">
                        <span class="dangan-bullet-cartridge-name">${escapeHtml(below?.title || '')}</span>
                    </div>
                `;
                startRsCylinderSpin();
            } else {
                // Subsequent renders: update text only, keep RAF and rotation intact
                const indexEl = cylinderContainerEl.querySelector('.dangan-cylinder-index');
                if (indexEl) indexEl.textContent = bulletNumber;
                const names = cylinderContainerEl.querySelectorAll('.dangan-bullet-cartridge-name');
                if (names[0]) names[0].textContent = above?.title || '';
                if (names[1]) names[1].textContent = cur?.title || 'NO BLADES';
                if (names[2]) names[2].textContent = below?.title || '';
            }
        }

        function startRsCylinderSpin() {
            const BASE_DEG_S = 20;
            let lastTs = null;
            const img = document.getElementById('rs-cylinder-img');
            if (!img) return;
            function tick(now) {
                if (!img.isConnected) { rsCylRaf = null; return; }
                const dt = lastTs !== null ? Math.min((now - lastTs) / 1000, 0.1) : 1 / 60;
                lastTs = now;
                const mod = speedModifier > 1.0 ? 2.0 : speedModifier < 1.0 ? 0.5 : 1.0;
                rsCylTarget += BASE_DEG_S * mod * dt;
                rsCylAngle += (rsCylTarget - rsCylAngle) * (1 - Math.pow(0.9, dt * 60));
                img.style.transform = `skewX(8deg) skewY(14deg) rotate(${rsCylAngle}deg)`;
                rsCylRaf = requestAnimationFrame(tick);
            }
            rsCylRaf = requestAnimationFrame(tick);
        }

        function updateHud() {
            cutLabelEl.textContent = `CUTS ${cuts} / ${cutTarget}`;
            missLabelEl.textContent = `MISSES ${misses} / ${missLimit}`;
        }

        function updateSectionDots(current, total) {
            if (!sectionDotsEl) return;
            sectionDotsEl.innerHTML = '';
            for (let i = 1; i <= total; i++) {
                const dot = document.createElement('span');
                dot.className = 'rs-section-dot' + (i === current ? ' rs-dot-active' : '');
                sectionDotsEl.appendChild(dot);
            }
        }

        function updateTimerDisplay(ms) {
            if (!timerEl) return;
            const secs   = Math.floor(ms / 1000);
            const centis = Math.floor((ms % 1000) / 10);
            timerEl.textContent = String(secs).padStart(2, '0') + '.' + String(centis).padStart(2, '0');
            timerEl.classList.toggle('rs-timer-urgent', ms < 8000);
        }

        function updateConcentrateBar() {
            if (!concentrateFillEl) return;
            concentrateFillEl.style.width = `${btCharge * 100}%`;
        }

        function spawnTimeGain(x, y, seconds) {
            const el = document.createElement('div');
            el.className = 'rs-time-gain';
            el.textContent = `+${seconds} sec!`;
            el.style.left = `${x}px`;
            el.style.top  = `${y}px`;
            arena.appendChild(el);
            setTimeout(() => el.remove(), 1200);
        }

        function updatePortraitDominance() {
            updateTapeState();
            if (!portraitLeftEl || !portraitRightEl) return;
            // Each cut/miss differential shifts the winning side's portrait
            // inward by 8% of the arena width, capped at 50% (fully off-screen)
            const diff      = cuts - misses; // positive = player winning
            const step      = cutTarget > 0 ? (100 / cutTarget) / 3 : 3;
            const offsetPct = Math.min(100, Math.abs(diff) * step);

            if (diff > 0) {
                // Player advancing: both portraits shift LEFT together
                portraitRightEl.style.marginRight = `${offsetPct}%`;
                portraitLeftEl.style.marginLeft   = `-${offsetPct}%`;
                portraitRightEl.style.zIndex = '8';
                portraitLeftEl.style.zIndex  = '6';
            } else if (diff < 0) {
                // Opponent advancing: both portraits shift RIGHT together
                portraitLeftEl.style.marginLeft   = `${offsetPct}%`;
                portraitRightEl.style.marginRight = `-${offsetPct}%`;
                portraitLeftEl.style.zIndex  = '8';
                portraitRightEl.style.zIndex = '6';
            } else {
                portraitLeftEl.style.marginLeft   = '0%';
                portraitRightEl.style.marginRight = '0%';
                portraitLeftEl.style.zIndex  = '6';
                portraitRightEl.style.zIndex = '7';
            }
        }

        const tapeLEl      = overlay.querySelector('#rs-tape-left');
        const tapeREl      = overlay.querySelector('#rs-tape-right');
        const tapeLTextEl  = overlay.querySelector('#rs-tape-text-left');
        const tapeRTextEl  = overlay.querySelector('#rs-tape-text-right');
        let _tapePrevState = null;

        function buildTapeInner() {
            return `<div class="rs-tape-scroll"></div>`;
        }

        function buildTextInner(word) {
            const item = `<span class="rs-tape-text-word">${word}</span>`;
            const group = `<div class="rs-tape-text-group">${item.repeat(5)}</div>`;
            return `<div class="rs-tape-text-scroll">${group}${group}</div>`;
        }

        function updateTapeState() {
            if (!tapeLEl || !tapeREl) return;
            const diff  = cuts - misses;
            const state = diff >= Math.ceil(cutTarget / 2) ? 'exceed'
                        : diff < 0                         ? 'danger'
                        :                                    'neutral';
            if (state === _tapePrevState) return;
            _tapePrevState = state;

            tapeLEl.className = 'rs-tape rs-tape-left'  + (state === 'exceed' ? ' rs-tape-exceed' : state === 'danger' ? ' rs-tape-danger' : '');
            tapeREl.className = 'rs-tape rs-tape-right' + (state === 'exceed' ? ' rs-tape-exceed' : state === 'danger' ? ' rs-tape-danger' : '');
            if (tapeLTextEl) tapeLTextEl.className = 'rs-tape-text rs-tape-text-left'  + (state === 'danger'  ? ' rs-tape-danger'  : '');
            if (tapeRTextEl) tapeRTextEl.className = 'rs-tape-text rs-tape-text-right' + (state === 'exceed' ? ' rs-tape-exceed' : '');
        }

        // Initialise tape strips (no text content inside tapes)
        if (tapeLEl) tapeLEl.innerHTML = buildTapeInner();
        if (tapeREl) tapeREl.innerHTML = buildTapeInner();
        // Initialise text panels once — content is permanent, only class changes
        if (tapeLTextEl) tapeLTextEl.innerHTML = buildTextInner('DANGER');
        if (tapeRTextEl) tapeRTextEl.innerHTML = buildTextInner('EXCEED');

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
            (resultPanelEl || resultEl).textContent = text;
        }

        async function showRetreat() {
            const delay = ms => new Promise(r => setTimeout(r, ms));
            const retreatTextInner = buildTextInner('RETREAT');
            const savedState = _tapePrevState;
            const setRetreat = () => {
                if (tapeLEl) tapeLEl.className = 'rs-tape rs-tape-left rs-tape-retreat';
                if (tapeREl) tapeREl.className = 'rs-tape rs-tape-right rs-tape-retreat';
                if (tapeLTextEl) { tapeLTextEl.innerHTML = retreatTextInner; tapeLTextEl.className = 'rs-tape-text rs-tape-text-left rs-tape-retreat'; }
                if (tapeRTextEl) { tapeRTextEl.innerHTML = retreatTextInner; tapeRTextEl.className = 'rs-tape-text rs-tape-text-right rs-tape-retreat'; }
            };
            const restore = () => {
                if (tapeLEl) tapeLEl.className = 'rs-tape rs-tape-left'  + (savedState === 'exceed' ? ' rs-tape-exceed' : savedState === 'danger' ? ' rs-tape-danger' : '');
                if (tapeREl) tapeREl.className = 'rs-tape rs-tape-right' + (savedState === 'exceed' ? ' rs-tape-exceed' : savedState === 'danger' ? ' rs-tape-danger' : '');
                if (tapeLTextEl) { tapeLTextEl.innerHTML = buildTextInner('DANGER'); tapeLTextEl.className = 'rs-tape-text rs-tape-text-left'  + (savedState === 'danger'  ? ' rs-tape-danger'  : ''); }
                if (tapeRTextEl) { tapeRTextEl.innerHTML = buildTextInner('EXCEED'); tapeRTextEl.className = 'rs-tape-text rs-tape-text-right' + (savedState === 'exceed' ? ' rs-tape-exceed' : ''); }
            };
            setRetreat();
            await delay(900);
            restore();
            restart();
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

        function clearDuelEffects() {
            duelEl.classList.remove("rs-show");
            if (duelBarEl) duelBarEl.classList.remove("rs-show");
            if (duelFlashEl) duelFlashEl.classList.remove("rs-active");
            if (tapeLEl) { tapeLEl.classList.remove("rs-duel-shake"); tapeLEl.classList.remove("rs-tape-danger"); }
            if (tapeREl) { tapeREl.classList.remove("rs-duel-shake"); tapeREl.classList.remove("rs-tape-danger"); }
            if (tapeLTextEl) tapeLTextEl.classList.remove("rs-tape-danger");
            if (portraitLeftEl) portraitLeftEl.classList.remove("rs-duel-shake");
            if (portraitRightEl) portraitRightEl.classList.remove("rs-duel-shake");
            if (cylinderContainerEl) cylinderContainerEl.style.filter = '';
            if (bulletsEl) bulletsEl.style.filter = '';
            if (duelAudio) { duelAudio.pause(); duelAudio = null; }
        }

        function triggerDuelPenalty() {
            if (duelTriggered || phase !== "phase1") return;
            duelTriggered = true;
            phase = "duel";
            removeAllLines();
            duelClicks = 0;
            timeRemaining = 10000;
            timerLastWall = performance.now();
            updateDuelHud();
            phaseLabelEl.textContent = "PENALTY · DUEL";
            duelEl.classList.add("rs-show");
            if (duelBarEl) duelBarEl.classList.add("rs-show");
            if (duelFlashEl) duelFlashEl.classList.add("rs-active");
            if (tapeLEl) { tapeLEl.classList.add("rs-duel-shake"); tapeLEl.classList.add("rs-tape-danger"); }
            if (tapeREl) { tapeREl.classList.add("rs-duel-shake"); tapeREl.classList.add("rs-tape-danger"); }
            if (tapeLTextEl) tapeLTextEl.classList.add("rs-tape-danger");
            if (portraitLeftEl) portraitLeftEl.classList.add("rs-duel-shake");
            if (portraitRightEl) portraitRightEl.classList.add("rs-duel-shake");
            if (cylinderContainerEl) {
                cylinderContainerEl.style.display = '';
                cylinderContainerEl.style.filter = 'sepia(1) hue-rotate(320deg) saturate(6) brightness(0.9)';
            }
            if (bulletsEl) bulletsEl.style.filter = 'hue-rotate(180deg) saturate(2.5)';
            duelAudio = new Audio(`${SFX_BASE}/sword-clash.wav`);
            duelAudio.loop = true;
            duelAudio.play().catch(() => {});
        }

        function handleDuelClick() {
            if (phase !== "duel" || !duelTriggered) return;
            duelClicks += 1;
            updateDuelHud();
            if (duelClicks >= duelClickTarget) {
                duelTriggered = false;
                clearDuelEffects();
                // +10 sec bonus — spawn text above player portrait
                spawnTimeGain(window.innerWidth * 0.75, window.innerHeight * 0.22, 10);
                restart(10000);
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
            if (speakerNameEl) speakerNameEl.textContent = opponentFirstName;
            updateSectionDots(spawnIndex, phaseOneLines.length);
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
            if (speakerNameEl) speakerNameEl.textContent = 'COUNTER';
            updateSectionDots(phase2SpawnIndex, phase2Groups.length);
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
                        updatePortraitDominance();
                    }
                }
            });
            removeKeys.forEach(key => {
                const entity = lineEntities.get(key);
                entity?.el.remove();
                lineEntities.delete(key);
            });
            if (weakPointPassed) {
                restart();
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
                        playSfx('sword-hit.wav');
                        playBreakEffect(entity, 0.9);
                        updateEntityDamageVisual(entity);
                        adjustControlState(0.35, 0);
                    } else {
                        playSfx('word-break.wav');
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
                        timeRemaining = Math.min(timeRemaining + 2000, INITIAL_TIME_MS * 2);
                        spawnTimeGain(entity.x + entity.width * 0.5, entity.y + entity.height * 0.5, 2);
                        adjustControlState(1, 0);
                        updateHud();
                        updatePortraitDominance();
                    }
                }
            });
        }

        async function enterBetweenPhase() {
            phase = "between";
            btConcentrateActive = false;
            speedModifier = 1.0;
            concentrateOverlay?.classList.remove('rs-active');
            if (btAudio) { btAudio.pause(); btAudio = null; }
            phaseLabelEl.textContent = "INTERMISSION";
            removeAllLines();
            betweenEl.classList.add("rs-show");
            betweenInput.focus();
            await new Promise(resolve => {
                const submit = () => {
                    playerBetweenMessage = String(betweenInput.value || "").trim();
                    betweenContinueBtn.removeEventListener("click", submit);
                    betweenInput.removeEventListener("keydown", onInputKey);
                    betweenEl.classList.remove("rs-show");
                    betweenEl.addEventListener('transitionend', () => resolve(), { once: true });
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
            if (speakerNameEl) speakerNameEl.textContent = 'COUNTER';
            updateSectionDots(0, 0);
            weakEl.classList.remove("rs-show");
            panelEl.classList.remove("rs-show");
            if (cylinderContainerEl) cylinderContainerEl.style.display = '';
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

        function restart(bonusMs = 0) {
            if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
            removeAllLines();
            clearDuelEffects();
            phase = "phase1";
            cuts = 0;
            misses = 0;
            duelTriggered = false;
            duelClicks = 0;
            spawnIndex = 0;
            lastSpawnTs = 0;
            nextPhraseReadyTs = 0;
            hadActivePhraseChunks = false;
            phase2Groups = [];
            phase2SpawnIndex = 0;
            phase2LastSpawnTs = 0;
            phase2NextReadyTs = 0;
            phase2HadActiveChunks = false;
            phase2WeakPointResolved = false;
            counterBannerUntil = 0;
            btCharge = 1.0;
            btConcentrateActive = false;
            shiftPressed = false;
            speedModifier = 1.0;
            _prevSpeedMod = 1.0;
            struggle = 0.35;
            controlFreedom = 0.2;
            timeRemaining = timeRemaining + bonusMs;
            timerLastWall = performance.now();
            lastTs = 0;
            running = true;
            phaseLabelEl.textContent = "PHASE 1";
            updateHud();
            updateTimerDisplay(timeRemaining);
            updateSectionDots(0, phaseOneLines.length);
            updateConcentrateBar();
            updatePortraitDominance();
            applyRsCylinderTheme(1.0);
            rafId = requestAnimationFrame(gameLoop);
        }

        async function finish(win) {
            if (resolved) return;
            resolved = true;
            finalOutcome = Boolean(win);
            running = false;
            if (rafId) cancelAnimationFrame(rafId);
            if (rsCylRaf) { cancelAnimationFrame(rsCylRaf); rsCylRaf = null; }
            stopBgm();
            if (btAudio) { btAudio.pause(); btAudio = null; }
            overlay.removeEventListener("mousemove", onMouseMove);
            overlay.removeEventListener("mousedown", onMouseDown);
            overlay.removeEventListener("contextmenu", onContextMenu);
            overlay.removeEventListener("wheel", onWheel, { capture: true });
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
            window.removeEventListener("resize", onResize);
            if (win) {
                awardMonocoins?.(8, "rebuttal showdown clear");
                overlay.classList.remove("rs-on");
                await delay(260);
                destroy();
                onWin?.();
            } else {
                deductMonocoins?.(8, "rebuttal showdown failed");
                new Audio(`${(extensionFolderPath || '').replace(/\\/g, '/')}/assets/monokuma/incorrect-answer.wav`).play().catch(() => {});
                showResult(false, "REBUTTAL FAILED");
                await delay(1400);
                overlay.classList.remove("rs-on");
                await delay(260);
                destroy();
            }
        }

        async function showCutAnimation(cx = window.innerWidth * 0.5, cy = window.innerHeight * 0.5) {
            const base = `${(extensionFolderPath || '').replace(/\\/g, '/')}`;
            const GREEN_GLOW = 'drop-shadow(0 0 6px #ffffff) drop-shadow(0 0 18px #00ff88) drop-shadow(0 0 40px #00ff66) drop-shadow(0 0 80px #00ee44) drop-shadow(0 0 140px #00cc33)';
            const posBase = `position:fixed;top:${cy}px;left:${cx}px;max-width:60vw;max-height:30vh;object-fit:contain;z-index:2147483647;pointer-events:none;filter:${GREEN_GLOW};`;

            // Darken overlay
            const dim = document.createElement('div');
            dim.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0);z-index:2147483646;pointer-events:none;transition:background 0.12s ease;';
            document.body.appendChild(dim);
            await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
            dim.style.background = 'rgba(0,0,0,0.75)';
            await new Promise(r => setTimeout(r, 130));

            // Show cut-text.webp at hit position
            const textImg = document.createElement('img');
            textImg.src = `${base}/assets/images/rebuttal/cut-text.webp`;
            textImg.style.cssText = posBase + 'transform:translate(-50%,-50%);opacity:0;transition:opacity 0.08s ease;';
            document.body.appendChild(textImg);
            await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
            textImg.style.opacity = '1';
            await new Promise(r => setTimeout(r, 420));

            // Swap to cut-left + cut-right at same position
            textImg.remove();

            const SPLIT_DURATION = 480;
            const leftImg = document.createElement('img');
            leftImg.src = `${base}/assets/images/rebuttal/cut-left.webp`;
            leftImg.style.cssText = posBase + 'transform:translate(-50%,-50%);';
            document.body.appendChild(leftImg);

            const rightImg = document.createElement('img');
            rightImg.src = `${base}/assets/images/rebuttal/cut-right.webp`;
            rightImg.style.cssText = posBase + 'transform:translate(-50%,-50%);';
            document.body.appendChild(rightImg);

            // Force reflow so initial state is committed before transition begins
            void leftImg.offsetWidth;
            void rightImg.offsetWidth;

            const splitTrans = `transform ${SPLIT_DURATION}ms cubic-bezier(0.22,0.61,0.36,1), opacity ${SPLIT_DURATION}ms ease`;
            leftImg.style.transition  = splitTrans;
            rightImg.style.transition = splitTrans;

            leftImg.style.transform  = `translate(calc(-50% - 55vw), calc(-50% - 8vh))`;
            rightImg.style.transform = `translate(calc(-50% + 55vw), calc(-50% + 8vh))`;
            leftImg.style.opacity    = '0';
            rightImg.style.opacity   = '0';
            dim.style.background     = 'rgba(0,0,0,0)';

            await new Promise(r => setTimeout(r, SPLIT_DURATION + 40));
            leftImg.remove();
            rightImg.remove();
            dim.remove();
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
                playBreakEffect(weakEntity, 1.8);
                weakEntity?.el.classList.add("rs-cut");
                const hitCx = weakEntity ? weakEntity.x + weakEntity.width  * 0.5 : window.innerWidth  * 0.5;
                const hitCy = weakEntity ? weakEntity.y + weakEntity.height * 0.5 : window.innerHeight * 0.5;
                setTimeout(() => {
                    weakEntity?.el.remove();
                    lineEntities.delete(hitWeakKey);
                }, 200);
                removeAllLines();
                phase = "counter";
                showCutAnimation(hitCx, hitCy).then(() => {
                    counterBannerUntil = performance.now() + 900;
                    if (!resolved) finish(true);
                });
                return;
            }
            if (now < finisherCooldownUntil) return;
            finisherCooldownUntil = now + finisherCooldownMs;
            misses += 1;
            adjustControlState(0, 0.7);
            updateHud();
            updatePortraitDominance();
            if (misses >= missLimit + 2) {
                restart();
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
            playSfx('sword-swing.wav');
            trySlash(performance.now());
        }

        function onContextMenu(event) {
            event.preventDefault();
            if (phase === "duel") return;
            tryCounter(performance.now());
        }

        function onWheel(event) {
            event.preventDefault();
        }

        function onKeyDown(event) {
            if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
                shiftPressed = true;
                return;
            }
            if (phase === "phase2" && event.key === "ArrowDown") {
                event.preventDefault();
                cycleBlade(1);
                return;
            }
            if (phase === "phase2" && event.key === "ArrowUp") {
                event.preventDefault();
                cycleBlade(-1);
                return;
            }
            if (event.key === "Escape") {
                event.preventDefault();
                finish(false);
            }
        }

        function onKeyUp(event) {
            if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
                shiftPressed = false;
            }
        }

        function gameLoop(ts) {
            if (!running) return;
            const dt = lastTs ? Math.min(0.06, (ts - lastTs) / 1000) : 0.016;
            lastTs = ts;

            // Slow-mo (concentrate) charge management
            if (phase !== "between") {
                if (shiftPressed && btCharge > 0) {
                    btConcentrateActive = true;
                    btCharge = Math.max(0, btCharge - BT_DRAIN_RATE * dt);
                    if (btCharge <= 0) { btConcentrateActive = false; }
                } else {
                    btConcentrateActive = false;
                    btCharge = Math.min(1, btCharge + BT_RECHARGE_RATE * dt);
                }
                speedModifier = btConcentrateActive ? 0.4 : 1.0;
            }
            if (speedModifier !== _prevSpeedMod) {
                _prevSpeedMod = speedModifier;
                applyRsCylinderTheme(speedModifier);
                if (btConcentrateActive) {
                    btAudio = new Audio(`${(extensionFolderPath || '').replace(/\\/g, '/')}/assets/sfx/minigames/slowmo.wav`);
                    btAudio.play().catch(() => {});
                } else if (btAudio) {
                    btAudio.pause();
                    btAudio = null;
                }
            }
            updateConcentrateBar();
            concentrateOverlay?.classList.toggle('rs-active', btConcentrateActive);

            // Timer drain (wall-clock, not game-speed)
            if (phase === "phase1" || phase === "phase2" || phase === "duel") {
                const wallNow = performance.now();
                if (timerLastWall !== null) {
                    timeRemaining = Math.max(0, timeRemaining - (wallNow - timerLastWall) * speedModifier);
                }
                timerLastWall = wallNow;
                updateTimerDisplay(timeRemaining);
                if (timeRemaining <= 0) {
                    if (phase === "duel") {
                        clearDuelEffects();
                        finish(false);
                    } else {
                        restart();
                    }
                    return;
                }
            }

            const gameDt = dt * speedModifier;
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
                updateLines(gameDt);
                if (cuts >= cutTarget) {
                    enterBetweenPhase();
                } else if (!duelTriggered && spawnIndex >= phaseOneLines.length && lineEntities.size === 0 && cuts < cutTarget) {
                    showRetreat();
                    return;
                }
            }

            if (phase === "phase2") {
                spawnPhaseTwoLine(ts);
                updateLines(gameDt);
                if (phase2SpawnIndex >= phase2Groups.length && lineEntities.size === 0 && !phase2WeakPointResolved) {
                    restart();
                    return;
                }
                const remain = Math.max(0, finisherCooldownUntil - performance.now());
                const pct = 100 - Math.min(100, remain / finisherCooldownMs * 100);
                updateCylinderRing(pct);
            } else {
                updateCylinderRing(0);
            }
            counterEl.classList.toggle("rs-show", performance.now() < counterBannerUntil);

            rafId = requestAnimationFrame(gameLoop);
        }

        // ── Rebuttal interjection cinematic ────────────────────────────────
        async function playInterjectionCinematic() {
            const wrap = document.createElement('div');
            wrap.id = 'rs-interjection-wrap';

            const pngSrc = `${(extensionFolderPath || '').replace(/\\/g, '/')}/assets/images/minigames/rebuttal-interjection.png`;
            const imgEl = document.createElement('img');
            imgEl.className = 'rs-interjection-img';
            imgEl.src = pngSrc;
            imgEl.alt = '';
            // Start below screen
            imgEl.style.transform = 'translateY(110vh)';
            wrap.appendChild(imgEl);

            // Load opponent interjection sprite (best-effort — cinematic still plays without it).
            // Prefer a dedicated `interjection` sprite, then fall back to
            // disapproval → anger → neutral. getSpriteUrl silently falls
            // back to neutral when a label is missing, so we compare each
            // resolved URL against the neutral URL to detect a real match
            // and only fall through to the next preference otherwise.
            let spriteEl = null;
            if (opponentName && typeof getSpriteUrl === 'function') {
                const neutralUrl = await getSpriteUrl(opponentName, 'neutral').catch(() => null);
                const tryLabel = async (label) => {
                    const url = await getSpriteUrl(opponentName, label).catch(() => null);
                    return (url && url !== neutralUrl) ? url : null;
                };
                const spriteUrl = (await tryLabel('interjection'))
                              ?? (await tryLabel('disapproval'))
                              ?? (await tryLabel('anger'))
                              ?? neutralUrl;
                if (spriteUrl) {
                    spriteEl = document.createElement('img');
                    spriteEl.className = 'rs-interjection-sprite';
                    spriteEl.src = spriteUrl;
                    spriteEl.alt = '';
                    // Start below screen, tilted to match the ~42° diagonal of the PNG panel
                    spriteEl.style.transform = 'translateX(-50%) translateY(110vh) rotate(42deg)';
                    spriteEl.style.opacity = '0';
                    wrap.appendChild(spriteEl);
                }
            }

            overlay.appendChild(wrap);

            playSfx('rebuttal-interjection-noise.wav');

            // Phase 1: fast slide-in from bottom (380ms)
            const SLIDE_IN_MS = 380;
            const SCROLL_MS   = 900;
            const FADE_MS     = 300;

            await new Promise(res => {
                // Double-rAF ensures the initial off-screen position is painted before transition fires
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    imgEl.style.transition = `transform ${SLIDE_IN_MS}ms cubic-bezier(0.22,0.61,0.36,1)`;
                    imgEl.style.transform  = 'translateY(0)';
                    if (spriteEl) {
                        spriteEl.style.transition = `transform ${SLIDE_IN_MS}ms cubic-bezier(0.22,0.61,0.36,1), opacity ${SLIDE_IN_MS}ms ease`;
                        spriteEl.style.transform  = 'translateX(-50%) translateY(0) rotate(42deg)';
                        spriteEl.style.opacity    = '1';
                    }
                    setTimeout(res, SLIDE_IN_MS + 16);
                }));
            });

            // Phase 2: slow scroll upward (900ms)
            await new Promise(res => {
                imgEl.style.transition = `transform ${SCROLL_MS}ms linear`;
                imgEl.style.transform  = 'translateY(-30vh)';
                if (spriteEl) {
                    spriteEl.style.transition = `transform ${SCROLL_MS}ms linear`;
                    spriteEl.style.transform  = 'translateX(-50%) translateY(-30vh) rotate(42deg)';
                }
                setTimeout(res, SCROLL_MS);
            });

            // Phase 3: fade out (300ms)
            await new Promise(res => {
                wrap.style.transition = `opacity ${FADE_MS}ms ease-in`;
                wrap.style.opacity    = '0';
                setTimeout(res, FADE_MS);
            });

            wrap.remove();
        }

        // ── Blade intro (shown before Phase 1 begins) ──────────────────────
        await new Promise(resolve => {
            if (!bladeOptions.length) { resolve(); return; }

            let introIdx = getSelectedBladeIndex();
            let introResolved = false;
            let animTimers = [];
            const ACTIVE_X = 40;
            const STEP_X   = 14;

            function itemX(i, activeIdx) {
                return Math.max(0, ACTIVE_X - Math.abs(i - activeIdx) * STEP_X);
            }

            const introEl = document.createElement('div');
            introEl.id = 'rs-intro';
            introEl.innerHTML = `
                <div class="rs-intro-list">
                    ${bladeOptions.map((b, i) => `
                        <div class="rs-intro-item${i === introIdx ? ' rs-active' : ''}"
                             data-idx="${i}"
                             style="--i:${i}; translate:${itemX(i, introIdx)}px 0">
                            <div class="rs-intro-handle"></div>
                            <div class="rs-intro-tsuba"></div>
                            <div class="rs-intro-scabbard">
                                <span class="rs-intro-scabbard-label">${escapeHtml(b.title)}</span>
                            </div>
                            <div class="rs-intro-blade"></div>
                        </div>
                    `).join('')}
                </div>
            `;

            function clearTimers() { animTimers.forEach(clearTimeout); animTimers = []; }

            function setActive(idx, direction) {
                clearTimers();
                const items = [...introEl.querySelectorAll('.rs-intro-item')];
                const curActive = items.find(el => el.classList.contains('rs-active'));
                if (direction === 0) {
                    items.forEach((el, i) => {
                        el.classList.toggle('rs-active', i === idx);
                        el.style.transition = '';
                        el.style.translate = `${itemX(i, idx)}px 0`;
                    });
                    return;
                }
                if (curActive) {
                    curActive.classList.remove('rs-active');
                    curActive.style.transition = 'translate 0.12s ease-in';
                    curActive.style.translate = `${itemX(items.indexOf(curActive), idx)}px 0`;
                }
                animTimers.push(setTimeout(() => {
                    items.forEach((el, i) => {
                        el.style.transition = 'translate 0.14s ease';
                        el.style.translate = `${i === idx ? Math.round(ACTIVE_X * 0.75) : itemX(i, idx)}px 0`;
                    });
                    animTimers.push(setTimeout(() => {
                        if (items[idx]) {
                            items[idx].classList.add('rs-active');
                            items[idx].style.transition = 'translate 0.12s ease-out';
                            items[idx].style.translate = `${ACTIVE_X}px 0`;
                        }
                    }, 155));
                }, 130));
            }

            function doConfirm() {
                if (introResolved) return;
                introResolved = true;
                clearTimers();
                clearTimeout(autoTimer);
                document.removeEventListener('keydown', onIntroKey);
                selectedBladeId = bladeOptions[introIdx]?.id || selectedBladeId;
                introEl.style.transition = 'opacity 0.32s ease';
                introEl.style.opacity = '0';
                setTimeout(() => { introEl.remove(); resolve(); }, 340);
            }

            function onIntroKey(e) {
                if (e.key === 'ArrowUp') {
                    e.preventDefault(); e.stopPropagation();
                    introIdx = (introIdx - 1 + bladeOptions.length) % bladeOptions.length;
                    setActive(introIdx, -1);
                    playSfx('highlight-truth-sword.wav');
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault(); e.stopPropagation();
                    introIdx = (introIdx + 1) % bladeOptions.length;
                    setActive(introIdx, 1);
                    playSfx('highlight-truth-sword.wav');
                } else if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault(); e.stopPropagation();
                    doConfirm();
                }
            }

            introEl.querySelectorAll('.rs-intro-item').forEach(el => {
                el.addEventListener('click', () => {
                    const i = Number(el.dataset.idx);
                    if (i !== introIdx) { introIdx = i; setActive(introIdx, 0); playSfx('highlight-truth-sword.wav'); }
                    else { doConfirm(); }
                });
            });

            overlay.appendChild(introEl);
            requestAnimationFrame(() => requestAnimationFrame(() => introEl.classList.add('rs-on')));
            document.addEventListener('keydown', onIntroKey);
            const autoTimer = setTimeout(() => doConfirm(), 6000);
        });

        syncBladeVisuals();
        updateHud();
        renderBullets();
        updatePortraitDominance();
        startBgm(); // no-op if already started by the intro-SFX ended callback

        // Portrait height scaling (same formula as NSD/MPD)
        const BASE_VH = 85;
        const AVG_CM  = 170;
        function portraitHeightVh(name) {
            const cm = typeof getCharacterHeightCm === 'function' ? getCharacterHeightCm(name) : null;
            if (!cm) return BASE_VH;
            const scale = Math.min(1.45, Math.max(0.55, cm / AVG_CM));
            return Math.round(BASE_VH * scale);
        }
        if (portraitLeftImg)  portraitLeftImg.style.height  = `${portraitHeightVh(opponentName)}vh`;
        if (portraitRightImg) portraitRightImg.style.height = `${portraitHeightVh(playerName)}vh`;

        // Load portrait sprites
        void (async () => {
            if (opponentName && typeof getSpriteUrl === 'function') {
                const url = await getSpriteUrl(opponentName, 'anger').catch(() => null)
                         ?? await getSpriteUrl(opponentName, 'neutral').catch(() => null);
                if (url && portraitLeftImg) portraitLeftImg.src = url;
            }
            if (portraitRightImg) {
                let url = null;
                const promePack = typeof getPromeSpritePack === 'function' ? getPromeSpritePack() : null;
                if (promePack) {
                    url = `/characters/${promePack}/annoyance.png`;
                } else if (playerName && typeof getSpriteUrl === 'function') {
                    url = await getSpriteUrl(playerName, 'neutral').catch(() => null);
                }
                if (!url && typeof getUserAvatarUrl === 'function') {
                    url = getUserAvatarUrl() ?? null;
                }
                if (url) portraitRightImg.src = url;
            }
        })();

        overlay.addEventListener("mousemove", onMouseMove);
        overlay.addEventListener("mousedown", onMouseDown);
        overlay.addEventListener("contextmenu", onContextMenu);
        overlay.addEventListener("wheel", onWheel, { capture: true, passive: false });
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        window.addEventListener("resize", onResize);
        timerLastWall = performance.now();
        updateTimerDisplay(timeRemaining);
        updateSectionDots(0, phaseOneLines.length);
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

const INTERJECT_STYLE_ID = 'dangan-interject-style';

export function createInterjectionCinematicRunner({ extensionFolderPath = '', getSpriteUrl = null } = {}) {
    function buildInterjectionStyles() {
        return `
        #dangan-interject-wrap {
            position: fixed;
            inset: 0;
            z-index: 2147483647;
            pointer-events: none;
            overflow: hidden;
        }
        #dangan-interject-container {
            position: absolute;
            left: 0;
            bottom: 0;
            width: 100%;
            height: 100vh;
            will-change: transform;
        }
        #dangan-interject-wrap .rs-interjection-img {
            display: block;
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: bottom left;
        }
        #dangan-interject-wrap .rs-interjection-sprite {
            position: absolute;
            bottom: 0px;
            top: -100px;
            left: 350px;
            transform: rotate(14deg);
            height: 130vh;
            width: auto;
            object-fit: contain;
            object-position: bottom center;
            will-change: opacity;
            filter: drop-shadow(0 0 28px rgba(255,180,0,0.8)) drop-shadow(0 0 60px rgba(255,100,0,0.5));
        }
/* Dedicated 'interjection' sprite is usually a tighter head crop, so it
         * gets its own positioning + size instead of the full 130vh canvas. */
        #dangan-interject-wrap .rs-interjection-sprite.rs-interjection-sprite-dedicated {
            height: 85vh;
            top: 179px;
            left: 224px;
            transform: rotate(5deg);
        }
        `;
    }

    async function run({ characterName = null } = {}) {
        if (!document.getElementById(INTERJECT_STYLE_ID)) {
            const styleEl = document.createElement('style');
            styleEl.id = INTERJECT_STYLE_ID;
            styleEl.textContent = buildInterjectionStyles();
            document.head.appendChild(styleEl);
        }

        // Tear down any previous overlay (e.g. one left frozen for styling)
        // so we never end up with duplicate #dangan-interject-wrap nodes.
        document.getElementById('dangan-interject-wrap')?.remove();

        const wrap = document.createElement('div');
        wrap.id = 'dangan-interject-wrap';

        // Single container — PNG and sprite animate together as one unit
        const containerEl = document.createElement('div');
        containerEl.id = 'dangan-interject-container';
        containerEl.style.transform = 'translateY(110vh)';

        const sfxBase = `${(extensionFolderPath || '').replace(/\\/g, '/')}/assets/sfx/rebuttal`;
        const pngSrc  = `${(extensionFolderPath || '').replace(/\\/g, '/')}/assets/images/minigames/rebuttal-interjection.png`;

        const imgEl = document.createElement('img');
        imgEl.className = 'rs-interjection-img';
        imgEl.src = pngSrc;
        imgEl.alt = '';
        containerEl.appendChild(imgEl);

        let spriteEl = null;
        if (characterName && typeof getSpriteUrl === 'function') {
            // Prefer a dedicated `interjection` sprite if the character has
            // one; otherwise fall back to disapproval → anger → neutral.
            // NOTE: getSpriteUrl silently falls back to the character's
            // neutral sprite when the requested label is missing, so we
            // detect a "true" interjection sprite by checking the returned
            // URL differs from the neutral sprite's URL.
            const neutralUrl      = await getSpriteUrl(characterName, 'neutral').catch(() => null);
            const interjectionUrl = await getSpriteUrl(characterName, 'interjection').catch(() => null);
            const hasDedicated    = !!interjectionUrl && interjectionUrl !== neutralUrl;

            let spriteUrl = null;
            let isDedicated = false;
            if (hasDedicated) {
                spriteUrl   = interjectionUrl;
                isDedicated = true;
            } else {
                spriteUrl = await getSpriteUrl(characterName, 'disapproval').catch(() => null);
                if (!spriteUrl || spriteUrl === neutralUrl) {
                    const anger = await getSpriteUrl(characterName, 'anger').catch(() => null);
                    if (anger && anger !== neutralUrl) spriteUrl = anger;
                }
                if (!spriteUrl) spriteUrl = neutralUrl;
            }
            if (spriteUrl) {
                spriteEl = document.createElement('img');
                spriteEl.className = 'rs-interjection-sprite' + (isDedicated ? ' rs-interjection-sprite-dedicated' : '');
                spriteEl.src = spriteUrl;
                spriteEl.alt = '';
                containerEl.appendChild(spriteEl);
            }
        }

        wrap.appendChild(containerEl);
        document.body.appendChild(wrap);

        new Audio(`${sfxBase}/rebuttal-interjection-noise.wav`).play().catch(() => {});

        const SLIDE_IN_MS = 450;
        const HOLD_MS     = 1200;
        const FADE_MS     = 400;

        // Phase 1: slide up and fade in together
        wrap.style.opacity = '0';
        await new Promise(res => {
            requestAnimationFrame(() => requestAnimationFrame(() => {
                wrap.style.transition        = `opacity ${SLIDE_IN_MS}ms ease`;
                wrap.style.opacity           = '1';
                containerEl.style.transition = `transform ${SLIDE_IN_MS}ms cubic-bezier(0.22,0.61,0.36,1)`;
                containerEl.style.transform  = 'translateY(0)';
                if (spriteEl) spriteEl.style.opacity = '1';
                setTimeout(res, SLIDE_IN_MS + 16);
            }));
        });

        // ── Debug freeze (TEMPORARY) ──────────────────────────────────
        // Pause here instead of holding / fading out so the interjection
        // chrome stays visible for styling. The wrap also gets a
        // `data-frozen` attr and accepts pointer events long enough for a
        // single click anywhere to dismiss it. Set DANGAN_DEBUG_FREEZE_INTERJECTION
        // to `false` (or remove this block) to restore normal playback.
        const DEBUG_FREEZE_INTERJECTION = true;
        if (DEBUG_FREEZE_INTERJECTION) {
            wrap.setAttribute('data-frozen', '1');
            wrap.style.pointerEvents = 'auto';
            wrap.style.cursor        = 'pointer';
            wrap.addEventListener('click', () => wrap.remove(), { once: true });
            console.log('[Dangan][Interjection] Frozen for debugging — click anywhere on the overlay to dismiss.');
            return; // skip hold + fade-out + remove
        }

        // Phase 2: brief hold
        await new Promise(res => setTimeout(res, HOLD_MS));

        // Phase 3: fade out
        await new Promise(res => {
            wrap.style.transition = `opacity ${FADE_MS}ms ease-in`;
            wrap.style.opacity    = '0';
            setTimeout(res, FADE_MS);
        });

        wrap.remove();
    }

    return { run };
}
