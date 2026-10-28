// Character routines: the rooms each character tends to be in during the day
// and at night, so the shuffle puts people where they'd really be (and the
// case plan gets real "where was everyone?" alibis). Routines only weight the
// shuffle; anyone can still turn up anywhere.

export const ROUTINE_WEIGHT = 0.7;

function key(name) {
    return String(name ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

// `{ [name]: { day: [roomId], night: [roomId] } }`, empty rows dropped.
export function normalizeRoutines(routines) {
    const out = {};
    if (!routines || typeof routines !== "object") return out;
    for (const [name, r] of Object.entries(routines)) {
        const k = key(name);
        if (!k) continue;
        const day = [...new Set((Array.isArray(r?.day) ? r.day : []).map(String).filter(Boolean))];
        const night = [...new Set((Array.isArray(r?.night) ? r.night : []).map(String).filter(Boolean))];
        if (day.length || night.length) out[k] = { day, night };
    }
    return out;
}

export function getRoutine(routines, name) {
    return normalizeRoutines(routines)[key(name)] || { day: [], night: [] };
}

export function setRoutine(routines, name, { day, night } = {}) {
    const next = { ...normalizeRoutines(routines) };
    const k = key(name);
    if (!k) return next;
    const cur = next[k] || { day: [], night: [] };
    next[k] = { day: day ?? cur.day, night: night ?? cur.night };
    return normalizeRoutines(next);
}

export function clearRoutine(routines, name) {
    const next = { ...normalizeRoutines(routines) };
    delete next[key(name)];
    return next;
}

// `assignment` is a Map of character key → room id from the random shuffle.
// Each character with routine rooms on the map for this time of day goes to
// one of them with probability ROUTINE_WEIGHT; followers are left alone (they
// stay with the player). Returns a new Map.
export function applyRoutines(assignment, { routines, time = "day", spawnableRooms = [], followers = [], rng = Math.random } = {}) {
    const out = new Map(assignment);
    const table = normalizeRoutines(routines);
    const open = new Set(spawnableRooms);
    const following = new Set([...followers].map(key));
    const slot = time === "night" ? "night" : "day";
    for (const charKey of out.keys()) {
        if (following.has(key(charKey))) continue;
        const rooms = (table[key(charKey)]?.[slot] || []).filter((r) => open.has(r));
        if (!rooms.length || rng() >= ROUTINE_WEIGHT) continue;
        out.set(charKey, rooms[Math.floor(rng() * rooms.length) % rooms.length]);
    }
    return out;
}

// For the case plan: "Name: daytime Library, Gym; nighttime Dorm".
export function describeRoutines(routines, { roomLabel = (id) => id, names = null } = {}) {
    const table = normalizeRoutines(routines);
    const allowed = names ? new Set(names.map(key)) : null;
    const display = new Map((names || []).map((n) => [key(n), n]));
    const lines = [];
    for (const [k, r] of Object.entries(table)) {
        if (allowed && !allowed.has(k)) continue;
        const parts = [];
        if (r.day.length) parts.push(`daytime ${r.day.map(roomLabel).join(", ")}`);
        if (r.night.length) parts.push(`nighttime ${r.night.map(roomLabel).join(", ")}`);
        lines.push(`- ${display.get(k) || k}: ${parts.join("; ")}`);
    }
    return lines;
}

// The hidden SUGGEST FROM CARDS call.
export function buildRoutineSuggestionPrompt({ cast = [], rooms = [] } = {}) {
    const people = cast.map((c) => `- ${c.name}${c.ultimate ? ` (Ultimate ${c.ultimate})` : ""}${c.description ? `: ${String(c.description).slice(0, 300)}` : ""}`).join("\n");
    const roomList = rooms.map((r) => `- ${r.id}: ${r.label}`).join("\n");
    return `You are planning where each student in a Danganronpa killing game usually spends their time.

Students:
${people}

Rooms (id: name):
${roomList}

For each student, pick 1 to 3 rooms where they'd usually be during the daytime, and 1 or 2 at night, based on their talent and personality. Use only room ids from the list.
Reply with only a JSON object, no other text:
{"Student Name": {"day": ["roomId"], "night": ["roomId"]}}`;
}

function fuzzyRoom(value, rooms) {
    const v = key(value).replace(/[^a-z0-9]/g, "");
    if (!v) return "";
    const norm = (s) => key(s).replace(/[^a-z0-9]/g, "");
    const exact = rooms.find((r) => norm(r.id) === v || norm(r.label) === v);
    if (exact) return exact.id;
    const partial = rooms.find((r) => norm(r.label).includes(v) || v.includes(norm(r.label)) || norm(r.id).includes(v));
    return partial ? partial.id : "";
}

// Parsed JSON (already an object) → routines for the given cast, rooms checked.
export function parseRoutineSuggestion(data, { cast = [], rooms = [] } = {}) {
    const out = {};
    if (!data || typeof data !== "object") return out;
    const byKey = new Map(cast.map((c) => [key(c.name), c.name]));
    const firstName = new Map(cast.map((c) => [key(String(c.name).split(/\s+/)[0]), c.name]));
    for (const [rawName, r] of Object.entries(data)) {
        const name = byKey.get(key(rawName)) || firstName.get(key(String(rawName).split(/\s+/)[0]));
        if (!name) continue;
        const pick = (list) => [...new Set((Array.isArray(list) ? list : [list]).map((x) => fuzzyRoom(x, rooms)).filter(Boolean))];
        const day = pick(r?.day);
        const night = pick(r?.night);
        if (day.length || night.length) out[key(name)] = { day, night };
    }
    return out;
}

// Suggestions only fill characters that have no routine yet.
export function mergeSuggestedRoutines(current, suggested) {
    const cur = normalizeRoutines(current);
    const next = { ...cur };
    for (const [k, r] of Object.entries(normalizeRoutines(suggested))) {
        if (!cur[k]) next[k] = r;
    }
    return next;
}
