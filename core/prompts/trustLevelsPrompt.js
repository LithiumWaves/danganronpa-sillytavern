// Trust levels the AI is told about (Settings → AI instructions → Trust
// levels): how each character in the chat currently feels about the player.
// Hosts, the dead and the missing are left out by index.js before this runs.

export const TRUST_LEVELS_PROMPT_KEY = "dangan_trust_levels";
export const TRUST_LEVELS_PLACEHOLDER = "{{trust_levels}}";

// What a level means, in a few words.
export function trustBand(level) {
    const n = Number(level) || 1;
    if (n >= 10) return "unshakable bond";
    if (n >= 7) return "close, confides in them";
    if (n >= 4) return "friendly, trust is growing";
    if (n >= 1) return "acquaintance, still cautious";
    if (n >= -3) return "wary, suspicious";
    if (n >= -6) return "hostile, keeps away";
    return "sees them as an enemy";
}

export function formatTrustLevelLine(name, level) {
    const n = Number(level) || 1;
    const kind = n < 0 ? "Distrust" : "Trust";
    return `- ${name}: ${kind} ${Math.abs(n)}/10 (${trustBand(n)})`;
}

// `entries` is [{ name, level }]. Returns "" when nobody qualifies.
export function buildTrustLevelsPrompt({ template, entries } = {}) {
    const list = (Array.isArray(entries) ? entries : []).filter((e) => e?.name);
    if (!list.length) return "";
    const lines = list.map((e) => formatTrustLevelLine(e.name, e.level ?? 1)).join("\n");
    const text = String(template || "").trim();
    if (!text) return "";
    return text.includes(TRUST_LEVELS_PLACEHOLDER)
        ? text.split(TRUST_LEVELS_PLACEHOLDER).join(lines)
        : `${text}\n${lines}`;
}
