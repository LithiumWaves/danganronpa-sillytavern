import { buildRoomContextPrompt, fillRoomContextTemplate, resolveRoomLabel } from "./roomContextPrompt.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

function run() {
    const filled = fillRoomContextTemplate("", {
        room: "Dining Hall",
        characters: ["Kyoko Kirigiri", "Byakuya Togami"],
    });
    assert(filled.includes("Dining Hall"), "room placeholder");
    assert(filled.includes("Kyoko Kirigiri, Byakuya Togami"), "character list");

    const empty = fillRoomContextTemplate("At {{room}} with {{characters}}.", { room: "Hall", characters: [] });
    assert(empty === "At Hall with none.", "empty occupants become none");

    const custom = fillRoomContextTemplate("{{characters}} @ {{room}}", { room: "Gym", characters: ["Makoto"] });
    assert(custom === "Makoto @ Gym", "custom template");

    assert(resolveRoomLabel("pin:dining", { label: "Dining Hall" }) === "Dining Hall", "pin label");
    assert(resolveRoomLabel("area:School Building") === "School Building", "area id");
    assert(resolveRoomLabel("subarea:hotel/1f") === "hotel/1f", "subarea id");

    const injected = buildRoomContextPrompt({
        enabled: true,
        trialActive: false,
        locationId: "dining",
        room: "Dining Hall",
        characters: ["Kyoko"],
        template: "",
    });
    assert(injected.includes("Dining Hall"), "injects when on");
    assert(injected.includes("Kyoko"), "injects occupants");

    assert(buildRoomContextPrompt({
        enabled: false,
        trialActive: false,
        locationId: "dining",
        room: "Dining Hall",
        characters: ["Kyoko"],
    }) === "", "clears when toggle off");

    assert(buildRoomContextPrompt({
        enabled: true,
        trialActive: true,
        locationId: "dining",
        room: "Dining Hall",
        characters: ["Kyoko"],
    }) === "", "clears during trial");

    assert(buildRoomContextPrompt({
        enabled: true,
        trialActive: false,
        locationId: "",
        room: "Dining Hall",
        characters: ["Kyoko"],
    }) === "", "clears with no location");

    console.log("roomContextPrompt tests passed");
}

run();
