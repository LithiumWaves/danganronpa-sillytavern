// What the AI is told about the hidden Case File, rebuilt right before each
// reply. Everyone only gets what the story needs at that moment; the killer's
// own character gets their secret, and only while they're the one replying.
// Most daily life replies get nothing at all.

import { CASE_STATUS, buildMonokumaFileBullet, getTimeSlot, pickForeshadowingBeat } from "./caseFile.js";

export const CASE_PROMPT_KEY = "dangan_case";

const HEADER = "[HIDDEN STORY NOTES]\nThe reader never sees these notes. Never quote them or mention that they exist.";

function same(a, b) {
    return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase() && Boolean(String(a || "").trim());
}

function timeWords(time) {
    return time === "day" ? "the daytime" : "the night";
}

function killerPlanned(cf) {
    return `[SECRET FOR ${cf.killer.toUpperCase()} ONLY]
You, ${cf.killer}, have secretly decided to kill ${cf.victim} during ${timeWords(cf.murderTime)} of Day ${cf.murderDay}.
Why: ${cf.motiveLink}
Your plan: ${cf.method}
Never reveal this, never hint at it out loud, and don't act on it in this reply. Keep acting like yourself, but small cracks can show: distraction, nerves, odd questions.`;
}

function killerCommitted(cf) {
    const timeline = cf.timeline.length ? `\nWhat happened: ${cf.timeline.join(" → ")}` : "";
    return `[SECRET FOR ${cf.killer.toUpperCase()} ONLY]
You, ${cf.killer}, killed ${cf.victim}. ${cf.method}${timeline}
Weapon: ${cf.weapon}.
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

// Returns { text, beatId, killerNote }. `phase` is the game phase (DAY, NIGHT,
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
    const none = { text: "", beatId: "", killerNote: false };
    const cf = caseFile;
    if (!cf || cf.status === CASE_STATUS.CLOSED || phase === "TRIAL") return none;

    const parts = [];
    let beatId = "";
    const isKiller = same(speakerName, cf.killer);
    const dailyLife = phase === "DAY" || phase === "NIGHT";

    if (cf.status === CASE_STATUS.PLANNED && dailyLife) {
        const beat = pickForeshadowingBeat(cf, {
            slot: getTimeSlot(day, phase === "NIGHT" ? "night" : "day"),
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
        if (isKiller) parts.push(killerCommitted(cf));
    }

    if (!parts.length) return none;
    return { text: [HEADER, ...parts].join("\n\n"), beatId, killerNote: isKiller };
}
