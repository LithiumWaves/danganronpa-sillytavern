import { extension_settings } from "../../../../extensions.js";
import { saveSettingsDebounced } from "../../../../../script.js";
import { extensionName, extensionFolderPath } from "../core/constants.js";

// Default font used by class trial statements (matches .sd-statement / .dangan-statement-single)
export const EMOTION_FONT_DEFAULT = '"Noto Sans JP", sans-serif';

const ALL_KEY  = "_all";
const FONTS_KEY = "_userFonts";

const FONT_DIR_REL  = "assets/fonts/emotion";
const FONT_MANIFEST = `${FONT_DIR_REL}/manifest.json`;

// Preset fonts loaded from assets/fonts/emotion/manifest.json. Populated on init.
let PRESET_FONTS = [];
let presetStyleEl = null;

// Same emotion list as VFX_MAP — keep in sync if VFX_MAP changes.
const EMOTIONS = [
    "realization", "surprise", "fear", "anger", "joy", "excitement",
    "sadness", "grief", "nervousness", "disgust", "embarrassment", "love",
];

const PREVIEW_TEXT  = "No, you're wrong!";
const UPLOAD_VALUE  = "__upload__";
const DEFAULT_VALUE = "__default__";

let currentTargetKey = ALL_KEY;
let dynamicFontStyleEl = null;  // injected <style> tag holding @font-face for uploaded fonts

// ── Storage ──────────────────────────────────────────────────────────────────

function getRoot() {
    const root = extension_settings[extensionName] ??= {};
    let store = root.emotionFonts;
    // Migrate the old flat shape ({ emotion: {...} }) → { _all: { emotion: {...} } }
    if (store && typeof store === "object" && !store[ALL_KEY] && !hasCharSubkeys(store)) {
        if (Object.keys(store).length > 0 && EMOTIONS.some(e => store[e])) {
            const migrated = {};
            for (const k of Object.keys(store)) {
                if (EMOTIONS.includes(k)) migrated[k] = store[k];
            }
            root.emotionFonts = { [ALL_KEY]: migrated };
            saveSettingsDebounced();
        }
    }
    root.emotionFonts ??= {};
    return root.emotionFonts;
}

function hasCharSubkeys(store) {
    return Object.values(store).some(v => {
        if (!v || typeof v !== "object") return false;
        const ks = Object.keys(v);
        return ks.length > 0 && ks.every(k => EMOTIONS.includes(k));
    });
}

function getUserFonts() {
    const root = getRoot();
    if (!Array.isArray(root[FONTS_KEY])) root[FONTS_KEY] = [];
    return root[FONTS_KEY];
}

function getBucket(targetKey) {
    const root = getRoot();
    root[targetKey] ??= {};
    return root[targetKey];
}

function setEmotion(targetKey, emotion, patch) {
    const bucket = getBucket(targetKey);
    bucket[emotion] = { ...(bucket[emotion] || {}), ...patch };
    saveSettingsDebounced();
}

// ── Font resolution ──────────────────────────────────────────────────────────

export function getEmotionFont(emotion, characterName = null) {
    if (!emotion) return EMOTION_FONT_DEFAULT;
    const root = getRoot();
    if (characterName) {
        const charEntry = root[characterName]?.[emotion];
        if (charEntry?.mode === "custom" && charEntry.fontFamily) return charEntry.fontFamily;
    }
    const globalEntry = root[ALL_KEY]?.[emotion];
    if (globalEntry?.mode === "custom" && globalEntry.fontFamily) return globalEntry.fontFamily;
    return EMOTION_FONT_DEFAULT;
}

// ── Preset font loading via manifest.json ────────────────────────────────────

function formatExtToCss(file) {
    const ext = file.split(".").pop().toLowerCase();
    return ext === "otf" ? "opentype"
         : ext === "ttf" ? "truetype"
         : ext === "woff" ? "woff"
         : ext === "woff2" ? "woff2"
         : "";
}

function familyNameFromFile(filename) {
    return filename.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

async function loadPresetManifest() {
    const url = `/${extensionFolderPath}/${FONT_MANIFEST}`;
    try {
        const resp = await fetch(url);
        if (!resp.ok) return [];
        const data = await resp.json();
        if (!Array.isArray(data?.fonts)) return [];
        return data.fonts
            .map(e => e && e.file ? { file: String(e.file), name: e.name || familyNameFromFile(e.file) } : null)
            .filter(Boolean);
    } catch (err) {
        console.warn("[EmotionFonts] Failed to load preset manifest:", err);
        return [];
    }
}

function ensurePresetStyleEl() {
    if (presetStyleEl) return presetStyleEl;
    presetStyleEl = document.createElement("style");
    presetStyleEl.id = "dangan-emofont-presets";
    document.head.appendChild(presetStyleEl);
    return presetStyleEl;
}

function registerPresetFontFaces(presets) {
    const el = ensurePresetStyleEl();
    el.textContent = presets.map(p => {
        const fmt = formatExtToCss(p.file);
        const src = `/${extensionFolderPath}/${FONT_DIR_REL}/${encodeURI(p.file)}`;
        const fmtPart = fmt ? ` format("${fmt}")` : "";
        return `@font-face { font-family: "${p.name.replace(/"/g, "")}"; src: url("${src}")${fmtPart}; font-display: swap; }`;
    }).join("\n");
}

async function refreshPresetFonts() {
    const detected = await loadPresetManifest();
    PRESET_FONTS = detected.map(p => ({
        name:   p.name,
        family: `"${p.name.replace(/"/g, "")}", sans-serif`,
    }));
    registerPresetFontFaces(detected);
}

// ── Dynamic @font-face for user-uploaded fonts ───────────────────────────────

function ensureDynamicStyleEl() {
    if (dynamicFontStyleEl) return dynamicFontStyleEl;
    dynamicFontStyleEl = document.createElement("style");
    dynamicFontStyleEl.id = "dangan-emofont-dynamic";
    document.head.appendChild(dynamicFontStyleEl);
    return dynamicFontStyleEl;
}

function rebuildDynamicFontFaces() {
    const el = ensureDynamicStyleEl();
    const userFonts = getUserFonts();
    el.textContent = userFonts.map(f => {
        const fam = f.family.replace(/^"+|"+$/g, "").replace(/", *sans-serif$/, "");
        return `@font-face { font-family: "${fam.replace(/"/g, "")}"; src: url("${f.dataUrl}"); font-display: swap; }`;
    }).join("\n");
}

async function uploadUserFont(file) {
    const dataUrl = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload  = () => resolve(fr.result);
        fr.onerror = () => reject(fr.error);
        fr.readAsDataURL(file);
    });
    const baseName = familyNameFromFile(file.name);
    let name = baseName;
    let i = 2;
    const userFonts = getUserFonts();
    while (userFonts.some(f => f.name === name)) name = `${baseName} (${i++})`;
    const family = `"${name.replace(/"/g, "")}", sans-serif`;
    userFonts.push({ name, family, dataUrl });
    saveSettingsDebounced();
    rebuildDynamicFontFaces();
    return { name, family };
}

function removeUserFont(name) {
    const root = getRoot();
    root[FONTS_KEY] = getUserFonts().filter(f => f.name !== name);
    saveSettingsDebounced();
    rebuildDynamicFontFaces();
}

// ── UI: target/character selector ────────────────────────────────────────────

function getCharacterList() {
    const ctx = window.SillyTavern?.getContext?.();
    const list = Array.isArray(ctx?.characters) ? ctx.characters : [];
    return list.map(c => c?.name).filter(Boolean);
}

function escapeAttr(s) { return String(s ?? "").replace(/"/g, "&quot;"); }
function escapeText(s) { return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function renderTargetSelect() {
    const sel = document.getElementById("monopad-emofont-target");
    if (!sel) return;
    const names = getCharacterList();
    sel.innerHTML = `<option value="${ALL_KEY}">ALL CHARACTERS</option>` +
        names.map(n => `<option value="${escapeAttr(n)}">${escapeText(n)}</option>`).join("");
    if (currentTargetKey !== ALL_KEY && !names.includes(currentTargetKey)) {
        currentTargetKey = ALL_KEY;
    }
    sel.value = currentTargetKey;
}

// ── UI: emotion rows ─────────────────────────────────────────────────────────

function allAvailableFonts() {
    return [...PRESET_FONTS, ...getUserFonts().map(f => ({ name: f.name, family: f.family, user: true }))];
}

function fontOptionsHtml(selectedValue) {
    const defaultSel = selectedValue === DEFAULT_VALUE ? " selected" : "";
    const defaultOpt = `<option value="${DEFAULT_VALUE}"${defaultSel}>Default</option>`;
    const fontOpts = allAvailableFonts().map(f => {
        const sel = f.family === selectedValue ? " selected" : "";
        const tag = f.user ? "★ " : "";
        return `<option value="${escapeAttr(f.family)}"${sel}>${escapeText(tag + f.name)}</option>`;
    }).join("");
    return `${defaultOpt}${fontOpts}<option value="${UPLOAD_VALUE}">＋ Upload custom font…</option>`;
}

function fallbackFontForRow(emotion) {
    if (currentTargetKey === ALL_KEY) return EMOTION_FONT_DEFAULT;
    const globalEntry = getRoot()[ALL_KEY]?.[emotion];
    if (globalEntry?.mode === "custom" && globalEntry.fontFamily) return globalEntry.fontFamily;
    return EMOTION_FONT_DEFAULT;
}

function renderGrid() {
    const grid = document.getElementById("monopad-emofont-grid");
    if (!grid) return;
    grid.innerHTML = "";
    const bucket = getBucket(currentTargetKey);

    for (const emotion of EMOTIONS) {
        const entry  = bucket[emotion] || {};
        const mode   = entry.mode === "custom" ? "custom" : "default";
        const family = entry.fontFamily ?? "";
        const selected = mode === "custom" && family ? family : DEFAULT_VALUE;

        const row = document.createElement("div");
        row.className = "monopad-emofont-row";
        row.dataset.emotion = emotion;
        row.innerHTML = `
            <div class="monopad-emofont-head">
                <span class="monopad-emofont-name">${emotion.toUpperCase()}</span>
                <select class="monopad-emofont-select" data-emotion="${emotion}">
                    ${fontOptionsHtml(selected)}
                </select>
            </div>
            <div class="monopad-emofont-preview" data-emotion="${emotion}">${escapeText(PREVIEW_TEXT)}</div>
        `;
        grid.appendChild(row);
        const display = mode === "custom" && family ? family : fallbackFontForRow(emotion);
        applyPreviewFont(row, display);
    }
}

function applyPreviewFont(row, fontFamily) {
    const preview = row.querySelector(".monopad-emofont-preview");
    if (preview) preview.style.fontFamily = fontFamily;
}

// ── Event handlers ───────────────────────────────────────────────────────────

function onTargetChange(e) {
    const sel = e.target.closest("#monopad-emofont-target");
    if (!sel) return;
    currentTargetKey = sel.value || ALL_KEY;
    renderGrid();
}

async function onFontSelectChange(e) {
    const sel = e.target.closest(".monopad-emofont-select");
    if (!sel) return;
    const emotion = sel.dataset.emotion;
    const row     = sel.closest(".monopad-emofont-row");

    if (sel.value === DEFAULT_VALUE) {
        setEmotion(currentTargetKey, emotion, { mode: "default" });
        if (row) applyPreviewFont(row, fallbackFontForRow(emotion));
        return;
    }

    if (sel.value === UPLOAD_VALUE) {
        const file = await pickFontFile();
        if (!file) {
            // User cancelled — revert the select to its persisted value.
            const entry = getBucket(currentTargetKey)[emotion] || {};
            sel.value = entry.mode === "custom" && entry.fontFamily ? entry.fontFamily : DEFAULT_VALUE;
            return;
        }
        try {
            const { family } = await uploadUserFont(file);
            refreshAllFontSelects(family, emotion);
            setEmotion(currentTargetKey, emotion, { mode: "custom", fontFamily: family });
            if (row) applyPreviewFont(row, family);
        } catch (err) {
            console.warn("[EmotionFonts] Upload failed:", err);
            alert("Failed to load font file.");
        }
        return;
    }

    setEmotion(currentTargetKey, emotion, { mode: "custom", fontFamily: sel.value });
    if (row) applyPreviewFont(row, sel.value);
}

function refreshAllFontSelects(newSelectionFamily = null, newSelectionEmotion = null) {
    document.querySelectorAll(".monopad-emofont-select").forEach(sel => {
        const emotion = sel.dataset.emotion;
        const entry   = getBucket(currentTargetKey)[emotion] || {};
        let selected;
        if (emotion === newSelectionEmotion && newSelectionFamily) {
            selected = newSelectionFamily;
        } else if (entry.mode === "custom" && entry.fontFamily) {
            selected = entry.fontFamily;
        } else {
            selected = DEFAULT_VALUE;
        }
        sel.innerHTML = fontOptionsHtml(selected);
        sel.value = selected;
    });
}

function pickFontFile() {
    return new Promise(resolve => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".otf,.ttf,.woff,.woff2,font/otf,font/ttf,font/woff,font/woff2,application/font-sfnt";
        input.style.display = "none";
        input.addEventListener("change", () => {
            const file = input.files?.[0] || null;
            document.body.removeChild(input);
            resolve(file);
        }, { once: true });
        // Resolve null if the dialog is dismissed without picking; we listen for focus return.
        const cancelTimer = setTimeout(() => {
            // No-op; dismissal can't be reliably detected. Leave the input attached briefly.
        }, 100);
        clearTimeout(cancelTimer);
        document.body.appendChild(input);
        input.click();
    });
}

// ── Modal open/close ─────────────────────────────────────────────────────────

async function openModal() {
    await refreshPresetFonts();
    rebuildDynamicFontFaces();
    renderTargetSelect();
    renderGrid();
    const overlay = document.getElementById("monopad-emofont-overlay");
    if (overlay) {
        overlay.classList.add("open");
        overlay.setAttribute("aria-hidden", "false");
    }
}

function closeModal() {
    const overlay = document.getElementById("monopad-emofont-overlay");
    if (overlay) {
        overlay.classList.remove("open");
        overlay.setAttribute("aria-hidden", "true");
    }
}

// ── Init ─────────────────────────────────────────────────────────────────────

export function initEmotionFontsSystem() {
    // Make user-uploaded fonts and detected presets available immediately at trial time
    // even before the modal is opened.
    rebuildDynamicFontFaces();
    void refreshPresetFonts();

    const handlers = {
        openClick: (e) => {
            if (e.target.closest("#dangan_configure_emotion_fonts")) openModal();
        },
        closeClick: (e) => {
            if (e.target.closest("#monopad-emofont-close")) closeModal();
        },
        overlayClick: (e) => {
            const overlay = document.getElementById("monopad-emofont-overlay");
            if (e.target === overlay) closeModal();
        },
        change: (e) => {
            if (e.target.matches("#monopad-emofont-target")) onTargetChange(e);
            else if (e.target.matches(".monopad-emofont-select")) onFontSelectChange(e);
        },
    };

    document.addEventListener("click", handlers.openClick);
    document.addEventListener("click", handlers.closeClick);
    document.addEventListener("click", handlers.overlayClick);
    document.addEventListener("change", handlers.change);

    return function cleanup() {
        document.removeEventListener("click", handlers.openClick);
        document.removeEventListener("click", handlers.closeClick);
        document.removeEventListener("click", handlers.overlayClick);
        document.removeEventListener("change", handlers.change);
    };
}
