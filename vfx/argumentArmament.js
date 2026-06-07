const AA_ID    = "dangan-aa-overlay";
const AA_STYLE = "dangan-aa-style";
const AMMO_MAX  = 6;

const PHASE_CONFIG = {
    1: { spawnInterval: 3000, dialogDuration: 6000 },
    2: { spawnInterval: 2000, dialogDuration: 4500 },
    3: { spawnInterval: 1200, dialogDuration: 3000 },
};

// Cell indices use phone-pad layout: 0=TL,1=TM,2=TR, 3=ML,4=C,5=MR, 6=BL,7=BM,8=BR
const SPAWN_PATTERNS = [
    [0,1,2],               // top row →
    [3,4,5],               // middle row →
    [6,7,8],               // bottom row →
    [0,3,6],               // left col ↓
    [1,4,7],               // middle col ↓
    [2,5,8],               // right col ↓
    [0,4,8],               // diagonal TL→BR
    [2,4,6],               // diagonal TR→BL
    [0,1,2,5,8,7,6,3],    // clockwise border sweep
    [0,4,2],               // TL → center → TR
    [6,4,8],               // BL → center → BR
    [0,4,8,2,6],           // both diagonals (X)
    [1,3,7,5],             // cardinal cross (N W S E)
    [4,1,3,7,5],           // center-first cardinal cross
    [0,1,2,3,4,5,6,7,8],  // full grid sweep L→R, top to bottom
    [3,6,7,8,5,2,1,0],    // counter-clockwise border from left-mid
];

function randomDialogType() {
    const r = Math.random();
    if (r < 0.50) return 'normal';
    if (r < 0.70) return 'pink';
    if (r < 0.90) return 'orange';
    return 'blue';
}

function buildStyles({ extensionFolderPath = '' } = {}) {
    const panelImg = `${extensionFolderPath}/assets/images/minigames/aa-panel.png`;
    return `
#${AA_ID} {
    position: fixed; inset: 0;
    z-index: 2147483645;
    background: radial-gradient(ellipse at 50% 60%, #3a0060 0%, #1a0030 55%, #0d0018 100%);
    overflow: hidden;
    opacity: 0; transition: opacity 300ms ease;
    font-family: "Orbitron", "Impact", monospace;
    pointer-events: none;
    user-select: none;
}
#${AA_ID}.aa-on { opacity: 1; pointer-events: auto; }

/* Stage spotlights effect */
#${AA_ID}::before {
    content: "";
    position: absolute; inset: 0;
    background:
        radial-gradient(ellipse 400px 600px at 20% 0%, rgba(160,80,255,0.14) 0%, transparent 70%),
        radial-gradient(ellipse 400px 600px at 80% 0%, rgba(80,160,255,0.12) 0%, transparent 70%),
        radial-gradient(ellipse 200px 300px at 50% 0%, rgba(255,200,80,0.08) 0%, transparent 70%);
    pointer-events: none; z-index: 0;
}

/* Scanline overlay */
#${AA_ID}::after {
    content: "";
    position: absolute; inset: 0;
    background: repeating-linear-gradient(
        0deg,
        transparent 0px, transparent 3px,
        rgba(0,0,0,0.10) 3px, rgba(0,0,0,0.10) 4px
    );
    pointer-events: none; z-index: 1;
}

/* ─── Corner panels ──────────────────────────────────── */
.aa-panel {
    position: absolute;
    z-index: 16;
    pointer-events: all;
    padding: 28px 42px;
    /* Decorative frame; the actual visual border comes from the ::before
     * pseudo, which uses panel.png and is flipped per-corner via transform. */
    background: transparent;
    border: none;
    border-radius: 0;
}
.aa-panel::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image: url("${panelImg}");
    background-size: 100% 100%;
    background-repeat: no-repeat;
    pointer-events: none;
    z-index: -1;
    transform-origin: center;
}
/* Default orientation lives in the top-left corner. */
#aa-panel-tl::before { transform: none; }
/* Bottom-left: flipped vertically. */
#aa-panel-bl::before { transform: scaleY(-1); }
/* Top-right: mirrored horizontally. */
#aa-panel-tr::before,
#aa-timer-area::before { transform: scaleX(-1); }
/* Bottom-right: mirrored AND flipped vertically. */
#aa-panel-br::before { transform: scale(-1, -1); }
#aa-panel-tl {
    top: 16px; left: 16px;
    min-width: 240px;
}
#aa-panel-bl {
    bottom: 16px; left: 16px;
    width: 160px; height: 160px;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    box-sizing: border-box;
}
#aa-panel-br {
    bottom: 16px; right: 16px;
    min-width: 240px;
}
/* Global AA timer — top-right corner. Width is locked so individual digit
 * widths in Orbitron can't reflow the panel; numeric text is left-aligned
 * inside that fixed box. */
#aa-timer-area {
    position: absolute;
    top: 16px; right: 16px;
    width: 260px;
    min-width: 0;
    text-align: left;
    color: #ffaa00;
    z-index: 7;
    pointer-events: none;
    font-family: "Orbitron", "Impact", monospace;
}
#aa-timer-label {
    font-size: 11px; letter-spacing: 3px;
    color: rgba(255, 180, 100, 0.7);
    margin-bottom: 2px;
    text-align: left;
}
#aa-timer {
    display: block;
    width: 100%;
    font-size: 28px;
    font-weight: 700;
    letter-spacing: 3px;
    color: #ffaa00;
    text-shadow: 0 0 10px #ff8800, 0 0 3px #ffcc00;
    font-variant-numeric: tabular-nums;
    font-feature-settings: "tnum" 1;
    line-height: 1;
    text-align: left;
    /* Fall back to a true monospace if Orbitron's tabular figures aren't
     * available so each digit / colon occupies the same cell width. */
    font-family: "Orbitron", "Courier New", ui-monospace, monospace;
}
#aa-timer.aa-urgent {
    color: #ff1111;
    text-shadow: 0 0 14px rgba(255, 0, 0, 1);
    animation: ptaBlink 0.45s ease-in-out infinite;
}
@keyframes ptaBarrierPulse {
    0%,100% {
        border-color: rgba(180,60,255,0.55);
        box-shadow: 0 0 10px rgba(150,50,220,0.2);
    }
    50% {
        border-color: rgba(220,120,255,0.9);
        box-shadow: 0 0 18px rgba(180,60,255,0.4);
    }
}

/* ─── Phase label (top barrier left) ────────────────── */
#aa-phase-label {
    font-size: 11px; letter-spacing: 3px;
    color: rgba(255,255,255,0.5);
    white-space: nowrap;
    min-width: 72px;
    flex-shrink: 0;
    z-index: 10;
}

/* ─── HP bars ────────────────────────────────────────── */
#aa-enemy-bar-wrap {
    width: 100%;
}
#aa-enemy-name {
    font-size: 11px; letter-spacing: 3px;
    color: rgba(255,160,180,0.85);
    margin-bottom: 3px;
}
.aa-bar-track {
    width: 100%; height: 13px;
    background: rgba(0,0,0,0.55);
    border: 1px solid #222222;
    border-radius: 9999px;
    overflow: hidden;
    position: relative;
}
.aa-bar-marker {
    position: absolute;
    top: 0; bottom: 0;
    width: 2px;
    transform: translateX(-50%);
    background: #222222;
    z-index: 2;
    pointer-events: none;
}
.aa-bar-fill {
    height: 100%; border-radius: 9999px;
    transition: width 0.35s ease;
    position: relative;
}
.aa-bar-fill::after {
    content: "";
    position: absolute; inset: 0;
    background: linear-gradient(180deg, rgba(255,255,255,0.18) 0%, transparent 100%);
}
#aa-enemy-fill  { background: linear-gradient(90deg, #bb1133, #ff3366); }

#aa-player-bar-wrap {
    width: 100%;
}
#aa-player-name {
    font-size: 11px; letter-spacing: 3px;
    color: rgba(120,200,255,0.85);
    margin-bottom: 3px;
}
#aa-enemy-hp-display, #aa-player-hp-display {
    font-size: 10px; letter-spacing: 1px;
    opacity: 0.75;
    font-weight: normal;
}
#aa-player-fill { background: linear-gradient(90deg, #1155bb, #33aaff); }

/* ─── Ammo display (bottom barrier right) ───────────── */
#aa-ammo-wrap {
    display: flex; flex-direction: column;
    align-items: center; gap: 4px;
    flex-shrink: 0;
    z-index: 10;
}
#aa-ammo-icon {
    width: 36px; height: 36px;
    object-fit: contain;
    filter: sepia(1) saturate(6) hue-rotate(5deg) drop-shadow(0 0 6px rgba(255,200,0,0.7));
}
#aa-ammo-count {
    font-size: 20px; font-weight: bold;
    color: #ffe066;
    text-shadow: 0 0 10px rgba(255,200,0,0.7);
    letter-spacing: 1px;
    line-height: 1;
}
#aa-ammo-label {
    font-size: 9px; letter-spacing: 2px;
    color: rgba(255,255,255,0.45);
    margin-top: 2px;
}

/* ─── Reload indicator (inside ammo panel) ───────────── */
#aa-reload-indicator {
    position: absolute;
    bottom: 10px; left: 50%;
    transform: translateX(-50%);
    font-size: 10px; letter-spacing: 2px;
    color: #ffcc00;
    display: none; z-index: 20;
    pointer-events: none;
    text-shadow: 0 0 8px rgba(255,200,0,0.7);
    white-space: nowrap;
    text-align: center;
}
#aa-reload-indicator.active {
    display: block;
    animation: aa-blink 0.6s infinite;
}
@keyframes aa-blink {
    0%,100% { opacity: 1; }
    50%      { opacity: 0.25; }
}
@keyframes aa-shake {
    0%        { transform: translate(0, 0) rotate(0deg); }
    15%       { transform: translate(-3px, -2px) rotate(-0.4deg); }
    30%       { transform: translate(3px, 2px) rotate(0.4deg); }
    45%       { transform: translate(-2px, 2px) rotate(-0.2deg); }
    60%       { transform: translate(2px, -2px) rotate(0.2deg); }
    75%       { transform: translate(-1px, 1px) rotate(-0.1deg); }
    90%       { transform: translate(1px, -1px) rotate(0.1deg); }
    100%      { transform: translate(0, 0) rotate(0deg); }
}
#${AA_ID}.aa-shaking {
    animation: aa-shake 0.35s ease-out forwards;
}


/* ─── 3×3 Grid ───────────────────────────────────────── */
#aa-grid {
    position: absolute;
    left: 50%; top: 50%;
    transform: translate(-50%, -50%);
    display: grid;
    grid-template-columns: repeat(3, 340px);
    grid-template-rows: repeat(3, 220px);
    gap: 6px;
    z-index: 5;
}

.aa-cell {
    background: rgba(255,255,255,0.04);
    border: 1.5px solid rgba(255,255,255,0.18);
    border-radius: 5px;
    position: relative;
    overflow: hidden;
    cursor: pointer;
    transition: border-color 0.12s;
}
.aa-cell:hover {
    border-color: rgba(255,255,255,0.45);
}
@keyframes aa-cell-warn {
    0%   { background: rgba(255,255,255,0.04); }
    50%  { background: rgba(255,40,100,0.06); }
    80%  { background: rgba(255,40,100,0.20); }
    100% { background: rgba(255,40,100,0.42); }
}
.aa-cell.aa-cell-active {
    animation: aa-cell-warn var(--cell-warn-dur, 6000ms) linear forwards;
}
@keyframes aa-cell-warn-out {
    0%   { background: var(--cell-warn-snapshot, rgba(255,40,100,0.20)); }
    100% { background: rgba(255,40,100,0.00); }
}
.aa-cell.aa-cell-fading {
    animation: aa-cell-warn-out 0.18s ease-out forwards;
}
/* ─── Reticule ───────────────────────────────────────── */
#aa-reticule {
    position: absolute;
    width: 340px; height: 220px;
    pointer-events: none;
    z-index: 3;
    transition: left 0.1s cubic-bezier(0.25, 0.46, 0.45, 0.94),
                top  0.1s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    opacity: 1;
    filter: drop-shadow(0 0 5px rgba(0, 255, 80, 0.9))
            drop-shadow(0 0 10px rgba(0, 255, 80, 0.6));
}
#aa-reticule span {
    position: absolute;
    width: 20px; height: 20px;
    border-color: #00ff50;
    border-style: solid;
    border-width: 0;
}
#aa-reticule span:nth-child(1) { top: 16px;  left: 16px;  border-top-width: 2.5px; border-left-width: 2.5px;  }
#aa-reticule span:nth-child(2) { top: 16px;  right: 16px; border-top-width: 2.5px; border-right-width: 2.5px; }
#aa-reticule span:nth-child(3) { bottom: 16px; left: 16px;  border-bottom-width: 2.5px; border-left-width: 2.5px;  }
#aa-reticule span:nth-child(4) { bottom: 16px; right: 16px; border-bottom-width: 2.5px; border-right-width: 2.5px; }
#aa-reticule::before {
    content: '';
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 36px; height: 36px;
    border-radius: 50%;
    border: 2px solid #00ff50;
}

/* ─── Dialog text pieces ─────────────────────────────── */
.aa-dialog {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    text-align: center; padding: 10px;
    font-size: 18px; font-weight: bold;
    line-height: 1.3; pointer-events: none;
    transform-origin: center;
    animation: aa-zoom-in linear both;
}
.aa-dialog.aa-normal {
    color: #ffffff;
    text-shadow: 2px 2px 4px #000, -1px -1px 3px #000, 0 0 6px rgba(255,255,255,0.7);
}
.aa-dialog.aa-pink {
    color: #ff69b4;
    text-shadow: 2px 2px 4px #000, -1px -1px 3px #000, 0 0 8px rgba(255,105,180,0.9);
}
.aa-dialog.aa-orange {
    color: #ff8c00;
    text-shadow: 2px 2px 4px #000, -1px -1px 3px #000, 0 0 8px rgba(255,140,0,0.9);
}
.aa-dialog.aa-blue {
    color: #4da6ff;
    text-shadow: 2px 2px 4px #000, -1px -1px 3px #000, 0 0 8px rgba(77,166,255,0.9);
}
.aa-dialog.aa-blue-hit {
    color: #ff8c00;
    text-shadow: 2px 2px 4px #000, -1px -1px 3px #000, 0 0 8px rgba(255,140,0,0.9);
}
.aa-miss-label {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 15px; font-weight: bold; letter-spacing: 2px;
    color: #44ff88;
    text-shadow: 0 0 8px rgba(68,255,136,0.9);
    pointer-events: none;
    animation: aa-miss-fade 0.6s ease forwards;
}
@keyframes aa-miss-fade {
    0%   { opacity: 1; transform: scale(0.8) translateY(0); }
    60%  { opacity: 1; transform: scale(1.1) translateY(-6px); }
    100% { opacity: 0; transform: scale(1.0) translateY(-12px); }
}
.aa-hit-burst {
    position: absolute;
    top: calc(50% - 55px); left: calc(50% - 55px);
    width: 110px; height: 110px;
    pointer-events: none;
    z-index: 15;
    border-radius: 50%;
    animation: aa-burst-core 0.35s ease-out forwards;
}
.aa-hit-burst::after {
    content: '';
    position: absolute;
    top: calc(50% - 45px); left: calc(50% - 45px);
    width: 90px; height: 90px;
    border-radius: 50%;
    border: 4px solid rgba(255, 255, 255, 0.9);
    animation: aa-burst-ring 0.35s ease-out forwards;
}
@keyframes aa-burst-core {
    0%   { background: radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,220,80,0.85) 35%, rgba(255,100,30,0.5) 65%, transparent 100%); transform: scale(0.1); opacity: 1; }
    50%  { background: radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(255,200,50,0.7) 35%, rgba(255,80,10,0.3) 65%, transparent 100%); transform: scale(1.1); opacity: 0.85; }
    100% { background: radial-gradient(circle, rgba(255,255,255,0) 0%, rgba(255,180,30,0) 50%, transparent 100%); transform: scale(1.4); opacity: 0; }
}
@keyframes aa-burst-ring {
    0%   { transform: scale(0.1); opacity: 1; }
    60%  { transform: scale(1.0); opacity: 0.8; }
    100% { transform: scale(1.5); opacity: 0; }
}

@keyframes aa-zoom-in {
    0%   { transform: scale(0.25) rotate(var(--rot-start, 0deg)); opacity: 0; }
    7%   { opacity: 1; }
    80%  { transform: scale(1.55) rotate(var(--rot-end,   0deg)); opacity: 1; }
    93%  { opacity: 0.5; }
    100% { transform: scale(1.75) rotate(var(--rot-end,   0deg)); opacity: 0; }
}
@keyframes aa-dialog-die {
    0%   { opacity: 1; }
    100% { opacity: 0; transform: scale(1.6) rotate(var(--rot-end, 0deg)); }
}
.aa-dialog.aa-dying {
    animation: aa-dialog-die 0.18s ease-out forwards !important;
}

/* ─── Screen flash (red = player damage, orange = enemy hit, blue = blue dialog hit) */
#aa-damage-flash {
    position: absolute; inset: 0;
    background: var(--aa-flash-bg, rgba(255,0,0,0.38));
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.08s;
    z-index: 20;
}
#aa-damage-flash.flash { opacity: 1; }

/* ─── Phase transition banner ────────────────────────── */
#aa-phase-banner {
    position: absolute; inset: 0;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    background: rgba(0,0,0,0.82);
    z-index: 50;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s;
}
#aa-phase-banner.active {
    opacity: 1;
    pointer-events: auto;
}
#aa-phase-banner-text {
    font-size: 52px; letter-spacing: 10px;
    color: #ffffff;
    text-shadow: 0 0 30px rgba(200,100,255,0.9), 0 0 60px rgba(200,100,255,0.4);
    animation: aa-phase-pulse 1s ease infinite;
}
@keyframes aa-phase-pulse {
    0%,100% { text-shadow: 0 0 30px rgba(200,100,255,0.9), 0 0 60px rgba(200,100,255,0.4); }
    50%     { text-shadow: 0 0 50px rgba(255,150,255,1),   0 0 90px rgba(200,100,255,0.7); }
}

/* ─── Final Solution overlay ─────────────────────────── */
#aa-final-overlay {
    position: absolute; inset: 0;
    display: none;
    align-items: center; justify-content: center;
    background: none;
    z-index: 60;
}
#aa-final-overlay.active { display: flex; }

/* ─── Final argument quote ───────────────────────────── */
#aa-final-quote {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%) scale(1);
    width: 80%;
    text-align: center;
    font-size: 28px;
    font-weight: bold;
    font-style: italic;
    color: #ff6ec7;
    text-shadow: 2px 2px 5px #000, -1px -1px 3px #000, 0 0 12px rgba(255, 80, 200, 0.9), 0 0 28px rgba(255, 50, 180, 0.6);
    pointer-events: none;
    z-index: 6;
    opacity: 0;
    letter-spacing: 1px;
    line-height: 1.3;
    word-wrap: break-word;
    overflow-wrap: break-word;
}
#aa-final-quote.aa-quote-active {
    animation: aa-quote-in 5s linear forwards;
}
#aa-final-quote.aa-quote-dying {
    animation: aa-quote-die 0.3s ease-out forwards !important;
}
@keyframes aa-quote-die {
    0%   { opacity: 0.75; }
    100% { opacity: 0; }
}
@keyframes aa-quote-in {
    0%   { transform: translate(-50%, -50%) scale(0.15); opacity: 0; }
    15%  { opacity: 0.6; }
    85%  { transform: translate(-50%, -50%) scale(1.03); opacity: 0.85; }
    100% { transform: translate(-50%, -50%) scale(1.0);  opacity: 0.75; }
}

/* Direction boxes — anchored to overlay edges */
.aa-dir-box {
    position: absolute;
    width: 62px; height: 62px;
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    transition: transform 0.1s, box-shadow 0.15s;
    border-width: 3px; border-style: solid;
    z-index: 5;
}

#aa-dir-N {
    top: 24px; left: 50%; transform: translateX(-50%);
    background: #bb1133; border-color: #ff3366;
    box-shadow: 0 0 16px rgba(255,50,100,0.5);
}
#aa-dir-N:hover       { transform: translateX(-50%) scale(1.08); }
#aa-dir-N.aa-dir-pressed { transform: translateX(-50%) scale(0.93); }

#aa-dir-S {
    bottom: 24px; left: 50%; transform: translateX(-50%);
    background: #6622aa; border-color: #9944dd;
    box-shadow: 0 0 16px rgba(153,68,221,0.5);
}
#aa-dir-S:hover       { transform: translateX(-50%) scale(1.08); }
#aa-dir-S.aa-dir-pressed { transform: translateX(-50%) scale(0.93); }

#aa-dir-W {
    left: 24px; top: 50%; transform: translateY(-50%);
    background: #227733; border-color: #44cc66;
    box-shadow: 0 0 16px rgba(68,204,102,0.5);
}
#aa-dir-W:hover       { transform: translateY(-50%) scale(1.08); }
#aa-dir-W.aa-dir-pressed { transform: translateY(-50%) scale(0.93); }

#aa-dir-E {
    right: 24px; top: 50%; transform: translateY(-50%);
    background: #1133aa; border-color: #3366ff;
    box-shadow: 0 0 16px rgba(51,102,255,0.5);
}
#aa-dir-E:hover       { transform: translateY(-50%) scale(1.08); }
#aa-dir-E.aa-dir-pressed { transform: translateY(-50%) scale(0.93); }

.aa-dir-box.aa-dir-used {
    opacity: 0.3;
    cursor: default;
    pointer-events: none;
}

.aa-dir-arrow {
    font-size: 30px; color: #fff;
    text-shadow: 0 0 6px rgba(255,255,255,0.5);
    pointer-events: none;
}

/* Solution text near each edge button */
.aa-dir-solution {
    position: absolute;
    font-size: 44px; font-weight: bold;
    letter-spacing: 4px;
    color: #fff;
    text-shadow: 0 0 12px rgba(255,255,255,0.4);
    white-space: nowrap;
    pointer-events: none;
    transition: opacity 0.5s ease;
}
#aa-sol-N { top: 104px;    left: 50%;   transform: translateX(-50%); text-align: center; text-shadow: -1px -1px 0 #ff3366, 1px -1px 0 #ff3366, -1px 1px 0 #ff3366, 1px 1px 0 #ff3366, 0 0 14px rgba(255,51,102,0.7); }
#aa-sol-S { bottom: 104px; left: 50%;   transform: translateX(-50%); text-align: center; text-shadow: -1px -1px 0 #9944dd, 1px -1px 0 #9944dd, -1px 1px 0 #9944dd, 1px 1px 0 #9944dd, 0 0 14px rgba(153,68,221,0.7); }
#aa-sol-W { left: 104px;   top: 50%;    transform: translateY(-50%); writing-mode: vertical-rl; text-orientation: mixed; text-shadow: -1px -1px 0 #44cc66, 1px -1px 0 #44cc66, -1px 1px 0 #44cc66, 1px 1px 0 #44cc66, 0 0 14px rgba(68,204,102,0.7); }
#aa-sol-E { right: 104px;  top: 50%;    transform: translateY(-50%); writing-mode: vertical-rl; text-orientation: mixed; text-shadow: -1px -1px 0 #3366ff, 1px -1px 0 #3366ff, -1px 1px 0 #3366ff, 1px 1px 0 #3366ff, 0 0 14px rgba(51,102,255,0.7); }
.aa-dir-solution.aa-sol-hidden { opacity: 0 !important; pointer-events: none; }

/* Chosen sentence — accumulates above the S solution text */
#aa-chosen-sentence {
    position: absolute;
    bottom: 168px; left: 50%;
    transform: translateX(-50%);
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 16px;
    pointer-events: none;
    z-index: 10;
    text-align: center;
}
.aa-chosen-word {
    font-size: 20px; font-weight: bold;
    letter-spacing: 2px;
    color: #fff;
    white-space: nowrap;
}
/* Trapeze float-up on success */
@keyframes aa-float-trapeze {
    0%   { -webkit-transform: translateX(-50%) translateY(0)      perspective(600px) rotateX(0deg);  transform: translateX(-50%) translateY(0)      perspective(600px) rotateX(0deg);  opacity: 1; }
    35%  { -webkit-transform: translateX(-50%) translateY(-16vh)  perspective(500px) rotateX(8deg);  transform: translateX(-50%) translateY(-16vh)  perspective(500px) rotateX(8deg);  opacity: 1; }
    65%  { -webkit-transform: translateX(-50%) translateY(-32vh)  perspective(420px) rotateX(22deg); transform: translateX(-50%) translateY(-32vh)  perspective(420px) rotateX(22deg); opacity: 0.85; }
    100% { -webkit-transform: translateX(-50%) translateY(-44vh)  perspective(320px) rotateX(42deg); transform: translateX(-50%) translateY(-44vh)  perspective(320px) rotateX(42deg); opacity: 0; }
}
#aa-chosen-sentence.aa-float-up {
    animation: aa-float-trapeze 0.5s ease-in forwards;
    -webkit-transform-origin: bottom center;
    transform-origin: bottom center;
}

/* Sequence input display */
@keyframes aa-seq-shake {
    0%,100% { transform: translateX(0); }
    20%     { transform: translateX(-5px); }
    60%     { transform: translateX(5px); }
}

/* ─── Final argument countdown timer (HG style) ─────── */
#aa-final-timer-area {
    position: absolute;
    top: 20px; left: 24px;
    text-align: left;
    z-index: 6;
}
#aa-final-timer-label {
    font-size: 11px; letter-spacing: 3px;
    color: #dd88ff;
    text-shadow: 0 0 8px rgba(200,80,255,0.6);
    margin-bottom: 2px;
}
#aa-final-timer {
    font-size: 32px; font-weight: 700; letter-spacing: 3px;
    color: #ffaa00;
    text-shadow: 0 0 10px #ff8800, 0 0 3px #ffcc00;
}
#aa-final-timer.aa-urgent {
    color: #ff1111;
    text-shadow: 0 0 14px rgba(255,0,0,1);
    animation: ptaBlink 0.45s ease-in-out infinite;
}
@keyframes ptaBlink { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }

/* Failure flash */
#aa-final-fail-flash {
    position: absolute; inset: 0;
    background: rgba(255,0,80,0.3);
    opacity: 0; pointer-events: none;
    transition: opacity 0.1s;
    z-index: 2;
}
#aa-final-fail-flash.flash { opacity: 1; }

/* ─── Result banner ──────────────────────────────────── */
#aa-result-banner {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    opacity: 0; pointer-events: none;
    transition: opacity 0.35s;
    z-index: 70;
    background: rgba(0,0,0,0.6);
}
#aa-result-banner.active { opacity: 1; }
#aa-result-text {
    position: relative;
    font-size: 56px; letter-spacing: 8px;
    text-align: center;
    white-space: pre-line;
    padding: 56px 88px;
}
/* Frame the verdict in aa-panel.png, matching the corner panels. The image
 * lives on a ::before pseudo so the theme hue-shift filter only touches the
 * panel art, leaving the win/lose text glow crisp. */
#aa-result-text::before {
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
#aa-result-text.win {
    color: #22aaff;
    text-shadow: 0 0 30px rgba(34,170,255,0.8), 0 0 60px rgba(34,170,255,0.4);
}
#aa-result-text.lose {
    color: #ff2244;
    text-shadow: 0 0 30px rgba(255,34,68,0.8), 0 0 60px rgba(255,34,68,0.4);
}

/* ─── Tutorial prompt bar ────────────────────────────── */
#aa-tutorial-prompt {
    position: fixed; bottom: 0; left: 0; right: 0;
    z-index: 2147483646;
    background: rgba(10, 0, 24, 0.97);
    border-top: 2px solid rgba(200, 80, 255, 0.5);
    box-shadow: 0 -12px 40px rgba(160, 50, 255, 0.25), 0 -4px 14px rgba(160, 50, 255, 0.15);
    padding: 20px 32px 24px;
    font-family: "Noto Sans JP", "Noto Sans", sans-serif;
    text-align: center;
    opacity: 0; transform: translateY(12px);
    transition: opacity 280ms ease, transform 280ms ease;
}
#aa-tutorial-prompt.aa-tp-on { opacity: 1; transform: translateY(0); }
.aa-tp-text {
    color: rgba(220, 200, 235, 0.92);
    font-size: clamp(13px, 2vw, 17px);
    line-height: 1.6;
    margin-bottom: 18px;
}
.aa-tp-buttons {
    display: flex; justify-content: center; gap: 16px;
}
.aa-tp-btn {
    padding: 9px 28px;
    border-radius: 4px;
    border: 1.5px solid rgba(200, 80, 255, 0.55);
    background: rgba(40, 0, 70, 0.85);
    color: rgba(220, 190, 255, 0.95);
    font-family: inherit;
    font-size: 14px; letter-spacing: 1px;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.aa-tp-btn:hover {
    background: rgba(120, 30, 200, 0.6);
    border-color: rgba(220, 120, 255, 0.85);
    color: #fff;
}
.aa-tp-btn.aa-tp-no {
    background: rgba(20, 0, 36, 0.7);
    border-color: rgba(140, 60, 180, 0.4);
    color: rgba(200, 170, 230, 0.9);
    box-shadow: none;
}
.aa-tp-btn.aa-tp-never {
    background: rgba(12, 0, 22, 0.65);
    border-color: rgba(110, 110, 120, 0.3);
    color: rgba(190, 180, 200, 0.7);
    font-style: italic;
    box-shadow: none;
}
.aa-tp-btn.aa-tp-never:hover {
    background: rgba(40, 20, 60, 0.55);
    border-color: rgba(170, 170, 180, 0.55);
    color: rgba(230, 220, 240, 0.92);
}

/* ─── Tutorial modal ─────────────────────────────────── */
#aa-tutorial-modal {
    position: fixed; inset: 0;
    z-index: 2147483647;
    background: rgba(4, 0, 18, 0.88);
    display: flex; align-items: center; justify-content: center;
    opacity: 0; transition: opacity 260ms ease;
    font-family: "Noto Sans JP", "Noto Sans", sans-serif;
    padding: 20px;
    box-sizing: border-box;
}
#aa-tutorial-modal.aa-tm-on { opacity: 1; }
.aa-tm-inner {
    background: rgba(8, 0, 24, 0.98);
    border: 2px solid rgba(180, 60, 255, 0.45);
    box-shadow: 0 0 40px rgba(150, 40, 220, 0.2), 0 0 80px rgba(80, 0, 200, 0.12);
    border-radius: 6px;
    max-width: 700px; width: 100%;
    max-height: 90vh;
    display: flex; flex-direction: column;
    overflow: hidden;
}
.aa-tm-header {
    padding: 16px 22px 12px;
    border-bottom: 1px solid rgba(180, 60, 255, 0.25);
    flex-shrink: 0;
}
.aa-tm-title {
    font-family: "Orbitron", "Impact", monospace;
    font-size: clamp(16px, 3vw, 22px);
    font-weight: 900; letter-spacing: 0.06em;
    color: rgba(220, 160, 255, 0.95);
    text-shadow: 0 0 14px rgba(180, 80, 255, 0.6);
}
.aa-tm-img {
    width: 100%; display: block;
    flex-shrink: 0;
    height: auto;
    border-radius: 0;
}
.aa-tm-body {
    padding: 20px 24px;
    color: rgba(220, 200, 240, 0.88);
    font-size: clamp(12px, 1.8vw, 14px);
    line-height: 1.75;
    overflow-y: auto;
    flex: 1;
}
.aa-tm-body strong { color: rgba(220, 160, 255, 0.95); }
.aa-tm-footer {
    padding: 14px 24px 18px;
    border-top: 1px solid rgba(180, 60, 255, 0.2);
    display: flex; justify-content: flex-end;
    flex-shrink: 0;
}
.aa-tm-close {
    font-family: "Noto Sans JP", "Noto Sans", sans-serif;
    font-size: 14px; font-weight: 700;
    padding: 9px 30px;
    border-radius: 4px;
    border: 2px solid rgba(180, 60, 255, 0.6);
    background: rgba(24, 0, 48, 0.85);
    color: rgba(220, 160, 255, 0.95);
    cursor: pointer;
    letter-spacing: 0.05em;
    transition: background 140ms, box-shadow 140ms;
}
.aa-tm-close:hover {
    background: rgba(60, 10, 100, 0.95);
    box-shadow: 0 0 12px rgba(180, 60, 255, 0.4);
}

/* ─── Custom background image ────────────────────────── */
#aa-bg {
    position: absolute; inset: 0;
    z-index: 0;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
}

/* ─── Character sprite ───────────────────────────────── */
#aa-sprite {
    position: absolute;
    width: 531px;
    height: 1050px;
    top: calc(50% - 525px);
    left: calc(50% - 266px);
    z-index: 4;
    pointer-events: none;
    transition: left 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}
#aa-sprite img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    object-position: center center;
    display: block;
    animation: aa-sprite-glow 2.7s ease-in-out infinite;
}
@keyframes aa-sprite-glow {
    0%   { filter: drop-shadow(0 0 2px rgba(255, 80, 180, 0.55)); }
    50%  { filter: drop-shadow(0 0 7px rgba(255, 80, 180, 1)) drop-shadow(0 0 13px rgba(255, 80, 180, 0.5)); }
    100% { filter: drop-shadow(0 0 2px rgba(255, 80, 180, 0.55)); }
}
@keyframes aa-sprite-flash {
    0%   { filter: brightness(1); }
    35%  { filter: brightness(20) saturate(0); }
    65%  { filter: brightness(15) saturate(0); }
    100% { filter: brightness(1); }
}
#aa-sprite.aa-sprite-flashing {
    animation: aa-sprite-flash 0.5s ease-out forwards;
}
`;
}

export function createArgumentArmamentController({
    extensionFolderPath,
    awardMonocoins,
    deductMonocoins,
    restoreTheme,
    getPlayerSpriteUrl = null,
    isTutorialPromptEnabled = () => true,
    disableTutorialPrompt   = () => {},
}) {
    let overlayEl       = null;
    let spawnTimer      = null;
    let reloadTimer     = null;
    let spriteMoveTimer = null;
    let bgmAudio        = null;
    let _heartbeatAudio = null; // module-level ref so destroy() can stop it

    function destroy() {
        clearTimeout(spawnTimer);
        clearTimeout(spriteMoveTimer);
        clearInterval(reloadTimer);
        spawnTimer      = null;
        spriteMoveTimer = null;
        reloadTimer     = null;
        if (bgmAudio)        { try { bgmAudio.pause();        bgmAudio.src        = ''; } catch(_) {} bgmAudio        = null; }
        if (_heartbeatAudio) { try { _heartbeatAudio.pause(); _heartbeatAudio.src = ''; } catch(_) {} _heartbeatAudio = null; }
        if (overlayEl) { overlayEl.remove(); overlayEl = null; }
        document.getElementById('aa-got-it-banner')?.remove();
        document.getElementById('aa-got-it-prefill')?.remove();
        document.getElementById('aa-final-blow-banner')?.remove();
        document.getElementById('aa-final-blow-prefill')?.remove();
        document.getElementById('aa-tutorial-prompt')?.remove();
        document.getElementById('aa-tutorial-modal')?.remove();
        const s = document.getElementById(AA_STYLE);
        if (s) s.remove();
    }

    async function run({
        enemyHp:       rawEnemyHp,
        playerHp:      rawPlayerHp,
        phases:        rawPhases,
        dialogs,
        NSolution,
        SSolution,
        ESolution,
        WSolution,
        FinalSolution,
        FinalSolutionQuote,
        BG,
        clairvoyance = false,
        mainSprite = null,
        defeatSprite = null,
        getPhaseTrack = null,
    }) {
        destroy();

        const maxEnemyHp  = Math.max(1, Number(rawEnemyHp)  || 100);
        const maxPlayerHp = Math.max(1, Number(rawPlayerHp) || 100);
        const maxPhases   = Math.min(3, Math.max(1, Number(rawPhases) || 3));
        const dialogPool  = (dialogs || []).filter(Boolean);
        const finalSeqTarget = (FinalSolution || '').trim().toUpperCase();

        // ── State ────────────────────────────────────────────────
        let currentEnemyHp  = maxEnemyHp;
        let currentPlayerHp = maxPlayerHp;
        let phase           = 1;
        let ammo            = AMMO_MAX;
        let isReloading     = false;
        let isResolved      = false;
        let tutorialActive  = true;
        let cursorCell      = 4;
        let transitionLock      = false;
        let finalInputSeq       = [];
        let finalInputLocked    = false;
        let lastCombatPhase     = 1;
        let heartbeatAudio      = null;
        let finalCountdownTimer = null;

        // cellIndex → { el, type, hitCount, timeoutId }
        const activeDialogs = new Map();

        // ── Build DOM ────────────────────────────────────────────
        const styleEl = document.createElement('style');
        styleEl.id    = AA_STYLE;
        styleEl.textContent = buildStyles({ extensionFolderPath });
        document.head.appendChild(styleEl);


        overlayEl = document.createElement('div');
        overlayEl.id = AA_ID;
        overlayEl.innerHTML = `
            <div id="aa-damage-flash"></div>
            ${BG ? `<div id="aa-bg" style="background-image:url('${BG.replace(/'/g, '%27')}')"></div>` : ''}

            <div id="aa-panel-tl" class="aa-panel">
                <div id="aa-phase-label">PHASE 1</div>
                <div id="aa-enemy-bar-wrap">
                    <div id="aa-enemy-name">OPPONENT${clairvoyance ? ' <span id="aa-enemy-hp-display"></span>' : ''}</div>
                    <div class="aa-bar-track">
                        <div class="aa-bar-fill" id="aa-enemy-fill" style="width:100%"></div>
                        ${maxPhases >= 2 ? '<div class="aa-bar-marker" style="left:50%"></div>' : ''}
                        ${maxPhases >= 3 ? '<div class="aa-bar-marker" style="left:25%"></div>' : ''}
                    </div>
                </div>
            </div>

            <div id="aa-panel-bl" class="aa-panel">
                <div id="aa-ammo-wrap">
                    <img id="aa-ammo-icon" src="${extensionFolderPath}/assets/icons/artillery-shell.svg" alt=""/>
                    <div id="aa-ammo-count">×${AMMO_MAX}</div>
                    <div id="aa-ammo-label">AMMO</div>
                </div>
                <div id="aa-reload-indicator">RELOADING…</div>
            </div>

            <div id="aa-panel-br" class="aa-panel">
                <div id="aa-player-bar-wrap">
                    <div id="aa-player-name">YOU${clairvoyance ? ' <span id="aa-player-hp-display"></span>' : ''}</div>
                    <div class="aa-bar-track">
                        <div class="aa-bar-fill" id="aa-player-fill" style="width:100%"></div>
                    </div>
                </div>
            </div>

            <div id="aa-timer-area" class="aa-panel">
                <div id="aa-timer-label">TIME</div>
                <div id="aa-timer">01:30:000</div>
            </div>

            <div id="aa-grid">
                ${Array.from({ length: 9 }, (_, i) =>
                    `<div class="aa-cell" data-cell="${i}"></div>`
                ).join('')}
                <div id="aa-reticule"><span></span><span></span><span></span><span></span></div>
            </div>

            <div id="aa-sprite">
                <img src="${mainSprite || extensionFolderPath + '/assets/images/minigames/aa-tester-main.webp'}" alt=""/>
            </div>

            <div id="aa-phase-banner">
                <div id="aa-phase-banner-text"></div>
            </div>

            <div id="aa-final-overlay">
                <div id="aa-final-fail-flash"></div>
                <div id="aa-final-quote"></div>
                <div id="aa-final-timer-area">
                    <div id="aa-final-timer-label">TIME</div>
                    <div id="aa-final-timer">00:07:500</div>
                </div>
                <div id="aa-dir-N" class="aa-dir-box"><span class="aa-dir-arrow">▲</span></div>
                <div id="aa-dir-S" class="aa-dir-box"><span class="aa-dir-arrow">▼</span></div>
                <div id="aa-dir-W" class="aa-dir-box"><span class="aa-dir-arrow">◀</span></div>
                <div id="aa-dir-E" class="aa-dir-box"><span class="aa-dir-arrow">▶</span></div>
                <div class="aa-dir-solution" id="aa-sol-N">${NSolution || ''}</div>
                <div class="aa-dir-solution" id="aa-sol-S">${SSolution || ''}</div>
                <div class="aa-dir-solution" id="aa-sol-W">${WSolution || ''}</div>
                <div class="aa-dir-solution" id="aa-sol-E">${ESolution || ''}</div>
                <div id="aa-chosen-sentence"></div>
            </div>

            <div id="aa-result-banner">
                <div id="aa-result-text"></div>
            </div>
        `;
        document.body.appendChild(overlayEl);
        if (BG) overlayEl.style.background = 'none';
        requestAnimationFrame(() => requestAnimationFrame(() => overlayEl.classList.add('aa-on')));

        return new Promise(resolve => {

            // ── DOM refs ─────────────────────────────────────────
            const cells         = [...overlayEl.querySelectorAll('.aa-cell')];
            const enemyFill     = overlayEl.querySelector('#aa-enemy-fill');
            const playerFill    = overlayEl.querySelector('#aa-player-fill');
            const ammoCountEl   = overlayEl.querySelector('#aa-ammo-count');
            const reloadInd     = overlayEl.querySelector('#aa-reload-indicator');
            const ammoPanelEl   = overlayEl.querySelector('#aa-panel-bl');
            const phaseLabel    = overlayEl.querySelector('#aa-phase-label');
            const phaseBanner   = overlayEl.querySelector('#aa-phase-banner');
            const phaseBannerTx = overlayEl.querySelector('#aa-phase-banner-text');
            const finalOverlay  = overlayEl.querySelector('#aa-final-overlay');
            const finalQuoteEl      = overlayEl.querySelector('#aa-final-quote');
            const chosenSentenceEl  = overlayEl.querySelector('#aa-chosen-sentence');
            const resultBanner  = overlayEl.querySelector('#aa-result-banner');
            const resultText    = overlayEl.querySelector('#aa-result-text');
            const damageFlash   = overlayEl.querySelector('#aa-damage-flash');
            const failFlash     = overlayEl.querySelector('#aa-final-fail-flash');
            const finalTimerEl = overlayEl.querySelector('#aa-final-timer');

            // ── Global AA timer (bottom-right) ──────────────────
            // Counts the player's overall budget for the whole confrontation.
            // Hitting 0 ends the game as a loss.
            const AA_TIMER_MS = 90_000; // 90 s — adjust if needed
            const globalTimerEl = overlayEl.querySelector('#aa-timer');
            let globalTimerRaf   = null;
            let globalTimerStart = 0;
            function tickGlobalTimer(now) {
                if (isResolved) return;
                const remaining = Math.max(0, AA_TIMER_MS - (now - globalTimerStart));
                if (globalTimerEl) {
                    const mins   = Math.floor(remaining / 60000);
                    const secs   = Math.floor((remaining % 60000) / 1000);
                    const millis = Math.floor(remaining % 1000);
                    globalTimerEl.textContent =
                        String(mins).padStart(2,'0') + ':' +
                        String(secs).padStart(2,'0') + ':' +
                        String(millis).padStart(3,'0');
                    globalTimerEl.classList.toggle('aa-urgent', remaining < 10_000);
                }
                if (remaining <= 0) {
                    globalTimerRaf = null;
                    endGame(false);
                    return;
                }
                globalTimerRaf = requestAnimationFrame(tickGlobalTimer);
            }
            function startGlobalTimer() {
                cancelAnimationFrame(globalTimerRaf);
                globalTimerStart = performance.now();
                globalTimerRaf   = requestAnimationFrame(tickGlobalTimer);
            }
            function stopGlobalTimer() {
                if (globalTimerRaf) cancelAnimationFrame(globalTimerRaf);
                globalTimerRaf = null;
            }

            // ── Final timer animation ─────────────────────────────
            let timerRafId   = null;
            let timerStartTs = 0;
            const FINAL_MS   = 7500;

            function tickTimerFrame(now) {
                const elapsed   = now - timerStartTs;
                const remaining = Math.max(0, FINAL_MS - elapsed);
                const mins   = Math.floor(remaining / 60000);
                const secs   = Math.floor((remaining % 60000) / 1000);
                const millis = Math.floor(remaining % 1000);
                finalTimerEl.textContent =
                    String(mins).padStart(2,'0') + ':' +
                    String(secs).padStart(2,'0') + ':' +
                    String(millis).padStart(3,'0');
                finalTimerEl.classList.toggle('aa-urgent', remaining < 2000);
                if (remaining > 0) timerRafId = requestAnimationFrame(tickTimerFrame);
            }

            function startTimerAnimation() {
                cancelAnimationFrame(timerRafId);
                timerStartTs = performance.now();
                finalTimerEl.textContent = '00:07:500';
                finalTimerEl.classList.remove('aa-urgent');
                timerRafId = requestAnimationFrame(tickTimerFrame);
            }

            function stopTimerAnimation() {
                cancelAnimationFrame(timerRafId);
                timerRafId = null;
            }

            // ── UI helpers ───────────────────────────────────────
            const reticule = overlayEl.querySelector('#aa-reticule');
            function updateCursor() {
                const col = cursorCell % 3;
                const row = Math.floor(cursorCell / 3);
                reticule.style.left = (col * 346) + 'px';
                reticule.style.top  = (row * 226) + 'px';
            }
            updateCursor();

            // ── Character sprite movement ────────────────────────
            const spriteEl  = overlayEl.querySelector('#aa-sprite');
            const spriteImg = spriteEl.querySelector('img');
            // left values for columns 0, 1, 2 — sprite centered within each column
            const SPRITE_COL_LEFTS = ['calc(50% - 612px)', 'calc(50% - 266px)', 'calc(50% + 80px)'];
            let spriteCol = 1;

            function moveSpriteToCol(col) {
                spriteCol = col;
                spriteEl.style.left = SPRITE_COL_LEFTS[col];
            }

            function scheduleSpriteMoveStep() {
                clearTimeout(spriteMoveTimer);
                if (isResolved) return;
                spriteMoveTimer = setTimeout(() => {
                    if (isResolved) return;
                    let nextCol;
                    if (spriteCol === 0)      nextCol = 1;
                    else if (spriteCol === 2) nextCol = 1;
                    else                      nextCol = Math.random() < 0.5 ? 0 : 2;
                    moveSpriteToCol(nextCol);
                    scheduleSpriteMoveStep();
                }, 3000);
            }

            const enemyHpDisplay  = overlayEl.querySelector('#aa-enemy-hp-display');
            const playerHpDisplay = overlayEl.querySelector('#aa-player-hp-display');

            function updateBars() {
                enemyFill.style.width  = `${Math.max(0, (currentEnemyHp  / maxEnemyHp)  * 100)}%`;
                playerFill.style.width = `${Math.max(0, (currentPlayerHp / maxPlayerHp) * 100)}%`;
                if (clairvoyance) {
                    if (enemyHpDisplay)  enemyHpDisplay.textContent  = `${Math.max(0, currentEnemyHp)} / ${maxEnemyHp}`;
                    if (playerHpDisplay) playerHpDisplay.textContent = `${Math.max(0, currentPlayerHp)} / ${maxPlayerHp}`;
                }
            }

            function updateAmmoUI() {
                ammoCountEl.textContent = `×${ammo}`;
            }
            updateAmmoUI();
            updateBars();

            const damageSfx = new Audio(`${extensionFolderPath}/assets/monokuma/incorrect-answer.wav`);
            damageSfx.load();

            function damagePlayer(amount) {
                currentPlayerHp = Math.max(0, currentPlayerHp - amount);
                updateBars();
                flashScreen('red');
                overlayEl.classList.remove('aa-shaking');
                void overlayEl.offsetWidth;
                overlayEl.classList.add('aa-shaking');
                setTimeout(() => overlayEl.classList.remove('aa-shaking'), 360);
                damageSfx.currentTime = 0;
                damageSfx.play().catch(() => {});
                checkPlayerDeath();
            }

            function flashScreen(color) {
                const bg = {
                    red:    'rgba(255,0,0,0.38)',
                    orange: 'rgba(255,140,0,0.40)',
                    blue:   'rgba(77,166,255,0.38)',
                    white:  'rgba(255,255,255,0.18)',
                }[color] ?? 'rgba(255,0,0,0.38)';
                damageFlash.style.setProperty('--aa-flash-bg', bg);
                damageFlash.classList.remove('flash');
                requestAnimationFrame(() => {
                    damageFlash.classList.add('flash');
                    setTimeout(() => damageFlash.classList.remove('flash'), 200);
                });
            }

            // ── BGM ──────────────────────────────────────────────
            function playPhaseMusic(phaseNum) {
                if (bgmAudio) {
                    try { bgmAudio.pause(); bgmAudio.src = ''; } catch(_) {}
                    bgmAudio = null;
                }
                const customSrc = getPhaseTrack?.(phaseNum) ?? null;
                const src = customSrc || `${extensionFolderPath}/assets/bgm/Argument Armament Phase ${phaseNum}.mp3`;
                bgmAudio = new Audio(src);
                bgmAudio.loop = (phaseNum === 3);
                bgmAudio.volume = 0.7;
                bgmAudio.play().catch(err => console.warn(`[AA] Phase ${phaseNum} BGM play failed (file missing?):`, err));
            }

            // ── Dialog spawning ──────────────────────────────────
            function spawnDialog(forcedCellIdx = null) {
                if (isResolved || transitionLock || dialogPool.length === 0) return;

                let cellIdx;
                if (forcedCellIdx !== null) {
                    if (activeDialogs.has(forcedCellIdx)) return; // skip occupied cells
                    cellIdx = forcedCellIdx;
                } else {
                    const emptyCells = cells.map((_, i) => i).filter(i => !activeDialogs.has(i));
                    if (emptyCells.length === 0) return;
                    cellIdx = emptyCells[Math.floor(Math.random() * emptyCells.length)];
                }
                const dialogText = dialogPool[Math.floor(Math.random() * dialogPool.length)];
                const type       = randomDialogType();
                const duration   = PHASE_CONFIG[phase].dialogDuration;

                const rotStart = (Math.random() * 50 - 25).toFixed(1);
                const rotEnd   = (Math.random() * 50 - 25).toFixed(1);

                const el = document.createElement('div');
                el.className = `aa-dialog aa-${type}`;
                el.style.animationDuration = `${duration}ms`;
                el.style.setProperty('--rot-start', `${rotStart}deg`);
                el.style.setProperty('--rot-end',   `${rotEnd}deg`);
                el.textContent = dialogText;
                cells[cellIdx].appendChild(el);
                cells[cellIdx].style.setProperty('--cell-warn-dur', `${duration}ms`);
                cells[cellIdx].classList.add('aa-cell-active');

                const timeoutId = setTimeout(() => {
                    if (!activeDialogs.has(cellIdx)) return;
                    activeDialogs.delete(cellIdx);
                    el.remove();
                    resetCellWarn(cellIdx);
                    // Pink text slipping through is a trap avoided — no penalty
                    if (!isResolved && !transitionLock && type !== 'pink') {
                        damagePlayer(1);
                    }
                }, duration);

                activeDialogs.set(cellIdx, { el, type, hitCount: 0, timeoutId });
            }

            function resetCellWarn(cellIdx) {
                const cell = cells[cellIdx];
                cell.classList.remove('aa-cell-active', 'aa-cell-fading');
                cell.style.removeProperty('--cell-warn-dur');
                cell.style.removeProperty('--cell-warn-snapshot');
            }

            function fadeCellWarn(cellIdx) {
                const cell = cells[cellIdx];
                // Snapshot the computed background so the fade-out starts from the current colour
                const snapshot = getComputedStyle(cell).background || getComputedStyle(cell).backgroundColor;
                cell.classList.remove('aa-cell-active');
                cell.style.setProperty('--cell-warn-snapshot', snapshot);
                cell.classList.add('aa-cell-fading');
                setTimeout(() => {
                    cell.classList.remove('aa-cell-fading');
                    cell.style.removeProperty('--cell-warn-dur');
                    cell.style.removeProperty('--cell-warn-snapshot');
                }, 200);
            }

            function clearAllDialogs() {
                for (const [cellIdx, info] of activeDialogs) {
                    clearTimeout(info.timeoutId);
                    info.el.remove();
                    resetCellWarn(cellIdx);
                }
                activeDialogs.clear();
            }

            function scheduleNextGroup() {
                if (isResolved || transitionLock) return;
                const baseInterval = PHASE_CONFIG[phase].spawnInterval;
                const jitter = 0.7 + Math.random() * 0.6; // 0.7× – 1.3×
                spawnTimer = setTimeout(spawnGroup, baseInterval * jitter);
            }

            function spawnPattern() {
                const pattern = SPAWN_PATTERNS[Math.floor(Math.random() * SPAWN_PATTERNS.length)];
                pattern.forEach((cellIdx, i) => {
                    setTimeout(() => {
                        if (isResolved || transitionLock) return;
                        spawnDialog(cellIdx);
                    }, i * 200);
                });
            }

            function spawnGroup() {
                if (isResolved || transitionLock || dialogPool.length === 0) return;
                if (Math.random() < 0.10) {
                    spawnPattern();
                } else {
                    const r = Math.random();
                    const groupSize = r < 0.65 ? 1 : r < 0.90 ? 2 : 3;
                    for (let i = 0; i < groupSize; i++) {
                        setTimeout(() => spawnDialog(), i * (130 + Math.random() * 100));
                    }
                }
                scheduleNextGroup();
            }

            function startSpawnLoop() {
                clearTimeout(spawnTimer);
                spawnGroup();
            }

            // ── Phase transitions ────────────────────────────────
            async function transitionToPhase(newPhase) {
                if (transitionLock || isResolved) return;
                transitionLock = true;
                clearTimeout(spawnTimer);
                if (bgmAudio) { try { bgmAudio.pause(); } catch(_) {} }
                clearAllDialogs();

                if (newPhase === 'final') {
                    // Skip the text banner — Final Blow banner handles the intro
                    if (isResolved) return;
                    lastCombatPhase = phase;
                    if (finalOverlay.classList.contains('active')) {
                        reenterFinalPhase();
                    } else {
                        await showFinalPhase();
                    }
                    return;
                }

                phaseBannerTx.textContent = `PHASE ${newPhase}`;
                phaseBanner.classList.add('active');

                await new Promise(r => setTimeout(r, 2000));
                phaseBanner.classList.remove('active');

                if (isResolved) return;

                phase = newPhase;
                phaseLabel.textContent = `PHASE ${newPhase}`;
                playPhaseMusic(newPhase);
                moveSpriteToCol(1);
                transitionLock = false;
                startSpawnLoop();
                scheduleSpriteMoveStep();
            }

            function checkPhaseTransition() {
                if (isResolved || transitionLock) return;
                const pct = currentEnemyHp / maxEnemyHp;
                if (currentEnemyHp <= 0) {
                    transitionToPhase('final');
                } else if (maxPhases >= 3 && phase === 2 && pct <= 0.25) {
                    transitionToPhase(3);
                } else if (maxPhases >= 2 && phase === 1 && pct <= 0.50) {
                    transitionToPhase(2);
                }
            }

            function checkPlayerDeath() {
                if (currentPlayerHp <= 0 && !isResolved) {
                    endGame(false);
                }
            }

            // ── Ammo / Reload ────────────────────────────────────
            function stopReload() {
                clearInterval(reloadTimer);
                reloadTimer = null;
                isReloading = false;
                reloadInd.classList.remove('active');
            }

            function tickReload() {
                if (isResolved) { stopReload(); return; }
                new Audio(`${extensionFolderPath}/assets/sfx/minigames/reload.wav`).play().catch(() => {});
                ammo = Math.min(AMMO_MAX, ammo + 1);
                updateAmmoUI();
                if (ammo >= AMMO_MAX) stopReload();
            }

            function startAutoReload() {
                if (isReloading || transitionLock) return;
                isReloading = true;
                reloadInd.classList.add('active');
                reloadTimer = setInterval(tickReload, 500);
            }

            function startManualReload() {
                if (isReloading || ammo >= AMMO_MAX || transitionLock) return;
                isReloading = true;
                reloadInd.classList.add('active');
                reloadTimer = setInterval(tickReload, 500);
            }

            // ── Despawn a dialog with a fade-out ─────────────────
            function despawnDialogEl(el) {
                el.classList.add('aa-dying');
                setTimeout(() => el.remove(), 200);
            }

            // ── Hit burst effect ──────────────────────────────────
            function showHitBurst(cellIdx) {
                const burst = document.createElement('div');
                burst.className = 'aa-hit-burst';
                cells[cellIdx].appendChild(burst);
                setTimeout(() => burst.remove(), 380);
            }

            // ── Fire at cell ─────────────────────────────────────
            function fireAtCell(cellIdx) {
                if (isResolved || transitionLock || finalOverlay.classList.contains('active')) return;
                if (isReloading) return;
                if (ammo <= 0) { startAutoReload(); return; }

                ammo--;
                updateAmmoUI();
                showHitBurst(cellIdx);

                if (!activeDialogs.has(cellIdx)) {
                    new Audio(`${extensionFolderPath}/assets/sfx/minigames/empty-grid-hit.wav`).play().catch(() => {});
                    const miss = document.createElement('div');
                    miss.className = 'aa-miss-label';
                    miss.textContent = 'MISS!';
                    cells[cellIdx].appendChild(miss);
                    setTimeout(() => miss.remove(), 600);
                } else {
                    const info = activeDialogs.get(cellIdx);
                    const { type } = info;

                    if (type === 'blue') {
                        info.hitCount++;
                        // Every hit on blue deals 1HP to opponent
                        currentEnemyHp = Math.max(0, currentEnemyHp - 1);
                        updateBars();
                        new Audio(`${extensionFolderPath}/assets/sfx/minigames/hit-other.wav`).play().catch(() => {});
                        if (info.hitCount < 2) {
                            // First hit – turn orange, flash blue
                            info.el.classList.remove('aa-blue');
                            info.el.classList.add('aa-blue-hit');
                            flashScreen('blue');
                            checkPhaseTransition();
                            if (ammo <= 0) startAutoReload();
                            return;
                        }
                        // Second hit – break it, flash blue
                        flashScreen('blue');
                        clearTimeout(info.timeoutId);
                        activeDialogs.delete(cellIdx);
                        despawnDialogEl(info.el);
                        fadeCellWarn(cellIdx);
                        checkPhaseTransition();
                    } else {
                        // Break the dialog
                        clearTimeout(info.timeoutId);
                        activeDialogs.delete(cellIdx);
                        despawnDialogEl(info.el);
                        fadeCellWarn(cellIdx);

                        if (type === 'normal') {
                            new Audio(`${extensionFolderPath}/assets/sfx/minigames/hit-white.wav`).play().catch(() => {});
                            flashScreen('white');
                        } else {
                            new Audio(`${extensionFolderPath}/assets/sfx/minigames/hit-other.wav`).play().catch(() => {});
                        }

                        if (type === 'pink') {
                            damagePlayer(1);
                        } else if (type === 'orange') {
                            currentEnemyHp = Math.max(0, currentEnemyHp - 1);
                            flashScreen('orange');
                            updateBars();
                            checkPhaseTransition();
                        }
                    }
                }

                if (ammo <= 0) startAutoReload();
            }

            // ── Final Solution phase ─────────────────────────────
            function stopHeartbeat() {
                if (heartbeatAudio) {
                    try { heartbeatAudio.pause(); heartbeatAudio.src = ''; } catch(_) {}
                    heartbeatAudio = null;
                    _heartbeatAudio = null;
                }
            }

            function startFinalCountdown() {
                clearTimeout(finalCountdownTimer);
                finalCountdownTimer = setTimeout(() => {
                    // Time expired — force a non-match
                    if (!isResolved && finalOverlay.classList.contains('active')) {
                        checkFinalSolution(true);
                    }
                }, 5000);
            }

            function triggerFinalQuote() {
                if (!FinalSolutionQuote) return;
                finalQuoteEl.textContent = FinalSolutionQuote;
                finalQuoteEl.classList.remove('aa-quote-active');
                void finalQuoteEl.offsetWidth; // reflow to restart animation
                finalQuoteEl.classList.add('aa-quote-active');
            }

            function resetFinalSolTexts() {
                overlayEl.querySelectorAll('.aa-dir-solution').forEach(el => el.classList.remove('aa-sol-hidden'));
                overlayEl.querySelectorAll('.aa-dir-box').forEach(el => el.classList.remove('aa-dir-used'));
                chosenSentenceEl.innerHTML = '';
            }

            function fadeInSolTexts() {
                // Hide all immediately, then stagger fade-in
                overlayEl.querySelectorAll('.aa-dir-solution').forEach(el => el.classList.add('aa-sol-hidden'));
                ['N', 'W', 'E', 'S'].forEach((dir, i) => {
                    setTimeout(() => {
                        overlayEl.querySelector(`#aa-sol-${dir}`)?.classList.remove('aa-sol-hidden');
                    }, 300 + i * 160);
                });
                // Input and timer start immediately
                finalInputLocked = false;
                startTimerAnimation();
                startFinalCountdown();
            }

            const combatUIEls = () => [
                overlayEl.querySelector('#aa-grid'),
                ...overlayEl.querySelectorAll('.aa-panel'),
            ];

            function fadeCombatUI(fadeOut) {
                combatUIEls().forEach(el => {
                    if (!el) return;
                    el.style.transition = 'opacity 0.6s ease';
                    el.style.opacity    = fadeOut ? '0' : '1';
                    el.style.pointerEvents = fadeOut ? 'none' : '';
                });
            }

            async function showFinalPhase() {
                clearTimeout(spriteMoveTimer);
                await showFinalBlowBanner();
                if (isResolved) return;

                // Snap sprite to center, fade out combat UI simultaneously
                moveSpriteToCol(1);
                fadeCombatUI(true);
                await new Promise(r => setTimeout(r, 700));
                if (isResolved) return;

                // Move sprite into final overlay so it renders above the overlay background
                finalOverlay.insertBefore(spriteEl, finalOverlay.firstChild);
                spriteEl.style.zIndex = '1';
                moveSpriteToCol(1);

                transitionLock = false;
                finalInputSeq  = [];
                chosenSentenceEl.innerHTML = '';
                overlayEl.querySelectorAll('.aa-dir-box').forEach(el => el.classList.remove('aa-dir-used'));
                if (bgmAudio) { try { bgmAudio.pause(); bgmAudio.src = ''; } catch(_) {} bgmAudio = null; }
                finalOverlay.classList.add('active');
                updateSeqDisplay();
                triggerFinalQuote();
                fadeInSolTexts(); // also starts timer + unlocks input after texts appear

                // Loop heartbeat for the duration
                heartbeatAudio = new Audio(`${extensionFolderPath}/assets/sfx/minigames/heartbeat.wav`);
                heartbeatAudio.loop = true;
                heartbeatAudio.play().catch(() => {});
                _heartbeatAudio = heartbeatAudio;
            }

            function updateSeqDisplay() { /* slots removed */ }

            const DIR_OUTLINE_COLORS = { N: '#ff3366', S: '#9944dd', W: '#44cc66', E: '#3366ff' };

            function onFinalDirPress(dir) {
                if (isResolved || finalInputLocked || finalInputSeq.length >= 4) return;
                if (finalInputSeq.includes(dir)) return;

                new Audio(`${extensionFolderPath}/assets/sfx/minigames/submission.wav`).play().catch(() => {});

                finalInputSeq.push(dir);
                updateSeqDisplay();

                // Hide the solution label for this direction
                const solEl = overlayEl.querySelector(`#aa-sol-${dir}`);
                const solText = solEl ? solEl.textContent.trim() : '';
                if (solEl) solEl.classList.add('aa-sol-hidden');

                // Append to chosen sentence
                if (solText) {
                    const color = DIR_OUTLINE_COLORS[dir] || '#fff';
                    const span = document.createElement('span');
                    span.className = 'aa-chosen-word';
                    span.textContent = solText;
                    span.style.textShadow = `-1px -1px 0 ${color}, 1px -1px 0 ${color}, -1px 1px 0 ${color}, 1px 1px 0 ${color}, 0 0 8px ${color}, 2px 2px 5px #000, -1px -1px 4px #000`;
                    chosenSentenceEl.appendChild(span);
                }

                const box = overlayEl.querySelector(`#aa-dir-${dir}`);
                if (box) {
                    box.classList.add('aa-dir-pressed');
                    setTimeout(() => {
                        box.classList.remove('aa-dir-pressed');
                        box.classList.add('aa-dir-used');
                    }, 200);
                }

                if (finalInputSeq.length === 4) {
                    clearTimeout(finalCountdownTimer);
                    finalCountdownTimer = null;
                    checkFinalSolution(false);
                }
            }

            function resumeCombatFromFailure() {
                if (isResolved) return;
                finalInputLocked = false;
                finalOverlay.classList.remove('active');
                finalInputSeq = [];
                updateSeqDisplay();
                // Restore combat UI
                fadeCombatUI(false);
                // Move sprite back to main overlay for combat
                overlayEl.insertBefore(spriteEl, finalOverlay);
                spriteEl.style.zIndex = '4';
                playPhaseMusic(lastCombatPhase);
                moveSpriteToCol(1);
                startSpawnLoop();
                scheduleSpriteMoveStep();
            }

            function reenterFinalPhase() {
                // Called when enemy is defeated again after a failed attempt
                finalInputSeq = [];
                chosenSentenceEl.innerHTML = '';
                overlayEl.querySelectorAll('.aa-dir-box').forEach(el => el.classList.remove('aa-dir-used'));
                updateSeqDisplay();
                // Ensure sprite is inside final overlay
                if (!finalOverlay.contains(spriteEl)) {
                    finalOverlay.insertBefore(spriteEl, finalOverlay.firstChild);
                    spriteEl.style.zIndex = '1';
                }
                moveSpriteToCol(1);
                triggerFinalQuote();
                heartbeatAudio = new Audio(`${extensionFolderPath}/assets/sfx/minigames/heartbeat.wav`);
                heartbeatAudio.loop = true;
                heartbeatAudio.play().catch(() => {});
                _heartbeatAudio = heartbeatAudio;
                fadeInSolTexts(); // starts timer + unlocks input after texts appear
            }

            async function showGotItBanner() {
                const audio = new Audio(`${extensionFolderPath}/assets/monokuma/question-answered-correctly.wav`);
                audio.play().catch(() => {});

                // Prefill bar sweeps in
                document.getElementById('aa-got-it-prefill')?.remove();
                const prefill = document.createElement('div');
                prefill.id = 'aa-got-it-prefill';
                prefill.style.cssText = 'position:fixed;top:33.33%;left:0;right:0;height:33.34%;z-index:2147483646;background:#000;pointer-events:none;transform:scaleX(0);transform-origin:center;transition:transform 0.045s ease-out;';
                document.body.appendChild(prefill);
                await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
                prefill.style.transform = 'scaleX(1)';
                await new Promise(r => setTimeout(r, 55));

                // Banner slides in
                document.getElementById('aa-got-it-banner')?.remove();
                document.body.insertAdjacentHTML('beforeend', `
                    <div id="aa-got-it-banner" style="position:fixed;top:33.33%;left:0;right:0;height:33.34%;z-index:2147483647;pointer-events:none;overflow:hidden;border-top:6px solid #000;border-bottom:6px solid #000;">
                        <div id="aa-got-it-banner-inner" style="position:absolute;top:0;bottom:0;left:100%;width:100%;display:flex;align-items:center;justify-content:center;overflow:hidden;transition:left 0.325s cubic-bezier(0.22,0.61,0.36,1);">
                            <img style="width:100%;height:100%;object-fit:cover;object-position:center;display:block;" src="${extensionFolderPath}/assets/images/minigames/got-it-banner.png" alt="Got It"/>
                        </div>
                    </div>
                `);
                const banner = document.getElementById('aa-got-it-banner');
                const inner  = document.getElementById('aa-got-it-banner-inner');

                // Player approval sprite overlay — matches Mind Mine's "Got It!"
                // banner so the player character peeks up over the banner strip.
                // The banner geometry is identical, so reuse the same placement.
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
                inner.style.left = '0%';
                await new Promise(r => setTimeout(r, 3350));

                // Fade out
                banner.style.transition = 'opacity 0.5s ease';
                banner.style.opacity = '0';
                prefill.style.transition = 'opacity 0.5s ease';
                prefill.style.opacity = '0';
                await new Promise(r => setTimeout(r, 520));
                banner.remove();
                prefill.remove();
            }

            async function showFinalBlowBanner() {
                // Banner slides in from the LEFT
                document.getElementById('aa-final-blow-banner')?.remove();
                document.body.insertAdjacentHTML('beforeend', `
                    <div id="aa-final-blow-banner" style="position:fixed;top:33.33%;left:0;right:0;height:33.34%;z-index:2147483647;pointer-events:none;overflow:hidden;">
                        <div id="aa-final-blow-banner-inner" style="position:absolute;top:0;bottom:0;right:100%;width:100%;display:flex;align-items:center;justify-content:center;overflow:hidden;transition:right 0.325s cubic-bezier(0.22,0.61,0.36,1);">
                            <img style="width:100%;height:100%;object-fit:cover;object-position:center;display:block;" src="${extensionFolderPath}/assets/images/minigames/final-blow-banner.png" alt="Final Blow"/>
                        </div>
                    </div>
                `);
                const banner = document.getElementById('aa-final-blow-banner');
                const inner  = document.getElementById('aa-final-blow-banner-inner');
                await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
                inner.style.right = '0%';
                await new Promise(r => setTimeout(r, 2500));

                // Fade out
                banner.style.transition = 'opacity 0.5s ease';
                banner.style.opacity = '0';
                await new Promise(r => setTimeout(r, 520));
                banner.remove();
            }

            function checkFinalSolution(timedOut) {
                const inputStr = timedOut ? '' : finalInputSeq.join('');
                if (!timedOut && inputStr === finalSeqTarget) {
                    // ── Success ──────────────────────────────────────
                    stopHeartbeat();
                    stopTimerAnimation();

                    // Despawn quote quickly, then float chosen words up
                    finalQuoteEl.classList.remove('aa-quote-active');
                    finalQuoteEl.classList.add('aa-quote-dying');
                    setTimeout(() => {
                        chosenSentenceEl.classList.add('aa-float-up');
                        new Audio(`${extensionFolderPath}/assets/sfx/minigames/final-shot.wav`).play().catch(() => {});
                    }, 350);

                    // Float animation finishes ~1900ms in; show banner, then flash sprite
                    setTimeout(() => showGotItBanner().then(() => {
                        clearTimeout(spriteMoveTimer);
                        spriteEl.classList.add('aa-sprite-flashing');
                        setTimeout(() => {
                            spriteImg.src = defeatSprite || `${extensionFolderPath}/assets/images/minigames/aa-tester-final.webp`;
                            new Audio(`${extensionFolderPath}/assets/sfx/minigames/aa-end.wav`).play().catch(() => {});
                        }, 250);
                        setTimeout(() => endGame(true), 600);
                    }), 1900);
                } else {
                    // ── Failure ──────────────────────────────────────
                    stopHeartbeat();
                    stopTimerAnimation();
                    failFlash.classList.add('flash');
                    setTimeout(() => failFlash.classList.remove('flash'), 300);

                    // Penalty: player -10%, enemy restored to 25% of max
                    currentEnemyHp = maxEnemyHp * 0.25;
                    damagePlayer(maxPlayerHp * 0.10);

                    setTimeout(() => {
                        if (isResolved) return;
                        if (currentPlayerHp <= 0) {
                            endGame(false);
                            return;
                        }
                        // Return to combat and restart the countdown next time
                        resumeCombatFromFailure();
                    }, 1500);
                }
            }

            // ── End game ─────────────────────────────────────────
            function endGame(won) {
                if (isResolved) return;
                isResolved = true;
                ac.abort();
                clearTimeout(spawnTimer);
                clearInterval(reloadTimer);
                clearTimeout(finalCountdownTimer);
                finalCountdownTimer = null;
                stopHeartbeat();
                stopTimerAnimation();
                stopGlobalTimer();
                clearAllDialogs();
                if (bgmAudio) { try { bgmAudio.pause(); bgmAudio.src = ''; } catch(_) {} bgmAudio = null; }

                resultText.textContent = won ? 'BREAK' : 'ARGUMENT\nDENIED';
                resultText.className   = won ? 'win' : 'lose';
                resultBanner.classList.add('active');

                if (won) {
                    awardMonocoins?.(10, 'Argument Armament victory');
                } else {
                    deductMonocoins?.(5, 'Argument Armament defeat');
                }

                setTimeout(() => {
                    restoreTheme?.();
                    overlayEl.style.opacity = '0';
                    setTimeout(() => { destroy(); resolve(won); }, 350);
                }, 2500);
            }

            // ── Mouse: hover moves cursor, click fires ────────────
            cells.forEach((cell, i) => {
                cell.addEventListener('mouseenter', () => {
                    if (tutorialActive) return;
                    if (i !== cursorCell) {
                        cursorCell = i;
                        updateCursor();
                        const mvSfx = new Audio(`${extensionFolderPath}/assets/sfx/minigames/movement.wav`); mvSfx.volume = 0.75; mvSfx.play().catch(() => {});
                    }
                });
                cell.addEventListener('click', () => {
                    if (tutorialActive) return;
                    cursorCell = i;
                    updateCursor();
                    fireAtCell(i);
                });
            });

            // ── Mouse: final direction boxes ──────────────────────
            ['N', 'S', 'E', 'W'].forEach(dir => {
                overlayEl.querySelector(`#aa-dir-${dir}`)
                    ?.addEventListener('click', () => onFinalDirPress(dir));
            });

            ammoPanelEl.style.cursor = 'pointer';
            ammoPanelEl.addEventListener('click', () => { if (!tutorialActive) startManualReload(); });

            // ── Keyboard controls ─────────────────────────────────
            const ac = new AbortController();
            const { signal } = ac;

            document.addEventListener('keydown', (e) => {
                if (isResolved || tutorialActive) return;

                if (finalOverlay.classList.contains('active')) {
                    // Final phase arrow keys
                    switch (e.key) {
                        case 'ArrowUp':    e.preventDefault(); onFinalDirPress('N'); break;
                        case 'ArrowDown':  e.preventDefault(); onFinalDirPress('S'); break;
                        case 'ArrowLeft':  e.preventDefault(); onFinalDirPress('W'); break;
                        case 'ArrowRight': e.preventDefault(); onFinalDirPress('E'); break;
                    }
                    return;
                }

                // Combat phase controls
                switch (e.key) {
                    case 'ArrowUp':
                        e.preventDefault();
                        if (cursorCell >= 3) { cursorCell -= 3; updateCursor(); const a1=new Audio(`${extensionFolderPath}/assets/sfx/minigames/movement.wav`);a1.volume=0.75;a1.play().catch(()=>{}); }
                        break;
                    case 'ArrowDown':
                        e.preventDefault();
                        if (cursorCell <= 5) { cursorCell += 3; updateCursor(); const a2=new Audio(`${extensionFolderPath}/assets/sfx/minigames/movement.wav`);a2.volume=0.75;a2.play().catch(()=>{}); }
                        break;
                    case 'ArrowLeft':
                        e.preventDefault();
                        if (cursorCell % 3 > 0) { cursorCell--; updateCursor(); const a3=new Audio(`${extensionFolderPath}/assets/sfx/minigames/movement.wav`);a3.volume=0.75;a3.play().catch(()=>{}); }
                        break;
                    case 'ArrowRight':
                        e.preventDefault();
                        if (cursorCell % 3 < 2) { cursorCell++; updateCursor(); const a4=new Audio(`${extensionFolderPath}/assets/sfx/minigames/movement.wav`);a4.volume=0.75;a4.play().catch(()=>{}); }
                        break;
                    case ' ':
                        e.preventDefault();
                        fireAtCell(cursorCell);
                        break;
                    case 'r':
                    case 'R':
                        e.preventDefault();
                        startManualReload();
                        break;
                }
            }, { signal, capture: true });

            // ── Tutorial prompt / modal ───────────────────────────
            function showTutorialPrompt() {
                // User has disabled tutorial prompts in settings — proceed
                // as if they'd chosen "No, let's go!".
                if (!isTutorialPromptEnabled()) return Promise.resolve(false);

                return new Promise(resolve => {
                    const el = document.createElement('div');
                    el.id = 'aa-tutorial-prompt';
                    el.innerHTML = `
                        <div class="aa-tp-text">
                            The minigame <strong>Argument Armament</strong> is about to begin. Would you like to hear an explanation?
                        </div>
                        <div class="aa-tp-buttons">
                            <button class="aa-tp-btn aa-tp-yes">Yes, please!</button>
                            <button class="aa-tp-btn aa-tp-no">No, let's go!</button>
                            <button class="aa-tp-btn aa-tp-never">No, and don't remind me</button>
                        </div>
                    `;
                    document.body.appendChild(el);
                    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('aa-tp-on')));

                    el.querySelector('.aa-tp-yes').addEventListener('click', () => {
                        el.classList.remove('aa-tp-on');
                        setTimeout(() => { el.remove(); resolve(true); }, 300);
                    });
                    el.querySelector('.aa-tp-no').addEventListener('click', () => {
                        el.classList.remove('aa-tp-on');
                        setTimeout(() => { el.remove(); resolve(false); }, 300);
                    });
                    el.querySelector('.aa-tp-never').addEventListener('click', () => {
                        try { disableTutorialPrompt(); } catch {}
                        el.classList.remove('aa-tp-on');
                        setTimeout(() => { el.remove(); resolve(false); }, 300);
                    });
                });
            }

            function showTutorialModal() {
                return new Promise(resolve => {
                    const modal = document.createElement('div');
                    modal.id = 'aa-tutorial-modal';
                    modal.innerHTML = `
                        <div class="aa-tm-inner">
                            <div class="aa-tm-header">
                                <div class="aa-tm-title">Argument Armament</div>
                            </div>
                            <img class="aa-tm-img" src="${extensionFolderPath}/assets/images/minigames/aa-tutorial.png" alt=""/>
                            <div class="aa-tm-body">
                                <strong>Argument Armament</strong> is a minigame where you are tasked with combating your opponent's <strong>Statements</strong>. <strong>Statements</strong> will fill the 3×3 grid at random, and zoom closer to the camera, making the grid cell glow red gradually. After a small amount of time glowing red, you will take damage to your <strong>Health</strong>. Running out of <strong>Health</strong>, visible in the bottom-right. Run out of health and it's game over! To combat a <strong>Statement</strong>, simply click the grid cell you wish to <strong>Shoot</strong>, or use the Arrow Keys and the Space bar to <strong>Shoot</strong>. <strong>Shooting</strong> consumes 1 <strong>Ammo</strong>; you can reload <strong>Ammo</strong> by pressing the R key, or clicking the <strong>Ammo</strong> icon, or by running out of <strong>Ammo</strong>. Shooting a <strong>White Statement</strong> prevents you from taking damage. Shooting a <strong>Yellow Statement</strong> prevents you from taking damage and deals damage to your opponent. Shooting a <strong>Blue Statement</strong> will deal damage to your opponent and turn the <strong>Blue Statement</strong> into a <strong>Yellow Statement</strong>. Shooting a <strong>Pink Statement</strong> will deal damage to yourself, so watch out! But don't worry! Letting a <strong>Pink Statement</strong> turn red won't deal damage to you! After enough damage is dealt, your opponent — and their <strong>Statements</strong> — will speed up. Damage your opponent enough and you'll enter the <strong>Final Question</strong>! During the <strong>Final Question</strong>, you'll need to make a <strong>Final Answer</strong> that answers the opponent's <strong>Final Question</strong> by using the Arrow Keys; there are four options, so think quickly and with confidence! Getting the <strong>Final Answer</strong> wrong or running out of time will give the opponent some <strong>Health</strong> back, and deal some damage to you, so try not to mess up! It's all or nothing now..!
                            </div>
                            <div class="aa-tm-footer">
                                <button class="aa-tm-close">OK, let's go!</button>
                            </div>
                        </div>
                    `;
                    document.body.appendChild(modal);
                    requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add('aa-tm-on')));

                    modal.querySelector('.aa-tm-close').addEventListener('click', () => {
                        modal.classList.remove('aa-tm-on');
                        setTimeout(() => { modal.remove(); resolve(); }, 280);
                    });
                });
            }

            // ── Begin Phase 1 — chain BGM off intro WAV for autoplay ──
            function beginGame() {
                playPhaseMusic(1);
                startSpawnLoop();
                scheduleSpriteMoveStep();
                startGlobalTimer();
            }

            (async () => {
                const wantsTutorial = await showTutorialPrompt();
                if (wantsTutorial) await showTutorialModal();
                tutorialActive = false;
                const introAudio = new Audio(`${extensionFolderPath}/assets/sfx/minigames/minigame-start.wav`);
                introAudio.addEventListener('ended', beginGame, { once: true });
                introAudio.addEventListener('error', beginGame, { once: true });
                introAudio.play().catch(() => beginGame());
            })();
        });
    }

    return { run };
}
