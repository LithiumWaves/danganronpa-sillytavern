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
    editMotive,
    MAX_BEAT_ATTEMPTS,
    beatWordOverlap,
    createBlankCaseFile,
    isGatheringNow,
    monokumaFileChanged,
    recordBeatAttempt,
    reviseMonokumaFile,
    validateCaseFile,
    describeCaseFile,
    extractJsonObject,
    parseLooseJson,
    getMotiveAnnouncementText,
    isCaseOpen,
    normalizeCaseFile,
    parseCaseFileResponse,
    shouldAutoAnnounceMotive,
    CASE_SHAPES,
    caseBlackened,
    caseSecretHolders,
    getMonokumaFileTitle,
    getSecondVictim,
    listWitnessTestimony,
    pickCaseShape,
    buildBodyAnnouncementBullet,
    countedWitnesses,
    countsAsWitness,
    getBodySeenBy,
    isAnnounceable,
    isBodyFound,
    noteBodySeen,
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
    assert(!prompt.includes("WHERE PEOPLE USUALLY ARE") && !prompt.includes("SCHOOL REGULATIONS"), "no routines or rules unless given");
    const withRoutines = buildCaseGenerationPrompt({ cast, rooms, routines: ["- Leon Kuwata: daytime Gym"], rules: "1. No leaving." });
    assert(withRoutines.includes("WHERE PEOPLE USUALLY ARE") && withRoutines.includes("daytime Gym") && withRoutines.includes("1. No leaving."), "routines and rules in the plan");

    {
        const base = normalizeCaseFile({ status: "planned", createdDay: 2, motive: { title: "Videos", description: "x", deadlineDay: 4 }, killer: "A", victim: "B", murderDay: 3 });
        const later = editMotive(base, { deadlineDay: 6 }, { today: 2 });
        assert(later.motive.deadlineDay === 6 && later.murderDay === 5 && later.motive.title === "Videos", "a later deadline moves the murder with it");
        const sooner = editMotive(base, { deadlineDay: 2, title: "Money", description: "Cash" }, { today: 2 });
        assert(sooner.motive.deadlineDay === 2 && sooner.murderDay === 2 && sooner.motive.title === "Money" && sooner.motive.description === "Cash", "a sooner deadline pulls the murder in");
        assert(editMotive(base, { deadlineDay: 1 }, { today: 3 }).motive.deadlineDay === 3, "never before today");
        assert(editMotive(base, { title: "  " }, { today: 2 }).motive.title === "Videos", "a blank title keeps the old one");
        const late = editMotive(base, { deadlineDay: 5 }, { today: 5 });
        assert(late.createdDay === 2 && late.murderDay === 5, "pushed past an old murder day, it lands on today at the earliest");
        const done = { ...base, status: "committed" };
        assert(editMotive(done, { deadlineDay: 9 }) === done, "not after the murder");
    }

    {
        const file = (mf) => buildMonokumaFileBullet(normalizeCaseFile({ status: "committed", createdDay: 1, victim: "Yasuhiro", killer: "A", monokumaFile: mf }), {}).description;
        const once = file({ timeOfDeath: "Approximately 11:15 PM on Day 4", cause: "Blunt force trauma to the head" });
        assert(once.includes("The time of death is approximately 11:15 PM on Day 4.") && !/approximately approximately/i.test(once), "no doubled 'approximately'");
        assert(once.includes("The cause of death is blunt force trauma to the head."), "the cause reads mid-sentence");
        assert(file({ timeOfDeath: "11 PM" }).includes("approximately 11 PM."), "a bare time gets 'approximately'");
        assert(file({ timeOfDeath: "around midnight" }).includes("is around midnight."), "hedged times keep their word");
        assert(file({ timeOfDeath: "Unknown", cause: "Unknown" }).includes("The time of death is unknown. The cause of death is unknown."), "unknown fields");
        assert(file({ cause: "CO poisoning" }).includes("is CO poisoning."), "acronyms kept");
    }

    // Case shapes.
    {
        const castPlus = [...cast, { name: "Mondo Owada" }, { name: "Peko Pekoyama" }];
        const o = { ...opts, cast: castPlus };
        const std = parseCaseFileResponse(JSON.stringify(plan()), o).caseFile;
        assert(std.shape === "standard" && caseBlackened(std) === "Leon Kuwata" && !getSecondVictim(std), "old plans are standard");
        assert(normalizeCaseFile({ killer: "A", victim: "B" }).shape === "standard", "missing shape → standard");

        const shapePrompt = buildCaseGenerationPrompt({ cast, rooms, shape: "double" });
        assert(shapePrompt.includes("CASE SHAPE: There are two bodies") && shapePrompt.includes('"secondVictim"'), "the planner is told the shape and its fields");
        assert(buildCaseGenerationPrompt({ cast, rooms }).includes("CASE SHAPE: One student kills another.") && !buildCaseGenerationPrompt({ cast, rooms }).includes("secondVictim"), "standard by default");

        const dbl = parseCaseFileResponse(JSON.stringify(plan({ secondVictim: { name: "Mondo", killer: "", body: { room: "Gym", state: "On the floor" }, monokumaFile: { timeOfDeath: "2 a.m.", cause: "a blow" } } })), { ...o, shape: "double" });
        assert(dbl.caseFile.shape === "double" && getSecondVictim(dbl.caseFile).name === "Mondo Owada" && getSecondVictim(dbl.caseFile).killer === "Leon Kuwata" && getSecondVictim(dbl.caseFile).body.roomId === "hpa_gym", "a double plan");
        assert(getMonokumaFileTitle(dbl.caseFile, 1) === "Monokuma File #1-2" && getMonokumaFileTitle(dbl.caseFile) === "Monokuma File #1", "two files");
        const second = buildMonokumaFileBullet(dbl.caseFile, { index: 1 });
        assert(second.title === "Monokuma File #1-2" && second.description.includes("The victim is Mondo Owada") && second.description.includes("Gym"), "the second file bullet");
        assert(validateCaseFile(dbl.caseFile, { cast: castPlus, rooms, player: "Makoto Naegi" }) === "", "a valid double");
        assert(validateCaseFile({ ...dbl.caseFile, secondVictim: { ...dbl.caseFile.secondVictim, body: { roomId: "moon" } } }, { cast: castPlus, rooms }).includes("second body"), "the second body needs a room");

        const broken = parseCaseFileResponse(JSON.stringify(plan({ secondVictim: { name: "Nobody" } })), { ...o, shape: "double" });
        assert(broken.caseFile.shape === "standard" && broken.warning.includes("dropped"), "a broken twist falls back to standard");

        const sui = parseCaseFileResponse(JSON.stringify(plan({ killer: "whoever" })), { ...o, shape: "suicide" }).caseFile;
        assert(sui.shape === "suicide" && sui.killer === "Sayaka Maizono" && caseBlackened(sui) === "Sayaka Maizono", "a suicide's killer is the victim");
        assert(validateCaseFile(sui, { cast: castPlus, rooms }) === "", "a suicide validates");
        assert(validateCaseFile({ ...std, killer: std.victim }, { cast: castPlus, rooms }).includes("Suicide"), "only a suicide may kill themselves");

        const acc = parseCaseFileResponse(JSON.stringify(plan({ accomplices: ["Peko", "Leon", "Ghost"] })), { ...o, shape: "accomplice" }).caseFile;
        assert(acc.shape === "accomplice" && acc.accomplices.join() === "Peko Pekoyama", "accomplices exclude the killer and strangers");
        assert(validateCaseFile({ ...acc, accomplices: [] }, { cast: castPlus, rooms }).includes("accomplice"), "an accomplice is needed");

        const wv = parseCaseFileResponse(JSON.stringify(plan({ intendedVictim: "Kyoko" })), { ...o, shape: "wrong_victim" }).caseFile;
        assert(wv.intendedVictim === "Kyoko Kirigiri", "the intended victim");
        const dec = parseCaseFileResponse(JSON.stringify(plan({ decoy: "Mondo" })), { ...o, shape: "decoy" }).caseFile;
        assert(dec.decoy === "Mondo Owada", "the decoy");

        const holders = (cf) => caseSecretHolders(cf).map((h) => `${h.name}:${h.role}`).join();
        assert(holders(acc) === "Leon Kuwata:killer,Peko Pekoyama:accomplice", "accomplice holders");
        assert(holders(dec) === "Leon Kuwata:killer,Mondo Owada:decoy" && holders(sui) === "Sayaka Maizono:suicide", "decoy and suicide holders");
        const twoKillers = { ...dbl.caseFile, secondVictim: { ...dbl.caseFile.secondVictim, killer: "Kyoko Kirigiri" } };
        assert(holders(twoKillers) === "Leon Kuwata:killer,Kyoko Kirigiri:second_killer", "a second killer");
        const accWitness = normalizeCaseFile({ ...acc, witnesses: [{ name: "Peko Pekoyama", account: "Saw nothing" }, { name: "Kyoko Kirigiri", account: "Heard a thud" }] });
        assert(listWitnessTestimony(accWitness).map((w) => w.name).join() === "Kyoko Kirigiri", "an accomplice is never a witness");
        assert(describeCaseFile(acc).includes("Shape: Accomplice") && describeCaseFile(dbl.caseFile).includes("Second body: Mondo Owada"), "status shows the shape");

        let n = 0;
        const seq = (vals) => () => vals[n++ % vals.length];
        assert(pickCaseShape({ twists: "off", rng: seq([0]) }) === "standard", "twists off");
        n = 0;
        assert(pickCaseShape({ twists: "often", rng: seq([0.1, 0]), lastShape: "wrong_victim" }) !== "wrong_victim", "never the same twist twice");
        n = 0;
        assert(pickCaseShape({ twists: "sometimes", rng: seq([0.9]) }) === "standard", "mostly standard");
        assert(Object.keys(CASE_SHAPES).length === 7, "seven shapes");
    }

    // The three-witness rule.
    {
        const base = normalizeCaseFile({ status: "committed", shape: "accomplice", killer: "Leon Kuwata", victim: "Sayaka Maizono", accomplices: ["Peko Pekoyama"], decoy: "Mondo Owada",
            body: { roomId: "kitchen", roomLabel: "Kitchen" }, secondVictim: { name: "Hifumi Yamada", killer: "Kyoko Kirigiri", body: { roomId: "art" } } });
        assert(!isBodyFound(base) && getBodySeenBy(base).length === 0, "nobody has seen it yet");
        let cf = noteBodySeen(base, ["Makoto Naegi", "Leon Kuwata"]);
        assert(isBodyFound(cf) && getBodySeenBy(cf).join() === "Makoto Naegi,Leon Kuwata" && !isAnnounceable(cf), "the killer doesn't count");
        cf = noteBodySeen(cf, ["Peko Pekoyama", "makoto naegi", "Aoi Asahina"]);
        assert(countedWitnesses(cf).join() === "Makoto Naegi,Aoi Asahina" && !isAnnounceable(cf), "accomplices don't count; no duplicates");
        assert(!countsAsWitness(cf, "Peko Pekoyama") && countsAsWitness(cf, "Aoi Asahina"), "countsAsWitness");
        cf = noteBodySeen(cf, ["Yasuhiro Hagakure", "Toko Fukawa"]);
        assert(isAnnounceable(cf), "three counted witnesses");
        const bullet = buildBodyAnnouncementBullet(cf, { day: 4, time: "day" });
        assert(bullet.title === "Body Discovery Announcement" && bullet.description.includes("played when Yasuhiro Hagakure saw the body (Day 4, daytime)") && bullet.description.includes("Makoto Naegi, Leon Kuwata, Peko Pekoyama, Aoi Asahina, Yasuhiro Hagakure.") && !bullet.description.includes("Toko"), "the announcement bullet lists everyone up to the third, in order");
        const dec = normalizeCaseFile({ ...base, shape: "decoy" });
        assert(countsAsWitness(dec, "Mondo Owada"), "a decoy counts");
        assert(noteBodySeen(base, ["A"], { index: 1 }) === base, "no second body outside a double");
        const dbl = normalizeCaseFile({ ...base, shape: "double" });
        const second = noteBodySeen(dbl, ["Kyoko Kirigiri", "Makoto Naegi"], { index: 1 });
        assert(isBodyFound(second, 1) && !isBodyFound(second, 0) && countedWitnesses(second, 1).join() === "Makoto Naegi", "the second body counts separately, its killer excluded");
        assert(buildBodyAnnouncementBullet(second, { index: 1 }).title === "Second Body Discovery Announcement", "second bullet");
    }

    assert(extractJsonObject("Sure!\n```json\n{\"a\":1}\n```")?.a === 1, "extracts fenced JSON");
    assert(extractJsonObject("no json") === null, "no JSON");

    const ok = parseCaseFileResponse(JSON.stringify(plan()), opts);
    assert(!ok.error, `parses: ${ok.error}`);
    const cf = ok.caseFile;
    assert(cf.killer === "Leon Kuwata", "first name resolves to the full name");
    assert(cf.status === CASE_STATUS.PLANNED, "starts planned");
    assert(cf.motive.deadlineDay === 3, "deadline is day + days - 1");
    assert(cf.murderDay === 3, "murder day kept");
    assert(cf.clues.length === 4 && cf.clues[3].roomId === "hpa_kitchen", "a clue in an unknown room moves to the crime scene");
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
    assert(dump.includes("Killer: Leon Kuwata") && dump.includes("Torn Note") && dump.includes("announced: yes"), "debug dump");
    assert(describeCaseFile(null).includes("No case"), "empty dump");

    // Beats that miss are retried, then set aside.
    assert(beatWordOverlap("Leon asks where the knives are kept", "Leon wandered in, asking where the kitchen knives were kept.") >= 0.4, "overlap when used");
    assert(beatWordOverlap("Leon asks where the knives are kept", "Everyone ate breakfast quietly.") < 0.4, "no overlap when ignored");
    const beatId = cf.foreshadowing[0].id;
    let tries = cf;
    for (let i = 0; i < MAX_BEAT_ATTEMPTS - 1; i += 1) tries = recordBeatAttempt(tries, beatId, { landed: false, slot: "d2-day" });
    assert(!tries.foreshadowing[0].skipped && !tries.lastBeatSlot, "a miss doesn't spend the slot");
    assert(pickForeshadowingBeat(tries, { slot: "d2-day", presentNames: ["Sayaka Maizono", "Leon Kuwata"] }), "missed beat offered again");
    tries = recordBeatAttempt(tries, beatId, { landed: false });
    assert(tries.foreshadowing[0].skipped, "set aside after the last attempt");
    assert(!pickForeshadowingBeat(tries, { slot: "d3-day", presentNames: ["Sayaka Maizono", "Leon Kuwata"] }), "set-aside beats aren't offered");
    const landed = recordBeatAttempt(cf, beatId, { landed: true, slot: "d2-day" });
    assert(landed.foreshadowing[0].used && landed.lastBeatSlot === "d2-day", "a landed beat spends the slot");

    // Public murders and concealment.
    const pub = parseCaseFileResponse(JSON.stringify(plan({
        murderStyle: "public",
        gathering: { room: "Gym", description: "A séance in the dark" },
        body: { room: "Gym", state: "Lying in the circle." },
        monokumaFile: { timeOfDeath: "Unknown", cause: "a blow to the head", concealed: [{ field: "timeOfDeath", truth: "Killed at 9pm; the lights hid it" }, { field: "nonsense", truth: "x" }] },
    })), opts).caseFile;
    assert(pub.murderStyle === "public" && pub.gathering.roomId === "hpa_gym", "public murder with gathering");
    assert(pub.monokumaFile.concealed.length === 1, "concealed field validated");
    assert(!buildMonokumaFileBullet(pub).description.includes("9pm"), "the bullet never shows the concealed truth");
    assert(normalizeCaseFile({ ...pub, gathering: null }).murderStyle === "hidden", "public needs a gathering");
    const at = { day: 3, time: "night", roomId: "hpa_gym", presentNames: ["Sayaka Maizono"] };
    assert(isGatheringNow(pub, at), "gathering now");
    assert(!isGatheringNow(pub, { ...at, time: "day" }), "wrong time");
    assert(!isGatheringNow(pub, { ...at, roomId: "hpa_kitchen" }), "wrong room");
    assert(!isGatheringNow(pub, { ...at, presentNames: [] }), "victim must be there");
    assert(!isGatheringNow(cf, at), "hidden murders have no gathering");

    // File revisions.
    const foundFile = markDiscovered(commitMurder(cf, { day: 3 }));
    const revised = reviseMonokumaFile(foundFile, { timeOfDeath: "Unknown" });
    assert(revised.monokumaFile.revision === 2 && revised.monokumaFile.timeOfDeath === "Unknown", "revised after discovery");
    assert(monokumaFileChanged(foundFile, revised) && !monokumaFileChanged(revised, revised), "change detected");
    assert(reviseMonokumaFile(cf, { timeOfDeath: "x" }).monokumaFile.revision === 1, "no revision before anyone has the file");

    // Hand-written cases.
    const v = { cast, rooms, player: "Makoto Naegi" };
    assert(validateCaseFile(cf, v) === "", `valid case: ${validateCaseFile(cf, v)}`);
    assert(validateCaseFile({ ...cf, killer: "Makoto Naegi" }, v).includes("killer"), "player can't be the killer");
    assert(validateCaseFile({ ...cf, victim: cf.killer }, v).includes("same"), "same student");
    assert(validateCaseFile({ ...cf, body: { ...cf.body, roomId: "moon" } }, v).includes("body"), "body room");
    const blank = createBlankCaseFile({ day: 4, chapterIndex: 2, deadlineDays: 2 });
    assert(blank.murderDay === 5 && blank.motive.deadlineDay === 5 && validateCaseFile(blank, v).includes("title"), "blank case");

    const added = normalizeCaseFile({ ...cf, clues: [...cf.clues, { text: "New clue", roomId: "hpa_gym" }] });
    assert(new Set(added.clues.map((c) => c.id)).size === added.clues.length, "new rows get unique ids");

    // Loose JSON: whatever shape the model's reply comes back in.
    assert(parseLooseJson('<think>Let me plan {this}</think>\n{"a":1}').value?.a === 1, "think block skipped");
    assert(parseLooseJson('<think>still thinking with no end').value === null, "unfinished think has nothing");
    assert(parseLooseJson('Here you go:\n```json\n{"a": [1, 2,],}\n```\nEnjoy!').value?.a?.length === 2, "fences and trailing commas");
    assert(parseLooseJson('{\u201Ca\u201D: \u201Cb\u201D}').value?.a === "b", "smart quotes");
    const cutString = parseLooseJson('{"a": 1, "b": "half a sent');
    assert(cutString.cutOff && cutString.value.a === 1 && cutString.value.b === "half a sent", "closed mid-string");
    const cutArray = parseLooseJson('{"a": 1, "list": [{"x": 1}, {"x": 2}, {"x"');
    assert(cutArray.cutOff && cutArray.value.list.length === 2, "trimmed back to the last whole item");
    const cutKey = parseLooseJson('{"a": 1, "b":');
    assert(cutKey.value?.a === 1 && !("b" in cutKey.value), "dangling key dropped");
    assert(parseLooseJson("I can't help with that.").reason === "no-json", "no JSON at all");
    assert(parseLooseJson('{"a": nope}').value === null, "invalid stays invalid");
    assert(parseLooseJson('{"a": "brace } inside", "b": 2}').value?.b === 2, "braces inside strings");

    // A plan cut off after its clues still makes a case.
    const full = JSON.stringify(plan());
    const clipped = full.slice(0, full.indexOf('"foreshadowing"') + 25);
    const fromClipped = parseCaseFileResponse(clipped, opts);
    assert(!fromClipped.error && fromClipped.caseFile.clues.length === 4, `clipped plan parses: ${fromClipped.error}`);
    assert(parseCaseFileResponse(full.slice(0, 120), opts).error, "too little survives");

    // Rooms the model writes loosely still land on the map.
    const loose = parseCaseFileResponse(JSON.stringify(plan({
        body: { room: "HPA-Gym", state: "x" },
        clues: [{ text: "a", room: "the gym" }, { text: "b", room: "Dorm_Hallway" }, { text: "c", room: "hpa kitchen" }],
    })), opts).caseFile;
    assert(loose.body.roomId === "hpa_gym", "body room by loose id");
    assert(loose.clues.map((c) => c.roomId).join() === "hpa_gym,hpa_dorm_hall,hpa_kitchen", "clue rooms by loose name or id");
    const cutClues = parseCaseFileResponse('{"killer":"Leon","victim":"Sayaka","motive":{"title":"T"},"body":{"room":"Gym"},"clues":[{"text":"a","room":"Gym"},{"text":"b","ro', opts);
    assert(cutClues.error?.includes("cut off") && cutClues.reason === "cut-off", "cut off before enough clues says so");

    console.log("caseFile tests passed");
}

run();
