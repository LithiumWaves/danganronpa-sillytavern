import { entryTitle, sortedEntries, splitKeys } from "./titleLorebook.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

function run() {
    assert(JSON.stringify(splitKeys(" Kyoko,  Ultimate Detective ,,")) === '["Kyoko","Ultimate Detective"]', "keywords are trimmed and empties dropped");
    assert(splitKeys("").length === 0, "no keywords");

    assert(entryTitle({ comment: " Kyoko ", key: ["k"] }) === "Kyoko", "memo is the title");
    assert(entryTitle({ comment: "", key: ["Makoto"] }) === "Makoto", "first keyword when there's no memo");
    assert(entryTitle({}) === "Untitled entry", "fallback title");

    const order = sortedEntries({ entries: { 0: { uid: 0, order: 100 }, 1: { uid: 1, order: 300 }, 2: { uid: 2, order: 100 } } }).map((e) => e.uid);
    assert(order.join(",") === "1,0,2", "higher order first, then uid");
    assert(sortedEntries(null).length === 0, "no data");

    console.log("titleLorebook tests passed");
}

run();
