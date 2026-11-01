import { BLOOD_PINK, TIMELINE, floodShape, makeSplat, planSplats, seededRng } from "./bloodSplash.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

const PATH = /^M[-\d. ]+(?:[LQaZ][-\d. ]*)+Z$/;

function run() {
    // A splat is a set of closed paths, and the same seed draws the same one.
    const a = makeSplat(seededRng(42));
    const b = makeSplat(seededRng(42));
    assert(a.join("|") === b.join("|"), "deterministic for a seed");
    assert(a.join("|") !== makeSplat(seededRng(43)).join("|"), "a different seed, a different splat");
    assert(a.length > 10 && a.every((p) => PATH.test(p)), "closed SVG paths");
    assert(!a.some((p) => /NaN|undefined/.test(p)), "no bad numbers");

    // The splats land in the reference's windows: a few first, then the burst.
    const plan = planSplats(seededRng(7));
    const first = plan.filter((s) => s.at < TIMELINE.burst);
    const burst = plan.filter((s) => s.at >= TIMELINE.burst);
    assert(first.length >= 3 && first.length <= 5 && first.every((s) => s.at >= TIMELINE.firstSplats), "a few first splats");
    assert(burst.length > 40 && burst.every((s) => s.at <= TIMELINE.burstEnd), "the burst, within its window");
    assert(plan.every((s, i) => i === 0 || plan[i - 1].at <= s.at), "in time order");
    assert(plan.filter((s) => s.size >= 2).length === 3, "three big splats");
    assert(plan.every((s) => s.x >= 0 && s.x <= 1600 && s.y >= 0 && s.y <= 900), "inside the picture");

    // The flood: a body above its edge, and splats along and ahead of it.
    const flood = floodShape(seededRng(3));
    assert(PATH.test(flood.body) && flood.body.startsWith("M0 -1400"), "the flood's body");
    assert(flood.splats.length > 20 && flood.splats.every((s) => s.paths.length && s.y > -100), "its ragged front");

    // The beats are in the reference's order.
    const order = ["flash1", "flash1End", "flash2", "flash2End", "firstSplats", "burst", "burstEnd", "flood", "floodEnd", "toWhite", "white", "choices"];
    assert(order.every((k, i) => i === 0 || TIMELINE[order[i - 1]] < TIMELINE[k]), "timeline order");
    assert(BLOOD_PINK === "#fc50bb", "the game's pink");
    console.log("bloodSplash tests passed");
}

run();
