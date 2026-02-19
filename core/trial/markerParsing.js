export const INVESTIGATION_START_PARSE_REGEX = /V3C\s*[|｜]\s*INVESTIGATION(?:\s*[_\-]?\s*)START\b/gi;
export const TRIAL_START_PARSE_REGEX = /V3C\s*[|｜]\s*TRIAL(?:\s*[_\-]?\s*)START\b/gi;

export function normalizeTextToken(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[_\-]+/g, " ")
        .replace(/\s+/g, " ");
}

export function createMarkerPersistence({ extension_settings, extensionName, saveSettingsDebounced }) {
    const processedInvestigationSignatures = new Set();
    const processedTrialStartSignatures = new Set();

    function getInvestigationMarkerStore() {
        extension_settings[extensionName] ||= {};
        extension_settings[extensionName].investigationMarkers ||= {};
        return extension_settings[extensionName].investigationMarkers;
    }

    function getTrialStartMarkerStore() {
        extension_settings[extensionName] ||= {};
        extension_settings[extensionName].trialStartMarkers ||= {};
        return extension_settings[extensionName].trialStartMarkers;
    }

    function getInvestigationScopeKey() {
        const ctx = window.SillyTavern?.getContext?.();
        const groupId = ctx?.groupId ?? ctx?.group_id ?? "";
        const characterId = ctx?.characterId ?? ctx?.character_id ?? "";
        const chatId = ctx?.chatId ?? ctx?.chat_id ?? ctx?.chatFile ?? "";

        if (groupId !== "" && groupId !== null && groupId !== undefined) {
            return `group:${groupId}`;
        }

        if (characterId !== "" && characterId !== null && characterId !== undefined) {
            return `char:${characterId}`;
        }

        if (chatId) {
            return `chat:${chatId}`;
        }

        return "scope:unknown";
    }

    function buildPersistentInvestigationSignature(msgEl, marker, idx, rawText = "") {
        const mesId = msgEl?.getAttribute?.("mesid") || msgEl?.dataset?.mesid || "";
        if (!mesId || mesId === "no-id") return "";

        const speaker = msgEl?.getAttribute?.("ch_name") || "unknown";
        const scope = getInvestigationScopeKey();
        if (!scope || scope === "scope:unknown") return "";

        const markerIndex = Number(marker?.index ?? -1);
        const textFingerprint = String(rawText || "").slice(0, 140);

        return `INVESTIGATION||${scope}||${mesId}||${speaker}||${markerIndex}||${idx}||${textFingerprint}`;
    }

    function hasProcessedInvestigationSignature(signature, persistentSignature = "") {
        if (!signature) return false;
        if (processedInvestigationSignatures.has(signature)) return true;
        if (!persistentSignature) return false;
        return Boolean(getInvestigationMarkerStore()[persistentSignature]);
    }

    function markInvestigationSignatureProcessed(signature, persistentSignature = "") {
        if (!signature) return;

        processedInvestigationSignatures.add(signature);
        if (!persistentSignature) return;

        const store = getInvestigationMarkerStore();
        store[persistentSignature] = Date.now();

        const keys = Object.keys(store);
        const maxEntries = 1200;
        if (keys.length > maxEntries) {
            keys
                .sort((a, b) => Number(store[a] || 0) - Number(store[b] || 0))
                .slice(0, keys.length - maxEntries)
                .forEach((key) => {
                    delete store[key];
                });
        }

        saveSettingsDebounced();
    }

    function buildTrialStartPersistentSignature(msgEl, marker, idx, rawText = "") {
        const mesId = msgEl?.getAttribute?.("mesid") || msgEl?.dataset?.mesid || "";
        if (!mesId || mesId === "no-id") return "";

        const speaker = msgEl?.getAttribute?.("ch_name") || "unknown";
        const scope = getInvestigationScopeKey();
        if (!scope || scope === "scope:unknown") return "";

        const markerIndex = Number(marker?.index ?? -1);
        const textFingerprint = String(rawText || "").slice(0, 140);

        return `TRIAL_START||${scope}||${mesId}||${speaker}||${markerIndex}||${idx}||${textFingerprint}`;
    }

    function hasProcessedTrialStartSignature(signature, persistentSignature = "") {
        if (!signature) return false;
        if (processedTrialStartSignatures.has(signature)) return true;
        if (!persistentSignature) return false;
        return Boolean(getTrialStartMarkerStore()[persistentSignature]);
    }

    function markTrialStartSignatureProcessed(signature, persistentSignature = "") {
        if (!signature) return;

        processedTrialStartSignatures.add(signature);
        if (!persistentSignature) return;

        const store = getTrialStartMarkerStore();
        store[persistentSignature] = Date.now();

        const keys = Object.keys(store);
        const maxEntries = 1200;
        if (keys.length > maxEntries) {
            keys
                .sort((a, b) => Number(store[a] || 0) - Number(store[b] || 0))
                .slice(0, keys.length - maxEntries)
                .forEach((key) => {
                    delete store[key];
                });
        }

        saveSettingsDebounced();
    }

    return {
        buildPersistentInvestigationSignature,
        hasProcessedInvestigationSignature,
        markInvestigationSignatureProcessed,
        buildTrialStartPersistentSignature,
        hasProcessedTrialStartSignature,
        markTrialStartSignatureProcessed,
    };
}

export function parseInvestigationStartMarkers(text) {
    const raw = String(text || "");
    if (!raw) return [];

    const matches = [];
    INVESTIGATION_START_PARSE_REGEX.lastIndex = 0;

    let match;
    while ((match = INVESTIGATION_START_PARSE_REGEX.exec(raw)) !== null) {
        matches.push({ marker: match[0], index: match.index, source: "regex" });
    }

    if (matches.length) return matches;

    const lines = raw.split(/\r?\n/);
    let cursor = 0;

    for (const line of lines) {
        const canonical = line
            .toUpperCase()
            .replace(/[|｜]/g, "|")
            .replace(/[`*_~:;,.!?\-\s]/g, "");

        if (canonical.includes("V3C|INVESTIGATIONSTART")) {
            matches.push({ marker: line, index: cursor, source: "fallback" });
        }

        cursor += line.length + 1;
    }

    return matches;
}

export function parseTrialStartMarkers(text) {
    const raw = String(text || "");
    if (!raw) return [];

    const matches = [];
    TRIAL_START_PARSE_REGEX.lastIndex = 0;

    let match;
    while ((match = TRIAL_START_PARSE_REGEX.exec(raw)) !== null) {
        matches.push({ marker: match[0], index: match.index, source: "regex" });
    }

    if (matches.length) return matches;

    const lines = raw.split(/\r?\n/);
    let cursor = 0;

    for (const line of lines) {
        const canonical = line
            .toUpperCase()
            .replace(/[|｜]/g, "|")
            .replace(/[`*_~:;,.!?\-\s]/g, "");

        if (canonical.includes("V3C|TRIALSTART")) {
            matches.push({ marker: line, index: cursor, source: "fallback" });
        }

        cursor += line.length + 1;
    }

    return matches;
}
