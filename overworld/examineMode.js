// Examine mode: a magnifier over the room during an investigation, with the
// spots the player can look at up close. Clicking a spot examines it;
// dragging moves it onto the right part of the room's picture. index.js
// supplies the spots and does the examining.

const STYLE_ID = "dangan-examine-style";
const ROOT_ID = "dangan-examine";
const DRAG_THRESHOLD_PX = 6;

// A magnifying glass cursor, hot spot at the lens centre.
const CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="15" cy="15" r="10" fill="rgba(255,255,255,0.15)" stroke="#fff" stroke-width="3"/><circle cx="15" cy="15" r="10" fill="none" stroke="#ff2ec4" stroke-width="1.5"/><path d="M23 23 L36 36" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M23 23 L36 36" stroke="#ff2ec4" stroke-width="2" stroke-linecap="round"/></svg>',
)}") 15 15, zoom-in`;

const CSS = `
#${ROOT_ID} {
    position: fixed; inset: 0; z-index: 45;
    cursor: ${CURSOR};
    background: radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(10,0,20,0.45) 100%);
    animation: dangan-examine-in 0.25s ease;
}
@keyframes dangan-examine-in { from { opacity: 0; } to { opacity: 1; } }
#${ROOT_ID} .dex-bar {
    position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: center;
    padding: 6px 14px; max-width: calc(100vw - 32px); box-sizing: border-box;
    background: rgba(10, 4, 16, 0.85); border: 1px solid rgba(255, 46, 196, 0.55); border-radius: 6px;
    color: #f1e6f7; font-size: 0.85rem; letter-spacing: 0.08em; cursor: default;
}
#${ROOT_ID} .dex-title { color: #ff2ec4; font-weight: bold; }
#${ROOT_ID} .dex-bar button {
    background: transparent; color: #fff; border: 1px solid rgba(255, 182, 222, 0.6); border-radius: 4px;
    font: inherit; font-size: 0.78rem; padding: 3px 10px; cursor: pointer;
}
#${ROOT_ID} .dex-bar button:hover { background: rgba(255, 46, 196, 0.25); }
#${ROOT_ID} .dex-status { color: #ffd23f; }
#${ROOT_ID} .dex-spot {
    position: absolute; transform: translate(-50%, -50%);
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    background: none; border: 0; padding: 0; cursor: inherit; touch-action: none;
}
#${ROOT_ID} .dex-ring {
    width: 34px; height: 34px; border-radius: 50%;
    border: 3px solid #fff; box-shadow: 0 0 0 2px #ff2ec4, 0 0 14px rgba(255, 46, 196, 0.8);
    background: rgba(255, 46, 196, 0.18);
    animation: dangan-examine-pulse 1.6s ease-in-out infinite;
    display: flex; align-items: center; justify-content: center; color: #fff; font-weight: bold;
}
@keyframes dangan-examine-pulse { 50% { transform: scale(1.15); } }
#${ROOT_ID} .dex-spot.examined .dex-ring {
    animation: none; background: rgba(0, 0, 0, 0.45); box-shadow: 0 0 0 2px #777; border-color: #bbb;
}
#${ROOT_ID} .dex-spot.examined .dex-ring::after { content: "✓"; }
#${ROOT_ID} .dex-label {
    padding: 2px 8px; border-radius: 3px; white-space: nowrap;
    background: rgba(10, 4, 16, 0.85); color: #fff; font-size: 0.78rem; letter-spacing: 0.05em;
    opacity: 0; transition: opacity 0.15s;
}
#${ROOT_ID} .dex-spot:hover .dex-label, #${ROOT_ID} .dex-spot:focus-visible .dex-label, #${ROOT_ID} .dex-spot.dragging .dex-label { opacity: 1; }
#${ROOT_ID} .dex-spot.dragging .dex-ring { animation: none; transform: scale(1.2); }
#${ROOT_ID} .dex-ask {
    position: absolute; top: 60px; left: 50%; transform: translateX(-50%);
    display: flex; gap: 8px; padding: 8px; width: min(460px, calc(100vw - 32px)); box-sizing: border-box;
    background: rgba(10, 4, 16, 0.92); border: 1px solid rgba(255, 46, 196, 0.55); border-radius: 6px; cursor: default;
}
#${ROOT_ID} .dex-ask input {
    flex: 1; min-width: 0; background: rgba(0,0,0,0.5); color: #fff; border: 1px solid rgba(255,182,222,0.4);
    border-radius: 4px; padding: 6px 8px; font: inherit;
}
@media (hover: none) { #${ROOT_ID} .dex-label { opacity: 1; } }
`;

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}

// deps: {
//   loadSpots(): Promise<{ roomLabel, spots: [{ id, label, x, y, examined }] }>,
//   onExamine(spot): Promise, onFreeText(text): Promise,
//   onMove(spot, x, y), playSfx?(), onClose?()
// }
export function createExamineMode(deps) {
    let root = null;
    let busy = false;

    function isOpen() {
        return Boolean(root && root.isConnected);
    }

    function close() {
        if (!root) return;
        root.remove();
        root = null;
        document.removeEventListener("keydown", onKey, true);
        deps.onClose?.();
    }

    function onKey(e) {
        if (e.key !== "Escape" || !isOpen()) return;
        const ask = root.querySelector(".dex-ask");
        e.preventDefault();
        e.stopPropagation();
        if (ask) ask.remove();
        else close();
    }

    function setStatus(text) {
        const el = root?.querySelector(".dex-status");
        if (el) el.textContent = text || "";
    }

    function renderSpots(spots) {
        root.querySelectorAll(".dex-spot").forEach((el) => el.remove());
        for (const spot of spots) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = `dex-spot${spot.examined ? " examined" : ""}`;
            btn.style.left = `${spot.x}%`;
            btn.style.top = `${spot.y}%`;
            btn.setAttribute("aria-label", `Examine ${spot.label}${spot.examined ? " (examined)" : ""}`);
            btn.innerHTML = `<span class="dex-ring"></span><span class="dex-label"></span>`;
            btn.querySelector(".dex-label").textContent = spot.label;
            attachPointer(btn, spot);
            root.appendChild(btn);
        }
    }

    // A press that barely moves is a click; anything further drags the spot.
    function attachPointer(btn, spot) {
        btn.addEventListener("pointerdown", (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            const start = { x: e.clientX, y: e.clientY };
            let dragging = false;
            btn.setPointerCapture?.(e.pointerId);
            const move = (ev) => {
                if (!dragging && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < DRAG_THRESHOLD_PX) return;
                dragging = true;
                btn.classList.add("dragging");
                btn.style.left = `${Math.max(2, Math.min(98, (ev.clientX / window.innerWidth) * 100))}%`;
                btn.style.top = `${Math.max(2, Math.min(98, (ev.clientY / window.innerHeight) * 100))}%`;
            };
            const up = (ev) => {
                btn.removeEventListener("pointermove", move);
                btn.removeEventListener("pointerup", up);
                btn.removeEventListener("pointercancel", up);
                btn.classList.remove("dragging");
                if (dragging) {
                    deps.onMove?.(spot, parseFloat(btn.style.left), parseFloat(btn.style.top));
                    return;
                }
                if (ev.type === "pointerup") void examine(spot);
            };
            btn.addEventListener("pointermove", move);
            btn.addEventListener("pointerup", up);
            btn.addEventListener("pointercancel", up);
        });
        btn.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                void examine(spot);
            }
        });
    }

    async function examine(spot) {
        if (busy) return;
        busy = true;
        deps.playSfx?.();
        close();
        try { await deps.onExamine(spot); } finally { busy = false; }
    }

    function openAsk() {
        if (!isOpen() || root.querySelector(".dex-ask")) return;
        const form = document.createElement("form");
        form.className = "dex-ask";
        form.innerHTML = `<input type="text" maxlength="120" placeholder="What do you look at? (e.g. the window latch)" aria-label="What to examine"><button type="submit">EXAMINE</button>`;
        form.addEventListener("pointerdown", (e) => e.stopPropagation());
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const value = form.querySelector("input").value.trim();
            if (!value || busy) return;
            busy = true;
            deps.playSfx?.();
            close();
            try { await deps.onFreeText(value); } finally { busy = false; }
        });
        root.appendChild(form);
        form.querySelector("input").focus();
    }

    async function open({ ask = false } = {}) {
        ensureStyle();
        close();
        root = document.createElement("div");
        root.id = ROOT_ID;
        root.setAttribute("role", "dialog");
        root.setAttribute("aria-label", "Examine the room");
        root.innerHTML = `<div class="dex-bar"><span class="dex-title">EXAMINE</span><span class="dex-room"></span><span class="dex-status">Looking around…</span><button type="button" data-act="ask">EXAMINE…</button><button type="button" data-act="close">DONE</button></div>`;
        root.querySelector('[data-act="ask"]').addEventListener("click", (e) => { e.stopPropagation(); openAsk(); });
        root.querySelector('[data-act="close"]').addEventListener("click", (e) => { e.stopPropagation(); close(); });
        root.querySelector(".dex-bar").addEventListener("pointerdown", (e) => e.stopPropagation());
        document.body.appendChild(root);
        document.addEventListener("keydown", onKey, true);
        if (ask) openAsk();

        const opened = root;
        try {
            const { roomLabel, spots } = await deps.loadSpots();
            if (root !== opened) return;
            root.querySelector(".dex-room").textContent = roomLabel || "";
            renderSpots(spots);
            setStatus(spots.length ? "Click something to look closer. Drag a marker to move it." : "Nothing to examine here.");
        } catch (err) {
            if (root !== opened) return;
            setStatus(`Couldn't look around: ${err?.message || err}`);
        }
    }

    return { open, close, isOpen, refresh: (spots) => isOpen() && renderSpots(spots) };
}
