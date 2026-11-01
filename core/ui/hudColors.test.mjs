import { hudColorVars, normalizeHudColorMode, parseColor, resolveHudColor, tintFilterFor } from "./hudColors.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

function run() {
    assert(String(parseColor("#f59a1b")) === "245,154,27", "parses #rrggbb");
    assert(String(parseColor("#fd0")) === "255,221,0", "parses #rgb");
    assert(String(parseColor(" rgb(95, 224, 90) ")) === "95,224,90", "parses rgb() as getComputedStyle returns it");
    assert(parseColor("blue") === null && parseColor("") === null, "anything else is no color");

    assert(normalizeHudColorMode("textbox") === "textbox" && normalizeHudColorMode("nope") === "phase", "unknown modes are phase");

    assert(resolveHudColor({ mode: "phase", custom: "#ff0000" }) === null, "phase keeps the phase colors");
    assert(resolveHudColor({ mode: "custom", custom: "#FF0000" }) === "#ff0000", "custom uses the picked color");
    assert(resolveHudColor({ mode: "custom", custom: "oops" }) === null, "a broken custom color falls back to phase");
    assert(resolveHudColor({ mode: "textbox", skin: "v3", skinAccent: " #5fe05a" }) === "#5fe05a", "text box follows the style's accent");
    assert(resolveHudColor({ mode: "textbox", skin: "current", skinAccent: "#ffffff" }) === null, "Classic has no accent: phase colors");
    assert(resolveHudColor({ mode: "textbox", skin: "thh", skinAccent: "#f59a1b", trialActive: true }) === null, "Class Trials keep the phase colors");

    const orange = tintFilterFor("#f59a1b");
    assert(/^grayscale\(1\) sepia\(1\) hue-rotate\(\d+deg\) saturate\([\d.]+\) brightness\([\d.]+\)$/.test(orange), "a color tints through sepia");
    assert(tintFilterFor("#808080").startsWith("grayscale(1) brightness("), "gray just lightens or darkens");
    assert(tintFilterFor("nope") === "none", "no color, no filter");

    const vars = hudColorVars("map", "#5fe05a");
    assert(vars["--dangan-hud-map-rgb"] === "95, 224, 90" && vars["--dangan-hud-map-hex"] === "#5fe05a" && vars["--dangan-hud-map-tint"].includes("hue-rotate"), "vars for a display");
    assert(hudColorVars("map", null) === null, "no color, no vars");

    console.log("hudColors tests passed");
}

run();
