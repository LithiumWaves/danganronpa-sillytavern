export function normalizeList(text, max = 5) {
    if (!text || text === "unknown") return text;

    const items = text
        .split(",")
        .map(i => i.trim())
        .filter(Boolean);

    return [...new Set(items)].slice(0, max).join(", ");
}

export function extractUltimateFromNotes(notes) {
    if (!notes) return null;

    const match = notes.match(/^ultimate:\s*(.+)$/im);
    if (!match) return null;

    const value = match[1].trim();
    return value !== "unknown" ? value : null;
}

export function normalizeName(name) {
    return name
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}

export function isIgnoredCharacter(name) {
    if (!name) return true;

    const n = normalizeName(name);

    return (
        n === "assistant" ||
        n === "system" ||
        n === "narrator" ||
        n === "usami" ||
        n.includes("api") ||
        n.includes("helper") ||
        n.includes("assistant") ||
        n.includes("mono") ||
        n.includes("tool")
    );
}

export function lookupUltimateFromLorebook(characterName) {
    const ctxEntries = window.SillyTavern?.getContext?.()?.worldInfoData?.entries
        ?? window.SillyTavern?.getContext?.()?.world_info?.entries;
    const entries = ctxEntries ?? window.world_info?.entries;
    if (!Array.isArray(entries)) return null;

    const normalized = normalizeName(characterName);

    for (const entry of entries) {
        if (!entry?.content) continue;

        const text = entry.content.toLowerCase();

        if (text.includes(normalized)) {
            const match = entry.content.match(/ultimate\s*[:\-]\s*(.+)/i);
            if (match) {
                return match[1].trim();
            }
        }
    }

    return null;
}

export function collectCharactersFromChat(characters) {
    const profiles = [];

    for (const char of characters.values()) {
        if (!char?.name) continue;

        profiles.push({
            id: char.id,
            name: char.name,
            ultimate: char.ultimate,
            trustLevel: char.trustLevel,
            source: char.source,
        });
    }

    return profiles;
}
