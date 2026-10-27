import { DEFAULT_SCHOOL_RULES, addRule, buildRulesPrompt, createDefaultRules, editRule, normalizeRules, parseRuleMarkers, removeRule, stripRuleMarkers } from "./schoolRules.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

function run() {
    const defaults = normalizeRules(undefined);
    assert(defaults.length === DEFAULT_SCHOOL_RULES.length && defaults.every((r) => r.source === "default"), "a new save gets the defaults");
    assert(normalizeRules([]).length === 0, "an emptied list stays empty");
    assert(normalizeRules(["Be nice", { text: "  " }])[0].source === "custom" && normalizeRules(["Be nice", ""]).length === 1, "strings and blanks");

    const added = addRule(defaults, "No running in the halls.", { source: "monokuma", chapter: 2 });
    const rule = added[added.length - 1];
    assert(added.length === 8 && rule.source === "monokuma" && rule.chapter === 2, "rule added");
    assert(addRule(added, "no running in the halls").length === 8, "no duplicates");
    assert(editRule(added, rule.id, "No sprinting.").find((r) => r.id === rule.id).text === "No sprinting.", "edited");
    assert(editRule(added, rule.id, " ").length === 7 && removeRule(added, rule.id).length === 7, "removed");
    assert(removeRule(added, "default-1")[0].id === "default-2", "remove a default");

    const prompt = buildRulesPrompt(added);
    assert(prompt.includes("[SCHOOL REGULATIONS]") && prompt.includes("8. No running in the halls.") && prompt.includes("V3C| RULE_ADD"), "prompt");
    assert(buildRulesPrompt([]) === "", "no rules, no prompt");
    assert(buildRulesPrompt(createDefaultRules(), "Rules:").startsWith("Rules:\n1. "), "template without the placeholder");

    const markers = parseRuleMarkers("He grins.\nV3C| RULE_ADD: **No sleeping in class.**\nV3C｜RULE_BREAK: Kokichi Ouma\n");
    assert(markers.length === 2 && markers[0].type === "ADD" && markers[0].text === "No sleeping in class." && markers[1].type === "BREAK" && markers[1].text === "Kokichi Ouma", "markers parsed");
    assert(stripRuleMarkers("A\nV3C| RULE_ADD: x\nB") === "A\nB", "markers stripped");

    console.log("schoolRules tests passed");
}

run();
