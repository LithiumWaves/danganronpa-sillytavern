import {
    availableSecrets,
    buildKnownSecretsPrompt,
    buildMastermindNote,
    buildWorldTruthBlock,
    buildWorldTruthPrompt,
    chapterStartReveals,
    describeWorldTruth,
    findSecretAtSpot,
    isMastermind,
    normalizeWorldTruth,
    parseWorldTruthResponse,
    revealFinalSecrets,
    revealSecret,
    revealWay,
} from "./worldTruth.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

const cast = [{ name: "Junko Enoshima", ultimate: "Fashionista" }, { name: "Kyoko Kirigiri" }, { name: "Makoto Naegi" }];
const rooms = [
    { id: "library", label: "Library", unlockChapter: 2 },
    { id: "gym", label: "Gym" },
    { id: "headmaster", label: "Headmaster's Office", unlockChapter: 5 },
];

const reply = {
    mastermind: "Junko",
    goal: "Spread despair to the whole world.",
    outsideWorld: "The world has already fallen to despair.",
    secrets: [
        { title: "Lost years", text: "Two years of memories are missing.", chapter: 1, source: "flashback", room: "gym" },
        { title: "The shelter", text: "The school was sealed as a shelter.", chapter: 2, source: "exploration", room: "nowhere" },
        { title: "Monokuma's slip", text: "There is a sixteenth student.", chapter: 3, source: "monokuma" },
        { title: "Classmates", text: "Everyone was already friends.", chapter: 9, source: "exploration", room: "headmaster" },
        { title: "The truth", text: "Junko is behind it all.", chapter: 1, source: "final" },
    ],
};

function run() {
    const prompt = buildWorldTruthPrompt({ cast, player: "Makoto Naegi", rooms, lorebook: "Hope's Peak.", finalChapter: 6 });
    assert(prompt.includes("Junko Enoshima (Ultimate Fashionista)") && prompt.includes("library: Library (opens in chapter 2)") && prompt.includes('"mastermind"') && !prompt.includes("{{"), "the draft prompt");
    assert(buildWorldTruthPrompt({ cast, rooms, template: "Just do it." }).includes('"secrets"'), "an edited prompt still gets the format");

    const { worldTruth: wt, error } = parseWorldTruthResponse(JSON.stringify(reply), { cast, player: "Makoto Naegi", rooms, finalChapter: 6, rng: () => 0 });
    assert(!error, error);
    assert(wt.mastermind === "Junko Enoshima", "mastermind matched by first name");
    assert(wt.secrets[1].roomId === "library", "an unknown room goes to a floor that opens that chapter");
    assert(wt.secrets[3].chapter === 6 && wt.secrets[3].roomId === "headmaster", "chapters are clamped to the final one");
    assert(wt.secrets[4].chapter === 6, "final secrets belong to the final chapter");
    assert(parseWorldTruthResponse({ ...reply, mastermind: "Makoto Naegi" }, { cast, player: "Makoto Naegi", rooms }).error, "the player is never the mastermind");
    assert(parseWorldTruthResponse({ ...reply, secrets: reply.secrets.slice(0, 2) }, { cast, rooms }).error, "too few secrets");
    const noFinal = parseWorldTruthResponse({ ...reply, secrets: reply.secrets.slice(0, 4) }, { cast, rooms }).worldTruth;
    assert(noFinal.secrets.at(-1).source === "final", "the last secret becomes final when none was marked");

    // Reveal ways.
    assert(revealWay(wt.secrets[0]) === "flashback" && revealWay(wt.secrets[0], { flashbackLights: false }) === "exploration", "flashbacks are explored for when the lights are off");
    assert(availableSecrets(wt, { chapter: 1 }).length === 1 && availableSecrets(wt, { chapter: 3 }).length === 3, "by chapter");

    // Chapter start.
    let r = chapterStartReveals(wt, { chapter: 3 });
    assert(r.monokuma?.title === "Monokuma's slip" && r.flashback?.title === "Lost years", "Monokuma and a Flashback Light");
    assert(chapterStartReveals(wt, { chapter: 3, flashbackLights: false }).flashback === null, "no Flashback Lights when they're off");
    assert(chapterStartReveals({ ...wt, flashbackPending: "secret1" }, { chapter: 3 }).flashback === null, "one held at a time");

    // Exploration.
    let f = findSecretAtSpot(wt, { roomId: "library", spotLabel: "Bookshelf", spots: ["Bookshelf", "Desk"], chapter: 2, rng: () => 0 });
    assert(f.secret?.title === "The shelter" && f.worldTruth.secrets[1].spotLabel === "Bookshelf", "found at its spot");
    f = findSecretAtSpot(wt, { roomId: "library", spotLabel: "Bookshelf", spots: ["Bookshelf", "Desk"], chapter: 2, rng: () => 0.9 });
    assert(!f.secret && f.worldTruth.secrets[1].spotLabel === "Desk", "elsewhere in the room it isn't");
    assert(!findSecretAtSpot(wt, { roomId: "library", spotLabel: "Bookshelf", spots: ["Bookshelf"], chapter: 1 }).secret, "not before its chapter");
    assert(findSecretAtSpot(wt, { roomId: "gym", spotLabel: "Mat", spots: ["Mat"], chapter: 1, flashbackLights: false }).secret?.title === "Lost years", "a flashback secret explored for");

    // Revealing.
    let known = revealSecret(wt, "secret2", { chapter: 2 });
    assert(known.secrets[1].revealed && known.secrets[1].revealedChapter === 2, "revealed");
    assert(buildKnownSecretsPrompt(known).includes("[WHAT EVERYONE NOW KNOWS]") && buildKnownSecretsPrompt(known).includes("The shelter"), "known secrets prompt");
    assert(buildKnownSecretsPrompt(wt) === "", "nothing known yet");
    assert(revealSecret({ ...wt, flashbackPending: "secret1" }, "secret1").flashbackPending === "", "using the light clears it");
    known = revealFinalSecrets(known, { chapter: 6 });
    assert(known.secrets[4].revealed, "final truths");

    // The mastermind.
    assert(isMastermind(wt, "junko enoshima") && !isMastermind(wt, "Kyoko"), "isMastermind");
    assert(buildMastermindNote(wt, "Junko Enoshima").includes("[SECRET FOR JUNKO ENOSHIMA ONLY]") && buildMastermindNote(wt, "Kyoko") === "", "mastermind note");
    assert(buildMastermindNote({ ...wt, finalTrial: "done" }, "Junko Enoshima") === "", "none after the end");
    assert(buildWorldTruthBlock(wt).includes("The vote's answer is the mastermind"), "trial block");
    assert(describeWorldTruth(wt).includes("Mastermind: Junko Enoshima") && describeWorldTruth(null).includes("/world draft"), "describe");
    assert(normalizeWorldTruth(null) === null && normalizeWorldTruth({ secrets: [{}] }).secrets.length === 0, "normalize");

    console.log("worldTruth tests passed");
}

run();
