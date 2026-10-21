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
