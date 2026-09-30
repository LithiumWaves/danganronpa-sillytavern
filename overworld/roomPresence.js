import { normalizeName } from "../social/characterUtils.js";

const PRESENCE_LEAVE_ALONE_SUBSTRINGS = [
    "narrator",
    "sillytavern",
    "prome user sprite",
];

export function shouldLeavePresenceMuteAlone(name) {
    const lc = normalizeName(name || "");
    if (!lc) return true;
    if (lc === "assistant" || lc === "system") return true;
    return PRESENCE_LEAVE_ALONE_SUBSTRINGS.some((s) => lc.includes(s));
}

function rosterEntry(rosterByKey, key) {
    if (!rosterByKey || !key) return null;
    if (typeof rosterByKey.get === "function") return rosterByKey.get(key) || null;
    return rosterByKey[key] || null;
}

/**
 * Compute the group.disabled_members list so only characters whose sprites
 * are in the current overworld room stay unmuted (present). Narrator / system
 * names keep their previous mute state. Dead or missing roster characters
 * stay muted.
 *
 * @param {object} opts
 * @param {string[]} opts.memberAvatars
 * @param {string[]} [opts.currentDisabled]
 * @param {Record<string, {name?: string}>} opts.charByAvatar
 * @param {Iterable<string>} opts.inRoomNameKeys  character names currently in the room
 * @param {Map|Record<string, {dead?: boolean, missing?: boolean}>} opts.rosterByKey
 * @returns {string[]}
 */
export function computeRoomDisabledMembers({
    memberAvatars = [],
    currentDisabled = [],
    charByAvatar = {},
    inRoomNameKeys = [],
    rosterByKey = {},
} = {}) {
    const inRoom = new Set(
        [...inRoomNameKeys].map((n) => normalizeName(n)).filter(Boolean),
    );
    const prevDisabled = new Set(currentDisabled || []);
    const nextDisabled = [];
    for (const avatar of memberAvatars) {
        if (!avatar) continue;
        const char = charByAvatar[avatar];
        const name = char?.name || "";
        if (shouldLeavePresenceMuteAlone(name)) {
            if (prevDisabled.has(avatar)) nextDisabled.push(avatar);
            continue;
        }
        const key = normalizeName(name);
        const roster = rosterEntry(rosterByKey, key);
        if (roster?.dead || roster?.missing) {
            nextDisabled.push(avatar);
            continue;
        }
        if (!inRoom.has(key)) nextDisabled.push(avatar);
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
