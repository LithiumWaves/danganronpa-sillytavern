import { applyRoutines, clearRoutine, describeRoutines, getRoutine, mergeSuggestedRoutines, normalizeRoutines, parseRoutineSuggestion, setRoutine } from "./routines.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

function seq(values) {
    let i = 0;
    return () => values[i++ % values.length];
}

function run() {
    let r = setRoutine({}, "Kyoko Kirigiri", { day: ["library", "library"], night: ["dorm"] });
    assert(getRoutine(r, "kyoko kirigiri").day.join() === "library" && getRoutine(r, "Kyoko Kirigiri").night.join() === "dorm", "set and get");
    r = setRoutine(r, "Kyoko Kirigiri", { night: [] });
    assert(getRoutine(r, "Kyoko Kirigiri").day.join() === "library" && !getRoutine(r, "Kyoko Kirigiri").night.length, "partial update");
    assert(!normalizeRoutines(setRoutine(r, "Leon", { day: [] })).leon, "empty rows dropped");
    assert(!clearRoutine(r, "KYOKO KIRIGIRI")["kyoko kirigiri"], "cleared");

    const routines = { "kyoko kirigiri": { day: ["library"], night: ["dorm"] }, "leon kuwata": { day: ["closed"], night: [] } };
    const base = new Map([["kyoko kirigiri", "gym"], ["leon kuwata", "gym"], ["aoi asahina", "gym"]]);
    const rooms = ["gym", "library", "dorm"];
    const hit = applyRoutines(base, { routines, time: "day", spawnableRooms: rooms, rng: seq([0.1, 0]) });
    assert(hit.get("kyoko kirigiri") === "library", "routine room under the weight");
    assert(hit.get("leon kuwata") === "gym", "rooms not on the map are ignored");
    assert(hit.get("aoi asahina") === "gym", "no routine, random pick stands");
    assert(applyRoutines(base, { routines, time: "night", spawnableRooms: rooms, rng: seq([0.1, 0]) }).get("kyoko kirigiri") === "dorm", "night routine");
    assert(applyRoutines(base, { routines, spawnableRooms: rooms, rng: seq([0.9]) }).get("kyoko kirigiri") === "gym", "over the weight, random pick stands");
    assert(applyRoutines(base, { routines, spawnableRooms: rooms, followers: ["Kyoko Kirigiri"], rng: seq([0]) }).get("kyoko kirigiri") === "gym", "followers stay with the player");
    assert(base.get("kyoko kirigiri") === "gym", "input untouched");

    const lines = describeRoutines(routines, { roomLabel: (id) => id.toUpperCase(), names: ["Kyoko Kirigiri"] });
    assert(lines.length === 1 && lines[0] === "- Kyoko Kirigiri: daytime LIBRARY; nighttime DORM", "described");

    const cast = [{ name: "Kyoko Kirigiri" }, { name: "Leon Kuwata" }];
    const roomList = [{ id: "library", label: "Library" }, { id: "gym", label: "Gymnasium" }, { id: "dorm_kyoko", label: "Kyoko's Room" }];
    const parsed = parseRoutineSuggestion({ Kyoko: { day: ["Library", "Nowhere"], night: "kyoko's room" }, "Leon Kuwata": { day: ["gymnasium"] }, Stranger: { day: ["gym"] } }, { cast, rooms: roomList });
    assert(parsed["kyoko kirigiri"].day.join() === "library" && parsed["kyoko kirigiri"].night.join() === "dorm_kyoko", "fuzzy rooms and first names");
    assert(parsed["leon kuwata"].day.join() === "gym" && !parsed.stranger, "unknown people dropped");
    const merged = mergeSuggestedRoutines({ "leon kuwata": { day: ["library"] } }, parsed);
    assert(merged["leon kuwata"].day.join() === "library" && merged["kyoko kirigiri"], "hand-set routines are kept");

    console.log("routines tests passed");
}

run();
