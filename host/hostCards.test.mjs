import { isAutoHostSetting, isHostName, readHostSetting, resolveHostNames } from "./hostCards.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

function run() {
    assert(isAutoHostSetting(undefined) && isAutoHostSetting([]) && isAutoHostSetting(["", "  "]), "nothing picked means Auto");
    assert(resolveHostNames([]).join() === "Monokuma", "Auto is Monokuma");
    assert(resolveHostNames([], ["Makoto", "MONOKUMA"]).join() === "MONOKUMA", "Auto uses the card's own spelling");
    assert(resolveHostNames([], ["Makoto"]).length === 0, "Auto with no Monokuma card picks nobody");

    assert(readHostSetting(["Monomi", " monomi ", "Monotaro"]).join() === "Monomi,Monotaro", "picks are trimmed and deduped");
    assert(resolveHostNames(["Monomi", "Monotaro"]).join() === "Monomi,Monotaro", "a list replaces Auto");
    assert(resolveHostNames(["Monomi", "Gone"], ["Monomi", "Monokuma"]).join() === "Monomi", "picks whose card is gone are dropped");

    assert(isHostName("monokuma", ["Monokuma"]) && isHostName("Mono  Kid", ["mono kid"]), "names match loosely");
    assert(!isHostName("Makoto", ["Monokuma"]) && !isHostName("", ["Monokuma"]), "other names don't");

    console.log("hostCards tests passed");
}

run();
