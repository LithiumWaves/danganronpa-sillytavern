// Save files. Story state (roster, trust, evidence, day, chapter, economy…)
// lives on the extension's settings object where the rest of the code reads
// it. Each save keeps a copy of those keys; switching saves stores the live
// keys into the outgoing save and loads the incoming save's copy in their
// place. The active save's own copy is dropped while it's active, because the
// live keys are the source of truth and keeping both would double the size.
//
// A "single" save belongs to the group chats listed in `groupIds` (the story
// chat, plus any Class Trial chats made from it). A "multi" save is a named
// slot for the Several Chats play style and isn't tied to a chat.

export const SAVE_MODES = Object.freeze({ SINGLE: "single", MULTI: "multi" });

// Dotted paths reach into settings objects that mix story data with global
// definitions (custom gifts, overworld display config…).
export const STORY_KEYS = Object.freeze([
    "characters",
    "truthBullets",
    "archivedTruthBullets",
    "dismissedTruthBullets",
    "progression",
    "timeTracker",
    "investigationUnderway",
    "chapterIndex",
    "chapterJournal",
    "chapterJournalByScope",
    "markedJournalChats",
    "introducedCharacters",
    "trialRoster",
    "giftJudgements",
    "markerRegistry",
    "investigationMarkers",
    "trials",
    "trialSession",
    "manualDebateTruthBulletIds",
    "effectLedger",
    "singleChatGroupId",
    "inventory.monocoins",
    "inventory.trustFragments",
    "inventory.skillPoints",
    "inventory.gifts",
    "inventory.keyItems",
    "inventory.skills",
    "inventory.equippedSkills",
    "overworld.characters",
    "overworld.hostPlacements",
    "map.currentLocationId",
    "map.storyPins",
    "map.scope",
    "map.dormRooms",
    "hostCards",
]);

const EXPORT_FORMAT = "dangan-save";
const EXPORT_VERSION = 1;

function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function readPath(obj, path) {
    let node = obj;
    for (const part of path.split(".")) {
        if (node == null || typeof node !== "object") return undefined;
        node = node[part];
    }
    return node;
}

function writePath(obj, path, value) {
    const parts = path.split(".");
    let node = obj;
    for (const part of parts.slice(0, -1)) {
        if (node[part] == null || typeof node[part] !== "object") node[part] = {};
        node = node[part];
    }
    const last = parts[parts.length - 1];
    if (value === undefined) delete node[last];
    else node[last] = value;
}

function defaultId(now) {
    return `save_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

// Short facts about a save's state, for lists.
export function summarizeState(state = {}) {
    const characters = Array.isArray(state.characters) ? state.characters : [];
    const roster = characters
        .map((entry) => (Array.isArray(entry) ? entry[1] : entry))
        .filter((c) => c && !c.isPlayer && c.name);
    const tracker = state.timeTracker || {};
    return {
        day: Math.max(1, Number(tracker.day) || 1),
        night: tracker.phase === "night",
        investigation: Boolean(state.investigationUnderway),
        chapterIndex: Number(state.chapterIndex) || 0,
        truthBulletCount: Array.isArray(state.truthBullets) ? state.truthBullets.length : 0,
        monocoins: Number(state.inventory?.monocoins) || 0,
        rosterNames: roster.map((c) => c.name),
    };
}

export function hasStoryProgress(state = {}) {
    const s = summarizeState(state);
    return s.rosterNames.length > 0
        || s.truthBulletCount > 0
        || s.chapterIndex > 0
        || s.day > 1
        || s.monocoins > 0
        || Number(state.progression?.level || 1) > 1
        || Number(state.progression?.xp || 0) > 0
        || Object.keys(state.introducedCharacters || {}).length > 0;
}

export function createSaveStore({ getRoot, defaults = {}, storyKeys = STORY_KEYS, now = () => Date.now(), makeId = defaultId } = {}) {
    const root = () => {
        const r = getRoot();
        r.saves ||= {};
        return r;
    };

    function captureLive() {
        const r = root();
        const state = {};
        for (const key of storyKeys) {
            const value = readPath(r, key);
            if (value !== undefined) writePath(state, key, clone(value));
        }
        return state;
    }

    function applyState(state = {}) {
        const r = root();
        for (const key of storyKeys) {
            const value = readPath(state, key);
            writePath(r, key, clone(value !== undefined ? value : readPath(defaults, key)));
        }
    }

    function get(id) {
        return root().saves[id] || null;
    }

    function getActiveId() {
        const r = root();
        return r.activeSaveId && r.saves[r.activeSaveId] ? r.activeSaveId : "";
    }

    function getActive() {
        return get(getActiveId());
    }

    // The state a save holds right now: the live keys for the active save.
    function stateOf(id) {
        if (id === getActiveId()) return captureLive();
        return clone(get(id)?.state || {});
    }

    function list() {
        const r = root();
        const activeId = getActiveId();
        return Object.values(r.saves)
            .map((save) => ({
                ...save,
                state: undefined,
                active: save.id === activeId,
                summary: summarizeState(stateOf(save.id)),
            }))
            .sort((a, b) => (b.active - a.active) || (b.updatedAt - a.updatedAt));
    }

    function uniqueName(base) {
        const names = new Set(Object.values(root().saves).map((s) => s.name));
        if (!names.has(base)) return base;
        let n = 2;
        while (names.has(`${base} (${n})`)) n += 1;
        return `${base} (${n})`;
    }

    // Makes a save without switching to it. `from` is "blank" (default
    // state), "live" (a copy of what's loaded now) or another save's id.
    function create({ name = "", mode = SAVE_MODES.MULTI, groupIds = [], from = "blank" } = {}) {
        const r = root();
        const t = now();
        const id = makeId(t);
        let state = {};
        if (from === "live") state = captureLive();
        else if (from !== "blank") state = stateOf(from);
        r.saves[id] = {
            id,
            name: uniqueName(String(name || "").trim() || "New Save"),
            mode: mode === SAVE_MODES.SINGLE ? SAVE_MODES.SINGLE : SAVE_MODES.MULTI,
            groupIds: [...new Set(groupIds.filter(Boolean).map(String))],
            createdAt: t,
            updatedAt: t,
            state,
        };
        return r.saves[id];
    }

    // Stores the live keys into the active save. Used before export, and on
    // switch. Afterwards the active save holds a copy until it's re-activated.
    function flushActive() {
        const active = getActive();
        if (!active) return null;
        active.state = captureLive();
        active.updatedAt = now();
        return active;
    }

    function activate(id) {
        const r = root();
        const next = get(id);
        if (!next) return false;
        if (id === getActiveId()) return false;
        flushActive();
        applyState(next.state || {});
        next.state = null;
        next.updatedAt = now();
        r.activeSaveId = id;
        return true;
    }

    // Marks the active save as touched, so lists sort it correctly.
    function touchActive() {
        const active = getActive();
        if (active) active.updatedAt = now();
    }

    function rename(id, name) {
        const save = get(id);
        const trimmed = String(name || "").trim();
        if (!save || !trimmed || trimmed === save.name) return false;
        save.name = uniqueName(trimmed);
        return true;
    }

    function remove(id) {
        const r = root();
        if (!r.saves[id] || id === getActiveId()) return false;
        delete r.saves[id];
        return true;
    }

    function duplicate(id) {
        const save = get(id);
        if (!save) return null;
        return create({ name: `${save.name} (copy)`, mode: SAVE_MODES.MULTI, from: id });
    }

    function findByGroupId(groupId) {
        if (groupId === undefined || groupId === null || groupId === "") return null;
        const key = String(groupId);
        return Object.values(root().saves).find((s) => (s.groupIds || []).includes(key)) || null;
    }

    function bindGroup(id, groupId) {
        const save = get(id);
        if (!save || groupId === undefined || groupId === null || groupId === "") return false;
        const key = String(groupId);
        // A chat belongs to one save at most.
        for (const other of Object.values(root().saves)) {
            if (other !== save && other.groupIds?.includes(key)) {
                other.groupIds = other.groupIds.filter((g) => g !== key);
            }
        }
        save.groupIds ||= [];
        if (save.groupIds.includes(key)) return false;
        save.groupIds.push(key);
        return true;
    }

    // First run after updating: wrap whatever is loaded into a save so no
    // progress is lost. Returns the new save, or null when saves exist or
    // there's nothing to keep (NEW GAME makes the first save then).
    function migrateIfNeeded({ mode = SAVE_MODES.MULTI, groupIds = [] } = {}) {
        const r = root();
        if (Object.keys(r.saves).length) {
            if (!getActiveId()) r.activeSaveId = Object.keys(r.saves)[0];
            return null;
        }
        if (!hasStoryProgress(captureLive())) return null;
        const save = create({ name: "Imported Save", mode, groupIds });
        save.state = null;
        r.activeSaveId = save.id;
        return save;
    }

    function exportSave(id) {
        const save = get(id);
        if (!save) return null;
        return {
            format: EXPORT_FORMAT,
            version: EXPORT_VERSION,
            name: save.name,
            mode: save.mode,
            exportedAt: now(),
            state: stateOf(id),
        };
    }

    // Imports as a new multi save; chat bindings don't travel between installs.
    function importSave(data) {
        if (!data || data.format !== EXPORT_FORMAT || typeof data.state !== "object" || data.state === null) {
            throw new Error("That file isn't a Danganronpa save.");
        }
        const save = create({ name: data.name || "Imported Save", mode: SAVE_MODES.MULTI });
        const state = {};
        for (const key of storyKeys) {
            const value = readPath(data.state, key);
            if (value !== undefined) writePath(state, key, clone(value));
        }
        save.state = state;
        return save;
    }

    return {
        captureLive,
        get,
        getActiveId,
        getActive,
        stateOf,
        list,
        create,
        flushActive,
        activate,
        touchActive,
        rename,
        remove,
        duplicate,
        findByGroupId,
        bindGroup,
        migrateIfNeeded,
        exportSave,
        importSave,
    };
}
