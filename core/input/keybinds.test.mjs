import { actionForBinding, bindingFromKeyEvent, bindingFromMouseEvent, defaultKeybinds, keybindLabel, resolveKeybinds } from "./keybinds.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

const key = (code, mods = {}) => ({ code, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...mods });

assert(bindingFromKeyEvent(key("KeyM")) === "KeyM", "plain key");
assert(bindingFromKeyEvent(key("KeyT", { ctrlKey: true, shiftKey: true })) === "Ctrl+Shift+KeyT", "modifiers in a fixed order");
assert(bindingFromKeyEvent(key("Escape")) === null, "escape can't be bound");
assert(bindingFromKeyEvent(key("ShiftLeft", { shiftKey: true })) === null, "a lone modifier can't be bound");
assert(bindingFromMouseEvent({ button: 2 }) === "Mouse2", "right click");
assert(bindingFromMouseEvent({ button: 0 }) === null, "left click can't be bound");

assert(keybindLabel("Mouse2") === "RIGHT CLICK", "right click label");
assert(keybindLabel("KeyM") === "M", "letter label");
assert(keybindLabel("Ctrl+Digit1") === "CTRL + 1", "modifier label");
assert(keybindLabel("ArrowUp") === "UP", "arrow label");
assert(keybindLabel("") === "—", "unbound");

const binds = resolveKeybinds({ monopad: "KeyP", topBar: "", bogus: "KeyX" });
assert(binds.monopad === "KeyP" && binds.topBar === "" && !("bogus" in binds), "saved over defaults");
assert(binds.expressions === defaultKeybinds().expressions, "missing ones keep their default");
assert(actionForBinding(binds, "KeyP") === "monopad", "finds the action");
assert(actionForBinding(binds, "") === null, "unbound matches nothing");
assert(actionForBinding(resolveKeybinds(), "Mouse2") === "topBar", "right click shows the bar by default");

console.log("keybinds tests passed");
