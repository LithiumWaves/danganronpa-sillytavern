// Examine mode during daily life: ordinary spots to look at, with Monocoins
// tucked into a few (V3) and one hidden Monokuma per floor (DR2). Nothing
// here is evidence. Kept per save and made fresh each chapter. Pure helpers,
// unit tested.

import { describeRoomOwner } from "./examine.js";

export const DAILY_COINS = Object.freeze({ min: 3, max: 10 });
export const HIDDEN_MONOKUMA_COINS = 10;
export const ALL_MONOKUMAS_BONUS = 30;

export const DEFAULT_DAILY_NARRATION_TEMPLATE = `A Danganronpa school life. {{player}} looks at {{thing}} in the {{room}}.
Also here: {{present}}
{{owner}}

RECENT EVENTS:
{{recentChat}}

Write only what {{player}} notices, as their inner monologue: 1-3 short sentences, first person, present tense, like looking around during free time in a Danganronpa game. Plain prose only: no headings, labels, reports, lists, bold text or quotes. This isn't an investigation: never write Truth Bullets or evidence lines.
{{found}}`;

function text(value, max = 80) {
    return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function int(value, min = 0) {
    return Math.max(min, Math.round(Number(value) || 0));
}

function normalizeSpot(sp, i) {
    return {
        id: text(sp?.id, 40) || `spot${i + 1}`,
        label: text(sp?.label, 40),
        examined: Boolean(sp?.examined),
        coins: int(sp?.coins),
        coinsTaken: Boolean(sp?.coinsTaken),
        monokuma: Boolean(sp?.monokuma),
    };
}

// A stored record, or a fresh one when the chapter changed.
export function normalizeDailyExamine(raw, chapter = 0) {
    const ch = int(chapter);
    if (!raw || typeof raw !== "object" || int(raw.chapter) !== ch) {
        return { chapter: ch, rooms: {}, monokumas: {}, coinsFound: 0 };
    }
    const rooms = {};
    for (const [roomId, room] of Object.entries(raw.rooms || {})) {
        const spots = (Array.isArray(room?.spots) ? room.spots : []).map(normalizeSpot).filter((sp) => sp.label);
        if (spots.length) rooms[roomId] = { spots };
    }
    const monokumas = {};
    for (const [floorKey, m] of Object.entries(raw.monokumas || {})) {
        if (m?.roomId) monokumas[floorKey] = { roomId: text(m.roomId, 120), spotId: text(m.spotId, 40), found: Boolean(m.found) };
    }
    return { chapter: ch, rooms, monokumas, coinsFound: int(raw.coinsFound) };
}

// The daily version of the spots prompt: no evidence, just things to look at.
export function buildDailyHotspotPrompt({ roomLabel = "", owner = null, previous = [], min = 4, max = 6 } = {}) {
    const before = previous.map((l) => text(l, 40)).filter(Boolean);
    return `A Danganronpa school life. List the things in a room the player can look at up close during free time.

ROOM: ${roomLabel || "a room"}
${owner?.name ? `${describeRoomOwner(owner)}\n` : ""}
Reply with one JSON object and nothing else:
{ "spots": [{ "label": "short name of an object or place, 1-4 words" }] }

Rules:
- ${min} to ${max} spots: furniture, objects and corners that fit this room and are fun to look at.${owner?.name ? `\n- Fill the room with belongings and details that fit ${owner.name}: their talent, hobbies and personality.` : ""}${before.length ? `\n- This room was already looked at with these spots: ${before.join(", ")}. Pick other objects and places.` : ""}`;
}

// New spots get Monocoins in one or two of them (3–10 each). `coins`, when
// given, is the exact amounts to hide instead (a room made again keeps only
// the coins nobody took).
export function seedDailySpots(spots, { rng = Math.random, coins = null } = {}) {
    const out = spots.map((sp, i) => normalizeSpot({ ...sp, coins: 0, coinsTaken: false, monokuma: false }, i));
    if (!out.length) return out;
    const amounts = Array.isArray(coins)
        ? coins.filter((n) => n > 0)
        : Array.from({ length: rng() < 0.5 ? 1 : 2 }, () => DAILY_COINS.min + Math.floor(rng() * (DAILY_COINS.max - DAILY_COINS.min + 1)));
    const order = out.map((_, i) => i).sort(() => rng() - 0.5);
    amounts.slice(0, out.length).forEach((amount, k) => { out[order[k]].coins = amount; });
    return out;
}

// The coins still hidden in a room, for making its spots again.
export function untakenCoins(record, roomId) {
    return (record.rooms[roomId]?.spots || []).filter((sp) => sp.coins && !sp.coinsTaken).map((sp) => sp.coins);
}

// Picks the room of each floor that hides its Monokuma (one per floor).
// `floors` is [{ key, roomIds }]. Floors that already have one keep it.
export function planHiddenMonokumas(record, floors = [], { rng = Math.random } = {}) {
    const monokumas = { ...record.monokumas };
    for (const floor of floors) {
        if (!floor?.key || monokumas[floor.key] || !floor.roomIds?.length) continue;
        monokumas[floor.key] = { roomId: floor.roomIds[Math.floor(rng() * floor.roomIds.length) % floor.roomIds.length], spotId: "", found: false };
    }
    return { ...record, monokumas };
}

// Stores a room's new spots and hides any Monokuma meant for this room in one.
export function setDailySpots(record, roomId, spots, { rng = Math.random, coins = null } = {}) {
    const seeded = seedDailySpots(spots, { rng, coins });
    const monokumas = { ...record.monokumas };
    for (const [key, m] of Object.entries(monokumas)) {
        if (m.roomId !== roomId || m.found || !seeded.length) continue;
        const spot = seeded[Math.floor(rng() * seeded.length) % seeded.length];
        spot.monokuma = true;
        monokumas[key] = { ...m, spotId: spot.id };
    }
    return { ...record, rooms: { ...record.rooms, [roomId]: { spots: seeded } }, monokumas };
}

// Forgets a room's spots (its Monokuma, if not found yet, hides again).
export function clearDailyRoom(record, roomId) {
    const rooms = { ...record.rooms };
    delete rooms[roomId];
    const monokumas = {};
    for (const [key, m] of Object.entries(record.monokumas)) {
        monokumas[key] = m.roomId === roomId && !m.found ? { ...m, spotId: "" } : m;
    }
    return { ...record, rooms, monokumas };
}

// Examining a spot: marks it, and hands over its coins and Monokuma once.
// Returns { record, coins, monokuma, monokumasFound, monokumasTotal, allFound }.
export function claimSpot(record, roomId, spotId) {
    const none = { record, coins: 0, monokuma: false, monokumasFound: 0, monokumasTotal: 0, allFound: false };
    const room = record.rooms[roomId];
    const spot = room?.spots.find((sp) => sp.id === spotId);
    if (!spot) return none;
    const coins = spot.coinsTaken ? 0 : spot.coins;
    const monokumaKey = Object.keys(record.monokumas).find((k) => {
        const m = record.monokumas[k];
        return m.roomId === roomId && m.spotId === spotId && !m.found;
    });
    const spots = room.spots.map((sp) => (sp.id === spotId ? { ...sp, examined: true, coinsTaken: sp.coinsTaken || sp.coins > 0 } : sp));
    const monokumas = monokumaKey ? { ...record.monokumas, [monokumaKey]: { ...record.monokumas[monokumaKey], found: true } } : record.monokumas;
    const next = { ...record, rooms: { ...record.rooms, [roomId]: { spots } }, monokumas, coinsFound: record.coinsFound + coins };
    const all = Object.values(monokumas);
    const found = all.filter((m) => m.found).length;
    return {
        record: next,
        coins,
        monokuma: Boolean(monokumaKey),
        monokumasFound: found,
        monokumasTotal: all.length,
        allFound: Boolean(monokumaKey) && all.length > 0 && found === all.length,
    };
}

// What the narration should mention finding.
export function describeDailyFind({ coins = 0, monokuma = false, player = "the player" } = {}) {
    const lines = [];
    if (coins) lines.push(`Tucked away there, ${player} finds ${coins} Monocoins. Mention finding them.`);
    if (monokuma) lines.push(`A tiny hidden Monokuma figure is hiding there, grinning. ${player} spots it. Mention it.`);
    return lines.join("\n");
}

// The hidden call for what the player notices in daily life.
export function buildDailyNarrationPrompt(look, { player = "", roomLabel = "", present = [], recentChat = "", owner = null, found = {}, template = "" } = {}) {
    const who = player || "the protagonist";
    const values = {
        player: who,
        thing: `${look?.freeText ? "" : "the "}${look?.label || "room"}`,
        room: roomLabel || "room",
        present: present.length ? present.join(", ") : "nobody else",
        recentChat: recentChat || "(none)",
        owner: owner?.name ? describeRoomOwner(owner) : "",
        found: describeDailyFind({ ...found, player: who }),
    };
    const textTemplate = typeof template === "string" && template.trim() ? template : DEFAULT_DAILY_NARRATION_TEMPLATE;
    const filled = textTemplate.replace(/\{\{(\w+)\}\}/g, (m, key) => (key in values ? values[key] : m));
    const extra = [
        values.owner && !textTemplate.includes("{{owner}}") ? values.owner : "",
        values.found && !textTemplate.includes("{{found}}") ? values.found : "",
    ].filter(Boolean);
    return [filled.trim(), ...extra].join("\n");
}

// Spoiler list for /examine coins.
export function describeDailyExamine(record, { roomLabel = (id) => id } = {}) {
    const lines = [`Chapter ${record.chapter} · Monocoins found: ${record.coinsFound}`];
    for (const [roomId, room] of Object.entries(record.rooms)) {
        const spots = room.spots.map((sp) => `${sp.examined ? "✓" : "·"}${sp.label}${sp.coins ? ` (${sp.coins} coins${sp.coinsTaken ? ", taken" : ""})` : ""}${sp.monokuma ? " [MONOKUMA]" : ""}`);
        lines.push(`${roomLabel(roomId)}: ${spots.join(", ")}`);
    }
    for (const [floor, m] of Object.entries(record.monokumas)) {
        lines.push(`Hidden Monokuma on ${floor}: ${roomLabel(m.roomId)}${m.spotId ? "" : " (spots not made yet)"}${m.found ? " · found" : ""}`);
    }
    return lines.join("\n");
}
