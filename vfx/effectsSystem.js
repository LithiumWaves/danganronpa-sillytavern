// ── Group Chat Effects System ──────────────────────────────────────────────────
// A second emotion-triggered layer, parallel to Expressions, that applies
// transitions to both the GCP background overlay AND character sprites.
// Only active in group chat. SFX takes priority over Expressions SFX.

import { extension_settings } from "../../../../extensions.js";
import { saveSettingsDebounced, this_chid, eventSource, event_types } from "../../../../../script.js";
import { extensionName, extensionFolderPath } from "../core/constants.js";
import { suppressVfxSfxOnce, setOnEmotionTrigger, getAvailableSfxFiles } from "./vfxSystem.js";

const EFFECTS_SFX_BASE = `${extensionFolderPath}/assets/sfx/reactions/`;

// ── Map ───────────────────────────────────────────────────────────────────────

export const EFFECTS_MAP = {
    realization:   { css: 'dr-effect-realization',   duration:  800, defaultScope: 'speaker' },
    surprise:      { css: 'dr-effect-surprise',       duration:  900, defaultScope: 'all'     },
    fear:          { css: 'dr-effect-fear',           duration: 1200, defaultScope: 'all'     },
    anger:         { css: 'dr-effect-anger',          duration: 1000, defaultScope: 'speaker' },
    joy:           { css: 'dr-effect-joy',            duration: 1200, defaultScope: 'all'     },
    excitement:    { css: 'dr-effect-excitement',     duration:  700, defaultScope: 'speaker' },
    sadness:       { css: 'dr-effect-sadness',        duration: 1500, defaultScope: 'all'     },
    grief:         { css: 'dr-effect-grief',          duration: 1500, defaultScope: 'all'     },
    nervousness:   { css: 'dr-effect-nervousness',    duration:  900, defaultScope: 'speaker' },
    disgust:       { css: 'dr-effect-disgust',        duration:  800, defaultScope: 'speaker' },
    embarrassment: { css: 'dr-effect-embarrassment',  duration: 2000, defaultScope: 'speaker' },
    love:          { css: 'dr-effect-love',           duration: 1000, defaultScope: 'speaker' },
};

// ── Default CSS ───────────────────────────────────────────────────────────────
// Each block targets:
//   #dangan-gcp-effect-bg.dr-effect-XXX   → the full-viewport overlay
//   .dangan-gcp-slot.dr-effect-XXX img    → character sprite images
// Use img for transforms (avoids fighting the slot's scroll transition).

export const EFFECTS_DEFAULT_CSS = {

    realization: `/* REALIZATION — white flash + brightness burst */
@keyframes dr-eff-bg-real   { 0%,100%{opacity:0} 12%{opacity:.7} }
@keyframes dr-eff-slot-real { 0%,100%{filter:brightness(1) drop-shadow(0 0 12px rgba(0,0,0,.7))} 15%{filter:brightness(3) drop-shadow(0 0 50px rgba(255,255,200,1))} }
#dangan-gcp-effect-bg.dr-effect-realization  { animation: dr-eff-bg-real .8s ease-out forwards; background:#fff; }
img.dr-effect-realization                    { animation: dr-eff-slot-real .8s ease-out; }`,

    surprise: `/* SURPRISE — screen jolt + flash */
@keyframes dr-eff-bg-surp   { 0%,100%{opacity:0} 10%{opacity:.5} }
@keyframes dr-eff-slot-surp { 0%,100%{transform:none} 10%{transform:translateY(-18px) scale(1.04)} 25%{transform:translateY(8px)} 50%{transform:none} }
#dangan-gcp-effect-bg.dr-effect-surprise     { animation: dr-eff-bg-surp .9s ease-out forwards; background:#fff; }
img.dr-effect-surprise                       { animation: dr-eff-slot-surp .9s ease-out; }`,

    fear: `/* FEAR — darken + desaturate + shake */
@keyframes dr-eff-bg-fear   { 0%,100%{opacity:0} 20%,80%{opacity:.55} }
@keyframes dr-eff-slot-fear { 0%,100%{filter:drop-shadow(0 0 12px rgba(0,0,0,.7))} 25%,75%{filter:grayscale(.7) brightness(.65) drop-shadow(0 0 20px rgba(0,0,60,.9))} }
@keyframes dr-eff-shk-fear  { 0%,100%{transform:none} 20%{transform:translateX(-7px)} 40%{transform:translateX(6px)} 60%{transform:translateX(-5px)} 80%{transform:translateX(3px)} }
#dangan-gcp-effect-bg.dr-effect-fear         { animation: dr-eff-bg-fear 1.2s ease-in-out forwards; background:#000; }
img.dr-effect-fear                           { animation: dr-eff-slot-fear 1.2s ease-in-out, dr-eff-shk-fear .3s ease-in-out 2; }`,

    anger: `/* ANGER — red BG pulse + slot recoil */
@keyframes dr-eff-bg-angr   { 0%,100%{opacity:0} 15%{opacity:.45} }
@keyframes dr-eff-slot-angr { 0%,100%{transform:none} 8%{transform:translateX(-12px) rotate(-2deg)} 20%{transform:translateX(9px) rotate(1.5deg)} 35%{transform:none} }
#dangan-gcp-effect-bg.dr-effect-anger        { animation: dr-eff-bg-angr 1s ease-out forwards; background:#b0000a; }
img.dr-effect-anger                          { animation: dr-eff-slot-angr 1s ease-out; }`,

    joy: `/* JOY — golden BG glow + brightness lift */
@keyframes dr-eff-bg-joy    { 0%,100%{opacity:0} 30%,70%{opacity:.35} }
@keyframes dr-eff-slot-joy  { 0%,100%{filter:drop-shadow(0 0 12px rgba(0,0,0,.7))} 40%{filter:drop-shadow(0 0 30px rgba(255,220,0,.9)) brightness(1.2)} }
#dangan-gcp-effect-bg.dr-effect-joy          { animation: dr-eff-bg-joy 1.2s ease-in-out forwards; background:#ffe066; }
img.dr-effect-joy                            { animation: dr-eff-slot-joy 1.2s ease-in-out; }`,

    excitement: `/* EXCITEMENT — flash + jump */
@keyframes dr-eff-bg-excit  { 0%,100%{opacity:0} 8%{opacity:.6} }
@keyframes dr-eff-slot-excit{ 0%,100%{transform:none} 15%{transform:translateY(-22px) scale(1.06)} 35%{transform:translateY(4px) scale(.97)} 55%{transform:none} }
#dangan-gcp-effect-bg.dr-effect-excitement   { animation: dr-eff-bg-excit .7s ease-out forwards; background:#fff; }
img.dr-effect-excitement                     { animation: dr-eff-slot-excit .7s cubic-bezier(.2,1.6,.4,1); }`,

    sadness: `/* SADNESS — blue-grey dim */
@keyframes dr-eff-bg-sad    { 0%,100%{opacity:0} 20%,80%{opacity:.5} }
@keyframes dr-eff-slot-sad  { 0%,100%{filter:drop-shadow(0 0 12px rgba(0,0,0,.7))} 30%,70%{filter:brightness(.6) saturate(.4) drop-shadow(0 0 18px rgba(20,30,80,.8))} }
#dangan-gcp-effect-bg.dr-effect-sadness      { animation: dr-eff-bg-sad 1.5s ease-in-out forwards; background:#1a2a4a; }
img.dr-effect-sadness                        { animation: dr-eff-slot-sad 1.5s ease-in-out; }`,

    grief: `/* GRIEF — deep dark fade */
@keyframes dr-eff-bg-grief  { 0%,100%{opacity:0} 30%,70%{opacity:.75} }
@keyframes dr-eff-slot-grief{ 0%,100%{filter:drop-shadow(0 0 12px rgba(0,0,0,.7))} 30%,70%{filter:grayscale(1) brightness(.45) drop-shadow(0 0 25px rgba(0,0,0,1))} }
#dangan-gcp-effect-bg.dr-effect-grief        { animation: dr-eff-bg-grief 1.5s ease-in-out forwards; background:#000; }
img.dr-effect-grief                          { animation: dr-eff-slot-grief 1.5s ease-in-out; }`,

    nervousness: `/* NERVOUSNESS — subtle jitter */
@keyframes dr-eff-shk-nerv  { 0%,100%{transform:none} 20%{transform:translateX(-3px)} 40%{transform:translateX(3px)} 60%{transform:translateX(-2px)} 80%{transform:translateX(2px)} }
img.dr-effect-nervousness                    { animation: dr-eff-shk-nerv .9s ease-in-out; }`,

    disgust: `/* DISGUST — green tint + tilt */
@keyframes dr-eff-bg-disg   { 0%,100%{opacity:0} 20%{opacity:.3} }
@keyframes dr-eff-slot-disg { 0%,100%{transform:none;filter:drop-shadow(0 0 12px rgba(0,0,0,.7))} 25%{transform:rotate(-4deg);filter:saturate(1.7) hue-rotate(50deg) drop-shadow(0 0 15px rgba(60,100,20,.6))} 80%{transform:rotate(0)} }
#dangan-gcp-effect-bg.dr-effect-disgust      { animation: dr-eff-bg-disg .8s ease-out forwards; background:#446622; }
img.dr-effect-disgust                        { animation: dr-eff-slot-disg .8s ease-out; }`,

    embarrassment: `/* EMBARRASSMENT — pink flash + shake */
@keyframes dr-eff-bg-embr   { 0%,100%{opacity:0} 15%{opacity:.45} }
@keyframes dr-eff-shk-embr  { 0%,100%{transform:none} 15%{transform:translateX(-8px)} 30%{transform:translateX(7px)} 45%{transform:translateX(-5px)} 60%{transform:translateX(4px)} 78%{transform:translateX(-2px)} }
#dangan-gcp-effect-bg.dr-effect-embarrassment { animation: dr-eff-bg-embr 2s ease-out forwards; background:#ff5599; }
img.dr-effect-embarrassment                   { animation: dr-eff-shk-embr 2s ease-out; }`,

    love: `/* LOVE — pink glow + heartbeat pulse */
@keyframes dr-eff-bg-love   { 0%,100%{opacity:0} 30%,70%{opacity:.3} }
@keyframes dr-eff-slot-love { 0%,100%{transform:scale(1);filter:drop-shadow(0 0 12px rgba(0,0,0,.7))} 40%{transform:scale(1.05);filter:drop-shadow(0 0 28px rgba(255,100,200,.85))} }
#dangan-gcp-effect-bg.dr-effect-love         { animation: dr-eff-bg-love 1s ease-in-out forwards; background:#ff88cc; }
img.dr-effect-love                           { animation: dr-eff-slot-love 1s ease-in-out; }`,
};

// ── Settings ──────────────────────────────────────────────────────────────────

function getEffectsSettings() {
    const store = extension_settings[extensionName];
    if (!store.effectsSettings) store.effectsSettings = { enabled: true, byEmotion: {} };
    return store.effectsSettings;
}

function setEffectsSettings(s) {
    extension_settings[extensionName].effectsSettings = s;
    saveSettingsDebounced();
}

function isEffectEnabled(emotion) {
    const s = getEffectsSettings();
    if (!s.enabled) return false;
    return s.byEmotion[emotion]?.enabled ?? false; // opt-in by default
}

function getEffectScope(emotion) {
    const s = getEffectsSettings();
    return s.byEmotion[emotion]?.scope ?? EFFECTS_MAP[emotion]?.defaultScope ?? 'speaker';
}

function getEffectCss(emotion) {
    const s = getEffectsSettings();
    return s.byEmotion[emotion]?.css ?? EFFECTS_DEFAULT_CSS[emotion] ?? '';
}

function saveEffectCss(emotion, css) {
    const s = getEffectsSettings();
    if (!s.byEmotion[emotion]) s.byEmotion[emotion] = {};
    if (css === EFFECTS_DEFAULT_CSS[emotion]) {
        delete s.byEmotion[emotion].css;
    } else {
        s.byEmotion[emotion].css = css;
    }
    setEffectsSettings(s);
}

function sfxForEffect(emotion) {
    const s = getEffectsSettings();
    const custom = s.byEmotion[emotion]?.sfx;
    return custom || EFFECTS_MAP[emotion]?.sfx || null;
}

function volumeForEffect(emotion) {
    return getEffectsSettings().byEmotion[emotion]?.sfxVolume ?? 0.7;
}

function isMutedForEffect(emotion) {
    return getEffectsSettings().byEmotion[emotion]?.sfxMuted ?? false;
}

// ── CSS injection ─────────────────────────────────────────────────────────────

function applyEffectCss(emotion) {
    let styleEl = document.getElementById('dr-effects-live-style');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'dr-effects-live-style';
        document.head.appendChild(styleEl);
    }
    styleEl.textContent = getEffectCss(emotion);
}

// ── Trigger ───────────────────────────────────────────────────────────────────

function triggerEffect(emotion, applyGcpEffect) {
    if (!EFFECTS_MAP[emotion]) return;
    if (!isEffectEnabled(emotion)) return;

    // Group chat only
    const ctx = window.SillyTavern?.getContext?.();
    if (!ctx?.groupId) return;

    const def = EFFECTS_MAP[emotion];

    // SFX: suppress Expressions SFX, play Effects SFX instead
    suppressVfxSfxOnce(emotion);
    if (!isMutedForEffect(emotion)) {
        const sfxFile = sfxForEffect(emotion);
        if (sfxFile) {
            const audio = new Audio(`${EFFECTS_SFX_BASE}${sfxFile}`);
            audio.volume = volumeForEffect(emotion);
            audio.play().catch(() => {});
        }
    }

    // Match vfxSystem's 250 ms settle delay
    setTimeout(() => {
        applyEffectCss(emotion);
        applyGcpEffect(def.css, def.duration, getEffectScope(emotion));
    }, 250);
}

// ── UI ────────────────────────────────────────────────────────────────────────

let currentEditorEmotion = null;

function renderEffectsModal() {
    const s = getEffectsSettings();
    const allSfxFiles = getAvailableSfxFiles();

    const masterBtn = document.getElementById('monopad-effects-master-toggle');
    if (masterBtn) {
        masterBtn.textContent = s.enabled ? 'ON' : 'OFF';
        masterBtn.classList.toggle('on', s.enabled);
    }

    const grid = document.getElementById('monopad-effects-emotion-grid');
    if (!grid) return;
    grid.innerHTML = '';

    for (const [emotion, def] of Object.entries(EFFECTS_MAP)) {
        const cfg     = s.byEmotion[emotion] || {};
        const enabled = cfg.enabled ?? false;
        const scope   = cfg.scope ?? def.defaultScope;
        const muted   = cfg.sfxMuted ?? false;
        const vol     = Math.round((cfg.sfxVolume ?? 0.7) * 100);
        const activeSfx = cfg.sfx ?? '';

        const row = document.createElement('div');
        row.className = 'dr-vfx-emotion-row';
        row.innerHTML = `
            <div class="dr-vfx-emotion-info">
                <span class="dr-vfx-emotion-name">${emotion.toUpperCase()}</span>
            </div>
            <div class="dr-vfx-emotion-controls">
                <select class="dr-effects-scope-select" data-emotion="${emotion}" title="Apply to">
                    <option value="speaker"${scope === 'speaker' ? ' selected' : ''}>SPEAKER</option>
                    <option value="all"${scope === 'all' ? ' selected' : ''}>ALL</option>
                </select>
                <button class="dr-vfx-mute-btn dr-effects-mute-btn${!muted ? ' on' : ''}" data-emotion="${emotion}" title="${muted ? 'Unmute SFX' : 'Mute SFX'}" type="button">${muted ? '🔇' : '🔊'}</button>
                <input type="range" class="dr-vfx-volume-slider dr-effects-vol-slider" data-emotion="${emotion}" min="0" max="100" value="${vol}" title="Volume: ${vol}%">
                <select class="dr-vfx-sfx-select dr-effects-sfx-select" data-emotion="${emotion}" title="SFX override">
                    <option value=""${!activeSfx ? ' selected' : ''}>(none)</option>
                    ${allSfxFiles.map(f => `<option value="${f}"${f === activeSfx ? ' selected' : ''}>${f}</option>`).join('')}
                </select>
                <button class="dr-vfx-preview-btn dr-effects-sfx-preview-btn" data-emotion="${emotion}" title="Preview SFX" type="button">▶</button>
                <button class="dr-vfx-preview-btn dr-effects-edit-css-btn" data-emotion="${emotion}" title="Edit CSS" type="button">CSS</button>
                <button class="dr-vfx-toggle-btn dr-effects-toggle-btn${enabled ? ' on' : ''}" data-emotion="${emotion}" type="button">${enabled ? 'ON' : 'OFF'}</button>
            </div>`;
        grid.appendChild(row);
    }
}

function openEffectCssEditor(emotion) {
    currentEditorEmotion = emotion;
    const label   = document.getElementById('monopad-effects-editor-emotion-label');
    const editor  = document.getElementById('monopad-effects-editor-css');
    const overlay = document.getElementById('monopad-effects-editor-overlay');
    if (!overlay || !editor) return;
    if (label) label.textContent = `${emotion.toUpperCase()} — selector class: "${EFFECTS_MAP[emotion].css}"`;
    editor.value = getEffectCss(emotion);

    // Load the active speaker's sprite into the mini preview.
    // img.src returns "" when the src attribute was never set — use [src] selector to
    // skip those entirely, and hasAttribute() to validate the callback result.
    const previewImg = document.getElementById('monopad-effects-preview-img');
    if (previewImg) {
        const preferred = _getSpeakerImg?.();
        const srcImg = (preferred?.hasAttribute('src') ? preferred : null)
            ?? document.querySelector('#dangan-group-chat-stage .dangan-gcp-slot img[src]')
            ?? document.querySelector('#expression-image[src]');
        if (srcImg) previewImg.src = srcImg.src;
    }

    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
}

function updateEffectsButtonState() {
    const btn = document.getElementById('dangan_configure_effects');
    if (!btn) return;
    const hasChar = this_chid != null;
    btn.disabled = !hasChar;
    btn.title = hasChar ? '' : 'No character selected';
}

function setupEffectsUI(applyGcpEffect) {
    updateEffectsButtonState();
    eventSource.on(event_types.CHAT_CHANGED, updateEffectsButtonState);

    // ── Main modal ────────────────────────────────────────────────────────────
    document.getElementById('dangan_configure_effects')?.addEventListener('click', () => {
        renderEffectsModal();
        const overlay = document.getElementById('monopad-effects-overlay');
        overlay?.classList.add('open');
        overlay?.setAttribute('aria-hidden', 'false');
    });

    document.getElementById('monopad-effects-close')?.addEventListener('click', () => {
        const overlay = document.getElementById('monopad-effects-overlay');
        overlay?.classList.remove('open');
        overlay?.setAttribute('aria-hidden', 'true');
    });

    document.getElementById('monopad-effects-master-toggle')?.addEventListener('click', (e) => {
        const s = getEffectsSettings();
        s.enabled = !s.enabled;
        setEffectsSettings(s);
        e.currentTarget.textContent = s.enabled ? 'ON' : 'OFF';
        e.currentTarget.classList.toggle('on', s.enabled);
    });

    // Emotion grid — event delegation
    document.getElementById('monopad-effects-emotion-grid')?.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const emotion = btn.dataset.emotion;
        if (!emotion) return;
        const s = getEffectsSettings();
        if (!s.byEmotion[emotion]) s.byEmotion[emotion] = {};
        const cfg = s.byEmotion[emotion];

        if (btn.classList.contains('dr-effects-toggle-btn')) {
            cfg.enabled = !cfg.enabled;
            btn.textContent = cfg.enabled ? 'ON' : 'OFF';
            btn.classList.toggle('on', cfg.enabled);
            setEffectsSettings(s);
        } else if (btn.classList.contains('dr-effects-mute-btn')) {
            cfg.sfxMuted = !cfg.sfxMuted;
            btn.textContent = cfg.sfxMuted ? '🔇' : '🔊';
            btn.classList.toggle('on', !cfg.sfxMuted);
            setEffectsSettings(s);
        } else if (btn.classList.contains('dr-effects-sfx-preview-btn')) {
            const sfxFile = sfxForEffect(emotion);
            if (sfxFile) {
                const audio = new Audio(`${EFFECTS_SFX_BASE}${sfxFile}`);
                audio.volume = volumeForEffect(emotion);
                audio.play().catch(() => {});
            }
        } else if (btn.classList.contains('dr-effects-edit-css-btn')) {
            openEffectCssEditor(emotion);
        }
    });

    document.getElementById('monopad-effects-emotion-grid')?.addEventListener('input', (e) => {
        const el = e.target;
        const emotion = el.dataset.emotion;
        if (!emotion) return;
        const s = getEffectsSettings();
        if (!s.byEmotion[emotion]) s.byEmotion[emotion] = {};
        const cfg = s.byEmotion[emotion];

        if (el.classList.contains('dr-effects-vol-slider')) {
            cfg.sfxVolume = Number(el.value) / 100;
            setEffectsSettings(s);
        } else if (el.classList.contains('dr-effects-sfx-select')) {
            cfg.sfx = el.value || null;
            setEffectsSettings(s);
        } else if (el.classList.contains('dr-effects-scope-select')) {
            cfg.scope = el.value;
            setEffectsSettings(s);
        }
    });

    // ── CSS editor modal ──────────────────────────────────────────────────────
    document.getElementById('monopad-effects-editor-close')?.addEventListener('click', () => {
        const overlay = document.getElementById('monopad-effects-editor-overlay');
        overlay?.classList.remove('open');
        overlay?.setAttribute('aria-hidden', 'true');
    });

    document.getElementById('monopad-effects-editor-preview')?.addEventListener('click', () => {
        if (!currentEditorEmotion) return;
        const css = document.getElementById('monopad-effects-editor-css')?.value ?? '';
        const def = EFFECTS_MAP[currentEditorEmotion];

        // Play SFX (respects mute/volume settings)
        if (!isMutedForEffect(currentEditorEmotion)) {
            const sfxFile = sfxForEffect(currentEditorEmotion);
            if (sfxFile) {
                const audio = new Audio(`${EFFECTS_SFX_BASE}${sfxFile}`);
                audio.volume = volumeForEffect(currentEditorEmotion);
                audio.play().catch(() => {});
            }
        }

        // Inject original CSS for the live GCP stage (fires behind the modal)
        let liveStyle = document.getElementById('dr-effects-live-style');
        if (!liveStyle) { liveStyle = document.createElement('style'); liveStyle.id = 'dr-effects-live-style'; document.head.appendChild(liveStyle); }
        liveStyle.textContent = css;

        // Rewrite selectors to target the mini preview stage elements.
        // Generate two copies of the BG rules: one for the overlay, one for the backdrop.
        const bgOverlayCss  = css
            .replace(/#dangan-gcp-effect-bg/g, '#dangan-gcp-effect-preview-bg')
            .replace(/\.dangan-gcp-slot/g,     '.effects-preview-slot');
        const bgBackdropCss = css
            .replace(/#dangan-gcp-effect-bg/g, '#monopad-effects-preview-backdrop')
            .replace(/\.dangan-gcp-slot/g,     '.effects-preview-slot');
        let prevStyle = document.getElementById('dr-effects-preview-style');
        if (!prevStyle) { prevStyle = document.createElement('style'); prevStyle.id = 'dr-effects-preview-style'; document.head.appendChild(prevStyle); }
        prevStyle.textContent = bgOverlayCss + '\n' + bgBackdropCss;

        // Apply class to preview BG overlay + backdrop + slot div + img directly
        const bgEl       = document.getElementById('dangan-gcp-effect-preview-bg');
        const backdropEl = document.getElementById('monopad-effects-preview-backdrop');
        const slotEl     = document.querySelector('.effects-preview-slot');
        const previewImg = document.getElementById('monopad-effects-preview-img');
        const els        = [bgEl, backdropEl, slotEl, previewImg].filter(Boolean);
        els.forEach(el => el.classList.remove(def.css));
        void document.body.offsetWidth;
        els.forEach(el => el.classList.add(def.css));
        setTimeout(() => els.forEach(el => el.classList.remove(def.css)), def.duration + 100);
    });

    document.getElementById('monopad-effects-editor-save')?.addEventListener('click', () => {
        if (!currentEditorEmotion) return;
        saveEffectCss(currentEditorEmotion, document.getElementById('monopad-effects-editor-css')?.value ?? '');
    });

    document.getElementById('monopad-effects-editor-reset')?.addEventListener('click', () => {
        if (!currentEditorEmotion) return;
        const def = EFFECTS_DEFAULT_CSS[currentEditorEmotion] ?? '';
        const editor = document.getElementById('monopad-effects-editor-css');
        if (editor) editor.value = def;
        saveEffectCss(currentEditorEmotion, def);
    });
}

// ── Init / Cleanup ────────────────────────────────────────────────────────────

let _applyGcpEffect = null;
let _getSpeakerImg  = null;

export function initEffectsSystem(applyGcpEffect, getSpeakerImg) {
    _applyGcpEffect = applyGcpEffect;
    _getSpeakerImg  = getSpeakerImg ?? null;
    setOnEmotionTrigger(emotion => triggerEffect(emotion, applyGcpEffect));
    setupEffectsUI(applyGcpEffect);
}

// Public: fire an effect by emotion name directly (for slash commands, etc.)
// scope override is optional — falls back to per-emotion setting.
export function fireEffect(emotion, scopeOverride) {
    if (!_applyGcpEffect) return;
    if (!EFFECTS_MAP[emotion]) return;
    const ctx = window.SillyTavern?.getContext?.();
    if (!ctx?.groupId) return;
    const def = EFFECTS_MAP[emotion];
    suppressVfxSfxOnce(emotion);
    if (!isMutedForEffect(emotion)) {
        const sfxFile = sfxForEffect(emotion);
        if (sfxFile) {
            const audio = new Audio(`${EFFECTS_SFX_BASE}${sfxFile}`);
            audio.volume = volumeForEffect(emotion);
            audio.play().catch(() => {});
        }
    }
    applyEffectCss(emotion);
    _applyGcpEffect(def.css, def.duration, scopeOverride ?? getEffectScope(emotion));
}

export function cleanupEffectsSystem() {
    setOnEmotionTrigger(null);
    document.getElementById('dr-effects-live-style')?.remove();
}
