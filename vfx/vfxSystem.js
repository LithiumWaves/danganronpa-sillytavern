import { extension_settings } from "../../../../extensions.js";
import { saveSettingsDebounced, this_chid, eventSource, event_types } from "../../../../../script.js";
import { getContext } from "../../../../../scripts/st-context.js";
import { extensionName, extensionFolderPath } from "../core/constants.js";

const VFX_SFX_BASE = `${extensionFolderPath}/assets/sfx/reactions/`;

// Allows the GCP stage to redirect VFX effects onto its own sprite elements
// instead of SillyTavern's hidden native #expression-image.
let expressionTargetFn = null;
export function setExpressionTarget(fn) { expressionTargetFn = fn; }

const VFX_MAP = {
    realization:   { css: "dr-vfx-realization",   duration: 1000, sfx: "realization.wav" },
    surprise:      { css: "dr-vfx-surprise",       duration: 1000, sfx: "surprise.wav"   },
    fear:          { css: "dr-vfx-fear",           duration: 1000, sfx: null              },
    anger:         { css: "dr-vfx-anger",          duration: 1000, sfx: "anger.wav"       },
    joy:           { css: null, starOverlay:  true, duration: 1000, sfx: "joy.wav"        },
    excitement:    { css: "dr-vfx-excitement",     duration:  700, sfx: "excitement.wav"  },
    sadness:       { css: null,                    duration: 1200, sfx: "sadness.wav"     },
    grief:         { css: null,                    duration: 1200, sfx: null              },
    nervousness:   { css: "dr-vfx-nervousness",    duration:  900, sfx: null              },
    disgust:       { css: "dr-vfx-disgust",        duration:  800, sfx: null              },
    embarrassment: { css: null, dropOverlay: true,  duration: 2400, sfx: "embarrassment.wav" },
    love:          { css: null, heartOverlay: true, duration: 1000, sfx: null             },
};

const VFX_ALL_CLASSES = [...new Set(
    Object.values(VFX_MAP).map(d => d.css).filter(Boolean),
)].join(" ");

// Default CSS for each emotion — shown in the preview editor, editable and persisted per character
const VFX_DEFAULT_CSS = {
    realization:
`@keyframes dr-vfx-realization-anim {
    0%   { filter: brightness(1) contrast(1); transform: translateY(0) scale(1); }
    12%  { filter: brightness(2.4) contrast(1.3); transform: translateY(-8px) scale(1.04); }
    28%  { filter: brightness(1.8) contrast(1.1); transform: translateY(-4px) scale(1.02); }
    55%  { filter: brightness(1); transform: translateY(0) scale(1); }
    72%  { filter: brightness(1.15); transform: translateY(-3px) scale(1.01); }
    100% { filter: brightness(1) contrast(1); transform: translateY(0) scale(1); }
}
.dr-vfx-realization {
    animation: dr-vfx-realization-anim 1s cubic-bezier(0.22, 0.74, 0.4, 1) forwards;
}`,

    surprise:
`@keyframes dr-vfx-surprise-anim {
    0%   { transform: scale(1) rotate(0deg); }
    8%   { transform: scale(1.08) rotate(-2deg); }
    20%  { transform: scale(0.94) rotate(1.5deg); }
    34%  { transform: scale(1.05) rotate(-1deg); }
    52%  { transform: scale(0.98) rotate(0.5deg); }
    72%  { transform: scale(1.02) rotate(0deg); }
    100% { transform: scale(1) rotate(0deg); }
}
.dr-vfx-surprise {
    animation: dr-vfx-surprise-anim 1s cubic-bezier(0.3, 0.8, 0.4, 1) forwards;
}`,

    fear:
`@keyframes dr-vfx-fear-anim {
    0%   { transform: translateX(0); }
    8%   { transform: translateX(-7px); }
    16%  { transform: translateX(7px); }
    24%  { transform: translateX(-6px); }
    32%  { transform: translateX(6px); }
    40%  { transform: translateX(-5px); }
    48%  { transform: translateX(5px); }
    58%  { transform: translateX(-3px); }
    68%  { transform: translateX(3px); }
    80%  { transform: translateX(-1px); }
    100% { transform: translateX(0); }
}
.dr-vfx-fear {
    animation: dr-vfx-fear-anim 1s linear forwards;
}`,

    anger:
`@keyframes dr-vfx-anger-anim {
    0%   { transform: translateX(0) translateY(0); filter: brightness(1); }
    6%   { transform: translateX(-8px) translateY(-2px); filter: brightness(1.3) sepia(0.4) saturate(2) hue-rotate(-10deg); }
    14%  { transform: translateX(8px) translateY(1px); filter: brightness(1.4) sepia(0.5) saturate(2.2) hue-rotate(-12deg); }
    22%  { transform: translateX(-7px) translateY(-1px); }
    30%  { transform: translateX(7px) translateY(2px); filter: brightness(1.3) sepia(0.4) saturate(2) hue-rotate(-10deg); }
    42%  { transform: translateX(-5px) translateY(0); filter: brightness(1.15) sepia(0.2); }
    56%  { transform: translateX(4px); filter: brightness(1.05); }
    70%  { transform: translateX(-2px); filter: brightness(1); }
    100% { transform: translateX(0) translateY(0); filter: brightness(1); }
}
.dr-vfx-anger {
    animation: dr-vfx-anger-anim 1s linear forwards;
}`,

    joy:
`.dr-vfx-stars-layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
}
.dr-vfx-star {
    position: absolute;
    display: block;
    line-height: 1;
    transform: translate(-50%, -50%);
    animation: dr-vfx-star-drift 1s linear forwards;
}
.dr-vfx-star::before {
    content: '✦';
    display: block;
    color: #FFD700;
    text-shadow:
        0 0 6px  #ffffff,
        0 0 14px #ffffff,
        0 0 28px #FFD700,
        0 0 48px #FFD700;
    opacity: 0;
    animation: dr-vfx-star-pop 1s ease forwards;
}
@keyframes dr-vfx-star-drift {
    from { transform: translate(-50%, -50%) translateY(0px); }
    to   { transform: translate(-50%, -50%) translateY(-60px); }
}
@keyframes dr-vfx-star-pop {
    0%   { opacity: 0;   transform: scale(0.2)  rotate(0deg); }
    28%  { opacity: 1;   transform: scale(1)    rotate(22deg); }
    65%  { opacity: 0.9; transform: scale(1.25) rotate(-12deg); }
    100% { opacity: 0;   transform: scale(1.8)  rotate(10deg); }
}`,

    excitement:
`@keyframes dr-vfx-excitement-anim {
    0%   { transform: translateY(0) scale(1); }
    15%  { transform: translateY(-14px) scale(1.04, 0.96); }
    30%  { transform: translateY(0) scale(0.96, 1.04); }
    45%  { transform: translateY(-8px) scale(1.02, 0.98); }
    60%  { transform: translateY(0) scale(0.98, 1.02); }
    75%  { transform: translateY(-4px) scale(1.01, 0.99); }
    100% { transform: translateY(0) scale(1); }
}
.dr-vfx-excitement {
    animation: dr-vfx-excitement-anim 0.7s cubic-bezier(0.4, 0.8, 0.4, 1) forwards;
}`,

    sadness:   `/* Sadness — SFX only, no visual animation */`,
    grief:     `/* Grief — no effect currently */`,

    nervousness:
`@keyframes dr-vfx-nervousness-anim {
    0%   { transform: translateX(0) translateY(0); }
    10%  { transform: translateX(-3px) translateY(1px); }
    20%  { transform: translateX(2px) translateY(-1px); }
    30%  { transform: translateX(-2px) translateY(2px); }
    40%  { transform: translateX(3px) translateY(-1px); }
    50%  { transform: translateX(-1px) translateY(1px); }
    60%  { transform: translateX(2px) translateY(0); }
    70%  { transform: translateX(-2px) translateY(-1px); }
    80%  { transform: translateX(1px) translateY(1px); }
    90%  { transform: translateX(-1px) translateY(0); }
    100% { transform: translateX(0) translateY(0); }
}
.dr-vfx-nervousness {
    animation: dr-vfx-nervousness-anim 0.9s linear forwards;
}`,

    disgust:
`@keyframes dr-vfx-disgust-anim {
    0%   { transform: rotate(0deg) translateX(0); filter: brightness(1) saturate(1); }
    15%  { transform: rotate(-2deg) translateX(-5px); filter: brightness(0.9) saturate(0.85); }
    40%  { transform: rotate(-3deg) translateX(-8px); filter: brightness(0.88) saturate(0.8); }
    65%  { transform: rotate(-2deg) translateX(-5px); filter: brightness(0.92); }
    85%  { transform: rotate(-1deg) translateX(-2px); filter: brightness(0.96); }
    100% { transform: rotate(0deg) translateX(0); filter: brightness(1) saturate(1); }
}
.dr-vfx-disgust {
    animation: dr-vfx-disgust-anim 0.8s ease-in-out forwards;
}`,

    embarrassment:
`.dr-vfx-drops-layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
}
.dr-vfx-drop {
    position: absolute;
    display: block;
    filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.55)) drop-shadow(0 0 10px rgba(255, 255, 255, 0.25));
    animation: dr-vfx-drop-drift 0.45s linear 0ms 5 forwards;
}
.dr-vfx-drop::before {
    content: '';
    display: block;
    width:  var(--drop-w, 8px);
    height: var(--drop-h, 12px);
    background: linear-gradient(to top, transparent 0%, rgba(255, 255, 255, 0.88) 100%);
    border-radius: 50% 50% 0 0;
    rotate: var(--drop-rotate, 0deg);
    opacity: 0;
    animation: dr-vfx-drop-fade 0.45s ease 0ms 5 forwards;
}
@keyframes dr-vfx-drop-drift {
    from { transform: translate(-50%, -50%) translate(0px, 0px); }
    to   { transform: translate(-50%, -50%) translate(var(--drift-x, 0px), var(--drift-y, -52px)); }
}
@keyframes dr-vfx-drop-fade {
    0%   { opacity: 0; }
    18%  { opacity: 0.9; }
    72%  { opacity: 0.75; }
    100% { opacity: 0; }
}`,

    love:
`.dr-vfx-hearts-layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
}
.dr-vfx-heart {
    position: absolute;
    display: block;
    line-height: 1;
    transform: translate(-50%, -50%);
    animation: dr-vfx-heart-drift 1s linear forwards;
}
.dr-vfx-heart::before {
    content: '❤';
    display: block;
    color: #FF2D55;
    text-shadow:
        0 0 6px  #FF2D55,
        0 0 14px #FF2D55,
        0 0 28px #ff8fab,
        0 0 48px #FF2D55;
    opacity: 0;
    animation: dr-vfx-heart-pop 1s ease forwards;
}
@keyframes dr-vfx-heart-drift {
    from { transform: translate(-50%, -50%) translateY(0px); }
    to   { transform: translate(-50%, -50%) translateY(-60px); }
}
@keyframes dr-vfx-heart-pop {
    0%   { opacity: 0;   transform: scale(0.2)  rotate(-10deg); }
    28%  { opacity: 1;   transform: scale(1)    rotate(8deg); }
    65%  { opacity: 0.9; transform: scale(1.2)  rotate(-5deg); }
    100% { opacity: 0;   transform: scale(1.7)  rotate(6deg); }
}`,
};

// Default HTML overlays for particle emotions.
// Positions use calc(50% + Xpx) / calc(33% + Ypx) so they are relative to the
// overlay container (which is sized to the sprite), matching the original
// Guinevere layout exactly.
const VFX_DEFAULT_HTML = {
    joy:
`<div class="dr-vfx-stars-layer">
  <span class="dr-vfx-star" style="left:calc(50% - 58px);top:calc(33% - 18px);font-size:22px;animation-delay:0ms"></span>
  <span class="dr-vfx-star" style="left:calc(50% + 62px);top:calc(33% - 30px);font-size:28px;animation-delay:110ms"></span>
  <span class="dr-vfx-star" style="left:calc(50% - 18px);top:calc(33% - 62px);font-size:17px;animation-delay:55ms"></span>
  <span class="dr-vfx-star" style="left:calc(50% + 32px);top:calc(33% - 68px);font-size:20px;animation-delay:170ms"></span>
  <span class="dr-vfx-star" style="left:calc(50% - 70px);top:calc(33% - 52px);font-size:14px;animation-delay:210ms"></span>
  <span class="dr-vfx-star" style="left:calc(50% + 72px);top:calc(33% - 8px);font-size:16px;animation-delay:135ms"></span>
</div>`,

    love:
`<div class="dr-vfx-hearts-layer">
  <span class="dr-vfx-heart" style="left:calc(50% - 52px);top:calc(33% - 20px);font-size:20px;animation-delay:0ms"></span>
  <span class="dr-vfx-heart" style="left:calc(50% + 56px);top:calc(33% - 32px);font-size:26px;animation-delay:115ms"></span>
  <span class="dr-vfx-heart" style="left:calc(50% - 16px);top:calc(33% - 58px);font-size:16px;animation-delay:50ms"></span>
  <span class="dr-vfx-heart" style="left:calc(50% + 28px);top:calc(33% - 64px);font-size:22px;animation-delay:175ms"></span>
  <span class="dr-vfx-heart" style="left:calc(50% - 66px);top:calc(33% - 48px);font-size:14px;animation-delay:215ms"></span>
  <span class="dr-vfx-heart" style="left:calc(50% + 68px);top:calc(33% - 6px);font-size:18px;animation-delay:140ms"></span>
</div>`,

    embarrassment:
`<div class="dr-vfx-drops-layer">
  <span class="dr-vfx-drop" style="left:calc(50% - 28.9px);top:calc(33% - 34.5px);--drop-w:7px;--drop-h:11px;--drift-x:-30.9px;--drift-y:-36.8px;--drop-rotate:-40deg"></span>
  <span class="dr-vfx-drop" style="left:calc(50% - 22.5px);top:calc(33% - 39px);--drop-w:4px;--drop-h:6px;--drift-x:-24px;--drift-y:-41.6px;--drop-rotate:-30deg"></span>
  <span class="dr-vfx-drop" style="left:calc(50% - 15.4px);top:calc(33% - 42.3px);--drop-w:7px;--drop-h:11px;--drift-x:-16.4px;--drift-y:-45.1px;--drop-rotate:-20deg"></span>
  <span class="dr-vfx-drop" style="left:calc(50% - 7.8px);top:calc(33% - 44.3px);--drop-w:4px;--drop-h:6px;--drift-x:-8.3px;--drift-y:-47.3px;--drop-rotate:-10deg"></span>
  <span class="dr-vfx-drop" style="left:calc(50%);top:calc(33% - 45px);--drop-w:7px;--drop-h:11px;--drift-x:0px;--drift-y:-48px;--drop-rotate:0deg"></span>
  <span class="dr-vfx-drop" style="left:calc(50% + 7.8px);top:calc(33% - 44.3px);--drop-w:4px;--drop-h:6px;--drift-x:8.3px;--drift-y:-47.3px;--drop-rotate:10deg"></span>
  <span class="dr-vfx-drop" style="left:calc(50% + 15.4px);top:calc(33% - 42.3px);--drop-w:7px;--drop-h:11px;--drift-x:16.4px;--drift-y:-45.1px;--drop-rotate:20deg"></span>
  <span class="dr-vfx-drop" style="left:calc(50% + 22.5px);top:calc(33% - 39px);--drop-w:4px;--drop-h:6px;--drift-x:24px;--drift-y:-41.6px;--drop-rotate:30deg"></span>
  <span class="dr-vfx-drop" style="left:calc(50% + 28.9px);top:calc(33% - 34.5px);--drop-w:7px;--drop-h:11px;--drift-x:30.9px;--drift-y:-36.8px;--drop-rotate:40deg"></span>
</div>`,
};

let vfxObserver = null;
let vfxLastExpression = null;
let currentPreviewEmotion = null;

// ── Settings storage (per-character, keyed by this_chid) ─────────────────────

function getVfxSettings() {
    const store = extension_settings[extensionName]?.vfxSettings || {};
    const key = this_chid ?? "__global__";
    const s = store[key];
    if (s === null || s === undefined || typeof s !== "object") {
        return { enabled: s !== false, emotions: {} };
    }
    // Migrate bare booleans → { enabled, volume } objects
    const emotions = {};
    for (const [k, v] of Object.entries(s.emotions || {})) {
        emotions[k] = typeof v === "boolean" ? { enabled: v, volume: 0.7 } : v;
    }
    return { enabled: s.enabled !== false, emotions };
}

function setVfxSettings(settings) {
    if (!extension_settings[extensionName].vfxSettings) {
        extension_settings[extensionName].vfxSettings = {};
    }
    extension_settings[extensionName].vfxSettings[this_chid ?? "__global__"] = settings;
    saveSettingsDebounced();
}

// ── Per-emotion helpers ───────────────────────────────────────────────────────

function isEnabledForEmotion(expression) {
    const s = getVfxSettings();
    if (!s.enabled) return false;
    const e = s.emotions[expression];
    if (e == null) return true; // default on
    if (typeof e === "boolean") return e;
    return e.enabled !== false;
}

function volumeForEmotion(expression) {
    const e = getVfxSettings().emotions[expression];
    if (!e || typeof e !== "object") return 0.7;
    return e.volume ?? 0.7;
}

function isMutedForEmotion(expression) {
    const e = getVfxSettings().emotions[expression];
    return !!(typeof e === "object" && e?.muted);
}

function sfxForEmotion(expression) {
    const e = getVfxSettings().emotions[expression];
    const custom = typeof e === "object" && e?.sfx ? e.sfx : null;
    return custom || VFX_MAP[expression]?.sfx || null;
}

// ── Custom CSS helpers ────────────────────────────────────────────────────────

function getEmotionHtml(emotion) {
    const emo = getVfxSettings().emotions[emotion] || {};
    // undefined = no override, fall back to default; "" = user explicitly cleared (no overlay)
    return emo.customHtml !== undefined ? emo.customHtml : (VFX_DEFAULT_HTML[emotion] || "");
}

function saveEmotionHtml(emotion, html) {
    const s = getVfxSettings();
    if (!s.emotions[emotion]) s.emotions[emotion] = { enabled: true, volume: 0.7 };
    if (html === VFX_DEFAULT_HTML[emotion]) {
        delete s.emotions[emotion].customHtml;
    } else {
        s.emotions[emotion].customHtml = html;
    }
    setVfxSettings(s);
}

function saveEmotionHtmlForAll(emotion, html) {
    if (!extension_settings[extensionName].vfxSettings) {
        extension_settings[extensionName].vfxSettings = {};
    }
    const store = extension_settings[extensionName].vfxSettings;
    const ctx = window.SillyTavern?.getContext?.();
    const allChids = Array.isArray(ctx?.characters) ? ctx.characters.map((_, i) => String(i)) : [];
    const keys = new Set([...Object.keys(store), "__global__", ...allChids]);
    for (const key of keys) {
        if (!store[key] || typeof store[key] !== "object") {
            store[key] = { enabled: true, emotions: {} };
        }
        if (!store[key].emotions) store[key].emotions = {};
        if (!store[key].emotions[emotion]) store[key].emotions[emotion] = { enabled: true, volume: 0.7 };
        if (html === VFX_DEFAULT_HTML[emotion]) {
            delete store[key].emotions[emotion].customHtml;
        } else {
            store[key].emotions[emotion].customHtml = html;
        }
    }
    saveSettingsDebounced();
}

function getEmotionCss(emotion) {
    const emo = getVfxSettings().emotions[emotion] || {};
    return emo.customCss !== undefined ? emo.customCss : (VFX_DEFAULT_CSS[emotion] || "");
}

function saveEmotionCss(emotion, css) {
    const s = getVfxSettings();
    if (!s.emotions[emotion]) s.emotions[emotion] = { enabled: true, volume: 0.7 };
    // Don't store if identical to default — saves space and keeps settings clean
    if (css === VFX_DEFAULT_CSS[emotion]) {
        delete s.emotions[emotion].customCss;
    } else {
        s.emotions[emotion].customCss = css;
    }
    setVfxSettings(s);
}

function buildLiveCss(emotion, userCss) {
    // Always reset the emotion's class first so that an empty userCss actually
    // disables the animation rather than falling back to the base vfx.css rule.
    const cssClass = VFX_MAP[emotion]?.css;
    const reset = cssClass ? `.${cssClass} { animation: none; }` : "";
    return reset + (userCss ? "\n" + userCss : "");
}

function saveEmotionCssForAll(emotion, css) {
    if (!extension_settings[extensionName].vfxSettings) {
        extension_settings[extensionName].vfxSettings = {};
    }
    const store = extension_settings[extensionName].vfxSettings;
    const ctx = window.SillyTavern?.getContext?.();
    const allChids = Array.isArray(ctx?.characters) ? ctx.characters.map((_, i) => String(i)) : [];
    // Include all character chids so every character gets the update, not just those already in store
    const keys = new Set([...Object.keys(store), "__global__", ...allChids]);
    for (const key of keys) {
        if (!store[key] || typeof store[key] !== "object") {
            store[key] = { enabled: true, emotions: {} };
        }
        if (!store[key].emotions) store[key].emotions = {};
        if (!store[key].emotions[emotion]) store[key].emotions[emotion] = { enabled: true, volume: 0.7 };
        if (css === VFX_DEFAULT_CSS[emotion]) {
            delete store[key].emotions[emotion].customCss;
        } else {
            store[key].emotions[emotion].customCss = css;
        }
    }
    saveSettingsDebounced();
}

function applyEmotionCss(emotion) {
    const css = getEmotionCss(emotion);
    let el = document.getElementById("monopad-vfx-live-css");
    if (!el) {
        el = document.createElement("style");
        el.id = "monopad-vfx-live-css";
        document.head.appendChild(el);
    }
    el.textContent = buildLiveCss(emotion, css);
}

// ── Overlay particle effects ──────────────────────────────────────────────────


// ── Effect playback ───────────────────────────────────────────────────────────

function playOnElement(expression, $img, { ignoreMute = false, htmlTarget = null } = {}) {
    const def = VFX_MAP[expression];
    if (!def) return;

    if (def.css) {
        $img.removeClass(VFX_ALL_CLASSES);
        void $img[0].offsetWidth; // force reflow to restart animation
        $img.addClass(def.css);
        setTimeout(() => $img.removeClass(def.css), def.duration + 50);
    }

    // Inject custom HTML overlay if defined — htmlTarget overrides the default
    // live-trigger behaviour (used by preview to inject into the stage column)
    const customHtml = getEmotionHtml(expression);
    if (customHtml) {
        if (htmlTarget) {
            // Preview: inject directly into the provided container
            $(htmlTarget).find(".dr-vfx-html-overlay").remove();
            $(htmlTarget).append(`<div class="dr-vfx-html-overlay">${customHtml}</div>`);
        } else {
            // Live trigger: fixed-position overlay aligned to the sprite
            const rect = $img[0].getBoundingClientRect();
            const $overlay = $(`<div class="dr-vfx-html-overlay" style="position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;pointer-events:none;z-index:2147483500">${customHtml}</div>`);
            $("body").append($overlay);
            setTimeout(() => $overlay.remove(), def.duration + 500);
        }
    }

    if (ignoreMute || !isMutedForEmotion(expression)) {
        const sfxFile = sfxForEmotion(expression);
        if (sfxFile) {
            const audio = new Audio(`${VFX_SFX_BASE}${sfxFile}`);
            audio.volume = volumeForEmotion(expression);
            audio.play().catch(() => {});
        }
    }
}

function triggerVfx(expression) {
    if (!isEnabledForEmotion(expression)) return;
    if (!VFX_MAP[expression]) return;
    // Small delay to let the expression swap animation settle
    setTimeout(() => {
        const imgEl = expressionTargetFn?.() ?? document.getElementById("expression-image");
        const $img = $(imgEl);
        if (!$img.length) return;
        applyEmotionCss(expression);
        playOnElement(expression, $img);
    }, 250);
}

// ── MutationObserver ──────────────────────────────────────────────────────────

function setupObserver() {
    if (vfxObserver) { vfxObserver.disconnect(); vfxObserver = null; }
    vfxLastExpression = null;

    vfxObserver = new MutationObserver((mutations) => {
        for (const m of mutations) {
            let expression = null;

            if (m.type === "childList") {
                for (const node of m.addedNodes) {
                    if (node.nodeType === 1 && node.matches?.("img.expression")) {
                        expression = (node.getAttribute("data-expression") || "").toLowerCase();
                        break;
                    }
                }
            } else if (m.type === "attributes" && m.target.matches?.("img.expression")) {
                expression = (m.target.getAttribute("data-expression") || "").toLowerCase();
            }

            if (expression && expression !== vfxLastExpression) {
                vfxLastExpression = expression;
                triggerVfx(expression);
            }
        }
    });

    vfxObserver.observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["data-expression"],
    });
}

// ── Preview modal ─────────────────────────────────────────────────────────────

function playPreviewAnimation(emotion) {
    const def = VFX_MAP[emotion];
    if (!def) return;

    const $img = $("#monopad-vfx-preview-img");
    if (!$img.length) return;

    // Apply the CSS currently in the editor, with a class reset prepended so
    // that clearing the editor actually disables the animation.
    const css = document.getElementById("monopad-vfx-preview-css-editor")?.value || "";
    let styleEl = document.getElementById("monopad-vfx-live-css");
    if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "monopad-vfx-live-css";
        document.head.appendChild(styleEl);
    }
    styleEl.textContent = buildLiveCss(emotion, css);

    // Sync HTML from editor into the settings temporarily so playOnElement picks it up
    const htmlEditorEl = document.getElementById("monopad-vfx-preview-html-editor");
    const htmlEditorValue = htmlEditorEl?.value || "";
    const s = getVfxSettings();
    if (!s.emotions[emotion]) s.emotions[emotion] = { enabled: true, volume: 0.7 };
    const savedHtml = s.emotions[emotion].customHtml;
    s.emotions[emotion].customHtml = htmlEditorValue || undefined;

    // Reset the CSS animation so it can replay
    $img.removeClass(VFX_ALL_CLASSES);
    void $img[0].offsetWidth;

    playOnElement(emotion, $img, { ignoreMute: false, htmlTarget: ".monopad-vfx-preview-stage-col" });

    // Restore the original saved HTML value (we only used editor value for preview)
    if (savedHtml !== undefined) {
        s.emotions[emotion].customHtml = savedHtml;
    } else {
        delete s.emotions[emotion].customHtml;
    }
}

function openPreview(emotion) {
    currentPreviewEmotion = emotion;

    document.getElementById("monopad-vfx-preview-emotion-label").textContent = emotion.toUpperCase();

    // Load CSS into editor (custom if saved, otherwise default)
    document.getElementById("monopad-vfx-preview-css-editor").value = getEmotionCss(emotion);
    // Load HTML into editor (custom if saved, otherwise empty)
    document.getElementById("monopad-vfx-preview-html-editor").value = getEmotionHtml(emotion);

    // Load the character's sprite for this emotion
    const $previewImg = $("#monopad-vfx-preview-img");
    $previewImg.removeClass(VFX_ALL_CLASSES);
    const currentSrc = $("#expression-image").attr("src") || "";
    const previewSrc = currentSrc
        ? currentSrc.replace(/\/[^/]+(\.[^/.]+)$/, `/${emotion}$1`)
        : "";
    if (previewSrc) {
        $previewImg[0].onerror = function () { this.onerror = null; this.src = currentSrc; };
        $previewImg[0].src = previewSrc;
    } else {
        $previewImg[0].src = currentSrc;
    }

    const overlay = document.getElementById("monopad-vfx-preview-overlay");
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");

    // Auto-play once the image has settled
    setTimeout(() => playPreviewAnimation(emotion), 220);
}

function closePreview() {
    const overlay = document.getElementById("monopad-vfx-preview-overlay");
    if (overlay) {
        overlay.classList.remove("open");
        overlay.setAttribute("aria-hidden", "true");
    }
    $("#monopad-vfx-preview-img").removeClass(VFX_ALL_CLASSES);
    $(".monopad-vfx-preview-stage-col .dr-vfx-html-overlay").remove();
    currentPreviewEmotion = null;
}

// ── Main modal rendering ──────────────────────────────────────────────────────

function renderModal() {
    const s = getVfxSettings();
    const { groupId, name2 } = getContext();
    const charLabel = groupId ? "GROUP CHAT" : (name2 || "—");

    document.getElementById("monopad-vfx-char-name").textContent = `FOR "${charLabel}"`;

    const masterBtn = document.getElementById("monopad-vfx-master-toggle");
    if (masterBtn) {
        masterBtn.textContent = s.enabled ? "ON" : "OFF";
        masterBtn.classList.toggle("on", s.enabled);
    }

    const allSfxFiles = [...new Set(
        Object.values(VFX_MAP).map(d => d.sfx).filter(Boolean),
    )].sort();

    const $grid = $("#monopad-vfx-emotion-grid");
    $grid.empty();

    for (const [emotion, def] of Object.entries(VFX_MAP)) {
        const emo    = s.emotions[emotion] || {};
        const on     = emo.enabled !== false;
        const muted  = emo.muted === true;
        const vol    = Math.round((emo.volume ?? 0.7) * 100);
        const hasSfx = !!def.sfx;
        const activeSfx = sfxForEmotion(emotion);

        const sfxControls = hasSfx ? `
            <button class="dr-vfx-mute-btn${!muted ? " on" : ""}" data-emotion="${emotion}" title="${muted ? "Unmute SFX" : "Mute SFX"}">${muted ? "🔇" : "🔊"}</button>
            <input type="range" class="dr-vfx-volume-slider" data-emotion="${emotion}" min="0" max="100" value="${vol}" title="Volume: ${vol}%">
            <select class="dr-vfx-sfx-select" data-emotion="${emotion}">
                ${allSfxFiles.map(f => `<option value="${f}"${f === activeSfx ? " selected" : ""}>${f}</option>`).join("")}
            </select>
            <button class="dr-vfx-preview-btn" data-emotion="${emotion}" title="Preview SFX">▶</button>
        ` : "";

        $grid.append(`
            <div class="dr-vfx-emotion-row">
                <div class="dr-vfx-emotion-info">
                    <button class="dr-vfx-emotion-name dr-vfx-emotion-preview-trigger" data-emotion="${emotion}" type="button" title="Open preview">${emotion.toUpperCase()}</button>
                </div>
                <div class="dr-vfx-emotion-controls">
                    ${sfxControls}
                    <button class="dr-vfx-toggle-btn${on ? " on" : ""}" data-emotion="${emotion}">${on ? "ON" : "OFF"}</button>
                </div>
            </div>
        `);
    }
}

function updateConfigureButtonState() {
    const btn = document.getElementById("dangan_configure_vfx");
    if (!btn) return;
    const hasChar = this_chid != null;
    btn.disabled = !hasChar;
    btn.title = hasChar ? "" : "No character selected";
}

function openModal() {
    renderModal();
    const overlay = document.getElementById("monopad-vfx-overlay");
    if (overlay) {
        overlay.classList.add("open");
        overlay.setAttribute("aria-hidden", "false");
    }
}

function closeModal() {
    const overlay = document.getElementById("monopad-vfx-overlay");
    if (overlay) {
        overlay.classList.remove("open");
        overlay.setAttribute("aria-hidden", "true");
    }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function initVfxSystem() {
    setupObserver();
    updateConfigureButtonState();
    eventSource.on(event_types.CHAT_CHANGED, updateConfigureButtonState);

    // ── Main modal ──
    $(document).on("click.dr-vfx", "#dangan_configure_vfx", openModal);
    $(document).on("click.dr-vfx", "#monopad-vfx-close", closeModal);
    $(document).on("click.dr-vfx", "#monopad-vfx-overlay", function (e) {
        if (e.target === this) closeModal();
    });

    $(document).on("click.dr-vfx", "#monopad-vfx-master-toggle", function () {
        const s = getVfxSettings();
        s.enabled = !s.enabled;
        setVfxSettings(s);
        this.textContent = s.enabled ? "ON" : "OFF";
        this.classList.toggle("on", s.enabled);
    });

    $(document).on("click.dr-vfx", "#monopad-vfx-emotion-grid .dr-vfx-toggle-btn", function () {
        const emotion = $(this).data("emotion");
        const s = getVfxSettings();
        const cur = s.emotions[emotion];
        const wasOn = !cur || typeof cur !== "object" ? cur !== false : cur.enabled !== false;
        s.emotions[emotion] = {
            ...(typeof cur === "object" ? cur : {}),
            enabled: !wasOn,
            volume: (typeof cur === "object" ? cur.volume : undefined) ?? 0.7,
        };
        setVfxSettings(s);
        const on = s.emotions[emotion].enabled;
        $(this).toggleClass("on", on).text(on ? "ON" : "OFF");
    });

    $(document).on("click.dr-vfx", "#monopad-vfx-emotion-grid .dr-vfx-mute-btn", function () {
        const emotion = $(this).data("emotion");
        const s = getVfxSettings();
        const cur = s.emotions[emotion];
        const wasMuted = typeof cur === "object" ? !!cur.muted : false;
        s.emotions[emotion] = {
            ...(typeof cur === "object" ? cur : { enabled: true, volume: 0.7 }),
            muted: !wasMuted,
        };
        setVfxSettings(s);
        const muted = s.emotions[emotion].muted;
        $(this)
            .toggleClass("on", !muted)
            .text(muted ? "🔇" : "🔊")
            .attr("title", muted ? "Unmute SFX" : "Mute SFX");
    });

    $(document).on("input.dr-vfx", "#monopad-vfx-emotion-grid .dr-vfx-volume-slider", function () {
        const emotion = $(this).data("emotion");
        const vol = parseInt($(this).val()) / 100;
        const s = getVfxSettings();
        const cur = s.emotions[emotion];
        s.emotions[emotion] = {
            ...(typeof cur === "object" ? cur : { enabled: cur !== false }),
            volume: vol,
        };
        setVfxSettings(s);
        $(this).attr("title", `Volume: ${Math.round(vol * 100)}%`);
    });

    $(document).on("change.dr-vfx", "#monopad-vfx-emotion-grid .dr-vfx-sfx-select", function () {
        const emotion = $(this).data("emotion");
        const sfx = $(this).val();
        const s = getVfxSettings();
        const cur = s.emotions[emotion];
        s.emotions[emotion] = {
            ...(typeof cur === "object" ? cur : { enabled: cur !== false, volume: 0.7 }),
            sfx,
        };
        setVfxSettings(s);
    });

    $(document).on("click.dr-vfx", "#monopad-vfx-emotion-grid .dr-vfx-preview-btn", function () {
        const emotion = $(this).data("emotion");
        const sfxFile = sfxForEmotion(emotion);
        if (!sfxFile) return;
        const audio = new Audio(`${VFX_SFX_BASE}${sfxFile}`);
        audio.volume = volumeForEmotion(emotion);
        audio.play().catch(() => {});
    });

    // ── Accordion toggles ──
    $(document).on("click.dr-vfx", ".monopad-vfx-accordion-header", function () {
        const isExpanded = this.getAttribute("aria-expanded") === "true";
        const panelId = `monopad-vfx-accordion-${$(this).data("accordion")}`;
        const $panel = $(`#${panelId}`);
        this.setAttribute("aria-expanded", isExpanded ? "false" : "true");
        $panel.toggleClass("collapsed", isExpanded);
    });

    // ── Preview modal ──
    $(document).on("click.dr-vfx", "#monopad-vfx-emotion-grid .dr-vfx-emotion-preview-trigger", function () {
        openPreview($(this).data("emotion"));
    });

    $(document).on("click.dr-vfx", "#monopad-vfx-preview-close", closePreview);

    $(document).on("click.dr-vfx", "#monopad-vfx-preview-overlay", function (e) {
        if (e.target === this) closePreview();
    });

    $(document).on("click.dr-vfx", "#monopad-vfx-preview-replay", function () {
        if (!currentPreviewEmotion) return;
        const css = document.getElementById("monopad-vfx-preview-css-editor")?.value || "";
        const html = document.getElementById("monopad-vfx-preview-html-editor")?.value || "";
        saveEmotionCss(currentPreviewEmotion, css);
        saveEmotionHtml(currentPreviewEmotion, html);
        playPreviewAnimation(currentPreviewEmotion);
    });

    $(document).on("click.dr-vfx", "#monopad-vfx-preview-save", function () {
        if (!currentPreviewEmotion) return;
        const css = document.getElementById("monopad-vfx-preview-css-editor")?.value || "";
        const html = document.getElementById("monopad-vfx-preview-html-editor")?.value || "";
        saveEmotionCss(currentPreviewEmotion, css);
        saveEmotionHtml(currentPreviewEmotion, html);
        this.textContent = "SAVED";
        setTimeout(() => { this.textContent = "SAVE"; }, 1200);
    });

    $(document).on("click.dr-vfx", "#monopad-vfx-preview-save-all", function () {
        if (!currentPreviewEmotion) return;
        const css = document.getElementById("monopad-vfx-preview-css-editor")?.value || "";
        const html = document.getElementById("monopad-vfx-preview-html-editor")?.value || "";
        saveEmotionCssForAll(currentPreviewEmotion, css);
        saveEmotionHtmlForAll(currentPreviewEmotion, html);
        this.textContent = "SAVED FOR ALL";
        setTimeout(() => { this.textContent = "SAVE FOR ALL"; }, 1200);
    });

    $(document).on("click.dr-vfx", "#monopad-vfx-preview-reset", function () {
        if (!currentPreviewEmotion) return;
        const defaultCss  = VFX_DEFAULT_CSS[currentPreviewEmotion]  || "";
        const defaultHtml = VFX_DEFAULT_HTML[currentPreviewEmotion] || "";
        document.getElementById("monopad-vfx-preview-css-editor").value  = defaultCss;
        document.getElementById("monopad-vfx-preview-html-editor").value = defaultHtml;
        saveEmotionCss(currentPreviewEmotion, defaultCss);
        saveEmotionHtml(currentPreviewEmotion, defaultHtml);
        playPreviewAnimation(currentPreviewEmotion);
    });

    return function cleanup() {
        $(document).off(".dr-vfx");
        eventSource.removeListener(event_types.CHAT_CHANGED, updateConfigureButtonState);
        if (vfxObserver) { vfxObserver.disconnect(); vfxObserver = null; }
        $("#expression-image").removeClass(VFX_ALL_CLASSES);
        $(".dr-vfx-html-overlay").remove();
        document.getElementById("monopad-vfx-live-css")?.remove();
    };
}

export function onVfxChatChanged() {
    vfxLastExpression = null;
    updateConfigureButtonState();
    const overlay = document.getElementById("monopad-vfx-overlay");
    if (overlay?.classList.contains("open")) renderModal();
}
