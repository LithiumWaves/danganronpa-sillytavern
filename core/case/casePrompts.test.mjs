import { CASE_STATUS, commitMurder, markBeatUsed, markDiscovered, normalizeCaseFile } from "./caseFile.js";
import { buildCasePrompt } from "./casePrompts.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

const cf = normalizeCaseFile({
    status: CASE_STATUS.PLANNED,
    createdDay: 2,
    chapterIndex: 1,
    motive: { title: "The Videos", deadlineDay: 3 },
    killer: "Leon Kuwata",
    victim: "Sayaka Maizono",
    motiveLink: "He fears for his family.",
    method: "Ambushes her in the shower room.",
    weapon: "Kitchen knife",
    murderDay: 3,
    murderTime: "night",
    body: { roomId: "kitchen", roomLabel: "Kitchen", state: "Slumped against the counter." },
    monokumaFile: { timeOfDeath: "1:30 a.m.", cause: "a stab wound" },
    timeline: ["Borrows a knife", "Waits in the dark"],
    clues: [
        { text: "A knife is missing", roomId: "kitchen", roomLabel: "Kitchen" },
        { text: "Scuffed floor", roomId: "gym", roomLabel: "Gym" },
    ],
    foreshadowing: [{ text: "Leon asks where the knives are kept", characters: ["Leon Kuwata"] }],
});

function run() {
    // Planned: nothing for a bystander when no beat applies.
    // Planned: everyone knows the motive, and nothing else without a beat.
    const quiet = buildCasePrompt({ caseFile: cf, phase: "DAY", day: 2, speakerName: "Kyoko", presentNames: ["Kyoko"] });
    assert(quiet.text.includes("[MONOKUMA'S MOTIVE]") && quiet.text.includes("The Videos") && quiet.text.includes("night of Day 3"), "motive note");
    assert(!quiet.beatId && !quiet.text.includes("SMALL MOMENT") && !quiet.text.includes("SECRET"), "nothing else by default");
    assert(!quiet.text.includes("just now"), "no 'just now' unless just announced");
    const heard = buildCasePrompt({ caseFile: { ...cf, motiveJustAnnounced: "monitor" }, phase: "DAY", day: 2, speakerName: "Kyoko" });
    assert(heard.text.includes("over the monitors just now") && heard.motive === "heard", "monitor announcement reacted to");
    const speech = { ...cf, pendingMotiveSpeech: true, motiveSpeaker: "Monokuma" };
    const mono = buildCasePrompt({ caseFile: speech, phase: "DAY", day: 2, speakerName: "Monokuma" });
    assert(mono.text.includes("[YOUR MOTIVE ANNOUNCEMENT]") && mono.motive === "speech" && !mono.text.includes("Leon"), "Monokuma announces it");
    assert(!buildCasePrompt({ caseFile: speech, phase: "DAY", day: 2, speakerName: "Kyoko" }).text.includes("YOUR MOTIVE"), "only Monokuma gets the speech");

    // The beat goes out when its characters are present, to whoever speaks.
    const beat = buildCasePrompt({ caseFile: cf, phase: "DAY", day: 2, speakerName: "Kyoko", presentNames: ["Kyoko", "Leon Kuwata"] });
    assert(beat.beatId && beat.text.includes("knives are kept"), "beat sent");
    assert(!beat.text.includes("SECRET"), "no secret for a bystander");
    assert(!beat.text.includes("Sayaka"), "the beat doesn't leak the victim");

    // The killer's secret, only for the killer.
    const killer = buildCasePrompt({ caseFile: cf, phase: "NIGHT", day: 2, speakerName: "leon kuwata", presentNames: [] });
    assert(killer.killerNote && killer.text.includes("kill Sayaka Maizono") && killer.text.includes("the night of Day 3"), "killer plan");
    const used = markBeatUsed(cf, cf.foreshadowing[0].id, "d2-day");
    assert(!buildCasePrompt({ caseFile: used, phase: "DAY", day: 2, speakerName: "Kyoko", presentNames: ["Leon Kuwata"] }).beatId, "used beats aren't repeated");

    // After the murder, before the body is found.
    const committed = commitMurder(cf, { day: 3, time: "night" });
    const missing = buildCasePrompt({ caseFile: committed, phase: "DAY", day: 4, speakerName: "Kyoko" });
    assert(missing.text.includes("Nobody has seen Sayaka Maizono since the night of Day 3"), "victim missing");
    assert(!missing.text.includes("Leon"), "the missing note doesn't name the killer");
    assert(buildCasePrompt({ caseFile: committed, phase: "DAY", day: 4, speakerName: "Leon Kuwata" }).text.includes("You, Leon Kuwata, killed"), "killer remembers");

    // Investigation.
    const found = markDiscovered(committed, { walkedIn: true });
    const inv = buildCasePrompt({ caseFile: found, phase: "INVESTIGATION", day: 4, speakerName: "Kyoko", roomId: "kitchen", truthBulletTitles: ["Monokuma File #1"], victimUltimate: "Pop Sensation" });
    assert(inv.text.includes("JUST NOW"), "the discovery note");
    assert(inv.text.includes("A knife is missing") && !inv.text.includes("Scuffed floor"), "only this room's clues");
    assert(inv.text.includes("Monokuma File #1:") && inv.text.includes("Ultimate Pop Sensation"), "Monokuma File included");
    assert(inv.text.includes("Evidence found so far: Monokuma File #1"), "found evidence listed");
    assert(!inv.text.includes("Leon") && !inv.text.includes("shower room"), "investigation facts don't name the killer or method");
    const invKiller = buildCasePrompt({ caseFile: found, phase: "INVESTIGATION", speakerName: "Leon Kuwata", roomId: "gym" });
    assert(invKiller.text.includes("Borrows a knife → Waits in the dark") && invKiller.text.includes("Scuffed floor"), "killer gets the timeline");
    assert(!buildCasePrompt({ caseFile: markDiscovered(committed), phase: "INVESTIGATION", roomId: "gym" }).text.includes("JUST NOW"), "no note when the roleplay found it");

    // Never during a trial or once closed.
    assert(!buildCasePrompt({ caseFile: found, phase: "TRIAL", speakerName: "Leon Kuwata" }).text, "trial gets nothing");
    assert(!buildCasePrompt({ caseFile: { ...found, status: CASE_STATUS.CLOSED }, phase: "INVESTIGATION" }).text, "closed gets nothing");
    assert(!buildCasePrompt({ caseFile: null }).text, "no case");

    // A public murder plays out at its gathering.
    const pub = normalizeCaseFile({
        ...cf,
        murderStyle: "public",
        gathering: { roomId: "gym", roomLabel: "Gym", description: "A séance in the dark" },
        monokumaFile: { timeOfDeath: "Unknown", cause: "a blow", concealed: [{ field: "timeOfDeath", truth: "9pm, hidden by the dark" }] },
    });
    const at = { caseFile: pub, phase: "NIGHT", day: 3, roomId: "gym", presentNames: ["Sayaka Maizono", "Kyoko"] };
    const gathering = buildCasePrompt({ ...at, speakerName: "Kyoko" });
    assert(gathering.text.includes("[THE GATHERING]") && gathering.text.includes("V3C| BODY_DISCOVERY"), "gathering scene note");
    assert(!gathering.text.includes("Leon"), "the gathering never names the killer");
    assert(!buildCasePrompt({ ...at, day: 2 }).text.includes("GATHERING"), "only on the murder day");
    assert(buildCasePrompt({ ...at, speakerName: "Leon Kuwata" }).text.includes("Nobody must see that it was you"), "killer knows it's public");

    // Concealed truth only ever reaches the killer.
    const pubFound = markDiscovered(commitMurder(pub, { day: 3, time: "night" }));
    const bystander = buildCasePrompt({ caseFile: pubFound, phase: "INVESTIGATION", speakerName: "Kyoko", roomId: "gym" });
    assert(!bystander.text.includes("9pm") && bystander.text.includes("Unknown"), "bystanders get the reported file only");
    assert(buildCasePrompt({ caseFile: pubFound, phase: "INVESTIGATION", speakerName: "Leon Kuwata", roomId: "gym" }).text.includes("9pm, hidden by the dark"), "killer knows what's concealed");

    assert(!buildCasePrompt({ caseFile: committed, phase: "DAY", day: 4, speakerName: "Kyoko" }).text.includes("MONOKUMA'S MOTIVE"), "the motive note ends with the murder");

    console.log("casePrompts tests passed");
}

run();
