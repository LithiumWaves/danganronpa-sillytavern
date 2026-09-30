import { normalizeName } from "../social/characterUtils.js";

const PRESENCE_LEAVE_ALONE_SUBSTRINGS = [
    "narrator",
    "sillytavern",
    "prome user sprite",
];

export function shouldLeavePresenceMuteAlone(name) {
    const lc = normalizeName(name || "");
    // Unresolved / empty names must still be muted — otherwise group members
    // whose cards are not in ctx.characters stay present forever.
    if (!lc) return false;
    if (lc === "assistant" || lc === "system") return true;
    return PRESENCE_LEAVE_ALONE_SUBSTRINGS.some((s) => lc.includes(s));
}

function rosterEntry(rosterByKey, key) {
    if (!rosterByKey || !key) return null;
    if (typeof rosterByKey.get === "function") return rosterByKey.get(key) || null;
    return rosterByKey[key] || null;
}

function tryDecode(value) {
    const raw = String(value || "");
    if (!raw) return raw;
    try { return decodeURIComponent(raw); } catch { return raw; }
}

/** Filename without path/extension, normalized for name matching. */
export function avatarStemKey(avatar) {
    if (!avatar) return "";
    let s = tryDecode(avatar).replace(/\\/g, "/");
    const slash = s.lastIndexOf("/");
    if (slash >= 0) s = s.slice(slash + 1);
    s = s.replace(/\.[A-Za-z0-9]+$/, "");
    s = s.replace(/[_-]+/g, " ");
    return normalizeName(s);
}

/** Alternate keys ST / Presence might use for the same avatar file. */
export function avatarLookupKeys(avatar) {
    const raw = String(avatar || "");
    if (!raw) return [];
    const out = [];
    const seen = new Set();
    const add = (v) => {
        if (!v || seen.has(v)) return;
        seen.add(v);
        out.push(v);
    };
    add(raw);
    const decoded = tryDecode(raw);
    add(decoded);
    try { add(encodeURIComponent(raw)); } catch { /* ignore */ }
    if (decoded !== raw) {
        try { add(encodeURIComponent(decoded)); } catch { /* ignore */ }
    }
    add(raw.toLowerCase());
    add(decoded.toLowerCase());
    return out;
}

export function indexCharsByAvatar(characters = []) {
    const map = {};
    for (const c of Array.isArray(characters) ? characters : []) {
        if (!c?.avatar) continue;
        const rec = { name: c.name || "", avatar: c.avatar };
        for (const key of avatarLookupKeys(c.avatar)) {
            if (!map[key]) map[key] = rec;
        }
    }
    return map;
}

export function lookupCharByAvatar(charByAvatar, avatar) {
    if (!avatar) return null;
    if (charByAvatar && typeof charByAvatar === "object") {
        if (charByAvatar[avatar]) return charByAvatar[avatar];
        for (const key of avatarLookupKeys(avatar)) {
            if (charByAvatar[key]) return charByAvatar[key];
        }
    }
    return null;
}

function firstTokens(names) {
    const counts = new Map();
    for (const raw of names) {
        const first = normalizeName(raw || "").split(" ").filter(Boolean)[0];
        if (!first) continue;
        counts.set(first, (counts.get(first) || 0) + 1);
    }
    const unique = new Set();
    for (const [token, count] of counts.entries()) {
        if (count === 1) unique.add(token);
    }
    return unique;
}

function addNameKeys(into, name, uniqueFirsts) {
    const n = normalizeName(name || "");
    if (!n) return;
    into.add(n);
    const parts = n.split(" ").filter(Boolean);
    if (parts.length && uniqueFirsts.has(parts[0])) into.add(parts[0]);
}

function namesLooselyEqual(a, b) {
    const left = normalizeName(a || "");
    const right = normalizeName(b || "");
    if (!left || !right) return false;
    if (left === right) return true;
    const shorter = left.length <= right.length ? left : right;
    const longer = left.length <= right.length ? right : left;
    // "Kyoko Kirigiri" vs "Kyoko Kirigiri (DR1)" — require a real name, not a 1–2 letter token.
    if (shorter.length < 4) return false;
    return longer.includes(shorter);
}

function memberMatchesRoom({ name, avatar, inRoomKeys, inRoomNames }) {
    const n = normalizeName(name || "");
    if (n && inRoomKeys.has(n)) return true;
    const stem = avatarStemKey(avatar);
    if (stem && inRoomKeys.has(stem)) return true;
    const parts = n.split(" ").filter(Boolean);
    if (parts[0] && inRoomKeys.has(parts[0])) return true;
    for (const roomName of inRoomNames) {
        if (namesLooselyEqual(name, roomName)) return true;
        if (stem && namesLooselyEqual(stem, roomName)) return true;
    }
    return false;
}

/**
 * Compute the group.disabled_members list so only characters whose sprites
 * are in the current overworld room stay unmuted (present). Narrator / system
 * names keep their previous mute state. Dead or missing roster characters
 * stay muted. Unresolved avatars are muted so they cannot keep talking.
 *
 * @param {object} opts
 * @param {string[]} opts.memberAvatars
 * @param {string[]} [opts.currentDisabled]
 * @param {Record<string, {name?: string, avatar?: string}>} opts.charByAvatar
 * @param {Iterable<string>} opts.inRoomNameKeys  character names currently in the room
 * @param {Map|Record<string, {dead?: boolean, missing?: boolean, name?: string}>} opts.rosterByKey
 * @returns {string[]}
 */
export function computeRoomDisabledMembers({
    memberAvatars = [],
    currentDisabled = [],
    charByAvatar = {},
    inRoomNameKeys = [],
    rosterByKey = {},
} = {}) {
    const inRoomNames = [...inRoomNameKeys].map((n) => String(n || "").trim()).filter(Boolean);
    const memberNames = [];
    const resolved = [];
    for (const avatar of memberAvatars) {
        if (!avatar) continue;
        const char = lookupCharByAvatar(charByAvatar, avatar);
        const name = char?.name || "";
        memberNames.push(name);
        resolved.push({ avatar, name, char });
    }
    const uniqueFirsts = firstTokens([...inRoomNames, ...memberNames]);
    const inRoomKeys = new Set();
    for (const n of inRoomNames) addNameKeys(inRoomKeys, n, uniqueFirsts);
    for (const { avatar, name } of resolved) {
        if (memberMatchesRoom({ name, avatar, inRoomKeys, inRoomNames })) {
            const stem = avatarStemKey(avatar);
            if (stem) inRoomKeys.add(stem);
        }
    }

    const prevDisabled = new Set(currentDisabled || []);
    const nextDisabled = [];
    for (const { avatar, name } of resolved) {
        if (shouldLeavePresenceMuteAlone(name)) {
            if (prevDisabled.has(avatar)) nextDisabled.push(avatar);
            continue;
        }
        const key = normalizeName(name);
        const roster = rosterEntry(rosterByKey, key)
            || rosterEntry(rosterByKey, avatarStemKey(avatar))
            || null;
        if (roster?.dead || roster?.missing) {
            nextDisabled.push(avatar);
            continue;
        }
        if (!memberMatchesRoom({ name, avatar, inRoomKeys, inRoomNames })) {
            nextDisabled.push(avatar);
        }
    }
    return nextDisabled;
}

export function disabledMembersEqual(a, b) {
    const aa = [...(a || [])].map(String).sort();
    const bb = [...(b || [])].map(String).sort();
    if (aa.length !== bb.length) return false;
    return aa.every((v, i) => v === bb[i]);
}

export function isPresenceExtensionPresent() {
    try {
        const bags = [];
        const ctx = typeof window !== "undefined" ? window.SillyTavern?.getContext?.() : null;
        if (ctx?.extensionSettings) bags.push(ctx.extensionSettings);
        if (typeof window !== "undefined" && window.extension_settings) bags.push(window.extension_settings);
        for (const settings of bags) {
            if (!settings || typeof settings !== "object") continue;
            for (const key of Object.keys(settings)) {
                if (/presence/i.test(key)) return true;
            }
        }
    } catch { /* ignore */ }
    return false;
}
