import {
    ALL_MONOKUMAS_BONUS,
    DAILY_COINS,
    buildDailyHotspotPrompt,
    buildDailyNarrationPrompt,
    claimSpot,
    clearDailyRoom,
    describeDailyExamine,
    normalizeDailyExamine,
    planHiddenMonokumas,
    seedDailySpots,
    setDailySpots,
    untakenCoins,
} from "./dailyExamine.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

function seq(values) {
    let i = 0;
    return () => values[i++ % values.length];
}

const spots = [{ id: "s1", label: "Bookshelf" }, { id: "s2", label: "Desk" }, { id: "s3", label: "Window" }, { id: "s4", label: "Rug" }];

function run() {
    // A fresh record per chapter.
    const fresh = normalizeDailyExamine(null, 2);
    assert(fresh.chapter === 2 && !Object.keys(fresh.rooms).length && fresh.coinsFound === 0, "fresh record");
    assert(!Object.keys(normalizeDailyExamine({ chapter: 1, rooms: { lib: { spots } } }, 2).rooms).length, "a new chapter starts over");
    assert(normalizeDailyExamine({ chapter: 2, rooms: { lib: { spots } }, coinsFound: 7 }, 2).rooms.lib.spots.length === 4, "same chapter keeps its spots");

    // Coins: one or two spots, 3–10 each.
    const one = seedDailySpots(spots, { rng: seq([0.1, 0.9, 0.2, 0.3, 0.4, 0.5]) });
    const withCoins = one.filter((sp) => sp.coins);
    assert(withCoins.length === 1 && withCoins[0].coins >= DAILY_COINS.min && withCoins[0].coins <= DAILY_COINS.max, "one coin spot");
    const two = seedDailySpots(spots, { rng: seq([0.7, 0.5]) });
    assert(two.filter((sp) => sp.coins).length === 2, "two coin spots");

    // One hidden Monokuma per floor, put in a spot when that room's spots exist.
    let rec = planHiddenMonokumas(fresh, [{ key: "hp/f1", roomIds: ["lib", "gym"] }, { key: "hp/f2", roomIds: ["pool"] }], { rng: seq([0]) });
    assert(rec.monokumas["hp/f1"].roomId === "lib" && rec.monokumas["hp/f2"].roomId === "pool", "one per floor");
    assert(planHiddenMonokumas(rec, [{ key: "hp/f1", roomIds: ["gym"] }]).monokumas["hp/f1"].roomId === "lib", "a floor keeps its Monokuma");
    rec = setDailySpots(rec, "lib", spots, { rng: seq([0.9, 0.1, 0.5, 0.2, 0.3, 0]) });
    const mono = rec.rooms.lib.spots.find((sp) => sp.monokuma);
    assert(mono && rec.monokumas["hp/f1"].spotId === mono.id, "the Monokuma hides in a spot");

    // Claiming: coins once, the Monokuma once.
    const coinSpot = rec.rooms.lib.spots.find((sp) => sp.coins);
    let r = claimSpot(rec, "lib", coinSpot.id);
    assert(r.coins === coinSpot.coins && r.record.coinsFound === coinSpot.coins, "coins found");
    const again = claimSpot(r.record, "lib", coinSpot.id);
    assert(again.coins === 0 && again.record.rooms.lib.spots.find((sp) => sp.id === coinSpot.id).examined, "coins only once");
    r = claimSpot(again.record, "lib", mono.id);
    assert(r.monokuma && r.monokumasFound === 1 && r.monokumasTotal === 2 && !r.allFound, "first of two Monokumas");
    assert(!claimSpot(r.record, "lib", mono.id).monokuma, "a Monokuma is found once");
    let rec2 = setDailySpots(r.record, "pool", spots, { rng: seq([0.1, 0]) });
    const poolMono = rec2.rooms.pool.spots.find((sp) => sp.monokuma);
    const last = claimSpot(rec2, "pool", poolMono.id);
    assert(last.allFound && last.monokumasFound === 2, `all found (bonus ${ALL_MONOKUMAS_BONUS})`);
    assert(claimSpot(rec2, "nowhere", "x").coins === 0, "unknown spot");

    // Resetting a room hides an unfound Monokuma again.
    const cleared = clearDailyRoom(rec2, "pool");
    assert(!cleared.rooms.pool && cleared.monokumas["hp/f2"].spotId === "" && cleared.monokumas["hp/f1"].found, "room reset");

    // Made again: only the coins nobody took come back.
    const hidden = rec.rooms.lib.spots.filter((sp) => sp.coins).length;
    assert(untakenCoins(rec, "lib").length === hidden && untakenCoins(again.record, "lib").length === hidden - 1, "untaken coins");
    const remade = setDailySpots(clearDailyRoom(again.record, "lib"), "lib", spots, { coins: untakenCoins(again.record, "lib") });
    assert(remade.rooms.lib.spots.filter((sp) => sp.coins).length === hidden - 1, "making a room again keeps only the untaken coins");

    // Prompts.
    const spotsPrompt = buildDailyHotspotPrompt({ roomLabel: "Library", owner: { name: "Byakuya" }, previous: ["Desk"] });
    assert(spotsPrompt.includes("ROOM: Library") && spotsPrompt.includes("fit Byakuya") && spotsPrompt.includes("Desk") && !spotsPrompt.includes("EVIDENCE"), "spots prompt");
    const look = buildDailyNarrationPrompt({ label: "Bookshelf" }, { player: "Makoto", roomLabel: "Library", found: { coins: 5, monokuma: true } });
    assert(look.includes("Makoto looks at the Bookshelf in the Library") && look.includes("finds 5 Monocoins") && look.includes("hidden Monokuma") && look.includes("never write Truth Bullets") && !look.includes("{{"), "narration prompt");
    const plain = buildDailyNarrationPrompt({ label: "Rug" }, { player: "Makoto" });
    assert(!plain.includes("Monocoins") && !plain.includes("WHOSE ROOM"), "nothing found, nothing said");
    const custom = buildDailyNarrationPrompt({ label: "Rug" }, { player: "Makoto", found: { coins: 3 }, owner: { name: "Leon" }, template: "Describe {{thing}}." });
    assert(custom.startsWith("Describe the Rug.") && custom.includes("finds 3 Monocoins") && custom.includes("WHOSE ROOM"), "an edited template still gets the finds and the owner");
    assert(describeDailyExamine(rec2).includes("[MONOKUMA]"), "debug listing");

    console.log("dailyExamine tests passed");
}

run();
