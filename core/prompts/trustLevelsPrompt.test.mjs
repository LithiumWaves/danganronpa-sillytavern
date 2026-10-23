import { buildTrustLevelsPrompt, formatTrustLevelLine, trustBand } from "./trustLevelsPrompt.js";
import { DEFAULT_GAMEPLAY_PROMPT_TEMPLATES } from "../constants.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

const template = DEFAULT_GAMEPLAY_PROMPT_TEMPLATES.markerTrustLevels;
assert(template && template.includes("{{trust_levels}}"), "default template has the placeholder");
assert(!/\{\{(?!trust_levels\}\})/.test(template), "no other macros");

assert(trustBand(10) === "unshakable bond", "max");
assert(trustBand(8).startsWith("close"), "7-9");
assert(trustBand(4).startsWith("friendly"), "4-6");
assert(trustBand(1).startsWith("acquaintance"), "1-3");
assert(trustBand(-2).startsWith("wary"), "distrust 1-3");
assert(trustBand(-5).startsWith("hostile"), "distrust 4-6");
assert(trustBand(-10).startsWith("sees them"), "distrust 7-10");

assert(formatTrustLevelLine("Kaede", 4) === "- Kaede: Trust 4/10 (friendly, trust is growing)", "trust line");
assert(formatTrustLevelLine("Kokichi", -3) === "- Kokichi: Distrust 3/10 (wary, suspicious)", "distrust line");

assert(buildTrustLevelsPrompt({ template, entries: [] }) === "", "nobody, nothing sent");
const text = buildTrustLevelsPrompt({ template, entries: [{ name: "Kaede", level: 4 }, { name: "Kokichi", level: -3 }] });
assert(text.startsWith("[TRUST LEVELS]") && text.includes("- Kaede: Trust 4/10") && text.includes("- Kokichi: Distrust 3/10"), "lists everyone");
assert(!text.includes("{{"), "placeholder replaced");
assert(buildTrustLevelsPrompt({ template: "MINE", entries: [{ name: "A", level: 2 }] }) === "MINE\n- A: Trust 2/10 (acquaintance, still cautious)", "no placeholder: appended");
assert(buildTrustLevelsPrompt({ template: "", entries: [{ name: "A", level: 2 }] }) === "", "emptied template sends nothing");

console.log("trustLevelsPrompt tests passed");
