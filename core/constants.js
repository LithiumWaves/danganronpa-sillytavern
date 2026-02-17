export const extensionName = "danganronpa-extension";
export const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

export const defaultSettings = {
    monopadSounds: true,
    trustCeremonies: true,
    truthBulletAnimations: true,
    monochineTrackEnabled: true,
    mapPresencePinsEnabled: true,
    crtEffects: true,
    crtIntensity: 35,
    bootAnimations: true,
    welcomeSeen: false,
    monokumaLessonRewardClaimed: false,
    debugAccessGranted: false,
    debugControlsHidden: false,
    generationProvider: "main",
    openrouterModel: "google/gemini-2.5-flash",
    openrouterRememberApiKey: false,
    openrouterApiKey: "",
    rewardDifficulty: "normal",
};

export const REWARD_DIFFICULTY_LABELS = {
    easy: "EASY",
    normal: "NORMAL",
    hard: "HARD",
};

export const REWARD_PROFILES = {
    easy: {
        monocoins: {
            truthBullet: 5,
            socialRankUp: 8,
            trustMaxed: 30,
            tutorialCompletion: 40,
        },
        xp: {
            truthBullet: 7,
            socialRankUp: 8,
            trustMaxed: 16,
            giftGiven: 4,
            walkStep: 1,
        },
    },
    normal: {
        monocoins: {
            truthBullet: 3,
            socialRankUp: 5,
            trustMaxed: 18,
            tutorialCompletion: 24,
        },
        xp: {
            truthBullet: 5,
            socialRankUp: 6,
            trustMaxed: 12,
            giftGiven: 3,
            walkStep: 1,
        },
    },
    hard: {
        monocoins: {
            truthBullet: 2,
            socialRankUp: 3,
            trustMaxed: 12,
            tutorialCompletion: 14,
        },
        xp: {
            truthBullet: 3,
            socialRankUp: 4,
            trustMaxed: 8,
            giftGiven: 2,
            walkStep: 1,
        },
    },
};

export const MONOCOIN_REWARDS = {
    ...REWARD_PROFILES.normal.monocoins,
};

export const XP_REWARDS = {
    ...REWARD_PROFILES.normal.xp,
};

export const SOCIAL_REGEX = /V3C\|\s*SOCIAL:\s*([^\n\r]+)/g;
export const SOCIAL_UP_REGEX = /V3C\|\s*SOCIAL_UP:\s*([^\n\r]+)/g;
export const SOCIAL_DOWN_REGEX = /V3C\|\s*SOCIAL_DOWN:\s*([^\n\r]+)/g;
export const INVESTIGATION_START_REGEX = /V3C\s*[|｜]\s*INVESTIGATION(?:\s*[_\-]?\s*)START\b/gi;
