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

function upsertParticipant(participants, name, { aliasTokens = [], muted = false } = {}) {
    const displayName = String(name || '').trim();
    if (!displayName) return;

    const key = normalizeToken(displayName);
    if (!key) return;

    if (!participants.has(key)) {
        participants.set(key, {
            name: displayName,
            aliases: new Set([key]),
            muted: Boolean(muted),
        });
    }

    const participant = participants.get(key);
    if (muted) participant.muted = true;
    for (const alias of aliasTokens) addToken(participant.aliases, alias);
}

function collectGroupParticipants(ctx, participants, directory) {
    const activeGroupId = String(getActiveGroupId(ctx) ?? '').trim();
    if (!activeGroupId) return false;

    const groups = Array.isArray(ctx?.groups) ? ctx.groups : [];
    const activeGroup = groups.find(group => String(group?.id ?? group?.group_id ?? '').trim() === activeGroupId);
    const rawMembers = activeGroup?.members;
    if (!Array.isArray(rawMembers)) return false;

    for (const rawMember of rawMembers) {
        const memberToken = normalizeToken(rawMember);
        if (!memberToken) continue;

        const linked = directory.get(memberToken);
        if (linked?.isUser) continue;

        const displayName = linked?.name || String(rawMember || '').trim();
        upsertParticipant(participants, displayName, {
            muted: Boolean(linked?.muted),
            aliasTokens: [memberToken, linked?.avatar, linked?.id, linked?.name],
        });
    }

    return true;
}

function collectDirectChatParticipant(ctx, participants, directory) {
    const directTokens = [
        ctx?.characterId,
        ctx?.character_id,
        ctx?.name2,
        ctx?.characterName,
        ctx?.character_name,
    ];

    for (const raw of directTokens) {
        const token = normalizeToken(raw);
        if (!token) continue;

        const linked = directory.get(token);
        if (linked?.isUser) continue;

        const displayName = linked?.name || String(raw || '').trim();
        upsertParticipant(participants, displayName, {
            muted: Boolean(linked?.muted),
            aliasTokens: [token, linked?.avatar, linked?.id, linked?.name],
        });
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

        upsertParticipant(participants, speaker, {
            aliasTokens: [msg.original_avatar, msg.avatar, msg.ch_name, msg.name, msg.character_id, msg.id],
        });
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
        const directory = getCharacterDirectory(ctx);

        const hasGroupMembers = collectGroupParticipants(ctx, participants, directory);
        if (!hasGroupMembers) {
            collectDirectChatParticipant(ctx, participants, directory);
        }

        if (!participants.size) {
            collectParticipantsFromChat(ctx, participants);
        }

        const mutedTokens = collectMutedTokens(ctx);
        const speakers = [];

        participants.forEach(participant => {
            if (!participant?.name || participant.muted) return;

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
