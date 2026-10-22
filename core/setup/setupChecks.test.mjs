import { countSetupProblems, countSetupReminders, evaluateSetup, SETUP_STATUS } from "./setupChecks.js";

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
    assert(empty.backgrounds.status === SKIP && empty.backgrounds.fix === "backgrounds", "backgrounds skip without rooms");
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
        rooms: { total: 4, withBg: 4 },
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
        rooms: { total: 6, withBg: 2 },
        presetHasMarkers: true,
        save: { exists: true, name: "Story", mode: "single", groupOk: false },
    }));
    assert(partial.sprites.status === WARN && partial.sprites.detail.includes("B, C"), "partial sprites warn and name who");
    assert(partial.lorebook.status === WARN, "missing Ultimates warn");
    assert(partial.presence.status === WARN, "single chat without Presence warns");
    assert(partial.bgm.status === WARN && partial.bgm.detail.includes("Nighttime"), "empty BGM lists warn and are named");
    assert(partial.backgrounds.status === WARN && partial.backgrounds.detail.includes("2 of 6"), "rooms without a background warn");
    assert(partial.ai.status === OK, "preset marker rules count");
    assert(partial.save.status === WARN, "single save without its chat warns");

    const noSprites = byId(evaluateSetup({ cards: 2, sprites: { with: [], without: ["A", "B"] } }));
    assert(noSprites.sprites.status === MISSING, "nobody with sprites is missing");

    const many = byId(evaluateSetup({ cards: 9, sprites: { with: [], without: ["A", "B", "C", "D", "E", "F"] } }));
    assert(many.sprites.detail.includes("and 2 more"), "long name lists are shortened");

    // The SETUP glow ignores sprites, Ultimates, room backgrounds and the save.
    const glowFacts = {
        cards: 3,
        sprites: { with: [], without: ["A", "B"] },
        ultimates: { known: 0, total: 2 },
        singleChat: false,
        bgm: { files: 4, emptyLists: [] },
        rooms: { total: 5, withBg: 0 },
        markerPrompts: true,
        persona: "Makoto",
        save: { exists: false },
    };
    assert(countSetupReminders(evaluateSetup(glowFacts)) === 0, "sprites, ultimates, backgrounds and save don't glow");
    assert(countSetupReminders(evaluateSetup({ ...glowFacts, persona: "" })) === 1, "a warning glows");
    assert(countSetupReminders(evaluateSetup({ ...glowFacts, cards: 0 })) === 1, "a missing requirement glows");

    console.log("setupChecks tests passed");
}

run();
