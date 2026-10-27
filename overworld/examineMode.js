// Examine mode, after Killing Harmony's investigations: no markers on the
// room. A small yellow crosshair roams it, turns into a diamond with a
// magnifying glass over something you can examine, and the thing's name shows
// in the yellow bar at the bottom. Clicking examines it. ARRANGE shows where
// the spots are so they can be dragged onto the room's picture.
// index.js supplies the spots and does the examining. While it's open the
// overworld's right-hand buttons step aside and EXAMINING / LOOK AT… /
// ARRANGE take their slots, in the same style.

const STYLE_ID = "dangan-examine-style";
const ROOT_ID = "dangan-examine";
const DRAG_THRESHOLD_PX = 6;
// How close (in % of the shorter screen side) the cursor must be to a spot.
const HIT_RADIUS_VMIN = 6.5;

const GOLD = "#f6d21f";
const svgCursor = (svg, x, y, fallback) => `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${x} ${y}, ${fallback}`;

const CROSSHAIR = svgCursor(
    `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><g fill="none" stroke="#000" stroke-opacity=".55" stroke-width="4"><circle cx="18" cy="18" r="8"/><path d="M18 3v6M18 27v6M3 18h6M27 18h6"/></g><g fill="none" stroke="${GOLD}" stroke-width="2"><circle cx="18" cy="18" r="8"/><path d="M18 3v6M18 27v6M3 18h6M27 18h6"/></g><circle cx="18" cy="18" r="1.6" fill="${GOLD}"/></svg>`,
    18, 18, "crosshair",
);
const DIAMOND = svgCursor(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><path d="M32 3 61 32 32 61 3 32Z" fill="rgba(20,16,0,.55)" stroke="#000" stroke-opacity=".5" stroke-width="5"/><path d="M32 3 61 32 32 61 3 32Z" fill="none" stroke="${GOLD}" stroke-width="2.5"/><path d="M32 11 53 32 32 53 11 32Z" fill="none" stroke="${GOLD}" stroke-opacity=".55" stroke-width="1.5"/><circle cx="29" cy="29" r="8" fill="none" stroke="${GOLD}" stroke-width="3"/><path d="M35 35l8 8" stroke="${GOLD}" stroke-width="4" stroke-linecap="round"/></svg>`,
    32, 32, "zoom-in",
);

const CSS = `
#${ROOT_ID} { position: fixed; inset: 0; z-index: 45; cursor: ${CROSSHAIR}; }
#${ROOT_ID}.dex-hot { cursor: ${DIAMOND}; }
#${ROOT_ID}.dex-busy { cursor: progress; }
#${ROOT_ID} .dex-plate {
    position: absolute; left: 50%; bottom: 7vh; transform: translateX(-50%) skewX(-18deg);
    min-width: min(420px, 70vw); padding: 7px 40px; box-sizing: border-box; text-align: center;
    background: linear-gradient(180deg, #ffe55a 0%, ${GOLD} 45%, #d9b308 100%);
    border: 2px solid #fff7c2; outline: 2px solid rgba(0,0,0,0.55);
    box-shadow: 0 3px 0 rgba(0,0,0,0.35), 0 0 0 6px rgba(246,210,31,0.18);
    color: #2a2100; font-family: "Arial", "Helvetica Neue", sans-serif; font-weight: 700;
    font-size: clamp(14px, 1.6vw, 22px); letter-spacing: 0.02em;
    pointer-events: none; transition: opacity 0.2s, filter 0.2s;
}
#${ROOT_ID} .dex-plate > span { display: inline-block; transform: skewX(18deg); }
#${ROOT_ID} .dex-plate::before, #${ROOT_ID} .dex-plate::after {
    content: ""; position: absolute; top: 50%; width: 14px; height: 70%; transform: translateY(-50%);
    border: 3px solid #2a2100; border-width: 0 3px; opacity: 0.55;
}
#${ROOT_ID} .dex-plate::before { left: 10px; }
#${ROOT_ID} .dex-plate::after { right: 10px; }
#${ROOT_ID}.dex-busy .dex-plate:not(.thinking) { opacity: 0; }
#${ROOT_ID} .dex-plate.dim { filter: saturate(0.35) brightness(0.75); opacity: 0.55; }
#${ROOT_ID} .dex-plate.gone { opacity: 0; }
#${ROOT_ID} .dex-plate.examined > span::after { content: " ✓"; }
#${ROOT_ID} .dex-btns { position: absolute; top: 240px; right: -10px; display: flex; flex-direction: column; gap: 10px; align-items: flex-end; }
#${ROOT_ID} .dex-btn {
    width: 256px; padding: 8px 14px; box-sizing: border-box; text-align: left; cursor: pointer;
    background: rgba(12, 12, 18, 0.82); color: #fff;
    font-family: 'Orbitron', sans-serif; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase;
    border: 1.5px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.35)); border-radius: 4px;
    box-shadow: 0 0 10px -2px var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.25));
    transform: skewX(-22deg); transition: background 140ms ease, transform 120ms ease;
}
#${ROOT_ID} .dex-btn > span { display: inline-block; transform: skewX(22deg); }
#${ROOT_ID} .dex-btn:hover { background: var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.18)); transform: skewX(-22deg) translateY(-2px); }
#${ROOT_ID} .dex-btn.on { background: ${GOLD}; color: #2a2100; border-color: #fff3a8; }
#${ROOT_ID}.dex-busy .dex-btns { opacity: 0.4; pointer-events: none; }
#${ROOT_ID} .dex-mark {
    position: absolute; width: 30px; height: 30px; transform: translate(-50%, -50%) rotate(45deg);
    border: 2px solid ${GOLD}; background: rgba(20,16,0,0.55); cursor: grab; touch-action: none; display: none;
}
#${ROOT_ID}.dex-arrange .dex-mark { display: block; }
#${ROOT_ID} .dex-mark.dragging { cursor: grabbing; background: rgba(246,210,31,0.45); }
#${ROOT_ID} .dex-plate.thinking > span::after { content: ""; animation: dex-dots 1.2s steps(4) infinite; }
@keyframes dex-dots { 0% { content: ""; } 25% { content: "."; } 50% { content: ".."; } 75% { content: "..."; } }
#${ROOT_ID} form.dex-plate { pointer-events: auto; cursor: default; padding: 5px 40px; display: flex; gap: 10px; align-items: center; }
#${ROOT_ID} form.dex-plate > * { transform: skewX(18deg); }
#${ROOT_ID} form.dex-plate input {
    flex: 1; min-width: 0; background: transparent; border: 0; border-bottom: 2px solid rgba(42,33,0,0.5);
    color: #2a2100; font: inherit; padding: 2px 4px; outline: none;
}
#${ROOT_ID} form.dex-plate input::placeholder { color: rgba(42,33,0,0.55); }
#${ROOT_ID} form.dex-plate button {
    background: #2a2100; color: ${GOLD}; border: 0; font: 700 0.75em Arial, sans-serif; letter-spacing: 0.08em; padding: 4px 10px; cursor: pointer;
}
#${ROOT_ID} .dex-text {
    position: absolute; left: 0; right: 0; bottom: 3vh; min-height: 11vh; padding: 2vh 18vw; box-sizing: border-box;
    background: linear-gradient(90deg, rgba(10,10,12,0.2), rgba(10,10,12,0.9) 12%, rgba(10,10,12,0.9) 88%, rgba(10,10,12,0.2));
    color: #fff; font: 700 clamp(14px, 1.6vw, 22px)/1.4 Arial, sans-serif; cursor: pointer;
}
#${ROOT_ID} .dex-text b { display: block; color: ${GOLD}; font-size: 0.75em; margin-bottom: 4px; }
@media (max-width: 600px) { #${ROOT_ID} .dex-text { padding: 2vh 5vw; } }
`;

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}

function splitSentences(text) {
    return (String(text).match(/[^.!?…]+[.!?…]+["”']?|\S[^.!?…]*$/g) || [String(text)]).map((s) => s.trim()).filter(Boolean);
}

// deps: {
//   loadSpots(): Promise<{ roomLabel, spots: [{ id, label, x, y, examined }] }>,
//   onExamine(spot): Promise, onFreeText(text): Promise,
//   onMove(spot, x, y), playSfx?(), onClose?(),
//   onChange?() — open / arrange state changed (the HUD redraws its chips),
//   onDismiss?() — Escape while a line is being read (ends it)
// }
export function createExamineMode(deps) {
    let root = null;
    let spots = [];
    let hovered = null;
    let busy = false;
    let plateTimer = null;
    let arranging = false;
    let endNarration = null;

    const isOpen = () => Boolean(root && root.isConnected);

    function close() {
        if (!root) return;
        document.body.classList.remove("dangan-examining");
        root.remove();
        root = null;
        hovered = null;
        arranging = false;
        clearTimeout(plateTimer);
        document.removeEventListener("keydown", onKey, true);
        deps.onClose?.();
        deps.onChange?.();
    }

    function onKey(e) {
        if (e.key !== "Escape" || !isOpen()) return;
        e.preventDefault();
        e.stopPropagation();
        if (busy) { deps.onDismiss?.(); return; }
        if (root.querySelector("form.dex-plate")) closeAsk();
        else close();
    }

    // The spot nearest the pointer, if it's close enough.
    function spotAt(clientX, clientY) {
        const unit = Math.min(window.innerWidth, window.innerHeight) / 100;
        let best = null;
        let bestDist = HIT_RADIUS_VMIN * unit;
        for (const spot of spots) {
            const d = Math.hypot(clientX - (spot.x / 100) * window.innerWidth, clientY - (spot.y / 100) * window.innerHeight);
            if (d <= bestDist) { best = spot; bestDist = d; }
        }
        return best;
    }

    function showPlate(spot) {
        const plate = root?.querySelector("div.dex-plate");
        if (!plate) return;
        clearTimeout(plateTimer);
        if (spot) {
            plate.querySelector("span").textContent = spot.label;
            plate.classList.remove("dim", "gone", "thinking");
            plate.classList.toggle("examined", Boolean(spot.examined));
        } else if (!plate.classList.contains("gone")) {
            // Fades like the game's bar once the cursor moves off.
            plate.classList.add("dim");
            plateTimer = setTimeout(() => plate.classList.add("gone"), 900);
        }
    }

    // "Examining the globe…" while the narration is written.
    function setThinking(label) {
        const plate = root?.querySelector("div.dex-plate");
        if (!plate) return;
        clearTimeout(plateTimer);
        if (label) {
            plate.querySelector("span").textContent = `Examining ${label}`;
            plate.classList.remove("dim", "gone", "examined");
            plate.classList.add("thinking");
        } else {
            plate.classList.remove("thinking");
            plate.classList.add("gone");
        }
    }

    function onPointerMove(e) {
        if (busy || arranging) return;
        const spot = spotAt(e.clientX, e.clientY);
        if (spot === hovered) return;
        hovered = spot;
        root.classList.toggle("dex-hot", Boolean(spot));
        showPlate(spot);
    }

    async function onClick(e) {
        if (busy || e.button !== 0 || arranging) return;
        if (e.target.closest("form.dex-plate, .dex-text")) return;
        const spot = spotAt(e.clientX, e.clientY);
        if (!spot) return;
        deps.playSfx?.();
        await run(() => deps.onExamine(spot), spot.label.toLowerCase());
        spot.examined = true;
    }

    // While an examination plays out the room is inert.
    async function run(fn, label = "") {
        busy = true;
        root?.classList.add("dex-busy");
        root?.classList.remove("dex-hot");
        setThinking(label);
        try { await fn(); } finally {
            busy = false;
            hovered = null;
            root?.classList.remove("dex-busy");
            showPlate(null);
        }
    }

    function renderMarks() {
        root.querySelectorAll(".dex-mark").forEach((el) => el.remove());
        for (const spot of spots) {
            const mark = document.createElement("div");
            mark.className = "dex-mark";
            mark.title = spot.label;
            mark.style.left = `${spot.x}%`;
            mark.style.top = `${spot.y}%`;
            mark.addEventListener("pointerdown", (e) => startDrag(e, mark, spot));
            root.appendChild(mark);
        }
    }

    function startDrag(e, mark, spot) {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        const start = { x: e.clientX, y: e.clientY };
        let dragging = false;
        mark.setPointerCapture?.(e.pointerId);
        showPlate(spot);
        const move = (ev) => {
            if (!dragging && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < DRAG_THRESHOLD_PX) return;
            dragging = true;
            mark.classList.add("dragging");
            spot.x = Math.max(2, Math.min(98, (ev.clientX / window.innerWidth) * 100));
            spot.y = Math.max(2, Math.min(98, (ev.clientY / window.innerHeight) * 100));
            mark.style.left = `${spot.x}%`;
            mark.style.top = `${spot.y}%`;
        };
        const up = () => {
            mark.removeEventListener("pointermove", move);
            mark.removeEventListener("pointerup", up);
            mark.removeEventListener("pointercancel", up);
            mark.classList.remove("dragging");
            if (dragging) deps.onMove?.(spot, Math.round(spot.x * 10) / 10, Math.round(spot.y * 10) / 10);
        };
        mark.addEventListener("pointermove", move);
        mark.addEventListener("pointerup", up);
        mark.addEventListener("pointercancel", up);
    }

    // LOOK AT…: the name bar turns into a text field.
    function openAsk() {
        if (!isOpen() || busy || root.querySelector("form.dex-plate")) return;
        if (arranging) toggleArrange();
        const form = document.createElement("form");
        form.className = "dex-plate";
        form.innerHTML = `<input type="text" maxlength="120" placeholder="What do you look at?" aria-label="What to examine"><button type="submit">EXAMINE</button>`;
        form.addEventListener("pointerdown", (e) => e.stopPropagation());
        form.addEventListener("click", (e) => e.stopPropagation());
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const value = form.querySelector("input").value.trim();
            if (!value || busy) return;
            closeAsk();
            deps.playSfx?.();
            await run(() => deps.onFreeText(value), value);
        });
        root.querySelector("div.dex-plate")?.classList.add("gone");
        root.appendChild(form);
        form.querySelector("input").focus();
    }

    function closeAsk() {
        root?.querySelector("form.dex-plate")?.remove();
    }

    function toggleArrange() {
        if (!isOpen() || busy) return false;
        closeAsk();
        arranging = !arranging;
        root.classList.toggle("dex-arrange", arranging);
        root.querySelector('[data-act="arrange"]')?.classList.toggle("on", arranging);
        root.classList.remove("dex-hot");
        hovered = null;
        showPlate(null);
        deps.onChange?.();
        return arranging;
    }

    // A text box of its own, for when the VN box isn't on. Click, Enter or
    // Space moves through the sentences.
    function showNarration({ name = "", text = "" } = {}) {
        if (!isOpen()) return Promise.resolve();
        const parts = splitSentences(text);
        if (!parts.length) return Promise.resolve();
        return new Promise((resolve) => {
            const box = document.createElement("div");
            box.className = "dex-text";
            let i = 0;
            const render = () => { box.innerHTML = `${name ? `<b></b>` : ""}<span></span>`; if (name) box.querySelector("b").textContent = name; box.querySelector("span").textContent = parts[i]; };
            const finish = () => {
                endNarration = null;
                box.remove();
                document.removeEventListener("keydown", next, true);
                resolve();
            };
            const next = (e) => {
                if (e?.type === "keydown" && !["Enter", " "].includes(e.key)) return;
                e?.preventDefault?.();
                e?.stopPropagation?.();
                i += 1;
                if (i < parts.length) { render(); return; }
                finish();
            };
            endNarration = finish;
            render();
            box.addEventListener("click", next);
            document.addEventListener("keydown", next, true);
            root.appendChild(box);
        });
    }

    async function open({ ask = false } = {}) {
        ensureStyle();
        close();
        root = document.createElement("div");
        root.id = ROOT_ID;
        root.setAttribute("role", "application");
        root.setAttribute("aria-label", "Examine the room");
        root.innerHTML = `
            <div class="dex-btns">
                <button type="button" class="dex-btn on" data-act="close" title="Stop examining (right-click or Esc)"><span>Examining</span></button>
                <button type="button" class="dex-btn" data-act="ask" title="Examine anything you name"><span>Look at…</span></button>
                <button type="button" class="dex-btn" data-act="arrange" title="Show the examinable spots and drag them onto the room's picture"><span>Arrange</span></button>
            </div>
            <div class="dex-plate gone"><span></span></div>`;
        const btns = root.querySelector(".dex-btns");
        btns.addEventListener("pointerdown", (e) => e.stopPropagation());
        btns.addEventListener("click", (e) => {
            e.stopPropagation();
            const act = e.target.closest("[data-act]")?.dataset.act;
            if (!act || busy) return;
            deps.playSfx?.();
            if (act === "close") close();
            else if (act === "ask") openAsk();
            else if (act === "arrange") toggleArrange();
        });
        btns.addEventListener("pointermove", (e) => {
            e.stopPropagation();
            if (hovered) { hovered = null; root.classList.remove("dex-hot"); showPlate(null); }
        });
        root.addEventListener("pointermove", onPointerMove);
        root.addEventListener("click", (e) => { void onClick(e); });
        root.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            if (busy) deps.onDismiss?.();
            else close();
        });
        document.body.appendChild(root);
        document.body.classList.add("dangan-examining");
        document.addEventListener("keydown", onKey, true);
        deps.onChange?.();
        if (ask) openAsk();

        const opened = root;
        const plate = root.querySelector("div.dex-plate");
        plate.querySelector("span").textContent = "Looking around";
        plate.classList.remove("gone");
        plate.classList.add("thinking");
        try {
            const loaded = await deps.loadSpots();
            if (root !== opened) return { ok: false };
            plate.classList.remove("thinking");
            plate.classList.add("gone");
            spots = loaded.spots.map((s) => ({ ...s }));
            renderMarks();
            return { ok: true, count: spots.length };
        } catch (err) {
            if (root !== opened) return { ok: false };
            close();
            return { ok: false, error: err?.message || String(err) };
        }
    }

    return {
        open,
        close,
        isOpen,
        isArranging: () => arranging,
        openAsk,
        toggleArrange,
        showNarration,
        // Clears "Examining…" once the line is ready to show.
        doneThinking: () => setThinking(null),
        // Ends examine mode's own text box early.
        dismissNarration: () => endNarration?.(),
    };
}
