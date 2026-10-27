import { CASE_STATUS, normalizeCaseFile } from "./caseFile.js";
import { buildCasePrompt } from "./casePrompts.js";
import { MAX_SPOTS, MIN_SPOTS, buildExamineNote, buildHotspotPrompt, cluesInRoom, layoutHotspots, normalizeExamine, parseHotspots, placeHotspots } from "./examine.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

const cf = normalizeCaseFile({
    status: CASE_STATUS.COMMITTED,
    discovered: true,
    createdDay: 2,
    chapterIndex: 1,
    motive: { title: "Videos", deadlineDay: 3 },
    killer: "Leon Kuwata",
    victim: "Sayaka Maizono",
    murderDay: 3,
    body: { roomId: "kitchen", roomLabel: "Kitchen", state: "Slumped against the counter." },
    clues: [
        { id: "clue1", text: "A knife is missing from the rack", roomId: "kitchen" },
        { id: "clue2", text: "Blood under the sink", roomId: "kitchen" },
        { id: "clue3", text: "Scuffed floor", roomId: "gym" },
    ],
});

function run() {
    assert(cluesInRoom(cf, "kitchen").length === 2, "clues in a room");

    const prompt = buildHotspotPrompt({ caseFile: cf, roomId: "kitchen", roomLabel: "Kitchen" });
    assert(prompt.includes("1. A knife is missing") && prompt.includes("crime scene") && !prompt.includes("Scuffed"), "hotspot prompt lists only this room's evidence");

    // Clues map to spots; a forgotten clue still gets one; the body is there.
    const spots = parseHotspots('{"spots":[{"label":"Knife rack","clue":1},{"label":"Stove","clue":null},{"label":"Fridge","clue":7},{"label":"Stove","clue":null}]}', { caseFile: cf, roomId: "kitchen", isScene: true });
    assert(spots.find((s) => s.label === "Knife rack").clueId === "clue1", "clue spot");
    assert(spots.some((s) => s.clueId === "clue2"), "a forgotten clue still gets a spot");
    assert(spots.filter((s) => s.label === "Stove").length === 1, "duplicates dropped");
    assert(spots[0].label === "The body", "the crime scene has the body");
    assert(spots.length >= MIN_SPOTS && spots.length <= MAX_SPOTS + 1, "spot count");
    assert(new Set(spots.map((s) => s.id)).size === spots.length && spots.every((s) => !s.examined), "ids and state");
    assert(parseHotspots("garbage", { caseFile: cf, roomId: "kitchen" }).filter((s) => s.clueId).length === 2, "even a bad reply keeps the clues findable");

    // Positions: spread out, or where the player left them.
    const layout = layoutHotspots(5);
    assert(layout.length === 5 && layout.every((p) => p.x > 0 && p.x < 100 && p.y > 0 && p.y < 100), "layout inside the room");
    assert(new Set(layout.map((p) => `${p.x},${p.y}`)).size === 5, "no two spots on top of each other");
    const placed = placeHotspots([{ label: "Stove" }, { label: "Sink" }], { stove: { x: 12, y: 80 } });
    assert(placed[0].x === 12 && placed[0].y === 80 && placed[1].x !== 12, "saved position wins");

    const normalized = normalizeExamine({ kitchen: { spots: [{ label: "Sink", x: 500, examined: 1 }, { label: "" }] }, empty: { spots: [] } });
    assert(normalized.kitchen.spots.length === 1 && normalized.kitchen.spots[0].x === 98 && normalized.kitchen.spots[0].examined, "normalize clamps and drops empties");
    assert(!normalized.empty, "rooms without spots are dropped");

    // What the next reply is told.
    const clueNote = buildExamineNote(cf, { label: "Knife rack", clueId: "clue1" });
    assert(clueNote.includes("A knife is missing") && clueNote.includes("V3C| TB:"), "a clue spot hands over its clue");
    const plain = buildExamineNote(cf, { label: "Stove" });
    assert(!plain.includes("knife") && plain.includes("Nothing decisive"), "an ordinary spot gives nothing away");
    const free = buildExamineNote(cf, { label: "the floor drain", freeText: true, roomId: "kitchen" });
    assert(free.includes("Blood under the sink") && !free.includes("Scuffed"), "free text can turn up this room's clues");

    // The look goes out once, during the investigation only.
    const pending = normalizeCaseFile({ ...cf, pendingExamine: { label: "Knife rack", clueId: "clue1", roomId: "kitchen" } });
    const sent = buildCasePrompt({ caseFile: pending, phase: "INVESTIGATION", roomId: "kitchen", speakerName: "Kyoko" });
    assert(sent.examine && sent.text.includes("[EXAMINING]"), "the examine note goes out");
    assert(!buildCasePrompt({ caseFile: cf, phase: "INVESTIGATION", roomId: "kitchen" }).text.includes("[EXAMINING]"), "not without a pending look");

    console.log("examine tests passed");
}

run();
