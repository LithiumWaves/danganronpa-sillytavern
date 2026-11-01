import { stepTrust, trustDistance, nextTrustDown } from "./trustState.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

assert(stepTrust(4, -3) === 1, "4 down 3 is 1");
assert(stepTrust(2, -3) === -2, "2 down 3 crosses into distrust at -2");
assert(stepTrust(1, -1) === -1, "1 down 1 skips 0");
assert(stepTrust(-9, -5) === -10, "clamped at -10");
assert(stepTrust(-2, 3) === 2, "-2 up 3 is 2");
assert(stepTrust(9, 4) === 10, "clamped at 10");
assert(stepTrust(5, 0) === 5, "no steps");
assert(trustDistance(4, 1) === -3, "4 to 1 is 3 down");
assert(trustDistance(2, -2) === -3, "2 to -2 is 3 down");
assert(trustDistance(-4, 7) === 10, "-4 to 7 is 10 up");
for (let a = -10; a <= 10; a++) {
    if (!a) continue;
    for (let b = -10; b <= 10; b++) {
        if (!b) continue;
        assert(stepTrust(a, trustDistance(a, b)) === b, `stepping ${a} by distance to ${b}`);
    }
}
assert(nextTrustDown(1) === -1, "unchanged single step");
console.log("trustState tests passed");
