import {
    CASE_STATUS,
    buildCaseGenerationPrompt,
    buildMotiveChatNote,
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

    console.log("caseFile tests passed");
}

run();
