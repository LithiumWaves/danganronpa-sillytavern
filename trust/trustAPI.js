import {
    nextTrustUp,
    nextTrustDown,
    clampTrust,
    stepTrust
} from "./trustState.js";

import {
    playTrustRankUp,
    playTrustRankDown,
    playTrustMaxed,
    playTrustToDistrustTransition,
    playDistrustRankDown,
    playDistrustRankUp,
    playDistrustToTrustRecovery,
    playTrustDrop,
    playTrustShatter
} from "./trustAnimations.js";

export function increaseTrust(char) {
    if (!char) return;

    const previous = char.trustLevel ?? 1;
    if (previous >= 10) return;

    char.trustLevel = clampTrust(
        nextTrustUp(previous)
    );

    if (previous === -1 && char.trustLevel === 1) {
        playDistrustToTrustRecovery(char);
    } else if (previous === 9 && char.trustLevel === 10) {
        playTrustMaxed(char);
    } else if (previous < 0) {
        playDistrustRankUp(previous, char.trustLevel, char);
    } else {
        playTrustRankUp(previous, char.trustLevel, char);
    }

    // refresh
    if (window.refreshActiveCharacterUI) {
        window.refreshActiveCharacterUI();
    }
}

// `steps` above 1 is a SOCIAL_DROP: several ranks at once, possibly running
// past Trust 1 into distrust.
export function decreaseTrust(char, { steps = 1 } = {}) {
    if (!char) return;

    const previous = char.trustLevel ?? 1;
    if (previous <= -10) return;

    const n = Math.max(1, Math.trunc(Number(steps) || 1));
    char.trustLevel = n === 1
        ? clampTrust(nextTrustDown(previous))
        : stepTrust(previous, -n);

    if (n > 1) {
        if (previous > 0 && char.trustLevel < 0) playTrustShatter(previous, char.trustLevel, char);
        else playTrustDrop(previous, char.trustLevel, char);
    } else if (previous > 0 && char.trustLevel > 0) {
        playTrustRankDown(previous, char.trustLevel, char);
    } else if (previous === 1 && char.trustLevel === -1) {
        playTrustToDistrustTransition(char);
    } else {
        playDistrustRankDown(previous, char.trustLevel, char);
    }

    // refresh
    if (window.refreshActiveCharacterUI) {
        window.refreshActiveCharacterUI();
    }
}

// SOCIAL_BREAK: trust shatters straight into Distrust `depth` (1–10). Someone
// already in distrust drops `depth` further instead.
export function breakTrust(char, depth = 1) {
    if (!char) return;

    const previous = char.trustLevel ?? 1;
    const d = Math.min(10, Math.max(1, Math.trunc(Number(depth) || 1)));
    char.trustLevel = previous > 0 ? -d : stepTrust(previous, -d);
    if (char.trustLevel === previous) return;

    if (previous > 0) playTrustShatter(previous, char.trustLevel, char);
    else playTrustDrop(previous, char.trustLevel, char);

    if (window.refreshActiveCharacterUI) {
        window.refreshActiveCharacterUI();
    }
}
