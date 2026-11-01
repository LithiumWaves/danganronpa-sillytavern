// Sprites picked in the expression picker, by character. One pick shows the
// same everywhere: the overworld, the conversation's portrait stage and the
// VN sprites. It lasts until that character's next line or the next shuffle
// of locations (index.js and overworldScene.js clear it).

const picks = new Map(); // name key → { path, expression }
const listeners = new Set();

function keyOf(name) {
    return String(name || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function changed() {
    for (const fn of listeners) {
        try { fn(); } catch { /* ignore */ }
    }
}

export function setPickedSprite(name, path, expression = null) {
    const key = keyOf(name);
    if (!key || !path) return;
    picks.set(key, { path: String(path), expression: expression || null });
    changed();
}

export function getPickedSprite(name) {
    return picks.get(keyOf(name)) || null;
}

export function clearPickedSprite(name) {
    if (picks.delete(keyOf(name))) changed();
}

export function clearPickedSprites() {
    if (!picks.size) return;
    picks.clear();
    changed();
}

export function onPickedSpritesChanged(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}
