function normalizeNameToken(value) {
    return String(value || '').trim().toLowerCase();
}

function isTruthy(value) {
    if (value === true) return true;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());
    return false;
}

function collectMutedNamesFromArray(raw, muted) {
    if (!Array.isArray(raw)) return;
    for (const item of raw) {
        if (!item) continue;
        if (typeof item === 'string') {
            muted.add(normalizeNameToken(item));
            continue;
        }

        const name = item.name ?? item.ch_name ?? item.character_name ?? item.id;
        const isMuted = item.muted ?? item.is_muted ?? item.isMuted ?? item.disabled ?? item.is_disabled;
        if (name && (isMuted == null || isTruthy(isMuted))) {
            muted.add(normalizeNameToken(name));
        }
    }
}

function collectMutedNames(ctx) {
    const muted = new Set();
    const metadata = ctx?.chat_metadata ?? ctx?.chatMetadata ?? {};

    collectMutedNamesFromArray(metadata?.muted_members, muted);
    collectMutedNamesFromArray(metadata?.mutedMembers, muted);
    collectMutedNamesFromArray(metadata?.muted_characters, muted);
    collectMutedNamesFromArray(metadata?.mutedCharacters, muted);
    collectMutedNamesFromArray(metadata?.disabled_members, muted);
    collectMutedNamesFromArray(metadata?.disabledMembers, muted);

    const participants = [
        ...(Array.isArray(ctx?.characters) ? ctx.characters : []),
        ...(Array.isArray(ctx?.group?.members) ? ctx.group.members : []),
    ];

    for (const person of participants) {
        const name = person?.name ?? person?.ch_name;
        const personMuted = person?.muted ?? person?.is_muted ?? person?.isMuted ?? person?.disabled;
        if (name && isTruthy(personMuted)) muted.add(normalizeNameToken(name));
    }

    return muted;
}

function collectAllowedParticipants(ctx) {
    const allowed = new Map();
    const chat = Array.isArray(ctx?.chat) ? ctx.chat : [];

    for (const msg of chat) {
        if (!msg) continue;
        if (isTruthy(msg.is_user ?? msg.isUser)) continue;
        if (isTruthy(msg.is_system ?? msg.isSystem ?? msg.is_system_message)) continue;

        const speaker = String(msg.ch_name ?? msg.name ?? '').trim();
        if (!speaker) continue;

        const key = normalizeNameToken(speaker);
        if (!allowed.has(key)) allowed.set(key, speaker);
    }

    return allowed;
}

export function createNonstopSpeakerPool({ getContext } = {}) {
    function getEligibleSpeakers() {
        const ctx = getContext?.() || {};
        const participants = collectAllowedParticipants(ctx);
        const muted = collectMutedNames(ctx);

        const speakers = [];
        participants.forEach((displayName, key) => {
            if (!key || muted.has(key)) return;
            speakers.push(displayName);
        });

        return speakers;
    }

    return {
        getEligibleSpeakers,
    };
}
