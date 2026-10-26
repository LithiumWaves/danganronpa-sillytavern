// The hidden Case File: what really happens in a chapter's murder. It's
// planned when Monokuma hands out a motive, before anyone dies, so daily life
// can foreshadow it and the investigation has a real answer. The player never
// sees it unless they choose to (a spoiler-gated editor comes later).
//
// Clues listed here are anchors, facts the story must make findable, not the
// full list: Truth Bullets still come from the chat, and new ones found there
// are added as emergent clues.

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

function matchRoom(raw, rooms) {
    const key = nameKey(raw);
    if (!key) return null;
    return rooms.find((r) => nameKey(r.id) === key)
        || rooms.find((r) => nameKey(r.label) === key)
        || null;
}

export function buildCaseGenerationPrompt({
    cast = [],
    player = "",
    rooms = [],
    day = 1,
    chapterLabel = "",
    deadlineDays = DEFAULT_MOTIVE_DEADLINE_DAYS,
    recentChat = "",
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

ROOMS (use these ids for clue locations):
${roomLines || "- (none)"}

RECENT EVENTS:
${recentChat || "(nothing yet)"}

Write one JSON object and nothing else, with these fields:
{
  "motive": { "title": "short name of the motive", "description": "what Monokuma offers or threatens, 1-2 sentences", "announcement": "Monokuma announcing it, in his voice, 2-4 sentences" },
  "killer": "student name",
  "victim": "student name",
  "motiveLink": "why the motive pushes the killer to kill, 1-2 sentences",
  "method": "how the murder is done and covered up, 2-3 sentences",
  "weapon": "the weapon",
  "murderDay": ${day} to ${lastDay},
  "murderTime": "day" or "night" (when on that day the murder happens),
  "body": { "room": "room id where the body is left", "state": "what the scene looks like when the body is found, 1-2 sentences" },
  "monokumaFile": { "timeOfDeath": "approximate time", "cause": "cause of death", "injuries": "other wounds or details, or empty" },
  "timeline": ["short events in order, from the killer's preparation to the body being left"],
  "clues": [{ "text": "a fact the investigation can find", "room": "room id", "witness": "student name or empty" }],
  "foreshadowing": [{ "text": "a small, innocent-looking moment during the coming days that later turns out to matter", "characters": ["student names involved"] }],
  "witnesses": [{ "name": "student name", "account": "what they saw or heard, and when" }]
}

Rules:
- 5 to ${LIMITS.clues} clues. Each clue sits in a room from the list, or comes from a witness. Together they must make the killer deducible, with at least one red herring.
- 2 to ${LIMITS.foreshadowing} foreshadowing moments that look harmless now.
- Keep the killer in character: the motive has to plausibly break them.
- The monokumaFile is the official autopsy handed to everyone: neutral facts only, nothing that names or points straight at the killer.
- Only use the students and rooms listed above.`;
}

// Pulls the JSON object out of a reply that may wrap it in prose or fences.
export function extractJsonObject(raw) {
    const s = String(raw ?? "");
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
        return JSON.parse(s.slice(start, end + 1));
    } catch {
        return null;
    }
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
    const data = typeof raw === "object" && raw !== null ? raw : extractJsonObject(raw);
    if (!data) return { error: "The reply wasn't a JSON object." };

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

    const clues = list(data.clues).map((c) => {
        const room = matchRoom(c?.room, rooms);
        return {
            text: text(c?.text),
            roomId: room?.id || "",
            roomLabel: room?.label || "",
            witness: matchCastName(c?.witness, castNames),
        };
    }).filter((c) => c.text && (c.roomId || c.witness)).slice(0, LIMITS.clues);
    if (clues.length < 3) return { error: "The plan has too few clues placed in real rooms." };

    const bodyRoom = matchRoom(data.body?.room, rooms);
    if (!bodyRoom) return { error: `The body's room "${text(data.body?.room, 60)}" isn't on the map.` };

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
    let n = 0;
    const id = (prefix, value) => (typeof value === "string" && value ? value : `${prefix}${++n}`);
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
        },
        committedAt: raw.committedAt && Number(raw.committedAt.day)
            ? { day: Number(raw.committedAt.day), time: raw.committedAt.time === "day" ? "day" : "night" }
            : null,
        discovered: Boolean(raw.discovered),
        lastBeatSlot: text(raw.lastBeatSlot, 40),
        pendingNote: raw.pendingNote === "discovered" ? "discovered" : "",
        timeline: list(raw.timeline).map((t) => text(t, 240)).filter(Boolean).slice(0, LIMITS.timeline),
        clues: list(raw.clues).map((c) => ({
            id: id("clue", c?.id),
            text: text(c?.text),
            roomId: text(c?.roomId, 120),
            roomLabel: text(c?.roomLabel, 120),
            witness: text(c?.witness, 80),
        })).filter((c) => c.text),
        foreshadowing: list(raw.foreshadowing).map((f) => ({
            id: id("beat", f?.id),
            text: text(f?.text),
            characters: list(f?.characters).map((name) => text(name, 80)).filter(Boolean),
            used: Boolean(f?.used),
        })).filter((f) => f.text).slice(0, LIMITS.foreshadowing),
        witnesses: list(raw.witnesses).map((w) => ({
            name: text(w?.name, 80),
            account: text(w?.account),
        })).filter((w) => w.name && w.account).slice(0, LIMITS.witnesses),
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

// The one message added to the chat so the cast knows about the motive. It
// says nothing about the plan.
export function buildMotiveChatNote(caseFile) {
    const m = caseFile?.motive || {};
    const deadline = m.deadlineDay > caseFile.createdDay
        ? ` Monokuma gives everyone until the night of Day ${m.deadlineDay}.`
        : " Monokuma gives everyone until tonight.";
    const said = m.announcement ? ` "${m.announcement}"` : "";
    return `[Monokuma's Motive: ${m.title}] ${m.description}${deadline}${said}`.replace(/\s+/g, " ").trim();
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
    return caseFile.foreshadowing.find((beat) => !beat.used
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
        `CASE FILE (SPOILERS) — ${cf.status.toUpperCase()}`,
        `Motive: ${cf.motive.title} — ${cf.motive.description} (deadline: night of Day ${cf.motive.deadlineDay})`,
        `Killer: ${cf.killer} · Victim: ${cf.victim}`,
        `Murder: ${cf.murderTime} of Day ${cf.murderDay}${cf.committedAt ? ` · happened: ${cf.committedAt.time} of Day ${cf.committedAt.day}` : ""}`,
        `Body: ${cf.body.roomLabel || "?"} (${cf.body.roomId || "?"}) · found: ${yes(cf.discovered)}${cf.pendingNote ? " · discovery note pending" : ""}`,
        `Why: ${cf.motiveLink}`,
        `Method: ${cf.method} Weapon: ${cf.weapon}.`,
        `Monokuma File: ${cf.monokumaFile.timeOfDeath || "?"} · ${cf.monokumaFile.cause || "?"}${cf.monokumaFile.injuries ? ` · ${cf.monokumaFile.injuries}` : ""}`,
        "Timeline:",
        ...cf.timeline.map((t, i) => `  ${i + 1}. ${t}`),
        "Clues:",
        ...cf.clues.map((c) => `  - ${c.text} [${c.roomLabel || c.roomId || "witness"}${c.witness ? `, ${c.witness}` : ""}]`),
        `Foreshadowing (last slot: ${cf.lastBeatSlot || "none"}):`,
        ...cf.foreshadowing.map((f) => `  - [${f.used ? "used" : "unused"}] ${f.text}${f.characters.length ? ` (${f.characters.join(", ")})` : ""}`),
        "Witnesses:",
        ...cf.witnesses.map((w) => `  - ${w.name}: ${w.account}`),
        `Emergent clues (${cf.emergentClues.length}):`,
        ...cf.emergentClues.map((c) => `  - ${c.title}${c.roomId ? ` [${c.roomId}]` : ""}`),
    ];
    return lines.join("\n");
}
