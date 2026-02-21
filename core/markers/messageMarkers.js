export function normalizeTextToken(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[_\-]+/g, " ")
        .replace(/\s+/g, " ");
}

export function createMessageMarkerState({
    extensionSettings,
    extensionName,
    saveSettingsDebounced,
    investigationStartRegex,
    trialStartRegex,
}) {
    const processedInvestigationSignatures = new Set();
    const processedTrialStartSignatures = new Set();
    const processedMonokumaAnnouncementSignatures = new Set();

    const TRIAL_DISCUSSION_START_PARSE_REGEX = /V3C\s*[|｜]\s*TRIAL(?:\s*[_\-]?\s*)DISCUSSION(?:\s*[_\-]?\s*)START\b/gi;
    const TRIAL_DISCUSSION_END_PARSE_REGEX = /V3C\s*[|｜]\s*TRIAL(?:\s*[_\-]?\s*)DISCUSSION(?:\s*[_\-]?\s*)END\b/gi;

    function getInvestigationMarkerStore() {
        extensionSettings[extensionName] ||= {};
        extensionSettings[extensionName].investigationMarkers ||= {};
        return extensionSettings[extensionName].investigationMarkers;
    }

    function getInvestigationScopeKey() {
        const ctx = window.SillyTavern?.getContext?.();
        const groupId = ctx?.groupId ?? ctx?.group_id ?? "";
        const characterId = ctx?.characterId ?? ctx?.character_id ?? "";
        const chatId = ctx?.chatId ?? ctx?.chat_id ?? ctx?.chatFile ?? "";

        if (groupId !== "" && groupId !== null && groupId !== undefined) return `group:${groupId}`;
        if (characterId !== "" && characterId !== null && characterId !== undefined) return `char:${characterId}`;
        if (chatId) return `chat:${chatId}`;
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
        const store = getInvestigationMarkerStore();
        store[persistentSignature || `RUNTIME||${signature}`] = Date.now();

        const keys = Object.keys(store);
        const maxEntries = 1200;
        if (keys.length > maxEntries) {
            keys
                .sort((a, b) => Number(store[a] || 0) - Number(store[b] || 0))
                .slice(0, keys.length - maxEntries)
                .forEach((key) => delete store[key]);
        }

        saveSettingsDebounced();
    }

    function parseInvestigationStartMarkers(text) {
        const raw = String(text || "");
        if (!raw) return [];

        const matches = [];
        investigationStartRegex.lastIndex = 0;

        let match;
        while ((match = investigationStartRegex.exec(raw)) !== null) {
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

    function parseTrialStartMarkers(text) {
        const raw = String(text || "");
        if (!raw) return [];

        const matches = [];
        trialStartRegex.lastIndex = 0;

        let match;
        while ((match = trialStartRegex.exec(raw)) !== null) {
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

    function parseTrialDiscussionMarkers(text) {
        const raw = String(text || "");
        if (!raw) return { startMarkers: [], endMarkers: [] };

        const startMarkers = [];
        const endMarkers = [];
        TRIAL_DISCUSSION_START_PARSE_REGEX.lastIndex = 0;
        TRIAL_DISCUSSION_END_PARSE_REGEX.lastIndex = 0;

        let match;
        while ((match = TRIAL_DISCUSSION_START_PARSE_REGEX.exec(raw)) !== null) {
            startMarkers.push({ marker: match[0], index: match.index, type: "start" });
        }
        while ((match = TRIAL_DISCUSSION_END_PARSE_REGEX.exec(raw)) !== null) {
            endMarkers.push({ marker: match[0], index: match.index, type: "end" });
        }

        return { startMarkers, endMarkers };
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

    function getTrialStartMarkerStore() {
        extensionSettings[extensionName] ||= {};
        extensionSettings[extensionName].trialStartMarkers ||= {};
        return extensionSettings[extensionName].trialStartMarkers;
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
                .forEach((key) => delete store[key]);
        }

        saveSettingsDebounced();
    }

    function getMonokumaAnnouncementMarkerStore() {
        extensionSettings[extensionName] ||= {};
        extensionSettings[extensionName].monokumaAnnouncementMarkers ||= {};
        return extensionSettings[extensionName].monokumaAnnouncementMarkers;
    }

    function buildMonokumaAnnouncementPersistentSignature(msgEl, marker, idx, rawText = "") {
        const mesId = msgEl?.getAttribute?.("mesid") || msgEl?.dataset?.mesid || "";
        if (!mesId || mesId === "no-id") return "";

        const speaker = msgEl?.getAttribute?.("ch_name") || "unknown";
        const scope = getInvestigationScopeKey();
        if (!scope || scope === "scope:unknown") return "";

        const markerIndex = Number(marker?.index ?? -1);
        const markerType = String(marker?.type || "UNKNOWN");
        const textFingerprint = String(rawText || "").slice(0, 140);
        return `MONOKUMA_ANNOUN||${scope}||${mesId}||${speaker}||${markerType}||${markerIndex}||${idx}||${textFingerprint}`;
    }

    function hasProcessedMonokumaAnnouncementSignature(signature, persistentSignature = "") {
        if (!signature) return false;
        if (processedMonokumaAnnouncementSignatures.has(signature)) return true;
        if (!persistentSignature) return false;
        return Boolean(getMonokumaAnnouncementMarkerStore()[persistentSignature]);
    }

    function markMonokumaAnnouncementSignatureProcessed(signature, persistentSignature = "") {
        if (!signature) return;

        processedMonokumaAnnouncementSignatures.add(signature);
        const store = getMonokumaAnnouncementMarkerStore();
        store[persistentSignature || `RUNTIME||${signature}`] = Date.now();

        const keys = Object.keys(store);
        const maxEntries = 1200;
        if (keys.length > maxEntries) {
            keys
                .sort((a, b) => Number(store[a] || 0) - Number(store[b] || 0))
                .slice(0, keys.length - maxEntries)
                .forEach((key) => delete store[key]);
        }

        saveSettingsDebounced();
    }

    return {
        parseInvestigationStartMarkers,
        parseTrialStartMarkers,
        parseTrialDiscussionMarkers,
        buildPersistentInvestigationSignature,
        hasProcessedInvestigationSignature,
        markInvestigationSignatureProcessed,
        buildTrialStartPersistentSignature,
        hasProcessedTrialStartSignature,
        markTrialStartSignatureProcessed,
        buildMonokumaAnnouncementPersistentSignature,
        hasProcessedMonokumaAnnouncementSignature,
        markMonokumaAnnouncementSignatureProcessed,
    };
}
