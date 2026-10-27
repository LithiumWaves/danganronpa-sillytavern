// The hidden Case File: what really happens in a chapter's murder. It's
// planned when Monokuma hands out a motive, before anyone dies, so daily life
// can foreshadow it and the investigation has a real answer. The player never
// sees it unless they choose to (a spoiler-gated editor comes later).
//
// Clues listed here are anchors, facts the story must make findable, not the
// full list: Truth Bullets still come from the chat, and new ones found there
// are added as emergent clues.

import { normalizeExamine } from "./examine.js";

export const CASE_STATUS = Object.freeze({
    PLANNED: "planned",     // motive announced, murder not yet happened
    COMMITTED: "committed", // the murder night has passed
    CLOSED: "closed",       // the trial is over
});

// Days the cast has between the motive and the murder, counting the day it's
// announced. The murder happens on the night of the deadline day at the latest.
export const DEFAULT_MOTIVE_DEADLINE_DAYS = 2;
export const MAX_MOTIVE_DEADLINE_DAYS = 4;

const LIMITS = { clues: 8, foreshadowing: 4, witnesses: 6, timeline: 10, text: 600 };

// The Monokuma File fields a killer's trick can hide.
export const FILE_FIELDS = Object.freeze(["timeOfDeath", "cause", "injuries"]);

// Times a foreshadowing moment is offered without making it into a reply
// before it's set aside.
export const MAX_BEAT_ATTEMPTS = 3;

function text(value, max = LIMITS.text) {
    return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function list(value) {
    return Array.isArray(value) ? value : [];
}

function nameKey(name) {
    return text(name).toLowerCase();
}

// Matches a name the model wrote to a cast member: exact, then first name.
function matchCastName(raw, castNames) {
    const key = nameKey(raw);
    if (!key) return "";
    const exact = castNames.find((n) => nameKey(n) === key);
    if (exact) return exact;
    const partial = castNames.filter((n) => nameKey(n).split(" ").includes(key) || key.split(" ").includes(nameKey(n).split(" ")[0]));
    return partial.length === 1 ? partial[0] : "";
}

function roomKey(value) {
    return text(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Matches a room the model wrote to one on the map: its id or name, ignoring
// case, spaces and underscores, then a name contained in the other.
function matchRoom(raw, rooms) {
    const key = roomKey(raw);
    if (!key) return null;
    const exact = rooms.find((r) => roomKey(r.id) === key || roomKey(r.label) === key);
    if (exact) return exact;
    const loose = rooms.filter((r) => {
        const label = roomKey(r.label);
        return label && (key.includes(label) || label.includes(key));
    });
    return loose.length === 1 ? loose[0] : null;
}

export function buildCaseGenerationPrompt({
    cast = [],
    player = "",
    rooms = [],
    day = 1,
    chapterLabel = "",
    deadlineDays = DEFAULT_MOTIVE_DEADLINE_DAYS,
    recentChat = "",
    routines = [],
    rules = "",
} = {}) {
    const castLines = cast
        .map((c) => `- ${c.name}${c.ultimate ? ` (Ultimate ${c.ultimate})` : ""}`)
        .join("\n");
    const roomLines = rooms.map((r) => `- ${r.id}: ${r.label}`).join("\n");
    const lastDay = day + Math.max(0, deadlineDays - 1);

    return `Plan the next murder of a Danganronpa killing game. Nobody has died yet: Monokuma is about to announce a motive, and one student will give in to it.

STORY SO FAR: ${chapterLabel || "Chapter"}, Day ${day}.
THE PLAYER: ${player || "the protagonist"}. The player is never the killer or the victim.

STUDENTS (pick the killer and the victim from these names only):
${castLines || "- (none)"}

ROOMS (copy a room's id exactly, the part before the colon; never invent rooms):
${roomLines || "- (none)"}

${routines.length ? `WHERE PEOPLE USUALLY ARE (base alibis, witnesses and the timeline on these):\n${routines.join("\n")}\n\n` : ""}${rules ? `SCHOOL REGULATIONS (the plan may exploit them, never openly break one Monokuma would punish):\n${rules}\n\n` : ""}RECENT EVENTS:
${recentChat || "(nothing yet)"}

Reply with one compact JSON object and nothing else: start your reply with { and end it with }. Keep every text short (under 30 words). The fields:
{
  "motive": { "title": "short name of the motive", "description": "what Monokuma offers or threatens, 1-2 sentences", "announcement": "Monokuma announcing it, in his voice, 2-4 sentences" },
  "killer": "student name",
  "victim": "student name",
  "body": { "room": "room id where the body is left", "state": "what the scene looks like when the body is found, 1-2 sentences" },
  "clues": [{ "text": "a fact the investigation can find", "room": "room id", "witness": "student name or empty" }],
  "motiveLink": "why the motive pushes the killer to kill, 1-2 sentences",
  "method": "how the murder is done and covered up, 2-3 sentences",
  "weapon": "the weapon",
  "murderDay": ${day} to ${lastDay},
  "murderTime": "day" or "night" (when on that day the murder happens),
  "murderStyle": "hidden" or "public",
  "gathering": { "room": "room id", "description": "the event that brings everyone together" } (only for a public murder, otherwise null),
  "monokumaFile": { "timeOfDeath": "what the file reports", "cause": "what the file reports", "injuries": "other wounds or details, or empty", "concealed": [{ "field": "timeOfDeath, cause or injuries", "truth": "the real fact the file can't state, and why" }] },
  "timeline": ["short events in order, from the killer's preparation to the body being left"],
  "foreshadowing": [{ "text": "a small, innocent-looking moment during the coming days that later turns out to matter", "characters": ["student names involved"] }],
  "witnesses": [{ "name": "student name", "account": "what they saw or heard, and when" }]
}

Rules:
- 5 to ${LIMITS.clues} clues. Each clue sits in a room from the list, or comes from a witness. Together they must make the killer deducible, with at least one red herring.
- 2 to ${LIMITS.foreshadowing} foreshadowing moments that look harmless now.
- Keep the killer in character: the motive has to plausibly break them.
- The monokumaFile is the official autopsy handed to everyone: neutral facts only, nothing that names or points straight at the killer. If the killer's trick hides or fakes something, the file reports only what can be established: "Unknown", a broad range, or what it appears to be (e.g. a body kept cold to hide the time of death gets "Unknown"; a staged suicide reports the apparent cause). Put the hidden truth in "concealed". Usually nothing is concealed.
- Most murders are "hidden": done in secret, the body found later. A "public" murder happens during a gathering with others present, in the dark or in confusion, so nobody sees who did it (like a séance or a blackout at a party); give the gathering, and make one foreshadowing moment someone proposing it. The body room of a public murder is the gathering room.
- Only use the students and rooms listed above.`;
}

// Reads the JSON object out of a model's reply, however it came back:
// wrapped in reasoning (<think>…</think>), prose or code fences, with smart
// quotes or trailing commas, or cut off before the end. A cut-off reply is
// closed at its last complete value; validation decides if enough survived.
// Returns { value, cutOff } or { value: null, reason }.
export function parseLooseJson(raw) {
    let s = String(raw ?? "")
        .replace(/<(think|thinking|reasoning)>[\s\S]*?<\/\1>/gi, "")
        .replace(/<(think|thinking|reasoning)>[\s\S]*$/i, (m) => (m.includes("{") ? m.slice(m.indexOf("{")) : ""))
        .replace(/```(?:json)?/gi, "");
    const start = s.indexOf("{");
    if (start < 0) return { value: null, reason: "no-json" };
    s = s.slice(start).replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");

    // Walk the text once: where the outermost object ends, and the commas
    // (outside strings) a cut-off reply can be trimmed back to.
    const stack = [];
    const cuts = [];
    let inString = false;
    let escaped = false;
    let end = -1;
    for (let i = 0; i < s.length; i += 1) {
        const ch = s[i];
        if (inString) {
            if (escaped) escaped = false;
            else if (ch === "\\") escaped = true;
            else if (ch === '"') inString = false;
            continue;
        }
        if (ch === '"') inString = true;
        else if (ch === "{" || ch === "[") stack.push(ch);
        else if (ch === "}" || ch === "]") {
            stack.pop();
            if (!stack.length) { end = i; break; }
        } else if (ch === ",") cuts.push({ at: i, stack: [...stack] });
    }

    const attempt = (text) => {
        for (const t of [text, text.replace(/,\s*([}\]])/g, "$1")]) {
            try { return JSON.parse(t); } catch { /* next */ }
        }
        return undefined;
    };
    const closers = (open) => open.slice().reverse().map((c) => (c === "{" ? "}" : "]")).join("");

    if (end >= 0) {
        const value = attempt(s.slice(0, end + 1));
        return value !== undefined ? { value, cutOff: false } : { value: null, reason: "invalid" };
    }
    // Cut off: close what's open, or trim back to an earlier complete value.
    const whole = attempt(s + (inString ? '"' : "") + closers(stack));
    if (whole !== undefined) return { value: whole, cutOff: true };
    for (let k = cuts.length - 1; k >= 0 && k >= cuts.length - 60; k -= 1) {
        const value = attempt(s.slice(0, cuts[k].at) + closers(cuts[k].stack));
        if (value !== undefined) return { value, cutOff: true };
    }
    return { value: null, reason: "cut-off" };
}

// The parsed object, or null.
export function extractJsonObject(raw) {
    return parseLooseJson(raw).value;
}

// Validates the model's plan against the actual cast and map. Returns
// { caseFile } or { error } with a reason.
export function parseCaseFileResponse(raw, {
    cast = [],
    player = "",
    rooms = [],
    day = 1,
    chapterIndex = 0,
    deadlineDays = DEFAULT_MOTIVE_DEADLINE_DAYS,
    now = Date.now(),
} = {}) {
    const parsed = typeof raw === "object" && raw !== null ? { value: raw } : parseLooseJson(raw);
    const data = parsed.value;
    if (!data) {
        return {
            error: parsed.reason === "cut-off" ? "The reply was cut off before the plan was complete." : "The reply wasn't a JSON object.",
            reason: parsed.reason,
        };
    }

    const castNames = cast.map((c) => c.name).filter((n) => n && nameKey(n) !== nameKey(player));
    const killer = matchCastName(data.killer, castNames);
    const victim = matchCastName(data.victim, castNames);
    if (!killer) return { error: `The killer "${text(data.killer, 60)}" isn't one of the students.` };
    if (!victim) return { error: `The victim "${text(data.victim, 60)}" isn't one of the students.` };
    if (killer === victim) return { error: "The killer and the victim are the same student." };

    const motive = data.motive || {};
    if (!text(motive.title)) return { error: "The motive has no title." };

    const deadlineDay = day + Math.max(0, Math.min(MAX_MOTIVE_DEADLINE_DAYS, deadlineDays) - 1);
    const murderDay = Math.min(deadlineDay, Math.max(day, Math.round(Number(data.murderDay)) || deadlineDay));

    const bodyRoom = matchRoom(data.body?.room, rooms);
    if (!bodyRoom) return { error: `The body's room "${text(data.body?.room, 60)}" isn't on the map.` };

    // A clue in a room that isn't on the map (and not from a witness) is
    // moved to the crime scene rather than lost.
    const clues = list(data.clues).map((c) => {
        const witness = matchCastName(c?.witness, castNames);
        const room = matchRoom(c?.room, rooms) || (witness ? null : bodyRoom);
        return {
            text: text(c?.text),
            roomId: room?.id || "",
            roomLabel: room?.label || "",
            witness,
        };
    }).filter((c) => c.text && (c.roomId || c.witness)).slice(0, LIMITS.clues);
    if (clues.length < 3) {
        return {
            error: parsed.cutOff
                ? "The reply was cut off before enough clues were written."
                : "The plan has fewer than 3 clues.",
            reason: parsed.cutOff ? "cut-off" : "",
        };
    }
    const isPublic = data.murderStyle === "public";
    const gatheringRoom = isPublic ? (matchRoom(data.gathering?.room, rooms) || bodyRoom) : null;

    const caseFile = normalizeCaseFile({
        status: CASE_STATUS.PLANNED,
        createdAt: now,
        createdDay: day,
        chapterIndex,
        motive: {
            title: motive.title,
            description: motive.description,
            announcement: motive.announcement,
            deadlineDay,
        },
        killer,
        victim,
        motiveLink: data.motiveLink,
        method: data.method,
        weapon: data.weapon,
        murderDay,
        murderTime: data.murderTime,
        murderStyle: isPublic ? "public" : "hidden",
        gathering: gatheringRoom
            ? { roomId: gatheringRoom.id, roomLabel: gatheringRoom.label, description: data.gathering?.description }
            : null,
        body: { roomId: bodyRoom.id, roomLabel: bodyRoom.label, state: data.body?.state },
        monokumaFile: data.monokumaFile,
        timeline: data.timeline,
        clues,
        foreshadowing: list(data.foreshadowing).map((f) => ({
            text: f?.text,
            characters: list(f?.characters).map((n) => matchCastName(n, castNames)).filter(Boolean),
        })),
        witnesses: list(data.witnesses)
            .map((w) => ({ name: matchCastName(w?.name, castNames), account: w?.account }))
            .filter((w) => w.name && w.name !== victim),
    });
    return { caseFile };
}

// Cleans a stored or edited Case File so later code can trust its shape.
export function normalizeCaseFile(raw) {
    if (!raw || typeof raw !== "object") return null;
    const status = Object.values(CASE_STATUS).includes(raw.status) ? raw.status : CASE_STATUS.PLANNED;
    const createdDay = Math.max(1, Number(raw.createdDay) || 1);
    const deadlineDay = Math.max(createdDay, Number(raw.motive?.deadlineDay) || createdDay);
    // Rows keep their ids; new ones (from generation or the editor) get the
    // next free one.
    const taken = new Set([...list(raw.clues), ...list(raw.foreshadowing), ...list(raw.emergentClues)]
        .map((r) => r?.id).filter((v) => typeof v === "string" && v));
    let n = 0;
    const id = (prefix, value) => {
        if (typeof value === "string" && value) return value;
        let next;
        do { next = `${prefix}${++n}`; } while (taken.has(next));
        taken.add(next);
        return next;
    };
    return {
        version: 1,
        status,
        createdAt: Number(raw.createdAt) || 0,
        createdDay,
        chapterIndex: Math.max(0, Number(raw.chapterIndex) || 0),
        motive: {
            title: text(raw.motive?.title, 80),
            description: text(raw.motive?.description),
            announcement: text(raw.motive?.announcement, 900),
            deadlineDay,
        },
        killer: text(raw.killer, 80),
        victim: text(raw.victim, 80),
        motiveLink: text(raw.motiveLink),
        method: text(raw.method, 900),
        weapon: text(raw.weapon, 120),
        murderDay: Math.min(deadlineDay, Math.max(createdDay, Number(raw.murderDay) || deadlineDay)),
        murderTime: raw.murderTime === "day" ? "day" : "night",
        murderStyle: raw.murderStyle === "public" && raw.gathering?.roomId ? "public" : "hidden",
        gathering: raw.murderStyle === "public" && raw.gathering?.roomId
            ? {
                roomId: text(raw.gathering.roomId, 120),
                roomLabel: text(raw.gathering.roomLabel, 120),
                description: text(raw.gathering.description),
            }
            : null,
        // Phase-1 plans had no body room; the first clue's room stands in.
        body: {
            roomId: text(raw.body?.roomId, 120) || firstClueRoom(raw).roomId,
            roomLabel: text(raw.body?.roomLabel, 120) || firstClueRoom(raw).roomLabel,
            state: text(raw.body?.state),
        },
        monokumaFile: {
            timeOfDeath: text(raw.monokumaFile?.timeOfDeath, 120),
            cause: text(raw.monokumaFile?.cause, 300),
            injuries: text(raw.monokumaFile?.injuries, 300),
            concealed: list(raw.monokumaFile?.concealed)
                .map((c) => ({ field: FILE_FIELDS.includes(c?.field) ? c.field : "", truth: text(c?.truth, 300) }))
                .filter((c) => c.field && c.truth),
            revision: Math.max(1, Math.round(Number(raw.monokumaFile?.revision) || 1)),
        },
        committedAt: raw.committedAt && Number(raw.committedAt.day)
            ? { day: Number(raw.committedAt.day), time: raw.committedAt.time === "day" ? "day" : "night" }
            : null,
        discovered: Boolean(raw.discovered),
        lastBeatSlot: text(raw.lastBeatSlot, 40),
        pendingNote: raw.pendingNote === "discovered" ? "discovered" : "",
        // How the motive reaches the cast: Monokuma's own reply announcing it
        // (pendingMotiveSpeech, by motiveSpeaker), or the monitors, which the
        // next reply reacts to once (motiveJustAnnounced).
        pendingMotiveSpeech: Boolean(raw.pendingMotiveSpeech),
        motiveSpeaker: text(raw.motiveSpeaker, 80),
        motiveJustAnnounced: raw.motiveJustAnnounced === "monitor" ? "monitor" : "",
        // Where Monokuma's in-person announcement sits in the chat, so
        // cancelling the motive can remove it; -1 when there is none.
        motiveMessageIndex: Number.isInteger(raw.motiveMessageIndex) ? raw.motiveMessageIndex : -1,
        // Examine mode: each room's spots, and the partner who reacts next to
        // what the player just examined (a one-time note for their reply).
        examine: normalizeExamine(raw.examine),
        pendingReaction: raw.pendingReaction?.speaker
            ? {
                speaker: text(raw.pendingReaction.speaker, 80),
                player: text(raw.pendingReaction.player, 80),
                label: text(raw.pendingReaction.label, 120),
                narration: text(raw.pendingReaction.narration, 600),
                found: text(raw.pendingReaction.found, 200),
            }
            : null,
        timeline: list(raw.timeline).map((t) => text(t, 240)).filter(Boolean).slice(0, LIMITS.timeline),
        clues: list(raw.clues).map((c) => ({
            id: id("clue", c?.id),
            text: text(c?.text),
            roomId: text(c?.roomId, 120),
            roomLabel: text(c?.roomLabel, 120),
            witness: text(c?.witness, 80),
            // Turned up by examining its spot; informational only.
            found: Boolean(c?.found),
        })).filter((c) => c.text),
        foreshadowing: list(raw.foreshadowing).map((f) => ({
            id: id("beat", f?.id),
            text: text(f?.text),
            characters: list(f?.characters).map((name) => text(name, 80)).filter(Boolean),
            used: Boolean(f?.used),
            skipped: Boolean(f?.skipped),
            attempts: Math.max(0, Math.round(Number(f?.attempts) || 0)),
        })).filter((f) => f.text).slice(0, LIMITS.foreshadowing),
        witnesses: list(raw.witnesses).map((w) => ({
            name: text(w?.name, 80),
            account: text(w?.account),
            // Has told the player (their "<Name>'s Account" bullet was found).
            told: Boolean(w?.told),
        })).filter((w) => w.name && w.account).slice(0, LIMITS.witnesses),
        // Monokuma has called the end of the investigation.
        trialCalled: Boolean(raw.trialCalled),
        // How the vote went: "correct", "wrong", or "" before it.
        verdict: raw.verdict === "correct" || raw.verdict === "wrong" ? raw.verdict : "",
        emergentClues: list(raw.emergentClues).map((c) => ({
            id: id("found", c?.id),
            title: text(c?.title, 120),
            text: text(c?.text),
            roomId: text(c?.roomId, 120),
        })).filter((c) => c.title || c.text),
    };
}

function firstClueRoom(raw) {
    const clue = list(raw?.clues).find((c) => c?.roomId);
    return { roomId: text(clue?.roomId, 120), roomLabel: text(clue?.roomLabel, 120) };
}

// A case is in play until its trial ends.
export function isCaseOpen(caseFile) {
    return Boolean(caseFile) && caseFile.status !== CASE_STATUS.CLOSED;
}

// What Monokuma says on screen.
export function getMotiveAnnouncementText(caseFile) {
    const m = caseFile?.motive || {};
    return m.announcement || [m.title, m.description].filter(Boolean).join(": ");
}

// Day N of the chapter that the motive is due on, for the automatic motive.
// 0 means automatic motives are off.
export function shouldAutoAnnounceMotive({ autoDay = 0, day = 1, chapterStartDay = 1, chapterIndex = 0, caseFile = null } = {}) {
    const n = Math.round(Number(autoDay) || 0);
    if (n <= 0 || chapterIndex <= 0 || isCaseOpen(caseFile)) return false;
    return day - Math.max(1, chapterStartDay) + 1 >= n;
}

// The time slot a moment in the story belongs to, e.g. "d3-night".
export function getTimeSlot(day, time) {
    return `d${Math.max(1, Number(day) || 1)}-${time === "night" ? "night" : "day"}`;
}

// Whether leaving the current slot (`from` is "day" when passing time,
// "night" when sleeping) means the murder has happened. A murder planned for
// a slot that was already left (an earlier day, or the daytime of a day that
// was entered at night) happens at the next transition, so it's never skipped.
export function isMurderSlotOver(caseFile, { day = 1, from = "night" } = {}) {
    if (!caseFile || caseFile.status !== CASE_STATUS.PLANNED) return false;
    const murderDay = Number(caseFile.murderDay) || 0;
    if (day > murderDay) return true;
    if (day < murderDay) return false;
    return from === "night" || caseFile.murderTime === "day";
}

// The motive as the player may change it without seeing the plan: its title,
// what it offers and its deadline (never before today). The murder moves with
// the deadline, keeping its distance from it, and never falls after it.
// Only before the murder; returns the case unchanged otherwise.
export function editMotive(caseFile, { title, description, deadlineDay } = {}, { today = 1 } = {}) {
    if (!caseFile || caseFile.status !== CASE_STATUS.PLANNED) return caseFile;
    const oldDeadline = Number(caseFile.motive.deadlineDay) || today;
    const newDeadline = Math.max(today, Math.round(Number(deadlineDay)) || oldDeadline);
    const shifted = (Number(caseFile.murderDay) || oldDeadline) + (newDeadline - oldDeadline);
    return normalizeCaseFile({
        ...caseFile,
        // A deadline before the plan's first day moves that day back too.
        createdDay: Math.min(caseFile.createdDay, newDeadline),
        motive: {
            ...caseFile.motive,
            title: title === undefined ? caseFile.motive.title : String(title).trim() || caseFile.motive.title,
            description: description === undefined ? caseFile.motive.description : String(description).trim(),
            deadlineDay: newDeadline,
        },
        murderDay: Math.min(newDeadline, Math.max(today, shifted)),
    });
}

export function commitMurder(caseFile, { day = 1, time = "night" } = {}) {
    return normalizeCaseFile({
        ...caseFile,
        status: CASE_STATUS.COMMITTED,
        committedAt: { day, time },
        discovered: false,
    });
}

export function markDiscovered(caseFile, { walkedIn = false } = {}) {
    return normalizeCaseFile({
        ...caseFile,
        status: caseFile.status === CASE_STATUS.PLANNED ? CASE_STATUS.COMMITTED : caseFile.status,
        committedAt: caseFile.committedAt || { day: caseFile.murderDay, time: caseFile.murderTime },
        discovered: true,
        pendingNote: walkedIn ? "discovered" : "",
    });
}

// The next foreshadowing beat to work into the scene: unused, with all its
// characters present (or none named), and at most one per time slot.
export function pickForeshadowingBeat(caseFile, { slot = "", presentNames = [] } = {}) {
    if (!caseFile || caseFile.status !== CASE_STATUS.PLANNED) return null;
    if (slot && caseFile.lastBeatSlot === slot) return null;
    const present = new Set(presentNames.map(nameKey));
    return caseFile.foreshadowing.find((beat) => !beat.used && !beat.skipped
        && beat.characters.every((name) => present.has(nameKey(name)))) || null;
}

export function markBeatUsed(caseFile, beatId, slot = "") {
    return normalizeCaseFile({
        ...caseFile,
        foreshadowing: caseFile.foreshadowing.map((beat) => (beat.id === beatId ? { ...beat, used: true } : beat)),
        lastBeatSlot: slot || caseFile.lastBeatSlot,
    });
}

export function getMonokumaFileTitle(caseFile) {
    return `Monokuma File #${Math.max(1, Number(caseFile?.chapterIndex) || 1)}`;
}

// Ends text with exactly one full stop, unless it already ends a sentence.
function sentence(value) {
    const t = String(value || "").trim();
    return /[.!?]$/.test(t) ? t : `${t}.`;
}

// The autopsy as Truth Bullet text: only what Monokuma hands everyone.
export function buildMonokumaFileBullet(caseFile, { victimUltimate = "" } = {}) {
    const mf = caseFile.monokumaFile || {};
    const lines = [
        `The victim is ${caseFile.victim}${victimUltimate ? `, the Ultimate ${victimUltimate}` : ""}.`,
        caseFile.body?.roomLabel ? `The body was found in the ${caseFile.body.roomLabel}.` : "",
        mf.timeOfDeath ? sentence(`The time of death is approximately ${mf.timeOfDeath}`) : "",
        mf.cause ? sentence(`The cause of death is ${mf.cause}`) : "",
        mf.injuries ? sentence(mf.injuries) : "",
    ].filter(Boolean);
    return { title: getMonokumaFileTitle(caseFile), description: lines.join(" ") };
}

// Records Truth Bullets found during the investigation that the plan didn't
// list, so the rest of the case stays consistent with them.
export function addEmergentClue(caseFile, { id = "", title = "", text: body = "", roomId = "" } = {}) {
    if (!caseFile || !caseFile.discovered) return caseFile;
    if (caseFile.emergentClues.some((c) => (id && c.id === id) || (title && c.title === title))) return caseFile;
    return normalizeCaseFile({
        ...caseFile,
        emergentClues: [...caseFile.emergentClues, { id, title, text: body, roomId }],
    });
}

export function removeEmergentClue(caseFile, { id = "", title = "" } = {}) {
    if (!caseFile) return caseFile;
    return normalizeCaseFile({
        ...caseFile,
        emergentClues: caseFile.emergentClues.filter((c) => !((id && c.id === id) || (title && c.title === title))),
    });
}

// Plain-text dump for the /case debug command. Full spoilers.
export function describeCaseFile(caseFile) {
    if (!caseFile) return "No case. Start a motive from the Phase HUD.";
    const cf = caseFile;
    const yes = (b) => (b ? "yes" : "no");
    const lines = [
        `CASE FILE (SPOILERS) — ${cf.status.toUpperCase()}${cf.verdict ? ` · vote ${cf.verdict}` : ""}`,
        `Motive: ${cf.motive.title} — ${cf.motive.description} (deadline: night of Day ${cf.motive.deadlineDay})`,
        `Killer: ${cf.killer} · Victim: ${cf.victim}`,
        `Murder: ${cf.murderStyle}, ${cf.murderTime} of Day ${cf.murderDay}${cf.committedAt ? ` · happened: ${cf.committedAt.time} of Day ${cf.committedAt.day}` : ""}`,
        ...(cf.gathering ? [`Gathering: ${cf.gathering.description} [${cf.gathering.roomLabel || cf.gathering.roomId}]`] : []),
        `Body: ${cf.body.roomLabel || "?"} (${cf.body.roomId || "?"}) · found: ${yes(cf.discovered)}${cf.pendingNote ? " · discovery note pending" : ""}`,
        `Why: ${cf.motiveLink}`,
        `Method: ${cf.method} Weapon: ${cf.weapon}.`,
        `Monokuma File (rev ${cf.monokumaFile.revision}): ${cf.monokumaFile.timeOfDeath || "?"} · ${cf.monokumaFile.cause || "?"}${cf.monokumaFile.injuries ? ` · ${cf.monokumaFile.injuries}` : ""}`,
        ...cf.monokumaFile.concealed.map((c) => `  conceals ${c.field}: ${c.truth}`),
        "Timeline:",
        ...cf.timeline.map((t, i) => `  ${i + 1}. ${t}`),
        "Clues:",
        ...cf.clues.map((c) => `  - ${c.found ? "[found] " : ""}${c.text} [${c.roomLabel || c.roomId || "witness"}${c.witness ? `, ${c.witness}` : ""}]`),
        ...Object.entries(cf.examine).map(([room, r]) => `Examine spots in ${room}: ${r.spots.map((sp) => `${sp.examined ? "✓" : "·"}${sp.label}${sp.clueId ? "*" : ""}`).join(", ")}`),
        `Foreshadowing (last slot: ${cf.lastBeatSlot || "none"}):`,
        ...cf.foreshadowing.map((f) => `  - [${f.used ? "used" : f.skipped ? "set aside" : "unused"}, offered ${f.attempts}x] ${f.text}${f.characters.length ? ` (${f.characters.join(", ")})` : ""}`),
        "Witnesses:",
        ...cf.witnesses.map((w) => `  - ${w.told ? "[told] " : ""}${w.name}: ${w.account}`),
        `Emergent clues (${cf.emergentClues.length}):`,
        ...cf.emergentClues.map((c) => `  - ${c.title}${c.roomId ? ` [${c.roomId}]` : ""}`),
    ];
    return lines.join("\n");
}

// Content words of a moment that a reply including it would likely echo.
const STOP_WORDS = new Set("a an the and or but of to in on at for with from by is are was were be been it its this that these those as into about than then their they them his her he she you your our we i not no so if when while who what where which how".split(" "));

function contentWords(value) {
    return [...new Set(String(value || "").toLowerCase().match(/[a-z0-9']{3,}/g) || [])]
        .filter((w) => !STOP_WORDS.has(w));
}

// Share (0–1) of a moment's content words that appear in a reply. The
// fallback when the hidden check can't run.
export function beatWordOverlap(beatText, replyText) {
    const words = contentWords(beatText);
    if (!words.length) return 0;
    const reply = new Set(contentWords(replyText));
    return words.filter((w) => reply.has(w)).length / words.length;
}

// A moment went out with a reply. `landed` says whether the reply used it.
// Either way the slot counts as spent; a moment that keeps missing is set
// aside after MAX_BEAT_ATTEMPTS.
export function recordBeatAttempt(caseFile, beatId, { landed = false, slot = "" } = {}) {
    if (!caseFile) return caseFile;
    return normalizeCaseFile({
        ...caseFile,
        foreshadowing: caseFile.foreshadowing.map((beat) => {
            if (beat.id !== beatId) return beat;
            const attempts = beat.attempts + 1;
            return { ...beat, attempts, used: beat.used || landed, skipped: !landed && attempts >= MAX_BEAT_ATTEMPTS };
        }),
        lastBeatSlot: landed ? (slot || caseFile.lastBeatSlot) : caseFile.lastBeatSlot,
    });
}

// Whether the gathering of a public murder is happening right now: the
// murder day and time, in the gathering room, with the victim there.
export function isGatheringNow(caseFile, { day = 1, time = "day", roomId = "", presentNames = [] } = {}) {
    if (!caseFile || caseFile.status !== CASE_STATUS.PLANNED || caseFile.murderStyle !== "public") return false;
    if (Number(caseFile.murderDay) !== Number(day) || caseFile.murderTime !== time) return false;
    if (!roomId || roomId !== caseFile.gathering?.roomId) return false;
    return presentNames.some((n) => nameKey(n) === nameKey(caseFile.victim));
}

// The file with a changed field: the next revision.
export function reviseMonokumaFile(caseFile, monokumaFile) {
    const before = caseFile.monokumaFile;
    const changed = FILE_FIELDS.some((f) => (monokumaFile[f] ?? before[f]) !== before[f]);
    return normalizeCaseFile({
        ...caseFile,
        monokumaFile: {
            ...before,
            ...monokumaFile,
            revision: before.revision + (changed && caseFile.discovered ? 1 : 0),
        },
    });
}

export function monokumaFileChanged(before, after) {
    return FILE_FIELDS.some((f) => (before?.monokumaFile?.[f] || "") !== (after?.monokumaFile?.[f] || ""));
}

// Checks a hand-edited case against the real cast and map. Returns an error
// message, or "" when it's fine.
export function validateCaseFile(caseFile, { cast = [], rooms = [], player = "" } = {}) {
    const cf = caseFile;
    if (!cf) return "There's no case.";
    if (!cf.motive.title) return "The motive needs a title.";
    const castNames = cast.map((c) => c.name).filter((n) => n && nameKey(n) !== nameKey(player));
    const inCast = (n) => castNames.some((c) => nameKey(c) === nameKey(n));
    if (!inCast(cf.killer)) return "Pick a killer from the living classmates.";
    if (!inCast(cf.victim)) return "Pick a victim from the living classmates.";
    if (nameKey(cf.killer) === nameKey(cf.victim)) return "The killer and the victim can't be the same student.";
    const roomIds = new Set(rooms.map((r) => r.id));
    if (!roomIds.has(cf.body.roomId)) return "Pick the room the body is found in.";
    if (cf.murderStyle === "public" && !roomIds.has(cf.gathering?.roomId)) return "Pick the gathering's room.";
    const badClue = cf.clues.find((c) => c.roomId && !roomIds.has(c.roomId));
    if (badClue) return `The clue "${badClue.text.slice(0, 40)}" is in a room that isn't on the map.`;
    const badName = [...cf.foreshadowing.flatMap((f) => f.characters), ...cf.witnesses.map((w) => w.name)]
        .find((n) => !inCast(n) && nameKey(n) !== nameKey(cf.victim));
    if (badName) return `"${badName}" isn't one of the living classmates.`;
    return "";
}

// A blank case for writing one by hand.
export function createBlankCaseFile({ day = 1, chapterIndex = 0, deadlineDays = DEFAULT_MOTIVE_DEADLINE_DAYS } = {}) {
    return normalizeCaseFile({
        status: CASE_STATUS.PLANNED,
        createdDay: day,
        chapterIndex,
        motive: { title: "", deadlineDay: day + Math.max(0, deadlineDays - 1) },
        murderDay: day + Math.max(0, deadlineDays - 1),
        murderTime: "night",
    });
}

// The Truth Bullet title a witness's testimony is recorded under.
export function accountTitle(name) {
    return `${String(name || "").trim()}'s Account`;
}

// Everyone with something to tell: listed witnesses and the witnesses named
// on clues, with what they know. The killer is never among them.
export function listWitnessTestimony(caseFile) {
    if (!caseFile) return [];
    const byName = new Map();
    const key = (n) => String(n || "").trim().toLowerCase();
    const add = (name, text, told = false) => {
        if (!name || !text || key(name) === key(caseFile.killer) || key(name) === key(caseFile.victim)) return;
        const entry = byName.get(key(name)) || { name, facts: [], told: false };
        if (!entry.facts.includes(text)) entry.facts.push(text);
        entry.told = entry.told || told;
        byName.set(key(name), entry);
    };
    for (const w of caseFile.witnesses) add(w.name, w.account, w.told);
    for (const c of caseFile.clues) if (c.witness) add(c.witness, c.text, c.found);
    return [...byName.values()];
}

// A witness's account bullet was found: they've told it, and their clues
// are found.
export function markWitnessTold(caseFile, bulletTitle) {
    if (!caseFile) return caseFile;
    const key = (n) => String(n || "").trim().toLowerCase();
    const who = listWitnessTestimony(caseFile).find((w) => key(accountTitle(w.name)) === key(bulletTitle));
    if (!who) return caseFile;
    return normalizeCaseFile({
        ...caseFile,
        witnesses: caseFile.witnesses.map((w) => (key(w.name) === key(who.name) ? { ...w, told: true } : w)),
        clues: caseFile.clues.map((c) => (key(c.witness) === key(who.name) ? { ...c, found: true } : c)),
    });
}
