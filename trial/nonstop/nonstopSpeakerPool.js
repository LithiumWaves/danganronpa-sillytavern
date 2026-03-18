function normalizeToken(value) {
    return String(value || '').trim().toLowerCase();
}

function isTruthy(value) {
    if (value === true) return true;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());
    return false;
}

function addToken(set, value) {
    const token = normalizeToken(value);
    if (token) set.add(token);
}

function getActiveGroupId(ctx) {
    return ctx?.groupId ?? ctx?.group_id ?? null;
}

function getCharacterDirectory(ctx) {
    const directory = new Map();
    const chars = Array.isArray(ctx?.characters) ? ctx.characters : [];

    for (const ch of chars) {
        if (!ch) continue;
        const name = String(ch.name ?? ch.ch_name ?? '').trim();
        const avatar = String(ch.avatar ?? ch.avatar_url ?? ch.avatarUrl ?? '').trim();
        const id = String(ch.id ?? ch.character_id ?? ch.characterId ?? '').trim();

        if (!name && !avatar && !id) continue;

        const row = {
            name,
            avatar,
            id,
            isUser: isTruthy(ch.is_user ?? ch.isUser),
            muted: isTruthy(ch.muted ?? ch.is_muted ?? ch.isMuted ?? ch.disabled ?? ch.is_disabled),
        };

        if (name) directory.set(normalizeToken(name), row);
        if (avatar) directory.set(normalizeToken(avatar), row);
        if (id) directory.set(normalizeToken(id), row);
    }

    return directory;
}

function collectGroupMembers(ctx, participants, directory) {
    const activeGroupId = String(getActiveGroupId(ctx) ?? '').trim();
    if (!activeGroupId) return;

    const groups = Array.isArray(ctx?.groups) ? ctx.groups : [];
    const activeGroup = groups.find(group => String(group?.id ?? group?.group_id ?? '').trim() === activeGroupId);
    const rawMembers = activeGroup?.members;
    if (!Array.isArray(rawMembers)) return;

    for (const rawMember of rawMembers) {
        const token = normalizeToken(rawMember);
        if (!token) continue;

        const linked = directory.get(token);
        if (linked?.isUser) continue;

        const displayName = linked?.name || String(rawMember || '').trim();
        if (!displayName) continue;

        const key = normalizeToken(displayName);
        if (!participants.has(key)) {
            participants.set(key, {
                name: displayName,
                aliases: new Set([key, token]),
                muted: Boolean(linked?.muted),
            });
        } else {
            participants.get(key)?.aliases?.add(token);
            if (linked?.muted) participants.get(key).muted = true;
        }
    }
}

function collectParticipantsFromCharacters(ctx, participants) {
    const chars = Array.isArray(ctx?.characters) ? ctx.characters : [];
    for (const ch of chars) {
        if (!ch) continue;
        if (isTruthy(ch.is_user ?? ch.isUser)) continue;

        const displayName = String(ch.name ?? ch.ch_name ?? '').trim();
        if (!displayName) continue;

        const key = normalizeToken(displayName);
        if (!participants.has(key)) {
            participants.set(key, {
                name: displayName,
                aliases: new Set([key]),
                muted: isTruthy(ch.muted ?? ch.is_muted ?? ch.isMuted ?? ch.disabled ?? ch.is_disabled),
            });
        } else if (isTruthy(ch.muted ?? ch.is_muted ?? ch.isMuted ?? ch.disabled ?? ch.is_disabled)) {
            participants.get(key).muted = true;
        }

        addToken(participants.get(key).aliases, ch.avatar);
        addToken(participants.get(key).aliases, ch.id);
        addToken(participants.get(key).aliases, ch.character_id);
    }
}

function collectParticipantsFromChat(ctx, participants) {
    const chat = Array.isArray(ctx?.chat) ? ctx.chat : [];
    for (const msg of chat) {
        if (!msg) continue;
        if (isTruthy(msg.is_user ?? msg.isUser)) continue;
        if (isTruthy(msg.is_system ?? msg.isSystem ?? msg.is_system_message)) continue;

        const speaker = String(msg.ch_name ?? msg.name ?? '').trim();
        if (!speaker) continue;

        const key = normalizeToken(speaker);
        if (!participants.has(key)) {
            participants.set(key, {
                name: speaker,
                aliases: new Set([key]),
                muted: false,
            });
        }
    }
}

function collectMutedTokensFromArray(raw, mutedTokens) {
    if (!Array.isArray(raw)) return;
    for (const item of raw) {
        if (!item) continue;

        if (typeof item === 'string' || typeof item === 'number') {
            addToken(mutedTokens, item);
            continue;
        }

        const maybeMuted = item.muted ?? item.is_muted ?? item.isMuted ?? item.disabled ?? item.is_disabled;
        if (maybeMuted != null && !isTruthy(maybeMuted)) continue;

        addToken(mutedTokens, item.name);
        addToken(mutedTokens, item.ch_name);
        addToken(mutedTokens, item.character_name);
        addToken(mutedTokens, item.id);
        addToken(mutedTokens, item.avatar);
    }
}

function collectMutedTokens(ctx) {
    const mutedTokens = new Set();
    const metadata = ctx?.chat_metadata ?? ctx?.chatMetadata ?? {};

    collectMutedTokensFromArray(metadata?.muted_members, mutedTokens);
    collectMutedTokensFromArray(metadata?.mutedMembers, mutedTokens);
    collectMutedTokensFromArray(metadata?.muted_characters, mutedTokens);
    collectMutedTokensFromArray(metadata?.mutedCharacters, mutedTokens);
    collectMutedTokensFromArray(metadata?.disabled_members, mutedTokens);
    collectMutedTokensFromArray(metadata?.disabledMembers, mutedTokens);

    return mutedTokens;
}

export function createNonstopSpeakerPool({ getContext } = {}) {
    function getEligibleSpeakers() {
        const ctx = getContext?.() || {};
        const participants = new Map();

        collectParticipantsFromChat(ctx, participants);
        collectParticipantsFromCharacters(ctx, participants);

        const directory = getCharacterDirectory(ctx);
        collectGroupMembers(ctx, participants, directory);

        const mutedTokens = collectMutedTokens(ctx);
        const speakers = [];

        participants.forEach(participant => {
            if (!participant?.name) return;
            if (participant.muted) return;

            for (const alias of participant.aliases || []) {
                if (mutedTokens.has(alias)) return;
            }

            speakers.push(participant.name);
        });

        return speakers;
    }

    return {
        getEligibleSpeakers,
    };
}
