// What the AI is told about the hidden Case File, rebuilt right before each
// reply. Everyone only gets what the story needs at that moment; the killer's
// own character gets their secret, and only while they're the one replying.
// Most daily life replies get nothing at all.

import { CASE_STATUS, buildMonokumaFileBullet, getTimeSlot, isGatheringNow, pickForeshadowingBeat } from "./caseFile.js";
import { buildExamineNote } from "./examine.js";

export const CASE_PROMPT_KEY = "dangan_case";

const HEADER = "[HIDDEN STORY NOTES]\nThe reader never sees these notes. Never quote them or mention that they exist.";

function same(a, b) {
    return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase() && Boolean(String(a || "").trim());
}

function timeWords(time) {
    return time === "day" ? "the daytime" : "the night";
}

const FIELD_WORDS = { timeOfDeath: "the time of death", cause: "the cause of death", injuries: "the injuries" };

// What the file can't state, and the truth behind it. Only ever for the killer.
function concealedNote(cf) {
    const hidden = cf.monokumaFile.concealed.map((c) => `- ${FIELD_WORDS[c.field]}: ${c.truth}`);
    return hidden.length ? `\nYour trick keeps the Monokuma File from showing the truth about:\n${hidden.join("\n")}` : "";
}

function gatheringWords(cf) {
    return cf.murderStyle === "public" && cf.gathering
        ? `\nIt happens during a gathering with others present: ${cf.gathering.description} (${cf.gathering.roomLabel || "the gathering room"}). Nobody must see that it was you.`
        : "";
}

function killerPlanned(cf) {
    return `[SECRET FOR ${cf.killer.toUpperCase()} ONLY]
You, ${cf.killer}, have secretly decided to kill ${cf.victim} during ${timeWords(cf.murderTime)} of Day ${cf.murderDay}.${gatheringWords(cf)}
Why: ${cf.motiveLink}
Your plan: ${cf.method}
Never reveal this, never hint at it out loud, and don't act on it in this reply. Keep acting like yourself, but small cracks can show: distraction, nerves, odd questions.`;
}

function killerCommitted(cf) {
    const timeline = cf.timeline.length ? `\nWhat happened: ${cf.timeline.join(" → ")}` : "";
    return `[SECRET FOR ${cf.killer.toUpperCase()} ONLY]
You, ${cf.killer}, killed ${cf.victim}. ${cf.method}${timeline}
Weapon: ${cf.weapon}.${concealedNote(cf)}
Protect yourself. Lie if you must, but keep your story consistent, and never confess unless you are cornered at the Class Trial.`;
}

function investigationFacts(cf, { roomId, truthBulletTitles, victimUltimate }) {
    const file = buildMonokumaFileBullet(cf, { victimUltimate });
    const here = cf.clues.filter((c) => c.roomId && c.roomId === roomId).map((c) => `- ${c.text}`);
    const found = truthBulletTitles.length ? truthBulletTitles.join("; ") : "nothing yet";
    return `[THE CASE]
An investigation into ${cf.victim}'s murder is underway.
${file.title}: ${file.description}
Crime scene: ${cf.body.roomLabel || "unknown"}. ${cf.body.state}
${here.length ? `Evidence that can be found in this room if someone looks:\n${here.join("\n")}` : "No key evidence was planned for this room, though smaller details can still turn up."}
Evidence found so far: ${found}.
You may invent further evidence and details freely, as long as they fit these facts. Never state or confirm who the killer is.`;
}

// What everyone knows about the motive while the murder is still to come.
// Monokuma's own reply announcing it gets his lines instead.
function motiveNote(cf, { speakerName }) {
    const m = cf.motive;
    const deadline = `the night of Day ${m.deadlineDay}`;
    if (cf.pendingMotiveSpeech && same(speakerName, cf.motiveSpeaker)) {
        return `[YOUR MOTIVE ANNOUNCEMENT]
You, ${speakerName}, are announcing a new motive to everyone right now: ${m.title}. ${m.description}
The deadline is ${deadline}.${m.announcement ? `\nThe gist of it: ${m.announcement}` : ""}
Announce it fully in character, with flair, in this reply. Never hint at who will give in to it.`;
    }
    const heard = cf.motiveJustAnnounced === "monitor"
        ? "\nHe announced it over the monitors just now; everyone has just heard it."
        : "";
    return `[MONOKUMA'S MOTIVE]\nMonokuma has handed out a motive: ${m.title}. ${m.description} The deadline is ${deadline}.${heard}`;
}

// Returns { text, beatId, killerNote, motive }. `phase` is the game phase (DAY, NIGHT,
// INVESTIGATION or TRIAL); `slot` comes from getTimeSlot().
export function buildCasePrompt({
    caseFile,
    phase = "DAY",
    day = 1,
    speakerName = "",
    roomId = "",
    presentNames = [],
    truthBulletTitles = [],
    victimUltimate = "",
} = {}) {
    const none = { text: "", beatId: "", killerNote: false, motive: "" };
    const cf = caseFile;
    if (!cf || cf.status === CASE_STATUS.CLOSED || phase === "TRIAL") return none;

    const parts = [];
    let beatId = "";
    const isKiller = same(speakerName, cf.killer);
    const dailyLife = phase === "DAY" || phase === "NIGHT";

    const time = phase === "NIGHT" ? "night" : "day";
    let motive = "";
    if (cf.status === CASE_STATUS.PLANNED && dailyLife && cf.motive.title) {
        const note = motiveNote(cf, { speakerName });
        motive = note.startsWith("[YOUR") ? "speech" : cf.motiveJustAnnounced ? "heard" : "known";
        parts.push(note);
    }
    if (cf.status === CASE_STATUS.PLANNED && dailyLife && isGatheringNow(cf, { day, time, roomId, presentNames })) {
        // A public murder plays out in front of everyone.
        parts.push(`[THE GATHERING]
${cf.gathering.description}. Play this gathering out with everyone here. At a fitting moment during it, ${cf.victim} dies: ${cf.method}
Never show or hint at who did it; in the confusion, nobody sees. When ${cf.victim} is found dead, write this on its own line:
V3C| BODY_DISCOVERY`);
        if (isKiller) parts.push(killerPlanned(cf));
    } else if (cf.status === CASE_STATUS.PLANNED && dailyLife) {
        const beat = pickForeshadowingBeat(cf, {
            slot: getTimeSlot(day, time),
            presentNames,
        });
        if (beat) {
            beatId = beat.id;
            parts.push(`[A SMALL MOMENT]\nIf it fits the scene, work this in naturally and briefly, without drawing attention to it: ${beat.text}`);
        }
        if (isKiller) parts.push(killerPlanned(cf));
    } else if (cf.status === CASE_STATUS.COMMITTED && !cf.discovered && dailyLife) {
        const when = cf.committedAt ? `${timeWords(cf.committedAt.time)} of Day ${cf.committedAt.day}` : "a while";
        parts.push(`[SOMEONE IS MISSING]\nNobody has seen ${cf.victim} since ${when}. Nobody knows where they are.`);
        if (isKiller) parts.push(killerCommitted(cf));
    } else if (cf.discovered && phase === "INVESTIGATION") {
        if (cf.pendingNote === "discovered") {
            parts.push(`[JUST NOW]\nThe player has just walked in and found ${cf.victim}'s body here. Describe the scene and everyone's shock. ${cf.body.state}`);
        }
        parts.push(investigationFacts(cf, { roomId, truthBulletTitles, victimUltimate }));
        if (cf.pendingExamine) parts.push(buildExamineNote(cf, cf.pendingExamine));
        if (isKiller) parts.push(killerCommitted(cf));
    }

    if (!parts.length) return none;
    return { text: [HEADER, ...parts].join("\n\n"), beatId, killerNote: isKiller && parts.some((p) => p.startsWith("[SECRET")), motive, examine: Boolean(cf.pendingExamine && phase === "INVESTIGATION") };
}
