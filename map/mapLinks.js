// Automatic pin links and the Inn's dorm rooms.
//
// Links are worked out from where pins sit rather than stored, so they keep up
// as pins are added, moved or deleted, and edited default pins get them too.
// A pin's own `connectedTo` list still holds the manual links on top.
//
// - Every room pin links to its floor's hub (and the hub back to it). The hub
//   is a pin marked `hub: true`, else a built-in choice for that floor, else a
//   room named like a corridor or hallway. A pin can name another hub with
//   `hubId` (the Inn's dorm rooms use the Dorm Hallway).
// - Stairs pair up by id: `1f_to_2f` ↔ `2f_to_1f` in the same area.
// - A few built-in links join floors that don't follow that naming.
// - `autoConnect: false` on a pin turns all of this off for it.

// Only rooms take part: Monomachines and trial pins open their own screens.
export const AUTO_LINK_PIN_TYPES = Object.freeze(["room"]);

// Floors whose hub isn't a corridor.
export const BUILTIN_FLOOR_HUBS = Object.freeze({
    "hopes_peak/inn_floor_1": "door_to_hopes_peak_academy",
    "jabberwock_island/pier_cottages": "pier_cottages_courtyard",
});

// Links between floors that stairs naming doesn't cover.
export const BUILTIN_LINKS = Object.freeze([
    [
        { areaKey: "hopes_peak", floorKey: "floor_1", locationId: "1f_to_inn" },
        { areaKey: "hopes_peak", floorKey: "inn_floor_1", locationId: "door_to_hopes_peak_academy" },
    ],
]);

const HUB_NAME = /\b(corridor|hallway|hall)\b/i;

function isLinkable(pin) {
    return !!pin && !pin.hidden && AUTO_LINK_PIN_TYPES.includes(pin.type) && pin.autoConnect !== false && !!pin.locationId;
}

function onFloor(pin, areaKey, floorKey) {
    return pin.areaKey === areaKey && pin.floorKey === floorKey;
}

function looksLikeHub(pin) {
    const text = `${pin.label || ""} ${String(pin.locationId || "").replace(/_/g, " ")}`;
    return HUB_NAME.test(text);
}

// The pin every room on this floor links to, or null.
export function findFloorHub(pins = [], areaKey, floorKey) {
    const floorPins = pins.filter((p) => isLinkable(p) && onFloor(p, areaKey, floorKey));
    const flagged = floorPins.find((p) => p.hub === true);
    if (flagged) return flagged;
    const builtinId = BUILTIN_FLOOR_HUBS[`${areaKey}/${floorKey}`];
    const builtin = builtinId && floorPins.find((p) => p.locationId === builtinId);
    if (builtin) return builtin;
    return floorPins.find((p) => !p.hubId && looksLikeHub(p)) || null;
}

// The hub this pin hangs off: its own `hubId` if that pin exists on the
// floor, else the floor hub. Null when the pin is the hub itself.
export function findPinHub(pin, pins = []) {
    if (!isLinkable(pin)) return null;
    if (pin.hubId) {
        const own = pins.find((p) => p !== pin && isLinkable(p) && onFloor(p, pin.areaKey, pin.floorKey) && p.locationId === pin.hubId);
        if (own) return own;
    }
    const hub = findFloorHub(pins, pin.areaKey, pin.floorKey);
    return hub && hub !== pin ? hub : null;
}

function stairPartnerId(locationId) {
    const m = /^(.+?)_to_(.+)$/.exec(String(locationId || ""));
    return m ? `${m[2]}_to_${m[1]}` : null;
}

function matchesEnd(pin, end) {
    return pin.areaKey === end.areaKey && pin.floorKey === end.floorKey && pin.locationId === end.locationId;
}

// Every pin `pin` is automatically linked to, in a stable order.
export function getAutoLinkedPins(pin, pins = []) {
    if (!isLinkable(pin)) return [];
    const out = [];
    const add = (p) => { if (p && p !== pin && !out.includes(p)) out.push(p); };

    add(findPinHub(pin, pins));
    for (const other of pins) {
        if (other !== pin && isLinkable(other) && onFloor(other, pin.areaKey, pin.floorKey) && findPinHub(other, pins) === pin) add(other);
    }

    const partnerId = stairPartnerId(pin.locationId);
    if (partnerId) {
        add(pins.find((p) => isLinkable(p) && p.areaKey === pin.areaKey && p.locationId === partnerId));
    }

    for (const [a, b] of BUILTIN_LINKS) {
        const other = matchesEnd(pin, a) ? b : matchesEnd(pin, b) ? a : null;
        if (other) add(pins.find((p) => isLinkable(p) && matchesEnd(p, other)));
    }
    return out;
}

// Default corridor pins step aside when the player already has their own hub
// on that floor (or a pin using the same id), so floors don't get two
// corridors. Returns the ids of the defaults to leave out.
export function findRedundantDefaultHubs(pins = [], defaultHubIds = new Set()) {
    const redundant = new Set();
    for (const def of pins) {
        if (!def._default || !defaultHubIds.has(def.id)) continue;
        const rivals = pins.filter((p) => p !== def && !p.hidden && onFloor(p, def.areaKey, def.floorKey));
        const taken = rivals.some((p) => p.locationId === def.locationId || (isLinkable(p) && !p.hubId && (p.hub === true || looksLikeHub(p)) && !(p._default && defaultHubIds.has(p.id))));
        if (taken) redundant.add(def.id);
    }
    return redundant;
}

// ── Inn dorm rooms ───────────────────────────────────────────────────────────

export const DORM_AREA_KEY = "hopes_peak";
export const DORM_FLOOR_KEY = "inn_floor_1";
export const DORM_HUB_ID = "dorm_hallway";
export const DORM_PLAYER_KEY = "__player";

// The 15 empty rooms on the Inn Floor 1 picture, on the 480×272 map grid:
// five across the top, four down the right, six across the bottom.
export const INN_DORM_SLOTS = Object.freeze([
    { x: 250, y: 108 }, { x: 281, y: 108 }, { x: 311, y: 108 }, { x: 342, y: 108 }, { x: 372, y: 108 },
    { x: 443, y: 59 }, { x: 443, y: 86 }, { x: 443, y: 112 }, { x: 443, y: 137 },
    { x: 250, y: 166 }, { x: 281, y: 166 }, { x: 311, y: 166 }, { x: 342, y: 166 }, { x: 372, y: 166 }, { x: 401, y: 166 },
]);

// Gives each resident a dorm slot. Residents keep the slot they already have;
// newcomers take the lowest free one. Residents no longer listed lose theirs.
// `residents` is [{ key, name }] in priority order. Returns the new record
// map and the residents left without a room.
export function assignDormSlots(existing = {}, residents = [], slotCount = INN_DORM_SLOTS.length) {
    const rooms = {};
    const taken = new Set();
    for (const r of residents) {
        const prev = existing?.[r.key];
        const slot = Number(prev?.slot);
        if (Number.isInteger(slot) && slot >= 0 && slot < slotCount && !taken.has(slot)) {
            rooms[r.key] = { ...prev, slot };
            taken.add(slot);
        }
    }
    const homeless = [];
    for (const r of residents) {
        if (rooms[r.key]) continue;
        let slot = 0;
        while (slot < slotCount && taken.has(slot)) slot++;
        if (slot >= slotCount) { homeless.push(r); continue; }
        rooms[r.key] = { slot };
        taken.add(slot);
    }
    return { rooms, homeless };
}

export function dormLocationId(key) {
    const slug = String(key || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    return `dorm_${slug || "room"}`;
}

export function isDormPin(pin) {
    return !!pin?._generated && pin.areaKey === DORM_AREA_KEY && pin.floorKey === DORM_FLOOR_KEY;
}

// The fields a player can change on a dorm pin, kept in its save record.
export const DORM_EDITABLE_FIELDS = Object.freeze(["label", "icon", "bg", "bgm", "outfitPrefix", "x", "y", "connectedTo", "autoConnect", "locked"]);

function dormBasePin(resident, slot) {
    const pos = INN_DORM_SLOTS[slot];
    return {
        id: `dorm_${slot}_${dormLocationId(resident.key).slice(5)}`,
        icon: "bedroom.svg",
        type: "room",
        label: `${resident.name}'s Room`,
        locationId: dormLocationId(resident.key),
        areaKey: DORM_AREA_KEY,
        floorKey: DORM_FLOOR_KEY,
        x: pos.x,
        y: pos.y,
        hubId: DORM_HUB_ID,
    };
}

// Runtime pins for the assigned rooms, with the player's edits laid over.
export function buildDormPins(rooms = {}, residents = []) {
    const pins = [];
    for (const r of residents) {
        const rec = rooms[r.key];
        if (!rec) continue;
        const base = dormBasePin(r, rec.slot);
        pins.push({ ...base, ...(rec.edits || {}), _generated: true, _dormKey: r.key });
    }
    return pins;
}

// What changed on a dorm pin compared with how it was generated.
export function diffDormEdits(pin, resident, slot) {
    const base = dormBasePin(resident, slot);
    const edits = {};
    for (const field of DORM_EDITABLE_FIELDS) {
        if (pin[field] === undefined) continue;
        if (JSON.stringify(pin[field]) !== JSON.stringify(base[field])) edits[field] = pin[field];
    }
    return edits;
}
