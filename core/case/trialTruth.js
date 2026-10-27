// What the trial minigames with a right answer are told about the case, so
// the answer matches what really happened: Hangman's Gambit, Question Time,
// Question Truth, Mind Mine and Argument Armament. Non-Stop Debate and its
// variants are left alone on purpose: the player is allowed to steer a debate
// the wrong way.

import { CASE_STATUS, listWitnessTestimony } from "./caseFile.js";

const FIELD_WORDS = { timeOfDeath: "time of death", cause: "cause of death", injuries: "injuries" };

const PURPOSE_RULES = {
    hangman: "Make the ANSWER a key word of this truth that the players can work out from the evidence (the weapon, a place, an object, how it was done). Never the killer's name, and never something nobody could know yet.",
    questionTime: "The correct answer must be true according to this; the three distractors must be false according to it. Ask about something the evidence found so far can settle.",
    questionTruth: "Prefer a Truth Bullet that matters to how the murder really happened.",
    mindMine: "All three statements must be TRUE according to this and lead toward how it really happened, without naming the killer.",
};

function same(a, b) {
    return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}

// Returns "" when there's no case with a found body (nothing to be true to).
// `opponent` is Argument Armament's accused.
export function buildTrialTruthBlock(caseFile, { purpose = "", opponent = "" } = {}) {
    const cf = caseFile;
    if (!cf || !cf.discovered || cf.status === CASE_STATUS.CLOSED) return "";
    const lines = [
        "CASE TRUTH (hidden from the players: use it so the round is accurate, never reveal it outright)",
        `Victim: ${cf.victim}. Killer: ${cf.killer}.`,
        cf.weapon ? `Weapon: ${cf.weapon}.` : "",
        cf.method ? `How: ${cf.method}` : "",
        cf.timeline.length ? `Timeline: ${cf.timeline.join(" → ")}` : "",
        ...cf.monokumaFile.concealed.map((c) => `The Monokuma File hides the real ${FIELD_WORDS[c.field] || c.field}: ${c.truth}`),
    ];
    const evidence = [
        ...cf.clues.map((c) => `- ${c.text}${c.found ? " (found)" : ""}`),
        ...cf.emergentClues.map((c) => `- ${c.title}${c.text ? `: ${c.text}` : ""} (found)`),
    ];
    if (evidence.length) lines.push("Evidence:", ...evidence);
    const told = listWitnessTestimony(cf).filter((w) => w.told);
    if (told.length) lines.push(`Testimony given: ${told.map((w) => `${w.name} (${w.facts.join("; ")})`).join(" / ")}`);

    if (purpose === "argumentArmament" && opponent) {
        lines.push(same(opponent, cf.killer)
            ? `${opponent} IS the killer. Their statements are their lies and excuses; the four cardinal sentences and the quote expose what they really did, following this truth.`
            : `${opponent} is NOT the killer. Build the final argument only from what the evidence really shows about ${opponent}, without contradicting this truth.`);
    } else if (PURPOSE_RULES[purpose]) {
        lines.push(PURPOSE_RULES[purpose]);
    }
    return lines.filter(Boolean).join("\n");
}

// Who really did it, for the vote; "" when there's no found case.
export function getCaseBlackened(caseFile) {
    return caseFile?.discovered && caseFile.status !== CASE_STATUS.CLOSED ? caseFile.killer : "";
}
