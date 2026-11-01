// The V3C marker instructions the extension gives the AI itself, so players
// don't paste them into their preset. Only the markers that make sense in the
// current phase are sent: evidence during investigations, announcements and
// the investigation start during daily life, and nothing during Class Trials,
// which build their own context.

export const MARKER_PROMPT_KEY = "dangan_marker_rules";

// Template keys in DEFAULT_GAMEPLAY_PROMPT_TEMPLATES, and the setting that
// holds each one's edited text ("" means the default).
export const MARKER_BLOCKS = Object.freeze({
    truth: { templateKey: "markerTruth", settingKey: "markerTruthPromptTemplate" },
    social: { templateKey: "markerSocial", settingKey: "markerSocialPromptTemplate" },
    investigation: { templateKey: "markerInvestigation", settingKey: "markerInvestigationPromptTemplate" },
    announcements: { templateKey: "markerAnnouncements", settingKey: "markerAnnouncementsPromptTemplate" },
    events: { templateKey: "markerEvents", settingKey: "markerEventsPromptTemplate" },
    rules: { templateKey: "markerRules", settingKey: "markerRulesPromptTemplate" },
    // Not a marker block: sent on its own (core/prompts/trustLevelsPrompt.js),
    // listed here so it is edited and reset like the others.
    trustLevels: { templateKey: "markerTrustLevels", settingKey: "markerTrustLevelsPromptTemplate" },
});

const BLOCKS_BY_PHASE = {
    DAY: ["social", "investigation", "announcements", "events", "rules"],
    NIGHT: ["social", "investigation", "announcements", "events", "rules"],
    INVESTIGATION: ["truth", "social", "rules"],
    TRIAL: [],
};

const HEADER = "[STORY MARKERS]\nThe lines below describe hidden markers this game reads from your replies. Write a marker exactly as shown, on its own line. The reader never sees markers, so never mention or explain them, and characters never react to them.";

export function selectMarkerBlocks(phase) {
    return BLOCKS_BY_PHASE[phase] || BLOCKS_BY_PHASE.DAY;
}

// `getTemplate(blockId)` returns the text to use for a block (edited or default).
export function buildMarkerPrompt({ enabled, phase, getTemplate } = {}) {
    if (!enabled) return "";
    const parts = selectMarkerBlocks(phase)
        .map((id) => String(getTemplate?.(id) ?? "").trim())
        .filter(Boolean);
    return parts.length ? [HEADER, ...parts].join("\n\n") : "";
}

// Whether a preset already carries pasted V3C instructions.
export function textHasMarkerInstructions(text) {
    return /V3C\s*[|｜]\s*(TB|SOCIAL|INVESTIGATION)/i.test(String(text ?? ""));
}
