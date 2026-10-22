import { SAVE_MODES, createSaveStore, hasStoryProgress, summarizeState } from "./saveStore.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

function makeStore(root, defaults = {}) {
    let t = 1000;
    let n = 0;
    return createSaveStore({
        getRoot: () => root,
        defaults,
        now: () => (t += 10),
        makeId: () => `s${++n}`,
    });
}

function run() {
    const defaults = { timeTracker: { day: 1, phase: "day", dayActionUsed: false }, chapterIndex: 0 };
    const root = {
        monopadVolume: 80,
        characters: [["kyoko", { name: "Kyoko", trustLevel: 3 }]],
        truthBullets: [{ title: "Knife" }],
        timeTracker: { day: 4, phase: "night", dayActionUsed: true },
        investigationUnderway: true,
        chapterIndex: 2,
        inventory: { monocoins: 50, customGifts: [{ id: "g1" }] },
        overworld: { version: 3, characters: { kyoko: { locationId: "gym" } } },
    };
    const store = makeStore(root, defaults);

    // Migration wraps existing progress and keeps it live.
    const imported = store.migrateIfNeeded({ mode: SAVE_MODES.SINGLE, groupIds: ["g-1"] });
    assert(imported.name === "Imported Save", "progress is imported");
    assert(store.getActiveId() === "s1" && imported.state === null, "imported save is active with no copy");
    assert(store.migrateIfNeeded() === null, "migration runs once");
    assert(store.findByGroupId("g-1")?.id === "s1", "imported save keeps its chat");

    // A blank save, then switching to it.
    const blank = store.create({ name: "Second Run" });
    assert(blank.mode === SAVE_MODES.MULTI && store.getActiveId() === "s1", "create does not switch");
    assert(store.activate("s2"), "switches");
    assert(root.timeTracker.day === 1 && root.chapterIndex === 0, "blank save starts from defaults");
    assert(root.truthBullets === undefined && root.characters === undefined, "story keys without defaults are cleared");
    assert(root.inventory.monocoins === undefined, "story sub-key cleared");
    assert(root.inventory.customGifts.length === 1, "global custom gifts are untouched");
    assert(root.overworld.version === 3 && root.overworld.characters === undefined, "overworld display config is untouched");
    assert(root.monopadVolume === 80, "preferences are untouched");
    assert(store.get("s1").state.truthBullets[0].title === "Knife", "outgoing save kept its evidence");

    // Changes to the live state belong to the active save.
    root.truthBullets = [{ title: "Note" }];
    root.inventory.monocoins = 7;
    assert(store.activate("s1"), "switches back");
    assert(root.truthBullets[0].title === "Knife" && root.inventory.monocoins === 50, "first save restored");
    assert(root.investigationUnderway === true && root.timeTracker.day === 4, "phase restored");
    assert(store.get("s2").state.truthBullets[0].title === "Note", "second save kept its changes");
    assert(store.activate("s1") === false, "activating the active save is a no-op");

    // Lists show live facts for the active save.
    const listed = store.list();
    assert(listed[0].id === "s1" && listed[0].active, "active save listed first");
    assert(listed[0].summary.truthBulletCount === 1 && listed[0].summary.day === 4, "active summary uses live state");
    assert(listed[1].summary.monocoins === 7, "inactive summary uses stored copy");
    assert(listed.every((s) => s.state === undefined), "lists don't carry state");

    // Rename, duplicate, delete.
    assert(store.rename("s2", "Imported Save"), "rename");
    assert(store.get("s2").name === "Imported Save (2)", "names stay unique");
    const copy = store.duplicate("s1");
    assert(copy.state.truthBullets[0].title === "Knife", "duplicate copies the live state of the active save");
    copy.state.truthBullets[0].title = "changed";
    assert(root.truthBullets[0].title === "Knife", "duplicate is a deep copy");
    assert(store.remove("s1") === false, "can't delete the active save");
    assert(store.remove(copy.id), "delete inactive save");

    // Chat binding.
    assert(store.bindGroup("s2", "g-1"), "bind moves a chat");
    assert(store.findByGroupId("g-1").id === "s2" && !store.get("s1").groupIds.includes("g-1"), "a chat belongs to one save");
    assert(store.findByGroupId("") === null, "no group, no save");

    // Export and import.
    const exported = store.exportSave("s1");
    assert(exported.format === "dangan-save" && exported.state.chapterIndex === 2, "export uses live state");
    const back = store.importSave(JSON.parse(JSON.stringify(exported)));
    assert(back.mode === SAVE_MODES.MULTI && back.groupIds.length === 0, "imports as an unbound slot");
    assert(back.state.inventory.monocoins === 50 && back.state.inventory.customGifts === undefined, "import keeps only story keys");
    let threw = false;
    try { store.importSave({ hello: 1 }); } catch { threw = true; }
    assert(threw, "rejects other files");

    // Fresh install: nothing to import.
    const empty = {};
    const emptyStore = makeStore(empty);
    assert(emptyStore.migrateIfNeeded() === null, "no progress means no save until NEW GAME");
    assert(emptyStore.getActiveId() === "" && emptyStore.list().length === 0, "fresh install has no saves");

    // Evidence and body map pins belong to a save; the map layout doesn't.
    const mapRoot = { chapterIndex: 1, map: { currentLocationId: "gym", storyPins: [{ id: "p1", type: "body" }] }, mapLayout: { pins: [{ id: "r1", type: "room" }] } };
    const mapStore = makeStore(mapRoot);
    mapStore.migrateIfNeeded();
    const second = mapStore.create({ name: "Other" });
    mapStore.activate(second.id);
    assert(mapRoot.map.storyPins === undefined, "a new save starts with no story pins");
    assert(mapRoot.mapLayout.pins[0].id === "r1", "layout stays when switching saves");
    mapRoot.map.storyPins = [{ id: "p2", type: "truth-bullet" }];
    mapStore.activate("s1");
    assert(mapRoot.map.storyPins.map((p) => p.id).join() === "p1", "switching back restores that save's pins");
    mapStore.activate(second.id);
    assert(mapRoot.map.storyPins.map((p) => p.id).join() === "p2", "each save keeps its own pins");

    assert(!hasStoryProgress({}), "empty state has no progress");
    assert(hasStoryProgress({ chapterIndex: 1 }), "chapter counts as progress");
    assert(summarizeState({ characters: [["a", { name: "A" }], ["me", { name: "Me", isPlayer: true }]] }).rosterNames.join() === "A", "summary skips the player");

    console.log("saveStore tests passed");
}

run();
