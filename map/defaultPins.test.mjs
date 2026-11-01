import { DEFAULT_NIGHT_CLOSED_PIN_IDS, DEFAULT_PINS, isClosedAtNight } from "./defaultPins.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

function run() {
    const byId = (id) => DEFAULT_PINS.find((p) => p.id === id);
    // Hope's Peak's cafeteria and kitchen close at night by default.
    const closed = DEFAULT_PINS.filter(isClosedAtNight);
    assert(closed.length === 2 && closed.every((p) => p.areaKey === "hopes_peak"), "the Hope's Peak cafeteria and kitchen");
    assert(closed.map((p) => p.locationId).sort().join() === "cafeteria,kitchen", "by location");
    assert([...DEFAULT_NIGHT_CLOSED_PIN_IDS].every((id) => byId(id)), "default ids exist");
    // The island's kitchen shares the locationId but stays open.
    assert(!isClosedAtNight(byId("custom_1774461359241_671zk")), "the island kitchen stays open");
    // A pin's own setting wins, both ways.
    assert(!isClosedAtNight({ ...byId("custom_1774462926901_avgmd"), closedAtNight: false }), "a default can be turned off");
    assert(isClosedAtNight({ id: "x", closedAtNight: true }), "any pin can close");
    assert(!isClosedAtNight(null) && !isClosedAtNight({ id: "x" }), "others are open");
    console.log("defaultPins tests passed");
}

run();
