import { CASE_STATUS, commitMurder, markDiscovered, normalizeCaseFile } from "./caseFile.js";
import { buildTrialTruthBlock, getCaseBlackened } from "./trialTruth.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

const planned = normalizeCaseFile({
    status: CASE_STATUS.PLANNED,
    createdDay: 2,
    chapterIndex: 1,
    motive: { title: "Videos", deadlineDay: 3 },
    killer: "Leon Kuwata",
    victim: "Sayaka Maizono",
    weapon: "Kitchen knife",
    method: "Stabbed her in the shower room.",
    murderDay: 3,
    timeline: ["Borrows a knife", "Waits"],
    body: { roomId: "shower", roomLabel: "Shower Room", state: "x" },
    monokumaFile: { timeOfDeath: "Unknown", cause: "Stab wound", concealed: [{ field: "timeOfDeath", truth: "1:30 a.m., hidden by the hot water" }] },
    clues: [{ id: "clue1", text: "A knife is missing", roomId: "kitchen", found: true }, { id: "clue2", text: "Torn shirt button", roomId: "shower" }],
    witnesses: [{ name: "Kyoko Kirigiri", account: "Heard a thud.", told: true }],
    emergentClues: [{ id: "tb1", title: "Wet Floor", text: "Water everywhere" }],
});
const found = markDiscovered(commitMurder(planned, { day: 3 }));

function run() {
    assert(buildTrialTruthBlock(null) === "" && buildTrialTruthBlock(planned) === "", "nothing before the body is found");
    assert(buildTrialTruthBlock({ ...found, status: CASE_STATUS.CLOSED }) === "", "nothing once closed");

    const block = buildTrialTruthBlock(found, { purpose: "hangman" });
    assert(block.includes("Killer: Leon Kuwata") && block.includes("Kitchen knife") && block.includes("Borrows a knife → Waits"), "the truth");
    assert(block.includes("1:30 a.m.") && block.includes("A knife is missing (found)") && block.includes("Torn shirt button") && !block.includes("Torn shirt button (found)"), "concealed truths and evidence");
    assert(block.includes("Wet Floor") && block.includes("Kyoko Kirigiri (Heard a thud.)"), "found evidence and testimony");
    assert(block.includes("Never the blackened's"), "hangman rule");
    assert(buildTrialTruthBlock(found, { purpose: "questionTime" }).includes("distractors must be false"), "question time rule");
    assert(buildTrialTruthBlock(found, { purpose: "mindMine" }).includes("must be TRUE"), "mind mine rule");

    assert(buildTrialTruthBlock(found, { purpose: "argumentArmament", opponent: "leon kuwata" }).includes("IS the blackened"), "AA against the killer");
    assert(buildTrialTruthBlock(found, { purpose: "argumentArmament", opponent: "Kyoko Kirigiri" }).includes("is NOT the killer"), "AA against someone else");

    assert(getCaseBlackened(found) === "Leon Kuwata" && getCaseBlackened(planned) === "", "the vote's answer");

    // Twists.
    const suicide = { ...found, shape: "suicide", killer: "Sayaka Maizono" };
    assert(getCaseBlackened(suicide) === "Sayaka Maizono" && buildTrialTruthBlock(suicide).includes("Case shape: Suicide"), "a suicide's blackened is the victim");
    const decoy = { ...found, shape: "decoy", decoy: "Mondo Owada" };
    assert(buildTrialTruthBlock(decoy, { purpose: "argumentArmament", opponent: "Mondo Owada" }).includes("believes they did it, but is NOT the blackened"), "AA against the decoy");
    const helped = { ...found, shape: "accomplice", accomplices: ["Peko Pekoyama"] };
    assert(buildTrialTruthBlock(helped, { purpose: "argumentArmament", opponent: "Peko Pekoyama" }).includes("helped, but is NOT the blackened") && buildTrialTruthBlock(helped).includes("Accomplices (not the blackened): Peko Pekoyama"), "AA against an accomplice");
    const double = { ...found, shape: "double", secondVictim: { name: "Hifumi Yamada", killer: "Leon Kuwata", body: { roomLabel: "Art Room" }, monokumaFile: {} } };
    assert(buildTrialTruthBlock(double).includes("Second victim: Hifumi Yamada"), "the second body");

    console.log("trialTruth tests passed");
}

run();
