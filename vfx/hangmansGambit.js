const HG_ID    = "dangan-hg-overlay";
const HG_STYLE = "dangan-hg-style";

const BUBBLE_R = 32; // radius px
const BUBBLE_D = BUBBLE_R * 2;

const BUBBLE_COLORS = ["#22c45e","#e03232","#2288ff","#e07a00","#bb30d9","#00b8c4"];

function getBubbleColor(letter) {
    return BUBBLE_COLORS[(letter.toUpperCase().charCodeAt(0) - 65 + 26) % BUBBLE_COLORS.length];
}

function darkenColor(hex, factor = 0.28) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    const dr = Math.round(r * factor).toString(16).padStart(2,'0');
    const dg = Math.round(g * factor).toString(16).padStart(2,'0');
    const db = Math.round(b * factor).toString(16).padStart(2,'0');
    return `#${dr}${dg}${db}`;
}

function sphereGradient(color) {
    return `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.48) 0%, ${color} 45%, ${darkenColor(color)} 100%)`;
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function rand(min, max) { return min + Math.random() * (max - min); }

function getDifficultyPreset(d) {
    const presets = [
        null,
        { bubbles: 4,  speed: 80,  fillers: 3,  directions: 1 }, // 1 easy
        { bubbles: 6,  speed: 115, fillers: 5,  directions: 2 }, // 2
        { bubbles: 8,  speed: 155, fillers: 7,  directions: 4 }, // 3
        { bubbles: 10, speed: 195, fillers: 9,  directions: 4 }, // 4
        { bubbles: 13, speed: 250, fillers: 10, directions: 4 }, // 5 hard
    ];
    return presets[Math.min(5, Math.max(1, (d | 0) || 2))];
}

function buildLetterPool(answer, fillerCount) {
    const upper  = answer.toUpperCase().replace(/\s/g, '');
    const needed = [...new Set(upper.split(''))];
    const others = shuffle('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(l => !needed.includes(l)));
    return needed.concat(others.slice(0, fillerCount));
}

function buildStyles() {
    return `
#${HG_ID} {
    position: fixed; inset: 0;
    z-index: 2147483645;
    background-color: rgba(0, 8, 35, 0.97);
    background-image:
        linear-gradient(rgba(0,70,200,0.10) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,70,200,0.10) 1px, transparent 1px);
    background-size: 48px 48px;
    overflow: hidden;
    opacity: 0; transition: opacity 280ms ease;
    font-family: "Orbitron", "Impact", monospace;
    pointer-events: none;
}
#${HG_ID}.hg-on { opacity: 1; pointer-events: auto; }

/* CRT scanlines */
#${HG_ID}::before {
    content: ""; position: absolute; inset: 0;
    background: repeating-linear-gradient(
        0deg, transparent 0px, transparent 3px,
        rgba(0,60,200,0.04) 3px, rgba(0,60,200,0.04) 4px
    );
    pointer-events: none; z-index: 0;
}
/* Right panel subtle tint */
#${HG_ID}::after {
    content: ""; position: absolute;
    right: 0; top: 0; bottom: 0; width: 44%;
    background: rgba(0, 50, 140, 0.07);
    border-left: 1px solid rgba(0, 90, 220, 0.18);
    pointer-events: none; z-index: 0;
}

/* ─── Anagram ───────────────────────── */
#hg-anagram-area {
    position: absolute; top: 18px; left: 18px; z-index: 18;
}
#hg-anagram-chars {
    display: flex; gap: 5px; align-items: center;
    flex-wrap: wrap; max-width: 52vw;
}
.hg-anagram-char {
    display: inline-flex; align-items: center; justify-content: center;
    width: 42px; height: 50px;
    border: 3px solid rgba(255, 200, 0, 0.85);
    background: rgba(20, 10, 0, 0.85);
    color: #ffcc00;
    font-size: 20px; font-weight: 900;
    text-shadow: 0 0 10px rgba(255, 200, 0, 0.7);
    box-shadow: 0 0 7px rgba(255, 180, 0, 0.25), inset 0 0 4px rgba(255, 180, 0, 0.1);
    transition: color 200ms, background 200ms, border-color 200ms, text-shadow 200ms, box-shadow 200ms;
    user-select: none;
}
.hg-anagram-char.hg-revealed {
    border-color: rgba(80, 255, 150, 0.85);
    color: #44ff88;
    text-shadow: 0 0 12px rgba(80, 255, 150, 0.9);
    box-shadow: 0 0 10px rgba(80, 255, 150, 0.4);
    background: rgba(0, 25, 10, 0.9);
}
.hg-anagram-char.hg-target {
    border-color: rgba(0, 210, 255, 0.9);
    color: rgba(0, 210, 255, 0.9);
    text-shadow: 0 0 10px rgba(0, 210, 255, 0.7);
    box-shadow: 0 0 14px rgba(0, 210, 255, 0.6), inset 0 0 5px rgba(0, 180, 255, 0.2);
    animation: hgTargetPulse 1s ease-in-out infinite;
}
@keyframes hgTargetPulse {
    0%,100% { box-shadow: 0 0 8px rgba(0,200,255,0.4); }
    50%      { box-shadow: 0 0 20px rgba(0,200,255,0.9), 0 0 34px rgba(0,100,200,0.5); }
}
.hg-anagram-space {
    display: inline-flex; align-items: center; justify-content: center;
    width: 20px; height: 50px;
    color: rgba(80, 130, 255, 0.4);
    font-size: 12px; user-select: none;
}
#hg-anagram-label {
    color: #00ddff; font-size: 10px; letter-spacing: 3px; margin-top: 5px;
    text-shadow: 0 0 8px rgba(0, 200, 255, 0.6);
}

/* ─── Health & bullet bar ────────────── */
#hg-status-area {
    position: absolute; top: 18px; right: 18px; z-index: 18;
    display: flex; flex-direction: column; align-items: flex-end; gap: 4px;
}
#hg-bullet-bar {
    width: 100%; height: 12px;
    background: rgba(20, 60, 20, 0.3);
    border: 1px solid rgba(80, 180, 80, 0.35);
    border-radius: 3px;
    overflow: hidden;
}
#hg-bt-bar-fill {
    height: 100%; width: 100%;
    background: #44ee44;
    box-shadow: 0 0 8px rgba(80, 255, 80, 0.7);
    border-radius: 3px;
    transition: width 80ms linear;
}
#hg-bt-bar-fill.hg-active {
    animation: hgBulletBarPulse 0.38s ease-in-out infinite;
}
@keyframes hgBulletBarPulse {
    0%,100% { background: #44ee44; box-shadow: 0 0 6px rgba(80,255,80,0.7); }
    50%      { background: #ccffcc; box-shadow: 0 0 18px rgba(160,255,160,1), 0 0 30px rgba(80,220,80,0.6); }
}
#hg-bullet-hint {
    font-size: 8px; letter-spacing: 2px;
    color: rgba(80, 180, 80, 0.55);
}

/* ─── Bullet-time screen vfx ─────────── */
#hg-bt-vfx {
    position: absolute; inset: 0;
    background: radial-gradient(ellipse at center, rgba(0,160,30,0.12) 0%, rgba(0,90,15,0.28) 100%);
    mix-blend-mode: screen;
    pointer-events: none; z-index: 19;
    opacity: 0; transition: opacity 180ms ease;
}
#hg-bt-vfx.hg-active { opacity: 1; }

/* ─── Bullet-time ALERT rows ─────────── */
#hg-bt-alert-overlay {
    position: absolute;
    left: 0; right: 0;
    top: 96px; bottom: 100px;
    z-index: 12;
    overflow: hidden;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    justify-content: space-evenly;
    opacity: 0;
    transition: opacity 80ms ease;
}
#hg-bt-alert-overlay.hg-active { opacity: 0.2; }
.hg-alert-row {
    display: flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
    flex-shrink: 0;
}
.hg-alert-row-l { animation: hgAlertL 5s linear infinite; }
.hg-alert-row-r { animation: hgAlertR 5s linear infinite; }
@keyframes hgAlertL {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
}
@keyframes hgAlertR {
    from { transform: translateX(-50%); }
    to   { transform: translateX(0); }
}
.hg-alert-box {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-width: 148px;
    height: 56px;
    padding: 0 10px;
    background: #000;
    border: 2.5px solid #78ff44;
    border-radius: 8px;
    flex-shrink: 0;
    gap: 2px;
    box-shadow: 0 0 10px rgba(120,255,68,0.28), inset 0 0 8px rgba(120,255,68,0.06);
}
.hg-alert-word {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 22px; font-weight: 900;
    color: #78ff44;
    letter-spacing: 8px; text-indent: 8px;
    text-shadow: 0 0 12px rgba(120,255,68,0.9);
    line-height: 1;
}
.hg-alert-concentrating {
    font-family: "Orbitron", monospace;
    font-size: 6px; font-weight: 700;
    color: #78ff44;
    letter-spacing: 2.5px;
    opacity: 0.6; line-height: 1;
}
#hg-health { display: flex; gap: 3px; align-items: center; flex-wrap: wrap; justify-content: flex-end; max-width: 300px; }
.hg-heart {
    font-size: 38px; color: #ff3399;
    text-shadow: 0 0 10px rgba(255, 50, 150, 0.9), 0 0 22px rgba(255, 0, 100, 0.5);
    transition: color 300ms, text-shadow 300ms;
    display: inline-block;
}
.hg-heart.hg-lost {
    color: rgba(80, 20, 50, 0.35);
    text-shadow: none;
}

/* ─── Crosshair ─────────────────────── */
#hg-crosshair {
    position: absolute; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    font-size: 30px;
    color: rgba(0, 200, 255, 0.35);
    text-shadow: 0 0 14px rgba(0, 180, 255, 0.4);
    pointer-events: none; z-index: 5; user-select: none;
}

/* ─── Stock ──────────────────────────── */
#hg-stock-area {
    position: absolute; bottom: 18px; left: 50%;
    transform: translateX(-50%);
    z-index: 18;
    display: flex; flex-direction: column; align-items: center; gap: 3px;
}
#hg-stock-label {
    font-size: 9px; letter-spacing: 2px; color: rgba(140, 170, 255, 0.55);
}
#hg-stock-bubble {
    width: 52px; height: 52px; border-radius: 50%;
    border: 2px solid rgba(0, 180, 255, 0.3);
    background: rgba(0, 15, 45, 0.7);
    display: flex; align-items: center; justify-content: center;
    font-size: 22px; font-weight: 900;
    color: rgba(80, 120, 220, 0.25);
    font-family: "Orbitron", monospace;
    transition: all 200ms ease;
}
#hg-stock-bubble.hg-stocked {
    border-color: rgba(0, 220, 255, 0.9);
    background: rgba(0, 40, 90, 0.95);
    color: #fff;
    text-shadow: 0 0 10px rgba(255,255,255,0.5);
    box-shadow: 0 0 18px rgba(0, 200, 255, 0.7), 0 0 36px rgba(0, 100, 200, 0.3);
    animation: hgStockPulse 0.85s ease-in-out infinite;
}
@keyframes hgStockPulse {
    0%,100% { box-shadow: 0 0 12px rgba(0,200,255,0.5); }
    50%      { box-shadow: 0 0 28px rgba(0,220,255,1), 0 0 46px rgba(0,120,220,0.6); }
}

/* ─── Timer ──────────────────────────── */
#hg-timer-area {
    position: absolute; bottom: 18px; left: 18px; z-index: 18;
}
#hg-timer-label {
    font-size: 11px; letter-spacing: 3px; color: #00ddff;
    text-shadow: 0 0 8px rgba(0, 200, 255, 0.6); margin-bottom: 2px;
}
#hg-timer {
    font-size: 32px; font-weight: 700; letter-spacing: 3px;
    color: #ffaa00;
    text-shadow: 0 0 10px #ff8800, 0 0 3px #ffcc00;
}
#hg-timer.hg-urgent {
    color: #ff1111;
    text-shadow: 0 0 14px rgba(255, 0, 0, 1);
    animation: hgBlink 0.45s ease-in-out infinite;
}
@keyframes hgBlink { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }

/* ─── Barrier bands ──────────────────── */
.hg-barrier {
    position: absolute; left: 0; right: 0;
    z-index: 16;
    pointer-events: all;
    background: rgba(0, 10, 42, 0.97);
}
#hg-barrier-top {
    top: 0; height: 96px;
    border-bottom: 2px solid rgba(0, 160, 255, 0.75);
    box-shadow: 0 2px 0 rgba(0, 160, 255, 0.2), 0 6px 18px rgba(0, 100, 220, 0.25);
    animation: hgBarrierPulse 1.8s ease-in-out infinite;
}
#hg-barrier-bottom {
    bottom: 0; height: 100px;
    border-top: 2px solid rgba(0, 160, 255, 0.75);
    box-shadow: 0 -2px 0 rgba(0, 160, 255, 0.2), 0 -6px 18px rgba(0, 100, 220, 0.25);
    animation: hgBarrierPulse 1.8s ease-in-out infinite;
    animation-delay: 0.9s;
}
@keyframes hgBarrierPulse {
    0%,100% {
        border-color: rgba(0, 150, 255, 0.65);
        box-shadow: 0 0 0 rgba(0,150,255,0.15), 0 0 14px rgba(0,100,220,0.2);
    }
    50% {
        border-color: rgba(60, 210, 255, 1);
        box-shadow: 0 0 8px rgba(60,210,255,0.55), 0 0 28px rgba(0,140,255,0.35);
    }
}

/* ─── Question display ───────────────── */
#hg-question-area {
    position: absolute; bottom: 18px; right: 18px; z-index: 18;
    max-width: 55vw;
    text-align: right;
}
#hg-question-label {
    font-size: 11px; letter-spacing: 3px; color: #00ddff;
    text-shadow: 0 0 8px rgba(0, 200, 255, 0.6); margin-bottom: 2px;
}
#hg-question-popup {
    font-size: 26px; font-weight: 400; letter-spacing: 1px;
    color: rgba(180, 210, 255, 0.85);
    text-shadow: 0 0 10px rgba(80, 140, 255, 0.5);
    line-height: 1.3;
}

/* ─── Bubbles ────────────────────────── */
.hg-bubble {
    position: absolute;
    width: ${BUBBLE_D}px; height: ${BUBBLE_D}px;
    border-radius: 50%;
    cursor: pointer; user-select: none;
    display: flex; align-items: center; justify-content: center;
    z-index: 15;
    transition: filter 120ms ease;
}
.hg-bubble-letter {
    font-family: "Orbitron", monospace;
    font-size: 20px; font-weight: 900;
    color: #fff;
    text-shadow: 0 1px 4px rgba(0,0,0,0.9), 0 0 8px rgba(255,255,255,0.3);
    pointer-events: none; user-select: none;
}
.hg-bubble:hover {
    filter: brightness(1.3) drop-shadow(0 0 6px rgba(255,255,255,0.5));
}
.hg-bubble.hg-stocked-bubble {
    filter: brightness(1.65) drop-shadow(0 0 12px cyan) drop-shadow(0 0 6px rgba(0,200,255,0.9));
}

/* ─── Damage flash ───────────────────── */
#hg-damage-flash {
    position: fixed; inset: 0; z-index: 2147483646;
    pointer-events: none;
    background: rgba(220, 0, 0, 0.55);
    animation: hgDamageFlash 0.2s ease-out forwards;
}
@keyframes hgDamageFlash {
    0%  { opacity: 0; }
    20% { opacity: 1; }
    100% { opacity: 0; }
}
body.hg-shaking { animation: hgScreenShake 80ms steps(2,end) infinite; }
@keyframes hgScreenShake {
    0%   { translate: 0px 0px; }
    14%  { translate: -5px  3px; }
    28%  { translate:  4px -3px; }
    42%  { translate: -3px  2px; }
    57%  { translate:  5px -2px; }
    71%  { translate: -4px  3px; }
    85%  { translate:  3px -2px; }
    100% { translate:  0px  0px; }
}

/* ─── GOT IT banner ──────────────────── */
#dangan-hg-prefill {
    position: fixed;
    top: 33.33%; left: 0; right: 0; height: 33.34%;
    z-index: 2147483646; background: #000;
    pointer-events: none;
    transform: scaleX(0); transform-origin: center;
    transition: transform 0.045s ease-out;
}
#dangan-hg-banner {
    position: fixed;
    top: 33.33%; left: 0; right: 0; height: 33.34%;
    z-index: 2147483647;
    pointer-events: none; overflow: visible;
    opacity: 1; transition: opacity 0.5s ease;
    border-top: 6px solid #000;
    border-bottom: 6px solid #000;
    animation: hgBannerShadowPulse 1.2s ease-in-out infinite;
}
@keyframes hgBannerShadowPulse {
    0%, 100% {
        box-shadow:
            0 -12px 32px rgba(0,0,0,0.95), 0 -4px 10px rgba(0,0,0,1),
            0  12px 32px rgba(0,0,0,0.95), 0  4px 10px rgba(0,0,0,1);
    }
    50% {
        box-shadow:
            0 -24px 60px rgba(0,0,0,1), 0 -8px 20px rgba(0,0,0,1),
            0  24px 60px rgba(0,0,0,1), 0  8px 20px rgba(0,0,0,1);
    }
}
#dangan-hg-banner-inner {
    position: absolute;
    top: 0; bottom: 0; left: 100%; width: 100%;
    display: flex; align-items: center; justify-content: center;
    overflow: hidden;
    transition: left 0.325s cubic-bezier(0.22,0.61,0.36,1);
}
.hg-banner-img {
    width: 100%; height: 100%;
    object-fit: cover; object-position: center; display: block;
}

/* ─── Tutorial prompt bar ────────────────── */
#hg-tutorial-prompt {
    position: fixed; bottom: 0; left: 0; right: 0;
    z-index: 2147483646;
    background: rgba(0, 6, 24, 0.97);
    border-top: 2px solid rgba(0, 220, 100, 0.5);
    box-shadow: 0 -12px 40px rgba(0, 220, 100, 0.25), 0 -4px 14px rgba(0, 220, 100, 0.15);
    padding: 22px 32px 28px;
    font-family: "Noto Sans JP", "Noto Sans", sans-serif;
    text-align: center;
    opacity: 0; transform: translateY(12px);
    transition: opacity 280ms ease, transform 280ms ease;
}
#hg-tutorial-prompt.hg-tp-on { opacity: 1; transform: translateY(0); }
.hg-tp-text {
    color: rgba(210, 235, 210, 0.92);
    font-size: clamp(13px, 2vw, 17px);
    line-height: 1.6;
    margin-bottom: 18px;
}
.hg-tp-text strong { color: #44ff88; }
.hg-tp-buttons {
    display: flex; gap: 18px; justify-content: center;
}
.hg-tp-btn {
    font-family: "Noto Sans JP", "Noto Sans", sans-serif;
    font-size: clamp(12px, 1.8vw, 15px);
    font-weight: 700;
    padding: 10px 28px;
    border-radius: 4px;
    border: 2px solid rgba(0, 200, 80, 0.6);
    background: rgba(0, 30, 12, 0.85);
    color: #44ff88;
    cursor: pointer;
    letter-spacing: 0.04em;
    transition: background 150ms, box-shadow 150ms, border-color 150ms;
}
.hg-tp-btn:hover {
    background: rgba(0, 60, 24, 0.95);
    border-color: rgba(0, 255, 100, 0.9);
    box-shadow: 0 0 12px rgba(0, 255, 100, 0.4);
}
.hg-tp-btn.hg-tp-no {
    border-color: rgba(120, 140, 120, 0.35);
    color: rgba(160, 200, 160, 0.7);
    background: rgba(10, 14, 10, 0.7);
}
.hg-tp-btn.hg-tp-no:hover {
    border-color: rgba(160, 200, 160, 0.6);
    color: rgba(200, 230, 200, 0.9);
    box-shadow: none;
}

/* ─── Tutorial modal ─────────────────────── */
#hg-tutorial-modal {
    position: fixed; inset: 0;
    z-index: 2147483647;
    background: rgba(0, 4, 18, 0.88);
    display: flex; align-items: center; justify-content: center;
    opacity: 0; transition: opacity 260ms ease;
    font-family: "Noto Sans JP", "Noto Sans", sans-serif;
    padding: 20px;
    box-sizing: border-box;
}
#hg-tutorial-modal.hg-tm-on { opacity: 1; }
.hg-tm-inner {
    background: rgba(4, 12, 32, 0.98);
    border: 2px solid rgba(0, 200, 80, 0.45);
    box-shadow: 0 0 40px rgba(0, 180, 70, 0.2), 0 0 80px rgba(0, 60, 200, 0.12);
    border-radius: 6px;
    max-width: 680px; width: 100%;
    max-height: 88vh;
    display: flex; flex-direction: column;
    overflow: hidden;
}
.hg-tm-header {
    padding: 16px 22px 12px;
    border-bottom: 1px solid rgba(0, 180, 70, 0.25);
    flex-shrink: 0;
}
.hg-tm-title {
    font-family: "Orbitron", "Impact", monospace;
    font-size: clamp(16px, 3vw, 22px);
    font-weight: 900;
    color: #44ff88;
    text-shadow: 0 0 14px rgba(0, 255, 100, 0.6);
    letter-spacing: 0.06em;
}
.hg-tm-img {
    width: 100%; display: block;
    flex-shrink: 0;
    height: auto;
    border-radius: 0;
}
.hg-tm-body {
    padding: 20px 24px;
    color: rgba(200, 220, 205, 0.88);
    font-size: clamp(12px, 1.8vw, 14px);
    line-height: 1.75;
    overflow-y: auto;
    flex: 1;
}
.hg-tm-body strong { color: #66ffaa; }
.hg-tm-footer {
    padding: 14px 24px 18px;
    border-top: 1px solid rgba(0, 180, 70, 0.2);
    display: flex; justify-content: flex-end;
    flex-shrink: 0;
}
.hg-tm-close {
    font-family: "Noto Sans JP", "Noto Sans", sans-serif;
    font-size: 14px; font-weight: 700;
    padding: 9px 30px;
    border: 2px solid rgba(0, 200, 80, 0.6);
    border-radius: 4px;
    background: rgba(0, 30, 12, 0.85);
    color: #44ff88;
    cursor: pointer;
    letter-spacing: 0.05em;
    transition: background 140ms, box-shadow 140ms;
}
.hg-tm-close:hover {
    background: rgba(0, 60, 24, 0.95);
    box-shadow: 0 0 12px rgba(0, 255, 100, 0.4);
}
    `;
}

export function createHangmansGambitController({
    extensionFolderPath  = '',
    awardMonocoins       = null,
    deductMonocoins      = null,
    restoreTheme         = null,
    pauseDynamicAudio    = null,
    resumeDynamicAudio   = null,
    playBgm              = null,
    getPlayerSpriteUrl   = null,
} = {}) {

    let _bgmAudio = null;
    let _bgmIsDA  = false;

    function stopBgm() {
        if (_bgmAudio) {
            _bgmAudio.pause();
            if (!_bgmIsDA) _bgmAudio.src = '';
            _bgmAudio = null;
            _bgmIsDA  = false;
        }
    }

    function fadeBgmOut(duration = 500) {
        if (!_bgmAudio) return;
        const bgm = _bgmAudio;
        const startVol = bgm.volume;
        const startTime = performance.now();
        (function tick(now) {
            if (bgm !== _bgmAudio) return;
            const t = Math.min((now - startTime) / duration, 1);
            bgm.volume = startVol * (1 - t);
            if (t < 1) requestAnimationFrame(tick);
            else stopBgm();
        })(startTime);
    }

    function destroy() {
        stopBgm();
        document.getElementById(HG_ID)?.remove();
        document.getElementById(HG_STYLE)?.remove();
        document.getElementById("dangan-hg-banner")?.remove();
        document.getElementById("dangan-hg-prefill")?.remove();
        document.getElementById("hg-damage-flash")?.remove();
        document.getElementById("hg-tutorial-prompt")?.remove();
        document.getElementById("hg-tutorial-modal")?.remove();
        document.body.classList.remove("hg-shaking");
    }

    async function showGotItBanner() {
        const audio = new Audio(`${extensionFolderPath}/assets/monokuma/question-answered-correctly.wav`);
        audio.addEventListener('ended', () => fadeBgmOut(600), { once: true });
        audio.addEventListener('error',  () => fadeBgmOut(600), { once: true });
        audio.play().catch(() => fadeBgmOut(600));

        document.getElementById("dangan-hg-prefill")?.remove();
        const prefill = document.createElement("div");
        prefill.id = "dangan-hg-prefill";
        document.body.appendChild(prefill);
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        prefill.style.transform = "scaleX(1)";
        await new Promise(r => setTimeout(r, 55));

        document.getElementById("dangan-hg-banner")?.remove();
        document.body.insertAdjacentHTML("beforeend", `
            <div id="dangan-hg-banner">
                <div id="dangan-hg-banner-inner">
                    <img class="hg-banner-img" src="${extensionFolderPath}/assets/images/minigames/got-it-banner.png" alt="Got It"/>
                </div>
            </div>
        `);
        const banner = document.getElementById("dangan-hg-banner");
        const inner  = document.getElementById("dangan-hg-banner-inner");

        // Player approval sprite overlay
        if (typeof getPlayerSpriteUrl === 'function') {
            const spriteUrl = await getPlayerSpriteUrl('approval');
            if (spriteUrl) {
                const spriteEl = document.createElement('img');
                spriteEl.src = spriteUrl;
                spriteEl.alt = '';
                spriteEl.style.cssText = 'position:absolute;bottom:-1520px;left:70%;transform:translateX(-50%);height:650%;width:auto;object-fit:contain;object-position:center bottom;pointer-events:none;filter:drop-shadow(rgb(255,255,255) 0px 0px 50px);';
                inner.appendChild(spriteEl);
            }
        }

        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        inner.style.transition = "left 0.325s cubic-bezier(0.22,0.61,0.36,1)";
        inner.style.left = "0%";
        await new Promise(r => setTimeout(r, 350));

        await new Promise(r => setTimeout(r, 3000));

        banner.style.opacity = "0";
        prefill.style.transition = "opacity 0.5s ease";
        prefill.style.opacity    = "0";
        await new Promise(r => setTimeout(r, 520));
        banner.remove();
        prefill.remove();
    }

    function showTutorialPrompt() {
        return new Promise(resolve => {
            const el = document.createElement('div');
            el.id = 'hg-tutorial-prompt';
            el.innerHTML = `
                <div class="hg-tp-text">
                    The minigame <strong>Hangman's Gambit</strong> is about to begin. Would you like to hear an explanation?
                </div>
                <div class="hg-tp-buttons">
                    <button class="hg-tp-btn hg-tp-yes">Let's hear it</button>
                    <button class="hg-tp-btn hg-tp-no">No, just start</button>
                </div>
            `;
            document.body.appendChild(el);
            requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('hg-tp-on')));

            function dismiss(answer) {
                el.style.transition = 'opacity 250ms ease, transform 250ms ease';
                el.style.opacity = '0';
                el.style.transform = 'translateY(8px)';
                setTimeout(() => el.remove(), 270);
                resolve(answer);
            }
            el.querySelector('.hg-tp-yes').addEventListener('click', () => dismiss(true));
            el.querySelector('.hg-tp-no').addEventListener('click', () => dismiss(false));
        });
    }

    function showTutorialModal() {
        return new Promise(resolve => {
            const modal = document.createElement('div');
            modal.id = 'hg-tutorial-modal';
            modal.innerHTML = `
                <div class="hg-tm-inner">
                    <div class="hg-tm-header">
                        <div class="hg-tm-title">Hangman's Gambit</div>
                    </div>
                    <img class="hg-tm-img" src="${extensionFolderPath}/assets/images/minigames/hangmans-gambit-tutorial.png" alt=""/>
                    <div class="hg-tm-body">
                        <p><strong>Hangman's Gambit</strong> is a minigame where you are tasked with answering a <strong>Question</strong>, visible in the bottom-right side of your screen. The answer to this question is in the form of an <strong>Anagram</strong>. During <strong>Hangman's Gambit</strong>, you will see colored spheres with letters printed on them. Clicking a sphere will load it into your <strong>Stock</strong>, at the bottom of your screen in the center. Matching two of the same letter will fire that combination into the <strong>Anagram</strong>. If the letter is correct, you'll expose a part of the Anagram! If it's wrong, however, you'll take damage to your <strong>Health</strong>. You can see your <strong>Health</strong> on the top-right, represented by hearts. Taking damage deducts <strong>Monocoins</strong>; run out of <strong>Health</strong> and it's game over! Underneath your Health you will see a green bar — by pressing either Shift key, you can activate <strong>Bullet Time</strong>, which will slow time by 50% for both the timer (Visible in the bottom left), and for the moving spheres. <strong>Bullet Time</strong> regenerates over time. Can you solve the Hangman's Gambit..?</p>
                    </div>
                    <div class="hg-tm-footer">
                        <button class="hg-tm-close">OK, let's go!</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add('hg-tm-on')));

            modal.querySelector('.hg-tm-close').addEventListener('click', () => {
                modal.style.opacity = '0';
                setTimeout(() => { modal.remove(); resolve(); }, 270);
            });
        });
    }

    async function run({ question, answer, time, health: maxHealth, difficulty }) {
        destroy();
        pauseDynamicAudio?.();

        const preset      = getDifficultyPreset(difficulty);
        const answerUpper = answer.toUpperCase();
        const letterPool  = buildLetterPool(answer, preset.fillers);
        const speed       = preset.speed;
        const safeHealth  = Math.max(1, (maxHealth | 0) || 3);
        const safeTime    = Math.max(5, Number(time) || 60);

        // Inject styles
        const styleEl = document.createElement("style");
        styleEl.id = HG_STYLE;
        styleEl.textContent = buildStyles();
        document.head.appendChild(styleEl);

        // Build anagram HTML
        const anagramHTML = answerUpper.split('').map((c, i) =>
            c === ' '
                ? `<span class="hg-anagram-space" data-idx="${i}">●</span>`
                : `<span class="hg-anagram-char" data-idx="${i}" data-letter="${c}">?</span>`
        ).join('');

        // Build hearts HTML
        const heartsHTML = Array.from({ length: safeHealth }, (_, i) =>
            `<span class="hg-heart" data-hi="${i}">❤</span>`
        ).join('');

        // Build ALERT overlay — 36 boxes per row (×2 for seamless -50% loop)
        const alertBox = `<div class="hg-alert-box"><div class="hg-alert-word">ALERT</div><div class="hg-alert-concentrating">CONCENTRATING</div></div>`;
        const alertRowContent = alertBox.repeat(36);
        const alertRowsHTML = Array.from({ length: 14 }, (_, i) =>
            `<div class="hg-alert-row hg-alert-row-${i % 2 === 0 ? 'l' : 'r'}">${alertRowContent}</div>`
        ).join('');

        const overlay = document.createElement("div");
        overlay.id = HG_ID;
        overlay.innerHTML = `
            <div id="hg-barrier-top"   class="hg-barrier"></div>
            <div id="hg-barrier-bottom" class="hg-barrier"></div>
            <div id="hg-anagram-area">
                <div id="hg-anagram-chars">${anagramHTML}</div>
                <div id="hg-anagram-label">ANAGRAM</div>
            </div>
            <div id="hg-status-area">
                <div id="hg-health">${heartsHTML}</div>
                <div id="hg-bullet-bar">
                    <div id="hg-bt-bar-fill"></div>
                </div>
            </div>
            <div id="hg-bt-vfx"></div>
            <div id="hg-bt-alert-overlay">${alertRowsHTML}</div>
            <div id="hg-crosshair">⊕</div>
            <div id="hg-stock-area">
                <div id="hg-stock-label">STOCK</div>
                <div id="hg-stock-bubble"></div>
            </div>
            <div id="hg-timer-area">
                <div id="hg-timer-label">TIME</div>
                <div id="hg-timer">${String(Math.floor(safeTime / 60)).padStart(2,'0')}:${String(Math.floor(safeTime % 60)).padStart(2,'0')}:000</div>
            </div>
            <div id="hg-question-area">
                <div id="hg-question-label">QUESTION</div>
                <div id="hg-question-popup">${question}</div>
            </div>
        `;
        document.body.appendChild(overlay);
        requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add("hg-on")));


        return new Promise(resolve => {
            const incorrectAudio = new Audio(`${extensionFolderPath}/assets/monokuma/incorrect-answer.wav`);
            incorrectAudio.load();

            let currentHealth  = safeHealth;
            let timeRemaining  = safeTime * 1000;
            let anagramTarget  = 0;
            let stockLetter    = null;
            let stockBubbleId  = null;
            let isResolved     = false;
            let tutorialActive = true;
            let rafId          = null;
            let lastTs         = null;
            let recoverTimer   = null;
            // Separate wall-clock tracker for the timer so it's fully independent
            // of RAF timestamp quirks. Uses performance.now() directly.
            let timerLastWall  = null;

            // ── Bullet-time state ─────────────────────────────────────
            const BT_DRAIN_RATE    = 1 / 3;   // full depletion in 3 s
            const BT_RECHARGE_RATE = 1 / 10;  // full recharge in 10 s
            let btCharge  = 1.0;              // 0–1
            let btActive  = false;
            let btAudio   = null;

            function updateBulletBar() {
                const fill = overlay.querySelector('#hg-bt-bar-fill');
                if (!fill) return;
                fill.style.width = `${btCharge * 100}%`;
                fill.classList.toggle('hg-active', btActive);
            }

            function setBulletTimeActive(on) {
                btActive = on;
                overlay.querySelector('#hg-bt-vfx')?.classList.toggle('hg-active', on);
                overlay.querySelector('#hg-bt-alert-overlay')?.classList.toggle('hg-active', on);
                if (on) {
                    if (!btAudio) {
                        btAudio = new Audio(`${extensionFolderPath}/assets/sfx/minigames/slowmo.wav`);
                        btAudio.loop = true;
                        btAudio.play().catch(() => {});
                    }
                } else {
                    if (btAudio) {
                        btAudio.pause();
                        btAudio.currentTime = 0;
                        btAudio = null;
                    }
                }
            }

            const keyAC = new AbortController();
            // capture: true so we fire before any SillyTavern element can stopPropagation
            window.addEventListener('keydown', e => {
                if (isResolved || tutorialActive) return;
                if ((e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight')
                    && !btActive && btCharge > 0.01) {
                    setBulletTimeActive(true);
                }
            }, { signal: keyAC.signal, capture: true });
            window.addEventListener('keyup', e => {
                if (e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
                    setBulletTimeActive(false);
                }
            }, { signal: keyAC.signal, capture: true });

            // Letter deck
            let letterDeck = [];
            function drawLetter() {
                if (!letterDeck.length) letterDeck = shuffle([...letterPool]);
                return letterDeck.pop();
            }

            // Guarantee current target letter at least once per cycle
            const cycleSize = Math.ceil(preset.bubbles / 2);
            let pairsThisCycle      = 0;
            let targetSeenThisCycle = false;

            function currentTargetLetter() {
                const c = answerUpper[anagramTarget];
                return (c && c !== ' ') ? c : null;
            }

            function resetSpawnCycle() {
                pairsThisCycle      = 0;
                targetSeenThisCycle = false;
            }

            function pickPairLetter() {
                const target = currentTargetLetter();
                // Force the target on the last pair of a cycle if not yet seen
                if (target && !targetSeenThisCycle && pairsThisCycle >= cycleSize - 1) {
                    targetSeenThisCycle = true;
                    pairsThisCycle = 0;
                    return target;
                }
                pairsThisCycle++;
                if (pairsThisCycle >= cycleSize) resetSpawnCycle();
                const letter = drawLetter();
                if (letter === target) targetSeenThisCycle = true;
                return letter;
            }

            // Active bubbles: id → { x, y, vx, vy, letter, el }
            let nextId = 0;
            const activeBubbles = new Map();

            // Skip leading spaces in target
            while (anagramTarget < answerUpper.length && answerUpper[anagramTarget] === ' ') anagramTarget++;
            highlightTarget();

            // ── Display helpers ──────────────────────────────────────
            function highlightTarget() {
                overlay.querySelectorAll('.hg-anagram-char').forEach(el => el.classList.remove('hg-target'));
                if (anagramTarget < answerUpper.length) {
                    overlay.querySelector(`.hg-anagram-char[data-idx="${anagramTarget}"]`)?.classList.add('hg-target');
                }
            }

            function updateTimerDisplay(ms) {
                const el = document.getElementById('hg-timer');
                if (!el) return;
                const mins   = Math.floor(ms / 60000);
                const secs   = Math.floor((ms % 60000) / 1000);
                const millis = Math.floor(ms % 1000);
                el.textContent =
                    String(mins).padStart(2,'0') + ':' +
                    String(secs).padStart(2,'0') + ':' +
                    String(millis).padStart(3,'0');
                el.classList.toggle('hg-urgent', ms < 10000);
            }

            function updateHealthDisplay() {
                overlay.querySelectorAll('.hg-heart').forEach((el, i) => {
                    el.classList.toggle('hg-lost', i >= currentHealth);
                });
            }

            function updateStockDisplay() {
                const el = overlay.querySelector('#hg-stock-bubble');
                if (!el) return;
                if (stockLetter) {
                    el.textContent = stockLetter;
                    el.classList.add('hg-stocked');
                    el.style.background = sphereGradient(getBubbleColor(stockLetter));
                } else {
                    el.textContent = '';
                    el.classList.remove('hg-stocked');
                    el.style.background = '';
                }
            }

            // ── Bubble management ────────────────────────────────────
            const ALL_DIRS = ['left', 'up', 'right', 'down'];

            function getDir() {
                const pool = ALL_DIRS.slice(0, preset.directions);
                return pool[(Math.random() * pool.length) | 0];
            }

            function spawnBubble(letter = drawLetter()) {
                const color  = getBubbleColor(letter);
                const dir    = getDir();
                const W = overlay.clientWidth  || window.innerWidth;
                const H = overlay.clientHeight || window.innerHeight;
                const margin  = BUBBLE_R + 8;
                const minGap  = BUBBLE_D + 12; // minimum centre-to-centre clearance
                // Play-area y bounds for horizontal movers — keep them out of both barrier zones
                const horzYMin = 96  + BUBBLE_R;
                const horzYMax = H - 100 - BUBBLE_R;

                let x, y, vx, vy;
                // Try up to 12 positions to avoid spawn-point and lane overlap
                for (let attempt = 0; attempt < 12; attempt++) {
                    const bSpeed  = speed * rand(0.82, 1.22);           // ±20% speed variance per bubble
                    const stagger = rand(0, W * 0.55);                  // random entry delay via off-screen offset
                    switch (dir) {
                        case 'left':  x = W + BUBBLE_R + stagger; y = rand(horzYMin, horzYMax); vx = -bSpeed; vy = 0;  break;
                        case 'right': x = -(BUBBLE_R + stagger);  y = rand(horzYMin, horzYMax); vx =  bSpeed; vy = 0;  break;
                        case 'up':    x = rand(margin, W - margin); y = H + BUBBLE_R + stagger; vx = 0; vy = -bSpeed; break;
                        case 'down':  x = rand(margin, W - margin); y = -(BUBBLE_R + stagger);  vx = 0; vy =  bSpeed;  break;
                        default:      x = W + BUBBLE_R + stagger; y = rand(margin, H - margin); vx = -bSpeed; vy = 0;
                    }

                    let ok = true;
                    for (const [, b] of activeBubbles) {
                        // Spawn-point overlap: too close to an existing bubble right now
                        const dx = b.x - x, dy = b.y - y;
                        if (Math.sqrt(dx * dx + dy * dy) < minGap) { ok = false; break; }

                        // Lane overlap: same direction → perpendicular coordinate must differ enough
                        if (b.vx === vx && b.vy === vy) {
                            const perp = vy === 0 ? Math.abs(b.y - y) : Math.abs(b.x - x);
                            if (perp < minGap) { ok = false; break; }
                        }
                    }
                    if (ok) break; // found a valid slot
                }

                const id = nextId++;
                const el = document.createElement('div');
                el.className = 'hg-bubble';
                el.style.cssText = `
                    left: ${x - BUBBLE_R}px;
                    top:  ${y - BUBBLE_R}px;
                    background: ${sphereGradient(color)};
                    box-shadow: 0 0 12px ${color}99, 0 4px 10px rgba(0,0,0,0.65);
                `;
                el.innerHTML = `<span class="hg-bubble-letter">${letter}</span>`;
                el.addEventListener('click', () => onBubbleClick(id));
                overlay.appendChild(el);
                activeBubbles.set(id, { x, y, vx, vy, letter, el });
            }

            function removeBubble(id) {
                const b = activeBubbles.get(id);
                if (!b) return;
                b.el.remove();
                activeBubbles.delete(id);
                // If this was the stocked bubble, drop the reference but keep the letter in stock
                if (id === stockBubbleId) stockBubbleId = null;
            }

            // Spawn a ghost bubble that flies to the stock slot and fades out,
            // then fires onComplete when the animation finishes.
            function floatToStock(fromRect, bg, boxShadow, innerHtml, onComplete) {
                const stockEl = overlay.querySelector('#hg-stock-bubble');
                if (!stockEl) { onComplete?.(); return; }

                const toRect = stockEl.getBoundingClientRect();
                const x0 = fromRect.left;
                const y0 = fromRect.top;
                const x1 = toRect.left + (toRect.width  - fromRect.width)  / 2;
                const y1 = toRect.top  + (toRect.height - fromRect.height) / 2;

                const ghost = document.createElement('div');
                ghost.style.cssText = `
                    position: fixed;
                    left: ${x0}px; top: ${y0}px;
                    width: ${fromRect.width}px; height: ${fromRect.height}px;
                    background: ${bg}; box-shadow: ${boxShadow};
                    border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                    z-index: 2147483646; pointer-events: none; margin: 0;
                    transform-origin: center;
                `;
                ghost.innerHTML = innerHtml;
                document.body.appendChild(ghost);

                const DURATION = 260;
                const startTime = performance.now();

                (function tick(now) {
                    const t = Math.min((now - startTime) / DURATION, 1);
                    const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
                    ghost.style.left      = `${x0 + (x1 - x0) * e}px`;
                    ghost.style.top       = `${y0 + (y1 - y0) * e}px`;
                    ghost.style.opacity   = `${1 - e}`;
                    ghost.style.transform = `scale(${1 - 0.3 * e})`;
                    if (t < 1) {
                        requestAnimationFrame(tick);
                    } else {
                        ghost.remove();
                        onComplete?.();
                    }
                })(startTime);
            }

            function updateBubbles(dt, speedMult = 1) {
                const W = overlay.clientWidth  || window.innerWidth;
                const H = overlay.clientHeight || window.innerHeight;
                const toRemove = [];

                for (const [id, b] of activeBubbles) {
                    b.x += b.vx * speedMult * dt;
                    b.y += b.vy * speedMult * dt;
                    b.el.style.left = `${b.x - BUBBLE_R}px`;
                    b.el.style.top  = `${b.y - BUBBLE_R}px`;

                    const exited =
                        (b.vx < 0 && b.x < -BUBBLE_R) ||
                        (b.vx > 0 && b.x > W + BUBBLE_R) ||
                        (b.vy < 0 && b.y < -BUBBLE_R) ||
                        (b.vy > 0 && b.y > H + BUBBLE_R);
                    if (exited) toRemove.push(id);
                }

                for (const id of toRemove) removeBubble(id);
                while (activeBubbles.size < preset.bubbles) {
                    const letter = pickPairLetter();
                    spawnBubble(letter);
                    spawnBubble(letter);
                }
            }

            // ── Click & stock logic ──────────────────────────────────
            function onBubbleClick(id) {
                if (isResolved) return;
                const b = activeBubbles.get(id);
                if (!b) return;
                const H = overlay.clientHeight || window.innerHeight;
                if (b.y < 96 || b.y > H - 100) return;

                // Snapshot appearance BEFORE any DOM mutation
                const fromRect  = b.el.getBoundingClientRect();
                const bg        = b.el.style.background;
                const boxShadow = b.el.style.boxShadow;
                const innerHtml = b.el.innerHTML;
                const letter    = b.letter;

                removeBubble(id);

                if (stockLetter === null) {
                    // First click: update stock immediately, animate in parallel
                    setStock(id, letter);
                    floatToStock(fromRect, bg, boxShadow, innerHtml, null);
                } else {
                    // Second click: defer match/damage until animation finishes
                    const action = letter === stockLetter
                        ? () => attemptMatch()
                        : () => { clearStock(); takeDamage(); };
                    floatToStock(fromRect, bg, boxShadow, innerHtml, action);
                }
            }

            function setStock(id, letter) {
                if (stockBubbleId !== null) {
                    activeBubbles.get(stockBubbleId)?.el.classList.remove('hg-stocked-bubble');
                }
                stockLetter   = letter;
                stockBubbleId = id;
                new Audio(`${extensionFolderPath}/assets/sfx/minigames/correct-hangman.wav`).play().catch(() => {});
                activeBubbles.get(id)?.el.classList.add('hg-stocked-bubble');
                updateStockDisplay();
            }

            function clearStock() {
                if (stockBubbleId !== null) {
                    activeBubbles.get(stockBubbleId)?.el.classList.remove('hg-stocked-bubble');
                }
                stockLetter   = null;
                stockBubbleId = null;
                updateStockDisplay();
            }

            function attemptMatch() {
                const target = answerUpper[anagramTarget];
                if (stockLetter === target) {
                    revealChar(anagramTarget);
                    const usedId = stockBubbleId;
                    clearStock();
                    if (usedId !== null) removeBubble(usedId);
                    advanceTarget();
                } else {
                    clearStock();
                    takeDamage();
                }
            }

            function revealChar(idx) {
                const el = overlay.querySelector(`.hg-anagram-char[data-idx="${idx}"]`);
                if (!el) return;
                el.textContent = answerUpper[idx];
                el.classList.add('hg-revealed');
                el.classList.remove('hg-target');
                new Audio(`${extensionFolderPath}/assets/sfx/minigames/correct-letter.wav`).play().catch(() => {});
            }

            function advanceTarget() {
                anagramTarget++;
                while (anagramTarget < answerUpper.length && answerUpper[anagramTarget] === ' ') anagramTarget++;
                resetSpawnCycle();
                if (anagramTarget >= answerUpper.length) {
                    onWin();
                } else {
                    highlightTarget();
                }
            }

            // ── Damage ───────────────────────────────────────────────
            function takeDamage() {
                if (isResolved) return;
                currentHealth--;
                updateHealthDisplay();
                deductMonocoins?.(5, "hangman's gambit damage");
                incorrectAudio.currentTime = 0;
                incorrectAudio.play().catch(() => {});

                document.getElementById('hg-damage-flash')?.remove();
                const flash = document.createElement('div');
                flash.id = 'hg-damage-flash';
                document.body.appendChild(flash);
                setTimeout(() => flash.remove(), 220);

                document.body.classList.add('hg-shaking');

                clearTimeout(recoverTimer);
                recoverTimer = setTimeout(() => {
                    document.body.classList.remove('hg-shaking');
                }, 350);

                if (currentHealth <= 0) setTimeout(onLose, 150);
            }

            // ── Win ──────────────────────────────────────────────────
            function onWin() {
                if (isResolved) return;
                isResolved = true;
                cancelAnimationFrame(rafId);
                clearTimeout(recoverTimer);
                keyAC.abort();
                setBulletTimeActive(false);

                const reward = Math.max(5, currentHealth * 3);
                const overlayEl = document.getElementById(HG_ID);
                (async () => {
                    await showGotItBanner();
                    awardMonocoins?.(reward, "hangman's gambit solved");
                    resumeDynamicAudio?.();
                    if (overlayEl) {
                        overlayEl.style.transition = 'opacity 380ms ease';
                        overlayEl.style.opacity = '0';
                        await new Promise(r => setTimeout(r, 400));
                    }
                    destroy();
                    resolve(true);
                })();
            }

            // ── Lose ─────────────────────────────────────────────────
            function onLose() {
                if (isResolved) return;
                isResolved = true;
                cancelAnimationFrame(rafId);
                clearTimeout(recoverTimer);
                keyAC.abort();
                setBulletTimeActive(false);
                stopBgm();

                // Dismiss the overlay immediately so damage effects show through
                const overlayEl = document.getElementById(HG_ID);
                if (overlayEl) {
                    overlayEl.style.transition = 'opacity 200ms ease';
                    overlayEl.style.opacity = '0';
                }

                deductMonocoins?.(5, "hangman's gambit failed");

                const wrongAudio = incorrectAudio;
                wrongAudio.currentTime = 0;
                document.body.classList.add('hg-shaking');
                document.getElementById('hg-damage-flash')?.remove();
                const flash = document.createElement('div');
                flash.id = 'hg-damage-flash';
                document.body.appendChild(flash);
                setTimeout(() => flash.remove(), 220);
                document.body.classList.remove("dangan-theme-daily","dangan-theme-night","dangan-theme-investigation","dangan-theme-damaged");
                document.body.classList.add("dangan-theme-damaged");

                function cleanupLose() {
                    document.body.classList.remove('hg-shaking');
                    document.getElementById(HG_STYLE)?.remove();
                    document.body.classList.add('dangan-recovering');
                    document.body.classList.remove('dangan-theme-damaged');
                    restoreTheme?.();
                    resumeDynamicAudio?.();
                    setTimeout(() => document.body.classList.remove('dangan-recovering'), 1500);
                    destroy();
                    resolve(false);
                }

                wrongAudio.addEventListener('loadedmetadata', () => {
                    const stopAt = Math.max(0, (wrongAudio.duration - 0.5) * 1000);
                    setTimeout(() => document.body.classList.remove('hg-shaking'), stopAt);
                });
                wrongAudio.addEventListener('ended', cleanupLose);
                wrongAudio.play().catch(cleanupLose);
            }

            // ── RAF game loop ─────────────────────────────────────────
            function gameTick(ts) {
                if (isResolved) return;
                if (!lastTs) lastTs = ts;
                const dt = Math.min((ts - lastTs) / 1000, 0.1);
                lastTs = ts;

                // ── Bullet-time charge ────────────────────────────────
                if (btActive) {
                    btCharge = Math.max(0, btCharge - BT_DRAIN_RATE * dt);
                    if (btCharge <= 0) setBulletTimeActive(false);
                } else if (btCharge < 1) {
                    btCharge = Math.min(1, btCharge + BT_RECHARGE_RATE * dt);
                }
                updateBulletBar();

                // Evaluate speedMult AFTER charge update
                const speedMult = btActive ? 0.5 : 1.0;

                // ── Timer drain via independent wall clock ────────────
                // Using performance.now() directly (not RAF ts) so the
                // rate is unambiguously controlled by speedMult alone.
                const wallNow = performance.now();
                if (timerLastWall === null) timerLastWall = wallNow;
                const wallDt = Math.min((wallNow - timerLastWall) / 1000, 0.1);
                timerLastWall = wallNow;
                timeRemaining -= wallDt * speedMult * 1000;

                if (timeRemaining <= 0) {
                    timeRemaining = 0;
                    updateTimerDisplay(0);
                    onLose();
                    return;
                }

                updateTimerDisplay(timeRemaining);
                updateBubbles(dt, speedMult);
                rafId = requestAnimationFrame(gameTick);
            }

            // ── Gameplay start (deferred until BGM fires) ─────────────
            function startGameplay() {
                timerLastWall = null; // reset so timer starts from the moment music plays
                for (let i = 0; i < Math.ceil(preset.bubbles / 2); i++) {
                    const letter = pickPairLetter();
                    spawnBubble(letter);
                    spawnBubble(letter);
                }
                rafId = requestAnimationFrame(gameTick);
            }

            // ── Intro audio → BGM → gameplay ─────────────────────────
            function beginBgm() {
                if (playBgm) {
                    const el = playBgm();
                    if (el) {
                        _bgmAudio = el;
                        _bgmIsDA  = true;
                        el.addEventListener('playing', startGameplay, { once: true });
                        el.addEventListener('error',   startGameplay, { once: true });
                        return;
                    }
                }
                // Fallback: play directly
                const bgm = new Audio(`${extensionFolderPath}/assets/bgm/Hangman's Gambit.mp3`);
                bgm.loop = true;
                _bgmAudio = bgm;
                _bgmIsDA  = false;
                bgm.addEventListener('playing', startGameplay, { once: true });
                bgm.addEventListener('error',   startGameplay, { once: true });
                bgm.play().catch(() => startGameplay());
            }

            (async () => {
                const wantsTutorial = await showTutorialPrompt();
                if (wantsTutorial) await showTutorialModal();
                tutorialActive = false;
                const introAudio = new Audio(`${extensionFolderPath}/assets/sfx/minigames/minigame-start.wav`);
                introAudio.addEventListener('ended', beginBgm, { once: true });
                introAudio.addEventListener('error', beginBgm, { once: true });
                introAudio.play().catch(() => beginBgm());
            })();
        });
    }

    return { run };
}
