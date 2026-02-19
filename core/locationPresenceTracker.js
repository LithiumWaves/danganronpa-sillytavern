import { normalizeName } from "../social/characterUtils.js";

export function createLocationPresenceTracker({ getActivePersonaName }) {
    let recentLocationMentions = [];

    function pushRecentLocationMention(entry) {
        if (!entry?.locationId || !entry?.messageSignature) return;

        const normalizedSpeaker = normalizeName(entry.speakerName || "");
        recentLocationMentions = recentLocationMentions.filter((item) => {
            if (item.messageSignature === entry.messageSignature && normalizeName(item.speakerName || "") === normalizedSpeaker) {
                return false;
            }
            return true;
        });

        recentLocationMentions.push({
            messageSignature: entry.messageSignature,
            speakerName: String(entry.speakerName || "").trim(),
            isUser: Boolean(entry.isUser),
            locationId: entry.locationId,
            createdAt: Date.now(),
        });

        const overflow = recentLocationMentions.length - 5;
        if (overflow > 0) {
            recentLocationMentions.splice(0, overflow);
        }
    }

    function buildRecentLocationPresence() {
        const latestBySpeaker = new Map();

        for (let i = recentLocationMentions.length - 1; i >= 0; i -= 1) {
            const item = recentLocationMentions[i];
            const speakerKey = item.isUser
                ? "__user__"
                : normalizeName(item.speakerName || `unknown_${i}`);

            if (!speakerKey || latestBySpeaker.has(speakerKey)) continue;
            latestBySpeaker.set(speakerKey, item);
        }

        const userEntry = latestBySpeaker.get("__user__") || null;
        const characters = [];

        latestBySpeaker.forEach((item, key) => {
            if (key === "__user__") return;
            if (!item?.speakerName || !item?.locationId) return;

            characters.push({
                name: item.speakerName,
                locationId: item.locationId,
            });
        });

        return {
            user: userEntry
                ? {
                    locationId: userEntry.locationId,
                    label: getActivePersonaName(),
                }
                : null,
            characters,
        };
    }

    return {
        pushRecentLocationMention,
        buildRecentLocationPresence,
    };
}
