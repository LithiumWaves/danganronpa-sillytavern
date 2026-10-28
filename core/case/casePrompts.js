// What the AI is told about the hidden Case File, rebuilt right before each
// reply. Everyone only gets what the story needs at that moment; the killer's
// own character gets their secret, and only while they're the one replying.
// Most daily life replies get nothing at all.

import { BODY_WITNESSES_NEEDED, CASE_STATUS, accountTitle, buildMonokumaFileBullet, getBodySeenBy, getCaseBody, getMotiveItem, getSecondVictim, isAfflicted, isBodyAnnounced, isBodyFound, getTimeSlot, isGatheringNow, listWitnessTestimony, pickForeshadowingBeat, secretRolesOf } from "./caseFile.js";
import { buildPartnerReactionNote } from "./examine.js";

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

const KEEP_HIDDEN = "Never reveal this, never hint at it out loud, and don't act on it in this reply. Keep acting like yourself, but small cracks can show: distraction, nerves, odd questions.";
const PROTECT = "Protect yourself. Lie if you must, but keep your story consistent, and never confess unless you are cornered at the Class Trial.";

function secretHeader(name) {
    return `[SECRET FOR ${String(name).toUpperCase()} ONLY]`;
}

function when(cf) {
    return `${timeWords(cf.murderTime)} of Day ${cf.murderDay}`;
}

// What the killer knows before the murder. A wrong-victim killer aims at
// someone else; an attacked killer plans nothing (the victim attacks them).
function killerPlanned(cf) {
    if (cf.shape === "attacker_victim") return "";
    const second = getSecondVictim(cf);
    const target = cf.shape === "wrong_victim" ? cf.intendedVictim : cf.victim;
    const lines = [
        secretHeader(cf.killer),
        `You, ${cf.killer}, have secretly decided to kill ${target} during ${when(cf)}.${gatheringWords(cf)}`,
        `Why: ${cf.motiveLink}`,
        `Your plan: ${cf.method}`,
    ];
    if (cf.shape === "wrong_victim") lines.push(`Unknown to you, it will go wrong and ${cf.victim} will die instead. Act only on what you know now.`);
    if (cf.shape === "accomplice" && cf.accomplices.length) lines.push(`${cf.accomplices.join(" and ")} will secretly help you.`);
    if (second && same(second.killer, cf.killer)) lines.push(`You will also kill ${second.name}.`);
    lines.push(KEEP_HIDDEN);
    return lines.join("\n");
}

function killerCommitted(cf) {
    const timeline = cf.timeline.length ? `\nWhat happened: ${cf.timeline.join(" → ")}` : "";
    const second = getSecondVictim(cf);
    const how = {
        wrong_victim: `You meant to kill ${cf.intendedVictim}, but it went wrong and ${cf.victim} died instead. `,
        attacker_victim: `${cf.victim} attacked you, meaning to kill you, and died in the struggle. You covered it up. `,
    }[cf.shape] || "";
    const also = second && same(second.killer, cf.killer) ? ` You also killed ${second.name}.` : "";
    const helpers = cf.shape === "accomplice" && cf.accomplices.length ? ` ${cf.accomplices.join(" and ")} helped you.` : "";
    return `${secretHeader(cf.killer)}
${how}You, ${cf.killer}, killed ${cf.victim}.${also}${helpers} ${cf.method}${timeline}
Weapon: ${cf.weapon}.${concealedNote(cf)}${isBodyFound(cf) && !cf.discovered ? killerFoundNote(cf, 0) : ""}
${PROTECT}`;
}

// The secrets of everyone else the twist involves, for `name` only.
function otherSecrets(cf, name, committed) {
    const roles = secretRolesOf(cf, name);
    const notes = [];
    if (roles.includes("suicide") && !committed) {
        notes.push(`${secretHeader(name)}
You, ${name}, have secretly decided to end your own life during ${when(cf)}, and to make it look like something else.${gatheringWords(cf)}
Why: ${cf.motiveLink}
Your plan: ${cf.method}
${KEEP_HIDDEN}`);
    }
    if (roles.includes("attacker") && !committed) {
        notes.push(`${secretHeader(name)}
You, ${name}, have secretly decided to kill ${cf.killer} during ${when(cf)}, to escape.
Why: ${cf.motiveLink}
${KEEP_HIDDEN}`);
    }
    if (roles.includes("accomplice")) {
        notes.push(committed
            ? `${secretHeader(name)}
You, ${name}, helped ${cf.killer} kill ${cf.victim}. ${cf.method}
Only ${cf.killer} is the blackened; you are not. Protect ${cf.killer} and yourself, and never confess unless you are cornered at the Class Trial.`
            : `${secretHeader(name)}
You, ${name}, have secretly agreed to help ${cf.killer} kill ${cf.victim} during ${when(cf)}.
Their plan: ${cf.method}
Only ${cf.killer} will be the blackened. ${KEEP_HIDDEN}`);
    }
    if (roles.includes("decoy")) {
        notes.push(committed
            ? `${secretHeader(name)}
You, ${name}, believe you killed ${cf.victim}: you tried, and you think it worked. You're terrified of being found out. Act on that belief, and never confess unless you are cornered at the Class Trial.`
            : `${secretHeader(name)}
You, ${name}, have secretly decided to kill ${cf.victim} during ${when(cf)}. The motive has gotten to you.
${KEEP_HIDDEN}`);
    }
    if (roles.includes("second_killer")) {
        const second = getSecondVictim(cf);
        notes.push(committed
            ? `${secretHeader(name)}
You, ${name}, killed ${second.name}. ${PROTECT}`
            : `${secretHeader(name)}
You, ${name}, have secretly decided to kill ${second.name} during ${when(cf)}.
${KEEP_HIDDEN}`);
    }
    return notes;
}

// A body has been seen but not announced yet (three-witness rule). For
// whoever is in that room.
function justFoundNote(cf, index) {
    const b = getCaseBody(cf, index);
    const seen = getBodySeenBy(cf, index);
    return `[JUST FOUND]
${b.victim}'s body is here. ${b.body.state}
It was just found${seen.length ? `; so far ${seen.join(", ")} ${seen.length === 1 ? "has" : "have"} seen it` : ""}. Monokuma hasn't announced it yet: the body discovery announcement only plays once ${BODY_WITNESSES_NEEDED} people besides the killer have seen a body. React to the shock; someone may run to get the others, or stay with the body.`;
}

// The killer learns the body was found and who has seen it.
function killerFoundNote(cf, index) {
    const seen = getBodySeenBy(cf, index);
    return `\nThe body has been found. So far ${seen.join(", ") || "nobody"} ${seen.length === 1 ? "has" : "have"} seen it. The announcement plays once ${BODY_WITNESSES_NEEDED} people other than you have seen it; you could use that.`;
}

// Who has already told the player what they saw (never what the others know).
function toldLine(cf) {
    const told = listWitnessTestimony(cf).filter((w) => w.told).map((w) => w.name);
    return told.length ? `\nAlready told the player what they saw: ${told.join(", ")}.` : "";
}

// A witness's private note: what they saw, and how it goes on record.
function witnessNote(cf, speakerName) {
    const me = listWitnessTestimony(cf).find((w) => same(w.name, speakerName));
    if (!me) return "";
    const facts = me.facts.map((f) => `- ${f}`).join("\n");
    return me.told
        ? `[WHAT YOU SAW]\nYou, ${me.name}, already told the player this:\n${facts}\nYou can repeat it or add details if asked, without a new Truth Bullet line.`
        : `[WHAT YOU SAW]\nYou, ${me.name}, saw or heard this around the time of the murder:\n${facts}\nShare it when the player asks about it, or when it's naturally relevant. You don't have to say everything at once, and you don't know what it proves.\nThe first time you tell it, put this on its own line: V3C| TB: ${accountTitle(me.name)} || One-sentence summary of what you told`;
}

function investigationFacts(cf, { roomId, truthBulletTitles, victimUltimate }) {
    const file = buildMonokumaFileBullet(cf, { victimUltimate });
    const here = cf.clues.filter((c) => c.roomId && c.roomId === roomId).map((c) => `- ${c.text}`);
    const found = truthBulletTitles.length ? truthBulletTitles.join("; ") : "nothing yet";
    return `[THE CASE]
An investigation into ${getSecondVictim(cf)?.discovered ? `the deaths of ${cf.victim} and ${getSecondVictim(cf).name}` : `${cf.victim}'s death`} is underway.
${file.title}: ${file.description}
Crime scene: ${cf.body.roomLabel || "unknown"}. ${cf.body.state}
${here.length ? `Evidence that can be found in this room if someone looks:\n${here.join("\n")}` : "No key evidence was planned for this room, though smaller details can still turn up."}
Evidence found so far: ${found}.${toldLine(cf)}
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

// What an object or condition motive means for the one replying: their own
// item's contents (nobody else's), or the affliction.
function motiveKindNotes(cf, speakerName) {
    const m = cf.motive;
    const out = [];
    if (m.kind === "object") {
        const item = getMotiveItem(cf, speakerName);
        const owners = Object.keys(m.items).filter((n) => !same(n, speakerName));
        if (item) out.push(`[YOUR MOTIVE ITEM — ${String(speakerName).toUpperCase()} ONLY]\nMonokuma gave you, ${speakerName}, your own ${item.title}. What it shows: ${item.contents}\nIt is personal. Share it only if you'd really choose to.`);
        if (owners.length) out.push(`Everyone got their own item from Monokuma (${owners.join(", ")}). Nobody knows what's in anyone else's unless they're told.`);
    } else if (m.kind === "condition" && m.afflicted.length) {
        if (isAfflicted(cf, speakerName)) out.push(`[AFFLICTED]\nYou, ${speakerName}, are afflicted by Monokuma's motive: ${m.effect} Play it out until it lifts.`);
        const others = m.afflicted.filter((n) => !same(n, speakerName));
        if (others.length) out.push(`[THE AFFLICTED]\n${others.join(", ")} ${others.length === 1 ? "is" : "are"} afflicted by Monokuma's motive: ${m.effect}`);
    }
    return out;
}

function foiledNote(cf) {
    return `${secretHeader(cf.killer)}\nYour last attempt failed: someone was there, and you couldn't go through with it. ${cf.murderDay ? `You'll try again during ${when(cf)}.` : ""} Nobody must suspect what you nearly did.`;
}

// Monokuma's penalty, once, after the deadline passed with no murder. Both
// are editable in EDIT AI INSTRUCTIONS ({{title}}, {{penalty}}).
export const DEFAULT_PENALTY_NOTE_TEMPLATE = `[MONOKUMA'S PENALTY]
Nobody killed before the deadline of "{{title}}", so Monokuma has carried out his penalty: {{penalty}}
React to it now. The motive is over.`;
export const DEFAULT_RELENT_NOTE_TEMPLATE = `[MONOKUMA RELENTS]
Nobody killed before the deadline of "{{title}}". Monokuma grumbled and called off his time limit, for now. Everyone is shaken but alive; a new motive will come.`;

function penaltyNote(cf, { penaltyTemplate = "", relentTemplate = "" } = {}) {
    const m = cf.motive;
    const template = cf.relented ? (relentTemplate || DEFAULT_RELENT_NOTE_TEMPLATE) : (penaltyTemplate || DEFAULT_PENALTY_NOTE_TEMPLATE);
    return template
        .replace(/\{\{title\}\}/g, m.title || "the motive")
        .replace(/\{\{penalty\}\}/g, m.penalty || "a punishment for everyone's lack of despair.");
}

// Returns { text, beatId, killerNote, motive, penalty, foiled }. `phase` is the game phase (DAY, NIGHT,
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
    penaltyTemplate = "",
    relentTemplate = "",
} = {}) {
    const none = { text: "", beatId: "", killerNote: false, motive: "" };
    const cf = caseFile;
    if (!cf || cf.status === CASE_STATUS.CLOSED || phase === "TRIAL") return none;
    if (cf.status === CASE_STATUS.AVERTED) {
        return cf.penaltyNote && (phase === "DAY" || phase === "NIGHT")
            ? { ...none, text: [HEADER, penaltyNote(cf, { penaltyTemplate, relentTemplate })].join("\n\n"), penalty: true }
            : none;
    }

    const parts = [];
    let beatId = "";
    // A suicide's victim gets their own note, not the killer's.
    const isKiller = same(speakerName, cf.killer) && cf.shape !== "suicide";
    const dailyLife = phase === "DAY" || phase === "NIGHT";

    const time = phase === "NIGHT" ? "night" : "day";
    let motive = "";
    if (cf.status === CASE_STATUS.PLANNED && dailyLife && cf.motive.title) {
        const note = motiveNote(cf, { speakerName });
        motive = note.startsWith("[YOUR") ? "speech" : cf.motiveJustAnnounced ? "heard" : "known";
        parts.push(note);
        parts.push(...motiveKindNotes(cf, speakerName));
    }
    const foiled = cf.status === CASE_STATUS.PLANNED && dailyLife && isKiller && cf.foiledNote;
    if (foiled) parts.push(foiledNote(cf));
    if (cf.status === CASE_STATUS.PLANNED && dailyLife && isGatheringNow(cf, { day, time, roomId, presentNames })) {
        // A public murder plays out in front of everyone.
        parts.push(`[THE GATHERING]
${cf.gathering.description}. Play this gathering out with everyone here. At a fitting moment during it, ${cf.victim} dies: ${cf.method}
Never show or hint at who did it; in the confusion, nobody sees. When ${cf.victim} is found dead, write this on its own line:
V3C| BODY_DISCOVERY`);
        if (isKiller) parts.push(killerPlanned(cf));
        parts.push(...otherSecrets(cf, speakerName, false));
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
        parts.push(...otherSecrets(cf, speakerName, false));
    } else if (cf.status === CASE_STATUS.COMMITTED && !cf.discovered && dailyLife) {
        const since = cf.committedAt ? `${timeWords(cf.committedAt.time)} of Day ${cf.committedAt.day}` : "a while";
        const second = getSecondVictim(cf);
        const missing = second ? `${cf.victim} or ${second.name}` : cf.victim;
        if (isBodyFound(cf) && roomId && roomId === cf.body.roomId) parts.push(justFoundNote(cf, 0));
        else parts.push(`[SOMEONE IS MISSING]\nNobody has seen ${missing} since ${since}. Nobody knows where they are.`);
        if (isKiller) parts.push(killerCommitted(cf));
        parts.push(...otherSecrets(cf, speakerName, true));
    } else if (cf.discovered && phase === "INVESTIGATION") {
        if (cf.pendingNote === "discovered") {
            parts.push(`[JUST NOW]\nThe player has just walked in and found ${cf.victim}'s body here. Describe the scene and everyone's shock. ${cf.body.state}`);
        }
        parts.push(investigationFacts(cf, { roomId, truthBulletTitles, victimUltimate }));
        const second = getSecondVictim(cf);
        if (second && isBodyFound(cf, 1) && !isBodyAnnounced(cf, 1) && roomId && roomId === second.body.roomId) parts.push(justFoundNote(cf, 1));
        if (cf.pendingReaction && same(speakerName, cf.pendingReaction.speaker)) parts.push(buildPartnerReactionNote(cf.pendingReaction));
        if (!isKiller) {
            const note = witnessNote(cf, speakerName);
            if (note) parts.push(note);
        }
        if (isKiller) parts.push(killerCommitted(cf));
        parts.push(...otherSecrets(cf, speakerName, true));
    }

    if (!parts.length) return none;
    const filled = parts.filter(Boolean);
    if (!filled.length) return none;
    return { text: [HEADER, ...filled].join("\n\n"), beatId, killerNote: filled.some((p) => p.startsWith("[SECRET")), motive, foiled, reaction: filled.some((p) => p.startsWith("[INVESTIGATING TOGETHER]")) };
}
