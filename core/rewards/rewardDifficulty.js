export function createRewardDifficultyManager({ REWARD_PROFILES, MONOCOIN_REWARDS, XP_REWARDS }) {
    function clampRewardDifficulty(value) {
        return Object.prototype.hasOwnProperty.call(REWARD_PROFILES, value) ? value : "normal";
    }

    function applyRewardDifficultyProfile(profileKey) {
        const safeProfileKey = clampRewardDifficulty(profileKey);
        const profile = REWARD_PROFILES[safeProfileKey] || REWARD_PROFILES.normal;

        Object.assign(MONOCOIN_REWARDS, profile.monocoins || REWARD_PROFILES.normal.monocoins);
        Object.assign(XP_REWARDS, profile.xp || REWARD_PROFILES.normal.xp);

        return safeProfileKey;
    }

    return {
        applyRewardDifficultyProfile,
    };
}
