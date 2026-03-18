function normalizeToken(value) {
    return String(value || '').trim().toLowerCase();
}

function isTruthy(value) {
    if (value === true) return true;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());
    return false;
}

function isFalsy(value) {
    if (value === false) return true;
    if (typeof value === 'number') return value === 0;
    if (typeof value === 'string') return ['false', '0', 'no', 'off'].includes(value.trim().toLowerCase());
    return false;
}

function addToken(set, value) {
    const token = normalizeToken(value);
    if (token) set.add(token);
}

function getActiveGroupId(ctx) {
    return ctx?.groupId ?? ctx?.group_id ?? null;
}

function getActiveGroup(ctx) {
    const activeGroupId = String(getActiveGroupId(ctx) ?? '').trim();
    if (!activeGroupId) return null;

    const groups = Array.isArray(ctx?.groups) ? ctx.groups : [];
    return groups.find(group => String(group?.id ?? group?.group_id ?? '').trim() === activeGroupId) || null;
}

function isMutedFlag(value) {
    return isTruthy(value);
}

function hasDisabledSpeechFlag(record) {
    if (!record || typeof record !== 'object') return false;

    const directMuteKeys = [
        'muted', 'is_muted', 'isMuted',
        'disabled', 'is_disabled', 'isDisabled',
        'chat_disabled', 'chatDisabled',
        'talk_disabled', 'talkDisabled',
        'speech_disabled', 'speechDisabled',
        'message_disabled', 'messageDisabled',
        'group_disabled', 'groupDisabled',
    ];

    for (const key of directMuteKeys) {
        if (key in record && isMutedFlag(record[key])) return true;
    }

    const inverseKeys = [
        'enabled', 'is_enabled', 'isEnabled',
        'can_reply', 'canReply',
        'allow_reply', 'allowReply',
        'allow_replies', 'allowReplies',
        'can_talk', 'canTalk',
        'can_speak', 'canSpeak',
    ];

    for (const key of inverseKeys) {
        if (key in record && isFalsy(record[key])) return true;
    }

    return false;
}

function getMemberTokens(record) {
    const tokens = new Set();
    if (record == null) return tokens;

    if (typeof record === 'string' || typeof record === 'number') {
        addToken(tokens, record);
        return tokens;
    }

    addToken(tokens, record.name);
    addToken(tokens, record.ch_name);
    addToken(tokens, record.character_name);
    addToken(tokens, record.avatar);
    addToken(tokens, record.avatar_url);
    addToken(tokens, record.avatarUrl);
    addToken(tokens, record.id);
    addToken(tokens, record.character_id);
    addToken(tokens, record.characterId);
    addToken(tokens, record.member_id);
    addToken(tokens, record.memberId);

    return tokens;
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
            muted: hasDisabledSpeechFlag(ch),
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
    const activeGroup = getActiveGroup(ctx);
    const rawMembers = activeGroup?.members;
    if (!Array.isArray(rawMembers)) return false;

    for (const rawMember of rawMembers) {
        const aliasTokens = Array.from(getMemberTokens(rawMember));
        const linked = aliasTokens.map(token => directory.get(token)).find(Boolean) || null;
        if (linked?.isUser) continue;

        const displayName = typeof rawMember === 'object' && rawMember !== null
            ? String(rawMember.name ?? rawMember.ch_name ?? linked?.name ?? '').trim()
            : String(linked?.name ?? rawMember ?? '').trim();

        if (!displayName) continue;

        upsertParticipant(participants, displayName, {
            muted: hasDisabledSpeechFlag(rawMember) || Boolean(linked?.muted),
            aliasTokens: [...aliasTokens, linked?.avatar, linked?.id, linked?.name],
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

        if (!hasDisabledSpeechFlag(item)) {
            const hasExplicitFlag = ['muted', 'is_muted', 'isMuted', 'disabled', 'is_disabled', 'isDisabled', 'enabled', 'is_enabled', 'isEnabled', 'can_reply', 'canReply', 'allow_reply', 'allowReply', 'allow_replies', 'allowReplies', 'can_talk', 'canTalk', 'can_speak', 'canSpeak'].some(key => key in item);
            if (hasExplicitFlag) continue;
        }

        for (const token of getMemberTokens(item)) mutedTokens.add(token);
    }
}

function collectMutedTokens(ctx) {
    const mutedTokens = new Set();
    const metadata = ctx?.chat_metadata ?? ctx?.chatMetadata ?? {};
    const activeGroup = getActiveGroup(ctx);

    collectMutedTokensFromArray(metadata?.muted_members, mutedTokens);
    collectMutedTokensFromArray(metadata?.mutedMembers, mutedTokens);
    collectMutedTokensFromArray(metadata?.muted_characters, mutedTokens);
    collectMutedTokensFromArray(metadata?.mutedCharacters, mutedTokens);
    collectMutedTokensFromArray(metadata?.disabled_members, mutedTokens);
    collectMutedTokensFromArray(metadata?.disabledMembers, mutedTokens);
    collectMutedTokensFromArray(activeGroup?.muted_members, mutedTokens);
    collectMutedTokensFromArray(activeGroup?.mutedMembers, mutedTokens);
    collectMutedTokensFromArray(activeGroup?.disabled_members, mutedTokens);
    collectMutedTokensFromArray(activeGroup?.disabledMembers, mutedTokens);

    const rawMembers = Array.isArray(activeGroup?.members) ? activeGroup.members : [];
    for (const member of rawMembers) {
        if (!hasDisabledSpeechFlag(member)) continue;
        for (const token of getMemberTokens(member)) mutedTokens.add(token);
    }

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
