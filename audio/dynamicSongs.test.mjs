import { formatMoodScanToast } from "./dynamicSongs.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

function run() {
    const mood = formatMoodScanToast(
        { winner: "happy", counts: { happy: 3, tense: 1 }, settingKey: "happyTracks", fallback: false },
        { happyTracks: "HAPPY", daytimeTracks: "DAYTIME" },
    );
    assert(mood.includes("HAPPY ×3"), "happy vote");
    assert(mood.includes("TENSE ×1"), "tense vote");
    assert(mood.includes("Playing HAPPY"), "playing winner");

    const none = formatMoodScanToast(
        { winner: null, counts: {}, settingKey: "daytimeTracks", fallback: true },
        { daytimeTracks: "DAYTIME" },
    );
    assert(none === "No mood · Playing DAYTIME", "no-mood phase fallback");

    const votesButFallback = formatMoodScanToast(
        { winner: null, counts: { happy: 2 }, settingKey: "nighttimeTracks", fallback: true },
        { nighttimeTracks: "NIGHTTIME" },
    );
    assert(votesButFallback.includes("HAPPY ×2"), "votes even on fallback");
    assert(votesButFallback.includes("Playing NIGHTTIME"), "plays phase when fallback");

    console.log("dynamicSongs toast tests passed");
}

run();
