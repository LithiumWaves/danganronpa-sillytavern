import { getRequestHeaders } from "../../../../../script.js";

// Mugshot generator — builds `/characters/<folder>/mugshot.png` for characters
// from their `neutral` sprite, using the trial-card template. The template was
// converted from assets/templates/mugshot-template.xcf into three web PNGs by
// tools/extract-mugshot-template.mjs (run once at build time); here we just
// composite them with the browser <canvas> — no plugins, no libraries.
//
// Composite (per character): background speckle → cropped neutral sprite →
// faint texture overlay → clip to the angled card window (destination-in mask).
// The crop is bbox-relative (top fraction of the sprite's opaque bounds) so it
// frames head→waist regardless of how tall the character's sprite is.
//
// Mirrors vfx/spriteManager.js: self-contained, same /api/sprites usage, same
// modal chrome (monopad-vfx-* classes), exports a single init function.

const OVERLAY_ID = "monopad-mugshot-overlay";
const STYLE_ID = "monopad-mugshot-style";

const FRAME_W = 280;
const FRAME_H = 404;
const TEX_OFF_X = -1;          // texture-overlay layer offset in the template
const TEX_OFF_Y = -1;
const DEFAULT_FRAC = 0.52;     // fraction of figure height shown (head→waist)
const FRAC_MIN = 0.40;
const FRAC_MAX = 0.70;

// Template assets resolved relative to this module, so the generator works
// regardless of where the extension folder is mounted.
const TPL = {
    bg: new URL("../assets/templates/mugshot-bg.png", import.meta.url).href,
    texture: new URL("../assets/templates/mugshot-texture.png", import.meta.url).href,
    mask: new URL("../assets/templates/mugshot-mask.png", import.meta.url).href,
};

const state = {
    scope: "current",          // 'current' | 'all' | 'pick'  (pick = all, manual ticks)
    frac: DEFAULT_FRAC,
    items: [],                 // [{ name, folder, neutralUrl, img, exists, checked, status }]
    generating: false,
};

let _templates = null;         // cached { bg, texture, mask } HTMLImageElements
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

async function loadTemplates() {
    if (_templates) return _templates;
    const [bg, texture, mask] = await Promise.all([loadImage(TPL.bg), loadImage(TPL.texture), loadImage(TPL.mask)]);
    _templates = { bg, texture, mask };
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

// Does /characters/<folder>/mugshot.png already exist? (Same probe trialManager
// uses to decide whether to show a mugshot or fall back to the neutral sprite.)
function mugshotExists(folder) {
    return new Promise(resolve => {
        const probe = new Image();
        probe.onload = () => resolve(true);
        probe.onerror = () => resolve(false);
        probe.src = `/characters/${encodeURIComponent(folder)}/mugshot.png?_=${Date.now()}`;
    });
}

// Opaque bounding box (alpha > 16) of a sprite image.
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

// Composite a 280×404 mugshot canvas from a neutral sprite Image.
async function renderMugshotCanvas(spriteImg, frac) {
    const { bg, texture, mask } = await loadTemplates();
    const box = detectBBox(spriteImg);

    // Show the top `frac` of the figure (head→waist), framed to the card aspect
    // and horizontally centred on the figure.
    const cropH = box.h * frac;
    const cropW = cropH * (FRAME_W / FRAME_H);
    const cropX = (box.x + box.w / 2) - cropW / 2;
    const cropY = box.y;

    const canvas = document.createElement("canvas");
    canvas.width = FRAME_W;
    canvas.height = FRAME_H;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";

    ctx.drawImage(bg, 0, 0, FRAME_W, FRAME_H);
    ctx.drawImage(spriteImg, cropX, cropY, cropW, cropH, 0, 0, FRAME_W, FRAME_H);
    ctx.drawImage(texture, TEX_OFF_X, TEX_OFF_Y);
    // Clip everything drawn so far to the angled card window.
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(mask, 0, 0, FRAME_W, FRAME_H);
    ctx.globalCompositeOperation = "source-over";

    return canvas;
}

function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("toBlob returned null")), "image/png");
    });
}

// Upload a generated mugshot as <folder>/mugshot.png (same shape as
// spriteManager.uploadSprite — label/spriteName "mugshot", field "avatar").
async function uploadMugshot(folder, blob) {
    const fd = new FormData();
    fd.append("name", folder);
    fd.append("label", "mugshot");
    fd.append("avatar", new File([blob], "mugshot.png", { type: "image/png" }));
    fd.append("spriteName", "mugshot");
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
        #${OVERLAY_ID} .mugshot-controls { display:flex; flex-wrap:wrap; gap:18px; align-items:center; margin-bottom:14px; }
        #${OVERLAY_ID} .mugshot-scope { display:inline-flex; border:1px solid rgba(255,255,255,0.2); border-radius:6px; overflow:hidden; }
        #${OVERLAY_ID} .mugshot-scope button { background:transparent; color:inherit; border:0; padding:6px 12px; cursor:pointer; font:inherit; letter-spacing:1px; }
        #${OVERLAY_ID} .mugshot-scope button.active { background:rgba(120,180,255,0.35); }
        #${OVERLAY_ID} .mugshot-frame-ctl { display:inline-flex; align-items:center; gap:8px; font-size:12px; letter-spacing:1px; }
        #${OVERLAY_ID} .mugshot-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(120px, 1fr)); gap:14px; }
        #${OVERLAY_ID} .mugshot-cell { position:relative; border:1px solid rgba(255,255,255,0.14); border-radius:8px; padding:8px; cursor:pointer; user-select:none; }
        #${OVERLAY_ID} .mugshot-cell.disabled { opacity:0.4; cursor:not-allowed; }
        #${OVERLAY_ID} .mugshot-cell.checked { border-color:rgba(120,180,255,0.8); box-shadow:0 0 0 1px rgba(120,180,255,0.6) inset; }
        #${OVERLAY_ID} .mugshot-thumb { width:100%; aspect-ratio:280/404; background:rgba(0,0,0,0.25); border-radius:4px; display:block; object-fit:contain; }
        #${OVERLAY_ID} .mugshot-thumb canvas { width:100%; height:100%; object-fit:contain; }
        #${OVERLAY_ID} .mugshot-name { margin-top:6px; font-size:12px; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        #${OVERLAY_ID} .mugshot-badge { position:absolute; top:6px; right:6px; font-size:9px; letter-spacing:1px; padding:2px 5px; border-radius:4px; background:rgba(255,170,40,0.85); color:#1a1200; font-weight:700; }
        #${OVERLAY_ID} .mugshot-tick { position:absolute; top:6px; left:6px; width:16px; height:16px; }
        #${OVERLAY_ID} .mugshot-status { font-size:11px; text-align:center; min-height:14px; margin-top:4px; opacity:0.8; }
        #${OVERLAY_ID} .mugshot-footer { display:flex; align-items:center; gap:14px; margin-top:16px; }
        #${OVERLAY_ID} .mugshot-footer .mugshot-progress { font-size:12px; opacity:0.85; }
    `;
    document.head.appendChild(style);
}

function ensureOverlay() {
    let overlay = document.getElementById(OVERLAY_ID);
    if (overlay) return overlay;
    ensureStyle();

    overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.className = "monopad-vfx-overlay monopad-mugshot-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
        <div class="monopad-vfx-window" role="dialog" aria-modal="true" aria-labelledby="monopad-mugshot-title">
            <div class="monopad-vfx-header">
                <div>
                    <div class="monopad-vfx-title" id="monopad-mugshot-title">MUGSHOT GENERATOR</div>
                    <div class="monopad-vfx-subtitle">BUILD mugshot.png FROM NEUTRAL SPRITES</div>
                </div>
                <div class="monopad-vfx-header-controls">
                    <button id="monopad-mugshot-close" class="monopad-vfx-close" type="button" aria-label="Close mugshot generator">✕</button>
                </div>
            </div>
            <div class="monopad-vfx-body">
                <div class="monopad-vfx-note">Generates the angled trial-card <code>mugshot.png</code> for each selected character from their <code>neutral</code> sprite. Characters that already have a mugshot are tagged <strong>EXISTS</strong> and start unchecked — tick them to overwrite.</div>
                <div class="mugshot-controls">
                    <div class="mugshot-scope" role="group" aria-label="Scope">
                        <button type="button" data-scope="current" class="active">CURRENT CHAT</button>
                        <button type="button" data-scope="pick">PICK FROM LIST</button>
                        <button type="button" data-scope="all">ALL WITH SPRITES</button>
                    </div>
                    <label class="mugshot-frame-ctl">FRAMING
                        <input id="monopad-mugshot-frac" type="range" min="${FRAC_MIN}" max="${FRAC_MAX}" step="0.01" value="${DEFAULT_FRAC}" />
                    </label>
                </div>
                <div id="monopad-mugshot-grid" class="mugshot-grid"></div>
                <div class="mugshot-footer">
                    <button id="monopad-mugshot-generate" class="settings-small-button" type="button">GENERATE SELECTED</button>
                    <span id="monopad-mugshot-progress" class="mugshot-progress"></span>
                </div>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    return overlay;
}

function setProgress(msg) {
    const el = document.getElementById("monopad-mugshot-progress");
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

    // Probe existence in parallel; default-check missing mugshots only.
    state.items = await Promise.all(list.map(async (c) => {
        const exists = await mugshotExists(c.folder);
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
    const grid = document.getElementById("monopad-mugshot-grid");
    if (!grid) return;
    if (!state.items.length) {
        grid.innerHTML = `<div class="monopad-sprite-placeholder">No characters found for this scope.</div>`;
        return;
    }
    grid.innerHTML = state.items.map((it, i) => `
        <div class="mugshot-cell${it.checked ? " checked" : ""}" data-idx="${i}">
            <input class="mugshot-tick" type="checkbox" data-idx="${i}" ${it.checked ? "checked" : ""} />
            ${it.exists ? `<span class="mugshot-badge">EXISTS</span>` : ""}
            <div class="mugshot-thumb" data-thumb="${i}"></div>
            <div class="mugshot-name" title="${escapeAttr(it.name)}">${escapeText(it.name)}</div>
            <div class="mugshot-status" data-status="${i}"></div>
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
        const canvas = await renderMugshotCanvas(it.img, state.frac);
        thumb.innerHTML = "";
        thumb.appendChild(canvas);
        if (statusEl) statusEl.textContent = it.status || "";
    } catch (err) {
        console.warn("[Dangan][Mugshot] preview failed for", it.name, err);
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
    const cell = document.querySelector(`.mugshot-cell[data-idx="${i}"]`);
    const tick = document.querySelector(`.mugshot-tick[data-idx="${i}"]`);
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
        const canvas = await renderMugshotCanvas(it.img, state.frac);
        thumb.innerHTML = "";
        thumb.appendChild(canvas);
    }
}

async function generateSelected() {
    if (state.generating) return;
    const targets = state.items.filter(it => it.checked && !it.disabled && it.img);
    if (!targets.length) { toast("info", "No characters selected."); return; }

    state.generating = true;
    const genBtn = document.getElementById("monopad-mugshot-generate");
    if (genBtn) genBtn.disabled = true;

    let ok = 0, fail = 0;
    for (let n = 0; n < targets.length; n++) {
        const it = targets[n];
        setProgress(`Generating ${n + 1}/${targets.length}: ${it.name}…`);
        const statusEl = document.querySelector(`[data-status="${state.items.indexOf(it)}"]`);
        try {
            const canvas = await renderMugshotCanvas(it.img, state.frac);
            const blob = await canvasToBlob(canvas);
            const uploaded = await uploadMugshot(it.folder, blob);
            if (uploaded) {
                ok++; it.exists = true;
                if (statusEl) statusEl.textContent = "saved ✓";
            } else {
                fail++;
                if (statusEl) statusEl.textContent = "upload failed";
            }
        } catch (err) {
            fail++;
            console.warn("[Dangan][Mugshot] generate failed for", it.name, err);
            if (statusEl) statusEl.textContent = "error";
        }
    }

    setProgress(`Done — ${ok} saved${fail ? `, ${fail} failed` : ""}.`);
    toast(fail ? "warning" : "success", `Mugshots: ${ok} saved${fail ? `, ${fail} failed` : ""}.`);
    state.generating = false;
    if (genBtn) genBtn.disabled = false;
}

async function openModal() {
    const overlay = ensureOverlay();
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    setProgress("");
    const grid = document.getElementById("monopad-mugshot-grid");
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
export function initMugshotGenerator({ getPlayerTarget: playerTargetResolver = null } = {}) {
    getPlayerTarget = typeof playerTargetResolver === "function" ? playerTargetResolver : null;

    const onClick = (e) => {
        if (e.target.closest("#dangan_generate_mugshots")) { openModal(); return; }

        const overlay = document.getElementById(OVERLAY_ID);
        if (!overlay || !overlay.classList.contains("open")) return;

        if (e.target.closest("#monopad-mugshot-close")) { closeModal(); return; }
        if (e.target === overlay) { closeModal(); return; }

        const scopeBtn = e.target.closest(".mugshot-scope button");
        if (scopeBtn) {
            state.scope = scopeBtn.dataset.scope;
            overlay.querySelectorAll(".mugshot-scope button").forEach(b => b.classList.toggle("active", b === scopeBtn));
            rebuildItems();
            return;
        }

        if (e.target.closest("#monopad-mugshot-generate")) { generateSelected(); return; }

        // Toggle a cell via its checkbox or by clicking the cell body.
        const tick = e.target.closest(".mugshot-tick");
        if (tick) {
            const i = Number(tick.dataset.idx);
            const it = state.items[i];
            if (it && !it.disabled) {
                it.checked = tick.checked;
                document.querySelector(`.mugshot-cell[data-idx="${i}"]`)?.classList.toggle("checked", it.checked);
            }
            return;
        }
        const cell = e.target.closest(".mugshot-cell");
        if (cell && !cell.classList.contains("disabled")) {
            const i = Number(cell.dataset.idx);
            const it = state.items[i];
            if (it) {
                it.checked = !it.checked;
                cell.classList.toggle("checked", it.checked);
                const cb = cell.querySelector(".mugshot-tick");
                if (cb) cb.checked = it.checked;
            }
        }
    };

    let fracTimer = null;
    const onInput = (e) => {
        const slider = e.target.closest?.("#monopad-mugshot-frac");
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
