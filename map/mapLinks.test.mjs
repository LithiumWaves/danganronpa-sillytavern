import { DEFAULT_HUB_PIN_IDS, DEFAULT_PINS } from "./defaultPins.js";
import { INN_DORM_SLOTS, assignDormSlots, findDormCorridor, buildDormPins, describeFloorExit, diffDormEdits, findFloorHub, findRedundantDefaultHubs, getAutoLinkedPins } from "./mapLinks.js";
import { mergePins, splitPins } from "./mapStorage.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

const ids = (pins) => pins.map((p) => p.locationId).sort().join();

function run() {
    const pins = mergePins({ defaults: DEFAULT_PINS });
    const byId = (areaKey, floorKey, locationId) => pins.find((p) => p.areaKey === areaKey && p.floorKey === floorKey && p.locationId === locationId);

    // Inn Floor 1: the Door is the hub.
    const door = byId("hopes_peak", "inn_floor_1", "door_to_hopes_peak_academy");
    assert(findFloorHub(pins, "hopes_peak", "inn_floor_1") === door, "the Door is Inn Floor 1's hub");
    const cafeteria = byId("hopes_peak", "inn_floor_1", "cafeteria");
    assert(ids(getAutoLinkedPins(cafeteria, pins)) === "door_to_hopes_peak_academy,kitchen", "a room links to its hub and the rooms behind it");
    const fromDoor = getAutoLinkedPins(door, pins).map((p) => p.locationId);
    for (const id of ["cafeteria", "changing_room", "laundry_room", "dorm_hallway", "inn_1f_to_2f", "1f_to_inn"]) {
        assert(fromDoor.includes(id), `the Door links to ${id}`);
    }
    assert(!fromDoor.includes("corridor_f1"), "the Door doesn't link to another floor's corridor");
    for (const id of ["sauna", "steam_room", "kitchen", "incinerator"]) {
        assert(!fromDoor.includes(id), `${id} is reached through another room, not from the Door`);
    }

    // Rooms behind rooms follow the doorways on the map pictures.
    const sauna = byId("hopes_peak", "inn_floor_1", "sauna");
    assert(ids(getAutoLinkedPins(sauna, pins)) === "changing_room,steam_room", "the Sauna opens onto the Changing Room and the Steam Room");
    assert(ids(getAutoLinkedPins(byId("hopes_peak", "inn_floor_1", "steam_room"), pins)) === "sauna", "the Steam Room is only off the Sauna");
    assert(ids(getAutoLinkedPins(byId("hopes_peak", "inn_floor_1", "incinerator"), pins)) === "trash_room", "the Incinerator is inside the Trash Room");
    assert(ids(getAutoLinkedPins(byId("hopes_peak", "floor_2", "pool"), pins)) === "boys_changing_rooms,girls_changing_rooms", "the Pool is through either changing room");
    assert(ids(getAutoLinkedPins(byId("hopes_peak", "floor_2", "girls_changing_rooms"), pins)) === "pool,pool_lounge", "a changing room sits between the lounge and the pool");
    assert(ids(getAutoLinkedPins(byId("hopes_peak", "floor_2", "pool_lounge"), pins)) === "boys_changing_rooms,corridor_f2,girls_changing_rooms", "the lounge opens onto the corridor and both changing rooms");
    assert(ids(getAutoLinkedPins(byId("hopes_peak", "floor_1", "gym"), pins)) === "trophy_room", "the Gym is through the Trophy Room");
    assert(ids(getAutoLinkedPins(byId("hopes_peak", "floor_3", "gallery_storeroom"), pins)) === "gallery", "the gallery storeroom is off the Gallery");
    // A pin's own hubId wins over the built-in route.
    const ownRoute = { ...sauna, hubId: ["door_to_hopes_peak_academy"] };
    assert(ids(getAutoLinkedPins(ownRoute, pins.map((p) => (p === sauna ? ownRoute : p)))) === "door_to_hopes_peak_academy,steam_room", "hubId overrides the built-in route");

    // Academy floors get their corridor; stairs pair up.
    const corridor1 = byId("hopes_peak", "floor_1", "corridor_f1");
    assert(findFloorHub(pins, "hopes_peak", "floor_1") === corridor1, "Corridor F1 is Floor 1's hub");
    const stairs1 = byId("hopes_peak", "floor_1", "1f_to_2f");
    assert(ids(getAutoLinkedPins(stairs1, pins)) === "2f_to_1f,corridor_f1", "1F to 2F links to its corridor and 2F to 1F");
    const innStairs = byId("hopes_peak", "inn_floor_1", "inn_1f_to_2f");
    assert(ids(getAutoLinkedPins(innStairs, pins)) === "door_to_hopes_peak_academy", "the Inn's stairs have no partner");
    assert(getAutoLinkedPins(byId("hopes_peak", "floor_1", "school_store"), pins).length === 0, "Monomachines aren't auto-linked");

    // Opting out.
    const lonely = { ...cafeteria, autoConnect: false };
    const withLonely = pins.map((p) => (p === cafeteria ? lonely : p));
    assert(getAutoLinkedPins(lonely, withLonely).length === 0, "autoConnect: false gets no links");
    assert(!getAutoLinkedPins(door, withLonely).includes(lonely), "nor do others link to it");

    // A player's own corridor replaces the default one, without a tombstone.
    const own = { id: "custom_1", type: "room", label: "Corridor F1", locationId: "corridor_f1", areaKey: "hopes_peak", floorKey: "floor_1", x: 1, y: 1 };
    const withOwn = mergePins({ layoutPins: [own], defaults: DEFAULT_PINS });
    const redundant = findRedundantDefaultHubs(withOwn, DEFAULT_HUB_PIN_IDS);
    assert(redundant.has("default_hub_corridor_f1") && redundant.size === 1, "only the clashing default corridor steps aside");
    const kept = withOwn.filter((p) => !redundant.has(p.id));
    const { deletedDefaultPins } = splitPins(kept, { defaults: DEFAULT_PINS.filter((d) => !redundant.has(d.id)), isUnchangedDefault: (p) => !!p._default });
    assert(deletedDefaultPins.length === 0, "no tombstone for a corridor that stepped aside");
    assert(findRedundantDefaultHubs(pins, DEFAULT_HUB_PIN_IDS).size === 0, "defaults alone keep every corridor");

    // Dorm rooms.
    const residents = [{ key: "__player", name: "Makoto" }, { key: "kyoko", name: "Kyoko" }, { key: "byakuya", name: "Byakuya" }];
    const first = assignDormSlots({}, residents);
    assert(first.rooms.__player.slot === 0 && first.rooms.kyoko.slot === 1 && first.rooms.byakuya.slot === 2, "the player first, then the roster");
    const again = assignDormSlots(first.rooms, [residents[0], residents[2], { key: "aoi", name: "Aoi" }]);
    assert(again.rooms.byakuya.slot === 2 && again.rooms.aoi.slot === 1, "rooms stay put; newcomers take a free one");
    const crowd = Array.from({ length: INN_DORM_SLOTS.length + 1 }, (_, i) => ({ key: `c${i}`, name: `C${i}` }));
    const full = assignDormSlots({}, crowd);
    assert(Object.keys(full.rooms).length === INN_DORM_SLOTS.length && full.homeless.length === 1 && full.homeless[0].key === `c${INN_DORM_SLOTS.length}`, "past 15, nobody gets a room");

    const dormPins = buildDormPins(first.rooms, residents);
    assert(dormPins[0].label === "Makoto's Room" && dormPins[0].locationId === "dorm_player" && dormPins.every((p) => p._generated), "dorm pins are built");
    const inn = [...pins, ...dormPins];
    const hallway = byId("hopes_peak", "inn_floor_1", "dorm_hallway");
    assert(ids(getAutoLinkedPins(dormPins[1], inn)) === "dorm_hallway", "a dorm room links to the Dorm Hallway");
    const fromHall = getAutoLinkedPins(hallway, inn).map((p) => p.locationId);
    assert(fromHall.includes("door_to_hopes_peak_academy") && dormPins.every((p) => fromHall.includes(p.locationId)), "the Dorm Hallway links to the Door and every dorm room");
    assert(!getAutoLinkedPins(door, inn).some((p) => p._generated), "dorm rooms hang off the hallway, not the Door");

    // A hand-made Dorm Corridor (the built-in one steps aside for it).
    const handMade = { id: "c1", type: "room", label: "Dorm Corridor", locationId: "dorm_corridor", areaKey: "hopes_peak", floorKey: "inn_floor_1", x: 300, y: 137 };
    const withHandMade = [...pins.filter((p) => p !== hallway), handMade, ...dormPins];
    assert(findRedundantDefaultHubs([...pins, handMade], DEFAULT_HUB_PIN_IDS).has("default_hub_dorm_hallway"), "the built-in corridor steps aside for a hand-made one");
    assert(ids(getAutoLinkedPins(dormPins[1], withHandMade)) === "dorm_corridor", "dorm rooms open onto a hand-made dorm_corridor");
    const fromHandMade = getAutoLinkedPins(handMade, withHandMade).map((p) => p.locationId);
    assert(fromHandMade.includes("door_to_hopes_peak_academy") && dormPins.every((p) => fromHandMade.includes(p.locationId)), "the corridor links to the Door and every dorm room");
    assert(!getAutoLinkedPins(door, withHandMade).some((p) => p._generated), "the Door never opens straight onto a dorm room");
    const wing = { ...handMade, label: "Dorm Wing Hallway", locationId: "wing" };
    assert(ids(getAutoLinkedPins(dormPins[1], [...pins.filter((p) => p !== hallway), wing, ...dormPins])) === "wing", "a corridor with another name still works");
    assert(findDormCorridor(pins.filter((p) => p !== hallway)) === null, "no corridor left on the floor");
    const redirected = { ...dormPins[1], hubId: "laundry_room" };
    assert(ids(getAutoLinkedPins(redirected, [...inn.filter((p) => p !== dormPins[1]), redirected])) === "laundry_room", "a hubId edit still wins");

    const edits = diffDormEdits({ ...dormPins[1], label: "Detective's Room", x: 5 }, residents[1], 1);
    assert(edits.label === "Detective's Room" && edits.x === 5 && Object.keys(edits).length === 2, "only changed fields are kept");
    assert(buildDormPins({ kyoko: { slot: 1, edits } }, [residents[1]])[0].label === "Detective's Room", "edits are laid over");

    const split = splitPins([...pins, ...dormPins].filter((p) => !p._generated), { defaults: DEFAULT_PINS, isUnchangedDefault: (p) => !!p._default });
    assert(!split.layoutPins.some((p) => p._generated), "generated pins never reach the layout");

    // Floor exits read as where they lead.
    const areas = {
        hopes_peak: { label: "HOPE'S PEAK ACADEMY", floors: [{ key: "floor_1", label: "FLOOR 1" }, { key: "floor_2", label: "FLOOR 2" }, { key: "inn_floor_1", label: "INN FLOOR 1" }] },
        jabberwock_island: { label: "JABBERWOCK ISLAND", floors: [{ key: "floor_1", label: "OLD STOREHOUSE" }, { key: "pier_cottages", label: "PIER COTTAGES" }] },
    };
    const stairs2 = byId("hopes_peak", "floor_2", "2f_to_1f");
    const up = describeFloorExit(stairs1, stairs2, areas);
    assert(up?.direction === "up" && up.text === "FLOOR 2", "1F to 2F goes up to FLOOR 2");
    assert(describeFloorExit(stairs2, stairs1, areas)?.direction === "down", "2F to 1F goes down");
    const toInn = byId("hopes_peak", "floor_1", "1f_to_inn");
    const innDoor = describeFloorExit(toInn, door, areas);
    assert(innDoor?.direction === "door" && innDoor.text === "HOPE'S PEAK ACADEMY · INN FLOOR 1", "the academy's Inn exit is a door to the Inn");
    assert(describeFloorExit(door, toInn, areas)?.text === "HOPE'S PEAK ACADEMY · FLOOR 1", "the Inn's Door leads to the academy's Floor 1");
    assert(describeFloorExit(stairs1, corridor1, areas) === null, "same floor isn't a floor exit");
    const islandExit = describeFloorExit(
        { areaKey: "jabberwock_island", floorKey: "floor_1" },
        { areaKey: "jabberwock_island", floorKey: "pier_cottages" }, areas);
    assert(islandExit?.direction === "door" && islandExit.text === "JABBERWOCK ISLAND · PIER COTTAGES", "unnumbered floors are doors");

    console.log("mapLinks tests passed");
}

run();
