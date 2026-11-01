// Keybinds (Settings → Customize → Keybinds). A binding is a string:
// a key as its physical code with any modifiers ("KeyM", "Ctrl+KeyT",
// "Shift+Digit1"), or a mouse button ("Mouse1" middle, "Mouse2" right).
// "" means unbound. Keybinds never fire while typing.

export const KEYBIND_ACTIONS = Object.freeze([
    { id: "topBar", label: "Show SillyTavern's bar", note: "Brings the bar (top or side) in, or tucks it away.", fallback: "Mouse2" },
    { id: "monopad", label: "Open / close the Monopad", fallback: "KeyM" },
    { id: "transcript", label: "Transcript", note: "In visual novel mode.", fallback: "KeyL" },
    { id: "expressions", label: "Expression picker", fallback: "KeyE" },
    { id: "hideUi", label: "Hide the interface", note: "Any click brings it back.", fallback: "KeyH" },
]);

// Keys that can't be bound: they are how the binding is cleared or
// cancelled, or plain modifiers.
const UNBINDABLE = new Set(["Escape", "Backspace", "Delete", "ShiftLeft", "ShiftRight", "ControlLeft", "ControlRight", "AltLeft", "AltRight", "MetaLeft", "MetaRight", "Tab"]);

export function defaultKeybinds() {
    return Object.fromEntries(KEYBIND_ACTIONS.map((a) => [a.id, a.fallback]));
}

// Saved bindings over the defaults; unknown actions are dropped.
export function resolveKeybinds(saved) {
    const out = defaultKeybinds();
    if (saved && typeof saved === "object") {
        for (const a of KEYBIND_ACTIONS) {
            if (typeof saved[a.id] === "string") out[a.id] = saved[a.id];
        }
    }
    return out;
}

function modifierPrefix(event) {
    return `${event.ctrlKey ? "Ctrl+" : ""}${event.altKey ? "Alt+" : ""}${event.shiftKey ? "Shift+" : ""}${event.metaKey ? "Meta+" : ""}`;
}

// The binding a keydown makes, or null for keys that can't be bound.
export function bindingFromKeyEvent(event) {
    const code = String(event?.code || "");
    if (!code || UNBINDABLE.has(code)) return null;
    return `${modifierPrefix(event)}${code}`;
}

// The binding a mouse button makes (middle and right only; left is clicking).
export function bindingFromMouseEvent(event) {
    const button = Number(event?.button);
    if (button !== 1 && button !== 2) return null;
    return `${modifierPrefix(event)}Mouse${button}`;
}

export function keybindLabel(binding) {
    if (!binding) return "—";
    const parts = String(binding).split("+");
    const main = parts.pop();
    const name = main === "Mouse2" ? "RIGHT CLICK"
        : main === "Mouse1" ? "MIDDLE CLICK"
        : /^Key[A-Z]$/.test(main) ? main.slice(3)
        : /^Digit\d$/.test(main) ? main.slice(5)
        : /^Numpad\d$/.test(main) ? `NUM ${main.slice(6)}`
        : /^F\d{1,2}$/.test(main) ? main
        : main === "Space" ? "SPACE"
        : main.replace(/^Arrow/, "").replace(/([a-z])([A-Z])/g, "$1 $2").toUpperCase();
    return [...parts.map((p) => p.toUpperCase()), name].join(" + ");
}

// Typing in a field, or in anything editable, never triggers a keybind.
export function isTypingTarget(target) {
    if (!target || typeof target.closest !== "function") return false;
    if (target.isContentEditable) return true;
    return !!target.closest("input, textarea, select, [contenteditable='true'], [contenteditable='']");
}

// Which action a binding triggers, if any.
export function actionForBinding(binds, binding) {
    if (!binding) return null;
    for (const [id, b] of Object.entries(binds || {})) {
        if (b && b === binding) return id;
    }
    return null;
}
