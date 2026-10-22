export function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export function isTypingTarget(el) {
    if (!el) return false;
    const tag = String(el.tagName || "").toUpperCase();
    if (tag === "TEXTAREA" || tag === "SELECT") return true;
    if (tag === "INPUT") {
        const type = String(el.type || "text").toLowerCase();
        return !["checkbox", "radio", "range", "button", "submit"].includes(type);
    }
    return !!el.isContentEditable;
}

// Moves focus to the previous / next element matching `selector` in `container`.
export function stepFocus(container, selector, dir, sfx) {
    const list = Array.from(container.querySelectorAll(selector)).filter((el) => !el.disabled && el.offsetParent !== null);
    if (!list.length) return false;
    const idx = list.indexOf(document.activeElement);
    const next = list[Math.max(0, Math.min(list.length - 1, (idx < 0 ? (dir > 0 ? -1 : list.length) : idx) + dir))];
    if (next && next !== document.activeElement) sfx?.("hover");
    next?.focus({ preventScroll: false });
    next?.scrollIntoView?.({ block: "nearest" });
    return true;
}

// "data/default-user/assets/bgm/Beautiful%20Dead.mp3" → "Beautiful Dead"
export function trackName(path) {
    const file = String(path || "").split("/").pop() || "";
    let name = file;
    try { name = decodeURIComponent(file); } catch { /* keep it encoded */ }
    return name.replace(/\.[^.]+$/, "") || file;
}
