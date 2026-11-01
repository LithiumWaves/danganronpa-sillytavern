// Colors for the song, chapter and map displays (Settings → Customize).
//
// Each display follows the phase colors, the text box style's accent, or a
// color the player picks. With a color, index.js sets
// `dangan-hud-color-<target>` on <body> plus these vars, and
// styles/systems/hud/hud-colors.css recolors the display from them.

export const HUD_COLOR_TARGETS = Object.freeze(["song", "chapter", "map"]);
export const HUD_COLOR_MODES = Object.freeze(["phase", "textbox", "custom"]);
export const HUD_COLOR_DEFAULT = "#f59a1b";

export function normalizeHudColorMode(value) {
    return HUD_COLOR_MODES.includes(value) ? value : "phase";
}

// "#rgb", "#rrggbb" or "rgb(r, g, b)" → [r, g, b], or null.
export function parseColor(value) {
    const text = String(value || "").trim().toLowerCase();
    let m = /^#([0-9a-f]{3})$/.exec(text);
    if (m) return [...m[1]].map((c) => parseInt(c + c, 16));
    m = /^#([0-9a-f]{6})$/.exec(text);
    if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
    m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(text);
    if (m) return [m[1], m[2], m[3]].map((n) => Math.min(255, Number(n)));
    return null;
}

export function toHex([r, g, b]) {
    return "#" + [r, g, b].map((n) => Math.round(n).toString(16).padStart(2, "0")).join("");
}

function toHsl([r, g, b]) {
    const [rn, gn, bn] = [r / 255, g / 255, b / 255];
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    const d = max - min;
    if (!d) return [0, 0, l];
    const s = d / (1 - Math.abs(2 * l - 1));
    let h;
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    return [(h * 60 + 360) % 360, s, l];
}

// A CSS filter that turns colored art (whatever its own hue) into shades of
// `color`: flatten to gray, warm it with sepia (hue ≈ 38°), then turn and
// saturate it to the target. Grays just get lightened or darkened.
export function tintFilterFor(color) {
    const rgb = parseColor(color);
    if (!rgb) return "none";
    const [h, s, l] = toHsl(rgb);
    const brightness = (0.55 + l * 0.9).toFixed(2);
    if (s < 0.08) return `grayscale(1) brightness(${brightness})`;
    const rotate = Math.round(((h - 38) % 360 + 360) % 360);
    const saturate = (1.5 + s * 4.5).toFixed(2);
    return `grayscale(1) sepia(1) hue-rotate(${rotate}deg) saturate(${saturate}) brightness(${brightness})`;
}

// The color a display should use, or null to keep the phase colors.
// `skinAccent` is the text box style's current accent ("" for Classic).
export function resolveHudColor({ mode, custom, skin, skinAccent, trialActive = false } = {}) {
    const m = normalizeHudColorMode(mode);
    if (m === "custom") {
        const rgb = parseColor(custom);
        return rgb ? toHex(rgb) : null;
    }
    if (m === "textbox") {
        if (trialActive || !skin || skin === "current") return null;
        const rgb = parseColor(skinAccent);
        return rgb ? toHex(rgb) : null;
    }
    return null;
}

// The body vars for one display, or null when it keeps the phase colors.
export function hudColorVars(target, color) {
    const rgb = parseColor(color);
    if (!rgb) return null;
    return {
        [`--dangan-hud-${target}-rgb`]: rgb.join(", "),
        [`--dangan-hud-${target}-hex`]: toHex(rgb),
        [`--dangan-hud-${target}-tint`]: tintFilterFor(toHex(rgb)),
    };
}
