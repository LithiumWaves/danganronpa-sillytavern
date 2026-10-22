import { isStoryPin, listCustomFloors, mergePins, migrateLegacyMapStorage, resolveFloorImageSrc, splitPins } from "./mapStorage.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

function fakeStorage(values) {
    return { getItem: (key) => (key in values ? JSON.stringify(values[key]) : null) };
}

function run() {
    const defaults = [{ id: "d1", type: "room", x: 1 }, { id: "d2", type: "room", x: 2 }];
    assert(isStoryPin({ type: "body" }) && isStoryPin({ type: "truth-bullet" }) && !isStoryPin({ type: "room" }), "story pin types");

    const merged = mergePins({
        layoutPins: [{ id: "d2", type: "room", x: 9 }, { id: "c1", type: "monomachine" }],
        storyPins: [{ id: "e1", type: "truth-bullet" }],
        deletedDefaultPins: ["d1"],
        defaults,
    });
    assert(merged.map((p) => p.id).join() === "d2,c1,e1", "deleted defaults stay gone; edited defaults use the stored copy");
    assert(merged.find((p) => p.id === "d2").x === 9 && !merged.find((p) => p.id === "d2")._default, "edited default wins");

    const fresh = mergePins({ defaults });
    assert(fresh.length === 2 && fresh.every((p) => p._default), "untouched defaults are tagged");
    fresh[0].x = 100;
    assert(defaults[0].x === 1, "defaults are copied, not shared");

    const isUnchangedDefault = (pin) => {
        const def = defaults.find((d) => d.id === pin.id);
        return !!def && def.x === pin.x;
    };
    const working = [
        { id: "d2", type: "room", x: 2, _default: true },
        { id: "c1", type: "room" },
        { id: "e1", type: "body", _default: true },
        { id: "e2", type: "truth-bullet", locationId: "knife" },
    ];
    const split = splitPins(working, { defaults, isUnchangedDefault });
    assert(split.layoutPins.map((p) => p.id).join() === "c1", "untouched defaults aren't stored; story pins go elsewhere");
    assert(split.storyPins.map((p) => p.id).join() === "e1,e2", "story pins split out");
    assert(split.storyPins.every((p) => !("_default" in p)), "runtime flags are stripped");
    assert(split.deletedDefaultPins.join() === "d1", "missing defaults are tombstoned");

    const root = { map: { storyPins: [{ id: "e9", type: "body" }] } };
    const storage = fakeStorage({
        dangan_map_custom_pins_v1: [{ id: "c1", type: "room" }, { id: "e1", type: "truth-bullet" }, { id: "e9", type: "body" }],
        dangan_map_deleted_default_pins_v1: ["d1"],
        dangan_map_custom_areas_v1: [{ key: "custom_1", floors: [{ key: "f", image: "data:image/png;base64,AA" }] }],
        dangan_map_area_overrides_v1: { hopes_peak: { extraFloors: [{ key: "x", image: "/user/images/a.png" }] } },
    });
    assert(migrateLegacyMapStorage(root, storage) === true, "migrates once");
    assert(root.mapLayout.pins.map((p) => p.id).join() === "c1", "layout pins move to the settings");
    assert(root.mapLayout.deletedDefaultPins.join() === "d1" && root.mapLayout.customAreas.length === 1, "tombstones and areas move");
    assert(root.map.storyPins.map((p) => p.id).join() === "e9,e1", "story pins join the active save without duplicates");
    assert(migrateLegacyMapStorage(root, storage) === false, "does not run twice");

    const empty = {};
    migrateLegacyMapStorage(empty, fakeStorage({}));
    assert(empty.mapLayout.pins.length === 0 && empty.map === undefined, "nothing stored means an empty layout");

    assert(listCustomFloors(root.mapLayout).length === 2, "lists custom and extra floors");
    assert(resolveFloorImageSrc("maps/floor1.png", "ext") === "ext/assets/maps/floor1.png", "asset paths");
    assert(resolveFloorImageSrc("/user/images/danganronpa/f.png", "ext") === "/user/images/danganronpa/f.png", "uploaded paths");
    assert(resolveFloorImageSrc("data:image/png;base64,AA", "ext").startsWith("data:"), "data URLs");
    assert(resolveFloorImageSrc("", "ext") === "", "no image");

    console.log("mapStorage tests passed");
}

run();
