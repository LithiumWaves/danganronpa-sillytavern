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
    minigameTutorialsEnabled: true,
    whiteNoiseLineSource: "main",
    nsdLineSource: "main",
    mpdLineSource: "main",
    whiteNoisePromptTemplate: "",
    nsdPromptTemplate: "",
    mpdPromptTemplate: "",
    talentImagesForAnalysis: false,
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
    trialPanicTracks: [],
    trialScrumTracks: [],
    trialHangmanTracks: [],
    trialRebuttalTracks: [],
    trialMindMineTracks: [],
    trialInterjectionTracks: [],
    trialSuspectChoiceTracks: [],
    aaPhase1Tracks: [],
    aaPhase2Tracks: [],
    aaPhase3Tracks: [],
    // legacy keys kept for backward compat
    trialAaTracks: [],
    trialReenactmentTracks: [],
    trialClosingTracks: [],
    trialVotingTracks: [],
    bdaCinematics: [],
    chapterIndex: 0,
    chapterJournal: {},
    rewardDifficulty: "normal",
    timeTracker: {
        day: 1,
        phase: "day",
        dayActionUsed: false,
    },
};

export const DEFAULT_TRIAL_PROMPT_TEMPLATES = {
    nsd: `You are {{speakerName}}.

Write the next spoken line for a Danganronpa-style Non-stop Debate.

Rules:
- Stay fully in character.
- Output ONLY spoken dialogue in double quotes.
- No narration, no actions, no inner thoughts.
- 1-2 sentences.
- Use facts and implications from the context.
- Your line should respond naturally to what others have said so far.
- Inside the quotes, you MUST mark EXACTLY ONE weak point (a contradiction or key claim) using [[WEAK POINT]] format.
- Example: "The [[locked door]] proves that the killer must still be inside this very room!"
- The weak point should be short: 1-3 words.
- No other markup and no speaker labels.

MARKER: {{debateMarker}}

CHARACTER DATA:
{{sourceText}}

DEBATE SO FAR (most recent lines):
{{debateSoFarText}}

RECENT CONTEXT:
{{contextLines}}

SECTION: {{sectionNumber}} / {{sectionsCount}}`,
    whiteNoise: `You are generating background crowd noise for a Danganronpa-style class trial.
The following statement was just made:
"{{statement}}"

Write exactly 4 short, raw reactions from {{nameList}} watching the debate.
Rules:
- Each reaction is 2-7 words. No names, no punctuation beyond ! ? ... or -
- Make them varied: shocked, dismissive, panicked, muttering, angry, etc.
- Output EXACTLY 4 lines, one reaction per line. Nothing else.`,
    mpd: `You are scripting a Danganronpa-style Mass Panic Debate. Three students shout over each other simultaneously - one of them lets slip the weak point that drives the debate.

SCENARIO {{scenarioNumber}} / {{scenarioCount}}

SPEAKERS (left -> right column order):
{{speakerList}}

Rules:
- Output EXACTLY 3 lines, one per column in order, no labels, no numbering, no blank lines.
- Each line is a single spoken sentence (6-18 words), in double quotes.
- Stay in character for each speaker. Lines should feel like they're being shouted simultaneously - overlapping accusations, panic, deflection.
- Column {{weakColumnNumber}}'s line is the WEAK POINT. Wrap its FULL sentence (inside the quotes) in [[double brackets]]. Example: "[[The locked door proves the killer is still in this room!]]"
- The other two lines must NOT contain [[...]] markers.
- No narration, no actions, no inner thoughts, no speaker labels.

DEBATE SO FAR (most recent lines):
{{debateSoFarText}}

RECENT CHAT CONTEXT:
{{contextLines}}`,
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
            questionTime: 5,
            questionTruth: 7,
            hangmansGambit: 10,
            argumentArmament: 12,
            nonStopDebate: 10,
            massPanicDebate: 12,
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
            questionTime: 8,
            questionTruth: 10,
            hangmansGambit: 15,
            argumentArmament: 18,
            nonStopDebate: 15,
            massPanicDebate: 18,
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
            questionTime: 12,
            questionTruth: 15,
            hangmansGambit: 20,
            argumentArmament: 25,
            nonStopDebate: 22,
            massPanicDebate: 25,
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
export const TRIAL_CONTEXT_REGEX = /V3C\|\s*TRIAL_CONTEXT:\s*([^|\n\r]+?)(?:\|\|\s*([^|\n\r]+?))?(?:\|\|\s*([^\n\r]+))?$/gm;
