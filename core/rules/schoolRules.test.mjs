import { DEFAULT_RULE_MARKER_TEMPLATE, DEFAULT_SCHOOL_RULES, RULE_SEVERITY, buildRuleCheckPrompt, mightBreakRule, parseRuleCheckAnswer, addRule, buildRuleBreakNote, formatRulesList, ruleByNumber, setRuleSeverity, buildRulesPrompt, createDefaultRules, editRule, normalizeRules, parseRuleMarkers, removeRule, stripRuleMarkers } from "./schoolRules.js";

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
    assert(prompt.includes("[SCHOOL REGULATIONS]") && prompt.includes("8. No running in the halls.") && prompt.includes("RULE markers"), "prompt");
    assert(DEFAULT_RULE_MARKER_TEMPLATE.includes("V3C| RULE_BREAK: Character Full Name | 5") && DEFAULT_RULE_MARKER_TEMPLATE.includes("V3C| RULE_ADD") && !DEFAULT_RULE_MARKER_TEMPLATE.includes("{{"), "the marker block");
    assert(buildRulesPrompt([]) === "", "no rules, no prompt");
    assert(buildRulesPrompt(createDefaultRules(), "Rules:").startsWith("Rules:\n1. "), "template without the placeholder");

    const markers = parseRuleMarkers("He grins.\nV3C| RULE_ADD: **No sleeping in class.**\nV3C｜RULE_BREAK: Kokichi Ouma\n");
    assert(markers.length === 2 && markers[0].type === "ADD" && markers[0].text === "No sleeping in class." && markers[1].type === "BREAK" && markers[1].text === "Kokichi Ouma", "markers parsed");
    assert(stripRuleMarkers("A\nV3C| RULE_ADD: x\nB") === "A\nB", "markers stripped");

    // Phase J: severity.
    {
        const rules = createDefaultRules();
        assert(rules[4].severity === "grave" && rules.filter((r) => r.severity === "grave").length === 1, "violence against Monokuma is grave");
        assert(normalizeRules([{ id: "default-5", text: "Violence…", source: "default" }])[0].severity === "grave", "old saves: the default is grave");
        assert(normalizeRules([{ id: "default-5", text: "x", source: "custom" }])[0].severity === "light", "only the default one");
        assert(formatRulesList(rules).includes("5. Violence") && formatRulesList(rules).includes("punishes breaking this one by death"), "the prompt marks grave rules");
        const changed = setRuleSeverity(rules, "default-1", RULE_SEVERITY.GRAVE);
        assert(changed[0].severity === "grave" && setRuleSeverity(changed, "default-1", "light")[0].severity === "light", "toggle");
        assert(addRule(rules, "No fighting", { severity: "grave" }).at(-1).severity === "grave" && addRule(rules, "No yelling").at(-1).severity === "light", "added rules are light unless grave");
        assert(ruleByNumber(rules, 5).id === "default-5" && ruleByNumber(rules, 5).number === 5 && ruleByNumber(rules, 99) === null, "by number");

        const m = parseRuleMarkers("V3C| RULE_ADD: No fighting | grave\nV3C| RULE_ADD: No a|b rule\nV3C| RULE_BREAK: Mondo Owada | 5\nV3C| RULE_BREAK: Hifumi");
        assert(m[0].text === "No fighting" && m[0].severity === "grave", "RULE_ADD | grave");
        assert(m[1].text === "No a|b rule" && m[1].severity === "light", "a bar that isn't a severity stays");
        assert(m[2].text === "Mondo Owada" && m[2].ruleNumber === 5 && m[3].ruleNumber === 0, "RULE_BREAK with a number");

        const note = buildRuleBreakNote({ name: "Mondo", rule: ruleByNumber(rules, 5), outcome: "grave" });
        assert(note.startsWith("[PUNISHMENT]") && note.includes("Regulation 5") && note.includes("Mondo is dead"), "grave note");
        assert(buildRuleBreakNote({ name: "Me", outcome: "warning" }).startsWith("[FINAL WARNING]") && buildRuleBreakNote({ name: "X" }).includes("Regulation ?"), "warning and light notes");
    }

    // Catching violations the AI didn't mark.
    {
        const rules = createDefaultRules();
        assert(mightBreakRule("Mondo punched Monokuma square in the face.", rules), "violence near Monokuma");
        assert(mightBreakRule("She threw a chair. It flew across the room and smashed into the camera.", rules), "a camera");
        assert(!mightBreakRule("Monokuma laughed and waved.", rules), "no violence");
        assert(!mightBreakRule("He punched the wall in frustration.", rules), "violence, but not at Monokuma");
        assert(!mightBreakRule("", rules), "empty");
        const p = buildRuleCheckPrompt({ rules, reply: "Mondo punched Monokuma." });
        assert(p.includes("5. Violence") && p.includes("Mondo punched Monokuma.") && !p.includes("{{"), "check prompt");
        assert(parseRuleCheckAnswer("NONE") === null && parseRuleCheckAnswer("none.") === null && parseRuleCheckAnswer("") === null, "NONE");
        const a = parseRuleCheckAnswer("<think>hmm</think>\nMondo Owada | 5");
        assert(a?.name === "Mondo Owada" && a.ruleNumber === 5, "an answer");
        assert(parseRuleCheckAnswer("V3C| RULE_BREAK: Mondo Owada | 5")?.ruleNumber === 5, "an answer written as a marker");
        assert(parseRuleCheckAnswer("Mondo Owada") === null, "no number, no violation");
    }

    console.log("schoolRules tests passed");
}

run();
