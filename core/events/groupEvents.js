// Group events in daily life: a party, a study session, a séance. A classmate
// proposes one in the roleplay (a V3C| EVENT marker), the morning brings one
// (an optional hidden call), or the player plans one. At its time slot the
// attendees gather in its room and replies there are told it's happening.
// Kept per save under the story key `groupEvents`.

import { matchRoom } from "../case/caseFile.js";

export const EVENT_STATUS = Object.freeze({ PLANNED: "planned", DONE: "done", CANCELLED: "cancelled" });
const SOURCES = ["marker", "proposal", "player", "debug"];
const MAX_EVENTS = 40;

export const DEFAULT_EVENT_MARKER_TEMPLATE = `[EVENT MARKER]
When a character proposes a get-together that others agree to (a party, a study session, a meal, a séance), write it on its own line:
V3C| EVENT: Title | Room | Day N day or Day N night | Host
You may add the people invited, separated by commas, as a fifth part (otherwise everyone is invited). Use a room from the map and today or a later day. Only for a real plan, at most one per reply.`;

export const DEFAULT_EVENT_PROPOSAL_TEMPLATE = `It's the morning of Day {{day}} in a Danganronpa killing game. Decide whether one of the students proposes a get-together for today or tomorrow (a party, a study session, a shared meal, a game night, a séance) that fits their personality and the story so far.

STUDENTS:
{{cast}}

ROOMS (use one of these names):
{{rooms}}

RECENT EVENTS:
{{recentChat}}

If nobody would, reply with NONE. Otherwise reply with exactly one line and nothing else:
V3C| EVENT: Title | Room | Day N day or Day N night | Host`;

const EVENT_MARKER_REGEX = /V3C\s*[|｜]\s*EVENT\s*:\s*([^\n\r]+)/gi;

function text(value, max = 120) {
    return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function key(value) {
    return text(value).toLowerCase();
}

// Order of time slots: Day 2 day < Day 2 night < Day 3 day.
export function slotRank(day, time) {
    return (Math.max(1, Number(day) || 1) * 2) + (time === "night" ? 1 : 0);
}

// "Day 3 night", "day 3", "tonight", "tomorrow", "tomorrow night", "today"
// → { day, time }, or null. Never a slot that's already over.
export function resolveWhen(raw, { day = 1, time = "day" } = {}) {
    const s = key(raw);
    if (!s) return null;
    let out = null;
    const m = s.match(/day\s*(\d+)\s*(daytime|day|nighttime|night|evening)?/);
    const nightWord = /night|evening/.test(s);
    if (m) out = { day: Number(m[1]), time: /night|evening/.test(m[2] || "") || (!m[2] && nightWord) ? "night" : "day" };
    else if (/tonight/.test(s)) out = { day, time: "night" };
    else if (/tomorrow/.test(s)) out = { day: day + 1, time: nightWord ? "night" : "day" };
    else if (/today|now/.test(s)) out = { day, time: nightWord ? "night" : time };
    if (!out || !(out.day >= 1)) return null;
    return slotRank(out.day, out.time) >= slotRank(day, time) ? out : null;
}

// Returns [{ title, room, when, host, attendees, index }] (raw text).
export function parseEventMarkers(raw) {
    const out = [];
    for (const m of String(raw ?? "").matchAll(EVENT_MARKER_REGEX)) {
        const parts = m[1].replace(/[*_`]+$/g, "").split(/\s*[|｜]\s*/).map((p) => text(p, 200));
        const [title, room, when, host, people] = parts;
        if (!title || !room || !when) continue;
        out.push({
            title,
            room,
            when,
            host: host || "",
            attendees: people ? people.split(/\s*,\s*/).map((n) => text(n, 80)).filter(Boolean) : [],
            index: m.index,
        });
    }
    return out;
}

export function stripEventMarkers(raw) {
    return String(raw ?? "").replace(/^[ \t]*V3C\s*[|｜]\s*EVENT\s*:[^\n\r]*(\r?\n)?/gim, "");
}

function normalizeEvent(raw) {
    if (!raw || typeof raw !== "object") return null;
    const title = text(raw.title);
    const roomId = text(raw.roomId);
    const day = Math.round(Number(raw.day) || 0);
    if (!title || !roomId || day < 1) return null;
    return {
        id: text(raw.id, 60) || `ev_${day}_${title.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 30)}`,
        title,
        host: text(raw.host, 80),
        roomId,
        roomLabel: text(raw.roomLabel) || roomId,
        day,
        time: raw.time === "night" ? "night" : "day",
        // Empty means everyone alive.
        attendees: [...new Set((Array.isArray(raw.attendees) ? raw.attendees : []).map((n) => text(n, 80)).filter(Boolean))].slice(0, 20),
        playerAttending: Boolean(raw.playerAttending),
        status: Object.values(EVENT_STATUS).includes(raw.status) ? raw.status : EVENT_STATUS.PLANNED,
        source: SOURCES.includes(raw.source) ? raw.source : "marker",
        // The attendees were gathered at the event's slot.
        gathered: Boolean(raw.gathered),
    };
}

export function normalizeGroupEvents(list) {
    const out = [];
    const ids = new Set();
    for (const raw of Array.isArray(list) ? list : []) {
        const ev = normalizeEvent(raw);
        if (!ev) continue;
        let id = ev.id;
        for (let n = 2; ids.has(id); n += 1) id = `${ev.id}_${n}`;
        ids.add(id);
        out.push({ ...ev, id });
    }
    return out.slice(-MAX_EVENTS);
}

// A marker or proposal turned into an event, checked against the map and the
// clock. Returns { event } or { error }.
export function eventFromMarker(marker, { rooms = [], day = 1, time = "day", source = "marker" } = {}) {
    const room = matchRoom(marker?.room, rooms);
    if (!room) return { error: `"${text(marker?.room)}" isn't a room on the map.` };
    const when = resolveWhen(marker?.when, { day, time });
    if (!when) return { error: `"${text(marker?.when)}" isn't today or later.` };
    const event = normalizeEvent({
        title: marker.title,
        host: marker.host,
        roomId: room.id,
        roomLabel: room.label,
        day: when.day,
        time: when.time,
        attendees: marker.attendees,
        source,
    });
    return event ? { event } : { error: "The event needs a title." };
}

// Adds an event unless the same one (title and slot) is already planned.
// Returns { list, event, added }.
export function addGroupEvent(list, event) {
    const events = normalizeGroupEvents(list);
    const ev = normalizeEvent(event);
    if (!ev) return { list: events, event: null, added: false };
    const same = events.find((e) => e.status !== EVENT_STATUS.CANCELLED && key(e.title) === key(ev.title) && e.day === ev.day && e.time === ev.time);
    if (same) return { list: events, event: same, added: false };
    const next = normalizeGroupEvents([...events, ev]);
    return { list: next, event: next[next.length - 1], added: true };
}

export function updateGroupEvent(list, id, changes) {
    return normalizeGroupEvents(normalizeGroupEvents(list).map((e) => (e.id === id ? { ...e, ...changes, id } : e)));
}

export function isAtSlot(event, day, time) {
    return event.day === Number(day) && event.time === (time === "night" ? "night" : "day");
}

// Planned events happening in this slot.
export function eventsForSlot(list, day, time) {
    return normalizeGroupEvents(list).filter((e) => e.status === EVENT_STATUS.PLANNED && isAtSlot(e, day, time));
}

// Planned events from this slot on, soonest first.
export function upcomingEvents(list, day, time) {
    const now = slotRank(day, time);
    return normalizeGroupEvents(list)
        .filter((e) => e.status === EVENT_STATUS.PLANNED && slotRank(e.day, e.time) >= now)
        .sort((a, b) => slotRank(a.day, a.time) - slotRank(b.day, b.time));
}

// Planned events whose slot has gone by are done.
export function finishPastEvents(list, day, time) {
    const now = slotRank(day, time);
    return normalizeGroupEvents(list).map((e) => (e.status === EVENT_STATUS.PLANNED && slotRank(e.day, e.time) < now ? { ...e, status: EVENT_STATUS.DONE } : e));
}

// Who comes: the listed attendees and the host, or everyone alive.
export function eventAttendees(event, aliveNames = []) {
    const alive = new Map(aliveNames.map((n) => [key(n), n]));
    const wanted = event.attendees.length ? [event.host, ...event.attendees] : aliveNames;
    return [...new Set(wanted.map((n) => alive.get(key(n))).filter(Boolean))];
}

export function describeWhen(event) {
    return `Day ${event.day} ${event.time === "night" ? "night" : "daytime"}`;
}

// The note for a reply: the event happening here right now, and the other
// get-togethers everyone knows are planned. "" when there's nothing.
export function buildEventTodayNote(list, { roomId = "", day = 1, time = "day" } = {}) {
    const lines = [];
    for (const e of eventsForSlot(list, day, time)) {
        if (roomId && e.roomId === roomId) {
            lines.push(`[EVENT TODAY]\n${e.title}${e.host ? `, hosted by ${e.host}` : ""}, is happening here in the ${e.roomLabel} right now${e.attendees.length ? ` (invited: ${e.attendees.join(", ")})` : " (everyone was invited)"}. Play the get-together out naturally.`);
        }
    }
    const others = upcomingEvents(list, day, time).filter((e) => !(isAtSlot(e, day, time) && roomId && e.roomId === roomId)).slice(0, 4);
    if (others.length) lines.push(`[PLANNED GET-TOGETHERS]\n${others.map((e) => `${e.title} in the ${e.roomLabel}, ${isAtSlot(e, day, time) ? "happening now" : describeWhen(e)}${e.host ? `, hosted by ${e.host}` : ""}`).join("; ")}.`);
    return lines.join("\n\n");
}

// Lines for the case planner: what's coming up, so a public murder's
// gathering can be one of them.
export function describeEventsForCase(list, day, time) {
    return upcomingEvents(list, day, time).map((e) => `- ${e.id}: ${e.title} in ${e.roomId} (${e.roomLabel}), ${describeWhen(e)}${e.host ? `, hosted by ${e.host}` : ""}`);
}

export function buildEventProposalPrompt({ cast = [], rooms = [], day = 1, recentChat = "", template = "" } = {}) {
    return String(template || DEFAULT_EVENT_PROPOSAL_TEMPLATE)
        .replace(/\{\{day\}\}/g, String(day))
        .replace(/\{\{cast\}\}/g, cast.map((c) => `- ${c.name}${c.ultimate ? ` (Ultimate ${c.ultimate})` : ""}`).join("\n") || "- (none)")
        .replace(/\{\{rooms\}\}/g, rooms.map((r) => `- ${r.label}`).join("\n") || "- (none)")
        .replace(/\{\{recentChat\}\}/g, recentChat || "(nothing yet)");
}

// Plain-text list for /events.
export function describeGroupEvents(list) {
    const events = normalizeGroupEvents(list);
    if (!events.length) return "No group events.";
    return events.map((e) => `- [${e.status}] ${e.title} · ${e.roomLabel} · ${describeWhen(e)}${e.host ? ` · host ${e.host}` : ""}${e.attendees.length ? ` · invited ${e.attendees.join(", ")}` : " · everyone"}${e.playerAttending ? " · you're going" : ""} (${e.source}, id ${e.id})`).join("\n");
}
