import {
    CASE_STATUS,
    addEmergentClue,
    buildMonokumaFileBullet,
    commitMurder,
    getTimeSlot,
    isMurderSlotOver,
    markBeatUsed,
    markDiscovered,
    pickForeshadowingBeat,
    removeEmergentClue,
    buildCaseGenerationPrompt,
    buildMotiveChatNote,
    describeCaseFile,
    extractJsonObject,
    getMotiveAnnouncementText,
    isCaseOpen,
    normalizeCaseFile,
    parseCaseFileResponse,
    shouldAutoAnnounceMotive,
} from "./caseFile.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

const cast = [
    { name: "Kyoko Kirigiri", ultimate: "Detective" },
    { name: "Leon Kuwata", ultimate: "Baseball Star" },
    { name: "Sayaka Maizono", ultimate: "Pop Sensation" },
    { name: "Makoto Naegi", ultimate: "Lucky Student" },
];
const rooms = [
    { id: "hpa_kitchen", label: "Kitchen" },
    { id: "hpa_gym", label: "Gym" },
    { id: "hpa_dorm_hall", label: "Dorm Hallway" },
];

function plan(overrides = {}) {
    return {
        motive: { title: "The Videos", description: "Videos of loved ones.", announcement: "Puhuhu! Watch these!" },
        killer: "Leon",
        victim: "Sayaka Maizono",
        motiveLink: "He fears for his family.",
        method: "Stabbed in the shower room.",
        weapon: "Kitchen knife",
        murderDay: 3,
        murderTime: "night",
        body: { room: "Kitchen", state: "Slumped against the counter." },
        monokumaFile: { timeOfDeath: "1:30 a.m.", cause: "a stab wound to the stomach.", injuries: "A bruise on the wrist" },
        timeline: ["Sayaka swaps rooms", "Leon is ambushed"],
        clues: [
            { text: "A knife is missing", room: "hpa_kitchen" },
            { text: "Scuffed floor", room: "Gym" },
            { text: "Heard a scream", room: "", witness: "Kyoko" },
            { text: "Not a real room", room: "moon" },
        ],
        foreshadowing: [{ text: "Sayaka asks about the knives", characters: ["Sayaka", "Nobody"] }],
        witnesses: [{ name: "Kyoko Kirigiri", account: "Saw Leon at 1am." }, { name: "Sayaka", account: "victim" }],
        ...overrides,
    };
}

function run() {
    const opts = { cast, player: "Makoto Naegi", rooms, day: 2, chapterIndex: 1, deadlineDays: 2, now: 5 };

    // Prompt lists the cast and rooms and the allowed murder days.
    const prompt = buildCaseGenerationPrompt({ cast, player: "Makoto Naegi", rooms, day: 2, deadlineDays: 2 });
    assert(prompt.includes("Leon Kuwata (Ultimate Baseball Star)"), "prompt lists cast");
    assert(prompt.includes("hpa_gym: Gym"), "prompt lists rooms");
    assert(prompt.includes("2 to 3"), "prompt bounds the murder day");

    assert(extractJsonObject("Sure!\n```json\n{\"a\":1}\n```")?.a === 1, "extracts fenced JSON");
    assert(extractJsonObject("no json") === null, "no JSON");

    const ok = parseCaseFileResponse(JSON.stringify(plan()), opts);
    assert(!ok.error, `parses: ${ok.error}`);
    const cf = ok.caseFile;
    assert(cf.killer === "Leon Kuwata", "first name resolves to the full name");
    assert(cf.status === CASE_STATUS.PLANNED, "starts planned");
    assert(cf.motive.deadlineDay === 3, "deadline is day + days - 1");
    assert(cf.murderDay === 3, "murder day kept");
    assert(cf.clues.length === 3, "clue in an unknown room is dropped");
    assert(cf.clues[1].roomId === "hpa_gym" && cf.clues[1].roomLabel === "Gym", "room resolves by label");
    assert(cf.clues[2].witness === "Kyoko Kirigiri", "witness clue kept");
    assert(cf.clues.every((c) => c.id), "clues get ids");
    assert(cf.foreshadowing[0].characters.length === 1, "unknown characters dropped from beats");
    assert(cf.witnesses.length === 1, "the victim can't be a witness");

    assert(parseCaseFileResponse(JSON.stringify(plan({ killer: "Makoto Naegi" })), opts).error, "player can't be the killer");
    assert(parseCaseFileResponse(JSON.stringify(plan({ victim: "Leon Kuwata" })), opts).error, "killer can't be the victim");
    assert(parseCaseFileResponse(JSON.stringify(plan({ killer: "Monokuma" })), opts).error, "killer must be a student");
    assert(parseCaseFileResponse(JSON.stringify(plan({ clues: [] })), opts).error, "needs clues");
    assert(parseCaseFileResponse("oops", opts).error, "rejects non-JSON");

    const late = parseCaseFileResponse(JSON.stringify(plan({ murderDay: 9 })), opts).caseFile;
    assert(late.murderDay === 3, "murder day clamps to the deadline");
    const early = parseCaseFileResponse(JSON.stringify(plan({ murderDay: 1 })), opts).caseFile;
    assert(early.murderDay === 2, "murder day can't be before the motive");

    // Normalizing is stable and tolerant.
    assert(normalizeCaseFile(null) === null, "null stays null");
    const again = normalizeCaseFile(JSON.parse(JSON.stringify(cf)));
    assert(JSON.stringify(again) === JSON.stringify(cf), "normalize is idempotent");
    assert(normalizeCaseFile({ status: "weird" }).status === CASE_STATUS.PLANNED, "unknown status falls back");

    assert(getMotiveAnnouncementText(cf) === "Puhuhu! Watch these!", "announcement text");
    const note = buildMotiveChatNote(cf);
    assert(note.includes("The Videos") && note.includes("Day 3"), "chat note names motive and deadline");
    assert(!note.includes("Leon"), "chat note never leaks the killer");
    assert(buildMotiveChatNote({ ...cf, motive: { ...cf.motive, deadlineDay: 2 } }).includes("until tonight"), "same-day deadline");

    assert(isCaseOpen(cf) && !isCaseOpen({ ...cf, status: CASE_STATUS.CLOSED }) && !isCaseOpen(null), "open cases");

    const auto = { autoDay: 3, chapterStartDay: 5, chapterIndex: 1 };
    assert(!shouldAutoAnnounceMotive({ ...auto, day: 6 }), "day 2 of the chapter is too early");
    assert(shouldAutoAnnounceMotive({ ...auto, day: 7 }), "day 3 of the chapter");
    assert(!shouldAutoAnnounceMotive({ ...auto, day: 7, caseFile: cf }), "not while a case is open");
    assert(!shouldAutoAnnounceMotive({ ...auto, day: 7, chapterIndex: 0 }), "never in the prologue");
    assert(!shouldAutoAnnounceMotive({ ...auto, autoDay: 0, day: 9 }), "off");

    // Body and Monokuma File.
    assert(cf.body.roomId === "hpa_kitchen" && cf.body.state, "body room resolves");
    assert(cf.murderTime === "night", "murder time");
    assert(parseCaseFileResponse(JSON.stringify(plan({ body: { room: "moon" } })), opts).error, "body must be in a real room");
    assert(parseCaseFileResponse(JSON.stringify(plan({ murderTime: "noon" })), opts).caseFile.murderTime === "night", "unknown time is night");
    const legacy = normalizeCaseFile({ ...cf, body: undefined, murderTime: undefined });
    assert(legacy.body.roomId === "hpa_kitchen" && legacy.murderTime === "night", "phase-1 plans fall back");

    const mf = buildMonokumaFileBullet(cf, { victimUltimate: "Pop Sensation" });
    assert(mf.title === "Monokuma File #1", "file title");
    assert(mf.description.includes("the Ultimate Pop Sensation") && mf.description.includes("in the Kitchen"), "file names victim and room");
    assert(mf.description.includes("1:30 a.m.") && mf.description.includes("stomach.") && !mf.description.includes(".."), "file text");
    assert(mf.description.includes("wrist."), "injuries get a full stop");
    assert(!mf.description.includes("Leon"), "file never names the killer");

    // When the murder happens. Planned for the night of Day 3.
    assert(!isMurderSlotOver(cf, { day: 2, from: "night" }), "not before the murder day");
    assert(!isMurderSlotOver(cf, { day: 3, from: "day" }), "a night murder waits for the night");
    assert(isMurderSlotOver(cf, { day: 3, from: "night" }), "sleeping through the murder night");
    const dayMurder = { ...cf, murderTime: "day" };
    assert(isMurderSlotOver(dayMurder, { day: 3, from: "day" }), "a day murder happens by nightfall");
    assert(isMurderSlotOver(cf, { day: 4, from: "day" }), "a missed slot happens at the next transition");
    const committed = commitMurder(cf, { day: 3, time: "night" });
    assert(committed.status === CASE_STATUS.COMMITTED && committed.committedAt.day === 3 && !committed.discovered, "committed");
    assert(!isMurderSlotOver(committed, { day: 5, from: "night" }), "only once");

    const found = markDiscovered(committed, { walkedIn: true });
    assert(found.discovered && found.pendingNote === "discovered", "walking in leaves a note");
    assert(markDiscovered(cf).status === CASE_STATUS.COMMITTED, "finding the body early commits the murder");
    assert(!markDiscovered(committed).pendingNote, "no note when the roleplay found it");

    // Foreshadowing beats.
    assert(pickForeshadowingBeat(cf, { slot: "d2-day", presentNames: ["Kyoko"] }) === null, "beat waits for its characters");
    const beat = pickForeshadowingBeat(cf, { slot: "d2-day", presentNames: ["Sayaka Maizono", "Leon Kuwata"] });
    assert(beat?.id, "beat picked when present");
    const used = markBeatUsed(cf, beat.id, "d2-day");
    assert(used.foreshadowing[0].used && used.lastBeatSlot === "d2-day", "beat marked");
    const twoBeats = normalizeCaseFile({ ...cf, foreshadowing: [{ text: "a", characters: [] }, { text: "b", characters: [] }] });
    const once = markBeatUsed(twoBeats, twoBeats.foreshadowing[0].id, "d2-day");
    assert(pickForeshadowingBeat(once, { slot: "d2-day" }) === null, "one beat per slot");
    assert(pickForeshadowingBeat(once, { slot: "d2-night" })?.text === "b", "next slot gets the next beat");
    assert(pickForeshadowingBeat(committed, { slot: "d9-day" }) === null, "no beats after the murder");
    assert(getTimeSlot(3, "night") === "d3-night", "slot");

    // Emergent clues.
    assert(addEmergentClue(committed, { title: "X" }).emergentClues.length === 0, "only once the body is found");
    const withClue = addEmergentClue(found, { id: "tb_1", title: "Torn Note", text: "Found under a table", roomId: "hpa_gym" });
    assert(withClue.emergentClues.length === 1 && withClue.emergentClues[0].roomId === "hpa_gym", "emergent clue kept");
    assert(addEmergentClue(withClue, { id: "tb_1", title: "Torn Note" }).emergentClues.length === 1, "no duplicates");
    assert(removeEmergentClue(withClue, { id: "tb_1" }).emergentClues.length === 0, "removed on rollback");

    const dump = describeCaseFile(withClue);
    assert(dump.includes("Killer: Leon Kuwata") && dump.includes("Torn Note") && dump.includes("found: yes"), "debug dump");
    assert(describeCaseFile(null).includes("No case"), "empty dump");

    console.log("caseFile tests passed");
}

run();
