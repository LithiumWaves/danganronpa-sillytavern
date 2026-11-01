// Exploring a newly unlocked floor (DR's "a new area has opened"): when a
// chapter change opens floors, each gets a checklist of its rooms, shown in
// the Phase HUD hint until every room has been entered once. It's not a
// gate: nothing waits on it. Kept per save under the story key
// `floorExplore`: { floors: [{ areaKey, floorKey, label, rooms: [{ id, label, visited }] }] }.

function text(value, max = 120) {
    return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function normalizeFloorExplore(raw) {
    const floors = (Array.isArray(raw?.floors) ? raw.floors : []).map((f) => ({
        areaKey: text(f?.areaKey, 80),
        floorKey: text(f?.floorKey, 80),
        label: text(f?.label) || text(f?.floorKey, 80),
        rooms: (Array.isArray(f?.rooms) ? f.rooms : [])
            .map((r) => ({ id: text(r?.id), label: text(r?.label) || text(r?.id), visited: Boolean(r?.visited) }))
            .filter((r) => r.id),
    })).filter((f) => f.areaKey && f.floorKey && f.rooms.length);
    return { floors: floors.slice(-6) };
}

// Floors whose unlock chapter is after `from` and no later than `to`.
// `floors` is [{ areaKey, floorKey, label, unlockChapter }].
export function floorsUnlockedBetween(floors, from, to) {
    const a = Number(from) || 0;
    const b = Number(to) || 0;
    if (b <= a) return [];
    return (floors || []).filter((f) => Number(f.unlockChapter) > a && Number(f.unlockChapter) <= b);
}

// Adds checklists for newly opened floors (their room pins, dorms aside).
// A floor already being explored is kept as it is.
export function startExploring(state, floors, pins) {
    const cur = normalizeFloorExplore(state);
    const added = [];
    for (const f of floors || []) {
        if (cur.floors.some((x) => x.areaKey === f.areaKey && x.floorKey === f.floorKey)) continue;
        const seen = new Set();
        const rooms = (pins || [])
            .filter((p) => p?.type === "room" && p.locationId && !p.hidden && !p._generated && p.areaKey === f.areaKey && p.floorKey === f.floorKey)
            .filter((p) => !seen.has(p.locationId) && seen.add(p.locationId))
            .map((p) => ({ id: p.locationId, label: p.label || p.locationId, visited: false }));
        if (!rooms.length) continue;
        const floor = { areaKey: f.areaKey, floorKey: f.floorKey, label: f.label || f.floorKey, rooms };
        cur.floors.push(floor);
        added.push(floor);
    }
    return { state: normalizeFloorExplore(cur), added };
}

// The player walked into `locationId`. Returns { state, changed, finished }
// (finished: the floor whose last room this was, or null).
export function markRoomVisited(state, locationId) {
    const cur = normalizeFloorExplore(state);
    let changed = false;
    let finished = null;
    for (const f of cur.floors) {
        const room = f.rooms.find((r) => r.id === locationId && !r.visited);
        if (!room) continue;
        room.visited = true;
        changed = true;
        if (f.rooms.every((r) => r.visited)) finished = f;
    }
    if (finished) cur.floors = cur.floors.filter((f) => f !== finished);
    return { state: cur, changed, finished };
}

// The Phase HUD line: "EXPLORE 2F (2/5): Library, Art Room, …" — the rooms
// still to see. "" when there's nothing to explore.
export function describeExploreHint(state, { maxRooms = 4 } = {}) {
    const floors = normalizeFloorExplore(state).floors;
    return floors.map((f) => {
        const left = f.rooms.filter((r) => !r.visited);
        const done = f.rooms.length - left.length;
        const names = left.slice(0, maxRooms).map((r) => r.label).join(", ");
        return `EXPLORE ${f.label.toUpperCase()} (${done}/${f.rooms.length}): ${names}${left.length > maxRooms ? ", …" : ""}`;
    }).join(" · ");
}

// What Monokuma says when floors open.
export function buildFloorOpenAnnouncement(floors) {
    const names = (floors || []).map((f) => f.label || f.floorKey).filter(Boolean);
    if (!names.length) return "";
    const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
    return `Ahem! Attention, students! As a little reward for your hard work, ${list} ${names.length === 1 ? "is" : "are"} now open! Go on, explore to your heart's content. Puhuhu... who knows what you'll find?`;
}
