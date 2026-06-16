import { getRequestHeaders } from "../../../../../script.js";

// Death-portrait generator — builds `/characters/<folder>/death-portrait.png` for
// characters from their `neutral` sprite, using the framed-portrait template.
// The template (assets/templates/death-portrait-template.xcf) was converted into
// three web PNGs by tools/extract-mugshot-template.mjs (run once at build time):
//   death-portrait-stand.png  — the ornate picture frame on a stand
//   death-portrait-cross.png  — the pink X mark
//   death-portrait-mask.png   — opaque white inside the frame window, else clear
//
// Composite (per character): cropped neutral sprite (head→chest) into the frame
// window → clip to the window (destination-in mask) → frame on top → X on top.
// Mirrors vfx/mugshotGenerator.js: self-contained, same /api/sprites usage, same
// modal chrome (monopad-vfx-* classes), exports a single init function.

const OVERLAY_ID = "monopad-death-portrait-overlay";
const STYLE_ID = "monopad-death-portrait-style";

const FRAME_W = 220;
const FRAME_H = 750;
const DEFAULT_FRAC = 0.42;     // fraction of figure height shown (head→chest)
const FRAC_MIN = 0.30;
const FRAC_MAX = 0.60;

// Template assets resolved relative to this module, so the generator works
// regardless of where the extension folder is mounted.
const TPL = {
    stand: new URL("../assets/templates/death-portrait-stand.png", import.meta.url).href,
    cross: new URL("../assets/templates/death-portrait-cross.png", import.meta.url).href,
    mask: new URL("../assets/templates/death-portrait-mask.png", import.meta.url).href,
};

const state = {
    scope: "current",          // 'current' | 'all' | 'pick'  (pick = all, manual ticks)
    frac: DEFAULT_FRAC,
    items: [],                 // [{ name, folder, neutralUrl, img, exists, checked, status }]
    generating: false,
};

let _templates = null;         // cached { stand, cross, mask, win } (win = window bbox)
let getPlayerTarget = null;    // () => { name, folder } | null — the player persona's sprite target

// ── helpers ──────────────────────────────────────────────────────────────────
function escapeAttr(s) { return String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;"); }
function escapeText(s) { return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function toast(kind, msg) { const fn = window.toastr?.[kind]; if (typeof fn === "function") fn(msg); }

function loadImage(url, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        let done = false;
        const finish = (fn, arg) => { if (!done) { done = true; clearTimeout(timer); fn(arg); } };
        // A bad/never-resolving URL must not hang forever — it would block the
        // whole preview pass. Reject on timeout so the cell just fails cleanly.
        const timer = setTimeout(() => finish(reject, new Error(`Timed out loading ${url}`)), timeoutMs);
        img.onload = () => finish(resolve, img);
        img.onerror = () => finish(reject, new Error(`Failed to load ${url}`));
        img.src = url;
    });
}

// Opaque bounding box (alpha > 16) of an image.
function detectBBox(img) {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, w, h).data;
    let minX = w, minY = h, maxX = 0, maxY = 0, found = false;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (data[(y * w + x) * 4 + 3] > 16) {
                found = true;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }
    if (!found) return { x: 0, y: 0, w, h };
    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

async function loadTemplates() {
    if (_templates) return _templates;
    const [stand, cross, mask] = await Promise.all([loadImage(TPL.stand), loadImage(TPL.cross), loadImage(TPL.mask)]);
    // The frame window is the opaque region of the mask; its bbox tells us where
    // (and at what aspect) to place the cropped sprite.
    const win = detectBBox(mask);
    _templates = { stand, cross, mask, win };
    return _templates;
}

// Resolve the sprite folder the same way getSpriteUrl() / spriteManager do: the
// avatar filename without its extension, falling back to the character name.
function getCharacterList() {
    const ctxChars = window.SillyTavern?.getContext?.()?.characters;
    const chars = Array.isArray(ctxChars) ? ctxChars
        : Array.isArray(window.characters) ? window.characters
            : [];
    return chars
        .map(c => {
            const name = c?.name;
            if (!name) return null;
            const folder = c.avatar ? String(c.avatar).replace(/\.[^.]+$/, "") : name;
            return { name, folder };
        })
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name));
}

// The full target list: the player persona (when a sprite folder is configured)
// at the top, followed by the NPC cast. Deduped so a player sprite that happens
// to be a character folder isn't listed twice.
function getTargetList() {
    const npcs = getCharacterList();
    const player = typeof getPlayerTarget === "function" ? getPlayerTarget() : null;
    if (!player?.folder) return npcs;
    const rest = npcs.filter(c => c.folder !== player.folder);
    return [{ name: `${player.name} (You)`, folder: player.folder, isPlayer: true }, ...rest];
}

// Names of characters participating in the currently-open chat (group members,
// or the single active character in a solo chat).
function getCurrentChatNames() {
    const names = new Set();
    try {
        const ctx = window.SillyTavern?.getContext?.();
        if (!ctx) return names;
        if (ctx.groupId != null) {
            const group = (ctx.groups || []).find(g => String(g.id) === String(ctx.groupId));
            for (const member of (group?.members || [])) {
                const c = (ctx.characters || []).find(ch => ch.avatar === member);
                if (c?.name) names.add(c.name);
            }
        } else if (ctx.characterId != null) {
            const c = ctx.characters?.[ctx.characterId];
            if (c?.name) names.add(c.name);
        }
    } catch { /* fall through with whatever we have */ }
    return names;
}

// Full (non -half) neutral sprite URL for a folder, via the same sprites API
// getSpriteUrl uses. Returns null when the character has no neutral sprite.
async function resolveNeutralUrl(folder) {
    try {
        const resp = await fetch(`/api/sprites/get?name=${encodeURIComponent(folder)}`);
        if (!resp.ok) return null;
        const sprites = await resp.json();
        const neutral = sprites.filter(s => String(s.label || "").toLowerCase() === "neutral");
        const full = neutral.find(s => !/-half\.[a-z0-9]+(\?|$)/i.test(String(s.path || "")));
        return (full ?? neutral[0])?.path ?? null;
    } catch { return null; }
}

// Does /characters/<folder>/death-portrait.png already exist?
function deathPortraitExists(folder) {
    return new Promise(resolve => {
        const probe = new Image();
        probe.onload = () => resolve(true);
        probe.onerror = () => resolve(false);
        probe.src = `/characters/${encodeURIComponent(folder)}/death-portrait.png?_=${Date.now()}`;
    });
}

// Composite a 220×750 death portrait canvas from a neutral sprite Image.
async function renderDeathPortraitCanvas(spriteImg, frac) {
    const { stand, cross, mask, win } = await loadTemplates();
    const box = detectBBox(spriteImg);

    // Show the top `frac` of the figure (head→chest), framed to the window aspect
    // and horizontally centred on the figure.
    const cropH = box.h * frac;
    const cropW = cropH * (win.w / win.h);
    const cropX = (box.x + box.w / 2) - cropW / 2;
    const cropY = box.y;

    const canvas = document.createElement("canvas");
    canvas.width = FRAME_W;
    canvas.height = FRAME_H;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";

    // Backdrop behind the portrait — without this the transparent areas of the
    // sprite (around the head/shoulders) are left clear, so the trial scene shows
    // through the frame window. A neutral desaturated gradient suits the grayscale
    // figure and reads as a studio portrait backdrop. Drawn first so the sprite
    // sits on top of it, and both get clipped to the window by the mask below.
    const bg = ctx.createLinearGradient(0, win.y, 0, win.y + win.h);
    bg.addColorStop(0, "#41414a");
    bg.addColorStop(1, "#1b1b20");
    ctx.fillStyle = bg;
    ctx.fillRect(win.x, win.y, win.w, win.h);

    // Sprite into the frame window — grayscaled (the deceased), while the frame
    // and X keep their colour. The filter applies only to this drawImage.
    ctx.filter = "grayscale(1)";
    ctx.drawImage(spriteImg, cropX, cropY, cropW, cropH, win.x, win.y, win.w, win.h);
    ctx.filter = "none";
    // Clip the backdrop + sprite to the exact window shape.
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(mask, 0, 0, FRAME_W, FRAME_H);
    ctx.globalCompositeOperation = "source-over";

    // The X sits on the portrait, BENEATH the frame — so the ornate border draws
    // over any part of the X that overflows the window. Cross first, then frame.
    ctx.drawImage(cross, 0, 0, FRAME_W, FRAME_H);
    ctx.drawImage(stand, 0, 0, FRAME_W, FRAME_H);

    return canvas;
}

function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("toBlob returned null")), "image/png");
    });
}

// Upload a generated death portrait as <folder>/death-portrait.png.
async function uploadDeathPortrait(folder, blob) {
    const fd = new FormData();
    fd.append("name", folder);
    fd.append("label", "death-portrait");
    fd.append("avatar", new File([blob], "death-portrait.png", { type: "image/png" }));
    fd.append("spriteName", "death-portrait");
    const resp = await fetch("/api/sprites/upload", {
        method: "POST",
        headers: getRequestHeaders({ omitContentType: true }),
        body: fd,
        cache: "no-cache",
    });
    return resp.ok;
}

// ── modal ────────────────────────────────────────────────────────────────────
function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
        #${OVERLAY_ID} .dp-controls { display:flex; flex-wrap:wrap; gap:18px; align-items:center; margin-bottom:14px; }
        #${OVERLAY_ID} .dp-scope { display:inline-flex; border:1px solid rgba(255,255,255,0.2); border-radius:6px; overflow:hidden; }
        #${OVERLAY_ID} .dp-scope button { background:transparent; color:inherit; border:0; padding:6px 12px; cursor:pointer; font:inherit; letter-spacing:1px; }
        #${OVERLAY_ID} .dp-scope button.active { background:rgba(255,80,160,0.35); }
        #${OVERLAY_ID} .dp-frame-ctl { display:inline-flex; align-items:center; gap:8px; font-size:12px; letter-spacing:1px; }
        #${OVERLAY_ID} .dp-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(120px, 1fr)); gap:14px; }
        #${OVERLAY_ID} .dp-cell { position:relative; border:1px solid rgba(255,255,255,0.14); border-radius:8px; padding:8px; cursor:pointer; user-select:none; }
        #${OVERLAY_ID} .dp-cell.disabled { opacity:0.4; cursor:not-allowed; }
        #${OVERLAY_ID} .dp-cell.checked { border-color:rgba(255,80,160,0.8); box-shadow:0 0 0 1px rgba(255,80,160,0.6) inset; }
        #${OVERLAY_ID} .dp-thumb { width:100%; aspect-ratio:220/750; background:rgba(0,0,0,0.25); border-radius:4px; display:block; object-fit:contain; }
        #${OVERLAY_ID} .dp-thumb canvas { width:100%; height:100%; object-fit:contain; }
        #${OVERLAY_ID} .dp-name { margin-top:6px; font-size:12px; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        #${OVERLAY_ID} .dp-badge { position:absolute; top:6px; right:6px; font-size:9px; letter-spacing:1px; padding:2px 5px; border-radius:4px; background:rgba(255,80,160,0.85); color:#1a0010; font-weight:700; }
        #${OVERLAY_ID} .dp-tick { position:absolute; top:6px; left:6px; width:16px; height:16px; }
        #${OVERLAY_ID} .dp-status { font-size:11px; text-align:center; min-height:14px; margin-top:4px; opacity:0.8; }
        #${OVERLAY_ID} .dp-footer { display:flex; align-items:center; gap:14px; margin-top:16px; }
        #${OVERLAY_ID} .dp-footer .dp-progress { font-size:12px; opacity:0.85; }
    `;
    document.head.appendChild(style);
}

function ensureOverlay() {
    let overlay = document.getElementById(OVERLAY_ID);
    if (overlay) return overlay;
    ensureStyle();

    overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.className = "monopad-vfx-overlay monopad-death-portrait-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
        <div class="monopad-vfx-window" role="dialog" aria-modal="true" aria-labelledby="monopad-death-portrait-title">
            <div class="monopad-vfx-header">
                <div>
                    <div class="monopad-vfx-title" id="monopad-death-portrait-title">DEATH PORTRAIT GENERATOR</div>
                    <div class="monopad-vfx-subtitle">BUILD death-portrait.png FROM NEUTRAL SPRITES</div>
                </div>
                <div class="monopad-vfx-header-controls">
                    <button id="monopad-death-portrait-close" class="monopad-vfx-close" type="button" aria-label="Close death portrait generator">✕</button>
                </div>
            </div>
            <div class="monopad-vfx-body">
                <div class="monopad-vfx-note">Generates the framed <code>death-portrait.png</code> for each selected character from their <code>neutral</code> sprite — the portrait sits in the stand's frame with the pink X over it. Characters that already have one are tagged <strong>EXISTS</strong> and start unchecked — tick them to overwrite.</div>
                <div class="dp-controls">
                    <div class="dp-scope" role="group" aria-label="Scope">
                        <button type="button" data-scope="current" class="active">CURRENT CHAT</button>
                        <button type="button" data-scope="pick">PICK FROM LIST</button>
                        <button type="button" data-scope="all">ALL WITH SPRITES</button>
                    </div>
                    <label class="dp-frame-ctl">FRAMING
                        <input id="monopad-death-portrait-frac" type="range" min="${FRAC_MIN}" max="${FRAC_MAX}" step="0.01" value="${DEFAULT_FRAC}" />
                    </label>
                </div>
                <div id="monopad-death-portrait-grid" class="dp-grid"></div>
                <div class="dp-footer">
                    <button id="monopad-death-portrait-generate" class="settings-small-button" type="button">GENERATE SELECTED</button>
                    <span id="monopad-death-portrait-progress" class="dp-progress"></span>
                </div>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    return overlay;
}

function setProgress(msg) {
    const el = document.getElementById("monopad-death-portrait-progress");
    if (el) el.textContent = msg || "";
}

// Build state.items for the active scope, then render the grid + previews.
async function rebuildItems() {
    const all = getTargetList();
    let list = all;
    if (state.scope === "current") {
        const names = getCurrentChatNames();
        // The player is always a participant of the current chat, so keep them
        // regardless of the chat-member name match used for NPCs.
        list = all.filter(c => c.isPlayer || names.has(c.name));
    }
    // 'pick' and 'all' both show every character; 'pick' just relies on manual
    // ticking (nothing is auto-checked), 'all' auto-checks the missing ones.

    state.items = await Promise.all(list.map(async (c) => {
        const exists = await deathPortraitExists(c.folder);
        return {
            name: c.name,
            folder: c.folder,
            isPlayer: !!c.isPlayer,
            exists,
            neutralUrl: undefined,   // resolved lazily during preview
            img: null,
            checked: state.scope === "pick" ? false : !exists,
            status: "",
        };
    }));
    renderGrid();
    renderPreviews();
}

function renderGrid() {
    const grid = document.getElementById("monopad-death-portrait-grid");
    if (!grid) return;
    if (!state.items.length) {
        grid.innerHTML = `<div class="monopad-sprite-placeholder">No characters found for this scope.</div>`;
        return;
    }
    grid.innerHTML = state.items.map((it, i) => `
        <div class="dp-cell${it.checked ? " checked" : ""}" data-idx="${i}">
            <input class="dp-tick" type="checkbox" data-idx="${i}" ${it.checked ? "checked" : ""} />
            ${it.exists ? `<span class="dp-badge">EXISTS</span>` : ""}
            <div class="dp-thumb" data-thumb="${i}"></div>
            <div class="dp-name" title="${escapeAttr(it.name)}">${escapeText(it.name)}</div>
            <div class="dp-status" data-status="${i}"></div>
        </div>`).join("");
}

// Resolve one character's neutral sprite and render its preview canvas.
async function renderOnePreview(i) {
    const it = state.items[i];
    const thumb = document.querySelector(`[data-thumb="${i}"]`);
    const statusEl = document.querySelector(`[data-status="${i}"]`);
    if (!it || !thumb) return;
    try {
        if (it.neutralUrl === undefined) it.neutralUrl = await resolveNeutralUrl(it.folder);
        if (!it.neutralUrl) {
            setCellDisabled(i, "no neutral sprite");
            return;
        }
        if (!it.img) it.img = await loadImage(it.neutralUrl);
        const canvas = await renderDeathPortraitCanvas(it.img, state.frac);
        thumb.innerHTML = "";
        thumb.appendChild(canvas);
        if (statusEl) statusEl.textContent = it.status || "";
    } catch (err) {
        console.warn("[Dangan][DeathPortrait] preview failed for", it.name, err);
        setCellDisabled(i, "preview failed");
    }
}

// Render every preview in parallel so one slow/stuck sprite can't block the rest.
async function renderPreviews() {
    await Promise.all(state.items.map((_, i) => renderOnePreview(i)));
}

function setCellDisabled(i, reason) {
    const it = state.items[i];
    if (it) { it.checked = false; it.disabled = true; }
    const cell = document.querySelector(`.dp-cell[data-idx="${i}"]`);
    const tick = document.querySelector(`.dp-tick[data-idx="${i}"]`);
    const statusEl = document.querySelector(`[data-status="${i}"]`);
    if (cell) cell.classList.add("disabled");
    if (tick) { tick.checked = false; tick.disabled = true; }
    if (statusEl) statusEl.textContent = reason;
}

// Re-render previews only (after the framing slider moves) without re-probing.
async function rerenderPreviewsForFrac() {
    for (let i = 0; i < state.items.length; i++) {
        const it = state.items[i];
        if (!it.img || it.disabled) continue;
        const thumb = document.querySelector(`[data-thumb="${i}"]`);
        if (!thumb) continue;
        const canvas = await renderDeathPortraitCanvas(it.img, state.frac);
        thumb.innerHTML = "";
        thumb.appendChild(canvas);
    }
}

async function generateSelected() {
    if (state.generating) return;
    const targets = state.items.filter(it => it.checked && !it.disabled && it.img);
    if (!targets.length) { toast("info", "No characters selected."); return; }

    state.generating = true;
    const genBtn = document.getElementById("monopad-death-portrait-generate");
    if (genBtn) genBtn.disabled = true;

    let ok = 0, fail = 0;
    for (let n = 0; n < targets.length; n++) {
        const it = targets[n];
        setProgress(`Generating ${n + 1}/${targets.length}: ${it.name}…`);
        const statusEl = document.querySelector(`[data-status="${state.items.indexOf(it)}"]`);
        try {
            const canvas = await renderDeathPortraitCanvas(it.img, state.frac);
            const blob = await canvasToBlob(canvas);
            const uploaded = await uploadDeathPortrait(it.folder, blob);
            if (uploaded) {
                ok++; it.exists = true;
                if (statusEl) statusEl.textContent = "saved ✓";
            } else {
                fail++;
                if (statusEl) statusEl.textContent = "upload failed";
            }
        } catch (err) {
            fail++;
            console.warn("[Dangan][DeathPortrait] generate failed for", it.name, err);
            if (statusEl) statusEl.textContent = "error";
        }
    }

    setProgress(`Done — ${ok} saved${fail ? `, ${fail} failed` : ""}.`);
    toast(fail ? "warning" : "success", `Death portraits: ${ok} saved${fail ? `, ${fail} failed` : ""}.`);
    state.generating = false;
    if (genBtn) genBtn.disabled = false;
}

async function openModal() {
    const overlay = ensureOverlay();
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    setProgress("");
    const grid = document.getElementById("monopad-death-portrait-grid");
    if (grid) grid.innerHTML = `<div class="monopad-sprite-placeholder">Loading characters…</div>`;
    await rebuildItems();
}

function closeModal() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
        overlay.classList.remove("open");
        overlay.setAttribute("aria-hidden", "true");
    }
}

// ── event wiring ─────────────────────────────────────────────────────────────
export function initDeathPortraitGenerator({ getPlayerTarget: playerTargetResolver = null } = {}) {
    getPlayerTarget = typeof playerTargetResolver === "function" ? playerTargetResolver : null;

    const onClick = (e) => {
        if (e.target.closest("#dangan_generate_death_portraits")) { openModal(); return; }

        const overlay = document.getElementById(OVERLAY_ID);
        if (!overlay || !overlay.classList.contains("open")) return;

        if (e.target.closest("#monopad-death-portrait-close")) { closeModal(); return; }
        if (e.target === overlay) { closeModal(); return; }

        const scopeBtn = e.target.closest(".dp-scope button");
        if (scopeBtn) {
            state.scope = scopeBtn.dataset.scope;
            overlay.querySelectorAll(".dp-scope button").forEach(b => b.classList.toggle("active", b === scopeBtn));
            rebuildItems();
            return;
        }

        if (e.target.closest("#monopad-death-portrait-generate")) { generateSelected(); return; }

        // Toggle a cell via its checkbox or by clicking the cell body.
        const tick = e.target.closest(".dp-tick");
        if (tick) {
            const i = Number(tick.dataset.idx);
            const it = state.items[i];
            if (it && !it.disabled) {
                it.checked = tick.checked;
                document.querySelector(`.dp-cell[data-idx="${i}"]`)?.classList.toggle("checked", it.checked);
            }
            return;
        }
        const cell = e.target.closest(".dp-cell");
        if (cell && !cell.classList.contains("disabled")) {
            const i = Number(cell.dataset.idx);
            const it = state.items[i];
            if (it) {
                it.checked = !it.checked;
                cell.classList.toggle("checked", it.checked);
                const cb = cell.querySelector(".dp-tick");
                if (cb) cb.checked = it.checked;
            }
        }
    };

    let fracTimer = null;
    const onInput = (e) => {
        const slider = e.target.closest?.("#monopad-death-portrait-frac");
        if (!slider) return;
        state.frac = Number(slider.value) || DEFAULT_FRAC;
        clearTimeout(fracTimer);
        fracTimer = setTimeout(() => rerenderPreviewsForFrac(), 120);
    };

    document.addEventListener("click", onClick);
    document.addEventListener("input", onInput);

    return function cleanup() {
        document.removeEventListener("click", onClick);
        document.removeEventListener("input", onInput);
    };
}
