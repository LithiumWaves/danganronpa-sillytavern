// School Regulations: the rules list from the Monopad. The AI is told them
// (outside Class Trials) so characters follow them and Monokuma enforces
// them; Monokuma can add new ones, and breaking one brings him in.

export const RULES_PROMPT_KEY = "dangan_rules";
export const RULES_PLACEHOLDER = "{{rules}}";
export const RULE_SOURCES = Object.freeze({ DEFAULT: "default", MONOKUMA: "monokuma", CUSTOM: "custom" });

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
When Monokuma adds a new regulation in the story, write it on its own line: V3C| RULE_ADD: The new rule
When someone clearly breaks a regulation, write on its own line: V3C| RULE_BREAK: Character Full Name`;

function makeId() {
    return `rule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function cleanText(text) {
    return String(text ?? "").replace(/\s+/g, " ").trim();
}

export function createDefaultRules() {
    return DEFAULT_SCHOOL_RULES.map((text, i) => ({ id: `default-${i + 1}`, text, source: RULE_SOURCES.DEFAULT, chapter: 0 }));
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
        out.push({ id, text, source, chapter: Number(r?.chapter) || 0 });
    }
    return out;
}

function sameText(a, b) {
    const k = (s) => cleanText(s).toLowerCase().replace(/[.!]+$/, "");
    return k(a) === k(b);
}

// Adding a rule that's already there changes nothing.
export function addRule(rules, text, { source = RULE_SOURCES.CUSTOM, chapter = 0 } = {}) {
    const list = normalizeRules(rules);
    const clean = cleanText(text);
    if (!clean || list.some((r) => sameText(r.text, clean))) return list;
    return [...list, { id: makeId(), text: clean, source, chapter: Number(chapter) || 0 }];
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
    return normalizeRules(rules).map((r, i) => `${i + 1}. ${r.text}`).join("\n");
}

export function buildRulesPrompt(rules, template = DEFAULT_RULES_PROMPT_TEMPLATE) {
    const list = normalizeRules(rules);
    if (!list.length) return "";
    const lines = formatRulesList(list);
    const text = String(template || DEFAULT_RULES_PROMPT_TEMPLATE).trim();
    return text.includes(RULES_PLACEHOLDER) ? text.split(RULES_PLACEHOLDER).join(lines) : `${text}\n${lines}`;
}

const RULE_MARKER_REGEX = /V3C\s*[|｜]\s*RULE_(ADD|BREAK)\s*:\s*([^\n\r]+)/gi;

// Returns [{ type: "ADD" | "BREAK", text, index }].
export function parseRuleMarkers(text) {
    const out = [];
    for (const m of String(text ?? "").matchAll(RULE_MARKER_REGEX)) {
        const value = cleanText(m[2].replace(/[*_`]+$/g, "").replace(/^[*_`]+/g, ""));
        if (value) out.push({ type: m[1].toUpperCase(), text: value, index: m.index });
    }
    return out;
}

export function stripRuleMarkers(text) {
    return String(text ?? "").replace(/^[ \t]*V3C\s*[|｜]\s*RULE_(ADD|BREAK)\s*:[^\n\r]*(\r?\n)?/gim, "");
}
