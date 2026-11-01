import { buildFloorOpenAnnouncement, describeExploreHint, floorsUnlockedBetween, markRoomVisited, normalizeFloorExplore, startExploring } from "./floorExplore.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

const floors = [
    { areaKey: "hp", floorKey: "f2", label: "2F", unlockChapter: 2 },
    { areaKey: "hp", floorKey: "f3", label: "3F", unlockChapter: 3 },
    { areaKey: "hp", floorKey: "f1", label: "1F", unlockChapter: 0 },
];
const pins = [
    { type: "room", locationId: "library", label: "Library", areaKey: "hp", floorKey: "f2" },
    { type: "room", locationId: "pool", label: "Pool", areaKey: "hp", floorKey: "f2" },
    { type: "room", locationId: "pool", label: "Pool again", areaKey: "hp", floorKey: "f2" },
    { type: "room", locationId: "dorm_x", label: "X's Room", areaKey: "hp", floorKey: "f2", _generated: true },
    { type: "trial", locationId: "door", label: "Door", areaKey: "hp", floorKey: "f2" },
    { type: "room", locationId: "art", label: "Art Room", areaKey: "hp", floorKey: "f3" },
];

function run() {
    assert(floorsUnlockedBetween(floors, 1, 2).map((f) => f.floorKey).join() === "f2", "chapter 1 → 2 opens 2F");
    assert(floorsUnlockedBetween(floors, 1, 3).length === 2, "skipping chapters opens both");
    assert(floorsUnlockedBetween(floors, 3, 2).length === 0, "going back opens nothing");

    let { state, added } = startExploring(null, floorsUnlockedBetween(floors, 1, 2), pins);
    assert(added.length === 1 && state.floors[0].rooms.map((r) => r.id).join() === "library,pool", "room pins only, no dorms or doubles");
    assert(startExploring(state, floorsUnlockedBetween(floors, 1, 2), pins).added.length === 0, "a floor isn't added twice");
    assert(describeExploreHint(state) === "EXPLORE 2F (0/2): Library, Pool", "hint");

    let r = markRoomVisited(state, "library");
    assert(r.changed && !r.finished && describeExploreHint(r.state) === "EXPLORE 2F (1/2): Pool", "one visited");
    assert(!markRoomVisited(r.state, "library").changed, "visiting again changes nothing");
    r = markRoomVisited(r.state, "pool");
    assert(r.finished?.floorKey === "f2" && describeExploreHint(r.state) === "", "the floor is done and goes away");
    assert(normalizeFloorExplore({ floors: [{ areaKey: "a" }] }).floors.length === 0, "bad rows dropped");

    const a = buildFloorOpenAnnouncement([{ label: "2F" }, { label: "3F" }]);
    assert(a.includes("2F and 3F are now open"), "announcement");
    assert(buildFloorOpenAnnouncement([]) === "", "nothing to announce");
    console.log("floorExplore tests passed");
}

run();
