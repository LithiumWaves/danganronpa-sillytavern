export const extensionName = "danganronpa-extension";

function normalizeWebExtensionPath(pathname = "") {
    const normalized = String(pathname || "").replace(/\\/g, "/");
    const match = normalized.match(/\/(scripts\/extensions(?:\/third-party)?\/[^/]+)/i);
    if (match?.[1]) return match[1].replace(/^\//, "");
    return "";
}

function resolveExtensionFolderPath() {
    const fallbackPaths = [
        `scripts/extensions/third-party/${extensionName}`,
        `scripts/extensions/${extensionName}`,
    ];

    try {
        const moduleUrl = typeof import.meta?.url === "string" ? import.meta.url : "";
        if (moduleUrl) {
            const parsed = new URL(moduleUrl, window.location?.href || undefined);
            const protocol = String(parsed.protocol || "").toLowerCase();
            const normalizedPath = decodeURIComponent(parsed.pathname || "").replace(/\\/g, "/");

            if (protocol === "http:" || protocol === "https:") {
                const scriptRoot = normalizedPath.replace(/\/[^/]*$/, "");
                const extensionRoot = scriptRoot.endsWith("/core") ? scriptRoot.slice(0, -5) : scriptRoot;
                const normalized = normalizeWebExtensionPath(extensionRoot);
                if (normalized) return normalized;
            }

            if (protocol === "file:") {
                const normalized = normalizeWebExtensionPath(normalizedPath);
                if (normalized) return normalized;
            }
        }
    } catch {
        // fall through to script src detection and fallback paths
    }

    try {
        const scriptTags = Array.from(document.querySelectorAll('script[src]'));
        for (const script of scriptTags) {
            const src = String(script.getAttribute('src') || "");
            if (!src.includes(extensionName)) continue;
            const parsedSrc = new URL(src, window.location?.href || undefined);
            const normalized = normalizeWebExtensionPath(parsedSrc.pathname || "");
            if (normalized) return normalized;
        }
    } catch {
        // fallback below
    }

    return fallbackPaths[0];
}

export const extensionFolderPath = resolveExtensionFolderPath();

export const defaultSettings = {
    monopadVolume: 50,
    monopadJingleEnabled: true,
    announcementVolume: 65,
    monokumaLanguage: "JP",
    trustCeremonies: true,
    truthBulletAnimations: true,
    monomonoBgmVolume: 40,
    mapPresencePinsEnabled: true,
    vnModeEnabled: false,
    crtEffects: true,
    crtIntensity: 35,
    bootAnimations: true,
    dynamicThemes: true,
    hideTruthBulletImages: false,
    hideGiftImages: false,
    monopadButtonEnabled: true,
    welcomeSeen: false,
    monokumaLessonRewardClaimed: false,
    debugAccessGranted: false,
    debugControlsHidden: false,
    generationProvider: "main",
    openrouterModel: "google/gemini-2.5-flash",
    openrouterRememberApiKey: false,
    openrouterApiKey: "",
    shopTracks: [],
    daytimeTracks: [],
    nighttimeTracks: [],
    investigationTracks: [],
    trialGeneralTracks: [],
    trialPreparationTracks: [],
    trialDebatesTracks: [],
    trialScrumTracks: [],
    trialPtaTracks: [],
    trialReenactmentTracks: [],
    trialClosingTracks: [],
    trialVotingTracks: [],
    bdaCinematics: [],
    rewardDifficulty: "normal",
    timeTracker: {
        day: 1,
        phase: "day",
        dayActionUsed: false,
    },
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
export const TRIAL_START_REGEX = /V3C\s*[|｜]\s*TRIAL(?:\s*[_\-]?\s*)START\b/gi;
