export const extensionName = "danganronpa-extension";
export const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

export const defaultSettings = {
    monopadSounds: true,
    trustCeremonies: true,
    truthBulletAnimations: true,
    monochineTrackEnabled: true,
    crtEffects: true,
    crtIntensity: 35,
    bootAnimations: true,
    welcomeSeen: false,
    monokumaLessonRewardClaimed: false,
    debugAccessGranted: false,
    generationProvider: "main",
    openrouterModel: "google/gemini-2.5-flash",
    openrouterRememberApiKey: false,
    openrouterApiKey: ""
};

export const MONOCOIN_REWARDS = {
    truthBullet: 5,
    socialRankUp: 10,
    trustMaxed: 50,
};

export const XP_REWARDS = {
    truthBullet: 8,
    socialRankUp: 10,
    trustMaxed: 25,
    giftGiven: 5,
};

export const SOCIAL_REGEX = /V3C\|\s*SOCIAL:\s*([^\n\r]+)/g;
export const SOCIAL_UP_REGEX = /V3C\|\s*SOCIAL_UP:\s*([^\n\r]+)/g;
export const SOCIAL_DOWN_REGEX = /V3C\|\s*SOCIAL_DOWN:\s*([^\n\r]+)/g;
