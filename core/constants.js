import { DEFAULT_EXAMINE_NARRATION_TEMPLATE } from "./case/examine.js";
import { DEFAULT_RULES_PROMPT_TEMPLATE } from "./rules/schoolRules.js";
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
    // Trust ceremony look: "danganronpa" or "persona".
    trustCeremonyStyle: "danganronpa",
    truthBulletAnimations: true,
    monomonoBgmVolume: 40,
    mapPresencePinsEnabled: true,
    vnModeEnabled: false,
    // VN text box look: "current", or a recreation of one game's box.
    vnSkin: "current",
    // Investigation / Free Time / Nighttime banner look: "match" follows the
    // text box, or one of the vnSkin values.
    phaseBannerStyle: "match",
    // AI instructions also tell the AI each present character's trust level.
    markerTrustLevelsEnabled: true,
    // VN typewriter speed in percent (25–300); 100 is the original speed.
    vnTypingSpeed: 100,
    // Show the player's Prome user sprite in a window during conversations.
    playerInsetEnabled: false,
    // The EXPRESSIONS tab on the right edge (conversations and trials).
    expressionPickerEnabled: true,
    // Characters' sprites change with what they say. Off: only by hand.
    autoExpressionsEnabled: true,
    // Your sprite window tucked away behind its stripes.
    playerInsetCollapsed: false,
    // SillyTavern streaming checkboxes VN mode switched off, to switch back on.
    vnPausedStStreaming: [],
    // Half-Sprite Mode global adjustments (apply to every character): a size
    // multiplier on the cropped sprite and a vertical pixel offset.
    halfspriteScale: 1,
    halfspriteOffsetY: 0,
    // Per-chat Half-Sprite size/offset overrides, keyed by chat/group scope
    // (getInvestigationScopeKey). When the adjust panel's "SAVE FOR THIS CHAT"
    // toggle is on, the chat's entry here wins over the global values above.
    // { "<scopeKey>": { scale: <number>, offsetY: <number> } }
    halfspriteChatOverrides: {},
    crtEffects: true,
    crtIntensity: 35,
    // Class Trial courtroom vertical offset (px). Shifts the podiums, gymnasium
    // horses and character sprites together as one. Positive = raised (up),
    // negative = lowered. Applied to #dangan-group-chat-stage via --dgn-podium-offset-y.
    trialPodiumOffsetY: 0,
    bootAnimations: true,
    settingsSubtab: "audio",
    titleScreenEnabled: true,
    setupPulseEnabled: true,
    returningNoticeDismissed: false,
    phaseHudEnabled: true,
    exploreHideComposer: true,
    exploreActionMenu: true,
    moveToOnMinimap: true,
    autoHideStTopBar: true,
    // SillyTavern's bar: "sg" (the capsule) or "classic".
    stTopBarStyle: "sg",
    // Where the capsule sits: "top" or "left".
    stTopBarPosition: "top",
    // Keybinds by action (core/input/keybinds.js); missing ones use defaults.
    keybinds: {},
    dynamicThemes: true,
    hideTruthBulletImages: false,
    hideGiftImages: false,
    spriteClickGiftsEnabled: false,
    hostEntranceSfx: true,
    hostEntranceBounce: true,
    // Catchphrase on the Rise & Shine entrance (host/hostSplash.js).
    hostSplashText: "Rise and Shine, Ursine—!",
    // What the hosts shout as the splash appears: "default", "custom" (the
    // file in hostSplashVoiceData, a data URL) or "mute".
    hostSplashVoiceMode: "default",
    hostSplashVoiceData: "",
    hudColorSongMode: "phase",
    hudColorChapterMode: "phase",
    hudColorMapMode: "phase",
    hudColorSong: "#f59a1b",
    hudColorChapter: "#f59a1b",
    hudColorMap: "#f59a1b",
    singleChatOverworldEnabled: false,
    singleChatGroupId: "",
    roomContextPromptEnabled: false,
    roomContextPromptTemplate: "",
    minigameTutorialsEnabled: true,
    featureCoachesEnabled: true,
    onboardingCoachesSeen: {},
    whiteNoiseLineSource: "main",
    nsdLineSource: "main",
    mpdLineSource: "main",
    hangmansGambitLineSource: "main",
    questionTimeLineSource: "main",
    questionTruthLineSource: "main",
    argumentArmamentLineSource: "main",
    scrumDebateLineSource: "main",
    mindMineLineSource: "main",
    generationProfileId: "",
    whiteNoiseProfileId: "",
    nsdProfileId: "",
    mpdProfileId: "",
    hangmansGambitProfileId: "",
    questionTimeProfileId: "",
    questionTruthProfileId: "",
    argumentArmamentProfileId: "",
    scrumDebateProfileId: "",
    mindMineProfileId: "",
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
    questionTimeUseRecentContext: false,
    questionTimeUseDebateHistory: false,
    questionTruthUseRecentContext: false,
    questionTruthUseDebateHistory: false,
    hangmansGambitUseRecentContext: false,
    hangmansGambitUseDebateHistory: false,
    shopTracks: [],
    monokumaTracks: [],
    // Played over the Rise & Shine entrance (the Monokubs' splash).
    monokubsTracks: [],
    // Host / mascot cards for this save (empty = Auto: the card named Monokuma).
    hostCards: [],
    // Hosts in this save that enter with the Rise & Shine splash instead of popping up.
    hostSplashCards: [],
    titleTracks: [],
    daytimeTracks: [],
    nighttimeTracks: [],
    investigationTracks: [],
    // Optional mood playlists for Dynamic Songs (expression majority vote).
    dynamicSongsEnabled: false,
    moodScanToastEnabled: false,
    happyTracks: [],
    sadTracks: [],
    dramaticTracks: [],
    tenseTracks: [],
    angryTracks: [],
    romanticTracks: [],
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
    trialIntroTracks: [],
    trialBreachTracks: [],
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
    // Legacy per-open-group journal map. Migrated into chapterJournal on load;
    // FETCH now uses markedJournalChats instead of the open thread's scope.
    chapterJournalByScope: {},
    // Chats included in Chapters FETCH. Identity: group:${groupId}:${chatId}
    // or char:${avatar}:${fileId}. New chats started while the extension is
    // loaded are auto-marked; older chats are toggled from the Chapters picker.
    markedJournalChats: [],
    // New chats with card greetings/scenario: "ask" shows KEEP/CLEAN, or
    // always keep / always clean without prompting. CLEAN is per-chat only.
    cardHygieneDefault: "ask",
    rewardDifficulty: "normal",
    timeTracker: {
        day: 1,
        phase: "day",
        dayActionUsed: false,
    },
    // Whether Investigation Mode is currently active — persisted so it survives
    // page refreshes (cleared when time advances to the next phase/day).
    investigationUnderway: false,
    // The hidden plan for this chapter's murder (core/case/caseFile.js), made
    // when Monokuma announces a motive. Never shown unless the player asks.
    caseFile: null,
    // Day N of a chapter Monokuma announces the motive on by himself; 0 is off.
    motiveAutoDay: 0,
    // The School Regulations (core/rules/schoolRules.js); null means the
    // defaults, which a save gets the first time they're read.
    schoolRules: null,
    // Tell the AI the School Regulations (outside Class Trials).
    shareSchoolRules: true,
    // Where each character usually is (overworld/routines.js):
    // { [name]: { day: [roomId], night: [roomId] } }.
    characterRoutines: {},
    // Toasts for each Case File event (beats, the killer's note, the murder,
    // the body being found), for checking the case plays out.
    caseDebugToasts: false,
    // Trial minigames with a right answer (not the debates) and the vote use
    // the hidden Case File.
    trialUseCaseTruth: true,
    // When an investigation partner reacts to what you examine: "clues",
    // "always" or "off".
    examinePartnerReactions: "clues",
    // How a partner's reaction shows: "message" (a chat message) or "aside"
    // (only in the VN box, never added to the chat).
    examinePartnerReactionStyle: "message",
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

export const DEFAULT_GAMEPLAY_PROMPT_TEMPLATES = {
    roomContext: `Location: {{room}}
Present: {{characters}}`,
    markerTruth: `[EVIDENCE MARKERS]
An investigation is underway. When a concrete, verifiable discovery is made, record it as a Truth Bullet on its own line:
V3C| TB: Short Title || One-sentence description
- Only record facts that are new and could matter at the Class Trial.
- Keep titles short, neutral and factual.
- If nothing new is found, write no marker.`,
    markerSocial: `[TRUST MARKERS]
When the player's interaction with a character meaningfully deepens trust, understanding or connection, add this on its own line at the very end of the reply:
V3C| SOCIAL: Character Full Name
When it seriously damages trust (betrayal, hostility, real harm; not playful teasing), add this instead:
V3C| SOCIAL_DOWN: Character Full Name
If something drastic badly damages trust (a serious betrayal or cruelty), use this instead, with how many ranks they lose (2 to 5):
V3C| SOCIAL_DROP: Character Full Name | 3
If it destroys their trust in the player outright, turning it into distrust, use this instead, with how deep their distrust now runs (1 to 10):
V3C| SOCIAL_BREAK: Character Full Name | 4
- Use the character's full name as it's displayed.
- At most one trust marker per character per reply. Use them sparingly; not every friendly moment counts, and SOCIAL_DROP and SOCIAL_BREAK are rare: most bad moments are a plain SOCIAL_DOWN.`,
    markerTrustLevels: `[TRUST LEVELS]
How each character here currently feels about the player. Let it color how they act toward them; never mention ranks or numbers.
{{trust_levels}}`,
    markerInvestigation: `[INVESTIGATION MARKER]
If a body is discovered and the story moves into the investigation, put this on its own line at the start of that reply:
V3C| INVESTIGATION_START
Don't use it at any other time.`,
    // What the player notices when examining something (core/case/examine.js
    // fills the placeholders; {{findings}} says whether there's evidence).
    examineNarration: DEFAULT_EXAMINE_NARRATION_TEMPLATE,
    // The School Regulations ({{rules}} is the numbered list).
    schoolRules: DEFAULT_RULES_PROMPT_TEMPLATE,
    markerAnnouncements: `[ANNOUNCEMENT MARKERS]
When Monokuma makes an announcement in the story, add the matching marker on its own line:
V3C| DAY_ANNOUN for the morning announcement
V3C| NIGHT_ANNOUN for the nighttime announcement
V3C| BDA for a body discovery announcement`,
};

export function getDefaultPromptTemplate(templateKey) {
    return DEFAULT_TRIAL_PROMPT_TEMPLATES[templateKey]
        || DEFAULT_GAMEPLAY_PROMPT_TEMPLATES[templateKey]
        || "";
}

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
// Several ranks at once: "V3C| SOCIAL_DROP: Name | 3" (2–5 ranks).
export const SOCIAL_DROP_REGEX = /V3C\|\s*SOCIAL_DROP:\s*([^\n\r]+)/g;
// Trust shattered into Distrust N: "V3C| SOCIAL_BREAK: Name | 4" (1–10).
export const SOCIAL_BREAK_REGEX = /V3C\|\s*SOCIAL_BREAK:\s*([^\n\r]+)/g;

// "Name | 3" (or "Name, 3" / "Name 3") → { name, amount }; amount is null
// when the marker gives no number.
export function parseSocialMarkerTarget(text) {
    const raw = String(text || "").trim();
    const m = raw.match(/^(.*?)(?:\s*[|｜,:]\s*|\s+)(\d{1,2})\s*[|｜]?\s*$/);
    const name = (m ? m[1] : raw).replace(/[|｜,:\s]+$/, "").trim();
    return { name, amount: m ? Number(m[2]) : null };
}
export const INVESTIGATION_START_REGEX = /V3C\s*[|｜]\s*INVESTIGATION(?:\s*[_\-]?\s*)START\b/gi;
export const TRIAL_START_REGEX = /V3C\s*[|｜]\s*TRIAL(?:\s*[_\-]?\s*)START\b/gi;
export const TRIAL_CONTEXT_REGEX = /V3C\|\s*TRIAL_CONTEXT:\s*([^|\n\r]+?)(?:\|\|\s*([^|\n\r]+?))?(?:\|\|\s*([^\n\r]+))?$/gm;
