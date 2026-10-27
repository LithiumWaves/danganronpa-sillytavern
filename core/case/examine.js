// Examine mode: the spots in a room the player can look at during an
// investigation. Some hide one of the case's anchor clues, the rest are
// ordinary; nothing on screen says which. Pure helpers, unit tested.

import { parseLooseJson } from "./caseFile.js";

export const MIN_SPOTS = 4;
export const MAX_SPOTS = 6;

function text(value, max = 80) {
    return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

// The anchor clues planted in a room.
export function cluesInRoom(caseFile, roomId) {
    return (caseFile?.clues || []).filter((c) => c.roomId && c.roomId === roomId);
}

export function buildHotspotPrompt({ caseFile, roomId, roomLabel }) {
    const clues = cluesInRoom(caseFile, roomId);
    const isScene = caseFile?.body?.roomId === roomId;
    const clueLines = clues.map((c, i) => `${i + 1}. ${c.text}`).join("\n");
    return `A Danganronpa investigation. List the things in a room the player can examine up close.

ROOM: ${roomLabel || roomId}
${isScene ? `This is the crime scene: ${caseFile.victim}'s body is here. ${caseFile.body.state}\n` : ""}EVIDENCE HIDDEN IN THIS ROOM:
${clueLines || "(none)"}

Reply with one JSON object and nothing else:
{ "spots": [{ "label": "short name of an object or place, 1-4 words", "clue": number of the evidence it hides, or null }] }

Rules:
- ${MIN_SPOTS} to ${MAX_SPOTS} spots: ordinary furniture and objects of this room${isScene ? ", including the body" : ""}.
- Every piece of evidence above is hidden in exactly one spot. The spot's label must not give it away.
- The other spots hide nothing.`;
}

// Turns the model's reply into spots. Every anchor clue gets a spot even if
// the model forgot one, so nothing planned becomes unfindable.
export function parseHotspots(raw, { caseFile, roomId, isScene = false } = {}) {
    const clues = cluesInRoom(caseFile, roomId);
    const data = parseLooseJson(raw).value;
    const spots = [];
    const used = new Set();
    for (const s of Array.isArray(data?.spots) ? data.spots : []) {
        const label = text(s?.label, 40);
        if (!label || spots.some((x) => x.label.toLowerCase() === label.toLowerCase())) continue;
        const n = Number(s?.clue);
        const clue = Number.isInteger(n) && n >= 1 && n <= clues.length && !used.has(n - 1) ? clues[n - 1] : null;
        if (clue) used.add(n - 1);
        spots.push({ label, clueId: clue?.id || "" });
        if (spots.length >= MAX_SPOTS) break;
    }
    clues.forEach((clue, i) => {
        if (used.has(i)) return;
        const free = spots.find((s) => !s.clueId);
        if (free) free.clueId = clue.id;
        else spots.push({ label: `Something odd #${i + 1}`, clueId: clue.id });
    });
    if (isScene && !spots.some((s) => /body|corpse/i.test(s.label))) spots.unshift({ label: "The body", clueId: "" });
    const fillers = ["Floor", "Corner", "Shelf", "Table", "Door"];
    while (spots.length < MIN_SPOTS) {
        const label = fillers.find((f) => !spots.some((s) => s.label === f)) || `Spot ${spots.length + 1}`;
        spots.push({ label, clueId: "" });
    }
    return spots.map((s, i) => ({ id: `spot${i + 1}`, ...s, examined: false }));
}

// Where spots sit (percent of the room) before the player moves them: spread
// in two loose rows across the lower two thirds, where furniture usually is.
export function layoutHotspots(count) {
    const out = [];
    const top = Math.ceil(count / 2);
    for (let i = 0; i < count; i += 1) {
        const inTop = i < top;
        const row = inTop ? top : count - top;
        const k = inTop ? i : i - top;
        out.push({
            x: Math.round((100 / (row + 1)) * (k + 1) + (inTop ? -4 : 4)),
            y: inTop ? 44 : 70,
        });
    }
    return out;
}

// Spots with their positions: the player's saved ones first, else the layout.
export function placeHotspots(spots, savedPositions = {}) {
    const layout = layoutHotspots(spots.length);
    return spots.map((s, i) => {
        const saved = savedPositions[s.label.toLowerCase()];
        const pos = saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) ? saved : layout[i];
        return { ...s, x: clamp(pos.x), y: clamp(pos.y) };
    });
}

function clamp(v) {
    return Math.max(2, Math.min(98, Math.round(Number(v) * 10) / 10));
}

export function normalizeExamine(raw) {
    const out = {};
    for (const [roomId, room] of Object.entries(raw && typeof raw === "object" ? raw : {})) {
        const spots = (Array.isArray(room?.spots) ? room.spots : [])
            .map((s, i) => ({
                id: text(s?.id, 40) || `spot${i + 1}`,
                label: text(s?.label, 40),
                clueId: text(s?.clueId, 40),
                x: clamp(Number.isFinite(Number(s?.x)) ? Number(s.x) : 50),
                y: clamp(Number.isFinite(Number(s?.y)) ? Number(s.y) : 50),
                examined: Boolean(s?.examined),
            }))
            .filter((s) => s.label);
        if (spots.length) out[text(roomId, 120)] = { spots };
    }
    return out;
}

// The pending look the next reply narrates.
export function buildExamineNote(caseFile, { label, clueId = "", freeText = false, roomId = "" } = {}) {
    const clue = clueId ? caseFile.clues.find((c) => c.id === clueId) : null;
    const lines = [`[EXAMINING]`, `The player is examining ${freeText ? "" : "the "}${label} up close right now. Narrate what they find, through their inner thoughts and the reactions of anyone here, in this reply.`];
    if (clue) {
        lines.push(`They find this, and it matters: ${clue.text}`);
        lines.push("Record it as a Truth Bullet on its own line: V3C| TB: Short Title || One-sentence description");
    } else if (freeText) {
        const here = cluesInRoom(caseFile, roomId).filter((c) => !c.found);
        lines.push(here.length
            ? `If what they examine fits one of these, they find it and it becomes a Truth Bullet (V3C| TB: Short Title || One-sentence description): ${here.map((c) => c.text).join(" / ")}. Otherwise give a small detail that fits the case, or nothing of note.`
            : "Give a small detail that fits the case facts, or nothing of note. Only something truly new and important becomes a Truth Bullet.");
    } else {
        lines.push("Nothing decisive is here: give a small, believable detail that fits the case facts, and no Truth Bullet unless something truly important turns up.");
    }
    return lines.join("\n");
}
