import { CASE_STATUS, normalizeCaseFile } from "./caseFile.js";
import { buildCasePrompt } from "./casePrompts.js";
import { MAX_SPOTS, MIN_SPOTS, describeRoomOwner, buildExamineNarrationPrompt, buildHotspotPrompt, buildPartnerReactionNote, cluesInRoom, layoutHotspots, normalizeExamine, parseExamineNarration, parseHotspots, placeHotspots } from "./examine.js";

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

    // The hidden narration: a clue spot hands over its clue, others don't.
    const opts = { player: "Shuichi", roomLabel: "Kitchen", caseFacts: "facts", present: ["Kaede"] };
    const clueAsk = buildExamineNarrationPrompt(cf, { label: "Knife rack", clueId: "clue1" }, opts);
    assert(clueAsk.includes("A knife is missing") && clueAsk.includes("V3C| TB:") && clueAsk.includes("Shuichi") && clueAsk.includes("Kaede"), "clue spot narration prompt");
    const plain = buildExamineNarrationPrompt(cf, { label: "Stove" }, opts);
    assert(!plain.includes("A knife is missing") && plain.includes("clearly important") && plain.includes("V3C| TB:"), "an ordinary spot gives no planted clue away, but real evidence still counts");
    const withWeapon = buildExamineNarrationPrompt({ ...cf, weapon: "Heavy gold trophy" }, { label: "Trophy" }, opts);
    assert(withWeapon.includes("Heavy gold trophy"), "the weapon is named so examining it finds evidence");
    assert(plain.includes("Plain prose only") && !plain.includes("{{"), "default template filled, narration only");
    const custom = buildExamineNarrationPrompt(cf, { label: "Stove" }, { ...opts, template: "Narrate {{player}} looking at {{thing}}." });
    assert(custom.startsWith("Narrate Shuichi looking at the Stove.") && custom.includes("clearly important"), "an edited prompt still gets the findings rule");
    const free = buildExamineNarrationPrompt(cf, { label: "the floor drain", freeText: true, roomId: "kitchen" }, opts);
    assert(free.includes("Blood under the sink") && !free.includes("Scuffed"), "free text can turn up this room's clues");

    // A classmate's room: the spots and what you notice fit them.
    const owner = { name: "Leon Kuwata", ultimate: "Baseball Star", card: "Wants to be a musician. Hates practice." };
    const ownSpots = buildHotspotPrompt({ caseFile: cf, roomId: "dorm_leon", roomLabel: "Leon's Room", owner });
    assert(ownSpots.includes("WHOSE ROOM") && ownSpots.includes("Ultimate Baseball Star") && ownSpots.includes("Wants to be a musician") && ownSpots.includes("fit Leon Kuwata"), "spots prompt gets the owner's card");
    assert(!prompt.includes("WHOSE ROOM") && !plain.includes("WHOSE ROOM") && !plain.includes("{{owner}}"), "no owner, nothing added");
    const ownLook = buildExamineNarrationPrompt(cf, { label: "Guitar" }, { ...opts, owner });
    assert(ownLook.includes("Wants to be a musician") && ownLook.includes("fits the person who lives here"), "narration gets the owner");
    assert(buildExamineNarrationPrompt(cf, { label: "Guitar" }, { ...opts, owner, template: "Narrate {{thing}}." }).includes("WHOSE ROOM"), "an edited prompt without {{owner}} still gets it");
    assert(describeRoomOwner({ name: "Sayaka", dead: true }).includes("Sayaka is dead") && describeRoomOwner({ name: "Makoto", isPlayer: true }).includes("(the player)") && describeRoomOwner(null) === "", "owner wording");

    const parsed = parseExamineNarration('<think>hm</think>"The rack has an empty slot. Someone took a knife."\nV3C| TB: Missing Knife || One knife is gone from the kitchen rack.');
    assert(parsed.text === "The rack has an empty slot. Someone took a knife.", `narration text: ${parsed.text}`);
    assert(parsed.bullets.length === 1 && parsed.bullets[0].title === "Missing Knife", "bullet parsed out");
    assert(parseExamineNarration("Just dust.").bullets.length === 0, "no bullet");
    const loose = parseExamineNarration("**Heavy, solid gold.** It could kill someone.\n**Truth Bullet:** Gold Trophy — A heavy solid gold trophy lies by the body.");
    assert(loose.bullets[0]?.title === "Gold Trophy" && !loose.text.includes("**") && !loose.text.includes("Truth Bullet"), `lenient bullet line: ${JSON.stringify(loose)}`);
    assert(parseExamineNarration("TB: Blood Smear || A smear on the floor.").bullets[0]?.title === "Blood Smear", "bare TB line");

    // The partner's reaction note goes only to that partner, once.
    const note = buildPartnerReactionNote({ player: "Shuichi", label: "the knife rack", narration: "An empty slot.", found: "Missing Knife" });
    assert(note.includes("Shuichi") && note.includes("Missing Knife"), "reaction note");
    const pending = normalizeCaseFile({ ...cf, pendingReaction: { speaker: "Kaede Akamatsu", player: "Shuichi", label: "the knife rack", narration: "An empty slot." } });
    const toPartner = buildCasePrompt({ caseFile: pending, phase: "INVESTIGATION", roomId: "kitchen", speakerName: "Kaede Akamatsu" });
    assert(toPartner.reaction && toPartner.text.includes("[INVESTIGATING TOGETHER]"), "partner gets the note");
    assert(!buildCasePrompt({ caseFile: pending, phase: "INVESTIGATION", roomId: "kitchen", speakerName: "Kyoko" }).text.includes("INVESTIGATING TOGETHER"), "others don't");

    console.log("examine tests passed");
}

run();
