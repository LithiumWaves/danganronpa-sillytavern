export function clampTrust(value) {
    if (value > 10) return 10;
    if (value < -10) return -10;
    return value;
}

export function nextTrustUp(current) {
    if (current < 0) {
        const next = current + 1;
        return next === 0 ? 1 : next;
    }
    return current + 1;
}

export function nextTrustDown(current) {
    if (current > 0) {
        const next = current - 1;
        return next === 0 ? -1 : next;
    }
    return current - 1;
}

// Moves `steps` ranks up (positive) or down (negative), skipping 0, within
// −10…10.
export function stepTrust(current, steps) {
    let level = current;
    const n = Math.trunc(Math.abs(Number(steps) || 0));
    for (let i = 0; i < n; i++) {
        level = clampTrust(steps > 0 ? nextTrustUp(level) : nextTrustDown(level));
    }
    return level;
}

// How many ranks apart two levels are (0 isn't a rank).
export function trustDistance(from, to) {
    const rank = (v) => (v > 0 ? v - 1 : v);
    return rank(to) - rank(from);
}
