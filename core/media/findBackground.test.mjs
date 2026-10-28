import { pickBackgroundFile } from "./findBackground.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

const files = ["hotel_kitchen.png", "kitchen.png", "hotel_library.jpg", "Library.jpg", "gym_night.png", "gym.png"];
assert(pickBackgroundFile(files, "kitchen") === "kitchen.png", "kitchen is not hotel_kitchen");
assert(pickBackgroundFile(files, "kitchen.png") === "kitchen.png", "exact file");
assert(pickBackgroundFile(files, "library") === "Library.jpg", "case-insensitive stem");
assert(pickBackgroundFile(files, "hotel_kitchen") === "hotel_kitchen.png", "longer name still found");
assert(pickBackgroundFile(files, "gym") === "gym.png", "gym is not gym_night");
assert(pickBackgroundFile(files, "gym_n") === "gym_night.png", "prefix match");
assert(pickBackgroundFile(files, "night") === "gym_night.png", "partial match as a last resort");
assert(pickBackgroundFile(files, "pool") === null, "no match");
assert(pickBackgroundFile(files, "") === null, "empty name");
console.log("findBackground: ok");
