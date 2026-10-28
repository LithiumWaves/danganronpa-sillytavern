// School Regulations: the rules list from the Monopad. The AI is told them
// (outside Class Trials) so characters follow them and Monokuma enforces
// them; Monokuma can add new ones, and breaking one brings him in.

export const RULES_PROMPT_KEY = "dangan_rules";
export const RULES_PLACEHOLDER = "{{rules}}";
export const RULE_SOURCES = Object.freeze({ DEFAULT: "default", MONOKUMA: "monokuma", CUSTOM: "custom" });
// Light: Monokuma scolds and threatens. Grave: Monokuma punishes by death.
export const RULE_SEVERITY = Object.freeze({ LIGHT: "light", GRAVE: "grave" });
// The default that's grave: violence against Monokuma or the cameras.
const GRAVE_DEFAULT_IDS = new Set(["default-5"]);

export const DEFAULT_SCHOOL_RULES = Object.freeze([
    "Students may only live inside the school. Leaving is not allowed.",
    "Nighttime is from 10 p.m. to 7 a.m. Some areas are off-limits at night, like the dining hall.",
    "Sleeping anywhere other than your own dorm room is forbidden.",
    "You may explore the school freely.",
    "Violence against the headmaster, Monokuma, is forbidden, as is damaging the surveillance cameras.",
    "A student who kills another becomes the blackened and graduates, unless they are found out at the Class Trial.",
    "More school regulations may be added as needed.",
]);

export const DEFAULT_RULES_PROMPT_TEMPLATE = `[SCHOOL REGULATIONS]
The school's rules. Characters know them and mostly follow them; Monokuma enforces them, and breaking one has consequences.
{{rules}}
When Monokuma adds a new regulation in the story, write it on its own line: V3C| RULE_ADD: The new rule (end it with | grave if he says breaking it is punished by death)
When someone clearly breaks a regulation, write on its own line, with the regulation's number: V3C| RULE_BREAK: Character Full Name | 5`;

function makeId() {
    return `rule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function cleanText(text) {
    return String(text ?? "").replace(/\s+/g, " ").trim();
}

export function createDefaultRules() {
    return DEFAULT_SCHOOL_RULES.map((text, i) => ({
        id: `default-${i + 1}`,
        text,
        source: RULE_SOURCES.DEFAULT,
        chapter: 0,
        severity: GRAVE_DEFAULT_IDS.has(`default-${i + 1}`) ? RULE_SEVERITY.GRAVE : RULE_SEVERITY.LIGHT,
    }));
}

// A save without rules yet (null/undefined) starts with the defaults; an empty
// list stays empty (the player deleted them all).
export function normalizeRules(rules) {
    if (!Array.isArray(rules)) return createDefaultRules();
    const seen = new Set();
    const out = [];
    for (const r of rules) {
        const text = cleanText(typeof r === "string" ? r : r?.text);
        if (!text) continue;
        let id = String(r?.id || "") || makeId();
        while (seen.has(id)) id = makeId();
        seen.add(id);
        const source = Object.values(RULE_SOURCES).includes(r?.source) ? r.source : RULE_SOURCES.CUSTOM;
        // Older saves had no severity: the violence default is grave.
        const severity = Object.values(RULE_SEVERITY).includes(r?.severity) ? r.severity
            : GRAVE_DEFAULT_IDS.has(id) && source === RULE_SOURCES.DEFAULT ? RULE_SEVERITY.GRAVE : RULE_SEVERITY.LIGHT;
        out.push({ id, text, source, chapter: Number(r?.chapter) || 0, severity });
    }
    return out;
}

function sameText(a, b) {
    const k = (s) => cleanText(s).toLowerCase().replace(/[.!]+$/, "");
    return k(a) === k(b);
}

// Adding a rule that's already there changes nothing.
export function addRule(rules, text, { source = RULE_SOURCES.CUSTOM, chapter = 0, severity = RULE_SEVERITY.LIGHT } = {}) {
    const list = normalizeRules(rules);
    const clean = cleanText(text);
    if (!clean || list.some((r) => sameText(r.text, clean))) return list;
    return [...list, { id: makeId(), text: clean, source, chapter: Number(chapter) || 0, severity: severity === RULE_SEVERITY.GRAVE ? RULE_SEVERITY.GRAVE : RULE_SEVERITY.LIGHT }];
}

export function setRuleSeverity(rules, id, severity) {
    return normalizeRules(rules).map((r) => (r.id === id ? { ...r, severity: severity === RULE_SEVERITY.GRAVE ? RULE_SEVERITY.GRAVE : RULE_SEVERITY.LIGHT } : r));
}

// The rule a RULE_BREAK marker names by number (1-based), or null.
export function ruleByNumber(rules, number) {
    const n = Math.round(Number(number));
    const list = normalizeRules(rules);
    return n >= 1 && n <= list.length ? { ...list[n - 1], number: n } : null;
}

export function removeRule(rules, id) {
    return normalizeRules(rules).filter((r) => r.id !== id);
}

// An edited default stays marked as Monokuma's or a default; an emptied rule is removed.
export function editRule(rules, id, text) {
    const clean = cleanText(text);
    if (!clean) return removeRule(rules, id);
    return normalizeRules(rules).map((r) => (r.id === id ? { ...r, text: clean } : r));
}

export function formatRulesList(rules) {
    return normalizeRules(rules).map((r, i) => `${i + 1}. ${r.text}${r.severity === RULE_SEVERITY.GRAVE ? " (Monokuma punishes breaking this one by death.)" : ""}`).join("\n");
}

export function buildRulesPrompt(rules, template = DEFAULT_RULES_PROMPT_TEMPLATE) {
    const list = normalizeRules(rules);
    if (!list.length) return "";
    const lines = formatRulesList(list);
    const text = String(template || DEFAULT_RULES_PROMPT_TEMPLATE).trim();
    return text.includes(RULES_PLACEHOLDER) ? text.split(RULES_PLACEHOLDER).join(lines) : `${text}\n${lines}`;
}

const RULE_MARKER_REGEX = /V3C\s*[|｜]\s*RULE_(ADD|BREAK)\s*:\s*([^\n\r]+)/gi;

// Returns [{ type: "ADD" | "BREAK", text, index }]. An ADD may end in
// "| grave" (severity); a BREAK names the regulation's number after "|"
// (ruleNumber, 0 when it doesn't).
export function parseRuleMarkers(text) {
    const out = [];
    for (const m of String(text ?? "").matchAll(RULE_MARKER_REGEX)) {
        const value = cleanText(m[2].replace(/[*_`]+$/g, "").replace(/^[*_`]+/g, ""));
        if (!value) continue;
        const type = m[1].toUpperCase();
        const [head, tail = ""] = value.split(/\s*[|｜]\s*/);
        if (type === "ADD") {
            const grave = /^grave$/i.test(tail.trim());
            const ruleText = /^(grave|light)$/i.test(tail.trim()) ? head : value;
            if (ruleText) out.push({ type, text: ruleText, severity: grave ? RULE_SEVERITY.GRAVE : RULE_SEVERITY.LIGHT, index: m.index });
        } else if (head) {
            out.push({ type, text: head, ruleNumber: Math.max(0, parseInt(tail.replace(/[^0-9]/g, ""), 10) || 0), index: m.index });
        }
    }
    return out;
}

// The one-time notes after someone breaks a regulation ({{name}},
// {{number}}, {{rule}}). Light: Monokuma scolds and threatens. Grave:
// Monokuma has executed them; his next reply narrates it. Warning: the
// player broke a grave rule and gets a final warning (the game never kills
// the player).
export const DEFAULT_RULE_BREAK_LIGHT_TEMPLATE = `[RULE BROKEN]
{{name}} just broke School Regulation {{number}}: "{{rule}}". Monokuma storms in to scold them and threaten what happens next time. Play it out now; nobody is hurt.`;
export const DEFAULT_RULE_BREAK_GRAVE_TEMPLATE = `[PUNISHMENT]
{{name}} broke School Regulation {{number}}: "{{rule}}". Monokuma has punished them on the spot, like Mukuro in the first game: {{name}} is dead. Narrate it now, swift and shocking, and everyone's horror. {{name}} never speaks again.`;
export const DEFAULT_RULE_BREAK_WARNING_TEMPLATE = `[FINAL WARNING]
{{name}} broke School Regulation {{number}}: "{{rule}}", one Monokuma punishes by death. This once he holds back: he gives {{name}} a terrifying final warning. Play it out now.`;

export function buildRuleBreakNote({ name = "", rule = null, outcome = "light", template = "" } = {}) {
    const fallback = outcome === "grave" ? DEFAULT_RULE_BREAK_GRAVE_TEMPLATE : outcome === "warning" ? DEFAULT_RULE_BREAK_WARNING_TEMPLATE : DEFAULT_RULE_BREAK_LIGHT_TEMPLATE;
    return String(template || fallback)
        .replace(/\{\{name\}\}/g, cleanText(name) || "Someone")
        .replace(/\{\{number\}\}/g, rule?.number ? String(rule.number) : "?")
        .replace(/\{\{rule\}\}/g, rule?.text || "a school regulation");
}

export function stripRuleMarkers(text) {
    return String(text ?? "").replace(/^[ \t]*V3C\s*[|｜]\s*RULE_(ADD|BREAK)\s*:[^\n\r]*(\r?\n)?/gim, "");
}
