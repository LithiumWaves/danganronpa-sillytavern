export function createRewardDifficultyManager({ rewardProfiles, monocoins, xp }) {
    function clampRewardDifficulty(value) {
        return Object.prototype.hasOwnProperty.call(rewardProfiles, value) ? value : "normal";
    }

    function applyRewardDifficultyProfile(profileKey) {
        const safeProfileKey = clampRewardDifficulty(profileKey);
        const profile = rewardProfiles[safeProfileKey] || rewardProfiles.normal;

        Object.assign(monocoins, profile.monocoins || rewardProfiles.normal.monocoins);
        Object.assign(xp, profile.xp || rewardProfiles.normal.xp);

        return safeProfileKey;
    }

    return {
        clampRewardDifficulty,
        applyRewardDifficultyProfile,
    };
}
