import { buildCustomArea, buildMapPayload, emptyCustomMap, toMapPoint, validateCustomMapDetails, validateCustomMapRooms } from "./titleMapSetup.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

function run() {
    const p = toMapPoint(240, 68, 480, 136);
    assert(p.x === 240 && p.y === 136, "scales the click into map space");
    const clamped = toMapPoint(-5, 999, 100, 100);
    assert(clamped.x === 0 && clamped.y === 272, "clamps to the picture");

    const map = emptyCustomMap();
    assert(validateCustomMapDetails(map) !== "", "needs a name");
    map.name = "Shrine";
    assert(validateCustomMapDetails(map).includes("picture"), "needs a picture");
    map.floors[0].image = "data:image/png;base64,AA";
    assert(validateCustomMapDetails(map) === "", "name + pictured floor is enough");
    assert(validateCustomMapRooms(map) !== "", "needs a room");
    map.rooms.push({ label: " ", floorIdx: 0, x: 1, y: 2 });
    assert(validateCustomMapRooms(map).includes("name"), "rooms need names");
    map.rooms[0].label = "Kitchen";
    map.rooms.push({ label: "Kitchen", floorIdx: 0, x: 3, y: 4, icon: "cafeteria.svg" });
    map.startIdx = 1;
    assert(validateCustomMapRooms(map) === "", "named rooms ok");

    const hp = buildMapPayload("hopes_peak");
    assert(hp.areas.join() === "hopes_peak,hotel_despair" && hp.startLocationId === "classroom_1a", "built-in payload");
    assert(buildMapPayload("nope") === null, "unknown choice");

    const payload = buildMapPayload("custom", map);
    assert(payload.custom.name === "Shrine" && payload.custom.rooms.length === 2, "custom payload");
    const built = buildCustomArea(payload.custom, { key: "custom_1", now: 5 });
    assert(built.area.key === "custom_1" && built.area.label === "SHRINE" && built.area.floors[0].key === "floor_1", "area");
    assert(built.pins.map((pin) => pin.locationId).join() === "shrine_kitchen,shrine_kitchen_2", "unique, prefixed room ids");
    assert(built.pins.every((pin) => pin.type === "room" && pin.areaKey === "custom_1"), "room pins on the area");
    assert(built.startLocationId === "shrine_kitchen_2" && built.startFloorKey === "floor_1", "starting room");

    console.log("titleMapSetup tests passed");
}

run();
