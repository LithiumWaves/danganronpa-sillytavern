// GAME OVER, when the player is punished by death (a grave School
// Regulation), as DR1's dot-matrix GAME OVER: black, red dotted rules and
// bars, red lettering and a white-dot Monokuma, glitching. The frames are
// sampled from the game (vfx/gameOverFrames.js) and redrawn dot by dot.
// UNDO rewinds to before the violation; CONTINUE goes on as someone else:
// another persona, or a classmate from the roster.

import { GAME_OVER_FRAMES } from "./gameOverFrames.js";

const STYLE_ID = "dangan-gameover-style";
const ROOT_ID = "dangan-gameover";
const PICK_ID = "dangan-gameover-pick";
const CONFIRM_ID = "dangan-gameover-confirm";

// Where the dot grid sits in the 16:9 picture, as sampled (1280×720).
const GRID = { x0: 7.83 / 1280, y0: 4.5 / 720, pitch: 1 / 120, dot: 0.5 };
const RED = "#d81d1e";

const CSS = `
#${ROOT_ID}, #${PICK_ID}, #${CONFIRM_ID} {
    position: fixed; inset: 0; z-index: 100062; background: #000; color: ${RED};
    font: 700 15px "Orbitron", "Rajdhani", monospace; letter-spacing: 0.3em;
}
#${ROOT_ID} canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
#${ROOT_ID} .dgo-choice {
    position: absolute; bottom: max(3vh, 14px); padding: 10px 22px; opacity: 0; pointer-events: none;
    background: rgba(0, 0, 0, 0.82); color: ${RED}; border: 3px dotted ${RED};
    font: inherit; letter-spacing: 0.3em; cursor: pointer; transition: opacity 0.4s ease;
}
#${ROOT_ID}.is-ready .dgo-choice { opacity: 1; pointer-events: auto; }
#${ROOT_ID} .dgo-undo { left: max(3vw, 14px); }
#${ROOT_ID} .dgo-continue { right: max(3vw, 14px); }
#${ROOT_ID} .dgo-choice:hover, #${ROOT_ID} .dgo-choice:focus-visible { background: ${RED}; color: #000; outline: none; }
#${PICK_ID} { z-index: 100063; }
#${CONFIRM_ID} { z-index: 100064; background: rgba(0, 0, 0, 0.78); display: flex; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box; }
#${CONFIRM_ID} .dgo-confirm-box {
    width: min(560px, 100%); padding: 26px 24px 22px; box-sizing: border-box; background: #000;
    border: 3px dotted ${RED}; display: flex; flex-direction: column; gap: 18px; text-align: center;
}
#${CONFIRM_ID} .dgo-confirm-title { font-size: clamp(18px, 3vw, 24px); }
#${CONFIRM_ID} .dgo-confirm-text { color: #c9a3a3; font: 500 16px/1.5 "Rajdhani", sans-serif; letter-spacing: 0.04em; }
#${CONFIRM_ID} .dgo-confirm-actions { display: flex; justify-content: center; gap: 16px; flex-wrap: wrap; }
#${CONFIRM_ID} button { background: #000; color: ${RED}; border: 3px dotted ${RED}; font: inherit; letter-spacing: 0.3em; padding: 10px 22px; cursor: pointer; }
#${CONFIRM_ID} button:hover, #${CONFIRM_ID} button:focus-visible { background: ${RED}; color: #000; outline: none; }
#${PICK_ID} .dgo-switch { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
#${PICK_ID} .dgo-switch[hidden], #${PICK_ID} .dgo-card[hidden] { display: none; }
#${PICK_ID} .dgo-switch-label { font-size: 11px; color: #761413; margin-right: 6px; }
#${PICK_ID} .dgo-switch button.is-on { background: ${RED}; color: #000; border-style: solid; }
#${PICK_ID} { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; padding: 16px; box-sizing: border-box; }
#${PICK_ID} .dgo-pick-frame {
    width: min(760px, 100%); max-height: calc(100vh - 32px); overflow: auto; padding: 22px; box-sizing: border-box;
    border: 3px dotted ${RED}; display: flex; flex-direction: column; gap: 14px;
}
#${PICK_ID} .dgo-pick-title { font-size: clamp(16px, 3vw, 22px); text-align: center; }
#${PICK_ID} .dgo-pick-note { color: #8a6a6a; font: 500 14px "Rajdhani", sans-serif; letter-spacing: 0.04em; text-align: center; }
#${PICK_ID} .dgo-section { font-size: 11px; color: #761413; border-bottom: 2px dotted #761413; padding-bottom: 4px; }
#${PICK_ID} .dgo-grid { display: flex; flex-wrap: wrap; gap: 10px; }
#${PICK_ID} button {
    background: #000; color: ${RED}; border: 2px dotted ${RED}; font: 700 13px "Orbitron", monospace;
    letter-spacing: 0.2em; padding: 8px 16px; cursor: pointer;
}
#${PICK_ID} button:hover, #${PICK_ID} button:focus-visible { background: ${RED}; color: #000; outline: none; }
#${PICK_ID} .dgo-card { display: flex; align-items: center; gap: 8px; padding: 5px 12px 5px 5px; font: 600 14px "Rajdhani", sans-serif; letter-spacing: 0.06em; }
#${PICK_ID} .dgo-card img { width: 32px; height: 32px; object-fit: cover; filter: grayscale(1) contrast(1.3); }
#${PICK_ID} .dgo-card.is-on { background: ${RED}; color: #000; border-style: solid; }
#${PICK_ID} .dgo-card.is-on img { filter: none; }
#${PICK_ID} .dgo-empty { color: #8a6a6a; font: 500 14px "Rajdhani", sans-serif; letter-spacing: 0.04em; }
#${PICK_ID} .dgo-foot { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
#${PICK_ID} button:disabled { opacity: 0.35; cursor: not-allowed; }
#${PICK_ID} button:disabled:hover { background: #000; color: ${RED}; }
`;

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}

function esc(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Frames ──────────────────────────────────────────────────────────────────

// The packed frames (4 cells a byte, 2 bits each) as one Uint8Array of cell
// values per frame.
export function unpackFrames(bytes, { cols, rows, count }) {
    const cells = cols * rows;
    const perFrame = Math.ceil(cells / 4);
    const frames = [];
    for (let f = 0; f < count; f += 1) {
        const out = new Uint8Array(cells);
        const base = f * perFrame;
        for (let i = 0; i < cells; i += 1) out[i] = (bytes[base + (i >> 2)] >> ((i & 3) * 2)) & 3;
        frames.push(out);
    }
    return frames;
}

async function inflateBase64(b64) {
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const stream = new Blob([bin]).stream().pipeThrough(new DecompressionStream("deflate"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

let framesPromise = null;
export function loadGameOverFrames() {
    framesPromise ||= inflateBase64(GAME_OVER_FRAMES.data).then((bytes) => unpackFrames(bytes, GAME_OVER_FRAMES));
    return framesPromise;
}

// Which frame of the clip is showing `ms` after it starts: the clip once,
// then its glitching part over and over.
export function frameAt(ms, { fps, sequence, loopFrom }) {
    const n = Math.floor((Math.max(0, ms) / 1000) * fps);
    if (n < sequence.length) return sequence[n];
    const loop = sequence.length - loopFrom;
    return sequence[loopFrom + ((n - sequence.length) % loop)];
}

// The 16:9 picture, letterboxed in the viewport.
export function pictureRect(width, height) {
    const w = Math.min(width, (height * 16) / 9);
    const h = (w * 9) / 16;
    return { x: (width - w) / 2, y: (height - h) / 2, w, h };
}

function drawFrame(ctx, cells, rect, { cols, rows, colors }) {
    const pitch = rect.w * GRID.pitch;
    const size = Math.max(1, pitch * GRID.dot);
    const x0 = rect.x + rect.w * GRID.x0 - size / 2;
    const y0 = rect.y + rect.h * GRID.y0 - size / 2;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    for (const level of [1, 2, 3]) {
        ctx.fillStyle = colors[level];
        ctx.beginPath();
        for (let r = 0; r < rows; r += 1) {
            for (let c = 0; c < cols; c += 1) {
                if (cells[r * cols + c] === level) ctx.rect(Math.round(x0 + c * pitch), Math.round(y0 + r * pitch), size, size);
            }
        }
        ctx.fill();
    }
}

// { playSound, onUndo, onContinue } → Promise<"undo" | "continue">. The
// screen stays up (still glitching) while onUndo / onContinue run; it closes
// when one resolves true, and stays for another try when it resolves false.
export function openGameOver({ playSound = null, onUndo = null, onContinue = null } = {}) {
    ensureStyle();
    document.getElementById(ROOT_ID)?.remove();
    return new Promise((resolve) => {
        const root = document.createElement("div");
        root.id = ROOT_ID;
        root.setAttribute("role", "dialog");
        root.setAttribute("aria-label", "Game over");
        root.innerHTML = `<canvas></canvas>
            <button type="button" class="dgo-choice dgo-undo">UNDO</button>
            <button type="button" class="dgo-choice dgo-continue">CONTINUE</button>`;
        document.body.appendChild(root);
        const canvas = root.querySelector("canvas");
        const ctx = canvas.getContext("2d");
        const still = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
        let frames = null;
        let shown = -1;
        let raf = 0;
        let start = 0;
        let done = false;

        const size = () => {
            const dpr = window.devicePixelRatio || 1;
            canvas.width = Math.round(root.clientWidth * dpr);
            canvas.height = Math.round(root.clientHeight * dpr);
            shown = -1;
        };
        const tick = (now) => {
            if (done) return;
            if (!start) start = now;
            const ms = now - start;
            const index = still ? GAME_OVER_FRAMES.sequence[GAME_OVER_FRAMES.sequence.length - 1] : frameAt(ms, GAME_OVER_FRAMES);
            if (frames && index !== shown) {
                shown = index;
                drawFrame(ctx, frames[index], pictureRect(canvas.width, canvas.height), GAME_OVER_FRAMES);
            }
            // The choices come once the clip has played through once.
            if (!root.classList.contains("is-ready") && (still || ms >= (GAME_OVER_FRAMES.sequence.length / GAME_OVER_FRAMES.fps) * 1000)) {
                root.classList.add("is-ready");
                root.querySelector(".dgo-continue").focus({ preventScroll: true });
            }
            raf = requestAnimationFrame(tick);
        };
        const onResize = () => size();
        window.addEventListener("resize", onResize);
        size();

        const pick = (choice) => {
            if (done) return;
            done = true;
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", onResize);
            root.remove();
            resolve(choice);
        };
        let asking = false;
        const choose = async (choice, handler) => {
            if (done || asking) return;
            if (!handler) { pick(choice); return; }
            asking = true;
            try {
                if (await handler()) pick(choice);
            } finally {
                asking = false;
            }
        };
        root.querySelector(".dgo-undo").addEventListener("click", () => choose("undo", onUndo));
        root.querySelector(".dgo-continue").addEventListener("click", () => choose("continue", onContinue));

        loadGameOverFrames().then((f) => {
            frames = f;
            try { playSound?.(); } catch { /* no sound */ }
            raf = requestAnimationFrame(tick);
        }).catch((err) => {
            // No DecompressionStream: the choices still work on black.
            console.warn("[Dangan][GameOver] frames failed:", err);
            root.classList.add("is-ready");
        });
    });
}

// A yes / no question in the GAME OVER look, over the screen. Esc or a
// click outside says no; Enter says yes.
export function openGameOverConfirm({ title = "UNDO?", message = "", confirmLabel = "UNDO", cancelLabel = "CANCEL" } = {}) {
    ensureStyle();
    document.getElementById(CONFIRM_ID)?.remove();
    return new Promise((resolve) => {
        const root = document.createElement("div");
        root.id = CONFIRM_ID;
        root.setAttribute("role", "alertdialog");
        root.setAttribute("aria-label", title);
        root.innerHTML = `<div class="dgo-confirm-box">
            <div class="dgo-confirm-title">${esc(title)}</div>
            <div class="dgo-confirm-text">${esc(message)}</div>
            <div class="dgo-confirm-actions"><button type="button" class="dgo-no">${esc(cancelLabel)}</button><button type="button" class="dgo-yes">${esc(confirmLabel)}</button></div>
        </div>`;
        document.body.appendChild(root);
        const done = (answer) => {
            document.removeEventListener("keydown", onKey, true);
            root.remove();
            resolve(answer);
        };
        const onKey = (e) => {
            if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); done(false); }
            else if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); done(true); }
        };
        document.addEventListener("keydown", onKey, true);
        root.querySelector(".dgo-yes").addEventListener("click", () => done(true));
        root.querySelector(".dgo-no").addEventListener("click", () => done(false));
        root.addEventListener("click", (e) => { if (e.target === root) done(false); });
        root.querySelector(".dgo-yes").focus({ preventScroll: true });
    });
}

// Who to play as next. personas: [{ key, name, avatarUrl }], classmates:
// [{ name, avatarUrl }]. You pick the persona you play as yourself; taking
// a classmate's place is optional and separate (that classmate leaves the
// class, and is removed from the group chat or only muted). Resolves
// { persona: key | null, classmate: name | null, kick } or null (back);
// persona null means a new persona made from the classmate's card.
export function openSuccessorPicker({ personas = [], classmates = [] } = {}) {
    ensureStyle();
    document.getElementById(PICK_ID)?.remove();
    return new Promise((resolve) => {
        const root = document.createElement("div");
        root.id = PICK_ID;
        root.setAttribute("role", "dialog");
        root.setAttribute("aria-label", "Who do you play as now?");
        const card = (kind, id, label, avatarUrl) => `<button type="button" class="dgo-card" data-kind="${kind}" data-id="${esc(id)}">${avatarUrl ? `<img src="${esc(avatarUrl)}" alt="" loading="lazy">` : ""}<span>${esc(label)}</span></button>`;
        root.innerHTML = `<div class="dgo-pick-frame">
            <div class="dgo-pick-title">WHO DO YOU PLAY AS NOW?</div>
            <div class="dgo-pick-note">Pick the persona you play as. You can also take a classmate's place: they leave the class and the AI stops speaking for them. Their messages stay.</div>
            <div class="dgo-section">TAKE A CLASSMATE'S PLACE (OPTIONAL)</div>
            <div class="dgo-grid dgo-classmates">${classmates.map((c) => card("classmate", c.name, c.name, c.avatarUrl)).join("") || `<div class="dgo-empty">Nobody is left.</div>`}</div>
            <div class="dgo-switch" hidden><span class="dgo-switch-label">IN THE GROUP CHAT:</span><button type="button" class="is-on" data-kick="1">REMOVE THEM</button><button type="button" data-kick="0">JUST MUTE THEM</button></div>
            <div class="dgo-section">PLAY AS</div>
            <div class="dgo-grid dgo-personas">${personas.map((p) => card("persona", p.key, p.name, p.avatarUrl)).join("")}<button type="button" class="dgo-card dgo-from-card" data-kind="fromcard" hidden><span></span></button>${personas.length ? "" : `<div class="dgo-empty dgo-no-personas">No other personas. Take a classmate's place to make one from their card.</div>`}</div>
            <div class="dgo-foot"><button type="button" class="dgo-back">BACK</button><button type="button" class="dgo-go" disabled>PLAY</button></div>
        </div>`;
        document.body.appendChild(root);
        let classmate = null;
        let persona; // a persona key, null for "new from the card", undefined for none yet
        let kick = true;
        const go = root.querySelector(".dgo-go");
        const kickSwitch = root.querySelector(".dgo-switch");
        const fromCard = root.querySelector(".dgo-from-card");
        const sync = () => {
            root.querySelectorAll('.dgo-card[data-kind="classmate"]').forEach((b) => b.classList.toggle("is-on", b.dataset.id === classmate));
            kickSwitch.hidden = !classmate;
            fromCard.hidden = !classmate;
            fromCard.querySelector("span").textContent = classmate ? `+ NEW PERSONA FROM ${classmate.toUpperCase()}'S CARD` : "";
            if (!classmate && persona === null) persona = undefined;
            root.querySelectorAll('.dgo-card[data-kind="persona"]').forEach((b) => b.classList.toggle("is-on", b.dataset.id === persona));
            fromCard.classList.toggle("is-on", persona === null);
            go.disabled = persona === undefined;
        };
        kickSwitch.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
            kick = b.dataset.kick === "1";
            kickSwitch.querySelectorAll("button").forEach((x) => x.classList.toggle("is-on", x === b));
        }));
        root.querySelectorAll('.dgo-card[data-kind="classmate"]').forEach((btn) => btn.addEventListener("click", () => {
            classmate = classmate === btn.dataset.id ? null : btn.dataset.id;
            sync();
        }));
        root.querySelectorAll('.dgo-card[data-kind="persona"]').forEach((btn) => btn.addEventListener("click", () => {
            persona = btn.dataset.id;
            sync();
        }));
        fromCard.addEventListener("click", () => {
            persona = null;
            sync();
        });
        const done = (value) => {
            root.remove();
            resolve(value);
        };
        root.querySelector(".dgo-back").addEventListener("click", () => done(null));
        go.addEventListener("click", () => done({ persona, classmate, kick: classmate ? kick : false }));
        sync();
    });
}
