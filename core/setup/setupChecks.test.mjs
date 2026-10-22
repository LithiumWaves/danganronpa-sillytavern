import { countSetupProblems, evaluateSetup, SETUP_STATUS } from "./setupChecks.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

const byId = (rows) => Object.fromEntries(rows.map((r) => [r.id, r]));

function run() {
    const { OK, WARN, MISSING, SKIP } = SETUP_STATUS;

    const empty = byId(evaluateSetup({}));
    assert(empty.cards.status === MISSING, "no cards is missing");
    assert(empty.sprites.status === SKIP, "sprites skip without cards");
    assert(empty.lorebook.status === SKIP, "lorebook skips without a class");
    assert(empty.presence.status === SKIP, "presence skips in Several Chats");
    assert(empty.bgm.status === WARN, "no BGM files is a warning");
    assert(empty.ai.status === WARN, "no marker rules is a warning");
    assert(empty.persona.status === WARN, "no persona is a warning");
    assert(empty.save.status === MISSING && empty.save.fix === "newGame", "no save points to NEW GAME");
    assert(countSetupProblems(evaluateSetup({})) === 2, "counts only missing rows");

    const ready = byId(evaluateSetup({
        cards: 3,
        sprites: { with: ["A", "B", "C"], without: [] },
        ultimates: { known: 3, total: 3 },
        singleChat: true,
        presence: true,
        bgm: { files: 12, emptyLists: [] },
        markerPrompts: true,
        persona: "Hajime",
        save: { exists: true, name: "Save 1", mode: "single", groupOk: true },
    }));
    assert(Object.values(ready).every((r) => r.status === OK), "fully set up is all ok");

    const partial = byId(evaluateSetup({
        cards: 3,
        sprites: { with: ["A"], without: ["B", "C"] },
        ultimates: { known: 1, total: 3 },
        singleChat: true,
        presence: false,
        bgm: { files: 5, emptyLists: ["Nighttime"] },
        presetHasMarkers: true,
        save: { exists: true, name: "Story", mode: "single", groupOk: false },
    }));
    assert(partial.sprites.status === WARN && partial.sprites.detail.includes("B, C"), "partial sprites warn and name who");
    assert(partial.lorebook.status === WARN, "missing Ultimates warn");
    assert(partial.presence.status === WARN, "single chat without Presence warns");
    assert(partial.bgm.status === WARN && partial.bgm.detail.includes("Nighttime"), "empty BGM lists warn and are named");
    assert(partial.ai.status === OK, "preset marker rules count");
    assert(partial.save.status === WARN, "single save without its chat warns");

    const noSprites = byId(evaluateSetup({ cards: 2, sprites: { with: [], without: ["A", "B"] } }));
    assert(noSprites.sprites.status === MISSING, "nobody with sprites is missing");

    const many = byId(evaluateSetup({ cards: 9, sprites: { with: [], without: ["A", "B", "C", "D", "E", "F"] } }));
    assert(many.sprites.detail.includes("and 2 more"), "long name lists are shortened");

    console.log("setupChecks tests passed");
}

run();
