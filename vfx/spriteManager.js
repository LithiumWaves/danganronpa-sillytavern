import { getRequestHeaders } from "../../../../../script.js";

// Emotion Sprite Manager
// ----------------------
// A modal (opened from Settings → FX → "EMOTION SPRITES") that lets the user
// view and manage a character's expression sprites. For every managed emotion
// the user sees the current sprite (or an empty upload slot) and can:
//   • click an empty slot to upload that emotion's sprite — saved verbatim as
//     `<emotion>.<ext>` (original file extension preserved), e.g. `love.png`.
//   • press ＋ to add a secondary "outfit variant" sprite, then rename it to
//     `<prefix>-<emotion>` (e.g. `pool-love`) so the location-based outfit
//     locking system (see getActiveOutfitPrefix / pickForcedOutfitSprite in
//     index.js) can swap to it when a Location Pin forces that outfit.
//
// All sprite reads/writes go through SillyTavern's built-in sprite endpoints
// (/api/sprites/get, /api/sprites/upload, /api/sprites/delete) — nothing is
// stored in extension settings; the files on disk are the single source.

// Same canonical emotion list as VFX_MAP / emotionFontsSystem — keep in sync.
// `neutral` is prepended because it's the base pose and the most-used outfit
// variant (e.g. `pool-neutral`), so it must be manageable here too.
const EMOTIONS = [
    "realization", "surprise", "fear", "anger", "joy", "excitement",
    "sadness", "grief", "nervousness", "disgust", "embarrassment", "love",
];
const MANAGED = ["neutral", ...EMOTIONS];

const OVERLAY_ID = "monopad-sprite-overlay";
const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/apng,.png,.jpg,.jpeg,.webp,.gif,.apng";

let currentFolder = null;  // sprite folder used by /api/sprites (avatar minus ext, or name)
let currentName = null;    // human-readable character name shown in the picker
let currentSprites = [];   // last fetched sprite list for the selected character
let busy = false;          // guards against overlapping uploads/deletes

// ── Small helpers ─────────────────────────────────────────────────────────────

function escapeAttr(s) { return String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;"); }
function escapeText(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Filename stem (no dir, no query, no extension). Mirrors spriteFileStem() in
// index.js — ST's /api/sprites/get collapses the `label` at the first dash, so
// the real filename is the only reliable identifier for prefixed variants.
function stemOf(sprite) {
    const base = String(sprite?.path || "").split("/").pop().split("?")[0];
    return base.replace(/\.[a-z0-9]+$/i, "");
}

function extFromPath(p) {
    const m = String(p || "").split("?")[0].match(/\.[a-z0-9]+$/i);
    return m ? m[0] : "";
}

// Sanitise a user-typed variant name to a safe filename stem and guarantee it
// ends with `-<emotion>` so the outfit system (which matches `<prefix><emotion>`)
// can find it. Typing just the outfit ("pool") yields "pool-love"; typing the
// full "pool-love" is left intact.
function normaliseVariantStem(raw, emotion) {
    let stem = String(raw ?? "").trim()
        .replace(/\.[a-z0-9]+$/i, "")          // drop any extension they typed
        .replace(/[^a-zA-Z0-9_-]+/g, "-")      // illegal chars → dash
        .replace(/-+/g, "-")                    // collapse repeats
        .replace(/^-+/, "")                     // no leading dash
        .toLowerCase();
    const suffix = "-" + emotion.toLowerCase();
    if (!stem.endsWith(suffix)) {
        stem = stem.replace(/-+$/, "");         // trim trailing dash before appending
        stem = stem + suffix;
    }
    return stem;
}

function notifyError(msg) {
    if (typeof window.toastr?.error === "function") window.toastr.error(msg);
    else console.warn("[Dangan][SpriteManager]", msg);
}

// ── Character list ────────────────────────────────────────────────────────────

// Resolve the sprite folder the same way getSpriteUrl() does: the avatar
// filename without its extension, falling back to the character name.
function getCharacterList() {
    // Prefer the live SillyTavern context (reliably populated); fall back to the
    // `window.characters` global only if the context isn't available yet.
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

function getActiveCharacterName() {
    try {
        const ctx = window.SillyTavern?.getContext?.();
        const id = ctx?.characterId;
        if (id === undefined || id === null) return null;
        return ctx?.characters?.[id]?.name ?? null;
    } catch { return null; }
}

// ── Sprite API ────────────────────────────────────────────────────────────────

async function fetchSprites(folder) {
    if (!folder) return [];
    try {
        const resp = await fetch(`/api/sprites/get?name=${encodeURIComponent(folder)}`);
        if (!resp.ok) return [];
        const data = await resp.json();
        return Array.isArray(data) ? data : [];
    } catch (err) {
        console.warn("[Dangan][SpriteManager] Failed to list sprites:", err);
        return [];
    }
}

async function uploadSprite(folder, emotion, spriteName, file) {
    const fd = new FormData();
    fd.append("name", folder);          // character sprite folder
    fd.append("label", emotion);        // expression label (kept for ST metadata)
    fd.append("avatar", file);          // multer field MUST be `avatar`
    fd.append("spriteName", spriteName); // final filename stem (extension from file)
    try {
        const resp = await fetch("/api/sprites/upload", {
            method: "POST",
            headers: getRequestHeaders({ omitContentType: true }),
            body: fd,
            cache: "no-cache",
        });
        return resp.ok;
    } catch (err) {
        console.warn("[Dangan][SpriteManager] Upload failed:", err);
        return false;
    }
}

async function deleteSprite(folder, emotion, spriteName) {
    try {
        const resp = await fetch("/api/sprites/delete", {
            method: "POST",
            headers: getRequestHeaders(),
            body: JSON.stringify({ name: folder, label: emotion, spriteName }),
        });
        return resp.ok;
    } catch (err) {
        console.warn("[Dangan][SpriteManager] Delete failed:", err);
        return false;
    }
}

// Rename an existing sprite by re-uploading its bytes under a new stem and
// deleting the old file. ST has no rename endpoint, so we fetch the current
// image (its bytes are already on disk), re-upload as `newStem`, then remove
// `oldStem`. The original extension is preserved from the source path.
async function renameSprite(folder, emotion, oldStem, newStem, sourcePath) {
    if (newStem.toLowerCase() === oldStem.toLowerCase()) return true;
    const ext = extFromPath(sourcePath) || ".png";
    let file;
    try {
        const resp = await fetch(sourcePath, { cache: "no-cache" });
        if (!resp.ok) return false;
        const blob = await resp.blob();
        file = new File([blob], newStem + ext, { type: blob.type || "image/png" });
    } catch (err) {
        console.warn("[Dangan][SpriteManager] Could not read source sprite:", err);
        return false;
    }
    const ok = await uploadSprite(folder, emotion, newStem, file);
    if (ok) await deleteSprite(folder, emotion, oldStem);
    return ok;
}

// ── File picker ───────────────────────────────────────────────────────────────

function pickImageFile() {
    return new Promise(resolve => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = IMAGE_ACCEPT;
        input.style.display = "none";
        input.addEventListener("change", () => {
            const file = input.files?.[0] || null;
            input.remove();
            resolve(file);
        }, { once: true });
        document.body.appendChild(input);
        input.click();
    });
}

// ── Categorisation ────────────────────────────────────────────────────────────

// Split the character's sprites for one emotion into the primary (`<emotion>`)
// and any secondary outfit variants (`<prefix>-<emotion>`). `-half` crops are
// skipped — they're paired with their base and managed by the half-sprite
// pipeline, not here.
function spritesForEmotion(sprites, emotion) {
    const lc = emotion.toLowerCase();
    const suffix = "-" + lc;
    let primary = null;
    const secondary = [];
    for (const s of sprites) {
        const stem = stemOf(s);
        const stemLc = stem.toLowerCase();
        if (stemLc.endsWith("-half")) continue;
        if (stemLc === lc) primary = { ...s, stem };
        else if (stemLc.endsWith(suffix)) secondary.push({ ...s, stem });
    }
    secondary.sort((a, b) => a.stem.localeCompare(b.stem));
    return { primary, secondary };
}

// First free `outfit[-N]-<emotion>` stem so a freshly-added variant lands in the
// correct emotion row before the user renames it.
function defaultVariantStem(emotion) {
    const existing = new Set(currentSprites.map(s => stemOf(s).toLowerCase()));
    const base = "outfit";
    let candidate = `${base}-${emotion}`;
    let n = 2;
    while (existing.has(candidate.toLowerCase())) candidate = `${base}${n++}-${emotion}`;
    return candidate;
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function tileImage(sprite) {
    return `<img class="monopad-sprite-img" src="${escapeAttr(sprite.path)}" alt="${escapeAttr(sprite.stem)}" loading="lazy" />`;
}

function tileActions() {
    return `
        <div class="monopad-sprite-tile-actions">
            <button class="monopad-sprite-replace" type="button" title="Replace image">⟳</button>
            <button class="monopad-sprite-delete" type="button" title="Delete sprite">🗑</button>
        </div>`;
}

function renderPrimaryTile(emotion, primary) {
    if (primary) {
        return `
            <div class="monopad-sprite-tile filled" data-role="primary" data-emotion="${escapeAttr(emotion)}" data-stem="${escapeAttr(primary.stem)}">
                ${tileImage(primary)}
                ${tileActions()}
                <div class="monopad-sprite-tile-name">${escapeText(emotion)}</div>
            </div>`;
    }
    return `
        <div class="monopad-sprite-tile empty" data-role="primary" data-emotion="${escapeAttr(emotion)}" data-stem="${escapeAttr(emotion)}" title="Upload ${escapeAttr(emotion)} sprite">
            <div class="monopad-sprite-empty-inner"><span class="monopad-sprite-plus">＋</span><span>UPLOAD</span></div>
            <div class="monopad-sprite-tile-name">${escapeText(emotion)}</div>
        </div>`;
}

function renderSecondaryTile(emotion, variant) {
    return `
        <div class="monopad-sprite-tile filled secondary" data-role="secondary" data-emotion="${escapeAttr(emotion)}" data-stem="${escapeAttr(variant.stem)}">
            ${tileImage(variant)}
            ${tileActions()}
            <input class="monopad-sprite-name-input" type="text" spellcheck="false"
                   value="${escapeAttr(variant.stem)}" data-emotion="${escapeAttr(emotion)}" data-stem="${escapeAttr(variant.stem)}"
                   title="Rename this outfit variant (e.g. pool-${escapeAttr(emotion)})" />
        </div>`;
}

function renderGrid() {
    const grid = document.getElementById("monopad-sprite-grid");
    if (!grid) return;

    if (!currentFolder) {
        grid.innerHTML = `<div class="monopad-sprite-placeholder">Select a character to manage their sprites.</div>`;
        return;
    }

    const cells = MANAGED.map(emotion => {
        const { primary, secondary } = spritesForEmotion(currentSprites, emotion);
        const tiles = [renderPrimaryTile(emotion, primary), ...secondary.map(v => renderSecondaryTile(emotion, v))].join("");
        return `
            <div class="monopad-sprite-cell" data-emotion="${escapeAttr(emotion)}">
                <div class="monopad-sprite-cell-head">
                    <span class="monopad-sprite-emotion">${escapeText(emotion.toUpperCase())}</span>
                    <button class="monopad-sprite-add" type="button" data-emotion="${escapeAttr(emotion)}" title="Add outfit variant">＋</button>
                </div>
                <div class="monopad-sprite-tiles">${tiles}</div>
            </div>`;
    }).join("");

    grid.innerHTML = cells;
}

async function refreshSprites() {
    currentSprites = await fetchSprites(currentFolder);
    renderGrid();
}

function renderTargetSelect() {
    const sel = document.getElementById("monopad-sprite-target");
    if (!sel) return;
    const chars = getCharacterList();
    sel.innerHTML = `<option value="">— SELECT CHARACTER —</option>` +
        chars.map(c => `<option value="${escapeAttr(c.folder)}" data-name="${escapeAttr(c.name)}">${escapeText(c.name)}</option>`).join("");

    // Keep the current selection if still present, else preselect the active chat character.
    if (currentFolder && chars.some(c => c.folder === currentFolder)) {
        sel.value = currentFolder;
    } else {
        const active = getActiveCharacterName();
        const match = active ? chars.find(c => c.name === active) : null;
        if (match) {
            currentFolder = match.folder;
            currentName = match.name;
            sel.value = match.folder;
        } else {
            currentFolder = null;
            currentName = null;
            sel.value = "";
        }
    }
}

// ── Actions ───────────────────────────────────────────────────────────────────

async function withBusy(fn) {
    if (busy) return;
    busy = true;
    const overlay = document.getElementById(OVERLAY_ID);
    overlay?.classList.add("busy");
    try { await fn(); }
    finally {
        busy = false;
        overlay?.classList.remove("busy");
    }
}

async function uploadPrimary(emotion) {
    const file = await pickImageFile();
    if (!file) return;
    await withBusy(async () => {
        const ok = await uploadSprite(currentFolder, emotion, emotion, file);
        if (!ok) notifyError(`Failed to upload ${emotion} sprite.`);
        await refreshSprites();
    });
}

async function replaceSprite(emotion, stem) {
    const file = await pickImageFile();
    if (!file) return;
    await withBusy(async () => {
        // Re-uploading with the same spriteName overwrites the existing file
        // (the server removes any file whose stem matches first).
        const ok = await uploadSprite(currentFolder, emotion, stem, file);
        if (!ok) notifyError(`Failed to replace ${stem}.`);
        await refreshSprites();
    });
}

async function deleteSpriteAction(emotion, stem) {
    if (!window.confirm(`Delete sprite "${stem}"? This removes the image file.`)) return;
    await withBusy(async () => {
        const ok = await deleteSprite(currentFolder, emotion, stem);
        if (!ok) notifyError(`Failed to delete ${stem}.`);
        await refreshSprites();
    });
}

async function addSecondary(emotion) {
    const file = await pickImageFile();
    if (!file) return;
    await withBusy(async () => {
        const stem = defaultVariantStem(emotion);
        const ok = await uploadSprite(currentFolder, emotion, stem, file);
        if (!ok) { notifyError(`Failed to add ${emotion} variant.`); return; }
        await refreshSprites();
        // Focus the new variant's name input so the user can rename it straight away.
        const input = document.querySelector(
            `.monopad-sprite-name-input[data-stem="${CSS.escape(stem)}"]`
        );
        if (input) { input.focus(); input.select(); }
    });
}

async function renameSecondary(input) {
    const emotion = input.dataset.emotion;
    const oldStem = input.dataset.stem;
    const tile = input.closest(".monopad-sprite-tile");
    const sourcePath = tile?.querySelector(".monopad-sprite-img")?.getAttribute("src") || "";
    const newStem = normaliseVariantStem(input.value, emotion);

    if (!newStem || newStem === oldStem) {
        input.value = oldStem; // nothing to do / unchanged
        return;
    }
    if (currentSprites.some(s => stemOf(s).toLowerCase() === newStem.toLowerCase())) {
        notifyError(`A sprite named "${newStem}" already exists.`);
        input.value = oldStem;
        return;
    }
    await withBusy(async () => {
        const ok = await renameSprite(currentFolder, emotion, oldStem, newStem, sourcePath);
        if (!ok) { notifyError(`Failed to rename ${oldStem}.`); }
        await refreshSprites();
    });
}

// ── Overlay lifecycle ─────────────────────────────────────────────────────────

function ensureOverlay() {
    let overlay = document.getElementById(OVERLAY_ID);
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.className = "monopad-vfx-overlay monopad-sprite-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
        <div class="monopad-vfx-window monopad-sprite-window" role="dialog" aria-modal="true" aria-labelledby="monopad-sprite-title">
            <div class="monopad-vfx-header">
                <div>
                    <div class="monopad-vfx-title" id="monopad-sprite-title">EMOTION SPRITES</div>
                    <div class="monopad-vfx-subtitle">MANAGE CHARACTER EXPRESSION SPRITES</div>
                </div>
                <div class="monopad-vfx-header-controls">
                    <div class="monopad-sprite-target-row">
                        <span>CHARACTER</span>
                        <select id="monopad-sprite-target"></select>
                    </div>
                    <button id="monopad-sprite-close" class="monopad-vfx-close" type="button" aria-label="Close sprite manager">✕</button>
                </div>
            </div>
            <div class="monopad-vfx-body">
                <div class="monopad-vfx-note">Click an empty slot to upload that emotion's sprite (saved as <code>&lt;emotion&gt;.ext</code>, file type preserved). Press ＋ on an emotion to add an outfit variant, then rename it like <code>pool-love</code> — the <code>-&lt;emotion&gt;</code> suffix is kept so location-based outfit locking can find it.</div>
                <div id="monopad-sprite-grid" class="monopad-sprite-grid"></div>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    return overlay;
}

async function openModal() {
    const overlay = ensureOverlay();
    renderTargetSelect();
    await refreshSprites();
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
}

function closeModal() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
        overlay.classList.remove("open");
        overlay.setAttribute("aria-hidden", "true");
    }
}

// ── Event wiring ──────────────────────────────────────────────────────────────

export function initSpriteManager() {
    const onClick = (e) => {
        if (e.target.closest("#dangan_configure_sprites")) { openModal(); return; }

        const overlay = document.getElementById(OVERLAY_ID);
        if (!overlay || !overlay.classList.contains("open")) return;

        if (e.target.closest("#monopad-sprite-close")) { closeModal(); return; }
        if (e.target === overlay) { closeModal(); return; }
        if (busy) return;

        const addBtn = e.target.closest(".monopad-sprite-add");
        if (addBtn) { addSecondary(addBtn.dataset.emotion); return; }

        const tile = e.target.closest(".monopad-sprite-tile");
        if (!tile) return;
        const emotion = tile.dataset.emotion;
        const stem = tile.dataset.stem;

        if (e.target.closest(".monopad-sprite-replace")) { replaceSprite(emotion, stem); return; }
        if (e.target.closest(".monopad-sprite-delete")) { deleteSpriteAction(emotion, stem); return; }
        // Clicking an empty primary slot uploads that emotion's sprite.
        if (tile.classList.contains("empty")) { uploadPrimary(emotion); return; }
    };

    const onFocusOut = (e) => {
        const input = e.target.closest?.(".monopad-sprite-name-input");
        if (input) renameSecondary(input);
    };

    const onKeyDown = (e) => {
        if (e.key === "Enter" && e.target.classList?.contains("monopad-sprite-name-input")) {
            e.preventDefault();
            e.target.blur(); // triggers focusout → renameSecondary
        } else if (e.key === "Escape" && e.target.classList?.contains("monopad-sprite-name-input")) {
            e.target.value = e.target.dataset.stem; // cancel edit
            e.target.blur();
        }
    };

    const onChange = (e) => {
        const sel = e.target.closest?.("#monopad-sprite-target");
        if (!sel) return;
        currentFolder = sel.value || null;
        const opt = sel.selectedOptions?.[0];
        currentName = opt?.dataset?.name || null;
        refreshSprites();
    };

    document.addEventListener("click", onClick);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("change", onChange);

    return function cleanup() {
        document.removeEventListener("click", onClick);
        document.removeEventListener("focusout", onFocusOut);
        document.removeEventListener("keydown", onKeyDown);
        document.removeEventListener("change", onChange);
    };
}
