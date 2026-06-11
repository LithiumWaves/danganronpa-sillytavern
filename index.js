import { extension_settings } from "../../../extensions.js";
import { saveSettingsDebounced, getRequestHeaders, eventSource, event_types } from "../../../../script.js";
import { power_user } from "../../../power-user.js";
import { openGroupById, editGroup } from "../../../group-chats.js";
import { executeSlashCommandsWithOptions } from '../../../slash-commands.js';
import { SlashCommandParser } from '../../../slash-commands/SlashCommandParser.js';
import { SlashCommand } from '../../../slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from '../../../slash-commands/SlashCommandArgument.js';
import { SlashCommandEnumValue } from '../../../slash-commands/SlashCommandEnumValue.js';
import { initTruthBullets, handleTruthBullet, setNextTruthBulletSfxVariant, getTruthBulletByLocationId, showTruthBulletByLocationId, showTruthBulletById, getTruthBullets, clearAllTruthBullets } from "./truth/truthBullets.js";
import { buildDecagram, crackShard, shatterShard } from "./trust/trustDecagram.js";
import { initTrustAnimations, playTrustRankUp, playTrustRankDown, playTrustMaxed, playTrustToDistrustTransition, playDistrustRankDown, playDistrustRankUp, playDistrustToTrustRecovery } from "./trust/trustAnimations.js";
import { increaseTrust, decreaseTrust } from "./trust/trustAPI.js";
import { createItemsPanelController, SKILL_PARAM_MAP, applySkillModifier } from "./items/itemsPanel.js";
import { createRewardSystem } from "./items/rewardSystem.js";
import { createSocialPanelController } from "./social/socialPanel.js";
import { extractUltimateFromNotes, isIgnoredCharacter, lookupUltimateFromLorebook, normalizeList, normalizeName } from "./social/characterUtils.js";
import { createMapPanelController } from "./map/mapPanel.js";
import { getLocationPromptReference, resolveLocationIdFromText } from "./map/locationPresence.js";
import { DEFAULT_TRIAL_PROMPT_TEMPLATES, INVESTIGATION_START_REGEX, MONOCOIN_REWARDS, REWARD_DIFFICULTY_LABELS, REWARD_PROFILES, XP_REWARDS, SOCIAL_DOWN_REGEX, SOCIAL_REGEX, SOCIAL_UP_REGEX, TRIAL_CONTEXT_REGEX, defaultSettings, extensionFolderPath, extensionName } from "./core/constants.js";
import { createOpenRouterSettingsManager } from "./core/openrouterSettings.js";
import { MONOKUMA_LESSON_STEPS, MONOKUMA_LESSON_TITLE } from "./core/monokumaLessonScript.js";
import { createMonokumaAnnouncementController, parseMonokumaAnnouncementMarkers } from "./monokuma/announcementController.js";
import { createClassTrialMenuController } from "./trial/menu/classTrialMenu.js";
import { createTrialManager, TrialPhases } from "./trial/trialManager.js";
import { initVfxSystem, onVfxChatChanged, setExpressionTarget, setEmotionBiasResolver, setVfxGcpLoadSuppressed, setVfxGcpGroupActive, triggerVfxOnElement } from "./vfx/vfxSystem.js";
import { initEmotionFontsSystem, getEmotionFont } from "./vfx/emotionFontsSystem.js";
import { createBdaCinematicEditor } from "./vfx/bdaCinematicEditor.js";
import { createExecutionCinematicEditor } from "./vfx/executionCinematicEditor.js";
import { createVoteResultsController } from "./vfx/voteResults.js";
import { createVotingScreenController } from "./vfx/votingScreen.js";
import { createQuestionTimeController } from "./vfx/questionTime.js";
import { createQuestionTruthController } from "./vfx/questionTruth.js";
import { createHangmansGambitController } from "./vfx/hangmansGambit.js";
import { createArgumentArmamentController } from "./vfx/argumentArmament.js";
import { createScrumDebateController, buildTeams as buildScrumTeams } from "./vfx/scrumDebate.js";
import { createMindMineController } from "./vfx/mindMine.js";
import { createChooseCharacterController } from "./vfx/chooseCharacter.js";
import { createIntroduceCharacterController } from "./vfx/introduceCharacter.js";
import { createChapterEndRosterController } from "./vfx/chapterEndRoster.js";
import { createRebuttalShowdownController, createInterjectionCinematicRunner } from "./vfx/rebuttalShowdown.js";
import { MPD_TEST_SCENARIOS } from "./vfx/massPanicDebate.js";
import { createAudioVisualizerController } from "./audio/audioVisualizer.js";
import { createOverworldSceneController } from "./overworld/overworldScene.js";
import { user_avatar } from "../../../personas.js";

window.refreshActiveCharacterUI = function () {
    if (!activeSocialCharacterId || !socialPanelController) return;

    for (const char of characters.values()) {
        if (char.id === activeSocialCharacterId) {
            socialPanelController.openCharacterReport(char);
            socialPanelController?.renderSocialPanel();
            return;
        }
    }
};

let activeSocialCharacterId = null;
let socialPanelController = null;
let itemsPanelController = null;
let mapPanelController = null;
let hasSelectedMonopadTab = false;
let monokumaLessonState = null;
let vnModeController = null;
let monokumaAnnouncementController = null;
let classTrialMenuController = null;
let trialManager = null;
let vfxCleanup = null;
let bdaCinematicEditor = null;
let executionCinematicEditor = null;
let voteResultsController   = null;
let votingScreenController  = null;
let questionTimeController    = null;
let questionTruthController   = null;
let hangmansGambitController    = null;
let argumentArmamentController   = null;
let scrumDebateController      = null;
let mindMineController         = null;
let rebuttalShowdownController  = null;
let interjectionRunner          = null;
let chooseCharacterController   = null;
let introduceCharacterController = null;
let chapterEndRosterController   = null;
let audioVisualizer              = null;
let overworldSceneController     = null;
let reapplyOutfitToSprites       = () => {};

// #region debug-point A:overlay-report
function reportFullscreenOverlayDebug(hypothesisId, location, msg, data = {}) {
    fetch("http://127.0.0.1:7777/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            sessionId: "fullscreen-overlays-broken",
            runId: "pre-fix",
            hypothesisId,
            location,
            msg: `[DEBUG] ${msg}`,
            data,
            ts: Date.now(),
        }),
    }).catch(() => {});
}

// #region debug-point A:global-errors
try {
    window.addEventListener("error", (e) => {
        reportFullscreenOverlayDebug("A", "window:error", "Unhandled error", {
            message: String(e?.message || ""),
            filename: String(e?.filename || ""),
            lineno: e?.lineno,
            colno: e?.colno,
        });
    });
    window.addEventListener("unhandledrejection", (e) => {
        const reason = e?.reason;
        reportFullscreenOverlayDebug("A", "window:unhandledrejection", "Unhandled promise rejection", {
            reason: typeof reason === "string" ? reason : (reason?.message || String(reason || "")),
        });
    });
} catch {}
// #endregion
// #endregion

const openRouterSettings = createOpenRouterSettingsManager({
    extensionName,
    extension_settings,
    saveSettingsDebounced,
    defaultSettings,
});

const {
    loadSettings,
    getMonopadSetting,
    setMonopadSetting,
    getRuntimeOpenRouterApiKey,
    setRuntimeOpenRouterApiKey,
    persistOpenRouterApiKeyIfAllowed,
    isOpenRouterGenerationEnabled,
    generateWithOpenRouter,
    testOpenRouterConnection,
} = openRouterSettings;

let rewards = null;
let recentLocationMentions = [];

function pushRecentLocationMention(entry) {
    if (!entry?.locationId || !entry?.messageSignature) return;

    const normalizedSpeaker = normalizeName(entry.speakerName || "");
    recentLocationMentions = recentLocationMentions.filter(item => {
        if (item.messageSignature === entry.messageSignature && normalizeName(item.speakerName || "") === normalizedSpeaker) {
            return false;
        }
        return true;
    });

    recentLocationMentions.push({
        messageSignature: entry.messageSignature,
        speakerName: String(entry.speakerName || "").trim(),
        isUser: Boolean(entry.isUser),
        locationId: entry.locationId,
        createdAt: Date.now(),
    });

    const overflow = recentLocationMentions.length - 5;
    if (overflow > 0) {
        recentLocationMentions.splice(0, overflow);
    }
}

function getDanganExtensionPromptText(promptKey) {
    const ctx = window.SillyTavern?.getContext?.();
    const candidates = [
        ctx?.extensionPrompts,
        ctx?.extension_prompts,
        ctx?.extension_prompt,
        window.extensionPrompts,
        window.extension_prompts,
        window.extension_prompt,
    ];

    for (const candidate of candidates) {
        if (!candidate) continue;
        const value = candidate[promptKey];
        if (typeof value === "string" && value.trim()) return value.trim();
    }

    return "";
}

function buildRecentChatContextLines(maxLines = 14) {
    const contextMessages = typeof getContextMessages === "function" ? getContextMessages() : [];
    return (Array.isArray(contextMessages) ? contextMessages : [])
        .slice(-maxLines)
        .map(m => `${m.isUser ? "YOU" : (m.name || "NARRATOR")}: ${m.text}`)
        .join("\n");
}

function buildRecentLocationPresence() {
    const latestBySpeaker = new Map();

    for (let i = recentLocationMentions.length - 1; i >= 0; i -= 1) {
        const item = recentLocationMentions[i];
        const speakerKey = item.isUser
            ? "__user__"
            : normalizeName(item.speakerName || `unknown_${i}`);

        if (!speakerKey || latestBySpeaker.has(speakerKey)) continue;
        latestBySpeaker.set(speakerKey, item);
    }

    const userEntry = latestBySpeaker.get("__user__") || null;
    const characters = [];

    latestBySpeaker.forEach((item, key) => {
        if (key === "__user__") return;
        if (!item?.speakerName || !item?.locationId) return;

        characters.push({
            name: item.speakerName,
            locationId: item.locationId,
        });
    });

    return {
        user: userEntry
            ? {
                locationId: userEntry.locationId,
                label: getActivePersonaName(),
            }
            : null,
        characters,
    };
}

window.getMonopadRecentLocationPresence = function () {
    return buildRecentLocationPresence();
};

// Returns a flat map of normalized character name -> last seen locationId,
// drawn from the recent-mention buffer. Used by the overworld scene to seed
// starting locations from chat history before falling back to random.
function getLastKnownCharacterLocations() {
    const out = {};
    for (let i = recentLocationMentions.length - 1; i >= 0; i -= 1) {
        const item = recentLocationMentions[i];
        if (!item || item.isUser) continue;
        if (!item.speakerName || !item.locationId) continue;
        const key = normalizeName(item.speakerName);
        if (!out[key]) out[key] = item.locationId;
    }
    return out;
}

const TIME_PHASE_DAY = "day";
const TIME_PHASE_NIGHT = "night";
const TIME_EXTENSION_PROMPT_KEY = "dangan_time_context";

function buildGenerationTimeContext(state) {
    const safeState = state || ensureTimeTrackerState();
    const phaseLabel = safeState.phase === TIME_PHASE_NIGHT ? "NIGHTTIME" : "DAYTIME";
    const periodHint = safeState.phase === TIME_PHASE_NIGHT
        ? "Night period: curfew rules and low-visibility assumptions are active."
        : "Day period: normal campus activity assumptions are active.";

    return [
        "[DANGANRONPA TIME CONTEXT]",
        `In-game day: ${safeState.day}`,
        `In-game phase: ${phaseLabel}`,
        periodHint,
        "Use this context when generating your next reply.",
    ].join("\n");
}

function applyTimeContextToGeneration() {
    const state = ensureTimeTrackerState();
    const contextPrompt = buildGenerationTimeContext(state);

    const setPrompt =
        window.SillyTavern?.getContext?.()?.setExtensionPrompt
        || window.setExtensionPrompt
        || null;

    if (typeof setPrompt !== "function") return false;

    setPrompt(TIME_EXTENSION_PROMPT_KEY, contextPrompt, 0, 0, false, "system");
    return true;
}

function ensureTimeTrackerState() {
    extension_settings[extensionName] ||= {};

    const fallback = defaultSettings.timeTracker || { day: 1, phase: TIME_PHASE_DAY, dayActionUsed: false };
    const raw = extension_settings[extensionName].timeTracker;

    const normalized = {
        day: Math.max(1, Math.floor(Number(raw?.day ?? fallback.day ?? 1) || 1)),
        phase: raw?.phase === TIME_PHASE_NIGHT ? TIME_PHASE_NIGHT : TIME_PHASE_DAY,
        dayActionUsed: Boolean(raw?.dayActionUsed ?? fallback.dayActionUsed ?? false),
    };

    if (normalized.phase === TIME_PHASE_NIGHT) {
        normalized.dayActionUsed = true;
    }

    extension_settings[extensionName].timeTracker = normalized;
    return extension_settings[extensionName].timeTracker;
}

function getTimeReadoutLabel(state) {
    if (!state) return "DAY 1 · DAYTIME";
    return `DAY ${state.day} · ${state.phase === TIME_PHASE_NIGHT ? "NIGHTTIME" : "DAYTIME"}`;
}

function renderTimeTrackerUi() {
    const state = ensureTimeTrackerState();

    const readoutEl = document.getElementById("monopad-time-readout");
    const passTimeBtn = document.getElementById("monopad-pass-time");
    const sleepBtn = document.getElementById("monopad-sleep");
    const investigationBtn = document.getElementById("monopad-investigation-underway");

    if (readoutEl) {
        readoutEl.textContent = getTimeReadoutLabel(state);
    }

    if (investigationUnderway) {
        if (passTimeBtn) passTimeBtn.hidden = true;
        if (sleepBtn) sleepBtn.hidden = true;
        if (investigationBtn) investigationBtn.hidden = false;
    } else {
        if (investigationBtn) investigationBtn.hidden = true;

        if (passTimeBtn) {
            const isDisabled = state.phase !== TIME_PHASE_DAY || state.dayActionUsed;
            passTimeBtn.hidden = false;
            passTimeBtn.disabled = isDisabled;
            passTimeBtn.setAttribute("aria-disabled", String(isDisabled));
        }

        if (sleepBtn) {
            const isDisabled = state.phase !== TIME_PHASE_NIGHT;
            sleepBtn.hidden = false;
            sleepBtn.disabled = isDisabled;
            sleepBtn.setAttribute("aria-disabled", String(isDisabled));
        }
    }
}

async function passTimeToNight({ source = "manual" } = {}) {
    const state = ensureTimeTrackerState();
    if (state.phase !== TIME_PHASE_DAY || state.dayActionUsed) return false;

    state.phase = TIME_PHASE_NIGHT;
    state.dayActionUsed = true;

    saveSettingsDebounced();
    renderTimeTrackerUi();
    applyTimeContextToGeneration();
    overworldSceneController?.randomizeLocations?.();
    await monokumaAnnouncementController?.triggerAsync("NIGHT_ANNOUN");
    await nightTimeStartController.triggerAsync();
    playNighttimeTrack();
    applyDynamicTheme();
    console.log(`[${extensionName}] Time advanced to NIGHT (source: ${source}).`);
    return true;
}

async function sleepToNextDay({ source = "manual" } = {}) {
    const state = ensureTimeTrackerState();
    if (state.phase !== TIME_PHASE_NIGHT) return false;

    state.day = Math.max(1, Number(state.day || 1) + 1);
    state.phase = TIME_PHASE_DAY;
    state.dayActionUsed = false;

    saveSettingsDebounced();
    renderTimeTrackerUi();
    applyTimeContextToGeneration();
    overworldSceneController?.randomizeLocations?.();
    // Hide the BGM visualizer for the duration of the announcement + theme swap
    // (mirrors /passtime so the visualizer doesn't pop back as the daytime track
    // resumes before the theme has finished applying).
    audioVisualizer?.suppress?.();
    await monokumaAnnouncementController?.triggerAsync("DAY_ANNOUN");
    await freeTimeStartController.triggerAsync();
    playDaytimeTrack();
    applyDynamicTheme();
    audioVisualizer?.unsuppress?.();
    console.log(`[${extensionName}] Time advanced to DAY ${state.day} (source: ${source}).`);
    return true;
}

function resetDayCounter({ source = "manual" } = {}) {
    const state = ensureTimeTrackerState();

    state.day = 1;
    state.phase = TIME_PHASE_DAY;
    state.dayActionUsed = false;

    saveSettingsDebounced();
    renderTimeTrackerUi();
    applyTimeContextToGeneration();
    console.log(`[${extensionName}] Time tracker reset to DAY 1 / DAYTIME (source: ${source}).`);
    return true;
}

// ── Chapter tracking ──────────────────────────────────────────────────────────

function getChapterLabel() {
    const idx = Number(getMonopadSetting('chapterIndex') ?? 0);
    if (idx <= 0) return 'PROLOGUE';
    if (idx >= 10) return 'EPILOGUE';
    return `CHAPTER ${idx}`;
}

function updateChapterDisplay() {
    const el = document.getElementById('dangan-chapter-label');
    if (el) el.textContent = getChapterLabel();
    trialManager?.refreshTrialBadge?.();
}

// ── Chapter Journal ───────────────────────────────────────────────────────────

const CHAPTER_JOURNAL_LABELS = {
    0: 'PROLOGUE',
    10: 'EPILOGUE',
};
function getChapterJournalLabel(idx) {
    if (idx <= 0) return 'PROLOGUE';
    if (idx >= 10) return 'EPILOGUE';
    return `CHAPTER ${idx}`;
}

function getChapterJournalData(idx) {
    const settings = extension_settings[extensionName] ||= {};
    settings.chapterJournal ||= {};
    settings.chapterJournal[idx] ||= { name: '', notes: '', listSummary: '', detailedSummary: '' };
    return settings.chapterJournal[idx];
}

function saveChapterJournalData(idx, patch) {
    const data = getChapterJournalData(idx);
    Object.assign(data, patch);
    saveSettingsDebounced();
}

function _journalFilterMsg(msg) {
    if (!msg.mes?.trim()) return false;
    if (msg.is_system) return false;
    const name = (msg.name || '').trim().toLowerCase();
    if (name === 'assistant') return false;
    return true;
}

function _journalFormatMsg(msg) {
    const name = msg.name?.trim() || (msg.is_user ? 'Player' : 'Character');
    return `[${name}]: ${msg.mes.trim()}`;
}

async function getAllChatsForJournal() {
    const ctx = window.SillyTavern?.getContext?.();
    if (!ctx) return { sections: [], totalMessages: 0 };

    const sections = [];

    // 1. All individual character chats
    const characters = Array.isArray(ctx.characters) ? ctx.characters : [];
    let charChatCount = 0;

    for (const char of characters) {
        if (!char.avatar) continue;
        try {
            const listResp = await fetch('/api/characters/chats', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({ avatar_url: char.avatar, simple: true }),
            });
            if (!listResp.ok) continue;
            const chatList = await listResp.json();
            if (!Array.isArray(chatList) || !chatList.length) continue;

            for (const chatEntry of chatList) {
                const fileId = chatEntry.file_id || (chatEntry.file_name || '').replace('.jsonl', '');
                if (!fileId) continue;
                try {
                    const msgResp = await fetch('/api/chats/get', {
                        method: 'POST',
                        headers: getRequestHeaders(),
                        body: JSON.stringify({ avatar_url: char.avatar, file_name: fileId }),
                    });
                    if (!msgResp.ok) continue;
                    const messages = await msgResp.json();
                    if (Array.isArray(messages)) {
                        const lines = messages.filter(_journalFilterMsg).map(_journalFormatMsg);
                        if (lines.length) {
                            sections.push({ label: `CHAT: ${char.name}`, lines });
                            charChatCount += lines.length;
                        }
                    }
                } catch (e) {
                    console.warn(`[${extensionName}] Could not fetch chat ${fileId} for ${char.name}`, e);
                }
            }
        } catch (e) {
            console.warn(`[${extensionName}] Could not fetch chat list for ${char.name}`, e);
        }
    }

    // 2. All group chats
    let groupChatCount = 0;
    try {
        const groupsResp = await fetch('/api/groups/all', {
            method: 'POST',
            headers: getRequestHeaders(),
        });
        if (groupsResp.ok) {
            const groups = await groupsResp.json();
            for (const group of (Array.isArray(groups) ? groups : [])) {
                const groupName = group.name || group.id || 'Group';
                const chatIds = Array.isArray(group.chats) ? group.chats
                    : (group.chat_id ? [group.chat_id] : []);
                for (const chatId of chatIds) {
                    try {
                        const msgResp = await fetch('/api/chats/group/get', {
                            method: 'POST',
                            headers: getRequestHeaders(),
                            body: JSON.stringify({ id: chatId }),
                        });
                        if (!msgResp.ok) continue;
                        const messages = await msgResp.json();
                        if (Array.isArray(messages)) {
                            const lines = messages.filter(_journalFilterMsg).map(_journalFormatMsg);
                            if (lines.length) {
                                sections.push({ label: `GROUP CHAT: ${groupName}`, lines });
                                groupChatCount += lines.length;
                            }
                        }
                    } catch (e) {
                        console.warn(`[${extensionName}] Could not fetch group chat ${chatId}`, e);
                    }
                }
            }
        }
    } catch (e) {
        console.warn(`[${extensionName}] Could not fetch groups`, e);
    }

    const totalMessages = charChatCount + groupChatCount;
    console.log(`[${extensionName}] Journal collected ${charChatCount} messages from character chats, ${groupChatCount} from group chats (${sections.length} sections total)`);

    return { sections, totalMessages };
}

let chaptersActiveIdx = 0;
let chaptersActiveSummaryType = 'list'; // 'list' | 'detail'
let chaptersGenerationPending = null;   // null | { transcript, type }
let chaptersResponseTokens = 1500;      // current slider value, persists across re-renders
let chaptersDepthLevel = 3;             // 0–6 index into CHAPTERS_DEPTH_LEVELS
let chaptersEstTokens = 0;              // transcript token estimate from last collection

const CHAPTERS_DEPTH_LEVELS = ['TLDR', 'Brief', 'Short', 'Average', 'Long', 'Detailed', 'Extensive'];

const CHAPTERS_DEPTH_INSTRUCTIONS = [
    // 0 — TLDR
    'Be extremely concise. Cover ONLY the most critical plot points — murders, trials, key revelations, and decisive character actions. Ruthlessly cut anything that is not directly plot-critical. Your goal is maximum compression.',
    // 1 — Brief
    'Be brief. Cover key story events and important beats only. Skip minor interactions, small talk, and anything that does not meaningfully advance the plot or a character relationship.',
    // 2 — Short
    'Be concise but cover the main events and important character moments. Omit minor details and flavour exchanges.',
    // 3 — Average
    'Cover all notable events with moderate detail. Include important interactions, character moments, and the context behind major decisions.',
    // 4 — Long
    'Cover all significant events in good detail, including character interactions, emotional beats, and the reasoning behind key developments.',
    // 5 — Detailed
    'Cover all events thoroughly with full detail. Include character motivations, nuances, the significance of every development, and meaningful dialogue exchanges.',
    // 6 — Extensive
    'Cover EVERYTHING without omission. Every interaction, every exchange, every detail — no matter how seemingly minor — must be included. Nothing should be left out.',
];

// Fraction of input estTokens used as the response-length ceiling per depth level.
// A floor ensures useful output even on tiny transcripts.
//            TLDR   Brief  Short  Avg    Long   Detail Ext
const CHAPTERS_DEPTH_FRACTIONS = [0.03,  0.06,  0.12,  0.22,  0.40,  0.65,  1.0];
const CHAPTERS_DEPTH_FLOORS    = [800,   1000,  1500,  2000,  3000,  5000,  8000];

function getDepthMaxTokens(estTokens, depthLevel) {
    const fraction = CHAPTERS_DEPTH_FRACTIONS[depthLevel] ?? 1.0;
    const floor    = CHAPTERS_DEPTH_FLOORS[depthLevel]    ?? 500;
    return Math.min(estTokens, Math.max(floor, Math.round(estTokens * fraction)));
}

function _applyDepthToTokensSlider(newDepthLevel) {
    if (!chaptersEstTokens) return;
    const newMax = getDepthMaxTokens(chaptersEstTokens, newDepthLevel);
    const sliderEl   = document.getElementById('chapters-tokens-slider');
    const valueEl    = document.getElementById('chapters-tokens-value');
    if (!sliderEl) return;
    sliderEl.max = newMax;
    chaptersResponseTokens = Math.min(chaptersResponseTokens, newMax);
    sliderEl.value = chaptersResponseTokens;
    if (valueEl) valueEl.textContent = `${chaptersResponseTokens.toLocaleString()} TOKENS`;
}

function renderChaptersPanel() {
    const stripEl = document.getElementById('chapters-tab-strip');
    const bodyEl = document.getElementById('chapters-body');
    if (!stripEl || !bodyEl) return;

    // Any re-render (chapter switch, toggle switch) discards pending confirmation and stale estimate
    chaptersGenerationPending = null;
    chaptersEstTokens = 0;

    const currentChapterIdx = Number(getMonopadSetting('chapterIndex') ?? 0);

    // Build completed chapter list: all chapters up to and including current
    const completedIdxs = [];
    // Always include prologue (0)
    completedIdxs.push(0);
    for (let i = 1; i <= Math.min(currentChapterIdx, 9); i++) {
        completedIdxs.push(i);
    }
    if (currentChapterIdx >= 10) completedIdxs.push(10);

    // Clamp active idx to valid range
    if (!completedIdxs.includes(chaptersActiveIdx)) {
        chaptersActiveIdx = completedIdxs[completedIdxs.length - 1] ?? 0;
    }

    // Render tab strip
    stripEl.innerHTML = '';
    for (const idx of completedIdxs) {
        const btn = document.createElement('button');
        btn.className = 'chapters-tab-btn' + (idx === chaptersActiveIdx ? ' active' : '');
        btn.type = 'button';
        btn.textContent = getChapterJournalLabel(idx);
        btn.addEventListener('click', () => {
            chaptersActiveIdx = idx;
            renderChaptersPanel();
        });
        stripEl.appendChild(btn);
    }

    // Render body for active chapter
    const data = getChapterJournalData(chaptersActiveIdx);
    const chapterLabel = getChapterJournalLabel(chaptersActiveIdx);

    const isList = chaptersActiveSummaryType === 'list';
    const activeContent = isList ? data.listSummary : data.detailedSummary;

    bodyEl.innerHTML = `
        <div class="chapters-name-row">
            <span class="chapters-name-prefix">${chapterLabel} —</span>
            <input
                class="chapters-name-input"
                id="chapters-name-input"
                type="text"
                placeholder="Enter chapter subtitle…"
                value="${(data.name || '').replace(/"/g, '&quot;')}"
                maxlength="80"
            />
        </div>

        <div class="chapters-divider"></div>

        <div>
            <div class="chapters-section-label">NOTES / DIARY</div>
            <textarea class="chapters-notes-textarea" id="chapters-notes-textarea" placeholder="Write your notes or diary entry for this chapter…">${data.notes || ''}</textarea>
        </div>

        <div class="chapters-sliders-wrap" id="chapters-sliders-wrap" style="display:none">
            <div class="chapters-tokens-row">
                <span class="chapters-section-label">DEPTH</span>
                <input
                    type="range"
                    class="chapters-tokens-slider"
                    id="chapters-depth-slider"
                    min="0"
                    max="6"
                    step="1"
                    value="${chaptersDepthLevel}"
                />
                <span class="chapters-tokens-value" id="chapters-depth-value">${CHAPTERS_DEPTH_LEVELS[chaptersDepthLevel]}</span>
            </div>
            <div class="chapters-tokens-row">
                <span class="chapters-section-label">RESPONSE LENGTH</span>
                <input
                    type="range"
                    class="chapters-tokens-slider"
                    id="chapters-tokens-slider"
                    min="100"
                    max="3000"
                    step="50"
                    value="${Math.min(chaptersResponseTokens, 3000)}"
                />
                <span class="chapters-tokens-value" id="chapters-tokens-value">${chaptersResponseTokens.toLocaleString()} TOKENS</span>
            </div>
        </div>

        <div class="chapters-divider"></div>

        <div class="chapters-summary-section">
            <div class="chapters-summary-header">
                <div class="chapters-summary-toggle">
                    <button class="chapters-toggle-btn${isList ? ' active' : ''}" id="chapters-toggle-list" type="button">LIST</button>
                    <button class="chapters-toggle-btn${!isList ? ' active' : ''}" id="chapters-toggle-detail" type="button">DETAILED</button>
                </div>
                <button class="chapters-generate-btn" id="chapters-gen-btn" type="button">FETCH</button>
            </div>
            <div class="chapters-summary-box${activeContent ? '' : ' is-empty'}" id="chapters-summary-box">${activeContent || 'No summary generated yet.'}</div>
            <div class="chapters-summary-status" id="chapters-summary-status"></div>
        </div>
    `;

    // Wire up name input
    const nameInput = document.getElementById('chapters-name-input');
    if (nameInput) {
        nameInput.addEventListener('input', () => {
            saveChapterJournalData(chaptersActiveIdx, { name: nameInput.value });
        });
    }

    // Wire up notes textarea
    const notesTextarea = document.getElementById('chapters-notes-textarea');
    if (notesTextarea) {
        notesTextarea.addEventListener('input', () => {
            saveChapterJournalData(chaptersActiveIdx, { notes: notesTextarea.value });
        });
    }

    // Wire up depth slider
    const depthSlider = document.getElementById('chapters-depth-slider');
    const depthValue = document.getElementById('chapters-depth-value');
    if (depthSlider) {
        depthSlider.addEventListener('input', () => {
            chaptersDepthLevel = Number(depthSlider.value);
            if (depthValue) depthValue.textContent = CHAPTERS_DEPTH_LEVELS[chaptersDepthLevel];
            _applyDepthToTokensSlider(chaptersDepthLevel);
        });
    }

    // Wire up response-length slider
    const slider = document.getElementById('chapters-tokens-slider');
    const tokensValue = document.getElementById('chapters-tokens-value');
    if (slider) {
        slider.addEventListener('input', () => {
            chaptersResponseTokens = Number(slider.value);
            if (tokensValue) tokensValue.textContent = `${chaptersResponseTokens.toLocaleString()} TOKENS`;
        });
    }

    // Wire up summary type toggle
    document.getElementById('chapters-toggle-list')?.addEventListener('click', () => {
        chaptersActiveSummaryType = 'list';
        renderChaptersPanel();
    });
    document.getElementById('chapters-toggle-detail')?.addEventListener('click', () => {
        chaptersActiveSummaryType = 'detail';
        renderChaptersPanel();
    });

    // Wire up generate button
    document.getElementById('chapters-gen-btn')?.addEventListener('click', () => generateChapterSummary(chaptersActiveSummaryType));
}

// Always re-query by ID so stale references after re-renders never silently fail
function _chaptersSetStatus(msg) {
    const el = document.getElementById('chapters-summary-status');
    if (el) el.textContent = msg;
}
// Yield one paint frame so the browser can render the status update
function _chaptersYield() {
    return new Promise(r => setTimeout(r, 30));
}

async function generateChapterSummary(type) {
    const isDetail = type === 'detail';

    // ── Step 2: user clicked CONFIRM — fire the generation ───────────────────
    if (chaptersGenerationPending && chaptersGenerationPending.type === type) {
        const { transcript } = chaptersGenerationPending;
        chaptersGenerationPending = null;

        const btn = document.getElementById('chapters-gen-btn');
        const box = document.getElementById('chapters-summary-box');
        if (btn) { btn.textContent = 'FETCH'; btn.disabled = true; }
        _chaptersSetStatus('GENERATING…');
        await _chaptersYield();

        try {
            const chapterLabel = getChapterJournalLabel(chaptersActiveIdx);
            const depthLabel = CHAPTERS_DEPTH_LEVELS[chaptersDepthLevel];
            const depthInstruction = CHAPTERS_DEPTH_INSTRUCTIONS[chaptersDepthLevel];

            let prompt;
            if (isDetail) {
                prompt = `You are writing a story journal entry for a Danganronpa-style roleplay game.
Chapter: ${chapterLabel}
Depth: ${depthLabel}

${depthInstruction}

Read the chat log below and write a narrative summary of what actually happened in the story during this chapter. Write in past tense, third person. Do NOT mention the interface, menus, buttons, or anything outside the story. Ignore out-of-character or system-like messages.

CHAT LOG:
${transcript}

JOURNAL ENTRY:`;
            } else {
                prompt = `You are writing a story journal entry for a Danganronpa-style roleplay game.
Chapter: ${chapterLabel}
Depth: ${depthLabel}

${depthInstruction}

Read the chat log below and output ONLY a bulleted list of in-story events in the order they occurred. Each bullet should be one concise sentence. Use "•" as the bullet character. No introduction, no conclusion, no text outside the bullets. Do NOT mention the interface, menus, or anything out-of-character.

CHAT LOG:
${transcript}

BULLET LIST:`;
            }

            const ctx = window.SillyTavern?.getContext?.();
            if (!ctx?.generateRaw) throw new Error("SillyTavern API not available");

            const result = await ctx.generateRaw({
                prompt,
                responseLength: chaptersResponseTokens,
            });

            if (result) {
                const key = isDetail ? 'detailedSummary' : 'listSummary';
                saveChapterJournalData(chaptersActiveIdx, { [key]: result });
                if (box) { box.textContent = result; box.classList.remove('is-empty'); }
                _chaptersSetStatus('FETCHED.');
                setTimeout(() => _chaptersSetStatus(''), 2500);
            } else {
                _chaptersSetStatus('NO RESULT RETURNED.');
            }
        } catch (err) {
            console.error(`[${extensionName}] Chapter summary generation failed:`, err);
            _chaptersSetStatus(`ERROR: ${err.message}`);
        } finally {
            const btn2 = document.getElementById('chapters-gen-btn');
            if (btn2) btn2.disabled = false;
        }
        return;
    }

    // ── Step 1: collect chats, show estimate, wait for CONFIRM ───────────────
    chaptersGenerationPending = null;
    const btn = document.getElementById('chapters-gen-btn');
    if (btn) btn.disabled = true;
    _chaptersSetStatus('COLLECTING CHATS…');
    await _chaptersYield();

    try {
        const { sections, totalMessages } = await getAllChatsForJournal();

        if (!totalMessages) {
            _chaptersSetStatus('NO CHAT MESSAGES FOUND.');
            if (btn) btn.disabled = false;
            return;
        }

        const transcript = sections
            .map(s => `=== ${s.label} ===\n${s.lines.join('\n')}`)
            .join('\n\n');

        const estTokens = Math.round(transcript.length / 4);
        chaptersEstTokens = estTokens;
        const depthMax = getDepthMaxTokens(estTokens, chaptersDepthLevel);

        _chaptersSetStatus(`${totalMessages} MESSAGES · ${sections.length} CHATS · ~${estTokens.toLocaleString()} EST. TOKENS`);

        // Reveal sliders; set tokens max from depth cap and default to that cap
        const tokensRowEl = document.getElementById('chapters-sliders-wrap');
        const sliderEl = document.getElementById('chapters-tokens-slider');
        const tokensValueEl = document.getElementById('chapters-tokens-value');
        if (tokensRowEl) tokensRowEl.style.display = '';
        if (sliderEl) {
            sliderEl.max = depthMax;
            chaptersResponseTokens = depthMax;
            sliderEl.value = depthMax;
            if (tokensValueEl) tokensValueEl.textContent = `${depthMax.toLocaleString()} TOKENS`;
        }
        await _chaptersYield();

        chaptersGenerationPending = { transcript, type };

        if (btn) { btn.textContent = 'CONFIRM'; btn.disabled = false; }
    } catch (err) {
        console.error(`[${extensionName}] Chapter summary collection failed:`, err);
        _chaptersSetStatus(`ERROR: ${err.message}`);
        if (btn) btn.disabled = false;
    }
}

window.getMonopadTimeTracker = function () {
    const state = ensureTimeTrackerState();
    return {
        day: state.day,
        phase: state.phase,
        dayActionUsed: state.dayActionUsed,
        readout: getTimeReadoutLabel(state),
    };
};


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

function awardMonocoins(amount = 0, reason = "") {
    rewards?.awardMonocoins(resolveSkillParam("monocoinGen", amount), reason);
}

function deductMonocoins(amount = 0, reason = "") {
    rewards?.deductMonocoins(amount, reason);
}

function increaseTrustWithRewards(char) {
    rewards?.increaseTrustWithRewards(char);
}

function awardXp(amount = 0, reason = "") {
    rewards?.awardXp(resolveSkillParam("playerExp", amount), reason);
}

function openMonopadConfirmDialog({ title = "CONFIRM ACTION", message = "", confirmLabel = "CONFIRM", cancelLabel = "CANCEL" } = {}) {
    return new Promise((resolve) => {
        const overlay = document.getElementById("monopad-confirm-overlay");
        const titleEl = document.getElementById("monopad-confirm-title");
        const messageEl = document.getElementById("monopad-confirm-message");
        const confirmBtn = document.getElementById("monopad-confirm-accept");
        const cancelBtn = document.getElementById("monopad-confirm-cancel");

        if (!overlay || !titleEl || !messageEl || !confirmBtn || !cancelBtn) {
            resolve(false);
            return;
        }

        titleEl.textContent = title;
        messageEl.textContent = message;
        confirmBtn.textContent = confirmLabel;
        cancelBtn.textContent = cancelLabel;

        let settled = false;
        const finish = (accepted) => {
            if (settled) return;
            settled = true;
            overlay.classList.remove("open");
            overlay.setAttribute("aria-hidden", "true");
            overlay.removeEventListener("click", onBackdropClick);
            confirmBtn.removeEventListener("click", onConfirm);
            cancelBtn.removeEventListener("click", onCancel);
            resolve(Boolean(accepted));
        };

        const onBackdropClick = (event) => {
            if (event.target === overlay) finish(false);
        };
        const onConfirm = () => finish(true);
        const onCancel = () => finish(false);

        overlay.classList.add("open");
        overlay.setAttribute("aria-hidden", "false");

        overlay.addEventListener("click", onBackdropClick);
        confirmBtn.addEventListener("click", onConfirm);
        cancelBtn.addEventListener("click", onCancel);
    });
}

const truthBullets = [];

const truthBulletQueue = [];
let truthBulletAnimating = false;

/* =========================
   TRUTH BULLET FUNCTIONS
   ========================= */

const processedTruthSignatures = new Set();
const processedSocialSignatures = new Set();
const processedInvestigationSignatures = new Set();
const INVESTIGATION_START_PARSE_REGEX = /V3C\s*[|｜]\s*INVESTIGATION(?:\s*[_\-]?\s*)START\b/gi;
const processedMonokumaAnnouncementSignatures = new Set();
const PERSISTENT_MARKER_MAX_ENTRIES = 2400;

function normalizeTextToken(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[_\-]+/g, " ")
        .replace(/\s+/g, " ");
}

function getPersistentMarkerRegistry() {
    extension_settings[extensionName] ||= {};
    extension_settings[extensionName].markerRegistry ||= {};
    return extension_settings[extensionName].markerRegistry;
}

function getPersistentMarkerBucket(bucketKey) {
    const registry = getPersistentMarkerRegistry();
    registry[bucketKey] ||= {};
    return registry[bucketKey];
}

function cleanupPersistentMarkerBucket(bucket) {
    const keys = Object.keys(bucket);
    if (keys.length <= PERSISTENT_MARKER_MAX_ENTRIES) return;

    keys
        .sort((a, b) => Number(bucket[a] || 0) - Number(bucket[b] || 0))
        .slice(0, keys.length - PERSISTENT_MARKER_MAX_ENTRIES)
        .forEach((key) => {
            delete bucket[key];
        });
}

function hasProcessedPersistentMarker(bucketKey, persistentSignature = "") {
    if (!bucketKey || !persistentSignature) return false;
    const bucket = getPersistentMarkerBucket(bucketKey);
    return Boolean(bucket[persistentSignature]);
}

function markProcessedPersistentMarker(bucketKey, persistentSignature = "") {
    if (!bucketKey || !persistentSignature) return;
    const bucket = getPersistentMarkerBucket(bucketKey);
    bucket[persistentSignature] = Date.now();
    cleanupPersistentMarkerBucket(bucket);
    saveSettingsDebounced();
}

function buildGenericPersistentMarkerSignature(msgEl, markerType, markerIndex, markerOrdinal, rawText = "") {
    const mesId = msgEl?.getAttribute?.("mesid") || msgEl?.dataset?.mesid || "";
    if (!mesId || mesId === "no-id") return "";

    const speaker = msgEl?.getAttribute?.("ch_name") || msgEl?.getAttribute?.("name") || "unknown";
    const scope = getInvestigationScopeKey();
    if (!scope || scope === "scope:unknown") return "";

    const safeType = String(markerType || "unknown").toUpperCase();
    const safeIndex = Number.isFinite(Number(markerIndex)) ? Number(markerIndex) : -1;
    const safeOrdinal = Number.isFinite(Number(markerOrdinal)) ? Number(markerOrdinal) : -1;
    const textFingerprint = String(rawText || "").slice(0, 140);

    return `${safeType}||${scope}||${mesId}||${speaker}||${safeIndex}||${safeOrdinal}||${textFingerprint}`;
}

function getInvestigationMarkerStore() {
    extension_settings[extensionName] ||= {};
    extension_settings[extensionName].investigationMarkers ||= {};
    return extension_settings[extensionName].investigationMarkers;
}

function getInvestigationScopeKey() {
    const ctx = window.SillyTavern?.getContext?.();
    const groupId = ctx?.groupId ?? ctx?.group_id ?? "";
    const characterId = ctx?.characterId ?? ctx?.character_id ?? "";
    const chatId = ctx?.chatId ?? ctx?.chat_id ?? ctx?.chatFile ?? "";

    if (groupId !== "" && groupId !== null && groupId !== undefined) {
        return `group:${groupId}`;
    }

    if (characterId !== "" && characterId !== null && characterId !== undefined) {
        return `char:${characterId}`;
    }

    if (chatId) {
        return `chat:${chatId}`;
    }

    return "scope:unknown";
}

function buildPersistentInvestigationSignature(msgEl, marker, idx, rawText = "") {
    const mesId = msgEl?.getAttribute?.("mesid") || msgEl?.dataset?.mesid || "";
    if (!mesId || mesId === "no-id") return "";

    const speaker = msgEl?.getAttribute?.("ch_name") || "unknown";
    const scope = getInvestigationScopeKey();
    if (!scope || scope === "scope:unknown") return "";

    const markerIndex = Number(marker?.index ?? -1);
    const textFingerprint = String(rawText || "").slice(0, 140);

    return `INVESTIGATION||${scope}||${mesId}||${speaker}||${markerIndex}||${idx}||${textFingerprint}`;
}

function hasProcessedInvestigationSignature(signature, persistentSignature = "") {
    if (!signature) return false;
    if (processedInvestigationSignatures.has(signature)) return true;
    if (!persistentSignature) return false;
    return Boolean(getInvestigationMarkerStore()[persistentSignature]);
}

function markInvestigationSignatureProcessed(signature, persistentSignature = "") {
    if (!signature) return;

    processedInvestigationSignatures.add(signature);
    if (!persistentSignature) return;

    const store = getInvestigationMarkerStore();
    store[persistentSignature] = Date.now();

    cleanupPersistentMarkerBucket(store);

    saveSettingsDebounced();
}
function parseInvestigationStartMarkers(text) {
    const raw = String(text || "");
    if (!raw) return [];

    const matches = [];
    INVESTIGATION_START_PARSE_REGEX.lastIndex = 0;

    let match;
    while ((match = INVESTIGATION_START_PARSE_REGEX.exec(raw)) !== null) {
        matches.push({
            marker: match[0],
            index: match.index,
            source: "regex",
        });
    }

    if (matches.length) return matches;

    // Fallback parser for format drift (markdown wrappers / unusual punctuation).
    const lines = raw.split(/\r?\n/);
    let cursor = 0;

    for (const line of lines) {
        const canonical = line
            .toUpperCase()
            .replace(/[|｜]/g, "|")
            .replace(/[`*_~:;,.!?\-\s]/g, "");

        if (canonical.includes("V3C|INVESTIGATIONSTART")) {
            matches.push({
                marker: line,
                index: cursor,
                source: "fallback",
            });
        }

        cursor += line.length + 1;
    }

    return matches;
}

function getEquippedSkillsSnapshot() {
    const inventory = extension_settings[extensionName]?.inventory || {};
    const equipped = inventory.equippedSkills || {};
    return Object.keys(equipped).filter(skillId => Number(equipped[skillId] || 0) > 0);
}

// Aggregate the effects of all equipped Custom Skills into a flat modifier map:
//   { <paramKey>: { percent, absolute }, ... }
// Percents and absolutes each SUM additively across every equipped custom skill.
// Equipped IDs that aren't custom skills (built-in shop skills) are ignored here.
function getActiveSkillModifiers() {
    const inventory = extension_settings[extensionName]?.inventory || {};
    const customSkills = inventory.customSkills || {};
    const acc = {};
    for (const skillId of getEquippedSkillsSnapshot()) {
        const skill = customSkills[skillId];
        if (!skill || !Array.isArray(skill.effects)) continue;
        for (const effect of skill.effects) {
            const param = SKILL_PARAM_MAP[effect?.parameter];
            if (!param) continue;
            const bucket = acc[param.key] || (acc[param.key] = { percent: 0, absolute: 0 });
            const value = Number(effect.value) || 0;
            if (effect.valueType === "absolute") bucket.absolute += value;
            else bucket.percent += value;
        }
    }
    return acc;
}

// Resolve a single tunable parameter against the currently-equipped custom skills.
// `base` is the value the minigame would use with no skills equipped (may be dynamic).
// Returns the modified value, clamped to the parameter's safe range from the registry.
function resolveSkillParam(key, base) {
    const param = SKILL_PARAM_MAP[key];
    if (!param) return base;
    const mods = getActiveSkillModifiers();
    return applySkillModifier(base, mods[key], {
        clampMin: param.clampMin,
        clampMax: param.clampMax,
        integer: param.integer,
    });
}

// Collect per-emotion bias (percentage points) from equipped custom skills.
// Returns e.g. { love: 25, joy: 10 } — the chance each favored emotion is
// fired in place of whatever emotion would otherwise play.
function getEmotionBias() {
    const mods = getActiveSkillModifiers();
    const bias = {};
    for (const [key, mod] of Object.entries(mods)) {
        const param = SKILL_PARAM_MAP[key];
        if (!param?.emotion) continue;
        const pts = (Number(mod.percent) || 0) + (Number(mod.absolute) || 0);
        if (pts > 0) bias[param.emotionName] = (bias[param.emotionName] || 0) + pts;
    }
    return bias;
}

// Given the emotion that would otherwise fire, roll against equipped emotion-bias
// skills and possibly substitute a favored emotion. Each favored emotion occupies
// a slice of the 0–100 roll equal to its summed bias; the remainder keeps the
// original. Returns the (possibly overridden) emotion label.
function rollBiasedEmotion(emotion) {
    const bias = getEmotionBias();
    const entries = Object.entries(bias).filter(([, p]) => p > 0);
    if (!entries.length) return emotion;
    let roll = Math.random() * 100;
    for (const [emo, pts] of entries) {
        if (roll < pts) return emo;
        roll -= pts;
    }
    return emotion;
}

function getTruthBulletsSnapshot() {
    const bullets = extension_settings[extensionName]?.truthBullets;
    return Array.isArray(bullets) ? bullets : [];
}


function trySetVisualNovelToggleInObject(root, enabled, { maxDepth = 8 } = {}) {
    if (!root || typeof root !== "object") return false;

    const queue = [{ node: root, depth: 0 }];
    const visited = new WeakSet();
    let touched = false;

    while (queue.length) {
        const { node, depth } = queue.shift();
        if (!node || typeof node !== "object" || visited.has(node)) continue;
        visited.add(node);

        const label = normalizeTextToken(node.name || node.label || node.title || node.id || node.key || "");
        const isVisualNovelSetting = /visual/.test(label) && /novel|vn/.test(label) && /mode|toggle|enabled|active/.test(label);

        if (isVisualNovelSetting) {
            if (typeof node.enabled === "boolean") { node.enabled = enabled; touched = true; }
            if (typeof node.value === "boolean") { node.value = enabled; touched = true; }
            if (typeof node.active === "boolean") { node.active = enabled; touched = true; }
            if (typeof node.toggled === "boolean") { node.toggled = enabled; touched = true; }
            if (typeof node.isEnabled === "boolean") { node.isEnabled = enabled; touched = true; }
            if (typeof node.isActive === "boolean") { node.isActive = enabled; touched = true; }
            if (typeof node.setValue === "function") { node.setValue(enabled); touched = true; }
            if (typeof node.set === "function") { node.set(enabled); touched = true; }
        }

        if (depth >= maxDepth) continue;

        try {
            for (const value of Object.values(node)) {
                if (value && typeof value === "object") queue.push({ node: value, depth: depth + 1 });
            }
        } catch {
            // skip host objects that throw on traversal
        }
    }

    return touched;
}

function trySetSillyTavernVisualNovelMode(enabled) {
    const ctx = window.SillyTavern?.getContext?.();
    let touched = false;

    const candidates = [
        ctx?.chatCompletionSettings,
        ctx?.chat_completion_settings,
        ctx?.mainApiSettings,
        ctx?.main_api_settings,
        ctx?.settings,
        ctx,
        window.SillyTavern,
    ];

    for (const candidate of candidates) {
        try {
            touched = trySetVisualNovelToggleInObject(candidate, enabled) || touched;
        } catch {
            // ignore malformed hosts
        }
    }

    const domCandidates = Array.from(document.querySelectorAll('label, .menu_button, .inline-drawer-toggle, button, .toggle-item'));
    for (const el of domCandidates) {
        const labelText = normalizeTextToken(el.textContent || el.getAttribute('aria-label') || el.getAttribute('title') || '');
        if (!(/visual/.test(labelText) && /novel|vn/.test(labelText))) continue;

        const host = el.closest('label, .toggle-item, .settings-item, .menu_button, .inline-drawer-toggle') || el;
        const checkbox = host.querySelector('input[type="checkbox"]') || el.querySelector?.('input[type="checkbox"]');

        if (checkbox) {
            if (checkbox.checked !== enabled) {
                checkbox.click();
                checkbox.dispatchEvent(new Event('input', { bubbles: true }));
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            }
            touched = true;
            break;
        }

        const isPressed = host.getAttribute('aria-pressed') === 'true';
        if (isPressed !== enabled && typeof host.click === 'function') {
            host.click();
            touched = true;
            break;
        }

        if (isPressed === enabled) {
            touched = true;
            break;
        }
    }

    if (touched) {
        if (typeof ctx?.saveSettingsDebounced === 'function') {
            ctx.saveSettingsDebounced();
        } else {
            saveSettingsDebounced();
        }
    }

    return touched;
}

function createVnModeController() {
    const CHUNK_SIZE = 750;
    const VN_POSITION_KEY = `${extensionName}-vn-box-position`;
    const VN_STREAMING_KEY = `${extensionName}-vn-streaming-enabled`;
    let chunkIndex = 0;
    let messageIndex = 0;
    let monopadOpen = false;
    let moveUnlocked = false;
    let isDragging = false;
    let movedDuringPointer = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let frameStartX = 0;
    let frameStartY = 0;
    let framePosX = null;
    let framePosY = null;
    let transcriptOpen = false;
    let vnEnabled = false;
    let composeCollapsed = false;
    let lastObservedMessageCount = 0;
    let lastObservedLastSignature = '';
    let lastObservedChatScope = '';
    let streamingEnabled = true;
    let streamTimerId = null;
    let streamToken = 0;

    const host = document.createElement('div');
    host.id = 'dangan-vn-overlay';
    host.setAttribute('aria-hidden', 'true');
    host.innerHTML = `
        <div class="dangan-vn-frame" role="dialog" aria-live="polite" aria-label="Dangan Visual Novel dialogue">
            <div class="dangan-vn-controls">
                <button type="button" class="dangan-vn-control dangan-vn-stream-toggle" id="dangan-vn-stream-toggle" aria-label="Disable message streaming" title="Disable message streaming">STREAM: ON</button>
                <button type="button" class="dangan-vn-control dangan-vn-transcript-toggle" id="dangan-vn-transcript-toggle" aria-label="Open transcript" title="Open transcript">TRANSCRIPT</button>
                <button type="button" class="dangan-vn-control dangan-vn-manage-chat-files" id="dangan-vn-manage-chat-files" aria-label="Manage chat files" title="Manage chat files">FILES</button>
                <button type="button" class="dangan-vn-control dangan-vn-extra-actions" id="dangan-vn-extra-actions" aria-label="Message actions" title="Message actions">···</button>
                <button type="button" class="dangan-vn-control dangan-vn-edit-message" id="dangan-vn-edit-message" aria-label="Edit current message" title="Edit current message">✏</button>
                <button type="button" class="dangan-vn-control dangan-vn-clear-chat" id="dangan-vn-clear-chat" aria-label="Clear all chat messages" title="Clear all chat messages">🗑</button>
                <button type="button" class="dangan-vn-control dangan-vn-lock" id="dangan-vn-lock" aria-label="Unlock Visual Novel box movement" title="Unlock Visual Novel box movement">🔒</button>
            </div>
            <div class="dangan-vn-header">
                <div class="dangan-vn-nameplate" id="dangan-vn-name">—</div>
                <div class="dangan-vn-position" id="dangan-vn-position" aria-live="polite">Line 0 / 0</div>
            </div>
            <div class="dangan-vn-text-wrap">
                <div class="dangan-vn-text" id="dangan-vn-text">Visual Novel Mode ready.</div>
            </div>
            <div class="dangan-vn-footer">
                <div class="dangan-vn-progress" aria-hidden="true"><div class="dangan-vn-progress-fill" id="dangan-vn-progress-fill"></div></div>
                <div class="dangan-vn-input">Click text / ← → / Space · Type in SillyTavern below</div>
                <div class="dangan-vn-nav">
                    <button type="button" class="dangan-vn-control dangan-vn-nav-button" id="dangan-vn-prev" aria-label="Show previous line">◀ Prev</button>
                    <button type="button" class="dangan-vn-control dangan-vn-nav-button" id="dangan-vn-next" aria-label="Show next line">Next ▶</button>
                    <button type="button" class="dangan-vn-control dangan-vn-nav-button dangan-vn-latest" id="dangan-vn-latest" aria-label="Jump to latest reply">⤓ Latest</button>
                    <button type="button" class="dangan-vn-control dangan-vn-nav-button dangan-vn-regenerate" id="dangan-vn-regenerate" aria-label="Regenerate current reply">↻ Regen</button>
                </div>
            </div>
        </div>
        <div class="dangan-vn-transcript" id="dangan-vn-transcript" aria-hidden="true">
            <div class="dangan-vn-transcript-header">
                <div class="dangan-vn-transcript-title">Class Transcript</div>
                <button type="button" class="dangan-vn-transcript-close" id="dangan-vn-transcript-close" aria-label="Close transcript">✕</button>
            </div>
            <div class="dangan-vn-transcript-body" id="dangan-vn-transcript-body"></div>
        </div>
    `;
    document.body.appendChild(host);

    const frameEl = host.querySelector('.dangan-vn-frame');
    const streamToggleEl = host.querySelector('#dangan-vn-stream-toggle');
    const lockBtnEl = host.querySelector('#dangan-vn-lock');
    const transcriptToggleEl = host.querySelector('#dangan-vn-transcript-toggle');
    const manageChatFilesBtnEl = host.querySelector('#dangan-vn-manage-chat-files');
    const transcriptEl = host.querySelector('#dangan-vn-transcript');
    const transcriptCloseEl = host.querySelector('#dangan-vn-transcript-close');
    const transcriptBodyEl = host.querySelector('#dangan-vn-transcript-body');
    const nameEl = host.querySelector('#dangan-vn-name');
    const positionEl = host.querySelector('#dangan-vn-position');
    const textEl = host.querySelector('#dangan-vn-text');
    const progressFillEl = host.querySelector('#dangan-vn-progress-fill');
    const prevBtnEl = host.querySelector('#dangan-vn-prev');
    const nextBtnEl = host.querySelector('#dangan-vn-next');
    const latestBtnEl = host.querySelector('#dangan-vn-latest');
    const regenerateBtnEl = host.querySelector('#dangan-vn-regenerate');
    const extraActionsBtnEl = host.querySelector('#dangan-vn-extra-actions');
    const editMessageBtnEl = host.querySelector('#dangan-vn-edit-message');
    const clearChatBtnEl = host.querySelector('#dangan-vn-clear-chat');
    const latestButtonBaseLabel = '⤓ Latest';


    function isElementVisible(el) {
        if (!(el instanceof Element)) return false;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    function getRegenerateControl() {
        const controls = Array.from(document.querySelectorAll('button, .menu_button, [role="button"], a'));
        for (const control of controls) {
            if (!(control instanceof Element)) continue;
            if (control.closest('#dangan-vn-overlay')) continue;
            const label = `${control.getAttribute('aria-label') || ''} ${control.getAttribute('title') || ''} ${control.textContent || ''}`.toLowerCase();
            if (!/\bregenerate\b/.test(label)) continue;
            if (!isElementVisible(control)) continue;
            return control;
        }
        return null;
    }

    function triggerRegenerate() {
        const control = getRegenerateControl();
        if (!control) return false;
        if (typeof control.click === 'function') {
            control.click();
            return true;
        }
        control.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        return true;
    }

    function stopTextStreaming() {
        streamToken += 1;
        if (streamTimerId !== null) {
            clearTimeout(streamTimerId);
            streamTimerId = null;
        }
        textEl?.classList.remove('dangan-vn-text-streaming');
    }

    function loadStreamingPreference() {
        try {
            const raw = localStorage.getItem(VN_STREAMING_KEY);
            if (raw === '0') streamingEnabled = false;
            else if (raw === '1') streamingEnabled = true;
        } catch {
            // ignore storage errors
        }
    }

    function persistStreamingPreference() {
        try {
            localStorage.setItem(VN_STREAMING_KEY, streamingEnabled ? '1' : '0');
        } catch {
            // ignore storage errors
        }
    }

    function refreshStreamingToggle() {
        if (!streamToggleEl) return;
        streamToggleEl.textContent = streamingEnabled ? 'STREAM: ON' : 'STREAM: OFF';
        streamToggleEl.setAttribute('aria-pressed', streamingEnabled ? 'true' : 'false');
        streamToggleEl.setAttribute('aria-label', streamingEnabled ? 'Disable message streaming' : 'Enable message streaming');
        streamToggleEl.setAttribute('title', streamingEnabled ? 'Disable message streaming' : 'Enable message streaming');
    }

    const escVnHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Parse VN markup into a flat list of { className, text } segments, where `text`
    // is the *visible* text with markup delimiters already stripped. Rendering and
    // streaming both build from these so formatting is applied before any character is
    // shown (delimiters like *, ** and " never appear raw in the UI).
    function tokenizeVnMarkup(text) {
        const segments = [];
        let hasAction = false;

        // Split bold/italic within a string, wrapping plain runs in `baseClass`
        const pushSpans = (str, baseClass) => {
            const inner = /(\*\*[\s\S]+?\*\*|\*[\s\S]+?\*)/g;
            let last = 0;
            let m;
            while ((m = inner.exec(str)) !== null) {
                if (m.index > last) {
                    segments.push({ className: baseClass, text: str.slice(last, m.index) });
                }
                const r = m[0];
                if (r.startsWith('**')) {
                    segments.push({ className: 'dangan-vn-segment dangan-vn-segment-bold', text: r.slice(2, -2) });
                } else {
                    segments.push({ className: 'dangan-vn-segment dangan-vn-segment-action', text: r.slice(1, -1) });
                }
                last = m.index + r.length;
            }
            if (last < str.length) segments.push({ className: baseClass, text: str.slice(last) });
        };

        const pattern = /(\*\*[\s\S]+?\*\*|\*[\s\S]+?\*|"[^"]*")/g;
        let lastIndex = 0;
        let match;

        while ((match = pattern.exec(text)) !== null) {
            if (match.index > lastIndex) {
                pushSpans(
                    text.slice(lastIndex, match.index),
                    'dangan-vn-segment dangan-vn-segment-narrator'
                );
            }
            const raw = match[0];
            if (raw.startsWith('**')) {
                segments.push({ className: 'dangan-vn-segment dangan-vn-segment-bold', text: raw.slice(2, -2) });
            } else if (raw.startsWith('*')) {
                hasAction = true;
                segments.push({ className: 'dangan-vn-segment dangan-vn-segment-action', text: raw.slice(1, -1) });
            } else {
                // Dialogue — process nested bold/italic inside the quotes
                pushSpans(raw, 'dangan-vn-segment dangan-vn-segment-dialogue');
            }
            lastIndex = match.index + raw.length;
        }
        if (lastIndex < text.length) {
            pushSpans(
                text.slice(lastIndex),
                'dangan-vn-segment dangan-vn-segment-narrator'
            );
        }
        return { segments, hasAction };
    }

    // Render the first `visibleCount` visible characters of `segments` as formatted
    // HTML. Passing Infinity (the default) renders the whole thing.
    function renderVnSegments(segments, visibleCount = Infinity) {
        let remaining = visibleCount;
        let html = '';
        for (const seg of segments) {
            if (remaining <= 0) break;
            const slice = seg.text.length <= remaining ? seg.text : seg.text.slice(0, remaining);
            html += `<span class="${seg.className}">${escVnHtml(slice)}</span>`;
            remaining -= slice.length;
        }
        return html;
    }

    function parseVnMarkup(text) {
        const { segments, hasAction } = tokenizeVnMarkup(text);
        const html = renderVnSegments(segments);
        return { html: html || escVnHtml(text), hasAction };
    }

    function applyVnMarkup(targetText) {
        if (!textEl) return;
        const { html, hasAction } = parseVnMarkup(targetText);
        textEl.innerHTML = html;
        textEl.classList.toggle('has-action', hasAction);
    }

    function renderDialogueText(text) {
        const targetText = String(text || '...');
        stopTextStreaming();
        if (!textEl) return;

        if (!streamingEnabled || targetText.length < 2) {
            applyVnMarkup(targetText);
            return;
        }

        // Pre-parse the full response so formatting is applied up front; stream by
        // revealing visible characters of the already-formatted segments.
        const { segments, hasAction } = tokenizeVnMarkup(targetText);
        const totalVisible = segments.reduce((sum, seg) => sum + seg.text.length, 0);
        textEl.classList.toggle('has-action', hasAction);

        if (totalVisible < 1) {
            applyVnMarkup(targetText);
            return;
        }

        const token = streamToken;
        let revealed = 0;
        const step = () => {
            if (token != streamToken || !textEl) return;
            if (revealed >= totalVisible) {
                textEl.classList.remove('dangan-vn-text-streaming');
                streamTimerId = null;
                textEl.innerHTML = renderVnSegments(segments);
                return;
            }

            const remaining = totalVisible - revealed;
            const delta = remaining > 40 ? 3 : remaining > 18 ? 2 : 1;
            revealed = Math.min(totalVisible, revealed + delta);
            textEl.innerHTML = renderVnSegments(segments, revealed);
            textEl.classList.add('dangan-vn-text-streaming');
            streamTimerId = setTimeout(step, 14);
        };

        textEl.innerHTML = '';
        step();
    }

    function updateNavigationState(messages = getMessageEntries()) {
        const total = messages.length;
        const current = total ? Math.min(total, messageIndex + 1) : 0;
        if (positionEl) {
            positionEl.textContent = `Line ${current} / ${total}`;
        }

        const hasPrevious = total > 0 && (chunkIndex > 0 || messageIndex > 0);
        const hasNext = (() => {
            if (!total) return false;
            const currentEntry = messages[Math.min(messageIndex, total - 1)];
            const chunks = splitIntoChunks(stripV3CMarkersFromText(currentEntry?.text || ''));
            const canAdvanceWithinCurrent = chunkIndex + 1 < chunks.length;
            const canAdvanceToNext = messageIndex < total - 1;
            return canAdvanceWithinCurrent || canAdvanceToNext;
        })();

        if (prevBtnEl) prevBtnEl.disabled = !hasPrevious;
        if (nextBtnEl) nextBtnEl.disabled = !hasNext;
        if (latestBtnEl) {
            const unreadCount = Math.max(0, total - (messageIndex + 1));
            latestBtnEl.disabled = total < 2 || unreadCount === 0;
            latestBtnEl.textContent = unreadCount > 0 ? `${latestButtonBaseLabel} (${unreadCount})` : latestButtonBaseLabel;
        }
        if (regenerateBtnEl) regenerateBtnEl.disabled = !getRegenerateControl();
        if (progressFillEl) {
            const percent = total > 0 ? Math.max(0, Math.min(100, Math.round((current / total) * 100))) : 0;
            progressFillEl.style.width = `${percent}%`;
        }
    }

    function applyInlineFallbackStyles() {
        Object.assign(host.style, {
            position: 'fixed',
            inset: '0',
            zIndex: '2500',
            display: 'none',
            alignItems: 'flex-end',
            justifyContent: 'center',
            pointerEvents: 'none',
            background: 'transparent',
        });

        if (frameEl) {
            Object.assign(frameEl.style, {
                width: 'min(980px, calc(100vw - 18px))',
                minHeight: '170px',
                margin: '0 9px 10px',
                borderRadius: '12px',
                border: '1px solid rgba(191, 229, 255, 0.45)',
                background: 'linear-gradient(180deg, rgba(8, 12, 20, 0.96), rgba(6, 9, 14, 0.97))',
                boxShadow: '0 -3px 20px rgba(0, 0, 0, 0.45)',
                color: '#f4f8ff',
                padding: '14px 14px 10px',
                cursor: 'pointer',
                pointerEvents: 'auto',
            });
        }
    }

    function ensureHostAttached() {
        if (host.parentElement !== document.body) {
            document.body.appendChild(host);
        }
    }

    function clampPosition(nextX, nextY) {
        if (!frameEl) return { x: 0, y: 0 };

        const vw = window.innerWidth || document.documentElement.clientWidth || 0;
        const vh = window.innerHeight || document.documentElement.clientHeight || 0;
        const rect = frameEl.getBoundingClientRect();
        const maxX = Math.max(0, Math.round(vw - rect.width));
        const maxY = Math.max(0, Math.round(vh - rect.height));

        return {
            x: Math.max(0, Math.min(maxX, Math.round(nextX))),
            y: Math.max(0, Math.min(maxY, Math.round(nextY))),
        };
    }

    function savePosition() {
        if (!Number.isFinite(framePosX) || !Number.isFinite(framePosY)) return;
        try {
            localStorage.setItem(VN_POSITION_KEY, JSON.stringify({ x: framePosX, y: framePosY }));
        } catch {
            // ignore storage failures
        }
    }

    function clearSavedPosition() {
        try {
            localStorage.removeItem(VN_POSITION_KEY);
        } catch {
            // ignore storage failures
        }
    }

    function setFramePosition(nextX, nextY) {
        if (!frameEl) return;
        const { x, y } = clampPosition(nextX, nextY);
        framePosX = x;
        framePosY = y;
        frameEl.classList.add('dangan-vn-custom-pos');
        frameEl.style.left = `${x}px`;
        frameEl.style.top = `${y}px`;
    }

    function resetFramePosition() {
        if (!frameEl) return;
        framePosX = null;
        framePosY = null;
        frameEl.classList.remove('dangan-vn-custom-pos');
        frameEl.style.left = '';
        frameEl.style.top = '';
        clearSavedPosition();
    }

    function restoreSavedPosition() {
        try {
            const raw = localStorage.getItem(VN_POSITION_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (!parsed || !Number.isFinite(parsed.x) || !Number.isFinite(parsed.y)) return;
            setFramePosition(parsed.x, parsed.y);
        } catch {
            // ignore storage failures
        }
    }

    function setMoveUnlocked(unlocked) {
        moveUnlocked = !!unlocked;
        if (!lockBtnEl) return;
        lockBtnEl.textContent = moveUnlocked ? '🔓' : '🔒';
        lockBtnEl.setAttribute('aria-label', moveUnlocked ? 'Lock Visual Novel box movement' : 'Unlock Visual Novel box movement');
        lockBtnEl.setAttribute('title', moveUnlocked ? 'Lock Visual Novel box movement' : 'Unlock Visual Novel box movement');
        frameEl?.classList.toggle('move-unlocked', moveUnlocked);
    }

    function setTranscriptOpen(open) {
        transcriptOpen = !!open;
        host.classList.toggle('transcript-open', transcriptOpen);
        transcriptEl?.setAttribute('aria-hidden', transcriptOpen ? 'false' : 'true');
        transcriptToggleEl?.setAttribute('aria-expanded', transcriptOpen ? 'true' : 'false');
        if (transcriptOpen) {
            renderTranscript();
        }
    }

    function getManageChatFilesControl() {
        const directMatch = document.getElementById('option_select_chat');
        if (directMatch && !directMatch.closest('#dangan-vn-overlay')) return directMatch;

        const controls = Array.from(document.querySelectorAll('button, .menu_button, [role="button"], a'));
        for (const control of controls) {
            if (!(control instanceof Element)) continue;
            if (control.closest('#dangan-vn-overlay')) continue;
            const label = `${control.getAttribute('aria-label') || ''} ${control.getAttribute('title') || ''} ${control.textContent || ''}`.toLowerCase();
            if (!label.includes('manage chat files')) continue;
            if (!isElementVisible(control)) continue;
            return control;
        }

        return null;
    }

    function openManageChatFiles() {
        const control = getManageChatFilesControl();
        if (!control) return false;
        if (window.$) {
            window.$(control).trigger('click');
            return true;
        }
        if (typeof control.click === 'function') {
            control.click();
            return true;
        }
        control.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        return true;
    }

    function updateBottomOffset() {
        if (!frameEl) return;

        if (vnEnabled) {
            host.style.setProperty('--dangan-vn-bottom-offset', '0px');
            return;
        }

        const composeEl = document.querySelector('#send_form, #chat_input_container, #send_textarea, #send_textarea_holder, .send_form');
        const composeRect = composeEl?.getBoundingClientRect?.();
        const composeHeight = Number.isFinite(composeRect?.height) ? composeRect.height : 0;
        const offset = Math.max(0, Math.round(composeHeight + 8));
        host.style.setProperty('--dangan-vn-bottom-offset', `${offset}px`);
    }

    function syncMonopadVisibility() {
        const shouldHideFrame = monopadOpen;
        if (!frameEl) return;
        frameEl.style.display = shouldHideFrame ? 'none' : '';
    }

    function getComposeElement() {
        return document.querySelector('#send_form, #chat_input_container, #send_textarea_holder, .send_form');
    }

    function undockTypingSection() {
        const composeEl = getComposeElement();
        if (!composeEl) return;
        const toggleBtn = composeEl.querySelector('.dangan-vn-compose-collapse-toggle');
        toggleBtn?.remove();
        composeCollapsed = false;
        composeEl.classList.remove('dangan-vn-compose-docked');
        composeEl.classList.remove('dangan-vn-compose-collapsed');
        composeEl.style.position = '';
        composeEl.style.left = '';
        composeEl.style.top = '';
        composeEl.style.width = '';
        composeEl.style.maxWidth = '';
        composeEl.style.margin = '';
        composeEl.style.transform = '';
        composeEl.style.zIndex = '';
        document.body.classList.remove('dangan-vn-compose-docked-active');
    }

    function ensureComposeCollapseToggle(composeEl) {
        if (!composeEl) return;

        let toggleBtn = composeEl.querySelector('.dangan-vn-compose-collapse-toggle');
        if (!toggleBtn) {
            toggleBtn = document.createElement('button');
            toggleBtn.type = 'button';
            toggleBtn.className = 'dangan-vn-compose-collapse-toggle';
            toggleBtn.textContent = '▾';
            toggleBtn.title = 'Collapse typing section';
            toggleBtn.setAttribute('aria-label', 'Collapse typing section');
            composeEl.prepend(toggleBtn);

            toggleBtn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                composeCollapsed = !composeCollapsed;
                composeEl.classList.toggle('dangan-vn-compose-collapsed', composeCollapsed);
                toggleBtn.textContent = composeCollapsed ? '▸' : '▾';
                toggleBtn.title = composeCollapsed ? 'Expand typing section' : 'Collapse typing section';
                toggleBtn.setAttribute('aria-label', composeCollapsed ? 'Expand typing section' : 'Collapse typing section');
            });
        }
    }

    function dockTypingSection() {
        const composeEl = getComposeElement();
        if (!composeEl) return;

        if (!vnEnabled || monopadOpen || frameEl?.style.display === 'none') {
            undockTypingSection();
            return;
        }

        const frameRect = frameEl?.getBoundingClientRect?.();
        if (!frameRect || !Number.isFinite(frameRect.width)) {
            undockTypingSection();
            return;
        }

        const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
        const composeRect = composeEl.getBoundingClientRect();
        const composeHeight = Number.isFinite(composeRect.height) ? composeRect.height : 52;

        const width = Math.max(220, Math.round(frameRect.width));
        const maxLeft = Math.max(0, viewportWidth - width);
        const left = Math.max(0, Math.min(maxLeft, Math.round(frameRect.left)));
        const maxTop = Math.max(0, viewportHeight - composeHeight - 4);
        const top = Math.max(0, Math.min(maxTop, Math.round(frameRect.bottom - 1)));

        ensureComposeCollapseToggle(composeEl);
        composeEl.classList.add('dangan-vn-compose-docked');
        composeEl.classList.toggle('dangan-vn-compose-collapsed', composeCollapsed);
        composeEl.style.position = 'fixed';
        composeEl.style.left = `${left}px`;
        composeEl.style.top = `${top}px`;
        composeEl.style.width = `${width}px`;
        composeEl.style.maxWidth = `${width}px`;
        composeEl.style.margin = '0';
        composeEl.style.transform = 'none';
        composeEl.style.zIndex = '2147483644';
        document.body.classList.add('dangan-vn-compose-docked-active');
    }

    applyInlineFallbackStyles();
    loadStreamingPreference();
    refreshStreamingToggle();
    updateBottomOffset();
    syncMonopadVisibility();
    restoreSavedPosition();
    setMoveUnlocked(false);

    const htmlDecodeBuffer = document.createElement('div');
    const toPlainText = (value) => {
        const raw = String(value || '').trim();
        if (!raw) return '';
        htmlDecodeBuffer.innerHTML = raw;
        return String(htmlDecodeBuffer.textContent || htmlDecodeBuffer.innerText || '').trim();
    };

    function getContextMessages() {
        const ctx = window.SillyTavern?.getContext?.();
        const chat = Array.isArray(ctx?.chat) ? ctx.chat : [];

        return chat.map((msg, idx) => {
            const isUser = String(msg?.is_user ?? msg?.isUser ?? '').toLowerCase() === 'true' || msg?.is_user === true || msg?.isUser === true;
            const isSystem = String(msg?.is_system ?? msg?.isSystem ?? msg?.is_system_message ?? '').toLowerCase() === 'true' || msg?.is_system === true || msg?.isSystem === true || msg?.is_system_message === true;
            const name = String(msg?.name || msg?.ch_name || msg?.character_name || msg?.display_name || '').trim();
            const textRaw = msg?.mes ?? msg?.message ?? msg?.content ?? msg?.swipe_info?.[msg?.swipe_id || 0]?.mes ?? '';
            const text = toPlainText(textRaw);

            return {
                key: `ctx-${idx}`,
                isUser,
                isSystem,
                name,
                text,
            };
        }).filter(msg => !msg.isSystem && msg.text);
    }

    function getDomMessages() {
        return Array.from(document.querySelectorAll('.mes')).map((msgEl, idx) => {
            const isUser = msgEl.getAttribute('is_user') === 'true';
            const isSystem = msgEl.getAttribute('is_system') === 'true';
            const name = String(msgEl.getAttribute('ch_name') || msgEl.getAttribute('name') || '').trim();
            const mesTextEl = msgEl.querySelector('.mes_text');
            const html = mesTextEl?.innerHTML || mesTextEl?.textContent || '';
            const text = toPlainText(html);
            return { key: `dom-${idx}`, isUser, isSystem, name, text, html };
        }).filter(msg => !msg.isSystem && msg.text);
    }

    function getMessageEntries() {
        const byContext = getContextMessages();
        if (byContext.length) return byContext;
        const byDom = getDomMessages();
        if (byDom.length) return byDom;
        return [];
    }

    function getChatScopeSignature() {
        const ctx = window.SillyTavern?.getContext?.();
        const groupId = ctx?.groupId ?? ctx?.group_id ?? '';
        const characterId = ctx?.characterId ?? ctx?.character_id ?? '';
        const chatId = ctx?.chatId ?? ctx?.chat_id ?? ctx?.chatFile ?? '';

        if (groupId !== '' && groupId !== null && groupId !== undefined) {
            return `group:${groupId}`;
        }
        if (characterId !== '' && characterId !== null && characterId !== undefined) {
            return `char:${characterId}`;
        }
        if (chatId) {
            return `chat:${chatId}`;
        }

        return 'scope:unknown';
    }

    function getMessageSignature(entry) {
        if (!entry) return '';
        return `${entry.key || ''}::${entry.name || ''}::${entry.text || ''}`;
    }

    function renderTranscript() {
        if (!transcriptBodyEl) return;

        // Use the same raw-text source as the VN box so *markers* are preserved
        // for parseVnMarkup to colour action/bold/dialogue segments correctly.
        // (getDomMessages strips * markers — ST already rendered them to <em> in the DOM.)
        const entries = getMessageEntries();
        transcriptBodyEl.innerHTML = '';

        if (!entries.length) {
            const emptyEl = document.createElement('div');
            emptyEl.className = 'dangan-vn-transcript-empty';
            emptyEl.textContent = 'No transcript entries yet.';
            transcriptBodyEl.appendChild(emptyEl);
            return;
        }

        // Copy only the font-family from the chat; size/line-height stay as the transcript
        // defines them — the chat's configured font size is often very small and would make
        // the transcript unreadable if copied verbatim.
        const sampleMesText = document.querySelector('.mes .mes_text');
        const chatFontFamily = sampleMesText
            ? getComputedStyle(sampleMesText).fontFamily
            : null;

        for (const entry of entries) {
            const row = document.createElement('div');
            row.className = 'dangan-vn-transcript-entry';

            const speaker = document.createElement('div');
            speaker.className = 'dangan-vn-transcript-speaker';
            speaker.textContent = entry.name || 'UNKNOWN';

            const message = document.createElement('div');
            message.className = 'dangan-vn-transcript-message';
            if (chatFontFamily) {
                message.style.fontFamily = chatFontFamily;
            }

            // Use the same VN markup parser so colours match what the VN text box shows
            // (*action* → green, **bold** → orange, "dialogue" → white, narrator → body colour).
            const cleanText = stripV3CMarkersFromText(entry.text || '').replace(/\s+/g, ' ').trim();
            message.innerHTML = cleanText ? parseVnMarkup(cleanText).html : '...';

            row.appendChild(speaker);
            row.appendChild(message);
            transcriptBodyEl.appendChild(row);
        }
    }

    function splitIntoChunks(text = '') {
        const normalized = String(text || '').replace(/\s+/g, ' ').trim();
        if (!normalized) return [];

        // Split on sentence-ending punctuation:
        //   ."  !"  ?"  — punctuation + closing quote → split after the quote (always)
        //   ".          — closing quote + single period → split after the period (always)
        //   .  !  ?     — bare punctuation outside of speech marks → split after it
        //                 (bare . also skips ellipses: not preceded or followed by another dot)
        const splitPositions = [];
        let inQuotes = false;
        for (let i = 0; i < normalized.length; i++) {
            const c    = normalized[i];
            const prev = i > 0 ? normalized[i - 1] : '';
            const next = i + 1 < normalized.length ? normalized[i + 1] : '';

            if (c === '"') {
                inQuotes = !inQuotes;
                // ". — closing quote then single period → split after the period
                if (next === '.') {
                    const afterDot = i + 2 < normalized.length ? normalized[i + 2] : '';
                    if (afterDot !== '.') splitPositions.push(i + 2);
                }
                continue;
            }

            if (c === '.' && next === '"') {
                // ." — skip if this dot is part of an ellipsis
                if (prev !== '.') splitPositions.push(i + 2);
            } else if ((c === '!' || c === '?') && next === '"') {
                // !" / ?" — always split after the closing quote
                splitPositions.push(i + 2);
            } else if (!inQuotes) {
                if (c === '.' && prev !== '.' && next !== '.') {
                    splitPositions.push(i + 1);
                } else if (c === '!' || c === '?') {
                    splitPositions.push(i + 1);
                }
            }
        }

        // Build natural sentences from split positions (or treat whole text as one sentence).
        const sentences = [];
        let start = 0;
        for (const pos of splitPositions) {
            const s = normalized.slice(start, pos).trim();
            if (s) sentences.push(s);
            start = pos;
        }
        const last = normalized.slice(start).trim();
        if (last) sentences.push(last);

        // Second pass: hard-cap each sentence at CHUNK_SIZE on a word boundary.
        // This ensures no chunk ever exceeds the limit even if no ." / ". exists.
        const chunks = [];
        for (const sentence of sentences) {
            if (sentence.length <= CHUNK_SIZE) {
                chunks.push(sentence);
                continue;
            }
            let rem = sentence;
            while (rem.length > CHUNK_SIZE) {
                const spaceAt = rem.lastIndexOf(' ', CHUNK_SIZE);
                const cutAt   = spaceAt > 0 ? spaceAt : CHUNK_SIZE;
                chunks.push(rem.slice(0, cutAt + 1).trim());
                rem = rem.slice(cutAt + 1).trim();
            }
            if (rem) chunks.push(rem);
        }
        return chunks;
    }

    function pulseText() {
        if (!textEl) return;
        textEl.classList.remove('dangan-vn-text-pulse');
        requestAnimationFrame(() => {
            textEl.classList.add('dangan-vn-text-pulse');
        });
    }


    function renderCurrent() {
        const messages = getMessageEntries();
        if (!messages.length) {
            nameEl.textContent = 'SYSTEM';
            renderDialogueText('No character replies available yet. Send a message and wait for a character response.');
            updateNavigationState(messages);
            return;
        }

        messageIndex = Math.max(0, Math.min(messageIndex, messages.length - 1));

        const entry = messages[messageIndex];
        if (entry?.name) trialManager?.updateGroupChatSpeaker?.(entry.name);
        const clean = stripV3CMarkersFromText(entry.text).replace(/\s+/g, ' ').trim();
        const chunks = splitIntoChunks(clean);

        // Mask the VN nameplate behind ??? until the speaker has been
        // /introduce'd — same global toggle that drives the overworld /
        // minimap / trial sticker labels.
        const maskedName = entry.name ? getCharacterDisplayName(entry.name) : 'UNKNOWN';

        if (!chunks.length) {
            nameEl.textContent = maskedName;
            renderDialogueText('...');
            updateNavigationState(messages);
            return;
        }

        chunkIndex = Math.max(0, Math.min(chunkIndex, chunks.length - 1));
        nameEl.textContent = maskedName;
        renderDialogueText(chunks[chunkIndex]);
        updateNavigationState(messages);
        pulseText();
    }

    function advance() {
        const messages = getMessageEntries();
        if (!messages.length) {
            renderCurrent();
            return;
        }

        if (messageIndex >= messages.length - 1) {
            const currentEntry = messages[messages.length - 1];
            const currentChunks = splitIntoChunks(stripV3CMarkersFromText(currentEntry?.text || ''));
            if (chunkIndex >= Math.max(0, currentChunks.length - 1)) {
                return;
            }
        }

        const entry = messages[Math.min(messageIndex, messages.length - 1)];
        const chunks = splitIntoChunks(stripV3CMarkersFromText(entry.text));

        if (chunkIndex + 1 < chunks.length) {
            chunkIndex += 1;
        } else {
            messageIndex = Math.min(messages.length - 1, messageIndex + 1);
            chunkIndex = 0;
        }

        renderCurrent();
    }

    function retreat() {
        const messages = getMessageEntries();
        if (!messages.length) {
            renderCurrent();
            return;
        }

        const entry = messages[Math.min(messageIndex, messages.length - 1)];
        const chunks = splitIntoChunks(stripV3CMarkersFromText(entry.text));

        if (chunkIndex > 0) {
            chunkIndex -= 1;
        } else if (messageIndex > 0) {
            messageIndex -= 1;
            const previousEntry = messages[messageIndex];
            const previousChunks = splitIntoChunks(stripV3CMarkersFromText(previousEntry.text));
            chunkIndex = Math.max(0, previousChunks.length - 1);
        } else if (chunks.length) {
            chunkIndex = 0;
        }

        renderCurrent();
    }

    function jumpToLatest() {
        const messages = getMessageEntries();
        messageIndex = Math.max(0, messages.length - 1);
        const latest = messages[messageIndex];
        const latestChunks = splitIntoChunks(stripV3CMarkersFromText(latest?.text || ''));
        chunkIndex = Math.max(0, latestChunks.length - 1);
        renderCurrent();
    }

    function jumpToLatestFromStart() {
        const messages = getMessageEntries();
        messageIndex = Math.max(0, messages.length - 1);
        chunkIndex = 0;
        renderCurrent();
    }

    lockBtnEl?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (moveUnlocked) {
            setMoveUnlocked(false);
            if (Number.isFinite(framePosX) && Number.isFinite(framePosY)) {
                savePosition();
            }
            return;
        }

        setMoveUnlocked(true);
    });

    clearChatBtnEl?.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const confirmed = window.confirm('Clear all messages from this chat? This cannot be undone.');
        if (!confirmed) return;
        const ctx = window.SillyTavern?.getContext?.();
        if (typeof ctx?.clearChat === 'function') {
            await ctx.clearChat({ clearData: true });
            if (typeof ctx.saveChat === 'function') {
                await ctx.saveChat();
            }
            messageIndex = 0;
            chunkIndex = 0;
            renderCurrent();
        }
    });

    streamToggleEl?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        streamingEnabled = !streamingEnabled;
        persistStreamingPreference();
        refreshStreamingToggle();
        renderCurrent();
    });

    transcriptToggleEl?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        setTranscriptOpen(!transcriptOpen);
    });

    transcriptCloseEl?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        setTranscriptOpen(false);
    });

    manageChatFilesBtnEl?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        openManageChatFiles();
    });

    prevBtnEl?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        playSfx(sfx.message_move);
        retreat();
    });

    nextBtnEl?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        playSfx(sfx.message_move);
        advance();
    });

    latestBtnEl?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        playSfx(sfx.message_move);
        jumpToLatest();
    });

    regenerateBtnEl?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        triggerRegenerate();
        updateNavigationState();
    });

    function getVnMesIdx() {
        const messages = getMessageEntries();
        if (!messages.length) return null;
        const entry = messages[Math.min(messageIndex, messages.length - 1)];
        if (!entry?.key) return null;
        if (entry.key.startsWith('ctx-')) return parseInt(entry.key.slice(4), 10);
        return null;
    }

    function openVnEditMode() {
        if (host.querySelector('.dangan-vn-inline-edit')) return;
        const ctx = window.SillyTavern?.getContext?.();
        const idx = getVnMesIdx();
        if (idx == null || !ctx?.chat?.[idx]) return;

        const mesEl = document.querySelector(`#chat .mes[mesid="${idx}"]`);
        if (!mesEl) return;

        // Activate ST's native edit mode to set up this_edit_mes_id state
        if (window.$) $(mesEl).find('.mes_edit').trigger('click');

        const originalText = ctx.chat[idx].mes ?? '';
        const wrap = host.querySelector('.dangan-vn-text-wrap');
        if (!wrap) return;
        wrap.style.display = 'none';

        const editWrap = document.createElement('div');
        editWrap.className = 'dangan-vn-inline-edit';

        const textarea = document.createElement('textarea');
        textarea.className = 'dangan-vn-inline-edit-textarea';
        textarea.value = originalText;

        // Control panel mirroring ST's mes_edit_buttons
        const ctrlRow = document.createElement('div');
        ctrlRow.className = 'dangan-vn-inline-edit-buttons';

        const mkBtn = (icon, title, danger = false) => {
            const b = document.createElement('div');
            b.className = `dangan-vn-edit-ctrl fa-solid ${icon}${danger ? ' danger' : ''}`;
            b.title = title;
            return b;
        };

        const confirmBtn  = mkBtn('fa-check',        'Confirm');
        const copyBtn     = mkBtn('fa-copy',          'Copy');
        const deleteBtn   = mkBtn('fa-trash-can',     'Delete', true);
        const upBtn       = mkBtn('fa-chevron-up',    'Move Up');
        const downBtn     = mkBtn('fa-chevron-down',  'Move Down');
        const cancelBtn   = mkBtn('fa-xmark',         'Cancel');

        ctrlRow.append(confirmBtn, copyBtn, deleteBtn, upBtn, downBtn, cancelBtn);
        editWrap.append(textarea, ctrlRow);
        frameEl.appendChild(editWrap);
        textarea.focus();

        const closeEdit = () => {
            editWrap.remove();
            wrap.style.display = '';
        };

        // Sync our textarea into ST's hidden #curEditTextarea, then confirm
        confirmBtn.addEventListener('click', () => {
            const stTextarea = document.querySelector('#curEditTextarea');
            if (stTextarea) {
                stTextarea.value = textarea.value;
                // Trigger input so ST's internal state updates
                stTextarea.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (window.$) $(mesEl).find('.mes_edit_done').trigger('click');
            closeEdit();
            setTimeout(() => renderDialogueText(), 100);
        });

        copyBtn.addEventListener('click', () => {
            navigator.clipboard?.writeText(textarea.value);
        });

        deleteBtn.addEventListener('click', () => {
            closeEdit();
            if (window.$) $(mesEl).find('.mes_edit_delete').trigger('click');
        });

        upBtn.addEventListener('click', () => {
            if (window.$) $(mesEl).find('.mes_edit_up').trigger('click');
        });

        downBtn.addEventListener('click', () => {
            if (window.$) $(mesEl).find('.mes_edit_down').trigger('click');
        });

        cancelBtn.addEventListener('click', () => {
            if (window.$) $(mesEl).find('.mes_edit_cancel').trigger('click');
            closeEdit();
        });
    }

    function openVnActionsPanel() {
        if (host.querySelector('.dangan-vn-actions-panel')) return;
        const mesEl = (() => {
            const messages = getMessageEntries();
            if (!messages.length) return null;
            const entry = messages[Math.min(messageIndex, messages.length - 1)];
            if (!entry?.key) return null;
            if (entry.key.startsWith('ctx-')) return document.querySelector(`#chat .mes[mesid="${entry.key.slice(4)}"]`) ?? null;
            if (entry.key.startsWith('dom-')) return document.querySelectorAll('#chat .mes')[parseInt(entry.key.slice(4), 10)] ?? null;
            return null;
        })();
        if (!mesEl) return;

        const panel = document.createElement('div');
        panel.className = 'dangan-vn-actions-panel';

        const actionDefs = [
            { cls: 'mes_edit',            icon: 'fa-pencil',           title: 'Edit' },
            { cls: 'mes_translate',       icon: 'fa-language',         title: 'Translate' },
            { cls: 'mes_narrate',         icon: 'fa-bullhorn',         title: 'Narrate' },
            { cls: 'mes_hide',            icon: 'fa-eye',              title: 'Exclude from prompts' },
            { cls: 'mes_create_bookmark', icon: 'fa-flag-checkered',   title: 'Checkpoint' },
            { cls: 'mes_create_branch',   icon: 'fa-code-branch',      title: 'Branch' },
            { cls: 'mes_copy',            icon: 'fa-copy',             title: 'Copy' },
        ];

        actionDefs.forEach(({ cls, icon, title }) => {
            const originalBtn = mesEl.querySelector(`.${cls}`);
            if (!originalBtn) return;
            const btn = document.createElement('div');
            btn.className = `dangan-vn-action-btn fa-solid ${icon}`;
            btn.title = title;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                panel.remove();
                if (cls === 'mes_edit') {
                    openVnEditMode();
                } else if (window.$) {
                    $(originalBtn).trigger('click');
                } else {
                    originalBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                }
            });
            panel.appendChild(btn);
        });

        if (!panel.children.length) return;
        frameEl.appendChild(panel);

        const close = (e) => {
            if (!panel.contains(e.target) && e.target !== extraActionsBtnEl) {
                panel.remove();
                document.removeEventListener('click', close, true);
            }
        };
        setTimeout(() => document.addEventListener('click', close, true), 0);
    }

    extraActionsBtnEl?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const existing = host.querySelector('.dangan-vn-actions-panel');
        if (existing) { existing.remove(); return; }
        openVnActionsPanel();
    });

    editMessageBtnEl?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const existing = host.querySelector('.dangan-vn-inline-edit');
        if (existing) { existing.remove(); host.querySelector('.dangan-vn-text-wrap').style.display = ''; return; }
        openVnEditMode();
    });

    frameEl?.addEventListener('dblclick', (event) => {
        if (!moveUnlocked) return;
        event.preventDefault();
        event.stopPropagation();
        resetFramePosition();
    });

    frameEl?.addEventListener('pointerdown', (event) => {
        if (!moveUnlocked || event.button !== 0 || !frameEl) return;
        const target = event.target;
        if (target instanceof Element && target.closest('.dangan-vn-lock')) return;
        if (target instanceof Element && target.closest('.dangan-vn-clear-chat')) return;
        if (target instanceof Element && target.closest('.dangan-vn-manage-chat-files')) return;

        isDragging = true;
        movedDuringPointer = false;
        dragStartX = event.clientX;
        dragStartY = event.clientY;

        const rect = frameEl.getBoundingClientRect();
        frameStartX = Number.isFinite(framePosX) ? framePosX : rect.left;
        frameStartY = Number.isFinite(framePosY) ? framePosY : rect.top;

        frameEl.setPointerCapture?.(event.pointerId);
        event.preventDefault();
    });

    frameEl?.addEventListener('pointermove', (event) => {
        if (!moveUnlocked || !isDragging || !frameEl) return;
        const dx = event.clientX - dragStartX;
        const dy = event.clientY - dragStartY;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
            movedDuringPointer = true;
        }
        setFramePosition(frameStartX + dx, frameStartY + dy);
        dockTypingSection();
        event.preventDefault();
    });

    frameEl?.addEventListener('pointerup', (event) => {
        if (!isDragging) return;
        isDragging = false;
        frameEl?.releasePointerCapture?.(event.pointerId);
        if (movedDuringPointer) {
            savePosition();
        }
    });

    frameEl?.addEventListener('pointercancel', () => {
        isDragging = false;
    });

    frameEl?.addEventListener('click', (event) => {
        if (isDragging || movedDuringPointer) {
            movedDuringPointer = false;
            return;
        }
        const target = event.target;
        if (target instanceof Element && target.closest('.dangan-vn-lock')) return;
        if (target instanceof Element && target.closest('.dangan-vn-clear-chat')) return;
        if (target instanceof Element && target.closest('.dangan-vn-edit-message')) return;
        if (target instanceof Element && target.closest('.dangan-vn-extra-actions')) return;
        if (target instanceof Element && target.closest('.dangan-vn-transcript-toggle')) return;
        if (target instanceof Element && target.closest('.dangan-vn-manage-chat-files')) return;
        if (target instanceof Element && target.closest('.dangan-vn-stream-toggle')) return;
        if (target instanceof Element && target.closest('.dangan-vn-nav-button')) return;
        advance();
    });

    window.addEventListener('keydown', (event) => {
        if (!vnEnabled || !host.classList.contains('active')) return;
        const target = event.target;
        const isEditable = target instanceof HTMLElement && (
            target.matches('input, textarea, select') ||
            target.isContentEditable ||
            !!target.closest('[contenteditable="true"]')
        );
        if (isEditable) return;

        if (event.key === 'ArrowRight' || event.key === ' ' || event.key === 'Enter') {
            advance();
        } else if (event.key === 'ArrowLeft' || event.key === 'Backspace') {
            retreat();
        } else if ((event.key === 'r' || event.key === 'R') && !event.ctrlKey && !event.metaKey && !event.altKey) {
            triggerRegenerate();
            updateNavigationState();
        } else {
            return;
        }
        event.preventDefault();
    });

    let swipeStartX = null;

    frameEl?.addEventListener('touchstart', (event) => {
        if (!event.touches?.length) return;
        swipeStartX = event.touches[0].clientX;
    }, { passive: true });

    frameEl?.addEventListener('touchend', (event) => {
        if (swipeStartX === null || !event.changedTouches?.length) return;
        const deltaX = event.changedTouches[0].clientX - swipeStartX;
        swipeStartX = null;
        if (Math.abs(deltaX) < 36) return;
        if (deltaX < 0) {
            advance();
        } else {
            retreat();
        }
    }, { passive: true });

    window.addEventListener('resize', () => {
        updateBottomOffset();
        if (Number.isFinite(framePosX) && Number.isFinite(framePosY)) {
            setFramePosition(framePosX, framePosY);
        }
        dockTypingSection();
    });

    let _vnObsRaf = null;
    const observer = new MutationObserver(() => {
        if (_vnObsRaf) return;
        _vnObsRaf = requestAnimationFrame(() => {
            _vnObsRaf = null;
            ensureHostAttached();
            updateBottomOffset();
            syncMonopadVisibility();
            dockTypingSection();
            if (transcriptOpen) {
                renderTranscript();
            }
            if (!host.classList.contains('active')) return;
            const messages = getMessageEntries();
            const currentChatScope = getChatScopeSignature();
            const chatScopeChanged = currentChatScope !== lastObservedChatScope;
            const previousCount = lastObservedMessageCount;
            const hadMessageCountChange = messages.length !== previousCount;
            const previousLastSignature = lastObservedLastSignature;
            const currentLastSignature = getMessageSignature(messages[messages.length - 1]);
            const hadLastSignatureChange = currentLastSignature !== previousLastSignature;
            lastObservedMessageCount = messages.length;
            lastObservedLastSignature = currentLastSignature;
            lastObservedChatScope = currentChatScope;
            if (!messages.length) {
                renderCurrent();
                return;
            }

            const maxIndex = messages.length - 1;
            const wasAtTailBeforeNewMessage = hadMessageCountChange && messageIndex >= Math.max(0, maxIndex - 1);

            if (chatScopeChanged) {
                jumpToLatest();
            } else if (hadMessageCountChange && previousCount === 0 && messages.length > 0) {
                jumpToLatest();
            } else if (!hadMessageCountChange && hadLastSignatureChange) {
                if (messageIndex >= maxIndex) {
                    jumpToLatest();
                } else {
                    renderCurrent();
                }
            } else if (hadMessageCountChange && messages.length > previousCount && wasAtTailBeforeNewMessage) {
                renderCurrent();
            } else {
                renderCurrent();
            }
        });
    });

    const chatEl = document.getElementById('chat');
    if (chatEl) observer.observe(chatEl, { childList: true, subtree: true });

    const panelEl = document.getElementById('dangan_monopad_panel');
    if (panelEl) {
        const panelObserver = new MutationObserver(() => {
            const panelLooksOpen = panelEl.classList.contains('open') || panelEl.classList.contains('booting') || panelEl.classList.contains('shutting-down');
            monopadOpen = panelLooksOpen;
            syncMonopadVisibility();
        });
        panelObserver.observe(panelEl, { attributes: true, attributeFilter: ['class'] });
    }

    return {
        setEnabled(enabled) {
            const isEnabled = !!enabled;
            vnEnabled = isEnabled;
            ensureHostAttached();

            host.classList.toggle('active', isEnabled);
            host.setAttribute('aria-hidden', isEnabled ? 'false' : 'true');
            host.style.display = isEnabled ? 'flex' : 'none';
            host.style.pointerEvents = 'none';
            updateBottomOffset();
            syncMonopadVisibility();
            dockTypingSection();
            if (!isEnabled) {
                setTranscriptOpen(false);
                undockTypingSection();
                stopTextStreaming();
            }

            const chatRoot = document.getElementById('chat');
            chatRoot?.classList.toggle('dangan-vn-hidden', isEnabled);

            if (isEnabled) {
                lastObservedMessageCount = getMessageEntries().length;
                const enabledMessages = getMessageEntries();
                lastObservedLastSignature = getMessageSignature(enabledMessages[enabledMessages.length - 1]);
                lastObservedChatScope = getChatScopeSignature();
                jumpToLatest();
            }

            trySetSillyTavernVisualNovelMode(isEnabled);
        },
        refresh() {
            ensureHostAttached();
            updateBottomOffset();
            syncMonopadVisibility();
            dockTypingSection();
            if (transcriptOpen) {
                renderTranscript();
            }
            if (!host.classList.contains('active')) return;
            const currentChatScope = getChatScopeSignature();
            const chatScopeChanged = currentChatScope !== lastObservedChatScope;
            lastObservedChatScope = currentChatScope;
            if (chatScopeChanged) {
                jumpToLatest();
                return;
            }
            renderCurrent();
        },
        setMonopadOpen(isOpen) {
            monopadOpen = !!isOpen;
            syncMonopadVisibility();
            dockTypingSection();
        },
    };
}

function tryEnableInvestigationToggleInObject(root, { maxDepth = 8 } = {}) {
    if (!root || typeof root !== "object") return false;

    const target = normalizeTextToken("Investigation Time");
    const queue = [{ node: root, depth: 0 }];
    const visited = new WeakSet();
    let touched = false;

    while (queue.length) {
        const { node, depth } = queue.shift();
        if (!node || typeof node !== "object") continue;
        if (visited.has(node)) continue;
        visited.add(node);

        const label = normalizeTextToken(node.name || node.label || node.title || node.id || node.key || "");
        const hasInvestigationKey = /investigation/.test(label) && /time|mode|toggle|enabled|active/.test(label);
        if (label === target || label.includes(target) || hasInvestigationKey) {
            if (typeof node.enabled === "boolean") {
                node.enabled = true;
                touched = true;
            }
            if (typeof node.value === "boolean") {
                node.value = true;
                touched = true;
            }
            if (typeof node.active === "boolean") {
                node.active = true;
                touched = true;
            }
            if (typeof node.toggled === "boolean") {
                node.toggled = true;
                touched = true;
            }
            if (typeof node.isEnabled === "boolean") {
                node.isEnabled = true;
                touched = true;
            }
            if (typeof node.isActive === "boolean") {
                node.isActive = true;
                touched = true;
            }
            if (typeof node.setValue === "function") {
                node.setValue(true);
                touched = true;
            }
            if (typeof node.set === "function") {
                node.set(true);
                touched = true;
            }
        }

        if (depth >= maxDepth) continue;

        try {
            for (const value of Object.values(node)) {
                if (!value || typeof value !== "object") continue;
                queue.push({ node: value, depth: depth + 1 });
            }
        } catch {
            // Some host objects can throw on property access; skip safely.
        }
    }

    return touched;
}

function tryEnableInvestigationToggleViaContext() {
    if (!window.SillyTavern?.getContext) return false;

    const ctx = window.SillyTavern.getContext();
    if (!ctx) return false;

    const candidates = [
        ctx.chatCompletionSettings,
        ctx.chat_completion_settings,
        ctx.mainApiSettings,
        ctx.main_api_settings,
        ctx.settings,
        ctx,
    ];

    let touched = false;
    for (const candidate of candidates) {
        try {
            touched = tryEnableInvestigationToggleInObject(candidate) || touched;
        } catch {
            // Skip malformed or protected objects without breaking Investigation start flow.
        }
    }

    if (!touched) return false;

    if (typeof ctx.saveSettingsDebounced === "function") {
        ctx.saveSettingsDebounced();
    } else {
        saveSettingsDebounced();
    }

    return true;
}

function tryEnableInvestigationToggleViaDom() {
    const target = normalizeTextToken("Investigation Time");
    const scope = Array.from(document.querySelectorAll("label, .menu_button, .inline-drawer-toggle, button, .toggle-item"));

    for (const el of scope) {
        const labelText = normalizeTextToken(el.textContent || el.getAttribute("aria-label") || "");
        if (!labelText || (!labelText.includes(target) && labelText !== target)) continue;

        const host = el.closest("label, .toggle-item, .settings-item, .menu_button, .inline-drawer-toggle") || el;
        const checkbox = host.querySelector('input[type="checkbox"]') || el.querySelector?.('input[type="checkbox"]');

        if (checkbox) {
            if (checkbox.checked) return true;
            checkbox.click();
            checkbox.dispatchEvent(new Event("input", { bubbles: true }));
            checkbox.dispatchEvent(new Event("change", { bubbles: true }));
            return true;
        }

        const pressed = host.getAttribute("aria-pressed");
        if (pressed === "true") return true;

        if (typeof host.click === "function") {
            host.click();
            return true;
        }
    }

    return false;
}

function triggerInvestigationTimeToggle() {
    const byContext = tryEnableInvestigationToggleViaContext();
    if (byContext) return true;

    return tryEnableInvestigationToggleViaDom();
}

function ensureInvestigationOverlay() {
    let overlay = document.getElementById("dangan-investigation-overlay");

    // If markup exists inside a hidden panel, move it to body so it can render globally.
    if (overlay && overlay.parentElement !== document.body) {
        document.body.appendChild(overlay);
    }

    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "dangan-investigation-overlay";
        overlay.setAttribute("aria-hidden", "true");
        overlay.innerHTML = `
            <div class="dangan-investigation-backdrop"></div>
            <div class="dangan-investigation-scanlines"></div>
            <div class="dangan-investigation-banner" role="status" aria-live="polite" aria-label="Investigation start banner">
                <div class="dangan-investigation-kicker">TRIAL ROUTE UPDATED</div>
                <div class="dangan-investigation-title"><span class="dangan-investigation-word inv">Investigation</span> <span class="dangan-investigation-word start">START!</span></div>
                <div class="dangan-investigation-subtitle">Truth Bullets Enabled · Field Notes Active</div>
            </div>
        `;

        document.body.appendChild(overlay);
    }

    return overlay;
}

function ensureFreeTimeOverlay() {
    let overlay = document.getElementById("dangan-freetime-overlay");
    if (overlay && overlay.parentElement !== document.body) {
        document.body.appendChild(overlay);
    }
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "dangan-freetime-overlay";
        overlay.setAttribute("aria-hidden", "true");
        overlay.innerHTML = `
            <div class="dangan-freetime-backdrop"></div>
            <div class="dangan-freetime-scanlines"></div>
            <div class="dangan-freetime-banner" role="status" aria-live="polite" aria-label="Free time start banner">
                <div class="dangan-freetime-title"><span class="dangan-freetime-word free">Free Time</span> <span class="dangan-freetime-word start">START!</span></div>
            </div>
        `;
        document.body.appendChild(overlay);
    }
    return overlay;
}

const freeTimeStartController = {
    hideTimerId: null,

    clearBanner() {
        const overlay = document.getElementById("dangan-freetime-overlay");
        if (!overlay) return;
        overlay.classList.remove("show");
        overlay.setAttribute("aria-hidden", "true");
        if (this.hideTimerId) {
            clearTimeout(this.hideTimerId);
            this.hideTimerId = null;
        }
    },

    showBanner(durationMs = 2200) {
        const overlay = ensureFreeTimeOverlay();
        if (!overlay) return false;
        overlay.style.setProperty("--freetime-banner-duration", `${Math.max(900, Math.round(durationMs))}ms`);
        overlay.setAttribute("aria-hidden", "false");
        overlay.classList.remove("show");
        void overlay.offsetWidth;
        overlay.classList.add("show");
        if (this.hideTimerId) {
            clearTimeout(this.hideTimerId);
            this.hideTimerId = null;
        }
        this.hideTimerId = window.setTimeout(() => this.clearBanner(), Math.max(900, Math.round(durationMs)));
        return true;
    },

    triggerAsync() {
        if (!sfx?.investigation_start) {
            this.showBanner(2200);
            return new Promise(resolve => setTimeout(resolve, 2200));
        }
        playSfx(sfx.investigation_start);
        const durationSec = Number(sfx.investigation_start.duration);
        const durationMs = Number.isFinite(durationSec) && durationSec > 0
            ? Math.round(durationSec * 1000)
            : 2200;
        const displayDuration = Math.max(1400, durationMs + 120);
        this.showBanner(displayDuration);
        return new Promise(resolve => setTimeout(resolve, displayDuration));
    },
};

function ensureNightTimeOverlay() {
    let overlay = document.getElementById("dangan-nighttime-overlay");
    if (overlay && overlay.parentElement !== document.body) {
        document.body.appendChild(overlay);
    }
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "dangan-nighttime-overlay";
        overlay.setAttribute("aria-hidden", "true");
        overlay.innerHTML = `
            <div class="dangan-nighttime-backdrop"></div>
            <div class="dangan-nighttime-scanlines"></div>
            <div class="dangan-nighttime-banner" role="status" aria-live="polite" aria-label="Night time start banner">
                <div class="dangan-nighttime-title"><span class="dangan-nighttime-word night">Night Time</span> <span class="dangan-nighttime-word start">START!</span></div>
            </div>
        `;
        document.body.appendChild(overlay);
    }
    return overlay;
}

const nightTimeStartController = {
    hideTimerId: null,

    clearBanner() {
        const overlay = document.getElementById("dangan-nighttime-overlay");
        if (!overlay) return;
        overlay.classList.remove("show");
        overlay.setAttribute("aria-hidden", "true");
        if (this.hideTimerId) {
            clearTimeout(this.hideTimerId);
            this.hideTimerId = null;
        }
    },

    showBanner(durationMs = 2200) {
        const overlay = ensureNightTimeOverlay();
        if (!overlay) return false;
        overlay.style.setProperty("--nighttime-banner-duration", `${Math.max(900, Math.round(durationMs))}ms`);
        overlay.setAttribute("aria-hidden", "false");
        overlay.classList.remove("show");
        void overlay.offsetWidth;
        overlay.classList.add("show");
        if (this.hideTimerId) {
            clearTimeout(this.hideTimerId);
            this.hideTimerId = null;
        }
        this.hideTimerId = window.setTimeout(() => this.clearBanner(), Math.max(900, Math.round(durationMs)));
        return true;
    },

    triggerAsync() {
        if (!sfx?.investigation_start) {
            this.showBanner(2200);
            return new Promise(resolve => setTimeout(resolve, 2200));
        }
        playSfx(sfx.investigation_start);
        const durationSec = Number(sfx.investigation_start.duration);
        const durationMs = Number.isFinite(durationSec) && durationSec > 0
            ? Math.round(durationSec * 1000)
            : 2200;
        const displayDuration = Math.max(1400, durationMs + 120);
        this.showBanner(displayDuration);
        return new Promise(resolve => setTimeout(resolve, displayDuration));
    },
};

let investigationTrackAudio = null;
let investigationUnderway = false;
let shopTrackAudio = null;

function playShopTrack() {
    const tracks = getMonopadSetting("shopTracks") || [];
    if (!tracks.length) return;
    const path = tracks[Math.floor(Math.random() * tracks.length)];
    if (!path) return;
    if (shopTrackAudio) {
        shopTrackAudio.pause();
        shopTrackAudio = null;
    }
    shopTrackAudio = new Audio(path);
    shopTrackAudio.loop = true;
    shopTrackAudio.volume = Number(getMonopadSetting("monomonoBgmVolume") ?? 40) / 100;
    shopTrackAudio.play().catch(e => console.warn("[Dangan][Shop] Track play failed:", e));
}

function stopShopTrack() {
    if (shopTrackAudio) {
        shopTrackAudio.pause();
        shopTrackAudio = null;
    }
}

const BGM_TRACK_TABS = [
    { key: "daytime",                settingKey: "daytimeTracks",             listId: "daytime-tracks-list",                selectedId: "daytime-selected-list" },
    { key: "nighttime",              settingKey: "nighttimeTracks",           listId: "nighttime-tracks-list",              selectedId: "nighttime-selected-list" },
    { key: "investigation",          settingKey: "investigationTracks",       listId: "investigation-tracks-list",          selectedId: "investigation-selected-list" },
    { key: "shop",                   settingKey: "shopTracks",                listId: "shop-tracks-list",                   selectedId: "shop-selected-list" },
    { key: "trial-general",          settingKey: "trialGeneralTracks",        listId: "trial-general-tracks-list",          selectedId: "trial-general-selected-list" },
    { key: "trial-preparation",      settingKey: "trialPreparationTracks",    listId: "trial-preparation-tracks-list",      selectedId: "trial-preparation-selected-list" },
    { key: "trial-debates",          settingKey: "trialDebatesTracks",        listId: "trial-debates-tracks-list",          selectedId: "trial-debates-selected-list" },
    { key: "trial-panic",            settingKey: "trialPanicTracks",          listId: "trial-panic-tracks-list",            selectedId: "trial-panic-selected-list" },
    { key: "trial-scrum",            settingKey: "trialScrumTracks",          listId: "trial-scrum-tracks-list",            selectedId: "trial-scrum-selected-list" },
    { key: "trial-hangman",          settingKey: "trialHangmanTracks",        listId: "trial-hangman-tracks-list",          selectedId: "trial-hangman-selected-list" },
    { key: "trial-rebuttal",         settingKey: "trialRebuttalTracks",       listId: "trial-rebuttal-tracks-list",         selectedId: "trial-rebuttal-selected-list" },
    { key: "trial-mindmine",         settingKey: "trialMindMineTracks",       listId: "trial-mindmine-tracks-list",         selectedId: "trial-mindmine-selected-list" },
    { key: "trial-interjection",     settingKey: "trialInterjectionTracks",   listId: "trial-interjection-tracks-list",     selectedId: "trial-interjection-selected-list" },
    { key: "trial-suspect-choice",   settingKey: "trialSuspectChoiceTracks",  listId: "trial-suspect-choice-tracks-list",   selectedId: "trial-suspect-choice-selected-list" },
    { key: "aa-phase1",             settingKey: "aaPhase1Tracks",           listId: "aa-phase1-tracks-list",             selectedId: "aa-phase1-selected-list" },
    { key: "aa-phase2",             settingKey: "aaPhase2Tracks",           listId: "aa-phase2-tracks-list",             selectedId: "aa-phase2-selected-list" },
    { key: "aa-phase3",             settingKey: "aaPhase3Tracks",           listId: "aa-phase3-tracks-list",             selectedId: "aa-phase3-selected-list" },
    // legacy keys — no longer shown in UI but kept so existing saved tracks still load
    { key: "trial-aa",              settingKey: "trialAaTracks",            listId: "trial-aa-tracks-list",              selectedId: "trial-aa-selected-list" },
    { key: "trial-reenactment",      settingKey: "trialReenactmentTracks",    listId: "trial-reenactment-tracks-list",      selectedId: "trial-reenactment-selected-list" },
    { key: "trial-closing",          settingKey: "trialClosingTracks",        listId: "trial-closing-tracks-list",          selectedId: "trial-closing-selected-list" },
    { key: "trial-voting",           settingKey: "trialVotingTracks",         listId: "trial-voting-tracks-list",           selectedId: "trial-voting-selected-list" },
];

let cachedBgmPaths = null;

async function fetchBgmPaths() {
    if (cachedBgmPaths !== null) return cachedBgmPaths;
    try {
        const response = await fetch("/api/assets/get", {
            method: "POST",
            headers: getRequestHeaders({ omitContentType: true }),
        });
        if (response.ok) {
            const data = await response.json();
            cachedBgmPaths = Array.isArray(data.bgm) ? data.bgm.filter(p => p && p.trim()) : [];
        } else {
            cachedBgmPaths = [];
        }
    } catch (e) {
        console.warn("[Dangan][BGM] Failed to fetch BGM list:", e);
        cachedBgmPaths = [];
    }
    return cachedBgmPaths;
}

// ── BGM playlist state (for prev / next controls) ─────────────────────────
let bgmCurrentSettingKey = null;
let bgmCurrentList       = [];
let bgmCurrentIndex      = -1;
let bgmPlayMode          = 'loop'; // 'loop' | 'shuffle' | 'sequential'
let _bgmEndedHandler     = null;   // ref to current ended listener for cleanup

const BGM_PLAYLIST_LABELS = {
    daytimeTracks:           'DAYTIME',
    nighttimeTracks:         'NIGHTTIME',
    investigationTracks:     'INVESTIGATION',
    shopTracks:              'SHOP',
    trialGeneralTracks:      'GENERAL',
    trialPreparationTracks:  'TRIAL PREP',
    trialDebatesTracks:      'NON-STOP DEBATE',
    trialPanicTracks:        'MASS PANIC DEBATE',
    trialScrumTracks:        'SCRUM DEBATE',
    trialHangmanTracks:      'HANGMAN\'S GAMBIT',
    trialRebuttalTracks:     'REBUTTAL SHOWDOWN',
    trialMindMineTracks:     'MIND MINE',
    trialInterjectionTracks: 'INTERJECTION',
    trialSuspectChoiceTracks:'SUSPECT CHOICE',
    aaPhase1Tracks:         'PHASE 1',
    aaPhase2Tracks:         'PHASE 2',
    aaPhase3Tracks:         'PHASE 3',
};

const BGM_PLAYLIST_PARENTS = {
    daytimeTracks:           'PHASES',
    nighttimeTracks:         'PHASES',
    investigationTracks:     'PHASES',
    shopTracks:              'LOCATIONS',
    trialPreparationTracks:  'LOCATIONS',
    trialGeneralTracks:      'TRIAL',
    trialDebatesTracks:      'TRIAL',
    trialPanicTracks:        'TRIAL',
    trialScrumTracks:        'TRIAL',
    trialHangmanTracks:      'TRIAL',
    trialRebuttalTracks:     'TRIAL',
    trialMindMineTracks:     'TRIAL',
    trialInterjectionTracks: 'TRIAL',
    trialSuspectChoiceTracks:'TRIAL',
    aaPhase1Tracks:         'ARGUMENT ARMAMENT',
    aaPhase2Tracks:         'ARGUMENT ARMAMENT',
    aaPhase3Tracks:         'ARGUMENT ARMAMENT',
};

// Briefly armed by callers that wrap a chat transition; during the window any
// unexpected pause on investigationTrackAudio is auto-resumed so the BGM rides
// through the fade-to-black even if ST/DA/etc. tries to clip it.
let _bgmTransitionGuardUntilMs = 0;
let _bgmTransitionWatchdogRaf  = null;
function _bgmTransitionWatchdogTick() {
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (now >= _bgmTransitionGuardUntilMs) {
        _bgmTransitionWatchdogRaf = null;
        return;
    }
    // Resume the audio if anything quietly paused it.
    const audio = investigationTrackAudio;
    if (audio && audio.paused) {
        try { audio.play().catch(() => {}); } catch (_) {}
    }
    // Resume the visualizer's AudioContext if suspended — a suspended
    // context silences a `createMediaElementSource`-routed track even when
    // the element itself reports `paused === false`.
    try { audioVisualizer?.pokeAudioContext?.(); } catch (_) {}
    _bgmTransitionWatchdogRaf = requestAnimationFrame(_bgmTransitionWatchdogTick);
}
function armBgmTransitionGuard(durationMs = 2500) {
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const until = now + Math.max(0, durationMs);
    if (until > _bgmTransitionGuardUntilMs) _bgmTransitionGuardUntilMs = until;
    if (_bgmTransitionWatchdogRaf == null) {
        _bgmTransitionWatchdogRaf = requestAnimationFrame(_bgmTransitionWatchdogTick);
    }
}

function playBgmPath(path, settingKey = null) {
    if (!path) return;

    // Play on our own independent element — DA cannot interfere with this element.
    // Null out FIRST, then pause the detached reference. The new audio's
    // `.pause()` override below uses `audioEl !== investigationTrackAudio` as
    // its "this track is no longer current, let the pause through" signal, so
    // the order matters.
    if (investigationTrackAudio) {
        const oldAudio = investigationTrackAudio;
        investigationTrackAudio = null;
        oldAudio.pause();
    }
    investigationTrackAudio = new Audio(path);
    investigationTrackAudio.loop = (bgmPlayMode === 'loop');
    if (bgmPlayMode !== 'loop') bgmAttachEndedListener(investigationTrackAudio);
    investigationTrackAudio.volume = Number(getMonopadSetting("monopadVolume") ?? 50) / 100;
    // Suppress incidental pauses during chat-transition windows. The override
    // replaces the prototype pause on this instance only; once the track is
    // swapped out (audioEl !== investigationTrackAudio) the override yields
    // so the legitimate cleanup pause above still works.
    const audioEl = investigationTrackAudio;
    const origPause = audioEl.pause.bind(audioEl);
    audioEl.pause = function () {
        if (audioEl !== investigationTrackAudio) return origPause();
        const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        if (now < _bgmTransitionGuardUntilMs) return; // suppress — guard armed
        return origPause();
    };
    // Belt-and-suspenders: some browser-level pauses (e.g. media element
    // `load()` resetting state) bypass the .pause() override and fire the
    // 'pause' event directly. Catch those and resume during the guard window.
    audioEl.addEventListener('pause', () => {
        if (audioEl !== investigationTrackAudio) return;
        const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        if (now >= _bgmTransitionGuardUntilMs) return;
        audioEl.play().catch(() => {});
    });
    investigationTrackAudio.play().catch(e =>
        console.warn(`[Dangan][BGM] Track play failed (${settingKey ?? "?"}):`, e)
    );

    // Seed DA's internal lastBgmPath by triggering it to "select" our track.
    // DA's polling worker checks: if chosen path === lastBgmPath → return early (no el.load/play).
    // With lastBgmPath seeded to our path and bgm_locked=true pointing at our path,
    // every future worker poll exits without touching #audio_bgm.
    const $bgmSelect = $('#audio_bgm_select');
    if ($bgmSelect.length) {
        if (!$bgmSelect.find(`option[value="${path}"]`).length) {
            const name = path.split('/').pop().replace(/\.[^/.]+$/, '');
            $bgmSelect.append($('<option>').val(path).text(`asset: ${name}`).attr('data-dangan-bgm', '1'));
        }
        // Set bgm_selected first so onBGMSelectChange picks it up correctly.
        const daSettings = extension_settings['audio'];
        if (daSettings) {
            daSettings.bgm_selected = path;
            daSettings.bgm_locked = true;
        }
        // Trigger DA: it sets lastBgmPath=path and plays on #audio_bgm.
        $bgmSelect.val(path).trigger('change');
        // Silence #audio_bgm — our investigationTrackAudio is the real source.
        setTimeout(() => {
            const daEl = document.getElementById('audio_bgm');
            if (daEl instanceof HTMLAudioElement) daEl.pause();
        }, 400);
    }

    console.log(`[Dangan][BGM] Playing track (${settingKey ?? "?"}): ${path}`);
}

function playTrackFromSetting(settingKey) {
    const tracks = getMonopadSetting(settingKey) || [];
    if (!tracks.length) return;

    const idx = Math.floor(Math.random() * tracks.length);
    bgmCurrentSettingKey = settingKey;
    bgmCurrentList       = [...tracks];
    bgmCurrentIndex      = idx;

    playBgmPath(tracks[idx], settingKey);
}

function bgmPlayPrev() {
    if (!bgmCurrentList.length) return;
    bgmCurrentIndex = (bgmCurrentIndex - 1 + bgmCurrentList.length) % bgmCurrentList.length;
    playBgmPath(bgmCurrentList[bgmCurrentIndex], bgmCurrentSettingKey);
}

function bgmPlayNext() {
    if (!bgmCurrentList.length) return;
    bgmCurrentIndex = (bgmCurrentIndex + 1) % bgmCurrentList.length;
    playBgmPath(bgmCurrentList[bgmCurrentIndex], bgmCurrentSettingKey);
}

function bgmPlayShuffle() {
    if (!bgmCurrentList.length) return;
    bgmCurrentIndex = Math.floor(Math.random() * bgmCurrentList.length);
    playBgmPath(bgmCurrentList[bgmCurrentIndex], bgmCurrentSettingKey);
}

function bgmAttachEndedListener(audioEl) {
    if (_bgmEndedHandler) audioEl.removeEventListener('ended', _bgmEndedHandler);
    _bgmEndedHandler = () => {
        _bgmEndedHandler = null;
        if (bgmPlayMode === 'shuffle') bgmPlayShuffle();
        else if (bgmPlayMode === 'sequential') bgmPlayNext();
    };
    audioEl.addEventListener('ended', _bgmEndedHandler, { once: true });
}

function bgmTogglePause() {
    // Prioritise the extension's own element — matches getAudioElement() priority.
    if (investigationTrackAudio) {
        if (investigationTrackAudio.paused) investigationTrackAudio.play().catch(() => {});
        else investigationTrackAudio.pause();
        return;
    }
    const audioEl = document.getElementById("audio_bgm");
    if (audioEl instanceof HTMLAudioElement) {
        if (audioEl.paused) audioEl.play().catch(() => {});
        else audioEl.pause();
    }
}

function playInvestigationTrack() { playTrackFromSetting("investigationTracks"); }
function playDaytimeTrack()       { playTrackFromSetting("daytimeTracks"); }
function playNighttimeTrack()     { playTrackFromSetting("nighttimeTracks"); }
function playTrialTrack()         { playTrackFromSetting("trialGeneralTracks"); }

/** Returns true when a real character or group chat is active (not the default Assistant chat). */
function isInCharacterChat() {
    const ctx = window.SillyTavern?.getContext?.();
    if (!ctx) return false;
    const char = ctx.characters?.[ctx.characterId];
    // Group chat → always a real chat.
    if (ctx.groupId) return true;
    // No character selected → temporary assistant chat.
    if (ctx.characterId == null) return false;
    // ST's permanent Assistant character keeps name 'Assistant' (neutralCharacterName).
    // Also catches avatar key 'assistant' if the avatar hasn't been changed.
    if (ctx.name2 === 'Assistant') return false;
    if (char?.avatar === 'assistant') return false;
    return true;
}

/**
 * Removes Prome User Sprite avatars from the currently-open group chat's
 * member list and persists via editGroup. Idempotent — no-ops when not in
 * a group or when no Prome member is present. Also tears down any lingering
 * .expression-holder slot for the removed avatars so the visible chat layout
 * matches the new member set without waiting for the next chat reload.
 */
async function stripPromeFromCurrentGroup() {
    try {
        const ctx = window.SillyTavern?.getContext?.();
        if (!ctx?.groupId) return;
        const group = (Array.isArray(ctx.groups) ? ctx.groups : []).find(g => String(g.id) === String(ctx.groupId));
        if (!group || !Array.isArray(group.members) || !group.members.length) return;
        const allChars = Array.isArray(ctx.characters) ? ctx.characters : [];

        const removed = [];
        const kept = [];
        for (const avatar of group.members) {
            const c = allChars.find(x => x?.avatar === avatar);
            const lc = String(c?.name || '').toLowerCase();
            if (lc.includes('prome user sprite')) removed.push(avatar);
            else kept.push(avatar);
        }
        if (!removed.length) return;

        group.members = kept;
        try {
            await editGroup(group.id, true, false);
        } catch (err) {
            // Roll back the in-memory mutation if the server save failed so
            // the next render doesn't show a stale, locally-only group.
            group.members = [...kept, ...removed];
            console.warn('[Dangan] editGroup failed while stripping Prome:', err);
            return;
        }
        for (const avatar of removed) {
            for (const holder of document.querySelectorAll('.expression-holder')) {
                if (holder.dataset.avatar === avatar) holder.remove();
            }
        }
        console.log('[Dangan] Stripped Prome User Sprite from group', group.id);
    } catch (err) {
        console.warn('[Dangan] stripPromeFromCurrentGroup failed:', err);
    }
}

function _stopAllBgm() {
    if (investigationTrackAudio) {
        investigationTrackAudio.pause();
        investigationTrackAudio = null;
    }
    const daEl = document.getElementById('audio_bgm');
    if (daEl instanceof HTMLAudioElement && !daEl.paused) {
        daEl.pause();
    }
    audioVisualizer?.hide();
}

function playPhaseTrack() {
    if (investigationUnderway) {
        playInvestigationTrack();
    } else if (ensureTimeTrackerState().phase === TIME_PHASE_NIGHT) {
        playNighttimeTrack();
    } else {
        playDaytimeTrack();
    }
}

function stopInvestigationTrack() {
    // Stop direct audio fallback if it was used
    if (investigationTrackAudio) {
        investigationTrackAudio.pause();
        investigationTrackAudio = null;
    }
    // If Dynamic Audio was used, pause its BGM element
    const bgm = document.getElementById("audio_bgm");
    if (bgm instanceof HTMLAudioElement && !bgm.paused) {
        bgm.pause();
    }
}

function renderSelectedTracksForTab(settingKey, selectedId) {
    const $panel = $(`#${selectedId}`);
    if (!$panel.length) return;

    const tracks = getMonopadSetting(settingKey) || [];
    $panel.empty();

    if (!tracks.length) {
        $panel.append('<div class="investigation-selected-empty">NONE SELECTED</div>');
        return;
    }

    tracks.forEach(path => {
        const name = path.split("/").pop().replace(/\.[^/.]+$/, "");
        $panel.append(`<div class="investigation-selected-item">${name}</div>`);
    });
}

async function renderTracksForTab(settingKey, listId, selectedId) {
    const $list = $(`#${listId}`);
    if (!$list.length) return;

    $list.empty().append('<div class="investigation-tracks-loading">LOADING TRACKS...</div>');

    const bgmPaths = await fetchBgmPaths();

    $list.empty();

    if (!bgmPaths.length) {
        $list.append('<div class="investigation-tracks-empty">NO BGM TRACKS FOUND</div>');
        return;
    }

    const selected = new Set(getMonopadSetting(settingKey) || []);
    const allSelected = bgmPaths.every(p => selected.has(p));

    const $selectAll = $(`
        <label class="investigation-track-row investigation-track-select-all">
            <input type="checkbox" class="bgm-track-select-all-checkbox" data-setting="${settingKey}" data-list="${listId}" data-selected="${selectedId}" ${allSelected ? "checked" : ""}>
            <span class="investigation-track-name">(Select All)</span>
        </label>
    `);
    $list.append($selectAll);

    bgmPaths.forEach(path => {
        const name = path.split("/").pop().replace(/\.[^/.]+$/, "");
        if (!name) return;
        const checked = selected.has(path);
        const $row = $(`
            <label class="investigation-track-row">
                <input type="checkbox" class="bgm-track-checkbox" data-path="${path}" data-setting="${settingKey}" data-list="${listId}" data-selected="${selectedId}" ${checked ? "checked" : ""}>
                <span class="investigation-track-name">${name}</span>
                <button type="button" class="bgm-track-play-btn" data-path="${path}" aria-label="Play ${name}">
                    <svg class="bgm-play-icon" viewBox="0 0 10 10" fill="currentColor"><polygon points="2,1 9,5 2,9"/></svg>
                    <svg class="bgm-pause-icon" viewBox="0 0 10 10" fill="currentColor"><rect x="2" y="1" width="2.5" height="8"/><rect x="5.5" y="1" width="2.5" height="8"/></svg>
                </button>
            </label>
        `);
        $list.append($row);
    });

    renderSelectedTracksForTab(settingKey, selectedId);
}

async function renderAllBgmTrackTabs() {
    cachedBgmPaths = null; // force fresh fetch
    await fetchBgmPaths();
    BGM_TRACK_TABS.forEach(tab => renderTracksForTab(tab.settingKey, tab.listId, tab.selectedId));
}

const investigationStartController = {
    hideTimerId: null,

    clearBanner() {
        const overlay = document.getElementById("dangan-investigation-overlay");
        if (!overlay) return;

        overlay.classList.remove("show");
        overlay.setAttribute("aria-hidden", "true");

        if (this.hideTimerId) {
            clearTimeout(this.hideTimerId);
            this.hideTimerId = null;
        }
    },

    showBanner(durationMs = 2200) {
        const overlay = ensureInvestigationOverlay();
        if (!overlay) return false;

        overlay.style.setProperty("--investigation-banner-duration", `${Math.max(900, Math.round(durationMs))}ms`);
        overlay.setAttribute("aria-hidden", "false");
        overlay.classList.remove("show");
        void overlay.offsetWidth;
        overlay.classList.add("show");

        if (this.hideTimerId) {
            clearTimeout(this.hideTimerId);
            this.hideTimerId = null;
        }

        this.hideTimerId = window.setTimeout(() => this.clearBanner(), Math.max(900, Math.round(durationMs)));
        return true;
    },

    playSfx() {
        if (!sfx?.investigation_start) {
            console.warn("[Dangan][Investigation] Investigation start SFX not loaded.");
            return { played: false, durationMs: 2200 };
        }

        playSfx(sfx.investigation_start);

        const durationSec = Number(sfx.investigation_start.duration);
        const durationMs = Number.isFinite(durationSec) && durationSec > 0
            ? Math.round(durationSec * 1000)
            : 2200;

        return { played: true, durationMs };
    },

    enableToggle() {
        try {
            const enabled = triggerInvestigationTimeToggle();
            if (enabled) {
                console.log("[Dangan][Investigation] Investigation Time toggle enabled in current preset.");
                return true;
            }
            console.warn("[Dangan][Investigation] Could not auto-enable the Investigation Time toggle.");
            return false;
        } catch (error) {
            console.warn("[Dangan][Investigation] Toggle automation failed:", error);
            return false;
        }
    },

    trigger() {
        const sfxResult = this.playSfx();
        const displayDuration = Math.max(1400, (sfxResult?.durationMs || 2200) + 120);
        const bannerShown = this.showBanner(displayDuration);
        const toggled = this.enableToggle();

        const trackDelay = sfxResult?.played ? (sfxResult.durationMs + 120) : 0;
        setTimeout(() => playInvestigationTrack(), trackDelay);

        investigationUnderway = true;
        renderTimeTrackerUi();
        applyDynamicTheme();

        const didAnything = Boolean(bannerShown || sfxResult?.played || toggled);
        if (!didAnything) {
            console.info("[Dangan][Investigation] Marker detected, but no effect could be shown.");
        }

        return didAnything;
    },
};



async function triggerTrialStartFromMapPin() {
    const accepted = await classTrialMenuController?.open?.();
    if (!accepted) return false;

    console.log("[Dangan][Trial] Begin Class Trial selected from map pin.");
    trialManager?.start();
    return true;
}

/* =========================
   SOCIAL / CHARACTER DATA
   ========================= */

const characters = new Map(); 
// key: normalized name → value: character object

const processedGiftMessageSignatures = new Set();
let pendingGiftDeliveryQueue = [];
let pendingGiftResolutionInFlight = false;

function getGiftJudgementStore() {
    extension_settings[extensionName] ||= {};
    extension_settings[extensionName].giftJudgements ||= {};
    return extension_settings[extensionName].giftJudgements;
}

function getStoredGiftJudgement(signature) {
    if (!signature) return null;
    return getGiftJudgementStore()[signature] || null;
}

function saveGiftJudgement(signature, judgement) {
    if (!signature || !judgement) return;
    getGiftJudgementStore()[signature] = {
        ...judgement,
        collapsed: Boolean(judgement.collapsed),
    };
    saveSettingsDebounced();
}

function setGiftJudgementCollapsed(signature, collapsed) {
    const judgement = getStoredGiftJudgement(signature);
    if (!judgement) return;
    judgement.collapsed = Boolean(collapsed);
    saveGiftJudgement(signature, judgement);
}


function getActiveSocialCharacter() {
    if (!activeSocialCharacterId) return null;

    for (const char of characters.values()) {
        if (char.id === activeSocialCharacterId) {
            return char;
        }
    }

    return null;
}

function queueGiftForNextReply(gift) {
    if (!gift?.id) return false;

    pendingGiftDeliveryQueue.push({
        ...gift,
        queuedAt: Date.now(),
    });

    console.log(`[Dangan][Items] Queued gift for next reply: ${gift.name} (queue size: ${pendingGiftDeliveryQueue.length})`);
    return true;
}

function buildMessageSignature(msgEl, rawText) {
    const mesId = msgEl.getAttribute("mesid") || msgEl.dataset?.mesid || "no-id";
    const chName = msgEl.getAttribute("ch_name") || "unknown";
    return `${mesId}||${chName}||${(rawText || "").slice(0, 120)}`;
}

function normalizeGiftVerdict(value) {
    const v = String(value || "").trim().toUpperCase();
    if (v.includes("BAD")) return "SOCIAL_DOWN";
    if (v.includes("GOOD")) return "SOCIAL_UP";
    return "NEUTRAL";
}

async function generateGiftReactionExcerpt({ gift, characterName, characterSource }) {
    const prompt = `
TASK:
Evaluate how a character reacts to receiving a gift.

Return EXACTLY this format:
reaction: <one short line, max 22 words>
verdict: <GOOD|NEUTRAL|BAD>

Rules:
- No roleplay continuation.
- Do not mention this instruction.
- Avoid em-dashes.
- Do not use markdown formatting.
- Do not use asterisks in the reaction.
- Keep reaction concise and emotionally clear.
- Include really short dialogue only when appropriate (1 to 4 words, in quotes).
- Judge fit between gift and character profile.

CHARACTER:
${characterName}

CHARACTER SOURCE:
${characterSource}

GIFT:
name: ${gift.name}
rarity: ${gift.rarity}
description: ${gift.description}
intended_effect: ${gift.effect || "unknown"}

LOCATION ALIAS REFERENCE (for map tracking parser):
${getLocationPromptReference()}
`.trim();

    try {
        const result = await generateIsolated(prompt, { allowDialogue: true });
        const reactionMatch = result.match(/^reaction:\s*(.+)$/im);
        const verdictMatch = result.match(/^verdict:\s*(.+)$/im);

        const reaction = (reactionMatch?.[1] || `${characterName} studies the gift with a hard-to-read expression.`)
            .replace(/[—–]/g, ",")
            .replace(/\*/g, "")
            .trim();

        return {
            reaction,
            verdict: normalizeGiftVerdict(verdictMatch?.[1] || "NEUTRAL"),
        };
    } catch (err) {
        console.warn("[Dangan][Items] Gift reaction generation failed:", err);
        return {
            reaction: `${characterName} accepts the gift with a measured nod.`,
            verdict: "NEUTRAL",
        };
    }
}

function applyGiftOutcome(characterName, verdict, signatureSeed) {
    const key = normalizeName(characterName);
    const char = characters.get(key);
    if (!char) return;

    const signature = `GIFT||${verdict}||${signatureSeed}`;
    if (char.trustHistory?.has(signature)) return;

    char.trustHistory ||= new Set();
    char.trustHistory.add(signature);

    if (verdict === "SOCIAL_UP") {
        increaseTrustWithRewards(char);
    } else if (verdict === "SOCIAL_DOWN") {
        decreaseTrust(char);
    }
}

function injectGiftReactionBanner(msgEl, { signature, verdict, reaction, giftName, characterName, collapsed = false }) {
    const msgText = msgEl.querySelector(".mes_text");
    if (!msgText) return;

    if (msgEl.querySelector('.dangan-gift-reaction')) return;

    const banner = document.createElement("div");
    banner.className = `dangan-gift-reaction verdict-${String(verdict || "neutral").toLowerCase()}`;
    if (collapsed) banner.classList.add("collapsed");

    const tag = document.createElement("span");
    tag.className = "gift-tag";
    tag.textContent = `GIFT REACTION · ${verdict}`;

    const toggle = document.createElement("button");
    toggle.className = "gift-collapse-toggle";
    toggle.type = "button";
    toggle.title = "Toggle judgement";
    toggle.setAttribute("aria-label", "Toggle judgement");
    toggle.textContent = "·";

    toggle.addEventListener("click", () => {
        banner.classList.toggle("collapsed");
        if (signature) {
            setGiftJudgementCollapsed(signature, banner.classList.contains("collapsed"));
        }
    });

    const body = document.createElement("span");
    body.className = "gift-body";
    body.innerHTML = `<b>${characterName}</b> on <i>${giftName}</i>: ${reaction}`;

    banner.appendChild(tag);
    banner.appendChild(toggle);
    banner.appendChild(body);

    msgText.parentNode.insertBefore(banner, msgText);
}

function injectPersistedGiftReactionForMessage(msgEl, signature) {
    const saved = getStoredGiftJudgement(signature);
    if (!saved) return;

    injectGiftReactionBanner(msgEl, {
        signature,
        verdict: saved.verdict,
        reaction: saved.reaction,
        giftName: saved.giftName,
        characterName: saved.characterName,
        collapsed: Boolean(saved.collapsed),
    });
}

async function tryResolvePendingGiftForMessage(msgEl, rawText) {
    if (!pendingGiftDeliveryQueue.length || pendingGiftResolutionInFlight) return;

    const isUser = msgEl.getAttribute("is_user") === "true";
    const isSystem = msgEl.getAttribute("is_system") === "true";
    const characterName = msgEl.getAttribute("ch_name");

    if (isUser || isSystem || !characterName) return;

    const signature = buildMessageSignature(msgEl, rawText);
    if (processedGiftMessageSignatures.has(signature)) return;

    pendingGiftResolutionInFlight = true;
    processedGiftMessageSignatures.add(signature);

    const gift = pendingGiftDeliveryQueue[0];

    const characterSource = getCharacterSourceText(characterName);
    const reactionData = await generateGiftReactionExcerpt({
        gift,
        characterName,
        characterSource,
    });

    const judgement = {
        verdict: reactionData.verdict,
        reaction: reactionData.reaction,
        giftName: gift.name,
        characterName,
        collapsed: false,
        createdAt: Date.now(),
    };

    saveGiftJudgement(signature, judgement);
    injectGiftReactionBanner(msgEl, {
        signature,
        ...judgement,
    });

    applyGiftOutcome(characterName, reactionData.verdict, signature);
    awardXp(XP_REWARDS.giftGiven, "gift delivered");
    pendingGiftDeliveryQueue.shift();
    pendingGiftResolutionInFlight = false;
}

async function generateIsolated(prompt, { allowDialogue = false, maxTokens = 300 } = {}) {
    const fullPrompt = `
You are an analysis engine.
You do NOT roleplay.
${allowDialogue ? "You may include extremely short quoted dialogue only when explicitly requested." : "You do NOT write dialogue."}
You ONLY output structured analytical reports.

${prompt}
`.trim();

    if (isOpenRouterGenerationEnabled()) {
        return generateWithOpenRouter(fullPrompt, {
            maxTokens,
            temperature: 0.25,
            topP: 0.9,
            stop: ["USER:", "ASSISTANT:", "###"]
        });
    }

    if (!window.SillyTavern?.getContext) {
        throw new Error("SillyTavern context unavailable");
    }

    const ctx = SillyTavern.getContext();
    if (!ctx.generateRaw) {
        throw new Error("generateRaw not available");
    }

    const result = await ctx.generateRaw({
        prompt: fullPrompt,
        responseLength: maxTokens,
    });

    return (result || "").trim();
}

async function generateTrialDialogue(prompt, { maxTokens = 140, temperature = 0.7, topP = 0.9, stop = ["USER:", "ASSISTANT:", "###"] } = {}) {
    const fullPrompt = String(prompt || "").trim();

    if (isOpenRouterGenerationEnabled()) {
        return generateWithOpenRouter(fullPrompt, {
            maxTokens,
            temperature,
            topP,
            stop,
        });
    }

    if (!window.SillyTavern?.getContext) {
        throw new Error("SillyTavern context unavailable");
    }

    const ctx = SillyTavern.getContext();
    if (!ctx.generateRaw) {
        throw new Error("generateRaw not available");
    }

    const result = await ctx.generateRaw({
        prompt: fullPrompt,
        max_tokens: maxTokens,
        temperature,
        top_p: topP,
        stop,
    });

    return (result || "").trim();
}

async function generateTrialDialogueWithMainApi(prompt, { maxTokens = 140, temperature = 0.7, topP = 0.9, stop = ["USER:", "ASSISTANT:", "###"] } = {}) {
    const fullPrompt = String(prompt || "").trim();

    if (!window.SillyTavern?.getContext) {
        throw new Error("SillyTavern context unavailable");
    }

    const ctx = SillyTavern.getContext();
    if (!ctx.generateRaw) {
        throw new Error("generateRaw not available");
    }

    const result = await ctx.generateRaw({
        prompt: fullPrompt,
        max_tokens: maxTokens,
        temperature,
        top_p: topP,
        stop,
    });

    return (result || "").trim();
}

async function generateTrialDialogueWithOpenRouter(prompt, { maxTokens = 140, temperature = 0.7, topP = 0.9, stop = ["USER:", "ASSISTANT:", "###"] } = {}) {
    return generateWithOpenRouter(String(prompt || "").trim(), {
        maxTokens,
        temperature,
        topP,
        stop,
    });
}

// Parses the LLM's Scrum Debate response into a scenario object.  Returns
// null if the response is malformed or refers to truth bullets that don't
// exist in the player's pool — the caller then retries or falls back.
//
// titleByLower: Map<lowercaseTitle, canonicalTitle> built from the real
// truth-bullet pool, used to resolve TRUTH_BULLET values back to the exact
// title stored in extension_settings.
function parseScrumDebateResponse(out, titleByLower, expectedRounds = 3) {
    const lines = String(out || "").split("\n").map(l => l.trim());

    let opposingTheory = "";
    let playerTheory   = "";
    const roundChunks  = [];
    let currentRound   = null;

    for (const line of lines) {
        const opp = line.match(/^OPPOSING_THEORY\s*:\s*(.+)$/i);
        if (opp) { opposingTheory = opp[1].trim(); continue; }
        const pl = line.match(/^PLAYER_THEORY\s*:\s*(.+)$/i);
        if (pl)  { playerTheory   = pl[1].trim(); continue; }
        if (/^ROUND\s*\d+/i.test(line)) {
            if (currentRound) roundChunks.push(currentRound);
            currentRound = { claim: "", statement: "", bulletRaw: "" };
            continue;
        }
        if (!currentRound) continue;
        const claim = line.match(/^CLAIM\s*:\s*(.+)$/i);
        if (claim) { currentRound.claim = claim[1].trim(); continue; }
        const stmt = line.match(/^STATEMENT\s*:\s*(.+)$/i);
        if (stmt)  { currentRound.statement = stmt[1].trim(); continue; }
        const tb   = line.match(/^TRUTH[_-]?BULLET\s*:\s*(.+)$/i);
        if (tb)    { currentRound.bulletRaw = tb[1].trim(); continue; }
    }
    if (currentRound) roundChunks.push(currentRound);
    if (roundChunks.length < expectedRounds) return null;
    if (!opposingTheory || !playerTheory) return null;

    // Hard-cap rocket-banner text at 5 words — the LLM is asked for this in
    // the prompt, but the banners get clipped at screen edge if it overruns,
    // so we enforce here too.
    const clipToFiveWords = (s) => {
        const cleaned = String(s).replace(/[.,;:]+$/g, "").trim();
        const words = cleaned.split(/\s+/).filter(Boolean);
        return words.slice(0, 5).join(" ");
    };
    opposingTheory = clipToFiveWords(opposingTheory);
    playerTheory   = clipToFiveWords(playerTheory);

    // Title-cases each word in an opposing "fake" claim ("power surge" →
    // "Power Surge").  Preserves intentional all-caps (e.g. "A/C") and
    // articles inside the phrase aren't lower-cased because the cap-name
    // appears as a banner on the rocket — uniform capitalisation reads best.
    const toTitleCase = (s) => String(s).split(/(\s+)/).map(part => {
        if (!/\S/.test(part)) return part;
        if (/^[A-Z0-9/]{2,}$/.test(part)) return part; // keep ALL-CAPS / "A/C"
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }).join("");

    const rounds      = [];
    const usedBullets = new Set();
    for (const c of roundChunks.slice(0, expectedRounds)) {
        // Exactly one [[…]] segment per statement.
        if (!c.statement) return null;
        const openCount = (c.statement.match(/\[\[/g) || []).length;
        const innerOk   = /\[\[[^\[\]]+\]\]/.test(c.statement);
        if (openCount !== 1 || !innerOk) return null;

        let bulletTitle = titleByLower.get(c.bulletRaw.toLowerCase());
        if (!bulletTitle) {
            const stripped = c.bulletRaw.replace(/^["'`*\s]+|["'`.!,*\s]+$/g, "");
            bulletTitle = titleByLower.get(stripped.toLowerCase());
        }
        if (!bulletTitle || usedBullets.has(bulletTitle)) return null;
        usedBullets.add(bulletTitle);

        rounds.push({
            opposingClaim: toTitleCase(c.claim || bulletTitle),
            statement: c.statement,
            correctTruthBulletTitle: bulletTitle,
        });
    }

    if (rounds.length !== expectedRounds) return null;
    return { opposingTheory, playerTheory, rounds };
}

// Generates a Scrum Debate scenario via the LLM following the stub shape in
// vfx/scrumDebate.js (SCRUM_DEBATE_DEFAULT_SCENARIO).  Returns a scenario
// object on success or null on failure (caller should fall back to the
// hardcoded default).  Requires at least 3 truth bullets in the pool.
async function buildScrumDebateScenario({ trialContext, truthBullets, contextMessages, roundCount = 3, attempts = 2 } = {}) {
    if (typeof generateTrialDialogue !== "function") return null;

    // One round per opposing-team member. Clamp to [1, bullet pool size] so
    // we never ask for more unique TRUTH_BULLETS than the player owns.
    const requestedRounds = Math.max(1, Math.floor(Number(roundCount) || 0));

    const topic    = String(trialContext?.topic    || "").trim();
    const goal     = String(trialContext?.goal     || "").trim();
    const suspects = Array.isArray(trialContext?.suspects) ? trialContext.suspects : [];

    const bullets = (Array.isArray(truthBullets) ? truthBullets : [])
        .map(b => ({
            title:       String(b?.title       || "").trim(),
            description: String(b?.description || "").trim(),
        }))
        .filter(b => b.title);
    if (bullets.length < requestedRounds) {
        console.warn(`[Dangan][Scrum] Need ≥${requestedRounds} truth bullets to generate a scenario; falling back. Got:`, bullets.length);
        return null;
    }

    const bulletListText = bullets
        .map(b => `- ${b.title}${b.description ? ` — ${b.description}` : ""}`)
        .join("\n");

    const contextLines = (Array.isArray(contextMessages) ? contextMessages : [])
        .slice(-14)
        .map(m => `${m.isUser ? "YOU" : (m.name || "NARRATOR")}: ${m.text}`)
        .join("\n");

    // Build the variable-length ROUND format spec the LLM must follow.
    const roundsFormatSpec = Array.from({ length: requestedRounds }, (_, i) => {
        if (i === 0) {
            return `ROUND ${i + 1}
CLAIM: <2–5 word noun phrase naming what the opposing team is pointing at>
STATEMENT: <opposing-team statement, 8–22 words, with the WEAK part wrapped in [[double brackets]]>
TRUTH_BULLET: <one of the Truth Bullet titles above, copied character-for-character>`;
        }
        return `ROUND ${i + 1}
CLAIM: ...
STATEMENT: ...
TRUTH_BULLET: ...`;
    }).join("\n");

    const roundsWord = requestedRounds === 1 ? "one round" : `${requestedRounds} rounds`;

    const prompt = `
You are scripting a Danganronpa-style Scrum Debate. Two teams of students clash over opposing theories about the murder. Over ${roundsWord}, the opposing team makes confident claims about specific evidence or testimony; the player refutes the WEAK PART of each claim by firing the correct Truth Bullet.

TRIAL CONTEXT
Topic: ${topic || "(unknown)"}
Goal: ${goal || "(unknown)"}
Suspects: ${suspects.join(", ") || "(unknown)"}

TRUTH BULLETS (the player's available evidence — you MUST pick TRUTH_BULLET titles VERBATIM from this list):
${bulletListText}

DEBATE FORMAT
- Two opposing theories about the murder: the opposing team's accusation vs. the player's counter-accusation.
- Exactly ${requestedRounds} round${requestedRounds === 1 ? "" : "s"}.  For each round:
    * The opposing team picks a piece of evidence or testimony and makes a confident claim about it.
    * Inside that claim, mark the WEAK PART — the specific assertion the truth bullet refutes — by wrapping it in [[double brackets]].
    * Pair the round with the one Truth Bullet whose existence makes the [[…]] part false.
- A given Truth Bullet may only be used in ONE round.

Respond in EXACTLY this format and nothing else. No JSON, no markdown, no commentary:

OPPOSING_THEORY: <MAX 5 WORDS — the opposing team's accusation as a tiny banner caption (e.g. "Nagito is the killer", "Knife from the kitchen")>
PLAYER_THEORY: <MAX 5 WORDS — the player's counter-accusation in the same caption style>
${roundsFormatSpec}

Rules:
- OPPOSING_THEORY and PLAYER_THEORY must each be FIVE WORDS OR FEWER — they render on a small rocket banner and longer text gets clipped.  No leading "The ", no trailing punctuation beyond a single "!" if used.
- Each STATEMENT contains exactly ONE [[…]] segment, with no nested or stray brackets.
- TRUTH_BULLET MUST exactly match a title from the TRUTH BULLETS list above (case-insensitive, but punctuation and words must match).
- Do not reuse a TRUTH_BULLET across rounds.
- Stay in-world: the statements should sound like the opposing team shouting them mid-trial.

RECENT CHAT CONTEXT:
${contextLines || "NONE"}
`.trim();

    const titleByLower = new Map(bullets.map(b => [b.title.toLowerCase(), b.title]));

    // Token budget scales roughly with the round count (~120 tokens / round
    // for CLAIM + STATEMENT + TRUTH_BULLET + headers).
    const maxTokens = Math.min(2000, 240 + requestedRounds * 130);

    for (let attempt = 0; attempt < attempts; attempt++) {
        let out = "";
        try {
            out = String(await generateTrialDialogue(prompt, {
                maxTokens,
                temperature: 0.78 + attempt * 0.07,
            }) || "").trim();
        } catch (e) {
            console.warn(`[Dangan][Scrum] LLM attempt ${attempt + 1} failed:`, e);
            continue;
        }
        if (!out) continue;

        const parsed = parseScrumDebateResponse(out, titleByLower, requestedRounds);
        if (!parsed) continue;

        return {
            title: "SCRUM DEBATE",
            topic,
            opposingTheory: parsed.opposingTheory,
            playerTheory:   parsed.playerTheory,
            rounds:         parsed.rounds,
        };
    }

    console.warn("[Dangan][Scrum] All generation attempts failed; falling back to stub.");
    return null;
}


async function generateCharacterNotes(char) {
const profile = char.social?.profile;

const hasRealData =
    profile &&
    Object.values(profile).some(
        v => v && v !== "unknown"
    );

if (hasRealData && char.social?.notes) {
    return char.social.notes;
}

    const sourceText = getCharacterSourceText(char.name);

    const prompt = `Extract a character profile for "${char.name}" from the Danganronpa game series.
Use the SOURCE below if available. If the source says "NO SOURCE DATA AVAILABLE", use your own knowledge of the Danganronpa games.
Output ONLY these 6 lines, no extra text:
ultimate: <role>
height: <height in cm if known, else "unknown">
measurements: <measurements if known, else "unknown">
personality: <3-4 traits, comma-separated>
likes: <2-3 items, comma-separated>
dislikes: <2-3 items, comma-separated>

SOURCE:
${sourceText.slice(0, 800)}`.trim();

    try {
        const result = (await generateIsolated(prompt, { maxTokens: 200 })) || "";
        console.log("[Dangan][Social] Raw generation result:", JSON.stringify(result));
        const lines = result
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);
        
const map = {};

lines.forEach(line => {
    const [key, ...rest] = line.split(":");
    if (!key || !rest.length) return;
    map[key.trim().toLowerCase()] = rest.join(":").trim();
});

char.social = {
    profile: {
        ultimate: map.ultimate || "unknown",
        height: map.height || "unknown",
        measurements: map.measurements || "unknown",
        personality: map.personality || "unknown",
        likes: map.likes || "unknown",
        dislikes: map.dislikes || "unknown"
    },
    notes: result,
    generatedAt: Date.now()
};

if (char.social.profile.ultimate !== "unknown") {
    char.ultimate = char.social.profile.ultimate;
}

saveCharacters();
return char.social.notes;
    } catch (err) {
        console.error("[Dangan][Social] Generation failed:", err);
        char.social = {
            profile: {
                ultimate: "unknown",
                height: "unknown",
                measurements: "unknown",
                personality: "unknown",
                likes: "unknown",
                dislikes: "unknown"
            },
            notes: "",
            generatedAt: Date.now()
        };
        return "";
    }
}

// ── Execution Cinematic Playback ─────────────────────────────────────────────

async function runExecutionCinematic(cinematic, charName) {
    // Build or reuse playback overlay
    let overlay = document.getElementById("exec-playback-overlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "exec-playback-overlay";
        overlay.style.cssText = "position:fixed;inset:0;z-index:2147483645;background:#000;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.35s ease;pointer-events:none";
        document.body.appendChild(overlay);
    }

    // Fade in overlay
    overlay.style.pointerEvents = "auto";
    overlay.style.opacity = "0";
    // two frames so transition fires
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    overlay.style.opacity = "1";
    await new Promise(r => setTimeout(r, 380));

    if (!cinematic) {
        // No cinematic configured — just hold black for 1s then fade out
        await new Promise(r => setTimeout(r, 1000));
    } else if (cinematic.type === "video" && cinematic.videoSrc) {
        await runExecutionVideo(overlay, cinematic);
    } else if (cinematic.type === "cinematic") {
        await runExecutionImageCinematic(overlay, cinematic);
    }

    // Fade out overlay
    overlay.style.opacity = "0";
    await new Promise(r => setTimeout(r, 380));
    overlay.innerHTML = "";
    overlay.style.pointerEvents = "none";
}

async function runExecutionVideo(overlay, cinematic) {
    overlay.innerHTML = "";
    const video = document.createElement("video");
    video.src = cinematic.videoSrc;
    video.style.cssText = "width:100%;height:100%;object-fit:contain;background:#000";
    video.autoplay = true;
    overlay.appendChild(video);

    await new Promise(resolve => {
        video.addEventListener("ended", resolve, { once: true });
        video.addEventListener("error", resolve, { once: true });
        // Fallback: timeout at 5 minutes
        setTimeout(resolve, 5 * 60 * 1000);
    });
}

async function runExecutionImageCinematic(overlay, cinematic) {
    overlay.innerHTML = "";

    const bg = document.createElement("div");
    bg.id = "exec-pb-bg";
    bg.style.cssText = "position:absolute;inset:0;background-size:cover;background-position:center;background-repeat:no-repeat;transform-origin:center;transition:none";
    const colorize = document.createElement("div");
    colorize.style.cssText = "position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity 200ms";
    const staticEl = document.createElement("div");
    staticEl.style.cssText = "position:absolute;inset:0;pointer-events:none;opacity:0;background:url('data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\"><filter id=\"n\"><feTurbulence type=\"fractalNoise\" baseFrequency=\"0.65\" numOctaves=\"3\" stitchTiles=\"stitch\"/></filter><rect width=\"100%\" height=\"100%\" filter=\"url(%23n)\" opacity=\"0.15\"/></svg>') center/cover";
    overlay.appendChild(bg); overlay.appendChild(colorize); overlay.appendChild(staticEl);

    if (!cinematic.audioSrc) {
        await new Promise(r => setTimeout(r, 10000));
        return;
    }

    const audio = new Audio(cinematic.audioSrc);
    const trackDurationMs = await new Promise(resolve => {
        audio.addEventListener("loadedmetadata", () => resolve(Math.round(audio.duration * 1000)), { once: true });
        audio.addEventListener("error", () => resolve(10000), { once: true });
        setTimeout(() => resolve(10000), 5000);
    });

    const sortedSegs = [...(cinematic.bgSegments || [])].sort((a, b) => a.startFrac - b.startFrac);
    const sortedPins = [...(cinematic.pins || [])].sort((a, b) => a.timeFrac - b.timeFrac);
    const imagesById = new Map((cinematic.images || []).map(i => [i.id, i]));

    function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
    function segAtMs(ms) { return sortedSegs.filter(s => s.startFrac * trackDurationMs <= ms).at(-1) ?? null; }
    function pinAtMs(ms) {
        for (const pin of sortedPins) {
            const start = (pin.timeFrac ?? 0) * trackDurationMs;
            const end = start + Math.max(100, pin.focusDurationMs ?? 800);
            if (ms >= start && ms <= end) return pin;
        }
        return null;
    }

    function applySegEffects(seg) {
        const filters = [];
        if ((seg?.hueShift ?? 0) !== 0) filters.push(`hue-rotate(${seg.hueShift}deg)`);
        if (seg?.imgFilter === "grayscale") filters.push("grayscale(1)");
        else if (seg?.imgFilter === "sepia") filters.push("sepia(1)");
        bg.style.filter = filters.join(" ");
        if (seg?.colorize) { colorize.style.background = seg.colorize; colorize.style.opacity = String(seg.colorizeOpacity ?? 0.4); }
        else { colorize.style.opacity = "0"; }
    }

    // Schedule BG image switches
    const timers = [];
    for (const seg of sortedSegs) {
        if (!seg.bgFile) continue;
        const img = imagesById.get(seg.bgFile);
        if (!img?.src) continue;
        timers.push(setTimeout(() => {
            bg.style.backgroundImage = `url("${img.src}")`;
            applySegEffects(seg);
        }, Math.round(seg.startFrac * trackDurationMs)));
    }

    let rafId = null;
    let lastSegId = undefined, lastPinId = undefined;

    function tick() {
        if (!audio || audio.paused || audio.ended) return;
        const elapsed = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.currentTime * 1000 : 0;

        const activeSeg = segAtMs(elapsed);
        const activePin = pinAtMs(elapsed);

        if (activeSeg?.id !== lastSegId) { applySegEffects(activeSeg); lastSegId = activeSeg?.id ?? null; }

        // Per-frame fade
        if (activeSeg) {
            const segStart = activeSeg.startFrac * trackDurationMs;
            const segEnd = activeSeg.endFrac * trackDurationMs;
            const segElapsed = elapsed - segStart, segRemain = segEnd - elapsed;
            const fadeInMs = activeSeg.fadeIn ?? 0, fadeOutMs = activeSeg.fadeOut ?? 0;
            let opacity = 1;
            if (fadeInMs > 0 && segElapsed < fadeInMs) opacity = Math.min(opacity, segElapsed / fadeInMs);
            if (fadeOutMs > 0 && segRemain < fadeOutMs) opacity = Math.min(opacity, segRemain / fadeOutMs);
            bg.style.opacity = String(clamp01(opacity));
        } else { bg.style.opacity = "1"; }

        // Camera transform
        if (activePin) {
            const startMs = (activePin.timeFrac ?? 0) * trackDurationMs;
            const durMs = Math.max(1, activePin.focusDurationMs ?? 800);
            const t = clamp01((elapsed - startMs) / durMs);
            const pinB = activePin.connectTo ? sortedPins.find(p => p.id === activePin.connectTo) ?? null : null;
            let ix, iy;
            if (pinB) {
                if ((activePin.pathType ?? "direct") === "smooth") {
                    const mx = (activePin.xFrac + pinB.xFrac) / 2, my = (activePin.yFrac + pinB.yFrac) / 2;
                    const dx = pinB.xFrac - activePin.xFrac, dy = pinB.yFrac - activePin.yFrac;
                    const len = Math.sqrt(dx*dx + dy*dy) || 0.001;
                    const cpx = mx + (-dy/len)*len*0.35, cpy = my + (dx/len)*len*0.35;
                    ix = (1-t)*(1-t)*activePin.xFrac + 2*(1-t)*t*cpx + t*t*pinB.xFrac;
                    iy = (1-t)*(1-t)*activePin.yFrac + 2*(1-t)*t*cpy + t*t*pinB.yFrac;
                } else {
                    ix = activePin.xFrac + (pinB.xFrac - activePin.xFrac) * t;
                    iy = activePin.yFrac + (pinB.yFrac - activePin.yFrac) * t;
                }
            } else { ix = activePin.xFrac; iy = activePin.yFrac; }
            const scale = (activePin.baseZoom ?? 1.0) + ((activePin.zoom ?? 1.3) - (activePin.baseZoom ?? 1.0)) * t;
            bg.style.transition = "none";
            bg.style.transform = `scale(${scale.toFixed(3)}) translate(${((0.5-ix)*100).toFixed(2)}%, ${((0.5-iy)*100).toFixed(2)}%)`;
            lastPinId = activePin.id;

            // Shake
            const shakeAmt = activePin.shake ?? 0;
            bg.style.animation = shakeAmt > 0 ? `bda-shake ${Math.round(40+(1-shakeAmt)*60)}ms steps(3,end) infinite` : "";

            // Static
            staticEl.style.opacity = String(activePin.staticOpacity ?? 0);
        } else {
            if (lastPinId) { bg.style.transition = "transform 0.4s ease-out"; bg.style.transform = "scale(1) translate(0%,0%)"; lastPinId = null; }
            bg.style.animation = "";
            staticEl.style.opacity = "0";
        }

        rafId = requestAnimationFrame(tick);
    }

    audio.addEventListener("play", () => { rafId = requestAnimationFrame(tick); }, { once: true });

    await new Promise(resolve => {
        audio.addEventListener("ended", resolve, { once: true });
        audio.addEventListener("error", resolve, { once: true });
        setTimeout(resolve, trackDurationMs + 1000);
        audio.play().catch(resolve);
    });

    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    timers.forEach(clearTimeout);

    bg.style.transition = "transform 1s ease-out";
    bg.style.transform = "scale(1) translate(0%,0%)";
    await new Promise(r => setTimeout(r, 1100));
}

let sfx = {};
function playSfx(sound) {
    if (!sound) return;
    
    let audio = sound;
    if (typeof sound === 'string') {
        audio = sfx[sound] || document.getElementById(sound);
    }
    
    if (!audio || typeof audio.play !== 'function') {
        console.warn("[Dangan] playSfx: Invalid sound object/ID:", sound);
        return;
    }

    const volume = Number(extension_settings[extensionName]?.monopadVolume ?? 50) / 100;
    if (volume <= 0) return;
    
    try {
        audio.currentTime = 0;
        audio.volume = volume;
        audio.play().catch(e => console.warn("[Dangan] Audio play blocked/failed:", e));
    } catch (err) {
        console.error("[Dangan] Error playing SFX:", err);
    }
}

let audioUnlocked = false;

function unlockAudio() {
    if (audioUnlocked) return;
    audioUnlocked = true;

    Object.values(sfx).forEach(sound => {
        if (!sound) return;
        sound.volume = 0;
        sound.play().catch(() => {});
        sound.pause();
        sound.currentTime = 0;
        sound.volume = 0.5;
    });
}

function stripV3CMarkersFromText(value) {
    const text = String(value || "");
    if (!text) return text;

    const lines = text.split(/\r?\n/);
    const kept = lines.filter((line) => {
        const canonical = line
            .toUpperCase()
            .replace(/[|｜]/g, "|")
            .replace(/[`*_~\s]/g, "");

        if (canonical.startsWith("V3C|TB:")) return false;
        if (canonical.startsWith("V3C|SOCIAL:")) return false;
        if (canonical.startsWith("V3C|SOCIAL_UP:")) return false;
        if (canonical.startsWith("V3C|SOCIAL_DOWN:")) return false;
        if (canonical.includes("V3C|INVESTIGATIONSTART")) return false;
        if (canonical.includes("V3C|DAYANNOUN")) return false;
        if (canonical.includes("V3C|NIGHTANNOUN")) return false;
        if (canonical.includes("V3C|BDA")) return false;
        if (canonical.includes("V3C|BODYDISCOVERY")) return false;
        if (canonical.includes("V3C|PASSTIME")) return false;
        if (canonical.includes("V3C|SLEEP")) return false;
        return true;
    });

    return kept.join("\n")
        .replace(/V3C\s*[|｜]\s*TB:\s*([^|\n\r]+)(?:\|\|\s*([^\n\r]+))?/gi, "")
        .replace(/V3C\s*[|｜]\s*SOCIAL:\s*([^\n\r]+)/gi, "")
        .replace(/V3C\s*[|｜]\s*SOCIAL_UP:\s*([^\n\r]+)/gi, "")
        .replace(/V3C\s*[|｜]\s*SOCIAL_DOWN:\s*([^\n\r]+)/gi, "")
        .replace(/V3C\s*[|｜]\s*INVESTIGATION(?:\s*[_\-]?\s*)START\b/gi, "")
        .replace(/V3C\s*[|｜]\s*DAY(?:\s*[_\-]?\s*)ANNOUN\b/gi, "")
        .replace(/V3C\s*[|｜]\s*NIGHT(?:\s*[_\-]?\s*)ANNOUN\b/gi, "")
        .replace(/V3C\s*[|｜]\s*BDA\b/gi, "")
        .replace(/V3C\s*[|｜]\s*BODY(?:\s*[_\-]?\s*)DISCOVERY\b/gi, "")
        .replace(/V3C\s*[|｜]\s*PASS(?:\s*[_\-]?\s*)TIME\b/gi, "")
        .replace(/V3C\s*[|｜]\s*SLEEP\b/gi, "")
        .replace(/^[ \t]+/gm, "")
        .trimStart();
}

function maybeTrackMessageLocation(msgEl, rawText) {
    const locationId = resolveLocationIdFromText(rawText);
    if (!locationId) return;

    const isUser = msgEl.getAttribute("is_user") === "true";
    const isSystem = msgEl.getAttribute("is_system") === "true";
    if (isSystem) return;

    const speakerName = isUser
        ? getActivePersonaName()
        : (msgEl.getAttribute("ch_name") || msgEl.getAttribute("name") || "").trim();

    if (!isUser && !speakerName) return;

    const signature = buildMessageSignature(msgEl, rawText);
    pushRecentLocationMention({
        messageSignature: signature,
        speakerName,
        isUser,
        locationId,
    });

    if (document.querySelector('.monopad-panel-content[data-panel="map"].active')) {
        mapPanelController?.renderMapPanel?.();
    }
}

function waitForSfx(key, callback, tries = 20) {
    if (sfx[key]) {
        callback(sfx[key]);
        return;
    }

    if (tries <= 0) {
        console.warn(`[Dangan][SFX] ${key} never loaded`);
        return;
    }

    setTimeout(() => waitForSfx(key, callback, tries - 1), 50);
}

function startV3CObserver() {
    const chat = document.getElementById("chat");
    if (!chat) return;

    const TB_REGEX = /V3C\|\s*TB:\s*([^|\n\r]+)(?:\|\|\s*([^\n\r]+))?/g;

function processAllMessages() {
    const messages = document.querySelectorAll(".mes");

    messages.forEach(msgEl => {
        // 🔑 REGISTER CHARACTER FROM DOM
        registerCharacterFromMessage(msgEl);

        const msgText = msgEl.querySelector(".mes_text");
        if (!msgText) return;

        const rawText = msgText.textContent;
        const messageSignature = buildMessageSignature(msgEl, rawText);
        const isUserMessage = msgEl.getAttribute("is_user") === "true";
        const speakerName = isUserMessage
            ? getActivePersonaName()
            : (msgEl.getAttribute("ch_name") || msgEl.getAttribute("name") || "UNKNOWN");
        maybeTrackMessageLocation(msgEl, rawText);
        injectPersistedGiftReactionForMessage(msgEl, messageSignature);
        void tryResolvePendingGiftForMessage(msgEl, rawText);

        // ---- Truth Bullets ----
        for (const match of rawText.matchAll(TB_REGEX)) {
            const title = match[1]?.trim();
            const description = match[2]?.trim() || "";
            if (!title) continue;

            const signature = `${title}||${description}`;
            if (processedTruthSignatures.has(signature)) continue;

            processedTruthSignatures.add(signature);
            handleTruthBullet(title, description);
        }

// ---- Social Trust UP ----
for (const regex of [SOCIAL_REGEX, SOCIAL_UP_REGEX]) {
for (const match of rawText.matchAll(regex)) {
    const name = match[1]?.trim();
    if (!name) continue;

    const key = normalizeName(name);
    const char = characters.get(key);
    if (!char) continue;

    const signature = `UP||${key}||${rawText}`;

    // 🛑 Already used this message
    if (char.trustHistory.has(signature)) continue;

    char.trustHistory.add(signature);
    increaseTrustWithRewards(char);
}
}

// ---- Social Trust DOWN ----
for (const match of rawText.matchAll(SOCIAL_DOWN_REGEX)) {
    const name = match[1]?.trim();
    if (!name) continue;

    const key = normalizeName(name);
    const char = characters.get(key);
    if (!char) continue;

    const signature = `DOWN||${key}||${rawText}`;

    // 🛑 Already used this message
    if (char.trustHistory.has(signature)) continue;

    char.trustHistory.add(signature);
    decreaseTrust(char);
}

        // ---- Investigation Start ----
        const investigationMarkers = parseInvestigationStartMarkers(rawText);
        investigationMarkers.forEach((marker, idx) => {
            console.debug("[Dangan][Investigation] Marker detected", marker);
            const signature = `INVESTIGATION||${messageSignature}||${marker.index}||${idx}`;
            const persistentSignature = buildPersistentInvestigationSignature(msgEl, marker, idx, rawText);
            if (hasProcessedInvestigationSignature(signature, persistentSignature)) return;

            const triggered = investigationStartController.trigger();
            if (triggered) {
                markInvestigationSignatureProcessed(signature, persistentSignature);
            }
        });

        // ---- Monokuma Announcements ----
        const monokumaAnnouncementMarkers = parseMonokumaAnnouncementMarkers(rawText)
            .slice()
            .sort((a, b) => {
                const aPriority = a?.type === "BODY_DISCOVERY" ? 0 : 1;
                const bPriority = b?.type === "BODY_DISCOVERY" ? 0 : 1;
                if (aPriority !== bPriority) return aPriority - bPriority;

                const aIndex = Number.isFinite(Number(a?.index)) ? Number(a.index) : Number.MAX_SAFE_INTEGER;
                const bIndex = Number.isFinite(Number(b?.index)) ? Number(b.index) : Number.MAX_SAFE_INTEGER;
                return aIndex - bIndex;
            });

        monokumaAnnouncementMarkers.forEach((marker, idx) => {
            const signature = `MONOKUMA_ANNOUN||${messageSignature}||${marker.index}||${idx}||${marker.type}`;
            const persistentSignature = buildGenericPersistentMarkerSignature(
                msgEl,
                `MONOKUMA_ANNOUN_${marker?.type || "UNKNOWN"}`,
                marker?.index,
                idx,
                rawText,
            );
            if (processedMonokumaAnnouncementSignatures.has(signature)) return;
            if (hasProcessedPersistentMarker("monokumaAnnouncementMarkers", persistentSignature)) return;

            processedMonokumaAnnouncementSignatures.add(signature);
            markProcessedPersistentMarker("monokumaAnnouncementMarkers", persistentSignature);
            monokumaAnnouncementController?.trigger(marker.type);
        });

        // ---- Trial Context ----
        for (const match of rawText.matchAll(TRIAL_CONTEXT_REGEX)) {
            const topic    = match[1]?.trim() || '';
            const goal     = match[2]?.trim() || '';
            const suspects = (match[3]?.trim() || '').split(',').map(s => {
                const [name, pctRaw] = s.trim().split(':');
                const chance = parseInt(pctRaw ?? '') || 0;
                return name?.trim() ? { name: name.trim(), chance } : null;
            }).filter(Boolean).slice(0, 3);
            trialManager?.setTrialContext?.(topic, goal, suspects);
            break; // only process the first match per message
        }

        // ---- Marker Cleanup ----
       if (/[Vv]3[Cc]\s*[|｜]/.test(rawText)) {
    const walker = document.createTreeWalker(
        msgText,
        NodeFilter.SHOW_TEXT,
        null
    );

    let textNode;
    while ((textNode = walker.nextNode())) {
        if (!/[Vv]3[Cc]\s*[|｜]/.test(textNode.nodeValue)) continue;
        textNode.nodeValue = stripV3CMarkersFromText(textNode.nodeValue);
        }
    }

})
} // ✅ CLOSE processAllMessages()

    let _processAllMsgRaf = null;
    const observer = new MutationObserver(() => {
        if (!_processAllMsgRaf) {
            _processAllMsgRaf = requestAnimationFrame(() => {
                _processAllMsgRaf = null;
                processAllMessages();
            });
        }
    });

    observer.observe(chat, {
        childList: true,
        subtree: true
    });

    // 🟢 Initial pass (important for reloads & history)
    processAllMessages();
    vnModeController?.refresh?.();

    console.log(`[${extensionName}] [Dangan] V3C marker observer active (swipe-safe)`);
}

function waitForRealChat(callback) {
    const maxTries = 50;
    let tries = 0;

    const interval = setInterval(() => {
        tries++;

        if (!window.SillyTavern?.getContext) return;

        const ctx = SillyTavern.getContext();
        const chat = ctx?.chat;

        if (Array.isArray(chat) && chat.length > 1) {
            clearInterval(interval);
            console.log("[Dangan][Social] Real chat detected");
            callback();
        }

        if (tries >= maxTries) {
            clearInterval(interval);
            console.warn("[Dangan][Social] Timed out waiting for real chat");
        }
    }, 200);
}

function getCharacterSourceText(charName) {
    let sources = [];

    // Character card (group chat)
    const ctx = SillyTavern?.getContext?.();
    const ch = ctx?.characters?.find(c =>
        normalizeName(c.name) === normalizeName(charName)
    );

    if (ch?.description) {
        sources.push(`CHARACTER CARD:\n${ch.description}`);
    }

    // Active lorebook
    const entries = window.world_info?.entries || [];
    entries.forEach(entry => {
        if (
            entry?.content &&
            entry.content.toLowerCase().includes(charName.toLowerCase())
        ) {
            sources.push(`LOREBOOK ENTRY:\n${entry.content}`);
        }
    });

    return sources.join("\n\n") || "NO SOURCE DATA AVAILABLE.";
}

// ST's /api/sprites/get strips dash-suffixes when computing the `label` field
// (see src/endpoints/sprites.js — the regex `^(.+?)(?:[-\\.].*?)?$` cuts at
// the first `-` or `.`). So `gratitude.png` and `gratitude-half.png` BOTH
// report label `gratitude` — to distinguish variants we check the file path.
function isHalfSpritePath(s) {
    return /-half\.[a-z0-9]+(\?|$)/i.test(String(s?.path || ''));
}

// Per-location forced outfits. A Location Pin can carry an `outfitPrefix`
// (e.g. "pool-"); while the scene's current location is that pin, sprite
// lookups try `<prefix><emotion>` first (pool-neutral, pool-love, …) so a
// character is "forced" into that outfit. Characters lacking the prefixed
// sprite simply fall back to their normal one (see callers below).
function getActiveOutfitPrefix() {
    try {
        const id = getCurrentLocationId();
        if (!id) return '';
        const pin = mapPanelController?.getPinByLocationId?.(id);
        return String(pin?.outfitPrefix || '').trim();
    } catch { return ''; }
}

// Stem of a sprite's actual filename (path-based), lowercased, no dir/ext/query.
// Needed because ST's /api/sprites/get collapses the `label` field at the first
// '-' (see note above isHalfSpritePath), so "pool-neutral.png" reports label
// "pool" — the only reliable way to match a prefixed outfit is the real filename.
function spriteFileStem(s) {
    const base = String(s?.path || '').split('/').pop().split('?')[0];
    return base.replace(/\.[a-z0-9]+$/i, '').toLowerCase();
}

// Find a forced-outfit sprite for `<prefix><label>` by exact filename stem.
// Tries the exact emotion first, then the outfit's neutral (`<prefix>neutral`)
// so a character keeps the outfit even when they lack that specific emotion's
// variant — being "forced" into the pool outfit matters more than the exact
// face. Returns null only when the character has NO outfit sprite at all, which
// signals the callers to fall back to the normal (un-prefixed) sprite.
// preferHalf flips the full/-half preference for half-sprite chat mode.
function pickForcedOutfitSprite(sprites, prefix, label, preferHalf) {
    const lcLabel = String(label || '').toLowerCase();
    const tryLabels = lcLabel === 'neutral' ? ['neutral'] : [lcLabel, 'neutral'];
    for (const lbl of tryLabels) {
        const want = (String(prefix) + lbl).toLowerCase(); // e.g. "pool-love"
        const full = sprites.find(s => spriteFileStem(s) === want);
        const half = sprites.find(s => spriteFileStem(s) === want + '-half');
        const hit = preferHalf ? (half?.path ?? full?.path) : (full?.path ?? half?.path);
        if (hit) return hit;
    }
    return null;
}

// Default sprite resolver. Always prefers the FULL sprite over a -half variant
// — half-sprite mode is a chat-only concern (overworld characters, chapter
// end rosters, choose-character UI, etc. must always render full body).
async function getSpriteUrl(charName, label = "neutral") {
    let folder = charName;
    const stChars = window.characters;
    if (Array.isArray(stChars)) {
        const stChar = stChars.find(c => c.name === charName);
        if (stChar?.avatar) {
            folder = stChar.avatar.replace(/\.[^.]+$/, "");
        }
    }
    try {
        const resp = await fetch(`/api/sprites/get?name=${encodeURIComponent(folder)}`);
        if (!resp.ok) return null;
        const sprites = await resp.json();
        // Forced outfit (per current Location Pin) takes priority. If the
        // character has no sprite for this outfit/emotion, fall through to the
        // normal resolution below so they keep their usual sprite.
        const outfitPrefix = getActiveOutfitPrefix();
        if (outfitPrefix) {
            const forced = pickForcedOutfitSprite(sprites, outfitPrefix, label, false);
            if (forced) return forced;
        }
        const lcLabel = String(label || '').toLowerCase();
        const matchLabel = (s) => String(s.label || '').toLowerCase() === lcLabel;
        const labelMatches = sprites.filter(matchLabel);
        const neutralMatches = sprites.filter(s => String(s.label || '').toLowerCase() === 'neutral');
        // Full-body contexts (overworld, class trials, chapter rosters, UI
        // pickers) must NEVER render a -half crop. A half sprite dropped into a
        // full-body slot renders as a floating upper-body fragment — and inside
        // the NSD lectern frame the cropped art ends up behind the podium, so
        // the character appears to vanish (this is the "characters disappear in
        // NSD in half-sprite mode" bug: a sprite pack built for half-sprite mode
        // often has -half-only variants for some emotions, and whichever
        // scenario happens to use that emotion drops the speaker).
        //
        // So prefer the full <label>, then fall back to the full neutral pose.
        // Only use a -half variant as an absolute last resort, when the
        // character has no full sprite at all (a blank slot is worse).
        const labelFull = labelMatches.find(s => !isHalfSpritePath(s));
        if (labelFull?.path) return labelFull.path;
        const neutralFull = neutralMatches.find(s => !isHalfSpritePath(s));
        if (neutralFull?.path) return neutralFull.path;
        const anyHalf = labelMatches[0] ?? neutralMatches[0];
        return anyHalf?.path ?? null;
    } catch {
        return null;
    }
}

// Chat-only sprite resolver. When half-sprite mode is on, prefers the -half
// variant (pre-cropped upper-body art) over the full sprite. Used by the GCP
// slot resolver (trial / group-chat sprite stage) so chat sprites can be
// upper-body crops while overworld + UI sprites stay full body.
async function getChatSpriteUrl(charName, label = "neutral") {
    const halfMode = !!extension_settings[extensionName]?.halfspriteMode;
    // Class trials never use -half sprites — full body only, even if the
    // user has half-sprite mode enabled. Trials have their own camera /
    // staging logic that assumes the canonical sprite framing.
    if (!halfMode || isTrialUiActive()) return getSpriteUrl(charName, label);

    let folder = charName;
    const stChars = window.characters;
    if (Array.isArray(stChars)) {
        const stChar = stChars.find(c => c.name === charName);
        if (stChar?.avatar) {
            folder = stChar.avatar.replace(/\.[^.]+$/, "");
        }
    }
    try {
        const resp = await fetch(`/api/sprites/get?name=${encodeURIComponent(folder)}`);
        if (!resp.ok) return null;
        const sprites = await resp.json();
        // Forced outfit (per current Location Pin) takes priority — prefer the
        // -half crop here since this is the half-sprite chat path. Falls through
        // to the normal chain when the character lacks the outfit sprite.
        const outfitPrefix = getActiveOutfitPrefix();
        if (outfitPrefix) {
            const forced = pickForcedOutfitSprite(sprites, outfitPrefix, label, true);
            if (forced) return forced;
        }
        const lcLabel = String(label || '').toLowerCase();
        const matchLabel = (s) => String(s.label || '').toLowerCase() === lcLabel;
        // Fallback chain: <label>-half → <label> → neutral-half → neutral.
        const labelMatches = sprites.filter(matchLabel);
        const halfDesired = labelMatches.find(isHalfSpritePath);
        if (halfDesired?.path) return halfDesired.path;
        const fullDesired = labelMatches.find(s => !isHalfSpritePath(s)) ?? labelMatches[0];
        if (fullDesired?.path) return fullDesired.path;
        const neutralMatches = sprites.filter(s => String(s.label || '').toLowerCase() === 'neutral');
        const halfNeutral = neutralMatches.find(isHalfSpritePath);
        if (halfNeutral?.path) return halfNeutral.path;
        const fullNeutral = neutralMatches.find(s => !isHalfSpritePath(s)) ?? neutralMatches[0];
        return fullNeutral?.path ?? null;
    } catch {
        return null;
    }
}

// Returns the deduped list of expression labels available for a character,
// derived from the same /api/sprites/get endpoint getSpriteUrl uses. Empty
// array if the character has no sprites or the call fails.
async function getAvailableExpressionLabels(charName) {
    let folder = charName;
    const stChars = window.characters;
    if (Array.isArray(stChars)) {
        const stChar = stChars.find(c => c.name === charName);
        if (stChar?.avatar) {
            folder = stChar.avatar.replace(/\.[^.]+$/, "");
        }
    }
    try {
        const resp = await fetch(`/api/sprites/get?name=${encodeURIComponent(folder)}`);
        if (!resp.ok) return [];
        const sprites = await resp.json();
        const labels = new Set();
        for (const s of sprites) {
            const label = String(s?.label || '').trim();
            if (!label) continue;
            // -half variants are PAIRED with their base (e.g. "gratitude-half"
            // is the upper-body crop of "gratitude") — skip them so random
            // expression pickers treat them as variants of the base label,
            // not as standalone expressions.
            if (/-half$/i.test(label)) continue;
            labels.add(label);
        }
        return [...labels];
    } catch {
        return [];
    }
}

const KNOWN_HEIGHTS_CM = new Map([
    ['monokuma',75],['saionji',130],['hiyoko',130],['hanamura',133],['teruteru',133],
    ['kuzuryu',157],['fuyuhiko',157],['nanami',160],['chiaki',160],['mioda',164],
    ['ibuki',164],['koizumi',165],['mahiru',165],['tsumiki',165],['mikan',165],
    ['soda',172],['kazuichi',172],['pekoyama',172],['peko',172],['nevermind',174],
    ['sonia',174],['owari',176],['akane',176],['hinata',179],['hajime',179],
    ['komaeda',180],['nagito',180],['tanaka',182],['gundham',182],['togami',185],
    ['byakuya',185],['nidai',198],['nekomaru',198],
]);

function getCharacterHeightCm(name) {
    if (!name) return null;
    const needle = String(name).trim().toLowerCase();
    for (const token of needle.split(/\s+/)) {
        if (KNOWN_HEIGHTS_CM.has(token)) return KNOWN_HEIGHTS_CM.get(token);
    }
    const stChars = window.characters;
    if (Array.isArray(stChars)) {
        const match = stChars.find(c => String(c.name || '').trim().toLowerCase() === needle);
        const raw = String(match?.extensions?.height_cm ?? match?.data?.extensions?.height_cm ?? '').trim();
        if (raw) { const n = parseFloat(raw); if (n > 0) return n; }
    }
    return null;
}

function debugSTGlobals() {
    const keys = [
        "SillyTavern",
        "SillyTavern?.context",
        "SillyTavern?.getContext",
        "chat",
        "characters",
        "chat_metadata",
        "groupChat",
    ];

    console.log("[Dangan][DEBUG] Global probe:");
    keys.forEach(k => {
        try {
            const value = eval(`window.${k}`);
            console.log(`  ${k}:`, value);
        } catch {
            console.log(`  ${k}: ❌`);
        }
    });
}

function registerCharactersFromContext() {
    if (!window.SillyTavern?.getContext) {
        console.warn("[Dangan][Social] SillyTavern context missing");
        return;
    }

    const ctx = SillyTavern.getContext();
    if (!Array.isArray(ctx.chat)) return;

    console.log(
        `[Dangan][Social] Scanning context messages: ${ctx.chat.length}`
    );

    let registered = 0;

    ctx.chat.forEach(msg => {
        if (!msg) return;
if (msg.is_user) return;
if (msg.is_system) return;

const charName = msg.ch_name || msg.name;
if (!charName) return;
if (isIgnoredCharacter(charName)) return;

const key = normalizeName(charName);
        
        if (characters.has(key)) return;

        const character = {
            id: `char_${Date.now()}_${Math.random()}`,
name: charName,
ultimate: lookupUltimateFromLorebook(charName),
            trustLevel: 1,
            source: "context",
            notes: null,
        };

        characters.set(key, character);
        registered++;
        console.log("[Dangan][Social] Registered character:", msg.name);
    });

    if (registered > 0) saveCharacters();

    console.log(
        `[Dangan][Social] Registered ${registered} character(s)`
    );
}

function registerCharacterFromMessage(msgEl) {
    const chName = msgEl.getAttribute("ch_name");
    const isUser = msgEl.getAttribute("is_user") === "true";
    const isSystem = msgEl.getAttribute("is_system") === "true";

    if (!chName) return;
    if (isUser || isSystem) return;
    if (isIgnoredCharacter(chName)) return;

    const key = normalizeName(chName);
    if (characters.has(key)) return;

    const character = {
        id: `char_${Date.now()}_${Math.random()}`,
        name: chName,
        ultimate: lookupUltimateFromLorebook(chName),
        trustLevel: 1,
        source: "dom",
        notes: null,
        trustHistory: new Set()
    };

    characters.set(key, character);
    saveCharacters();

    console.log("[Dangan][Social] Registered character:", chName);
    socialPanelController?.renderSocialPanel();
}

function getActivePersonaName() {
    const fallback = "STUDENT";

    if (!window.SillyTavern?.getContext) return fallback;

    const ctx = window.SillyTavern.getContext();
    if (!ctx) return fallback;

    const direct = ctx.name1 || ctx.user_name || ctx.userName || ctx.personaName;
    if (typeof direct === "string" && direct.trim()) {
        return direct.trim();
    }

    const users = Array.isArray(ctx.characters) ? ctx.characters : [];
    const activeUser = users.find(ch => ch?.is_user || ch?.isUser);
    if (activeUser?.name) {
        return String(activeUser.name).trim() || fallback;
    }

    return fallback;
}

function getActiveUserAvatarUrl() {
    if (!user_avatar) return null;
    const ctx = window.SillyTavern?.getContext?.();
    if (ctx?.getThumbnailUrl) return ctx.getThumbnailUrl('persona', user_avatar);
    return `/thumbnail?type=persona&file=${encodeURIComponent(user_avatar)}`;
}

// Body-class flip driven by the Monopad → Display → HALF-SPRITE MODE toggle.
// CSS in style.css (body.dangan-halfsprite-mode) scales + clips ST's in-chat
// sprite to the upper body. Called on toggle and on boot.
function applyHalfSpriteMode() {
    const on = !!extension_settings[extensionName]?.halfspriteMode;
    document.body.classList.toggle("dangan-halfsprite-mode", on);
    // gcpPositionSlotsFlat sets --gcp-half-slot-height for the GCP stage —
    // re-run it so the toggle takes effect on the current chat without
    // needing a reload / chat switch.
    try { trialManager?.recomputeGcpFlatLayout?.(); } catch (_) {}
}

function applyImageVisibilitySettings() {
    document.body.classList.toggle("dangan-hide-truth-images", !!getMonopadSetting("hideTruthBulletImages"));
    document.body.classList.toggle("dangan-hide-gift-images", !!getMonopadSetting("hideGiftImages"));
    const hideBranding = !!getMonopadSetting("hideHopesPeakBranding");
    document.body.classList.toggle("dangan-hide-hopes-peak-branding", hideBranding);
    const btnImg = document.querySelector("#dangan_monopad_button img");
    if (btnImg) {
        btnImg.src = hideBranding
            ? `${extensionFolderPath}/assets/icons/smartphone.svg`
            : `${extensionFolderPath}/assets/images/ui/hopes-peak-crest.png`;
    }
    const brandingExtras = document.getElementById("dangan-branding-extras");
    if (brandingExtras) brandingExtras.style.display = hideBranding ? 'block' : 'none';
}

const ANNOUN_TYPES = ['DAY_ANNOUN', 'NIGHT_ANNOUN', 'BDA'];
const ANNOUN_FIELDS = ['image', 'voice', 'text'];

function getLecternUrl() {
    const mode = getMonopadSetting('customLecternMode');
    const data = getMonopadSetting('customLecternData');
    if (mode === 'custom' && data) return data;
    const base = extensionFolderPath || `scripts/extensions/third-party/${extensionName}`;
    return `${base}/assets/classtrial/lectern.webp`;
}

function applyAnnouncementCustomisationUI() {
    const brandingExtras = document.getElementById("dangan-branding-extras");
    if (brandingExtras) {
        const hideBranding = !!getMonopadSetting('hideHopesPeakBranding');
        brandingExtras.style.display = hideBranding ? 'block' : 'none';
    }
    const tab = extension_settings[extensionName] ?? {};
    for (const type of ANNOUN_TYPES) {
        for (const field of ANNOUN_FIELDS) {
            const mode = tab[`announcementMode_${field}_${type}`] ?? 'default';
            // Mode buttons active state
            document.querySelectorAll(`[data-announ-type="${type}"][data-announ-field="${field}"]`).forEach(btn => {
                btn.classList.toggle('active', btn.dataset.announValue === mode);
            });
            // Custom row visibility
            const row = document.getElementById(`dangan-announ-row-${field}-${type}`);
            if (row) row.classList.toggle('is-hidden', mode !== 'custom');
            // File name label
            if (field !== 'text') {
                const nameEl = document.getElementById(`dangan-file-name-${field}-${type}`);
                if (nameEl) {
                    const data = tab[`announcementData_${field}_${type}`];
                    nameEl.textContent = data ? 'Custom file loaded' : 'No file chosen';
                }
            }
            // Text area value
            if (field === 'text') {
                const ta = document.getElementById(`dangan-text-${type}`);
                if (ta) ta.value = tab[`announcementData_text_${type}`] ?? '';
            }
        }
    }
}

function applyLecternUI() {
    const mode = getMonopadSetting('customLecternMode') ?? 'default';
    document.querySelectorAll('[data-lectern-value]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lecternValue === mode);
    });
    const row = document.getElementById('dangan-lectern-custom-row');
    if (row) row.classList.toggle('is-hidden', mode !== 'custom');
    const nameEl = document.getElementById('dangan-lectern-file-name');
    if (nameEl) {
        nameEl.textContent = getMonopadSetting('customLecternData') ? 'Custom file loaded' : 'No file chosen';
    }
}

// Sync the voting-wheel face / monocoin custom-image pickers (under Hide
// Hope's Peak Branding) to their stored mode + uploaded file.
function applyVoteAssetUI(modeKey, dataKey, valueAttr, rowId, nameId) {
    const mode = getMonopadSetting(modeKey) ?? 'default';
    document.querySelectorAll(`[${valueAttr}]`).forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute(valueAttr) === mode);
    });
    const row = document.getElementById(rowId);
    if (row) row.classList.toggle('is-hidden', mode !== 'custom');
    const nameEl = document.getElementById(nameId);
    if (nameEl) {
        nameEl.textContent = getMonopadSetting(dataKey) ? 'Custom file loaded' : 'No file chosen';
    }
}

function applyVoteFaceUI() {
    applyVoteAssetUI('customVoteFaceMode', 'customVoteFaceData', 'data-voteface-value',
        'dangan-voteface-custom-row', 'dangan-voteface-file-name');
}

function applyVoteCoinUI() {
    applyVoteAssetUI('customCoinMode', 'customCoinData', 'data-votecoin-value',
        'dangan-votecoin-custom-row', 'dangan-votecoin-file-name');
}

// Read the configured custom Game Master name, or null when default Monokuma
// mode is selected / no character chosen. Centralised so callers (sprite
// resolver, isMonokuma) don't duplicate the mode + name checks.
function getCustomGameMasterName() {
    if (getMonopadSetting('gameMasterMode') !== 'custom') return null;
    const name = getMonopadSetting('gameMasterCharacter');
    return (typeof name === 'string' && name.trim()) ? name.trim() : null;
}

// Resolve the display names of the characters in the active group chat. Used
// to scope rosters (e.g. Voting Time) to the current Class Trial group rather
// than the whole persistent `characters` map, which can carry over characters
// from other chats/chapters. Returns [] when not in a group chat, so callers
// can fall back to their full roster instead of over-filtering single-char chats.
function getActiveGroupMemberNames() {
    const ctx = window.SillyTavern?.getContext?.();
    if (!ctx?.groupId) return [];
    const group = (Array.isArray(ctx.groups) ? ctx.groups : []).find(g => String(g.id) === String(ctx.groupId));
    if (!group?.members?.length || !Array.isArray(ctx.characters)) return [];
    return group.members
        .map(avatar => ctx.characters.find(c => c?.avatar === avatar)?.name)
        .filter(Boolean);
}

// Build the roster for Voting Time: the members of the current group chat,
// plus the active persona. Scoping to group membership keeps stray characters
// (carried over in the persistent `characters` map from prior chats/chapters)
// off the voting screen and results wheel.
function getVotingRosterCharacters() {
    const memberKeys = new Set(getActiveGroupMemberNames().map(n => normalizeName(n)));
    const chars = [...characters.values()].filter(c => {
        // Not in a group chat → keep the full roster rather than over-filter.
        if (memberKeys.size && !memberKeys.has(normalizeName(c.name))) return false;
        return true;
    });
    const playerName = getActivePersonaName();
    if (playerName && playerName !== 'STUDENT') {
        chars.push({ name: playerName, isPlayer: true, dead: false, missing: false });
    }
    return chars;
}

// ── Character introduction tracking ─────────────────────────────────────────
// Until /introduce is run on a character their name renders as "???" in any
// dangan-extension UI (overworld sprite hover, minimap pin tooltip, trial
// speaker sticker, …). The set persists in extension_settings so the player
// only has to introduce each character once per profile.
const UNINTRODUCED_DISPLAY_NAME = '???';

function getIntroducedCharactersStore() {
    const root = extension_settings[extensionName] ??= {};
    root.introducedCharacters ??= {};
    return root.introducedCharacters;
}

// Speakers that never need /introduce — these are system / framing voices
// rather than actual characters in the killing game, so masking them as
// "???" would be confusing rather than mysterious.
const ALWAYS_INTRODUCED_KEYS = new Set(['narrator', 'assistant']);

function isCharacterIntroduced(name) {
    const key = normalizeName(name);
    if (!key) return false;
    // The player always knows themselves; treat the active persona and the
    // Game Master (Monokuma or the custom override) as pre-introduced so the
    // ??? mask never hides them.
    const personaKey = normalizeName(getActivePersonaName?.() || '');
    if (personaKey && key === personaKey) return true;
    const gm = getCustomGameMasterName();
    if (gm && key === normalizeName(gm)) return true;
    if (key === 'monokuma') return true;
    if (ALWAYS_INTRODUCED_KEYS.has(key)) return true;
    return Boolean(getIntroducedCharactersStore()[key]);
}

function markCharacterIntroduced(name) {
    const key = normalizeName(name);
    if (!key) return;
    const store = getIntroducedCharactersStore();
    if (store[key]) return;
    store[key] = true;
    saveSettingsDebounced();
}

// Returns the name to show in UI labels: the original when introduced, or
// "???" otherwise. Used by overworld + minimap + trial sticker rendering.
function getCharacterDisplayName(name) {
    if (!name) return name;
    return isCharacterIntroduced(name) ? name : UNINTRODUCED_DISPLAY_NAME;
}

function applyGameMasterUI() {
    const mode = getMonopadSetting('gameMasterMode') ?? 'default';
    document.querySelectorAll('[data-gm-value]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.gmValue === mode);
    });
    const row = document.getElementById('dangan-gm-custom-row');
    if (row) row.classList.toggle('is-hidden', mode !== 'custom');

    const select = document.getElementById('dangan-gm-character');
    if (!select) return;

    // Pull the SillyTavern character roster. Skip user/persona entries and
    // any character literally called "Monokuma" — the default option already
    // covers that case.
    const ctx = window.SillyTavern?.getContext?.();
    const chars = Array.isArray(ctx?.characters) ? ctx.characters : [];
    const saved = String(getMonopadSetting('gameMasterCharacter') || '').trim();
    const names = chars
        .filter(c => c && !c.is_user && !c.isUser)
        .map(c => String(c.name || '').trim())
        .filter(n => n && n.toLowerCase() !== 'monokuma');
    // Dedup + sort alphabetically for predictability.
    const uniq = [...new Set(names)].sort((a, b) => a.localeCompare(b));

    // If the saved selection points to a character that no longer exists, keep
    // it in the list so the user can see what was chosen and re-pick.
    if (saved && !uniq.includes(saved)) uniq.unshift(saved);

    select.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = uniq.length ? '— Select a character —' : 'No characters found';
    placeholder.disabled = uniq.length > 0;
    select.appendChild(placeholder);
    for (const n of uniq) {
        const opt = document.createElement('option');
        opt.value = n;
        opt.textContent = n;
        select.appendChild(opt);
    }
    select.value = saved || '';
}

function applyDynamicTheme() {
    const body = document.body;
    body.classList.remove("dangan-theme-daily", "dangan-theme-night", "dangan-theme-investigation", "dangan-theme-damaged");

    if (!getMonopadSetting("dynamicThemes")) return;

    if (investigationUnderway) {
        body.classList.add("dangan-theme-investigation");
    } else if (ensureTimeTrackerState().phase === TIME_PHASE_NIGHT) {
        body.classList.add("dangan-theme-night");
    } else {
        body.classList.add("dangan-theme-daily");
    }
}

function setActiveMonopadTab(tab) {
    if (!tab) return;

    $(".monopad-icon").removeClass("active");
    $(`.monopad-icon[data-tab="${tab}"]`).addClass("active");

    $(".monopad-panel-content").removeClass("active");
    $(`.monopad-panel-content[data-panel="${tab}"]`).addClass("active");
}

function setMapToHopesPeakFloorOneForLesson() {
    const areaButton = document.querySelector('.map-area-button[data-area="hopes_peak"]');
    areaButton?.click();

    const floorButton = document.querySelector('.map-floor-button[data-floor="floor_1"]');
    floorButton?.click();
}

function removeLessonSpriteMotionClasses(overlayEl) {
    if (!overlayEl) return;
    overlayEl.classList.remove("sprite-hidden", "sprite-throw", "sprite-shake", "sprite-bounce");
}

async function fadeOutAudio(audioEl, durationMs = 520) {
    if (!audioEl || audioEl.paused) return;

    const originalVolume = Number.isFinite(audioEl.volume) ? audioEl.volume : 1;
    const steps = 8;
    const stepDelay = Math.max(30, Math.round(durationMs / steps));

    for (let i = steps - 1; i >= 0; i -= 1) {
        audioEl.volume = Math.max(0, (originalVolume * i) / steps);
        await new Promise(resolve => setTimeout(resolve, stepDelay));
    }

    audioEl.pause();
    audioEl.currentTime = 0;
    audioEl.volume = originalVolume;
}


function _getActiveBgmElement() {
    // Direct investigation track takes priority
    if (investigationTrackAudio && !investigationTrackAudio.paused) return investigationTrackAudio;
    // Fall back to Dynamic Audio extension element
    const bgm = document.getElementById('audio_bgm');
    if (bgm instanceof HTMLAudioElement && !bgm.paused) return bgm;
    return null;
}

async function fadeOutAndPauseBgm(durationMs = 600) {
    const el = _getActiveBgmElement();
    if (!el) return false;

    const originalVolume = Number.isFinite(el.volume) ? el.volume : 1;
    const steps = 10;
    const stepDelay = Math.max(30, Math.round(durationMs / steps));

    for (let i = steps - 1; i >= 0; i--) {
        el.volume = Math.max(0, (originalVolume * i) / steps);
        await new Promise(resolve => setTimeout(resolve, stepDelay));
    }

    el.pause();
    el.volume = originalVolume;
    return true;
}

async function fadeInAndResumeBgm(durationMs = 600) {
    // Resume whichever element we paused — prefer investigationTrackAudio if it exists
    const el = investigationTrackAudio ?? document.getElementById('audio_bgm');
    if (!el || !el.paused) return;

    const targetVolume = Number.isFinite(el.volume) ? el.volume : 1;
    el.volume = 0;
    el.play().catch(() => {});

    const steps = 10;
    const stepDelay = Math.max(30, Math.round(durationMs / steps));

    for (let i = 1; i <= steps; i++) {
        el.volume = Math.min(targetVolume, (targetVolume * i) / steps);
        await new Promise(resolve => setTimeout(resolve, stepDelay));
    }
}

let _hgPreviousBgmSelectVal      = null;
let _hgPreviousInvestigationAudio = null; // investigationTrackAudio saved across scrum/HG BGM switch

function playMindMineBgm() {
    const $sel = $('#audio_bgm_select');
    if (!$sel.length) return;
    _hgPreviousBgmSelectVal = _hgPreviousBgmSelectVal ?? $sel.val();
    const track = findBgmTrackByName('DX Growth Plan');
    const path  = track ?? `${(extensionFolderPath || '').replace(/\\/g, '/')}/assets/bgm/DX Growth Plan.mp3`;
    if (!$sel.find(`option[value="${path}"]`).length) {
        $sel.append(new Option('DX Growth Plan', path));
    }
    $sel.val(path).trigger('change');
    const audioEl = document.getElementById('audio_bgm');
    if (audioEl) audioEl.loop = true;
}

function playHGBgm() {
    const $sel = $('#audio_bgm_select');
    if (!$sel.length) return null;
    _hgPreviousBgmSelectVal = $sel.val();
    const path = "assets/bgm/Hangman's Gambit.mp3";
    if (!$sel.find(`option[value="${path}"]`).length) {
        $sel.append(new Option("Hangman's Gambit", path));
    }
    $sel.val(path).trigger('change');
    const audioEl = document.getElementById('audio_bgm');
    if (audioEl) audioEl.loop = true;
    return audioEl;
}

function showHangmanLoadingState() {
    return showMinigameLoadingState("Loading Hangman's Gambit", { command: '/hangmansgambit' });
}

function showMinigameLoadingState(label = 'Loading', { command = null } = {}) {
    // Fullscreen overlay shown while the LLM is generating content for a
    // minigame. Fades in on mount and exposes hide() + setProgress(pct).
    // setProgress is optional — callers with a single-shot generation
    // (like Hangman's Gambit, one generateRaw call) can omit it and just
    // get the indeterminate three-dot pulse. `command` adds a gray hint
    // pointing the user at the slash-command alternative.
    document.getElementById('hg-loading-state')?.remove();
    const el = document.createElement('div');
    el.id = 'hg-loading-state';
    const safeLabel   = String(label).replace(/[<>&]/g, '');
    const safeCommand = command ? String(command).replace(/[<>&"']/g, '') : '';
    const hintHtml = safeCommand
        ? `<div class="hg-loading-hint">Taking too long to load? You can create your own using <span class="hg-loading-cmd">${safeCommand}</span></div>`
        : '';
    el.innerHTML = `
        <div class="hg-loading-text">${safeLabel}</div>
        ${hintHtml}
        <div class="hg-loading-dots"><span></span><span></span><span></span></div>
        <div class="hg-loading-progress" style="display:none">0%</div>
    `;
    // Loading-screen highlight colour follows the active trial theme via
    // --dgn-neon-rgb (set on body.dangan-trial-active.dangan-trial-theme-*).
    // Outside a trial the fallback keeps the original green so the loader
    // still reads as a "system is working" indicator.
    el.style.cssText = `
        position: fixed; inset: 0;
        z-index: 2147483647;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        gap: 22px;
        background: rgba(0, 6, 24, 0.92);
        color: rgb(var(--dgn-neon-rgb, 68, 255, 136));
        font-family: "Orbitron", "Impact", monospace;
        font-size: 18px; letter-spacing: 3px; text-transform: uppercase;
        text-shadow: 0 0 10px rgba(var(--dgn-neon-rgb, 80, 255, 130), 0.7);
        pointer-events: auto;
        opacity: 0;
        transition: opacity 320ms ease;
    `;
    const dotsCss = `
        #hg-loading-state .hg-loading-dots {
            display: inline-flex;
            align-items: center;
            gap: 14px;
        }
        #hg-loading-state .hg-loading-dots > span {
            display: block;
            width: 16px; height: 16px;
            border-radius: 50%;
            background: rgb(var(--dgn-neon-rgb, 68, 255, 136));
            box-shadow: 0 0 14px rgba(var(--dgn-neon-rgb, 80, 255, 130), 0.85),
                        0 0 26px rgba(var(--dgn-neon-rgb, 40, 220, 80), 0.5);
            opacity: 0.3;
            animation: hgLoadingDotPulse 0.9s ease-in-out infinite;
        }
        #hg-loading-state .hg-loading-dots > span:nth-child(2) { animation-delay: 0.15s; }
        #hg-loading-state .hg-loading-dots > span:nth-child(3) { animation-delay: 0.30s; }
        @keyframes hgLoadingDotPulse {
            0%, 100% { opacity: 0.25; transform: scale(1); }
            50%      { opacity: 1;    transform: scale(1.25); }
        }
        #hg-loading-state .hg-loading-progress {
            font-family: "Orbitron", "Impact", monospace;
            font-size: 28px;
            font-weight: 700;
            letter-spacing: 4px;
            color: rgb(var(--dgn-neon-rgb, 68, 255, 136));
            text-shadow: 0 0 10px rgba(var(--dgn-neon-rgb, 80, 255, 130), 0.7),
                         0 0 22px rgba(var(--dgn-neon-rgb, 40, 220, 80), 0.45);
            font-variant-numeric: tabular-nums;
            min-width: 110px;
            text-align: center;
        }
        #hg-loading-state .hg-loading-hint {
            margin-top: -8px;
            font-family: "Noto Sans", "Inter", sans-serif;
            font-size: 13px;
            font-weight: 400;
            letter-spacing: 1px;
            text-transform: none;
            color: rgba(190, 200, 210, 0.65);
            text-shadow: none;
            text-align: center;
            max-width: 520px;
            line-height: 1.5;
        }
        #hg-loading-state .hg-loading-hint .hg-loading-cmd {
            color: rgba(220, 230, 240, 0.85);
            font-family: "Orbitron", "Inter", monospace;
            font-weight: 600;
        }
    `;
    let styleEl = document.getElementById('hg-loading-state-style');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'hg-loading-state-style';
        styleEl.textContent = dotsCss;
        document.head.appendChild(styleEl);
    }
    document.body.appendChild(el);
    // Two-frame nudge so the initial opacity:0 commits before the transition.
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.opacity = '1'; }));

    el.hide = () => {
        el.style.opacity = '0';
        window.setTimeout(() => el.remove(), 340);
    };
    // Callers with a known total can show a numeric percentage by calling
    // setProgress(0..1). The dots stay visible above the percentage so the
    // animation continues while the number ticks up.
    el.setProgress = (frac) => {
        const pct = Math.max(0, Math.min(100, Math.round(Number(frac) * 100)));
        const progEl = el.querySelector('.hg-loading-progress');
        if (progEl) {
            progEl.style.display = '';
            progEl.textContent = `${pct}%`;
        }
    };
    return el;
}

// Fullscreen error overlay shown when a minigame's LLM generation fails
// outright (parse errors after all retries, missing context, etc.).  Same
// chrome as showMinigameLoadingState but red rather than green, no
// spinner, and click-to-dismiss.  The returned element exposes hide()
// and resolves a promise via onDismissed for callers that want to await
// the user before continuing (e.g. abort the minigame entirely).
function showMinigameErrorState({ title = 'Generation failed', subtitle = '', command = null } = {}) {
    document.getElementById('hg-loading-state')?.remove();
    document.getElementById('hg-error-state')?.remove();
    const el = document.createElement('div');
    el.id = 'hg-error-state';
    const safeTitle    = String(title).replace(/[<>&]/g, '');
    const safeSubtitle = String(subtitle).replace(/[<>&]/g, '');
    const safeCommand  = command ? String(command).replace(/[<>&"']/g, '') : '';
    const subtitleHtml = safeSubtitle
        ? `<div class="hg-error-sub">${safeSubtitle}${safeCommand ? ` <span class="hg-error-cmd">${safeCommand}</span>` : ''}</div>`
        : '';
    el.innerHTML = `
        <div class="hg-error-text">${safeTitle}</div>
        ${subtitleHtml}
        <div class="hg-error-dismiss">Click anywhere to dismiss</div>
    `;
    el.style.cssText = `
        position: fixed; inset: 0;
        z-index: 2147483647;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        gap: 22px;
        background: rgba(24, 0, 6, 0.94);
        color: #ff4d4d;
        font-family: "Orbitron", "Impact", monospace;
        font-size: 22px; letter-spacing: 3px; text-transform: uppercase;
        text-shadow: 0 0 10px rgba(255, 80, 80, 0.7);
        pointer-events: auto;
        opacity: 0;
        transition: opacity 320ms ease;
        cursor: pointer;
    `;
    const css = `
        #hg-error-state .hg-error-text {
            font-weight: 700;
            font-size: 26px;
            letter-spacing: 4px;
        }
        #hg-error-state .hg-error-sub {
            font-family: "Noto Sans", "Inter", sans-serif;
            font-size: 14px;
            font-weight: 400;
            letter-spacing: 1px;
            text-transform: none;
            color: rgba(220, 200, 200, 0.85);
            text-shadow: none;
            text-align: center;
            max-width: 560px;
            line-height: 1.5;
        }
        #hg-error-state .hg-error-sub .hg-error-cmd {
            color: rgba(255, 230, 230, 0.95);
            font-family: "Orbitron", "Inter", monospace;
            font-weight: 600;
        }
        #hg-error-state .hg-error-dismiss {
            margin-top: 8px;
            font-family: "Noto Sans", "Inter", sans-serif;
            font-size: 11px;
            letter-spacing: 2px;
            text-transform: uppercase;
            color: rgba(255, 180, 180, 0.55);
            text-shadow: none;
        }
    `;
    let styleEl = document.getElementById('hg-error-state-style');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'hg-error-state-style';
        styleEl.textContent = css;
        document.head.appendChild(styleEl);
    }
    document.body.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.opacity = '1'; }));

    let dismissed = false;
    const dismissPromise = new Promise(resolve => {
        el.hide = () => {
            if (dismissed) return;
            dismissed = true;
            el.style.opacity = '0';
            window.setTimeout(() => { el.remove(); resolve(); }, 340);
        };
        el.addEventListener('click', () => el.hide());
    });
    el.onDismissed = () => dismissPromise;
    return el;
}

function playBgmForScrum(path) {
    const $sel = $('#audio_bgm_select');
    if (!$sel.length) return;
    // Only save the pre-scrum state the first time — subsequent switches (e.g. Final Push)
    // must not overwrite it, or teardown will restore the wrong track/audio element.
    if (!_hgPreviousBgmSelectVal) {
        _hgPreviousBgmSelectVal = $sel.val();
        // Detach investigationTrackAudio so the visualizer falls back to #audio_bgm while
        // the scrum BGM (played via DA on #audio_bgm) is active.  It is restored on teardown.
        _hgPreviousInvestigationAudio = investigationTrackAudio;
        investigationTrackAudio = null;
    }
    if (!$sel.find(`option[value="${CSS.escape ? path : path}"]`).length) {
        $sel.append(new Option(path.split('/').pop().replace(/\.[^.]+$/, ''), path));
    }
    $sel.val(path).trigger('change');
    const audioEl = document.getElementById('audio_bgm');
    if (audioEl) audioEl.loop = true;
}

// Find a track in ST's audio_bgm_select by display name (case-insensitive substring match).
// Returns the option value (file path) if found, otherwise null.
function findBgmTrackByName(name) {
    const $sel = $('#audio_bgm_select');
    if (!$sel.length) return null;
    const lower = name.toLowerCase();
    let found = null;
    $sel.find('option').each(function () {
        if ($(this).text().toLowerCase().includes(lower)) {
            found = $(this).val();
            return false; // break
        }
    });
    return found;
}

function resumeBgmAfterHG() {
    const $sel = $('#audio_bgm_select');
    if (!$sel.length || !_hgPreviousBgmSelectVal) {
        _hgPreviousBgmSelectVal          = null;
        _hgPreviousInvestigationAudio    = null;
        return;
    }
    const savedVal      = _hgPreviousBgmSelectVal;
    const savedInvAudio = _hgPreviousInvestigationAudio;
    _hgPreviousBgmSelectVal          = null;
    _hgPreviousInvestigationAudio    = null;

    const audioEl = document.getElementById('audio_bgm');
    if (audioEl) audioEl.loop = false;

    if (savedInvAudio) {
        // Restore our own audio element — the visualizer watches this, so resuming it
        // immediately makes the play/pause button reflect the correct playing state.
        investigationTrackAudio = savedInvAudio;
        investigationTrackAudio.play().catch(() => {});
        // Seed DA's select so its worker doesn't clobber our track on the next poll.
        $sel.val(savedVal).trigger('change');
        // Silence #audio_bgm — investigationTrackAudio is the real source.
        setTimeout(() => {
            const daEl = document.getElementById('audio_bgm');
            if (daEl instanceof HTMLAudioElement) daEl.pause();
        }, 400);
    } else {
        // No investigationTrackAudio was active before the scrum — restore via DA only.
        $sel.val(savedVal).trigger('change');
    }
}

async function onMindMineWin(sentence) {
    const raw = (sentence || '').trim();
    // Lead with "that" + lowercase first letter of the chosen sentence so the
    // sentence flows as one continuous clause: "…is that the suspect…"
    const text = raw ? raw.charAt(0).toLowerCase() + raw.slice(1) : '';

    const ctx = window.SillyTavern?.getContext?.();
    const setPrompt = ctx?.setExtensionPrompt || window.setExtensionPrompt;
    if (typeof setPrompt === 'function' && text) {
        setPrompt('dangan_mindmine_result',
            `[MIND MINE RESULT]\nA point of relevance is that ${text}...`,
            0, 1, true, 'system');
    }

    // Wait for the minigame overlay to finish closing (endGame 2 s delay + CSS fade)
    await new Promise(r => setTimeout(r, 2500));

    const notif = document.createElement('div');
    notif.id = 'dangan-mindmine-win-notif';
    notif.className = 'dangan-trial-notification rebuttal-active';
    notif.innerHTML = `
        <div class="dangan-trial-notif-content">
            <div class="rebuttal-header">MIND MINE COMPLETE</div>
            <div class="rebuttal-info">
                A point of relevance is that <em id="dangan-mindmine-win-theory"></em>...
            </div>
        </div>`;
    document.body.appendChild(notif);
    if (text) notif.querySelector('#dangan-mindmine-win-theory').textContent = text;

    const onUserSend = () => {
        notif.remove();
        eventSource.removeListener(event_types.MESSAGE_SENT, onUserSend);
    };
    eventSource.on(event_types.MESSAGE_SENT, onUserSend);

    const onAiResponded = () => {
        const ctx2 = window.SillyTavern?.getContext?.();
        const sp = ctx2?.setExtensionPrompt || window.setExtensionPrompt;
        if (typeof sp === 'function') sp('dangan_mindmine_result', '', 0, 0, false, 'system');
        eventSource.removeListener(event_types.CHARACTER_MESSAGE_RENDERED, onAiResponded);
    };
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, onAiResponded);
}

async function onScrumDebateWin(playerTheory) {
    const theory = (playerTheory || '').trim();

    // Inject the prompt immediately so it's ready when generation fires
    const ctx = window.SillyTavern?.getContext?.();
    const setPrompt = ctx?.setExtensionPrompt || window.setExtensionPrompt;
    if (typeof setPrompt === 'function') {
        const prompt = theory
            ? `[SCRUM DEBATE RESULT]\nProving without a shadow of a doubt that ${theory}`
            : `[SCRUM DEBATE RESULT]\nThe player's team has proven their argument beyond any doubt.`;
        setPrompt('dangan_scrum_result', prompt, 0, 1, true, 'system');
    }

    // Wait for the scrum overlay to fully close (750 ms teardown delay + 310 ms CSS fade)
    await new Promise(r => setTimeout(r, 1200));

    // Show the rebuttal-style notification
    const notif = document.createElement('div');
    notif.id = 'dangan-scrum-win-notif';
    notif.className = 'dangan-trial-notification rebuttal-active';
    notif.innerHTML = `
        <div class="dangan-trial-notif-content">
            <div class="rebuttal-header">SCRUM DEBATE VICTORY</div>
            <div class="rebuttal-info">
                Proving without a shadow of a doubt that <em id="dangan-scrum-win-theory"></em>
            </div>
        </div>`;
    document.body.appendChild(notif);
    if (theory) notif.querySelector('#dangan-scrum-win-theory').textContent = theory;

    // Do NOT trigger AI generation here — wait for the user to send their own message.
    // The extension prompt is already set; it will be included in whatever the AI generates
    // in response to the user's next message.

    // Dismiss the notification when the user sends their next message.
    const onUserSend = () => {
        notif.remove();
        eventSource.removeListener(event_types.MESSAGE_SENT, onUserSend);
    };
    eventSource.on(event_types.MESSAGE_SENT, onUserSend);

    // Clear the extension prompt once the AI has responded to that message.
    const onAiResponded = () => {
        const ctx2 = window.SillyTavern?.getContext?.();
        const sp = ctx2?.setExtensionPrompt || window.setExtensionPrompt;
        if (typeof sp === 'function') sp('dangan_scrum_result', '', 0, 0, false, 'system');
        eventSource.removeListener(event_types.CHARACTER_MESSAGE_RENDERED, onAiResponded);
    };
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, onAiResponded);
}

async function runMonokumaLessonStep(step, state) {
    if (!step || !state?.overlayEl) return;

    const {
        overlayEl,
        titleEl,
        textEl,
        spriteEl,
        unlockAdvance,
        lockAdvance,
    } = state;

    removeLessonSpriteMotionClasses(overlayEl);

    if (step.board) {
        overlayEl.classList.add("board");
        titleEl.textContent = step.chalkTitle || MONOKUMA_LESSON_TITLE;
    } else {
        overlayEl.classList.remove("board");
        titleEl.textContent = "";
    }

    if (step.action === "dropAndSwitchToTruth" || step.action === "dropAndSwitchToSocial" || step.action === "dropAndSwitchToSkills") {
        lockAdvance();
        overlayEl.classList.add("sprite-hidden");
        await new Promise(resolve => setTimeout(resolve, 260));
        if (step.tab) setActiveMonopadTab(step.tab);
        await new Promise(resolve => setTimeout(resolve, 130));
        removeLessonSpriteMotionClasses(overlayEl);
        await new Promise(resolve => setTimeout(resolve, 110));
        unlockAdvance();
    } else if (step.action === "throwAndSwitchToMap") {
        lockAdvance();
        overlayEl.classList.add("sprite-throw");
        await new Promise(resolve => setTimeout(resolve, 330));
        removeLessonSpriteMotionClasses(overlayEl);
        if (step.tab) setActiveMonopadTab(step.tab);
        spriteEl.style.opacity = "0";
        await new Promise(resolve => setTimeout(resolve, 120));
        spriteEl.style.opacity = "1";
        unlockAdvance();
    } else if (step.tab) {
        setActiveMonopadTab(step.tab);
    }

    if (step.sprite) {
        spriteEl.src = `${extensionFolderPath}/assets/monokuma/${step.sprite}`;
    }

    spriteEl.style.opacity = String(
        Number.isFinite(Number(step.spriteOpacity))
            ? Math.max(0, Math.min(1, Number(step.spriteOpacity)))
            : 1
    );

    if (step.action === "spawnTruthBullet") {
        handleTruthBullet("Important Thing!", "Will this show us whodunnit?", { grantMonocoins: false, grantXp: false, image: `${extensionFolderPath}/assets/images/ui/monokuma_kotodama.png` });
        window.renderTruthBullets?.();
    }

    if (step.action === "autoReadAndDeleteTruthBullet") {
        lockAdvance();

        const truthItem = Array.from(document.querySelectorAll(".truth-item"))
            .find(el => (el.textContent || "").toLowerCase().includes("important thing"));

        truthItem?.click();
        state.pendingTruthBulletCleanup = true;
        unlockAdvance();
    }

    if (step.action === "switchMapToHopesPeakFloor1") {
        setMapToHopesPeakFloorOneForLesson();
    }

    if (step.action === "boardReturnBounce") {
        lockAdvance();
        overlayEl.classList.remove("sprite-hidden");
        overlayEl.classList.add("sprite-bounce");
        await new Promise(resolve => setTimeout(resolve, 680));
        overlayEl.classList.remove("sprite-bounce");
        unlockAdvance();
    }

    textEl.textContent = step.text || "";
}

async function endMonokumaLesson({ completed = false } = {}) {
    const state = monokumaLessonState;
    if (!state || state.ended) return;
    state.ended = true;

    state.overlayEl.classList.remove("active", "board", "sprite-hidden", "sprite-throw", "sprite-shake", "sprite-bounce");
    state.overlayEl.setAttribute("aria-hidden", "true");
    state.overlayEl.onclick = null;

    setActiveMonopadTab("settings");

    if (completed) {
        const settings = extension_settings[extensionName] ||= {};
        if (!settings.monokumaLessonRewardClaimed) {
            awardMonocoins(Number(MONOCOIN_REWARDS.tutorialCompletion || 0), "Mr. Monokuma's Lesson completion");
            settings.monokumaLessonRewardClaimed = true;
            saveSettingsDebounced();
        }
    }

    await fadeOutAudio(state.trackEl, 650);

    monokumaLessonState = null;
}

async function startMonokumaLesson() {
    if (monokumaLessonState?.active) return;

    const confirmed = await openMonopadConfirmDialog({
        title: "START LESSON",
        message: "Start Mr. Monokuma's Lesson? This guided tutorial will take over the Monopad until it finishes.",
        confirmLabel: "START",
        cancelLabel: "CANCEL",
    });
    if (!confirmed) return;

    const overlayEl = document.getElementById("monokuma-lesson-overlay");
    const titleEl = document.getElementById("monokuma-lesson-title");
    const textEl = document.getElementById("monokuma-lesson-text");
    const spriteEl = document.getElementById("monokuma-lesson-sprite");
    const trackEl = document.getElementById("monokuma_lesson_track");

    if (!overlayEl || !titleEl || !textEl || !spriteEl || !trackEl) return;

    overlayEl.classList.add("active", "board");
    overlayEl.setAttribute("aria-hidden", "false");
    titleEl.textContent = MONOKUMA_LESSON_TITLE;

    trackEl.loop = true;
    trackEl.volume = 0.5;
    trackEl.currentTime = 0;
    trackEl.play().catch(() => {});

    let canAdvance = true;

    monokumaLessonState = {
        active: true,
        ended: false,
        index: 0,
        overlayEl,
        titleEl,
        textEl,
        spriteEl,
        trackEl,
        pendingTruthBulletCleanup: false,
        lockAdvance: () => {
            canAdvance = false;
        },
        unlockAdvance: () => {
            canAdvance = true;
        },
    };

    const advance = async () => {
        const state = monokumaLessonState;
        if (!state || state.ended || !canAdvance) return;

        if (state.pendingTruthBulletCleanup) {
            const removeButton = document.querySelector(".truth-remove-button");
            removeButton?.click();
            state.pendingTruthBulletCleanup = false;
        }

        if (state.index >= MONOKUMA_LESSON_STEPS.length) {
            await endMonokumaLesson({ completed: true });
            return;
        }

        const step = MONOKUMA_LESSON_STEPS[state.index];
        state.index += 1;
        await runMonokumaLessonStep(step, state);
    };

    const onOverlayPointer = async () => {
        await advance();
    };

    overlayEl.onclick = onOverlayPointer;

    await advance();
}

function applyCrtSettings() {
    const panel = document.getElementById("dangan_monopad_panel");
    if (!panel) return;

    const enabled = !!getMonopadSetting("crtEffects");
    const intensityRaw = Number(getMonopadSetting("crtIntensity"));
    const intensity = Number.isFinite(intensityRaw) ? Math.max(0, Math.min(100, intensityRaw)) : 35;

    panel.classList.toggle("crt-disabled", !enabled);
    panel.style.setProperty("--dangan-crt-opacity", (intensity / 100).toFixed(2));
    panel.style.setProperty("--dangan-crt-strength", (intensity / 100).toFixed(2));
    panel.style.setProperty("--dangan-crt-rgb-shift", `${(intensity / 100 * 1.8).toFixed(2)}px`);

    $("#dangan_crt_value").text(`${intensity}%`);
}

function applySettingsTabUI() {
    const tab = extension_settings[extensionName];
    const activeDifficulty = applyRewardDifficultyProfile(tab.rewardDifficulty || defaultSettings.rewardDifficulty);
    tab.rewardDifficulty = activeDifficulty;

    $(".settings-toggle").each((_, el) => {
        const key = el.dataset.setting;
        if (!key) return;

        const isOn = !!tab[key];
        el.classList.toggle("on", isOn);
        el.setAttribute("aria-pressed", String(isOn));
    });

    const slider = document.getElementById("dangan_crt_slider");
    if (slider) {
        slider.value = String(Number(tab.crtIntensity) || 35);
    }

    const soundsSlider = document.getElementById("dangan_sounds_slider");
    if (soundsSlider) {
        const vol = Number(tab.monopadVolume ?? 50);
        soundsSlider.value = String(vol);
        const soundsValue = document.getElementById("dangan_sounds_value");
        if (soundsValue) soundsValue.textContent = `${vol}%`;
    }

    const announcementSlider = document.getElementById("dangan_announcement_slider");
    if (announcementSlider) {
        const vol = Number(tab.announcementVolume ?? 65);
        announcementSlider.value = String(vol);
        const announcementValue = document.getElementById("dangan_announcement_value");
        if (announcementValue) announcementValue.textContent = `${vol}%`;
    }

    const monomonoSlider = document.getElementById("dangan_monomono_slider");
    if (monomonoSlider) {
        const vol = Number(tab.monomonoBgmVolume ?? 40);
        monomonoSlider.value = String(vol);
        const monomonoValue = document.getElementById("dangan_monomono_value");
        if (monomonoValue) monomonoValue.textContent = `${vol}%`;
    }

    const lang = String(tab.monokumaLanguage ?? "EN");
    $(".settings-lang-btn[data-lang]").removeClass("active");
    $(`.settings-lang-btn[data-lang="${lang}"]`).addClass("active");

    renderAllBgmTrackTabs();

    const providerSelect = document.getElementById("dangan_generation_provider");
    if (providerSelect) {
        providerSelect.value = tab.generationProvider || defaultSettings.generationProvider;
    }

    const whiteNoiseSourceSelect = document.getElementById("dangan_white_noise_line_source");
    if (whiteNoiseSourceSelect) {
        whiteNoiseSourceSelect.value = tab.whiteNoiseLineSource || defaultSettings.whiteNoiseLineSource;
    }

    const nsdLineSourceSelect = document.getElementById("dangan_nsd_line_source");
    if (nsdLineSourceSelect) {
        nsdLineSourceSelect.value = tab.nsdLineSource || defaultSettings.nsdLineSource;
    }

    const mpdLineSourceSelect = document.getElementById("dangan_mpd_line_source");
    if (mpdLineSourceSelect) {
        mpdLineSourceSelect.value = tab.mpdLineSource || defaultSettings.mpdLineSource;
    }

    const qtimeRecentCheckbox = document.getElementById("dangan_qtime_use_recent_context");
    if (qtimeRecentCheckbox) {
        qtimeRecentCheckbox.checked = tab.questionTimeUseRecentContext ?? defaultSettings.questionTimeUseRecentContext;
    }

    const qtimeDebateCheckbox = document.getElementById("dangan_qtime_use_debate_history");
    if (qtimeDebateCheckbox) {
        qtimeDebateCheckbox.checked = tab.questionTimeUseDebateHistory ?? defaultSettings.questionTimeUseDebateHistory;
    }

    const qtruthRecentCheckbox = document.getElementById("dangan_qtruth_use_recent_context");
    if (qtruthRecentCheckbox) {
        qtruthRecentCheckbox.checked = tab.questionTruthUseRecentContext ?? defaultSettings.questionTruthUseRecentContext;
    }

    const qtruthDebateCheckbox = document.getElementById("dangan_qtruth_use_debate_history");
    if (qtruthDebateCheckbox) {
        qtruthDebateCheckbox.checked = tab.questionTruthUseDebateHistory ?? defaultSettings.questionTruthUseDebateHistory;
    }

    const hangmanRecentCheckbox = document.getElementById("dangan_hangman_use_recent_context");
    if (hangmanRecentCheckbox) {
        hangmanRecentCheckbox.checked = tab.hangmansGambitUseRecentContext ?? defaultSettings.hangmansGambitUseRecentContext;
    }

    const hangmanDebateCheckbox = document.getElementById("dangan_hangman_use_debate_history");
    if (hangmanDebateCheckbox) {
        hangmanDebateCheckbox.checked = tab.hangmansGambitUseDebateHistory ?? defaultSettings.hangmansGambitUseDebateHistory;
    }

    document.querySelectorAll(".settings-prompt-textarea").forEach((el) => {
        const settingKey = el.dataset.setting;
        const templateKey = el.dataset.templateKey;
        if (!settingKey || !templateKey) return;
        const fallbackTemplate = DEFAULT_TRIAL_PROMPT_TEMPLATES[templateKey] || "";
        const savedTemplate = typeof tab[settingKey] === "string" && tab[settingKey].length
            ? tab[settingKey]
            : fallbackTemplate;
        el.value = savedTemplate;
    });

    const rewardDifficultySelect = document.getElementById("dangan_reward_difficulty");
    if (rewardDifficultySelect) {
        rewardDifficultySelect.value = clampRewardDifficulty(tab.rewardDifficulty || defaultSettings.rewardDifficulty);
    }

    const rewardDifficultyNote = document.getElementById("dangan_reward_difficulty_note");
    if (rewardDifficultyNote) {
        const label = REWARD_DIFFICULTY_LABELS[activeDifficulty] || activeDifficulty.toUpperCase();
        rewardDifficultyNote.textContent = `Profile: ${label} · TB ${MONOCOIN_REWARDS.truthBullet} MC · Social +${MONOCOIN_REWARDS.socialRankUp} MC · Tutorial ${MONOCOIN_REWARDS.tutorialCompletion} MC`;
    }

    const modelInput = document.getElementById("dangan_openrouter_model");
    if (modelInput) {
        modelInput.value = tab.openrouterModel || defaultSettings.openrouterModel;
    }

    const keyInput = document.getElementById("dangan_openrouter_key");
    if (keyInput) {
        keyInput.value = getRuntimeOpenRouterApiKey() || "";
    }

    const rememberKeyCheckbox = document.getElementById("dangan_openrouter_remember_key");
    if (rememberKeyCheckbox) {
        rememberKeyCheckbox.checked = !!tab.openrouterRememberApiKey;
    }

    const keyStatusEl = document.getElementById("dangan_openrouter_key_status");
    if (keyStatusEl) {
        keyStatusEl.textContent = tab.openrouterRememberApiKey
            ? "Key persistence: saved in extension settings"
            : "Key persistence: session only";
    }

    const connectionStatusEl = document.getElementById("dangan_openrouter_connection_status");
    if (connectionStatusEl && !connectionStatusEl.dataset.locked) {
        connectionStatusEl.textContent = "";
    }

    const showOpenRouterControls =
        (providerSelect?.value || tab.generationProvider) === "openrouter" ||
        (whiteNoiseSourceSelect?.value || tab.whiteNoiseLineSource) === "openrouter" ||
        (nsdLineSourceSelect?.value || tab.nsdLineSource) === "openrouter" ||
        (mpdLineSourceSelect?.value || tab.mpdLineSource) === "openrouter";
    document.querySelectorAll(".settings-openrouter-only").forEach(el => {
        el.classList.toggle("is-hidden", !showOpenRouterControls);
    });

    applyCrtSettings();
    applyDynamicTheme();
    renderTimeTrackerUi();
    vnModeController?.setEnabled?.(!!tab.vnModeEnabled);
    applyAnnouncementCustomisationUI();
    applyLecternUI();
    applyVoteFaceUI();
    applyVoteCoinUI();
    applyGameMasterUI();
}

function saveCharacters() {
    const serialized = Array.from(characters.entries()).map(([key, char]) => {
        return [
            key,
            {
                ...char,
                trustHistory: Array.from(char.trustHistory || [])
            }
        ];
    });

    extension_settings[extensionName].characters = serialized;
    saveSettingsDebounced();
}

function loadCharacters() {
    const saved = extension_settings[extensionName].characters;
    if (!Array.isArray(saved)) return;

    characters.clear();

    saved.forEach(([key, value]) => {
        if (
            !value?.name ||
            value.name.length < 2 ||
            value.name === "..." ||
            value.name.toUpperCase().includes("API")
        ) {
            return; // 🚮 skip junk
        }

        // Drop anything that matches the current ignored-character rules —
        // catches stale entries like "SillyTavern System", "Assistant", etc.
        // that were registered before the filter was tightened.
        if (isIgnoredCharacter(value.name)) {
            return;
        }

        // 🔑 Restore trustHistory as a Set
        value.trustHistory = new Set(
    Array.isArray(value.trustHistory)
        ? value.trustHistory
        : []
);

        characters.set(key, value);
    });
}


let debugUiObserver = null;
const DEBUG_CONTROLS_COLLAPSE_STORAGE_KEY = "dangan-debug-controls-collapsed";
const DEBUG_CONTROLS_POSITION_STORAGE_KEY = "dangan-debug-controls-position";
const MONOPAD_BUTTON_POSITION_STORAGE_KEY = "dangan-monopad-button-position";

let breachTerminalLineTimer = null;
let breachTerminalBootTimer = null;
let breachAudio = null;
let breachUnlockedThisSession = false;
let payloadStreamTimer = null;

function readUiPosition(storageKey) {
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed.left !== "number" || typeof parsed.top !== "number") return null;
        return parsed;
    } catch {
        return null;
    }
}

function saveUiPosition(storageKey, left, top) {
    try {
        localStorage.setItem(storageKey, JSON.stringify({ left: Math.round(left), top: Math.round(top) }));
    } catch {
        // ignore storage failures and keep UI functional
    }
}

function clampUiPosition(element, left, top) {
    const rect = element.getBoundingClientRect();
    const width = rect.width || element.offsetWidth || 44;
    const height = rect.height || element.offsetHeight || 44;
    const margin = 6;

    const maxLeft = Math.max(margin, window.innerWidth - width - margin);
    const maxTop = Math.max(margin, window.innerHeight - height - margin);

    return {
        left: Math.min(Math.max(left, margin), maxLeft),
        top: Math.min(Math.max(top, margin), maxTop),
    };
}

function applyCustomUiPosition(element, storageKey) {
    if (!element) return false;

    const saved = readUiPosition(storageKey);
    if (!saved) return false;

    const { left, top } = clampUiPosition(element, saved.left, saved.top);
    element.style.setProperty("left", `${left}px`, "important");
    element.style.setProperty("top", `${top}px`, "important");
    element.style.setProperty("right", "auto", "important");
    element.style.setProperty("bottom", "auto", "important");
    element.dataset.customPosition = "true";

    return true;
}

function attachDraggablePositioning(element, { storageKey, handleSelector, suppressClickDataKey } = {}) {
    if (!element || element.dataset.dragPositioningInitialized === "true") return;
    element.dataset.dragPositioningInitialized = "true";
    element.style.setProperty("touch-action", "none");

    let dragging = false;
    let moved = false;
    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let originLeft = 0;
    let originTop = 0;

    element.addEventListener("pointerdown", event => {
        const handle = handleSelector ? event.target.closest(handleSelector) : element;
        if (!handle || (handleSelector && !element.contains(handle))) return;
        if (event.button !== 0) return;

        const rect = element.getBoundingClientRect();
        startX = event.clientX;
        startY = event.clientY;
        originLeft = rect.left;
        originTop = rect.top;
        pointerId = event.pointerId;
        dragging = true;
        moved = false;
    });

    element.addEventListener("pointermove", event => {
        if (!dragging || event.pointerId !== pointerId) return;

        const nextLeft = originLeft + (event.clientX - startX);
        const nextTop = originTop + (event.clientY - startY);
        const { left, top } = clampUiPosition(element, nextLeft, nextTop);

        if (Math.abs(event.clientX - startX) > 8 || Math.abs(event.clientY - startY) > 8) {
            if (!moved) {
                moved = true;
                element.setPointerCapture?.(pointerId);
            }
        }

        element.style.setProperty("left", `${left}px`, "important");
        element.style.setProperty("top", `${top}px`, "important");
        element.style.setProperty("right", "auto", "important");
        element.style.setProperty("bottom", "auto", "important");
        element.dataset.customPosition = "true";
    });

    const finishDrag = event => {
        if (!dragging || event.pointerId !== pointerId) return;

        element.releasePointerCapture?.(pointerId);
        dragging = false;

        if (moved) {
            const rect = element.getBoundingClientRect();
            const { left, top } = clampUiPosition(element, rect.left, rect.top);
            element.style.setProperty("left", `${left}px`, "important");
            element.style.setProperty("top", `${top}px`, "important");
            element.style.setProperty("right", "auto", "important");
            element.style.setProperty("bottom", "auto", "important");
            element.dataset.customPosition = "true";
            saveUiPosition(storageKey, left, top);

            if (suppressClickDataKey) {
                element.dataset[suppressClickDataKey] = String(Date.now() + 220);
            }
        }

        moved = false;
        pointerId = null;
    };

    element.addEventListener("pointerup", finishDrag);
    element.addEventListener("pointercancel", finishDrag);
}


function getDebugControlsCollapsed() {
    try {
        return localStorage.getItem(DEBUG_CONTROLS_COLLAPSE_STORAGE_KEY) !== "false";
    } catch {
        return true;
    }
}

function applyDebugControlsCollapsedState(controls, isCollapsed) {
    if (!controls) return;

    const toggle = controls.querySelector("#trust-debug-toggle");
    const panel = controls.querySelector(".trust-debug-buttons");

    controls.dataset.collapsed = isCollapsed ? "true" : "false";

    if (toggle) {
        toggle.textContent = isCollapsed ? "DEBUG ▸" : "DEBUG ▾";
        toggle.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
    }

    if (panel) {
        panel.style.setProperty("display", isCollapsed ? "none" : "flex", "important");
    }
}

function setDebugControlsCollapsed(isCollapsed) {
    try {
        localStorage.setItem(DEBUG_CONTROLS_COLLAPSE_STORAGE_KEY, isCollapsed ? "true" : "false");
    } catch {
        // ignore storage failures and keep UI functional
    }

    applyDebugControlsCollapsedState(document.getElementById("trust-debug-controls"), isCollapsed);
}

function ensureDebugControlsStyleTag() {
    if (document.getElementById("trust-debug-controls-inline-style")) return;

    const style = document.createElement("style");
    style.id = "trust-debug-controls-inline-style";
    style.textContent = `
#trust-debug-controls {
    position: fixed !important;
    right: 10px !important;
    left: auto !important;
    top: auto !important;
    z-index: 2147483000 !important;
    display: flex !important;
    pointer-events: auto !important;
}
#trust-debug-controls button {
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease !important;
}
#trust-debug-controls button:hover {
    background: rgba(173, 205, 255, 0.12) !important;
    border-color: rgba(173, 205, 255, 0.5) !important;
    color: #c8dfff !important;
}
@media (max-width: 700px) {
    #trust-debug-controls {
        left: max(10px, env(safe-area-inset-left, 0px)) !important;
        right: auto !important;
        top: calc(env(safe-area-inset-top, 0px) + 60px) !important;
        bottom: auto !important;
        flex-direction: column !important;
    }
}
`;

    document.head?.appendChild(style);
}

function startDebugUiObserver() {
    if (debugUiObserver) return;

    let _debugUiRaf = null;
    debugUiObserver = new MutationObserver(() => {
        if (_debugUiRaf) return;
        _debugUiRaf = requestAnimationFrame(() => {
            _debugUiRaf = null;
            const controls = document.getElementById("trust-debug-controls");
            const modal = document.getElementById("truth-debug-modal");

            if (!controls || controls.parentElement !== document.body || !modal || modal.parentElement !== document.body) {
                ensureGlobalDebugUi();
            }
        });
    });

    debugUiObserver.observe(document.body, {
        childList: true,
        subtree: true,
    });
}

function isDebugAccessGranted() {
    return Boolean(extension_settings[extensionName]?.debugAccessGranted || breachUnlockedThisSession);
}

function setDebugAccessGranted(granted) {
    const settings = extension_settings[extensionName] ||= {};
    settings.debugAccessGranted = Boolean(granted);
    breachUnlockedThisSession = Boolean(granted);
    saveSettingsDebounced();
}

function isDebugControlsHidden() {
    return Boolean(extension_settings[extensionName]?.debugControlsHidden);
}

function setDebugControlsHidden(hidden) {
    const settings = extension_settings[extensionName] ||= {};
    settings.debugControlsHidden = Boolean(hidden);
    saveSettingsDebounced();
    applyDebugControlsVisibilityState();
    updatePayloadDebugControlsToggleLabel();
}

function applyDebugControlsVisibilityState() {
    const controls = document.getElementById("trust-debug-controls");
    if (!controls) return;

    if (isDebugControlsHidden()) {
        controls.style.setProperty("display", "none", "important");
        return;
    }

    applyDebugControlsInlineLayout(controls);
    applyDebugControlsCollapsedState(controls, getDebugControlsCollapsed());
}

function updatePayloadDebugControlsToggleLabel() {
    const btn = document.getElementById("monopad-payload-toggle-debug-controls");
    if (!btn) return;
    btn.textContent = isDebugControlsHidden() ? "SHOW DEBUG BUTTONS" : "HIDE DEBUG BUTTONS";
}

function decodeDebugAccessCode() {
    const cipher = [101, 101, 100, 103, 99, 103, 100, 99, 96, 102, 98, 20, 112];
    const key = 84;
    return cipher.map(value => String.fromCharCode(value ^ key)).join("");
}

function clearBreachTerminalTimers() {
    if (breachTerminalLineTimer) {
        clearInterval(breachTerminalLineTimer);
        breachTerminalLineTimer = null;
    }

    if (breachTerminalBootTimer) {
        clearTimeout(breachTerminalBootTimer);
        breachTerminalBootTimer = null;
    }
}

function appendBreachTerminalLine(text, { className = "" } = {}) {
    const terminal = document.getElementById("monopad-breach-terminal");
    if (!terminal) return;

    const line = document.createElement("div");
    line.className = `monopad-breach-line ${className}`.trim();
    line.textContent = text;
    terminal.appendChild(line);
    terminal.scrollTop = terminal.scrollHeight;
}

function generateBreachCodeLine(prefix = "") {
    const chars = "01ABCDEF$#@{}[]/\\";
    let body = "";
    for (let i = 0; i < 36; i += 1) {
        body += chars[Math.floor(Math.random() * chars.length)];
    }
    return `${prefix}${body}`;
}

function fadeOutBreachAudio(durationMs = 900) {
    if (!breachAudio) return;

    const startVolume = Number.isFinite(breachAudio.volume) ? breachAudio.volume : 0.6;
    const startTime = performance.now();

    const tick = now => {
        const elapsed = now - startTime;
        const ratio = Math.min(1, elapsed / durationMs);
        breachAudio.volume = Math.max(0, startVolume * (1 - ratio));

        if (ratio >= 1) {
            breachAudio.pause();
            breachAudio.currentTime = 0;
            breachAudio.volume = 0.6;
            return;
        }

        requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
}

function closeBreachOverlay() {
    const overlay = document.getElementById("monopad-breach-overlay");
    if (!overlay) return;

    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
    clearBreachTerminalTimers();
    fadeOutBreachAudio(1000);
}

function startBreachOverlayBootSequence() {
    const terminal = document.getElementById("monopad-breach-terminal");
    const inputWrap = document.getElementById("monopad-breach-input-wrap");
    const statusEl = document.getElementById("monopad-breach-status");
    const inputEl = document.getElementById("monopad-breach-input");
    if (!terminal || !inputWrap || !statusEl || !inputEl) return;

    clearBreachTerminalTimers();
    terminal.innerHTML = "";
    inputWrap.classList.add("hidden");
    statusEl.textContent = "";
    inputEl.value = "";

    const bootLines = [
        "[FF-LINK] Initializing encrypted relay...",
        "[FF-LINK] Route mask accepted.",
        "[MONOPAD] Failsafe partitions enumerated.",
        "[FF-LINK] Injecting override payload..."
    ];

    let lineIndex = 0;
    breachTerminalLineTimer = setInterval(() => {
        appendBreachTerminalLine(bootLines[lineIndex] || generateBreachCodeLine("$ "), { className: "alert" });
        lineIndex += 1;
        if (lineIndex >= bootLines.length) {
            clearInterval(breachTerminalLineTimer);
            breachTerminalLineTimer = null;
        }
    }, 320);

    breachTerminalBootTimer = setTimeout(() => {
        appendBreachTerminalLine("[FF-LINK] Enter access code to continue.", { className: "ok" });
        inputWrap.classList.remove("hidden");
        inputEl.focus();
    }, 1650);
}

function openBreachOverlay() {
    const overlay = document.getElementById("monopad-breach-overlay");
    if (!overlay) return;

    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    startBreachOverlayBootSequence();
}

function runBreachSuccessSequence() {
    const statusEl = document.getElementById("monopad-breach-status");
    const inputWrap = document.getElementById("monopad-breach-input-wrap");
    const inputEl = document.getElementById("monopad-breach-input");

    if (inputWrap) inputWrap.classList.add("hidden");
    if (inputEl) inputEl.blur();

    appendBreachTerminalLine("[FF-LINK] Access code accepted.", { className: "ok" });
    appendBreachTerminalLine("[FF-LINK] Breaching Monopad debug partitions...", { className: "alert" });

    if (!breachAudio) {
        breachAudio = new Audio(`${extensionFolderPath}/assets/bgm/nwo.mp3`);
        breachAudio.loop = true;
        breachAudio.volume = 0.6;
    }

    breachAudio.currentTime = 0;
    breachAudio.play().catch(() => {});

    clearBreachTerminalTimers();
    let flyCount = 0;
    breachTerminalLineTimer = setInterval(() => {
        appendBreachTerminalLine(generateBreachCodeLine("# "));
        flyCount += 1;

        if (flyCount >= 22) {
            clearBreachTerminalTimers();
            appendBreachTerminalLine("[FF-LINK] MONOPAD SUCCESSFULLY BREACHED.", { className: "ok" });
            if (statusEl) statusEl.textContent = "Debug controls unlocked.";
            setDebugAccessGranted(true);
            ensureGlobalDebugUi();
        }
    }, 120);
}

function clearPayloadStreamTimer() {
    if (payloadStreamTimer) {
        clearInterval(payloadStreamTimer);
        payloadStreamTimer = null;
    }
}

function appendPayloadStreamLine(text) {
    const stream = document.getElementById("monopad-payload-stream");
    if (!stream) return;

    const line = document.createElement("div");
    line.className = "monopad-payload-line";
    line.textContent = text;
    stream.appendChild(line);

    while (stream.children.length > 36) {
        stream.removeChild(stream.firstChild);
    }

    stream.scrollTop = stream.scrollHeight;
}

function renderPayloadHubIdleState() {
    clearPayloadStreamTimer();
    const stream = document.getElementById("monopad-payload-stream");
    if (!stream) return;

    stream.innerHTML = "";
    appendPayloadStreamLine("[FF-INJECT] Payload hub online.");
    appendPayloadStreamLine("[FF-INJECT] Select an operation to inject a short payload.");
    appendPayloadStreamLine("[FF-INJECT] Debug controls remain available in parallel.");
}

function runPayloadActionAnimation(actionLabel, onComplete) {
    clearPayloadStreamTimer();
    const stream = document.getElementById("monopad-payload-stream");
    if (!stream) return;

    stream.innerHTML = "";
    appendPayloadStreamLine(`[FF-INJECT] Preparing payload: ${actionLabel}`);

    let tick = 0;
    payloadStreamTimer = setInterval(() => {
        tick += 1;
        appendPayloadStreamLine(generateBreachCodeLine("[INJECT] "));

        if (tick >= 10) {
            clearPayloadStreamTimer();
            appendPayloadStreamLine(`[FF-INJECT] Payload ready: ${actionLabel}`);
            setTimeout(() => {
                onComplete?.();
                renderPayloadHubIdleState();
            }, 120);
        }
    }, 80);
}

function applyPayloadInventoryValue(key, value) {
    const ext = extension_settings[extensionName] ||= {};
    ext.inventory ||= {};
    ext.inventory[key] = Math.max(0, Number(value || 0));
    saveSettingsDebounced();
    itemsPanelController?.renderSkillsItemsPanel?.();
}

function promptAndSetMonocoins() {
    const current = Number(extension_settings[extensionName]?.inventory?.monocoins || 0);
    const raw = window.prompt("Set Monocoins amount:", String(current));
    if (raw === null) return;

    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
        appendPayloadStreamLine("[FF-INJECT] Monocoin update rejected: invalid number.");
        return;
    }

    const next = Math.max(0, Math.floor(parsed));
    applyPayloadInventoryValue("monocoins", next);
    appendPayloadStreamLine(`[FF-INJECT] Monocoins set to ${next}.`);
}

function promptAndSetTrustFragments() {
    const current = Number(extension_settings[extensionName]?.inventory?.trustFragments || 0);
    const raw = window.prompt("Set Trust Fragments amount:", String(current));
    if (raw === null) return;

    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
        appendPayloadStreamLine("[FF-INJECT] Trust Fragment update rejected: invalid number.");
        return;
    }

    const next = Math.max(0, Math.floor(parsed));
    applyPayloadInventoryValue("trustFragments", next);
    appendPayloadStreamLine(`[FF-INJECT] Trust Fragments set to ${next}.`);
}

function addPayloadInventoryValue(key, amount = 0) {
    const ext = extension_settings[extensionName] ||= {};
    ext.inventory ||= {};
    const current = Number(ext.inventory[key] || 0);
    const delta = Math.max(0, Math.floor(Number(amount || 0)));
    ext.inventory[key] = Math.max(0, current + delta);
    saveSettingsDebounced();
    itemsPanelController?.renderSkillsItemsPanel?.();
    return ext.inventory[key];
}

function addPayloadXp(amount = 0) {
    const delta = Math.max(0, Math.floor(Number(amount || 0)));
    if (!delta) return;
    rewards?.awardXp?.(delta, "payload debug boost");
}

function maxTrustForCharacter(char) {
    if (!char) return false;

    const before = Number(char.trustLevel ?? 1);
    for (let i = 0; i < 40 && Number(char.trustLevel ?? 1) < 10; i += 1) {
        increaseTrustWithRewards(char);
    }

    return Number(char.trustLevel ?? before) > before;
}

function maxTrustForAllCharacters() {
    let boosted = 0;
    for (const char of characters.values()) {
        if (maxTrustForCharacter(char)) {
            boosted += 1;
        }
    }

    if (boosted > 0) {
        saveCharacters();
        socialPanelController?.renderSocialPanel?.();
        const activeChar = getActiveSocialCharacter();
        if (activeChar) {
            socialPanelController?.openCharacterReport?.(activeChar);
        }
    }

    return boosted;
}

function rescanCharactersFromContext() {
    const before = characters.size;
    registerCharactersFromContext();
    socialPanelController?.renderSocialPanel?.();
    return Math.max(0, characters.size - before);
}

function closePayloadOverlay() {
    const overlay = document.getElementById("monopad-payload-overlay");
    if (!overlay) return;

    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
    clearPayloadStreamTimer();
}

function openPayloadOverlay() {
    const overlay = document.getElementById("monopad-payload-overlay");
    if (!overlay) return;

    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    updatePayloadDebugControlsToggleLabel();
    renderPayloadHubIdleState();
}

function bootstrapDebugUi() {
    if (!document.body) return;

    ensureDebugControlsStyleTag();
    ensureGlobalDebugUi();
    startDebugUiObserver();

    window.addEventListener("resize", ensureGlobalDebugUi);
    window.addEventListener("orientationchange", ensureGlobalDebugUi);

    if (!window.__danganDebugUiWatchdog) {
        window.__danganDebugUiWatchdog = window.setInterval(() => {
            ensureGlobalDebugUi();
        }, 1500);
    }
}

function applyDebugControlsInlineLayout(controls) {
    if (!controls) return;

    const isMobile = window.matchMedia?.("(max-width: 700px)")?.matches;

    controls.style.setProperty("position", "fixed", "important");
    controls.style.setProperty("z-index", "2147483647", "important");
    controls.style.setProperty("display", "flex", "important");
    controls.style.setProperty("pointer-events", "auto", "important");
    controls.style.setProperty("opacity", "1", "important");
    const hasCustomPosition = controls.dataset.customPosition === "true" || applyCustomUiPosition(controls, DEBUG_CONTROLS_POSITION_STORAGE_KEY);

    if (!hasCustomPosition) {
        controls.style.setProperty("right", isMobile ? "auto" : "10px", "important");
        controls.style.setProperty("left", isMobile ? "max(10px, env(safe-area-inset-left, 0px))" : "auto", "important");
        controls.style.setProperty("top", isMobile ? "calc(env(safe-area-inset-top, 0px) + 60px)" : "auto", "important");
        controls.style.setProperty("bottom", isMobile ? "auto" : "14px", "important");
    }
    controls.style.setProperty("flex-direction", "column", "important");
    controls.style.setProperty("gap", "6px", "important");
    controls.style.setProperty("align-items", "stretch", "important");
    controls.style.setProperty("visibility", "visible", "important");

    controls.querySelectorAll("button").forEach(button => {
        button.style.setProperty("display", "inline-flex", "important");
        button.style.setProperty("align-items", "center", "important");
        button.style.setProperty("justify-content", "center", "important");
        button.style.setProperty("background", "#111", "important");
        button.style.setProperty("color", "#fff", "important");
        button.style.setProperty("border", "1px solid #444", "important");
        button.style.setProperty("border-radius", "6px", "important");
        button.style.setProperty("padding", isMobile ? "6px 8px" : "6px 10px", "important");
        button.style.setProperty("min-height", isMobile ? "34px" : "32px", "important");
        button.style.setProperty("min-width", isMobile ? "72px" : "120px", "important");
        button.style.setProperty("font-size", isMobile ? "11px" : "12px", "important");
        button.style.setProperty("cursor", "pointer", "important");
        button.style.setProperty("letter-spacing", "0.06em", "important");
        button.style.setProperty("visibility", "visible", "important");
    });

    const panel = controls.querySelector(".trust-debug-buttons");
    if (panel) {
        panel.style.setProperty("display", "flex", "important");
        panel.style.setProperty("flex-direction", "column", "important");
        panel.style.setProperty("gap", "6px", "important");
    }
}

function applyTruthDebugModalInlineLayout(modal) {
    if (!modal) return;

    const isMobile = window.matchMedia?.("(max-width: 700px)")?.matches;
    const topInset = "env(safe-area-inset-top, 0px)";
    const bottomInset = "env(safe-area-inset-bottom, 0px)";

    modal.style.setProperty("position", "fixed", "important");
    modal.style.setProperty("top", "0", "important");
    modal.style.setProperty("left", "0", "important");
    modal.style.setProperty("width", "100vw", "important");
    modal.style.setProperty("height", "100dvh", "important");
    modal.style.setProperty("z-index", "2147483646", "important");
    modal.style.setProperty("display", "flex", "important");
    modal.style.setProperty("align-items", "center", "important");
    modal.style.setProperty("justify-content", "center", "important");
    modal.style.setProperty("box-sizing", "border-box", "important");
    modal.style.setProperty("overflow-y", "auto", "important");
    modal.style.setProperty("padding-top", isMobile ? `max(12px, calc(${topInset} + 8px))` : "16px", "important");
    modal.style.setProperty("padding-bottom", isMobile ? `max(12px, calc(${bottomInset} + 8px))` : "16px", "important");
    modal.style.setProperty("padding-left", isMobile ? "10px" : "12px", "important");
    modal.style.setProperty("padding-right", isMobile ? "10px" : "12px", "important");

    const card = modal.querySelector('.truth-debug-card');
    if (!card) return;

    card.style.setProperty("width", isMobile ? "min(96vw, 430px)" : "min(420px, 96vw)", "important");
    card.style.setProperty("max-width", "96vw", "important");
    card.style.setProperty("max-height", isMobile ? `calc(100dvh - ${topInset} - ${bottomInset} - 20px)` : "min(86dvh, 640px)", "important");
    card.style.setProperty("overflow-y", "auto", "important");
    card.style.setProperty("margin", "0 auto", "important");
    card.style.setProperty("box-sizing", "border-box", "important");
}

function applyAnnouncementDebugModalInlineLayout(modal) {
    if (!modal) return;
    applyTruthDebugModalInlineLayout(modal);

    const card = modal.querySelector('.truth-debug-card');
    if (!card) return;
    card.setAttribute("aria-label", "Monokuma announcement debug");
}

function ensureGlobalDebugUi() {
    const legacyHud = document.getElementById("dangan-debug-hud-host");
    if (legacyHud) legacyHud.remove();

    if (!isDebugAccessGranted()) {
        document.getElementById("trust-debug-controls")?.remove();
        document.getElementById("truth-debug-modal")?.remove();
        document.getElementById("announcement-debug-modal")?.remove();
        return;
    }

    let controls = document.getElementById("trust-debug-controls");

    if (!controls) {
        controls = document.createElement("div");
        controls.id = "trust-debug-controls";
        controls.innerHTML = `
            <button id="trust-debug-toggle" type="button" aria-expanded="false">DEBUG ▸</button>
            <div class="trust-debug-buttons" role="group" aria-label="Debug controls">
                <button id="trust-debug-up" type="button">TRUST +</button>
                <button id="trust-debug-down" type="button">TRUST -</button>
                <button id="truth-debug-open" type="button">NEW TRUTH BULLET</button>
                <button id="investigation-debug-trigger" type="button">INVESTIGATION START</button>
                <button id="announcement-debug-open" type="button">MONOKUMA ANNOUNCEMENT</button>
            </div>
        `;
    }

    if (controls.parentElement !== document.body) {
        document.body.appendChild(controls);
    }

    attachDraggablePositioning(controls, {
        storageKey: DEBUG_CONTROLS_POSITION_STORAGE_KEY,
        handleSelector: "#trust-debug-toggle",
        suppressClickDataKey: "suppressToggleClickUntil",
    });

    let modal = document.getElementById("truth-debug-modal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "truth-debug-modal";
        modal.className = "truth-debug-modal hidden";
        modal.setAttribute("aria-hidden", "true");
        modal.innerHTML = `
            <div class="truth-debug-card" role="dialog" aria-modal="true" aria-label="Custom truth bullet debug">
                <div class="truth-debug-title">CREATE CUSTOM TRUTH BULLET</div>
                <label class="truth-debug-label" for="truth-debug-name">NAME</label>
                <input id="truth-debug-name" class="truth-debug-input" type="text" maxlength="80" placeholder="Truth Bullet Name" />

                <label class="truth-debug-label" for="truth-debug-description">DESCRIPTION</label>
                <textarea id="truth-debug-description" class="truth-debug-textarea" rows="4" maxlength="500" placeholder="Optional description"></textarea>

                <label class="truth-debug-label">IMAGE <span style="opacity:0.5">(OPTIONAL)</span></label>
                <div class="truth-debug-image-row">
                    <label class="truth-debug-image-upload-btn">
                        CHOOSE FILE
                        <input type="file" accept="image/*" id="truth-debug-image-input" style="display:none">
                    </label>
                    <span class="truth-debug-image-name" id="truth-debug-image-name">No file chosen</span>
                    <button type="button" id="truth-debug-image-clear" class="truth-debug-image-clear" style="display:none" title="Remove image">✕</button>
                </div>
                <img id="truth-debug-image-preview" class="truth-debug-image-preview" style="display:none" alt="">

                <div class="truth-debug-choice-group" role="radiogroup" aria-label="Truth bullet SFX">
                    <label class="truth-debug-choice">
                        <input type="radio" name="truth-debug-sfx" value="thh" checked />
                        <span>THH</span>
                    </label>
                    <label class="truth-debug-choice">
                        <input type="radio" name="truth-debug-sfx" value="udg" />
                        <span>UDG</span>
                    </label>
                </div>

                <div class="truth-debug-actions">
                    <button id="truth-debug-cancel" class="truth-debug-btn ghost" type="button">CANCEL</button>
                    <button id="truth-debug-acquire" class="truth-debug-btn" type="button">ACQUIRE</button>
                </div>
            </div>
        `;
    }

    let announcementModal = document.getElementById("announcement-debug-modal");
    if (!announcementModal) {
        announcementModal = document.createElement("div");
        announcementModal.id = "announcement-debug-modal";
        announcementModal.className = "truth-debug-modal hidden";
        announcementModal.setAttribute("aria-hidden", "true");
        announcementModal.innerHTML = `
            <div class="truth-debug-card" role="dialog" aria-modal="true" aria-label="Monokuma announcement debug">
                <div class="truth-debug-title">TRIGGER MONOKUMA ANNOUNCEMENT</div>
                <div class="truth-debug-choice-group" role="radiogroup" aria-label="Announcement type">
                    <label class="truth-debug-choice">
                        <input type="radio" name="announcement-debug-type" value="DAY_ANNOUN" checked />
                        <span>Daytime Announcement</span>
                    </label>
                    <label class="truth-debug-choice">
                        <input type="radio" name="announcement-debug-type" value="NIGHT_ANNOUN" />
                        <span>Nighttime Announcement</span>
                    </label>
                    <label class="truth-debug-choice">
                        <input type="radio" name="announcement-debug-type" value="BDA" />
                        <span>Body Discovery Announcement</span>
                    </label>
                    <label class="truth-debug-choice">
                        <input type="radio" name="announcement-debug-type" value="ERROR" />
                        <span>Error</span>
                    </label>
                    <label class="truth-debug-choice">
                        <input type="radio" name="announcement-debug-type" value="NO_INPUT" />
                        <span>No Input</span>
                    </label>
                </div>

                <div class="truth-debug-actions">
                    <button id="announcement-debug-cancel" class="truth-debug-btn ghost" type="button">CANCEL</button>
                    <button id="announcement-debug-trigger" class="truth-debug-btn" type="button">TRIGGER</button>
                </div>
            </div>
        `;
    }

    if (modal.parentElement !== document.body) {
        document.body.appendChild(modal);
    }

    if (announcementModal.parentElement !== document.body) {
        document.body.appendChild(announcementModal);
    }

    applyDebugControlsInlineLayout(controls);
    applyDebugControlsCollapsedState(controls, getDebugControlsCollapsed());
    applyDebugControlsVisibilityState();
    applyTruthDebugModalInlineLayout(modal);
    applyAnnouncementDebugModalInlineLayout(announcementModal);
}

// =========================
// TRUST DEBUG CONTROLS
// =========================


function syncDebugControlsModalVisibility() {
    const controls = document.getElementById("trust-debug-controls");
    const truthModal = document.getElementById("truth-debug-modal");
    const announcementModal = document.getElementById("announcement-debug-modal");
    const isAnyModalOpen = !truthModal?.classList.contains("hidden") || !announcementModal?.classList.contains("hidden");

    if (!controls) return;
    controls.style.setProperty("visibility", isAnyModalOpen ? "hidden" : "visible", "important");
    controls.style.setProperty("pointer-events", isAnyModalOpen ? "none" : "auto", "important");
}

function setTruthDebugModalState(isOpen) {
    const modal = document.getElementById("truth-debug-modal");
    if (!modal) return;

    if (isOpen) {
        modal.classList.remove("hidden");
        modal.setAttribute("aria-hidden", "false");
        applyTruthDebugModalInlineLayout(modal);
    } else {
        modal.classList.add("hidden");
        modal.setAttribute("aria-hidden", "true");
    }

    syncDebugControlsModalVisibility();
}

function setAnnouncementDebugModalState(isOpen) {
    const modal = document.getElementById("announcement-debug-modal");
    if (!modal) return;

    if (isOpen) {
        modal.classList.remove("hidden");
        modal.setAttribute("aria-hidden", "false");
        applyAnnouncementDebugModalInlineLayout(modal);
    } else {
        modal.classList.add("hidden");
        modal.setAttribute("aria-hidden", "true");
    }

    syncDebugControlsModalVisibility();
}

let pendingTruthBulletImage = null;

function resetTruthDebugImageUI() {
    pendingTruthBulletImage = null;
    const input = document.getElementById("truth-debug-image-input");
    if (input) input.value = "";
    const preview = document.getElementById("truth-debug-image-preview");
    if (preview) { preview.src = ""; preview.style.display = "none"; }
    const clearBtn = document.getElementById("truth-debug-image-clear");
    if (clearBtn) clearBtn.style.display = "none";
    const name = document.getElementById("truth-debug-image-name");
    if (name) name.textContent = "No file chosen";
}

function closeTruthDebugModal() {
    resetTruthDebugImageUI();
    setTruthDebugModalState(false);
}

function closeAnnouncementDebugModal() {
    setAnnouncementDebugModalState(false);
}

function playDebugClickSfx() {
    if (sfx?.click) playSfx(sfx.click);
}

function bindDebugControlEvents() {
    $(document).off("click.debugControls");
    $(document).off("click.debugModal");
    $(document).off("keydown.debugControls");

    $(document).on("click.debugControls", "#truth-debug-open", () => {
        playDebugClickSfx();
        ensureGlobalDebugUi();
        setTruthDebugModalState(true);
        $("#truth-debug-name").trigger("focus");
    });

    const toggleTray = () => {
        const controls = document.getElementById("trust-debug-controls");
        const suppressUntil = Number(controls?.dataset?.suppressToggleClickUntil || "0");
        if (Date.now() < suppressUntil) return;

        playDebugClickSfx();
        const isCollapsed = getDebugControlsCollapsed();
        setDebugControlsCollapsed(!isCollapsed);
    };

    $(document).on("click.debugControls", "#trust-debug-toggle", toggleTray);

    $(document).on("click.debugControls", "#truth-debug-cancel", () => {
        playDebugClickSfx();
        closeTruthDebugModal();
    });

    $(document).on("click.debugModal", "#truth-debug-modal", e => {
        if (e.target.id === "truth-debug-modal") {
            closeTruthDebugModal();
        }
    });

    $(document).on("change.debugControls", "#truth-debug-image-input", function () {
        const file = this.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
            pendingTruthBulletImage = e.target.result;
            const preview = document.getElementById("truth-debug-image-preview");
            if (preview) { preview.src = pendingTruthBulletImage; preview.style.display = "block"; }
            const clearBtn = document.getElementById("truth-debug-image-clear");
            if (clearBtn) clearBtn.style.display = "inline-block";
            const name = document.getElementById("truth-debug-image-name");
            if (name) name.textContent = file.name;
        };
        reader.readAsDataURL(file);
    });

    $(document).on("click.debugControls", "#truth-debug-image-clear", () => {
        resetTruthDebugImageUI();
    });

    $(document).on("click.debugControls", "#announcement-debug-open", () => {
        playDebugClickSfx();
        ensureGlobalDebugUi();
        setAnnouncementDebugModalState(true);
    });

    $(document).on("click.debugControls", "#announcement-debug-cancel", () => {
        playDebugClickSfx();
        closeAnnouncementDebugModal();
    });

    $(document).on("click.debugModal", "#announcement-debug-modal", e => {
        if (e.target.id === "announcement-debug-modal") {
            closeAnnouncementDebugModal();
        }
    });

    $(document).on("click.debugControls", "#truth-debug-acquire", () => {
        playDebugClickSfx();

        const title = String($("#truth-debug-name").val() || "").trim();
        const description = String($("#truth-debug-description").val() || "").trim();

        if (!title) {
            $("#truth-debug-name").trigger("focus");
            return;
        }

        const selectedSfx = String($("input[name='truth-debug-sfx']:checked").val() || "thh").trim().toLowerCase();
        setNextTruthBulletSfxVariant(selectedSfx === "udg" ? "udg" : "thh");

        handleTruthBullet(title, description, { image: pendingTruthBulletImage || undefined });
        $("#truth-debug-name").val("");
        $("#truth-debug-description").val("");
        closeTruthDebugModal();
    });

    $(document).on("click.debugControls", "#trust-debug-up", () => {
        playDebugClickSfx();

        const char = getActiveSocialCharacter();
        if (!char) {
            console.warn("[Dangan][Debug] No social character selected. Click a character name first.");
            return;
        }

        increaseTrustWithRewards(char);
    });

    $(document).on("click.debugControls", "#trust-debug-down", () => {
        playDebugClickSfx();

        const char = getActiveSocialCharacter();
        if (!char) {
            console.warn("[Dangan][Debug] No social character selected. Click a character name first.");
            return;
        }

        decreaseTrust(char);
    });

    $(document).on("click.debugControls", "#investigation-debug-trigger", () => {
        playDebugClickSfx();
        investigationStartController.trigger();
    });

    $(document).on("click.debugControls", "#announcement-debug-trigger", () => {
        playDebugClickSfx();
        const selectedType = String($("input[name='announcement-debug-type']:checked").val() || "DAY_ANNOUN").trim();
        monokumaAnnouncementController?.trigger(selectedType);
        closeAnnouncementDebugModal();
    });

    $(document).on("click.debugControls", "#dangan_debug_breach_trigger", () => {
        playDebugClickSfx();
        if (isDebugAccessGranted()) {
            openPayloadOverlay();
            return;
        }
        openBreachOverlay();
    });

    $(document).on("click.debugControls", "#monopad-breach-close", () => {
        playDebugClickSfx();
        closeBreachOverlay();
    });

    $(document).on("click.debugModal", "#monopad-breach-overlay", e => {
        if (e.target.id === "monopad-breach-overlay") {
            closeBreachOverlay();
        }
    });

    $(document).on("click.debugControls", "#monopad-payload-close", () => {
        playDebugClickSfx();
        closePayloadOverlay();
    });

    $(document).on("click.debugModal", "#monopad-payload-overlay", e => {
        if (e.target.id === "monopad-payload-overlay") {
            closePayloadOverlay();
        }
    });

    $(document).on("click.debugControls", "#monopad-payload-open-breach", () => {
        playDebugClickSfx();
        closePayloadOverlay();
        openBreachOverlay();
    });

    $(document).on("click.debugControls", "#monopad-payload-edit-monocoins", () => {
        playDebugClickSfx();
        runPayloadActionAnimation("MONOCOIN PATCH", promptAndSetMonocoins);
    });

    $(document).on("click.debugControls", "#monopad-payload-edit-trust-fragments", () => {
        playDebugClickSfx();
        runPayloadActionAnimation("TRUST FRAGMENT PATCH", promptAndSetTrustFragments);
    });

    $(document).on("click.debugControls", "#monopad-payload-add-monocoins", () => {
        playDebugClickSfx();
        runPayloadActionAnimation("MONOCOIN BOOST", () => {
            const total = addPayloadInventoryValue("monocoins", 500);
            appendPayloadStreamLine(`[FF-INJECT] +500 Monocoins injected (total: ${total}).`);
        });
    });

    $(document).on("click.debugControls", "#monopad-payload-add-trust-fragments", () => {
        playDebugClickSfx();
        runPayloadActionAnimation("TRUST FRAGMENT BOOST", () => {
            const total = addPayloadInventoryValue("trustFragments", 10);
            appendPayloadStreamLine(`[FF-INJECT] +10 Trust Fragments injected (total: ${total}).`);
        });
    });

    $(document).on("click.debugControls", "#monopad-payload-add-xp", () => {
        playDebugClickSfx();
        runPayloadActionAnimation("XP BOOST", () => {
            addPayloadXp(1000);
            appendPayloadStreamLine("[FF-INJECT] +1000 XP injected.");
        });
    });

    $(document).on("click.debugControls", "#monopad-payload-max-active-trust", () => {
        playDebugClickSfx();
        runPayloadActionAnimation("ACTIVE SOCIAL LINK OVERRIDE", () => {
            const char = getActiveSocialCharacter();
            if (!char) {
                appendPayloadStreamLine("[FF-INJECT] No active social target selected.");
                return;
            }

            const before = Number(char.trustLevel ?? 1);
            maxTrustForCharacter(char);
            saveCharacters();
            socialPanelController?.renderSocialPanel?.();
            socialPanelController?.openCharacterReport?.(char);
            appendPayloadStreamLine(`[FF-INJECT] ${char.name} trust ${before} -> ${char.trustLevel}.`);
        });
    });

    $(document).on("click.debugControls", "#monopad-payload-max-all-trust", () => {
        playDebugClickSfx();
        runPayloadActionAnimation("GLOBAL SOCIAL LINK OVERRIDE", () => {
            const boosted = maxTrustForAllCharacters();
            appendPayloadStreamLine(`[FF-INJECT] Maxed social links for ${boosted} character(s).`);
        });
    });

    $(document).on("click.debugControls", "#monopad-payload-rescan-characters", () => {
        playDebugClickSfx();
        runPayloadActionAnimation("CHARACTER SCAN", () => {
            const added = rescanCharactersFromContext();
            appendPayloadStreamLine(`[FF-INJECT] Character scan complete. Added ${added} profile(s).`);
        });
    });

    $(document).on("click.debugControls", "#monopad-payload-reset-gifts", () => {
        playDebugClickSfx();
        runPayloadActionAnimation("GIFT INVENTORY WIPE", () => {
            const ext = extension_settings[extensionName] ||= {};
            ext.inventory ||= {};
            ext.inventory.gifts = {};
            saveSettingsDebounced();
            itemsPanelController?.renderSkillsItemsPanel?.();
            appendPayloadStreamLine("[FF-INJECT] Gift inventory cleared.");
        });
    });

    $(document).on("click.debugControls", "#monopad-payload-give-all-gifts", () => {
        playDebugClickSfx();
        runPayloadActionAnimation("GIFT UNLOCK SEQUENCE", () => {
            const ext = extension_settings[extensionName] ||= {};
            ext.inventory ||= {};
            ext.inventory.gifts ||= {};
            const pool = itemsPanelController?.getGiftPoolWithCounts?.() ?? [];
            let count = 0;
            for (const item of pool) {
                if (!item.owned) {
                    ext.inventory.gifts[item.id] = 1;
                    count += 1;
                }
            }
            saveSettingsDebounced();
            itemsPanelController?.renderSkillsItemsPanel?.();
            appendPayloadStreamLine(`[FF-INJECT] Granted ${count} gift(s).`);
        });
    });

    $(document).on("click.debugControls", "#monopad-payload-clear-truth-bullets", () => {
        playDebugClickSfx();
        runPayloadActionAnimation("TRUTH BULLET PURGE", () => {
            const count = getTruthBullets().length;
            clearAllTruthBullets();
            appendPayloadStreamLine(`[FF-INJECT] ${count} truth bullet(s) deleted.`);
        });
    });

    $(document).on("click.debugControls", "#monopad-payload-toggle-debug-controls", () => {
        playDebugClickSfx();
        setDebugControlsHidden(!isDebugControlsHidden());
        appendPayloadStreamLine(isDebugControlsHidden()
            ? "[FF-INJECT] Debug button cluster hidden."
            : "[FF-INJECT] Debug button cluster restored.");
    });

    $(document).on("click.debugControls", "#monopad-breach-submit", () => {
        playDebugClickSfx();

        const inputEl = document.getElementById("monopad-breach-input");
        const statusEl = document.getElementById("monopad-breach-status");
        const entered = String(inputEl?.value || "").trim();

        if (!entered) {
            if (statusEl) statusEl.textContent = "Enter an access code.";
            inputEl?.focus();
            return;
        }

        if (entered !== decodeDebugAccessCode()) {
            appendBreachTerminalLine("[FF-LINK] ACCESS DENIED", { className: "error" });
            if (statusEl) statusEl.textContent = "Code rejected.";
            inputEl.value = "";
            inputEl?.focus();
            return;
        }

        runBreachSuccessSequence();
    });

    $(document).on("keydown.debugControls", "#monopad-breach-input", e => {
        if (e.key === "Enter") {
            e.preventDefault();
            document.getElementById("monopad-breach-submit")?.click();
        }
    });

    $(document).on("keydown.debugControls", e => {
        if (e.key !== "Escape") return;
        closeTruthDebugModal();
        closeAnnouncementDebugModal();
    });
}


function normalizeSettingsHeaderActionButtons() {
    const headers = Array.from(document.querySelectorAll('.settings-header-actions'));
    if (!headers.length) return;

    const primaryHeader = headers[0];
    const primaryBreach = primaryHeader.querySelector('#dangan_debug_breach_trigger');
    const primaryTutorial = primaryHeader.querySelector('#dangan_monokuma_lesson_button');
    const status = primaryHeader.querySelector('.settings-status');

    if (primaryBreach && primaryTutorial && status) {
        primaryHeader.insertBefore(primaryBreach, primaryTutorial);
        primaryHeader.insertBefore(primaryTutorial, status);
    }

    document.querySelectorAll('#dangan_debug_breach_trigger').forEach((el, index) => {
        if (index > 0) el.remove();
    });

    document.querySelectorAll('#dangan_monokuma_lesson_button').forEach((el, index) => {
        if (index > 0) el.remove();
    });
}

function applyMonopadLaunchControlState(buttonEl, panelEl = null) {
    const isEnabled = getMonopadSetting("monopadButtonEnabled") !== false;

    if (buttonEl) {
        buttonEl.style.display = isEnabled ? "flex" : "none";
        buttonEl.setAttribute("aria-hidden", isEnabled ? "false" : "true");
    }

    if (!isEnabled && panelEl) {
        panelEl.classList.remove("open", "booting", "boot-cold", "boot-warm", "shutting-down");
        panelEl.classList.add("closed");
    }

    const toggleEl = document.getElementById("dangan_enable_monopad_button");
    if (toggleEl) toggleEl.checked = isEnabled;

    return isEnabled;
}


function buildExtensionPathCandidates() {
    const thirdPartyFallback = `scripts/extensions/third-party/${extensionName}`;
    const directFallback = `scripts/extensions/${extensionName}`;
    const candidates = [
        extensionFolderPath,
        thirdPartyFallback,
        directFallback,
        `/${thirdPartyFallback}`,
        `/${directFallback}`,
    ]
        .map((value) => String(value || "").trim().replace(/\/$/, ""))
        .filter(Boolean);

    return [...new Set(candidates)];
}

async function loadExtensionHtmlFile(fileName) {
    const attempted = [];

    for (const basePath of buildExtensionPathCandidates()) {
        const url = `${basePath}/${fileName}`;
        attempted.push(url);

        try {
            const html = await $.get(url);
            if (url !== `${extensionFolderPath}/${fileName}`) {
                console.warn(`[${extensionName}] Loaded ${fileName} from fallback path: ${url}`);
            }
            return html;
        } catch {
            // Try next path candidate.
        }
    }

    throw new Error(`Unable to load ${fileName}. Tried: ${attempted.join(", ")}`);
}


jQuery(async () => {
    console.log(`[${extensionName}] Loading...`);

    bootstrapDebugUi();
    bindDebugControlEvents();

    try {
        reportFullscreenOverlayDebug("A", "index.js:boot", "Entered extension boot try block");
        const settingsHtml = await loadExtensionHtmlFile("example.html");
        $("#extensions_settings2").append(settingsHtml);

        const monopadHtml = await loadExtensionHtmlFile("monopad.html");
        const normalizedMonopadHtml = monopadHtml.replace(/scripts\/extensions\/third-party\/danganronpa-extension/g, extensionFolderPath);
        $("body").append(normalizedMonopadHtml);
        normalizeSettingsHeaderActionButtons();
        ensureGlobalDebugUi();
        vnModeController = createVnModeController();
        monokumaAnnouncementController = createMonokumaAnnouncementController({
            extensionFolderPath,
            shouldPlayAudio: () => Number(extension_settings[extensionName]?.announcementVolume ?? 65) > 0,
            getVolume: () => Number(extension_settings[extensionName]?.announcementVolume ?? 65) / 100,
            getLanguage: () => String(extension_settings[extensionName]?.monokumaLanguage ?? "EN"),
            onBefore: async () => {
                audioVisualizer.hide();
                await fadeOutAndPauseBgm(500);
            },
            getCustomOverrides: (type) => {
                if (!getMonopadSetting('hideHopesPeakBranding')) return {};
                const tab = extension_settings[extensionName] ?? {};
                const imageMode = tab[`announcementMode_image_${type}`] ?? 'default';
                const voiceMode = tab[`announcementMode_voice_${type}`] ?? 'default';
                const textMode  = tab[`announcementMode_text_${type}`]  ?? 'default';
                return {
                    image: imageMode === 'custom' ? (tab[`announcementData_image_${type}`] ?? null) : null,
                    voice: voiceMode === 'custom' ? (tab[`announcementData_voice_${type}`] ?? null) : null,
                    text:  textMode  === 'custom' ? (tab[`announcementData_text_${type}`]  ?? null) : null,
                };
            },
        });

        // SillyTavern may re-mount portions of the DOM after extension load.
        // Re-assert the debug UI a few times to keep controls on the main screen.
        let debugUiRetries = 0;
        const debugUiRetryTimer = setInterval(() => {
            normalizeSettingsHeaderActionButtons();
            ensureGlobalDebugUi();
            debugUiRetries += 1;
            if (debugUiRetries >= 12) clearInterval(debugUiRetryTimer);
        }, 500);

        setTimeout(() => {
            //registerCharactersFromContext();
            socialPanelController?.renderSocialPanel();
        }, 300);

        const $button = $("#dangan_monopad_button");
        const $panel = $("#dangan_monopad_panel");
        $panel.addClass("fullscreen");
        applyMonopadLaunchControlState($button.get(0), $panel.get(0));

        const monopadButtonEl = $button.get(0);
        if (monopadButtonEl) {
            monopadButtonEl.style.setProperty("touch-action", "none");
            applyCustomUiPosition(monopadButtonEl, MONOPAD_BUTTON_POSITION_STORAGE_KEY);
            attachDraggablePositioning(monopadButtonEl, {
                storageKey: MONOPAD_BUTTON_POSITION_STORAGE_KEY,
                suppressClickDataKey: "suppressMonopadClickUntil",
            });
            window.addEventListener("resize", () => {
                if (!monopadButtonEl.dataset.customPosition) return;
                applyCustomUiPosition(monopadButtonEl, MONOPAD_BUTTON_POSITION_STORAGE_KEY);
            });
        }

        const welcomeUserEl = document.getElementById("monopad_welcome_user");
        if (welcomeUserEl) {
            welcomeUserEl.textContent = getActivePersonaName();
        }

        $(".monopad-icon").removeClass("active");
        $(".monopad-panel-content").removeClass("active");
        $(`.monopad-panel-content[data-panel="welcome"]`).addClass("active");
        
    sfx = {
        open: document.getElementById("monopad_sfx_open"),
        close: document.getElementById("monopad_sfx_close"),
        click: document.getElementById("monopad_sfx_click"),
        hover: document.getElementById("monopad_sfx_hover"),
        message_move: document.getElementById("monopad_sfx_message_move"),
        character_hover: document.getElementById("ow_sfx_character_hover"),
        character_click: document.getElementById("ow_sfx_character_click"),
        character_enter_talk: document.getElementById("ow_sfx_character_enter_talk"),
        character_exit_talk: document.getElementById("ow_sfx_character_exit_talk"),
        change_rooms: document.getElementById("ow_sfx_change_rooms"),
        monocoin_insert: document.getElementById("monopad_sfx_monocoin_insert"),
        monochine_jingle: document.getElementById("monopad_sfx_monochine_jingle"),
        monochine_turn: document.getElementById("monopad_sfx_monochine_turn"),
        monochine_track: document.getElementById("monopad_sfx_monochine_track"),
        monokuma: document.getElementById("monopad_sfx_monokuma"),
        monokumasad: document.getElementById("sfx_monokuma_sad"),
        bullet_get: document.getElementById("bullet_sfx_get"),
        bullet_get_alt: document.getElementById("bullet_sfx_get_alt"),
        trust_up: document.getElementById("trust_sfx_up"),
        trust_down: document.getElementById("trust_sfx_down"),
        trust_max: document.getElementById("trust_sfx_max"),
        trust_shatter: document.getElementById("trust_sfx_shatter"),
        distrust_recover: document.getElementById("distrust_sfx_recover"),
        investigation_start: document.getElementById("investigation_start_sfx"),
        hit: document.getElementById("trial_sfx_hit"),
        miss: document.getElementById("trial_sfx_miss"),
        shoottb: document.getElementById("trial_sfx_shoottb"),
        tbcycle: document.getElementById("trial_sfx_tbcycle"),
        tbmiss: document.getElementById("trial_sfx_tbmiss"),
        countersfx: document.getElementById("trial_sfx_counter"),
        tb_shot: document.getElementById("trial_sfx_tb_shot"),
        tb_spent: document.getElementById("trial_sfx_tb_spent"),
        rejected_shot: document.getElementById("trial_sfx_rejected_shot"),
        weak_spot_hit: document.getElementById("trial_sfx_weak_spot_hit"),
        wn_shooting: document.getElementById("trial_sfx_wn_shooting"),
        wn_damage: document.getElementById("trial_sfx_wn_damage"),
        chain_trigger: document.getElementById("trial_sfx_chain_trigger"),
        chain_broken: document.getElementById("trial_sfx_chain_broken"),
    }

        initTrustAnimations({
    sfx,
    unlockAudio,
    playSfx: (sound) => {
        if (trialManager?.getState?.() === TrialPhases.NON_STOP_DEBATE) return;
        playSfx(sound);
    },
    getSetting: getMonopadSetting
});

        itemsPanelController = createItemsPanelController({
            extensionName,
            extension_settings,
            saveSettingsDebounced,
            playSfx,
            getSfx: () => sfx,
            onGiftUseRequest: queueGiftForNextReply,
        });
        itemsPanelController.bindWindowApi();

        rewards = createRewardSystem({
            extensionName,
            extensionFolderPath,
            extension_settings,
            saveSettingsDebounced,
            monocoinRewards: MONOCOIN_REWARDS,
            xpRewards: XP_REWARDS,
            getItemsPanelController: () => itemsPanelController,
            increaseTrust,
            getCoinLabel: () => getMonopadSetting('hideHopesPeakBranding') ? 'COINS' : 'MONOCOINS',
            resolveSkillParam,
        });

        socialPanelController = createSocialPanelController({
            characters,
            saveCharacters,
            lookupUltimateFromLorebook,
            generateCharacterNotes,
            getActiveSocialCharacterId: () => activeSocialCharacterId,
            setActiveSocialCharacterId: value => {
                activeSocialCharacterId = value;
            },
            getUserName: getActivePersonaName,
            getUserAvatarUrl: getActiveUserAvatarUrl,
            getSpriteUrl,
            getPromeSpritePack: () => {
                const prome = extension_settings?.['Prome-VN-Extension'];
                return (prome?.enableUserSprite && prome?.userSprite) ? prome.userSprite : null;
            },
            getMonopadSetting,
            onCharacterDead: (name) => trialManager?.markCharacterExecuted(name),
        });

        try {
            mapPanelController = createMapPanelController({
                extensionFolderPath,
                getItemsPanelController: () => itemsPanelController,
                playSfx,
                getSfx: () => sfx,
                getSetting: getMonopadSetting,
                onWalkStep: () => awardXp(XP_REWARDS.walkStep, "walked"),
                onTrialStartRequest: () => triggerTrialStartFromMapPin(),
                getTruthBulletByLocationId: (locationId) => getTruthBulletByLocationId(locationId),
                navigateToTruth: (bulletId) => {
                    setActiveMonopadTab("truth");
                    showTruthBulletById(bulletId);
                },
                onMachineOpen: () => fadeOutAndPauseBgm(),
                onMachineClose: () => fadeInAndResumeBgm(),
                playShopTrack,
                stopShopTrack,
                fetchBgmPaths,
                playBgmPath,
            });
            mapPanelController?.renderMapPanel?.();

            try {
                overworldSceneController = createOverworldSceneController({
                    extension_settings,
                    extensionName,
                    saveSettingsDebounced,
                    characters,
                    getSpriteUrl,
                    getAvailableExpressionLabels,
                    getCharacterHeightCm,
                    getCurrentLocationId,
                    isInCharacterChat,
                    executeSlashCommands: (cmd) => executeSlashCommandsWithOptions(cmd, { handleParserErrors: true }),
                    openGroupById,
                    getRequestHeaders,
                    eventSource,
                    event_types,
                    getLastKnownCharacterLocations,
                    getMapPanelController: () => mapPanelController,
                    getPlayerName: () => getActivePersonaName(),
                    getCharacterDisplayName,
                    playSfx,
                    getSfx: () => sfx,
                    armBgmTransitionGuard,
                    onSceneChanged: () => {
                        // Invalidate the cached minimap signature so it
                        // rebuilds with the new occupant pins.
                        _minimapSig = null;
                        try { renderMinimap(); } catch (e) { console.warn("[Dangan][Overworld] minimap refresh failed:", e); }
                    },
                });
                window.dangan_overworld = overworldSceneController;
            } catch (e) {
                console.error("[Dangan][Overworld] Failed to initialize overworld controller:", e);
                overworldSceneController = { render: () => {}, randomizeLocations: () => {}, notifyPlayerMovedTo: () => {}, ensureCharacterLocations: () => {}, destroy: () => {} };
            }

            const initialRender = (tag) => {
                try { renderMoveToPanel(); }
                catch (e) { console.warn(`[Dangan][moveto-panel] render failed (${tag}):`, e); }
                try { renderMinimap(); }
                catch (e) { console.warn(`[Dangan][minimap] render failed (${tag}):`, e); }
                try { overworldSceneController?.render?.(); }
                catch (e) { console.warn(`[Dangan][overworld] render failed (${tag}):`, e); }
            };
            initialRender('init');
            // Fallback renders — Assistant / Narrator chats and slow-loading group
            // chats can fire CHAT_CHANGED before our handler is registered, OR
            // never fire CHAT_CHANGED at all on first load. Retry at staggered
            // intervals so one of them lands once the DOM is ready.
            setTimeout(() => initialRender('t200'),  200);
            setTimeout(() => initialRender('t600'),  600);
            setTimeout(() => initialRender('t1200'), 1200);
            setTimeout(() => initialRender('t2500'), 2500);
            setTimeout(() => initialRender('t5000'), 5000);
            const triggerInitialRender = () => initialRender('event');
            try { eventSource.on(event_types.APP_READY,             triggerInitialRender); } catch {}
            try { eventSource.on(event_types.CHAT_LOADED,           triggerInitialRender); } catch {}
            try { eventSource.on(event_types.CHARACTER_PAGE_LOADED, triggerInitialRender); } catch {}
            try { eventSource.on(event_types.MORE_MESSAGES_LOADED,  triggerInitialRender); } catch {}
        } catch (error) {
            console.error("[Dangan][Map] Failed to initialize map panel controller:", error);
            mapPanelController = {
                renderMapPanel: () => { },
                handleSettingsChanged: () => { },
            };
        }

        let lastHoverTime = 0;
        const HOVER_COOLDOWN = 80;

        function playHoverWithCooldown() {
            const now = Date.now();
            if (now - lastHoverTime < HOVER_COOLDOWN) return;
            lastHoverTime = now;
            if (!sfx.hover) return;
            const volume = Number(extension_settings[extensionName]?.monopadVolume ?? 50) / 100;
            if (volume <= 0) return;
            const instance = sfx.hover.cloneNode(true);
            instance.volume = volume;
            instance.play().catch(() => {});
        }

        let monopadSpamCount = 0;
        let monopadSpamTimer = null;
        let monokumaCooldown = false;
        let hasBootedThisSession = false;

        const MONOPAD_BOOT_COLD_DURATION_MS = 900;
        const MONOPAD_BOOT_WARM_DURATION_MS = 680;
        const MONOPAD_SHUTDOWN_DURATION_MS = 420;

        function triggerMonokuma() {
            if (monokumaCooldown) return;
            monokumaCooldown = true;

            const $mono = $("#monokuma-popup");
            playSfx(sfx.monokuma);
            $mono.addClass("show");

            setTimeout(() => $mono.removeClass("show"), 1800);
            setTimeout(() => (monokumaCooldown = false), 6000);
        }

        function closeMonopadPanel() {
            closeBreachOverlay();
            closePayloadOverlay();
            vnModeController?.setMonopadOpen?.(false);
            $panel.removeClass("open booting boot-cold boot-warm");
            document.body.classList.remove("dangan-monopad-open");

            if (getMonopadSetting("bootAnimations")) {
                $panel.addClass("shutting-down");
                playSfx(sfx.close);

                setTimeout(() => {
                    $panel.removeClass("shutting-down").addClass("closed");
                }, MONOPAD_SHUTDOWN_DURATION_MS);
            } else {
                playSfx(sfx.close);
                $panel.addClass("closed");
            }
            try { renderMoveToPanel(); renderMinimap(); overworldSceneController?.render?.(); } catch {}
        }

        $("#dangan_monopad_close").on("click", () => {
            closeMonopadPanel();
        });

$(".monopad-title").on("click", function () {
    playSfx(sfx.click);
    setActiveMonopadTab("welcome");
});

$(".monopad-icon").on("click", function () {
    playSfx(sfx.click);

    const tab = $(this).data("tab");
    setActiveMonopadTab(tab);

    hasSelectedMonopadTab = true;

if (tab === "truth" && window.renderTruthBullets) {
    window.renderTruthBullets();
}

    if (tab === "social") {
        socialPanelController?.renderSocialPanel();
    }

    if (tab === "skills") {
        itemsPanelController.renderSkillsItemsPanel();
    }

    if (tab === "map") {
        mapPanelController?.renderMapPanel();
    }

    if (tab === "chapters") {
        renderChaptersPanel();
    }
});

/*$(document).on("chatLoaded", () => {
    //console.log("[Dangan][Social] Chat loaded, registering characters");

    //waitForRealChat(() => {
        //registerCharactersFromContext();
        socialPanelController?.renderSocialPanel();
    });
});
*/

//*$(document).on("chatChanged", () => {
  //  console.log("[Dangan][Social] Chat changed, registering characters");

   // waitForRealChat(() => {
       // registerCharactersFromContext();
       // socialPanelController.renderSocialPanel();
    //});
//});

$(".monopad-icon").on("mouseenter", function () {
    playHoverWithCooldown();
});
        function togglePanel() {
            const isOpen = $panel.hasClass("open");
            $panel.removeClass("open closed booting boot-cold boot-warm");

            if (!isOpen) {
                vnModeController?.setMonopadOpen?.(true);
                const welcomeUserEl = document.getElementById("monopad_welcome_user");
                if (welcomeUserEl) {
                    welcomeUserEl.textContent = getActivePersonaName();
                }

                if (!hasSelectedMonopadTab) {
                    $(".monopad-icon").removeClass("active");
                    $(".monopad-panel-content").removeClass("active");
                    $(`.monopad-panel-content[data-panel="welcome"]`).addClass("active");
                } else {
                    setActiveMonopadTab("truth");
                    window.renderTruthBullets?.();
                }

                if (getMonopadSetting("bootAnimations")) {
                    const bootModeClass = hasBootedThisSession ? "boot-warm" : "boot-cold";
                    const bootDuration = hasBootedThisSession ? MONOPAD_BOOT_WARM_DURATION_MS : MONOPAD_BOOT_COLD_DURATION_MS;
                    $panel.addClass(`open booting ${bootModeClass}`);
                    setTimeout(() => $panel.removeClass("booting boot-cold boot-warm"), bootDuration);
                    hasBootedThisSession = true;
                } else {
                    $panel.addClass("open");
                    hasBootedThisSession = true;
                }
                document.body.classList.add("dangan-monopad-open");
                if (getMonopadSetting("monopadJingleEnabled") !== false) playSfx(sfx.open);
                try { renderMoveToPanel(); renderMinimap(); overworldSceneController?.render?.(); } catch {}
            } else {
                closeMonopadPanel();
            }

        }

        const handleMonopadToggle = () => {
            const suppressUntil = Number(monopadButtonEl?.dataset?.suppressMonopadClickUntil || "0");
            if (Date.now() < suppressUntil) return;

            unlockAudio();
            togglePanel();

            monopadSpamCount++;
            clearTimeout(monopadSpamTimer);
            monopadSpamTimer = setTimeout(() => (monopadSpamCount = 0), 700);

            if (monopadSpamCount >= 6) {
                monopadSpamCount = 0;
                triggerMonokuma();
            }
        };

        $button.on("click", handleMonopadToggle);

        $button.on("keydown", event => {
            if (event.key !== "Delete" && event.key !== "Del") return;
            event.preventDefault();
            handleMonopadToggle();
        });

        $("#dangan_open_monopad_from_settings").on("click", () => {
            unlockAudio();
            handleMonopadToggle();
        });

        $("#dangan_enable_monopad_button").on("change", function () {
            setMonopadSetting("monopadButtonEnabled", this.checked);
            applyMonopadLaunchControlState(monopadButtonEl, $panel.get(0));
        });


        $(".items-filter-button").on("click", function () {
            playSfx(sfx.click);
            itemsPanelController.setFilter(this.dataset.filter || "all");
            itemsPanelController.renderSkillsItemsPanel();
        });

        $('input[name="items-sort"]').on("change", function () {
            playSfx(sfx.click);
            itemsPanelController.setSort(this.value || "recent");
            itemsPanelController.renderSkillsItemsPanel();
        });

        $("#items-search-input").on("input", function () {
            itemsPanelController.setItemSearch(this.value);
            itemsPanelController.renderInventoryGrid();
        });

        $(document).on("mouseenter", ".items-filter-button, .items-slot, .items-sort-group label, .items-detail-action", function () {
            playHoverWithCooldown();
        });

        $(document).on("mouseenter", "#monopad-pass-time, #monopad-sleep, #dangan_monopad_close, .truth-item, .truth-archived-item, .truth-remove-button, .truth-reload-button, .truth-delete-button, .truth-image-delete-btn, .truth-image-upload-label, .truth-place-on-map-button, .truth-discard-confirm, .truth-discard-cancel", function () {
            if (!this.disabled) playHoverWithCooldown();
        });

        $(document).on("click", ".truth-item, .truth-archived-item, .truth-remove-button, .truth-reload-button, .truth-delete-button, .truth-image-delete-btn, .truth-image-upload-label, .truth-place-on-map-button, .truth-discard-confirm, .truth-discard-cancel", function () {
            playSfx(sfx.click);
        });

        const MAP_BUTTONS = [
            ".map-floor-button", ".map-add-area-button", ".map-add-floor-button",
            ".map-area-button", ".map-area-entry-rename", ".map-area-entry-delete",
            ".map-floor-entry-rename", ".map-floor-entry-delete",
            ".map-pins-type-btn", ".map-pins-icon-btn",
            ".map-pins-list-name", ".map-pins-list-lock", ".map-pins-list-edit", ".map-pins-list-delete",
            ".map-create-area-save", ".map-create-area-cancel", ".map-create-area-upload-label",
            ".map-machine-close", ".map-machine-button",
            ".map-pin-edit-save", ".map-pin-edit-cancel",
            ".map-zoom-btn",
        ].join(", ");

        $(document).on("mouseenter", MAP_BUTTONS, function () {
            if (!this.disabled) playHoverWithCooldown();
        });

        $(document).on("click", MAP_BUTTONS, function () {
            playSfx(sfx.click);
        });

        const SOCIAL_BUTTONS = [
            ".social-char-card",
            ".social-sort-btn", ".social-filter-btn", ".social-overlay-toggle",
            ".social-list-header",
            ".social-list-item", ".social-name", ".social-delete",
            ".report-dead-btn", ".report-missing-btn", ".report-mastermind-btn",
        ].join(", ");

        $(document).on("mouseenter", SOCIAL_BUTTONS, function () {
            if (!this.disabled) playHoverWithCooldown();
        });

        $(document).on("click", SOCIAL_BUTTONS, function () {
            playSfx(sfx.click);
        });

        $(document).on("mouseenter", "#trust-debug-controls button", function () {
            playHoverWithCooldown();
            this.style.setProperty("background", "rgba(173, 205, 255, 0.12)", "important");
            this.style.setProperty("border-color", "rgba(173, 205, 255, 0.5)", "important");
            this.style.setProperty("color", "#c8dfff", "important");
        }).on("mouseleave", "#trust-debug-controls button", function () {
            this.style.removeProperty("background");
            this.style.removeProperty("border-color");
            this.style.removeProperty("color");
        });

        $(document).on("mouseenter", ".truth-image-upload-label", function () {
            this.style.background = "rgba(255, 210, 60, 0.15)";
            this.style.borderColor = "rgba(255, 210, 60, 0.9)";
            this.style.color = "#ffe566";
        }).on("mouseleave", ".truth-image-upload-label", function () {
            this.style.background = "transparent";
            this.style.borderColor = "rgba(255, 210, 60, 0.6)";
            this.style.color = "#ffd43c";
        });

        $(document).on("mouseenter", ".truth-image-delete-btn", function () {
            this.style.background = "rgba(255, 60, 60, 0.15)";
            this.style.borderColor = "rgba(255, 60, 60, 0.9)";
            this.style.color = "#ffffff";
        }).on("mouseleave", ".truth-image-delete-btn", function () {
            this.style.background = "transparent";
            this.style.borderColor = "rgba(255, 60, 60, 0.6)";
            this.style.color = "#ff4a4a";
        });

        $("#dangan_monokuma_lesson_button").on("click", async () => {
            playSfx(sfx.click);
            await startMonokumaLesson();
        });

        $("#monopad-pass-time").on("click", async () => {
            playSfx(sfx.click);
            await passTimeToNight({ source: "monopad_button" });
        });

        $("#monopad-sleep").on("click", async () => {
            playSfx(sfx.click);
            await sleepToNextDay({ source: "monopad_button" });
        });

        $(".settings-toggle").on("click", function () {
            const key = this.dataset.setting;
            if (!key) return;

            const next = !getMonopadSetting(key);
            setMonopadSetting(key, next);
            applySettingsTabUI();
            if (key === "vnModeEnabled" && next) {
                trySetSillyTavernVisualNovelMode(true);
            }
            if (key === "dynamicThemes") {
                applyDynamicTheme();
            }
            if (key === "hideTruthBulletImages" || key === "hideGiftImages" || key === "hideHopesPeakBranding") {
                applyImageVisibilitySettings();
                if (key === "hideHopesPeakBranding") {
                    // The Game Master / voting-asset pickers only show under
                    // #dangan-branding-extras when branding is hidden — re-show
                    // branding ⇒ revert their modes to default so a stale
                    // "custom" pick can't keep driving GM sprites/voice or the
                    // voting wheel/coins while the user can't see/change it.
                    if (!next) {
                        setMonopadSetting('gameMasterMode', 'default');
                        setMonopadSetting('customVoteFaceMode', 'default');
                        setMonopadSetting('customCoinMode', 'default');
                    }
                    applyGameMasterUI();
                    applyVoteFaceUI();
                    applyVoteCoinUI();
                }
            }
            if (key === "halfspriteMode") {
                applyHalfSpriteMode();
            }
            mapPanelController?.handleSettingsChanged?.();
        });

        // Announcement customisation mode buttons (DEFAULT / CUSTOM toggles)
        $(document).on("click", "[data-announ-type][data-announ-field][data-announ-value]", function () {
            const type  = this.dataset.announType;
            const field = this.dataset.announField;
            const value = this.dataset.announValue;
            if (!type || !field || !value) return;

            // Update active state on sibling buttons
            document.querySelectorAll(`[data-announ-type="${type}"][data-announ-field="${field}"]`).forEach(btn => {
                btn.classList.toggle('active', btn.dataset.announValue === value);
            });

            // Show/hide the custom input row
            const row = document.getElementById(`dangan-announ-row-${field}-${type}`);
            if (row) row.classList.toggle('is-hidden', value !== 'custom');

            setMonopadSetting(`announcementMode_${field}_${type}`, value);
            saveSettingsDebounced();
        });

        // Announcement customisation file picker buttons
        $(document).on("click", "[id^='dangan-pick-image-'],[id^='dangan-pick-voice-']", function () {
            const isImage = this.id.startsWith('dangan-pick-image-');
            const type = this.id.replace(isImage ? 'dangan-pick-image-' : 'dangan-pick-voice-', '');
            const fileInput = document.getElementById(`dangan-file-${isImage ? 'image' : 'voice'}-${type}`);
            fileInput?.click();
        });

        // Announcement customisation file input change — read as data URL
        $(document).on("change", "[id^='dangan-file-image-'],[id^='dangan-file-voice-']", function () {
            const isImage = this.id.startsWith('dangan-file-image-');
            const type = this.id.replace(isImage ? 'dangan-file-image-' : 'dangan-file-voice-', '');
            const field = isImage ? 'image' : 'voice';
            const file = this.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                setMonopadSetting(`announcementData_${field}_${type}`, e.target.result);
                const nameEl = document.getElementById(`dangan-file-name-${field}-${type}`);
                if (nameEl) nameEl.textContent = file.name;
                saveSettingsDebounced();
            };
            reader.readAsDataURL(file);
        });

        // Class Trial podium (lectern) mode toggle
        $(document).on("click", "[data-lectern-value]", function () {
            const value = String(this.dataset.lecternValue || 'default');
            document.querySelectorAll('[data-lectern-value]').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.lecternValue === value);
            });
            const row = document.getElementById('dangan-lectern-custom-row');
            if (row) row.classList.toggle('is-hidden', value !== 'custom');
            setMonopadSetting('customLecternMode', value);
            saveSettingsDebounced();
        });

        // Game Master mode toggle (default Monokuma vs custom character)
        $(document).on("click", "[data-gm-value]", function () {
            const value = String(this.dataset.gmValue || 'default');
            setMonopadSetting('gameMasterMode', value);
            saveSettingsDebounced();
            applyGameMasterUI();
        });

        // Game Master character pick
        $(document).on("change", "#dangan-gm-character", function () {
            const value = String(this.value || '').trim();
            setMonopadSetting('gameMasterCharacter', value);
            saveSettingsDebounced();
        });

        // Class Trial podium (lectern) file picker
        $(document).on("click", "#dangan-lectern-pick", () => {
            document.getElementById('dangan-lectern-file')?.click();
        });

        $(document).on("change", "#dangan-lectern-file", function () {
            const file = this.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                setMonopadSetting('customLecternData', e.target.result);
                const nameEl = document.getElementById('dangan-lectern-file-name');
                if (nameEl) nameEl.textContent = file.name;
                saveSettingsDebounced();
            };
            reader.readAsDataURL(file);
        });

        // Voting wheel face — mode toggle (GENERIC / CUSTOM)
        $(document).on("click", "[data-voteface-value]", function () {
            const value = String(this.getAttribute('data-voteface-value') || 'default');
            setMonopadSetting('customVoteFaceMode', value);
            applyVoteFaceUI();
            saveSettingsDebounced();
        });
        $(document).on("click", "#dangan-voteface-pick", () => {
            document.getElementById('dangan-voteface-file')?.click();
        });
        $(document).on("change", "#dangan-voteface-file", function () {
            const file = this.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                setMonopadSetting('customVoteFaceData', e.target.result);
                const nameEl = document.getElementById('dangan-voteface-file-name');
                if (nameEl) nameEl.textContent = file.name;
                saveSettingsDebounced();
            };
            reader.readAsDataURL(file);
        });

        // Voting coins — mode toggle (GENERIC / CUSTOM)
        $(document).on("click", "[data-votecoin-value]", function () {
            const value = String(this.getAttribute('data-votecoin-value') || 'default');
            setMonopadSetting('customCoinMode', value);
            applyVoteCoinUI();
            saveSettingsDebounced();
        });
        $(document).on("click", "#dangan-votecoin-pick", () => {
            document.getElementById('dangan-votecoin-file')?.click();
        });
        $(document).on("change", "#dangan-votecoin-file", function () {
            const file = this.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                setMonopadSetting('customCoinData', e.target.result);
                const nameEl = document.getElementById('dangan-votecoin-file-name');
                if (nameEl) nameEl.textContent = file.name;
                saveSettingsDebounced();
            };
            reader.readAsDataURL(file);
        });

        // Announcement customisation text area
        $(document).on("input", "[id^='dangan-text-']", function () {
            const type = this.id.replace('dangan-text-', '');
            if (!ANNOUN_TYPES.includes(type)) return;
            setMonopadSetting(`announcementData_text_${type}`, this.value);
            saveSettingsDebounced();
        });

        $("#dangan_crt_slider").on("input", e => {
            const value = Number(e.target.value);
            setMonopadSetting("crtIntensity", Number.isFinite(value) ? value : 35);
            applyCrtSettings();
        });

        $("#dangan_sounds_slider").on("input", e => {
            const value = Number(e.target.value);
            const vol = Number.isFinite(value) ? value : 50;
            setMonopadSetting("monopadVolume", vol);
            const soundsValue = document.getElementById("dangan_sounds_value");
            if (soundsValue) soundsValue.textContent = `${vol}%`;
        });

        $("#dangan_announcement_slider").on("input", e => {
            const value = Number(e.target.value);
            const vol = Number.isFinite(value) ? value : 65;
            setMonopadSetting("announcementVolume", vol);
            const announcementValue = document.getElementById("dangan_announcement_value");
            if (announcementValue) announcementValue.textContent = `${vol}%`;
        });

        $("#dangan_monomono_slider").on("input", e => {
            const value = Number(e.target.value);
            const vol = Number.isFinite(value) ? value : 40;
            setMonopadSetting("monomonoBgmVolume", vol);
            const monomonoValue = document.getElementById("dangan_monomono_value");
            if (monomonoValue) monomonoValue.textContent = `${vol}%`;
            if (shopTrackAudio) shopTrackAudio.volume = vol / 100;
        });

        $(document).on("click", ".settings-lang-btn[data-lang]", function () {
            const lang = String(this.dataset.lang || "EN");
            setMonopadSetting("monokumaLanguage", lang);
            $(".settings-lang-btn[data-lang]").removeClass("active");
            $(`.settings-lang-btn[data-lang="${lang}"]`).addClass("active");
        });

        $(document).on("change", ".bgm-track-select-all-checkbox", function () {
            const settingKey = String($(this).data("setting") || "");
            const listId = String($(this).data("list") || "");
            const selectedId = String($(this).data("selected") || "");
            if (!settingKey || !listId) return;
            const $list = $(`#${listId}`);
            const allPaths = $list.find(".bgm-track-checkbox").map(function () {
                return String($(this).data("path") || "");
            }).get().filter(Boolean);
            if (this.checked) {
                setMonopadSetting(settingKey, allPaths);
                $list.find(".bgm-track-checkbox").prop("checked", true);
            } else {
                setMonopadSetting(settingKey, []);
                $list.find(".bgm-track-checkbox").prop("checked", false);
            }
            renderSelectedTracksForTab(settingKey, selectedId);
        });

        $(document).on("change", ".bgm-track-checkbox", function () {
            const path = String($(this).data("path") || "");
            const settingKey = String($(this).data("setting") || "");
            const listId = String($(this).data("list") || "");
            const selectedId = String($(this).data("selected") || "");
            if (!path || !settingKey) return;
            const tracks = new Set(getMonopadSetting(settingKey) || []);
            if (this.checked) tracks.add(path);
            else tracks.delete(path);
            setMonopadSetting(settingKey, [...tracks]);
            // Sync select-all state
            const $list = $(`#${listId}`);
            const total = $list.find(".bgm-track-checkbox").length;
            const checked = $list.find(".bgm-track-checkbox:checked").length;
            $list.find(".bgm-track-select-all-checkbox").prop("checked", total > 0 && checked === total);
            renderSelectedTracksForTab(settingKey, selectedId);
        });

        $(document).on("click", ".bgm-tracks-tab", function () {
            const tabKey = String(this.dataset.tab || "");
            $(".bgm-tracks-tab").removeClass("active");
            $(".bgm-tracks-panel").removeClass("active");
            $(`.bgm-tracks-tab[data-tab="${tabKey}"]`).addClass("active");
            $(`.bgm-tracks-panel[data-tab="${tabKey}"]`).addClass("active");
        });

        $(document).on("click", ".bgm-tracks-subtab", function () {
            const subtabKey = String(this.dataset.subtab || "");
            const $trial = $(this).closest(".bgm-tracks-panel");
            $trial.find(".bgm-tracks-subtab").removeClass("active");
            $trial.find(".bgm-tracks-subpanel").removeClass("active");
            $trial.find(`.bgm-tracks-subtab[data-subtab="${subtabKey}"]`).addClass("active");
            $trial.find(`.bgm-tracks-subpanel[data-subtab="${subtabKey}"]`).addClass("active");
        });

        $(document).on("click", ".bgm-track-play-btn", function (e) {
            e.preventDefault();
            e.stopPropagation();
            const path = String($(this).data("path") || "");
            if (!path) return;

            const isPlaying = $(this).hasClass("playing");

            if (isPlaying) {
                const bgm = document.getElementById("audio_bgm");
                if (bgm instanceof HTMLAudioElement) bgm.pause();
                $(this).removeClass("playing");
            } else {
                const $bgmSelect = $("#audio_bgm_select");
                if ($bgmSelect.length) {
                    if (!$bgmSelect.find(`option[value="${path}"]`).length) {
                        const name = path.split("/").pop().replace(/\.[^/.]+$/, "");
                        $bgmSelect.append(new Option(`asset: ${name}`, path));
                    }
                    $bgmSelect.val(path).trigger("change");
                }
                $(".bgm-track-play-btn").removeClass("playing");
                $(this).addClass("playing");
            }
        });

        renderAllBgmTrackTabs();

        $("#dangan_generation_provider").on("change", function () {
            setMonopadSetting("generationProvider", this.value || defaultSettings.generationProvider);
            applySettingsTabUI();
            mapPanelController?.handleSettingsChanged?.();
        });

        $("#dangan_white_noise_line_source").on("change", function () {
            const nextSource = String(this.value || "").trim();
            const normalizedSource = ["default", "main", "openrouter"].includes(nextSource)
                ? nextSource
                : defaultSettings.whiteNoiseLineSource;
            setMonopadSetting("whiteNoiseLineSource", normalizedSource);
            applySettingsTabUI();
            mapPanelController?.handleSettingsChanged?.();
        });

        $("#dangan_nsd_line_source").on("change", function () {
            const nextSource = String(this.value || "").trim();
            const normalizedSource = ["main", "openrouter"].includes(nextSource)
                ? nextSource
                : defaultSettings.nsdLineSource;
            setMonopadSetting("nsdLineSource", normalizedSource);
            applySettingsTabUI();
            mapPanelController?.handleSettingsChanged?.();
        });

        $("#dangan_mpd_line_source").on("change", function () {
            const nextSource = String(this.value || "").trim();
            const normalizedSource = ["main", "openrouter"].includes(nextSource)
                ? nextSource
                : defaultSettings.mpdLineSource;
            setMonopadSetting("mpdLineSource", normalizedSource);
            applySettingsTabUI();
            mapPanelController?.handleSettingsChanged?.();
        });

        $("#dangan_qtime_use_recent_context").on("change", function () {
            setMonopadSetting("questionTimeUseRecentContext", this.checked);
        });

        $("#dangan_qtime_use_debate_history").on("change", function () {
            setMonopadSetting("questionTimeUseDebateHistory", this.checked);
        });

        $("#dangan_qtruth_use_recent_context").on("change", function () {
            setMonopadSetting("questionTruthUseRecentContext", this.checked);
        });

        $("#dangan_qtruth_use_debate_history").on("change", function () {
            setMonopadSetting("questionTruthUseDebateHistory", this.checked);
        });

        $("#dangan_hangman_use_recent_context").on("change", function () {
            setMonopadSetting("hangmansGambitUseRecentContext", this.checked);
        });

        $("#dangan_hangman_use_debate_history").on("change", function () {
            setMonopadSetting("hangmansGambitUseDebateHistory", this.checked);
        });

        $(document).on("input change blur", ".settings-prompt-textarea", function () {
            const settingKey = this.dataset.setting;
            const templateKey = this.dataset.templateKey;
            if (!settingKey || !templateKey) return;
            const fallbackTemplate = DEFAULT_TRIAL_PROMPT_TEMPLATES[templateKey] || "";
            setMonopadSetting(settingKey, this.value === fallbackTemplate ? "" : this.value);
        });

        $(document).on("click", ".settings-prompt-reset", function () {
            const settingKey = this.dataset.setting;
            const templateKey = this.dataset.templateKey;
            if (!settingKey || !templateKey) return;
            setMonopadSetting(settingKey, "");
            const textarea = document.querySelector(`.settings-prompt-textarea[data-setting="${settingKey}"]`);
            if (textarea instanceof HTMLTextAreaElement) {
                textarea.value = DEFAULT_TRIAL_PROMPT_TEMPLATES[templateKey] || "";
            }
        });

        $("#dangan_reward_difficulty").on("change", function () {
            const nextDifficulty = applyRewardDifficultyProfile(this.value || defaultSettings.rewardDifficulty);
            setMonopadSetting("rewardDifficulty", nextDifficulty);
            applySettingsTabUI();
        });

        $("#dangan_openrouter_model").on("change blur", function () {
            const nextModel = String(this.value || "").trim() || defaultSettings.openrouterModel;
            this.value = nextModel;
            setMonopadSetting("openrouterModel", nextModel);
        });

        $("#dangan_openrouter_key").on("change blur", function () {
            setRuntimeOpenRouterApiKey(this.value);
            persistOpenRouterApiKeyIfAllowed();
            applySettingsTabUI();
            mapPanelController?.handleSettingsChanged?.();
        });

        $("#dangan_openrouter_remember_key").on("change", function () {
            setMonopadSetting("openrouterRememberApiKey", this.checked);
            persistOpenRouterApiKeyIfAllowed();
            applySettingsTabUI();
            mapPanelController?.handleSettingsChanged?.();
        });

        $("#dangan_openrouter_key_clear").on("click", function () {
            setRuntimeOpenRouterApiKey("");
            persistOpenRouterApiKeyIfAllowed();
            applySettingsTabUI();
            mapPanelController?.handleSettingsChanged?.();
        });

        $("#dangan_openrouter_test_connection").on("click", async function () {
            const statusEl = document.getElementById("dangan_openrouter_connection_status");
            if (statusEl) {
                statusEl.dataset.locked = "true";
                statusEl.textContent = "Testing OpenRouter connection...";
            }

            try {
                await testOpenRouterConnection();
                if (statusEl) statusEl.textContent = "OpenRouter connection OK.";
            } catch (err) {
                if (statusEl) statusEl.textContent = `OpenRouter test failed: ${err.message || err}`;
            } finally {
                if (statusEl) {
                    setTimeout(() => {
                        statusEl.dataset.locked = "";
                    }, 250);
                }
            }
        });


        $("#dangan_reset_progression").on("click", async function () {
            const statusEl = document.getElementById("dangan_reset_progression_status");
            const confirmed = await openMonopadConfirmDialog({
                title: "RESET PROGRESSION",
                message: "Reset Level and Skill Points? This sets you to LV 1, 0 XP, and 10 Skill Points.",
                confirmLabel: "RESET",
                cancelLabel: "CANCEL",
            });

            if (!confirmed) {
                if (statusEl) statusEl.textContent = "Reset cancelled.";
                return;
            }

            rewards?.resetProgression?.({ clearEquippedSkills: true });
            if (statusEl) statusEl.textContent = "Progression reset to LV 1.";
        });

        $("#dangan_reset_day_counter").on("click", async function () {
            const statusEl = document.getElementById("dangan_reset_day_counter_status");
            const confirmed = await openMonopadConfirmDialog({
                title: "RESET DAY COUNTER",
                message: "Reset time tracker to DAY 1 / DAYTIME?",
                confirmLabel: "RESET",
                cancelLabel: "CANCEL",
            });

            if (!confirmed) {
                if (statusEl) statusEl.textContent = "Reset cancelled.";
                return;
            }

            resetDayCounter({ source: "settings_reset" });
            if (statusEl) statusEl.textContent = "Time tracker reset to DAY 1.";
        });

        $("#dangan_reset_chapter").on("click", async function () {
            const statusEl = document.getElementById("dangan_reset_chapter_status");
            const confirmed = await openMonopadConfirmDialog({
                title: "RESET CHAPTER",
                message: "Reset the chapter indicator back to PROLOGUE?",
                confirmLabel: "RESET",
                cancelLabel: "CANCEL",
            });
            if (!confirmed) {
                if (statusEl) statusEl.textContent = "Reset cancelled.";
                return;
            }
            setMonopadSetting('chapterIndex', 0);
            saveSettingsDebounced();
            updateChapterDisplay();
            if (statusEl) statusEl.textContent = "Chapter reset to PROLOGUE.";
        });

        $("#dangan_reset_introductions").on("click", async function () {
            const statusEl = document.getElementById("dangan_reset_introductions_status");
            const confirmed = await openMonopadConfirmDialog({
                title: "RESET INTRODUCTIONS",
                message: "Mask every character as ??? again? You'll need to re-run /introduce on each one.",
                confirmLabel: "RESET",
                cancelLabel: "CANCEL",
            });
            if (!confirmed) {
                if (statusEl) statusEl.textContent = "Reset cancelled.";
                return;
            }
            // Wipe the persisted introduction map and refresh the surfaces
            // that render character names so they flip back to ??? immediately.
            const root = extension_settings[extensionName] ??= {};
            root.introducedCharacters = {};
            saveSettingsDebounced();
            try { overworldSceneController?.render?.(); } catch (_) {}
            try { _minimapSig = null; renderMinimap(); } catch (_) {}
            if (statusEl) statusEl.textContent = "All characters reset to ???.";
        });

        $("#dangan_clear_trial_context").on("click", async function () {
            const statusEl = document.getElementById("dangan_clear_trial_context_status");
            const confirmed = await openMonopadConfirmDialog({
                title: "CLEAR CLASS TRIAL CONTEXT",
                message: "Clear this chat's trial debate history, topic, goal, and suspects? An in-progress trial keeps running, but the AI starts from a clean slate.",
                confirmLabel: "CLEAR",
                cancelLabel: "CANCEL",
            });
            if (!confirmed) {
                if (statusEl) statusEl.textContent = "Clear cancelled.";
                return;
            }
            const hadContext = trialManager?.clearTrialContext?.();
            if (statusEl) statusEl.textContent = hadContext === false
                ? "No trial context to clear."
                : "Trial context cleared.";
        });

loadSettings();
ensureTimeTrackerState();
renderTimeTrackerUi();
applyTimeContextToGeneration();
const initialRewardDifficulty = applyRewardDifficultyProfile(getMonopadSetting("rewardDifficulty") || defaultSettings.rewardDifficulty);
if (initialRewardDifficulty !== getMonopadSetting("rewardDifficulty")) {
    setMonopadSetting("rewardDifficulty", initialRewardDifficulty);
}
ensureGlobalDebugUi();
classTrialMenuController = createClassTrialMenuController({
    extensionName,
    extensionSettings: extension_settings,
    buildExtensionPathCandidates,
    getTrialSkillEntries: () => itemsPanelController?.getTrialSkillEntries?.() || { skillPoints: 0, skills: [] },
    toggleTrialSkillEquip: (skillId) => itemsPanelController?.toggleTrialSkillEquip?.(skillId) || { changed: false },
    playSfx,
    getSfx: () => sfx,
    onOpen: () => fadeOutAndPauseBgm(),
    onClose: () => fadeInAndResumeBgm(),
    getPreparationTracks: () => getMonopadSetting("trialPreparationTracks") || [],
});
window.startClassTrial = async () => {
    return triggerTrialStartFromMapPin();
};

/**
 * Update the Trial Context panel with the current topic, goal, and top suspects.
 * @param {string} topic    - What is currently being discussed (e.g. "Discussing the Blackout")
 * @param {string} goal     - The trial's overarching goal (e.g. "Who killed Byakuya?")
 * @param {Array<{name:string,chance:number}>} suspects - Up to 3 suspects with % likelihood
 */
window.setTrialContext = (topic, goal, suspects) => {
    trialManager?.setTrialContext?.(topic, goal, suspects);
};

audioVisualizer = createAudioVisualizerController({
    getAudioElement: () => {
        if (investigationTrackAudio) return investigationTrackAudio;
        const bgm = document.getElementById('audio_bgm');
        return bgm instanceof HTMLAudioElement ? bgm : null;
    },
    assetsBasePath: extensionFolderPath,
    getGameState: () => ({
        isInvestigation: investigationUnderway,
        isNight: ensureTimeTrackerState().phase === TIME_PHASE_NIGHT,
    }),
    onPrev:          () => bgmPlayPrev(),
    onTogglePause:   () => bgmTogglePause(),
    onNext:          () => bgmPlayNext(),
    onShuffle:       () => bgmPlayShuffle(),
    getPlayMode:     () => bgmPlayMode,
    onSetPlayMode:   (mode) => {
        bgmPlayMode = mode;
        // Immediately sync loop attribute on whichever element is currently playing
        const isLoop = mode === 'loop';
        const dynEl = document.getElementById('audio_bgm');
        if (dynEl instanceof HTMLAudioElement) dynEl.loop = isLoop;
        if (investigationTrackAudio) investigationTrackAudio.loop = isLoop;
    },
    getIsPaused: () => {
        const audioEl = document.getElementById('audio_bgm');
        if (audioEl instanceof HTMLAudioElement) return audioEl.paused;
        return investigationTrackAudio?.paused ?? true;
    },
    getPlaylistLabel: () => {
        const key = bgmCurrentSettingKey;
        if (!key) return '';
        const label  = BGM_PLAYLIST_LABELS[key]  ?? '';
        const parent = BGM_PLAYLIST_PARENTS[key] ?? '';
        return parent ? `${parent} - ${label}` : label;
    },
});
audioVisualizer.init();

// Immediately suppress the visualizer if we're in the Assistant chat with the setting off.
if (!getMonopadSetting('bgmOutsideChats') && !isInCharacterChat()) {
    audioVisualizer.suppress();
}

// BGM is allowed to play through chat transitions, so we no longer intercept
// `play` events on #audio_bgm / investigationTrackAudio to enforce the
// "in-chat only" rule. The setting still gates the initial autostart below
// and the CHAT_CHANGED autostart, which is enough to keep a fresh session
// silent until the user enters a chat — but once BGM is going, nothing here
// will yank it during a fade-to-black.
setTimeout(() => audioVisualizer.unsuppress(), 1000);

// Auto-start BGM for the current phase on load (character/group chats only).
setTimeout(() => {
    if (!getMonopadSetting('bgmOutsideChats') && !isInCharacterChat()) return;
    if (investigationTrackAudio && !investigationTrackAudio.paused) return; // already playing
    playPhaseTrack();
}, 2000);

// Move-to panel polling — CHAT_CHANGED doesn't fire when entering/leaving the
// Assistant chat, and renderMoveToPanel is idempotent (it re-uses the existing
// DOM node when present).
setInterval(() => {
    try { renderMoveToPanel(); renderMinimap(); } catch {}
}, 2000);

rewards?.renderProgressionUi?.();
updateChapterDisplay();
itemsPanelController.loadInventoryState();
applySettingsTabUI();
applyImageVisibilitySettings();
applyHalfSpriteMode();
applyMonopadLaunchControlState(monopadButtonEl, $panel.get(0));

// Persistent guard against Dynamic Audio playing alongside our BGM. Dangan
// triggers DA's $bgmSelect change in playBgmPath() and does a one-shot 400ms
// pause on #audio_bgm, but if DA's <audio> is still loading at the 400ms
// mark the pause is a no-op and DA starts playing AFTER we've silenced it.
// Polling restarts or chat-change re-fires can also re-trigger DA at any
// time. Attach a `play` listener once and pause DA immediately whenever
// dangan has a track loaded (regardless of whether dangan itself is paused
// or playing — dangan is the authoritative source while it owns a track).
(function attachDaBgmGuard() {
    const tryAttach = () => {
        const daEl = document.getElementById('audio_bgm');
        if (!(daEl instanceof HTMLAudioElement)) return false;
        if (daEl._danganGuarded) return true;
        daEl._danganGuarded = true;
        const guard = () => {
            if (investigationTrackAudio && !daEl.paused) daEl.pause();
        };
        daEl.addEventListener('play', guard);
        // Belt-and-braces: also catch the case where DA was already mid-play
        // when this binding ran (no future `play` event for that session).
        guard();
        return true;
    };
    if (!tryAttach()) {
        // DA's #audio_bgm element is built lazily — poll for it briefly.
        let elapsed = 0;
        const STEP = 250;
        const DURATION = 15000;
        const tick = () => {
            if (tryAttach()) return;
            elapsed += STEP;
            if (elapsed < DURATION) setTimeout(tick, STEP);
        };
        setTimeout(tick, STEP);
    }
})();

// While the Dangan GCP stage is active, suppress ST's expressions module from
// running its `updateVisualNovelModeDebounced` on every resize. That handler
// re-classifies (via /api/extra/classify) every group member's last message
// — N characters × M resize events = O(N·M) classifier hits, even though
// dangan's GCP stage has already replaced ST's VN sprite display so the
// updates produce no visible effect. ST gates the update on
// isVisualNovelMode() → `power_user.waifuMode && groupId`, so flipping
// waifuMode off while GCP is active is the cheapest no-side-effects bypass.
// We snapshot/restore the original value rather than mutating the persisted
// setting so the user's preference is intact when GCP tears down.
(function setupGcpVnSuppression() {
    let _waifuModeSnapshot = null;
    const apply = () => {
        const gcpActive = document.body.classList.contains('dangan-gcp-active');
        if (gcpActive && _waifuModeSnapshot === null) {
            _waifuModeSnapshot = power_user.waifuMode;
            power_user.waifuMode = false;
        } else if (!gcpActive && _waifuModeSnapshot !== null) {
            power_user.waifuMode = _waifuModeSnapshot;
            _waifuModeSnapshot = null;
        }
    };
    // Sync once in case the class was already set before this code ran.
    apply();
    new MutationObserver(apply).observe(document.body, {
        attributes: true,
        attributeFilter: ['class'],
    });
})();

loadCharacters();
itemsPanelController.renderSkillsItemsPanel();


// 🔴 FORCE REGISTER FROM EXISTING CHAT
//waitForRealChat(() => {
    //registerCharactersFromContext();
    //socialPanelController.renderSocialPanel();
//});

debugSTGlobals();
        
    initTruthBullets({
        extension_settings,
        saveSettingsDebounced,
        sfx,
        characters,
        normalizeName,
        registerCharacterFromMessage,
        increaseTrust: increaseTrustWithRewards,
        decreaseTrust,
        startV3CObserver,
        awardMonocoins,
        awardXp,
        monocoinRewards: MONOCOIN_REWARDS,
        xpRewards: XP_REWARDS,
        playSfx,
        extensionName,
        getSetting: getMonopadSetting,
        navigateToMapPin: (locationId) => {
            setActiveMonopadTab("map");
            mapPanelController?.highlightPinByLocationId?.(locationId);
        },
        hasMapPin: (locationId) => mapPanelController?.hasPinForLocationId?.(locationId) ?? false,
        placeOnMap: (label, locationId) => {
            setActiveMonopadTab("map");
            mapPanelController?.openPinCreatorWithPrefill?.(label, locationId);
        },
        removePin: (locationId) => mapPanelController?.removePinByLocationId?.(locationId),
        setPinHidden: (locationId, hidden) => mapPanelController?.setPinHidden?.(locationId, hidden),
    });

    vfxCleanup = initVfxSystem();
    initEmotionFontsSystem();
    setExpressionTarget(() => trialManager?.getGcpSpeakerImg?.() ?? document.getElementById('expression-image'));
    setEmotionBiasResolver(rollBiasedEmotion);

    function promptForBlackened(suggested = '') {
        return new Promise(resolve => {
            const modal = document.createElement('div');
            modal.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.88);display:flex;align-items:center;justify-content:center;font-family:"Orbitron","Arial Black",sans-serif;';
            const val = JSON.stringify(suggested);
            modal.innerHTML = `
                <div style="background:#0d0808;border:2px solid #cc1100;box-shadow:0 0 32px rgba(200,0,0,0.4);padding:32px 40px;max-width:420px;width:90%;text-align:center;">
                    <div style="color:#ff4444;font-size:1em;font-weight:900;letter-spacing:3px;margin-bottom:20px;text-transform:uppercase;text-shadow:0 0 10px #ff2200;">Who, truthfully, is the Blackened?</div>
                    <div style="color:#ababab;font-size:0.75em;font-weight:900;letter-spacing:3px;margin-bottom:20px;text-transform:uppercase;text-shadow:0 0 10px #8c8c8c;">This will dictate the 'correct' result.</div>

                    <input id="vt-bl-input" type="text" value=${val}
                        style="width:100%;background:#111;border:1px solid #662200;color:#fff;padding:9px 14px;font-size:1em;font-family:inherit;margin-bottom:18px;box-sizing:border-box;outline:none;"
                        placeholder="Enter suspect name…">
                    <button id="vt-bl-confirm"
                        style="background:#cc1100;color:#fff;border:none;padding:10px 32px;font-family:inherit;font-weight:900;font-size:0.9em;letter-spacing:2px;cursor:pointer;text-transform:uppercase;box-shadow:0 0 12px rgba(200,0,0,0.5);">
                        CONFIRM
                    </button>
                </div>`;
            document.body.appendChild(modal);
            const input = modal.querySelector('#vt-bl-input');
            const btn   = modal.querySelector('#vt-bl-confirm');
            input.select();
            input.focus();
            const confirm = () => { const v = input.value.trim(); modal.remove(); resolve(v || null); };
            btn.addEventListener('click', confirm);
            input.addEventListener('keydown', e => { if (e.key === 'Enter') confirm(); });
        });
    }

    function updateSuspectsFromChat() {
        if (!trialManager) return;
        const ctx  = window.SillyTavern?.getContext?.();
        const chat = ctx?.chat;
        if (!Array.isArray(chat)) return;

        const livingNames = [...characters.values()]
            .filter(c => !c.dead && !c.missing)
            .map(c => c.name);
        if (livingNames.length < 2) return;

        const recent = chat.slice(-30).filter(m => !m.is_system && m.mes);
        if (recent.length === 0) return;

        // Score each character by weighted mention count, skipping self-mentions
        const scores = Object.fromEntries(livingNames.map(n => [n, 0]));
        recent.forEach((msg, i) => {
            const weight  = (i + 1) / recent.length; // newer = closer to 1
            const text    = String(msg.mes  || '').toLowerCase();
            const speaker = String(msg.name || '').toLowerCase();
            for (const name of livingNames) {
                if (speaker === name.toLowerCase()) continue;
                const token = name.split(' ')[0].toLowerCase();
                const hits  = (text.match(new RegExp(`\\b${token}\\b`, 'g')) ?? []).length;
                scores[name] += hits * weight;
            }
        });

        const total = Object.values(scores).reduce((a, b) => a + b, 0);
        if (total < 0.5) return;

        const suspects = Object.entries(scores)
            .filter(([, v]) => v > 0)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([name, score]) => ({ name, chance: Math.round(score / total * 100) }));

        if (suspects.length > 0) trialManager.setTrialContext(undefined, undefined, suspects);
    }

    try {
        trialManager = createTrialManager({
            extensionName,
            extensionSettings: extension_settings,
            extensionFolderPath,
            saveSettingsDebounced,
            getLecternUrl,
            getCustomGameMasterName,
            getCharacterDisplayName,
            deductMonocoins,
            vnModeController,
            getTruthBullets,
            generateTrialDialogue,
            generateTrialDialogueWithMainApi,
            generateTrialDialogueWithOpenRouter,
            getCharacterSourceText,
            getEmotionFont,
            onTrialStateChange: () => { renderMoveToPanel(); renderMinimap(); overworldSceneController?.render?.(); },
            // Inject the chat-aware resolver so the trial / GCP stage prefers
            // -half variants when half-sprite mode is on. Overworld scenes,
            // chapter rosters, UI pickers, etc. still receive the plain
            // getSpriteUrl (full sprites only) via their own dep injection.
            getSpriteUrl: getChatSpriteUrl,
            playSfx,
            getSfx: () => sfx,
            characters,
            playDebatesTrack: () => playTrackFromSetting('trialDebatesTracks'),
            stopDebatesTrack: () => fadeOutAndPauseBgm(600),
            playPanicTrack: () => playTrackFromSetting('trialPanicTracks'),
            playTrialGeneralTrack: () => playTrialTrack(),
            suppressVisualizer: () => audioVisualizer.suppress(),
            unsuppressVisualizer: () => audioVisualizer.unsuppress(),
            showMinigameLoadingState,
            onStartHangmansGambit: async () => {
                // #region debug-point B:hangman-trial-entry
                reportFullscreenOverlayDebug("B", "index.js:onStartHangmansGambit", "Entered Hangman's Gambit trial callback", {
                    hangmansGambitController: Boolean(hangmansGambitController),
                });
                // #endregion
                // Show a loading overlay and silence whatever BGM was
                // playing before the click. The controller starts the HG
                // OST itself from inside playBgm after the tutorial closes,
                // so the pre-game window stays quiet.
                const loadingEl = showHangmanLoadingState();
                // #region debug-point B:hangman-loading
                reportFullscreenOverlayDebug("B", "index.js:onStartHangmansGambit", "Created Hangman loading overlay", {
                    loadingEl: Boolean(loadingEl),
                });
                // #endregion
                fadeOutAndPauseBgm().catch(() => {});

                // Generate a contextual question/answer from the trial context.
                // Falls back to the generic culprit prompt if generation fails
                // or the model returns something that doesn't match the
                // single-word, A-Z, 5-10-letter constraint.
                let question = 'Identify the culprit';
                let answer   = 'BLACKENED';
                try {
                    const ctx = trialManager?.getTrialContext?.() ?? {};
                    const topic    = String(ctx.topic || '').trim() || 'a mysterious crime';
                    const goal     = String(ctx.goal  || '').trim() || 'find the culprit';
                    const suspects = (Array.isArray(ctx.suspects) ? ctx.suspects : [])
                        .map(s => s?.name).filter(Boolean).join(', ') || 'unknown';

                    const hangmanExtraContextBlocks = (() => {
                        const blocks = [];
                        if (getMonopadSetting('hangmansGambitUseDebateHistory') === true) {
                            const history = getDanganExtensionPromptText('dangan_debate_history');
                            blocks.push(`DEBATE HISTORY\n${history || 'NONE'}`);
                        }
                        if (getMonopadSetting('hangmansGambitUseRecentContext') === true) {
                            const contextLines = buildRecentChatContextLines(14);
                            blocks.push(`RECENT CHAT CONTEXT\n${contextLines || 'NONE'}`);
                        }
                        return blocks.length ? `\n\n${blocks.join('\n\n')}` : '';
                    })();

                    const prompt = `You are generating a Hangman's Gambit puzzle for a Danganronpa-style class trial.

TRIAL CONTEXT
Topic: ${topic}
Goal: ${goal}
Suspects: ${suspects}

Generate ONE puzzle: a short question relevant to this trial, with a single-word answer.

REQUIREMENTS
- Question is 4–12 words and ends with a question mark.
- Answer is a SINGLE English word, 5–10 letters, UPPERCASE, letters A–Z only (no spaces, hyphens, numbers, or punctuation).
- The answer must plausibly answer the question.

Respond in EXACTLY this format and nothing else:
QUESTION: <your question>
ANSWER: <UPPERCASEWORD>${hangmanExtraContextBlocks}`;

                    const out = await generateTrialDialogue(prompt, { maxTokens: 80, temperature: 0.85 });
                    const qMatch = out.match(/QUESTION:\s*(.+)/i);
                    const aMatch = out.match(/ANSWER:\s*([A-Za-z]+)/i);
                    if (qMatch && aMatch) {
                        const cleanAnswer = aMatch[1].toUpperCase().replace(/[^A-Z]/g, '');
                        const cleanQuestion = qMatch[1].trim().replace(/^["']|["']$/g, '');
                        if (cleanAnswer.length >= 5 && cleanAnswer.length <= 10 && cleanQuestion.length > 0) {
                            question = cleanQuestion;
                            answer   = cleanAnswer;
                        }
                    }
                } catch (err) {
                    console.warn('[danganronpa] Failed to generate Hangman puzzle, using fallback:', err);
                } finally {
                    loadingEl?.hide?.();
                }

                const hangmanRun = hangmansGambitController?.run({ question, answer, time: 120, health: 7, difficulty: 2 });
                // #region debug-point B:hangman-run
                reportFullscreenOverlayDebug("B", "index.js:onStartHangmansGambit", "Invoked Hangman controller run()", {
                    hasRunResult: Boolean(hangmanRun),
                    thenable: Boolean(hangmanRun && typeof hangmanRun.then === "function"),
                    questionLength: question.length,
                    answerLength: answer.length,
                });
                // #endregion
                hangmanRun?.then(() => trialManager?.resumeAfterActivity?.());
            },
            onStartArgumentArmament: async () => {
                // Resolve the current speaker as the AA enemy
                const speakerName = trialManager?.getGcpSpeakerName?.() ?? null;

                // mainSprite: dedicated argumentarmament sprite, falls back to neutral via getSpriteUrl
                // defeatSprite: surprised reaction, falls back to neutral
                let mainSprite   = null;
                let defeatSprite = null;
                if (speakerName) {
                    [mainSprite, defeatSprite] = await Promise.all([
                        getSpriteUrl(speakerName, 'argumentarmament').catch(() => null),
                        getSpriteUrl(speakerName, 'surprised').catch(() => null),
                    ]);
                }

                // Resolve 'gore' background from ST's loaded background list
                const bgMatch = Array.from(document.querySelectorAll('.bg_example'))
                    .find(el => el.getAttribute('bgfile')?.toLowerCase().includes('gore'));
                let BG = '';
                if (bgMatch) {
                    const bgfile   = bgMatch.getAttribute('bgfile') || '';
                    const isCustom = bgMatch.getAttribute('custom') === 'true';
                    BG = isCustom ? encodeURI(bgfile) : `backgrounds/${encodeURIComponent(bgfile)}`;
                }

                // Loading overlay + soft progress while the LLM drafts the
                // suspect's defensive dialogs and the four cardinal-direction
                // sentences that form the Final Argument.
                const loadingEl = showMinigameLoadingState('Loading Argument Armament', { command: '/argumentarmament' });
                loadingEl?.setProgress?.(0);
                let softProgress = 0;
                const softInterval = window.setInterval(() => {
                    softProgress = Math.min(0.95, softProgress + (0.95 - softProgress) * 0.08);
                    loadingEl?.setProgress?.(softProgress);
                }, 200);

                // Fallback content matches the prior stub.
                let dialogs            = ['You\'re wrong!', 'That\'s impossible!', 'I won\'t let you expose the truth!'];
                let NSolution          = '';
                let SSolution          = '';
                let ESolution          = '';
                let WSolution          = '';
                let FinalSolution      = '';
                let FinalSolutionQuote = '';

                try {
                    const ctx = trialManager?.getTrialContext?.() ?? {};
                    const topic    = String(ctx.topic || '').trim() || 'a mysterious crime';
                    const goal     = String(ctx.goal  || '').trim() || 'find the culprit';
                    const suspects = (Array.isArray(ctx.suspects) ? ctx.suspects : [])
                        .map(s => s?.name).filter(Boolean).join(', ') || 'unknown';
                    const enemy = speakerName || 'the suspect';

                    const prompt = `You are scripting a Argument Armament — a Danganronpa-style 1-on-1 confrontation between the player and a panicking suspect.

TRIAL CONTEXT
Topic: ${topic}
Goal: ${goal}
Suspects: ${suspects}
Accused (AA opponent): ${enemy}

The minigame works like this:
1. ${enemy} shouts defensive STATEMENTS while the player attacks. The player breaks each statement in turn.
2. Once ${enemy} is cornered, the FINAL ARGUMENT begins: four pieces of evidence/logic appear on the cardinal directions (NORTH / SOUTH / EAST / WEST).
3. The player must press those directions in the correct ORDER. Pressing them in order reconstructs the accusation. The final press triggers the climactic QUOTE.

Generate ALL of the following.

REQUIREMENTS
- 9 STATEMENTS (defensive shouts from ${enemy}, each 4–12 words, in double quotes, in character). They should escalate from deflection → outright denial → desperation.
- 4 cardinal sentences (NORTH / SOUTH / EAST / WEST), each at MOST 4 words (1–4 words inclusive), NO quotes. They are short fragments that, when assembled in the correct order, form a coherent accusation against ${enemy}, drawing on the trial context.
- ORDER: a 4-character string that is a permutation of N, S, E, W (e.g. ESNW) — the correct sequence in which the cardinals should be pressed so the four sentences read as a coherent argument.
- QUOTE: a single dramatic accusation line (6–14 words, NO double quotes inside), the player's climactic finishing accusation against ${enemy}.

Respond in EXACTLY this format and nothing else (no blank lines, no labels other than these):
STATEMENT: "<line 1>"
STATEMENT: "<line 2>"
STATEMENT: "<line 3>"
STATEMENT: "<line 4>"
STATEMENT: "<line 5>"
STATEMENT: "<line 6>"
STATEMENT: "<line 7>"
STATEMENT: "<line 8>"
STATEMENT: "<line 9>"
NORTH: <north sentence>
SOUTH: <south sentence>
EAST: <east sentence>
WEST: <west sentence>
ORDER: <4-letter permutation of NSEW>
QUOTE: <climactic accusation>`;

                    const out = await generateTrialDialogue(prompt, { maxTokens: 600, temperature: 0.85 });

                    const statementMatches = [...out.matchAll(/STATEMENT:\s*(.+)/gi)]
                        .map(m => m[1].trim().replace(/^["']|["']$/g, ''))
                        .filter(Boolean);
                    const grab = (key) => {
                        const m = out.match(new RegExp(`^${key}:\\s*(.+)$`, 'mi'));
                        return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
                    };
                    // Hard-cap each cardinal at 4 words even if the model
                    // ignores the prompt — keeps the on-screen button labels
                    // from overflowing.
                    const capWords = (s) => s.split(/\s+/).filter(Boolean).slice(0, 4).join(' ');
                    const north = capWords(grab('NORTH'));
                    const south = capWords(grab('SOUTH'));
                    const east  = capWords(grab('EAST'));
                    const west  = capWords(grab('WEST'));
                    const order = grab('ORDER').toUpperCase().replace(/[^NSEW]/g, '');
                    const quote = grab('QUOTE');

                    const validOrder = order.length === 4
                        && new Set(order).size === 4
                        && [...'NSEW'].every(c => order.includes(c));

                    if (statementMatches.length >= 3 && north && south && east && west && validOrder && quote) {
                        // AA caps at 11 statements; trim if the model over-shot.
                        dialogs            = statementMatches.slice(0, 11);
                        NSolution          = north;
                        SSolution          = south;
                        ESolution          = east;
                        WSolution          = west;
                        FinalSolution      = order;
                        FinalSolutionQuote = quote;
                    }
                } catch (err) {
                    console.warn('[danganronpa] Failed to generate Argument Armament, using fallback:', err);
                } finally {
                    window.clearInterval(softInterval);
                    loadingEl?.setProgress?.(1);
                    loadingEl?.hide?.();
                }

                argumentArmamentController?.run({
                    enemyHp: 100, playerHp: 100, phases: 3,
                    dialogs,
                    NSolution, SSolution, ESolution, WSolution,
                    FinalSolution, FinalSolutionQuote,
                    BG,
                    mainSprite,
                    defeatSprite,
                    getPhaseTrack: (phaseNum) => {
                        const key = `aaPhase${phaseNum}Tracks`;
                        const tracks = getMonopadSetting(key) || [];
                        if (!tracks.length) return null;
                        return tracks[Math.floor(Math.random() * tracks.length)] || null;
                    },
                })?.then(() => trialManager?.resumeAfterActivity?.());
            },
            onStartInterjection: ({ characterName } = {}) => {
                const interjectionTracks = getMonopadSetting('trialInterjectionTracks') || [];
                if (interjectionTracks.length) {
                    playTrackFromSetting('trialInterjectionTracks');
                } else {
                    // fallback to bundled track
                    const bgmPath = `${(extensionFolderPath || '').replace(/\\/g, '/')}/assets/bgm/New Classmates of the Dead.mp3`;
                    const $bgmSelect = $('#audio_bgm_select');
                    if ($bgmSelect.length) {
                        if (!$bgmSelect.find(`option[value="${bgmPath}"]`).length) {
                            $bgmSelect.append(new Option('asset: New Classmates of the Dead', bgmPath));
                        }
                        $bgmSelect.val(bgmPath).trigger('change');
                    }
                }
                interjectionRunner?.run({ characterName })
                    ?.then(() => triggerInterjectorResponse(characterName))
                    ?.then(() => trialManager?.resumeAfterActivity?.());
            },
            onStartVotingTime: async () => {
                const topSuspect = trialManager?.getTrialContext?.()?.suspects?.[0]?.name ?? '';
                const correctBlackened = await promptForBlackened(topSuspect);
                const result = await votingScreenController?.run() ?? {};
                if (result.error) {
                    trialManager?.resumeAfterActivity?.();
                    return;
                }
                const guess = result.guess ?? null;

                // Convert vote tallies → top-3 suspects with percentage share
                const votes      = result.votes ?? {};
                const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);
                if (totalVotes > 0) {
                    const suspects = Object.entries(votes)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 3)
                        .map(([name, count]) => ({ name, chance: Math.round(count / totalVotes * 100) }));
                    trialManager?.setTrialContext(undefined, undefined, suspects);
                }

                await voteResultsController?.run({ guess, result: correctBlackened });
                trialManager?.resumeAfterActivity?.();
            },
            onStartQuestionTime: async () => {
                // #region debug-point C:qtime-trial-entry
                reportFullscreenOverlayDebug("C", "index.js:onStartQuestionTime", "Entered Question Time trial callback", {
                    questionTimeController: Boolean(questionTimeController),
                });
                // #endregion
                // Show a loading overlay while the LLM drafts a question + 4
                // answers from the current trial context. Falls back to a
                // generic suspect picker if generation fails or the model
                // returns something we can't parse cleanly.
                const loadingEl = showMinigameLoadingState('Loading Question Time', { command: '/questiontime' });
                // #region debug-point C:qtime-loading
                reportFullscreenOverlayDebug("C", "index.js:onStartQuestionTime", "Created Question Time loading overlay", {
                    loadingEl: Boolean(loadingEl),
                });
                // #endregion
                loadingEl?.setProgress?.(0);
                // Question Time is one generateRaw call, so there's no true
                // segment-by-segment progress. Drive a soft asymptotic
                // approach toward 95% so the user gets a moving number, then
                // snap to 100% in the finally block when generation lands.
                let softProgress = 0;
                const softInterval = window.setInterval(() => {
                    softProgress = Math.min(0.95, softProgress + (0.95 - softProgress) * 0.08);
                    loadingEl?.setProgress?.(softProgress);
                }, 200);

                let title   = 'Who is the blackened?';
                let answers = ['Suspect A', 'Suspect B', 'Suspect C', 'Suspect D'];
                let correct = 0;
                try {
                    const ctx = trialManager?.getTrialContext?.() ?? {};
                    const topic    = String(ctx.topic || '').trim() || 'a mysterious crime';
                    const goal     = String(ctx.goal  || '').trim() || 'find the culprit';
                    const suspects = (Array.isArray(ctx.suspects) ? ctx.suspects : [])
                        .map(s => s?.name).filter(Boolean).join(', ') || 'unknown';

                    const qtimeExtraContextBlocks = (() => {
                        const blocks = [];
                        if (getMonopadSetting('questionTimeUseDebateHistory') === true) {
                            const history = getDanganExtensionPromptText('dangan_debate_history');
                            blocks.push(`DEBATE HISTORY\n${history || 'NONE'}`);
                        }
                        if (getMonopadSetting('questionTimeUseRecentContext') === true) {
                            const contextLines = buildRecentChatContextLines(14);
                            blocks.push(`RECENT CHAT CONTEXT\n${contextLines || 'NONE'}`);
                        }
                        return blocks.length ? `\n\n${blocks.join('\n\n')}` : '';
                    })();

                    const prompt = `You are generating a Question Time round for a Danganronpa-style class trial.

TRIAL CONTEXT
Topic: ${topic}
Goal: ${goal}
Suspects: ${suspects}

Generate ONE multiple-choice question about a SPECIFIC DETAIL of the case, with EXACTLY four answers. One answer must be correct.

REQUIREMENTS
- The question must ask about a detail of the case — for example: a piece of evidence, the murder weapon, the time/place/method, an alibi, an inconsistency in testimony, a motive, an object found at the scene, who was last seen with the victim, etc.
- DO NOT ask "Who is the killer?", "Who is the blackened?", "Who did it?", "Who is the culprit?", or any direct variant of those. Naming a suspect should not be the question — it can only ever be one of the answers when it relates to a specific detail (e.g. "Who was seen entering the storage room?").
- Question is 6–16 words and ends with a question mark.
- Exactly 4 answers, each 1–6 words, distinct, none beginning with a label like "A)" or "1.".
- Mark the correct answer with a leading "*" character.
- The other three answers should be plausible distractors that could fit the same kind of detail (e.g. four possible weapons, four possible times, four possible locations).

Respond in EXACTLY this format and nothing else:
QUESTION: <your question>
ANSWER: <answer>
ANSWER: *<correct answer>
ANSWER: <answer>
ANSWER: <answer>${qtimeExtraContextBlocks}`;

                    const out = await generateTrialDialogue(prompt, { maxTokens: 160, temperature: 0.85 });
                    const qMatch  = out.match(/QUESTION:\s*(.+)/i);
                    const aMatches = [...out.matchAll(/ANSWER:\s*(.+)/gi)].map(m => m[1].trim());
                    if (qMatch && aMatches.length >= 4) {
                        const cleanQuestion = qMatch[1].trim().replace(/^["']|["']$/g, '');
                        const four = aMatches.slice(0, 4);
                        const correctIdx = four.findIndex(a => /^\*/.test(a));
                        const cleaned = four.map(a => a.replace(/^\*\s*/, '').trim()).filter(Boolean);
                        if (cleaned.length === 4 && correctIdx >= 0 && cleanQuestion.length > 0) {
                            title   = cleanQuestion;
                            answers = cleaned;
                            correct = correctIdx;
                        }
                    }
                } catch (err) {
                    console.warn('[danganronpa] Failed to generate Question Time, using fallback:', err);
                } finally {
                    window.clearInterval(softInterval);
                    loadingEl?.setProgress?.(1);
                    loadingEl?.hide?.();
                }

                const questionTimeRun = questionTimeController?.run({ title, time: resolveSkillParam("qttTimer", 30), answers, correct });
                // #region debug-point C:qtime-run
                reportFullscreenOverlayDebug("C", "index.js:onStartQuestionTime", "Invoked Question Time controller run()", {
                    hasRunResult: Boolean(questionTimeRun),
                    thenable: Boolean(questionTimeRun && typeof questionTimeRun.then === "function"),
                    answersCount: Array.isArray(answers) ? answers.length : 0,
                    correct,
                });
                // #endregion
                questionTimeRun?.then(() => trialManager?.resumeAfterActivity?.());
            },
            onStartQuestionTruth: async () => {
                // #region debug-point D:qtruth-trial-entry
                reportFullscreenOverlayDebug("D", "index.js:onStartQuestionTruth", "Entered Question Truth trial callback", {
                    questionTruthController: Boolean(questionTruthController),
                });
                // #endregion
                // Generate a question whose correct answer is exactly one of
                // the player's collected Truth Bullet titles.  Falls back to
                // the prior stub if generation fails or there are no bullets
                // to pick from.
                const loadingEl = showMinigameLoadingState('Loading Question Truth', { command: '/questiontruth' });
                // #region debug-point D:qtruth-loading
                reportFullscreenOverlayDebug("D", "index.js:onStartQuestionTruth", "Created Question Truth loading overlay", {
                    loadingEl: Boolean(loadingEl),
                });
                // #endregion
                loadingEl?.setProgress?.(0);
                let softProgress = 0;
                const softInterval = window.setInterval(() => {
                    softProgress = Math.min(0.95, softProgress + (0.95 - softProgress) * 0.08);
                    loadingEl?.setProgress?.(softProgress);
                }, 200);

                let question = 'What is the key piece of evidence?';
                let answer   = '';
                let time     = 60; // floor; the model may extend this if it picks a harder question
                try {
                    const bullets = (getTruthBulletsSnapshot() || [])
                        .filter(b => b && typeof b.title === 'string' && b.title.trim().length)
                        .slice(0, 24);

                    if (bullets.length === 0) {
                        console.warn('[danganronpa] Question Truth: no Truth Bullets — using fallback.');
                    } else {
                        const ctx = trialManager?.getTrialContext?.() ?? {};
                        const topic = String(ctx.topic || '').trim() || 'the current case';
                        const bulletList = bullets.map((b, i) => {
                            const title = String(b.title || '').trim();
                            const desc  = String(b.description || '').trim().replace(/\s+/g, ' ');
                            return `${i + 1}. TITLE: ${title}\n   DESCRIPTION: ${desc || '(no description)'}`;
                        }).join('\n');

                        const qtruthExtraContextBlocks = (() => {
                            const blocks = [];
                            if (getMonopadSetting('questionTruthUseDebateHistory') === true) {
                                const history = getDanganExtensionPromptText('dangan_debate_history');
                                blocks.push(`DEBATE HISTORY\n${history || 'NONE'}`);
                            }
                            if (getMonopadSetting('questionTruthUseRecentContext') === true) {
                                const contextLines = buildRecentChatContextLines(14);
                                blocks.push(`RECENT CHAT CONTEXT\n${contextLines || 'NONE'}`);
                            }
                            return blocks.length ? `\n\n${blocks.join('\n\n')}` : '';
                        })();

                        const prompt = `You are generating a "Question Truth" round for a Danganronpa-style class trial about: ${topic}.

The player has collected these Truth Bullets — each has a TITLE and a DESCRIPTION:

${bulletList}

Generate ONE multiple-truth question whose correct answer is the EXACT TITLE of one of the Truth Bullets above.

REQUIREMENTS
- Pick ONE of the Truth Bullets to be the answer. Use its TITLE verbatim — same words, same capitalisation, no rephrasing.
- The question must ask about a specific detail found in that bullet's DESCRIPTION (e.g. what was discovered, what an item proves, what a witness saw, etc.).
- The question must be answerable using JUST THE TITLE — the title alone must be a sensible, complete answer.
- DO NOT ask vague trial-wide questions like "Who is the murderer?", "Who is the blackened?", or "What happened?" unless the answer matches a bullet title exactly.
- DO NOT ask a question that requires extra context beyond the bullet's title to answer.
- Question is 6–18 words and ends with a question mark.
- Choose a fair TIME LIMIT for the player to answer, in WHOLE seconds. The MINIMUM is 60; you may set a higher value (up to 180) if the question genuinely requires more thought — e.g. when there are many similarly-titled bullets, or the player must cross-reference details. Default to 60 unless you have a clear reason to extend.

Respond in EXACTLY this format and nothing else:
QUESTION: <your question>
ANSWER: <exact TITLE of one Truth Bullet from the list above>
TIME: <whole-second integer, minimum 60, maximum 180>${qtruthExtraContextBlocks}`;

                        const out = await generateTrialDialogue(prompt, { maxTokens: 180, temperature: 0.8 });
                        const qMatch = out.match(/QUESTION:\s*(.+)/i);
                        const aMatch = out.match(/ANSWER:\s*(.+)/i);
                        const tMatch = out.match(/TIME:\s*(\d+)/i);
                        if (qMatch && aMatch) {
                            const candidateQ = qMatch[1].trim().replace(/^["']|["']$/g, '');
                            const candidateA = aMatch[1].trim().replace(/^["']|["']$/g, '');
                            // Validate the answer matches a real bullet title (case-insensitive)
                            // and replace it with the canonical-cased title.
                            const matched = bullets.find(b => b.title.trim().toLowerCase() === candidateA.toLowerCase());
                            if (matched && candidateQ.length > 0) {
                                question = candidateQ;
                                answer   = matched.title.trim();
                                if (tMatch) {
                                    // Clamp model-provided TIME to [60, 180] whole seconds.
                                    const candidateT = parseInt(tMatch[1], 10);
                                    if (Number.isFinite(candidateT)) {
                                        time = Math.max(60, Math.min(180, candidateT));
                                    }
                                }
                            } else {
                                console.warn('[danganronpa] Question Truth: model answer did not match any bullet title, using fallback.');
                            }
                        }
                    }
                } catch (err) {
                    console.warn('[danganronpa] Failed to generate Question Truth, using fallback:', err);
                } finally {
                    window.clearInterval(softInterval);
                    loadingEl?.setProgress?.(1);
                    loadingEl?.hide?.();
                }

                const questionTruthRun = questionTruthController?.run({ question, answer, time: resolveSkillParam("qthTimer", time), playerHp: resolveSkillParam("qthHealth", 5) });
                // #region debug-point D:qtruth-run
                reportFullscreenOverlayDebug("D", "index.js:onStartQuestionTruth", "Invoked Question Truth controller run()", {
                    hasRunResult: Boolean(questionTruthRun),
                    thenable: Boolean(questionTruthRun && typeof questionTruthRun.then === "function"),
                    questionLength: question.length,
                    answerLength: answer.length,
                });
                // #endregion
                questionTruthRun?.then(() => trialManager?.resumeAfterActivity?.());
            },
            onStartChoosing: ({ characters = [], startIdx = 0 } = {}) => {
                playTrackFromSetting('trialSuspectChoiceTracks');
                chooseCharacterController?.run({ characters, startIdx })
                    ?.then(() => trialManager?.resumeAfterActivity?.());
            },
            onStartMassPanicDebate: () => trialManager?.startMassPanicDebate(MPD_TEST_SCENARIOS.slice(0, 6)),
            onStartRebuttalShowdown: (params) => {
                playTrackFromSetting('trialRebuttalTracks');
                rebuttalShowdownController?.run(params)
                    ?.then(() => trialManager?.resumeAfterActivity?.());
            },
            onStartPunishmentTime: async ({ characterName } = {}) => {
                if (!characterName) return;
                try {
                    const allCinematics = getMonopadSetting('executionCinematics') || [];
                    const cinematic = allCinematics.find(c => c.name?.toLowerCase() === characterName.toLowerCase()) ?? null;
                    await runExecutionCinematic(cinematic, characterName);
                    for (const [, char] of characters) {
                        if (normalizeName(char.name) === normalizeName(characterName)) {
                            char.dead = true;
                            saveCharacters();
                            break;
                        }
                    }
                    await trialManager?.markCharacterExecuted(characterName);
                    await executeSlashCommandsWithOptions(`/member-disable ${characterName}`, { handleParserErrors: true });
                } catch (err) {
                    console.warn('[danganronpa] onStartPunishmentTime failed:', err);
                }
                trialManager?.resumeAfterActivity?.();
            },
            onStartScrumDebate: async () => {
                if (!scrumDebateController) return;
                // Generate a scenario via the LLM (matching SCRUM_DEBATE_DEFAULT_SCENARIO's
                // shape).  If anything fails — no truth bullets, parse error,
                // LLM unavailable — fall through to the hardcoded default in
                // vfx/scrumDebate.js so the minigame still launches.
                const loadingEl = showMinigameLoadingState('Loading Scrum Debate', { command: '/scrumdebate' });
                // Time-based eased progress ramp: scenario generation is a
                // single LLM call (with one retry on parse fail), so we
                // can't report real intermediate progress.  Instead, ramp
                // 0 → ~90% asymptotically over the typical generation
                // window so the user sees movement; snap to 100% the
                // moment generation actually completes.
                let scrumProgress = 0;
                const scrumProgressStart = performance.now();
                const SCRUM_PROGRESS_HALF_LIFE_MS = 7000; // 50% of remaining gap closes every ~7s
                const scrumProgressTick = window.setInterval(() => {
                    const elapsed = performance.now() - scrumProgressStart;
                    // 1 - 0.5^(t / halfLife): hits ~50% at 7s, ~75% at 14s, ~87.5% at 21s, cap 90%.
                    const eased = 1 - Math.pow(0.5, elapsed / SCRUM_PROGRESS_HALF_LIFE_MS);
                    scrumProgress = Math.min(0.9, eased * 0.9);
                    loadingEl?.setProgress?.(scrumProgress);
                }, 120);
                // Round count tracks the number of ALIVE opposing-team members
                // that can actually speak (dead classmates never get their own
                // scenario).  When alive counts are unequal across the two
                // teams — which happens when the alive-total is odd and the
                // split is e.g. 4 / 3 — fall back to the smaller of the two
                // so each round has a paired alive speaker on each side.
                // Net effect: equal alive teams use the full count; uneven
                // teams drop one scenario.
                let roundCount = 3;
                try {
                    const teams = buildScrumTeams((name) => characters.get(normalizeName(name))?.dead === true);
                    const oppAlive    = (teams?.opposing || []).filter(c => !c?._sdDead).length;
                    const playerAlive = (teams?.player   || []).filter(c => !c?._sdDead).length;
                    const minAlive    = Math.min(oppAlive, playerAlive);
                    if (minAlive > 0) roundCount = minAlive;
                } catch (e) {
                    console.warn("[danganronpa] Could not size Scrum rounds from alive headcounts; using default 3:", e);
                }
                let scenario = null;
                try {
                    scenario = await buildScrumDebateScenario({
                        trialContext:    trialManager?.getTrialContext?.() ?? null,
                        truthBullets:    getTruthBulletsSnapshot(),
                        contextMessages: (typeof getContextMessages === "function" ? getContextMessages() : [])
                            .map(m => ({ isUser: m.isUser, name: m.name, text: m.text })),
                        roundCount,
                    });
                } catch (e) {
                    console.warn("[danganronpa] Scrum Debate scenario generation threw:", e);
                }
                window.clearInterval(scrumProgressTick);
                loadingEl?.setProgress?.(1.0);
                // Brief beat at 100% so the user actually sees the bar
                // finish before the screen tears down.
                await new Promise(r => setTimeout(r, 180));
                loadingEl?.hide?.();

                // Generation failed → surface the error to the user instead
                // of silently falling back to the stubbed scenario, then bail
                // out without launching the minigame.
                if (!scenario) {
                    const errorEl = showMinigameErrorState({
                        title:    'Scrum Debate generation failed',
                        subtitle: 'Please try again. Alternatively, generate your own using',
                        command:  '/scrumdebate',
                    });
                    try { await errorEl.onDismissed(); } catch {}
                    trialManager?.resumeAfterActivity?.();
                    return;
                }

                try {
                    await scrumDebateController.run({
                        scenario,
                        timerMs: resolveSkillParam("scrumTimer", 180000),
                        playerHp: resolveSkillParam("scrumHealth", 3),
                    });
                } finally {
                    trialManager?.resumeAfterActivity?.();
                }
            },
            onStartMindMine: async () => {
                if (!mindMineController) return;
                // Generate three case-relevant statements via the LLM. One of
                // them will be uncovered by the player and folded back into
                // the LLM as "A point of relevance is that <statement>...".
                // Falls through to mindMine.js's hardcoded defaults if
                // generation fails or returns fewer than three usable lines.
                const loadingEl = showMinigameLoadingState('Loading Mind Mine', { command: '/mindmine' });
                loadingEl?.setProgress?.(0);
                let softProgress = 0;
                const softInterval = window.setInterval(() => {
                    softProgress = Math.min(0.95, softProgress + (0.95 - softProgress) * 0.08);
                    loadingEl?.setProgress?.(softProgress);
                }, 200);

                let sentences = [];
                try {
                    const ctx = trialManager?.getTrialContext?.() ?? {};
                    const topic = String(ctx.topic || '').trim() || 'a mysterious crime';
                    const goal  = String(ctx.goal  || '').trim() || 'find the culprit';
                    const suspectsList = (Array.isArray(ctx.suspects) ? ctx.suspects : [])
                        .map(s => s?.name).filter(Boolean).join(', ') || 'unknown';

                    const bullets = (getTruthBulletsSnapshot() || [])
                        .filter(b => b && typeof b.title === 'string' && b.title.trim().length)
                        .slice(0, 16)
                        .map((b, i) => {
                            const title = String(b.title || '').trim();
                            const desc  = String(b.description || '').trim().replace(/\s+/g, ' ');
                            return `${i + 1}. ${title}${desc ? ` — ${desc}` : ''}`;
                        }).join('\n');
                    const bulletsBlock = bullets ? `\n\nTRUTH BULLETS COLLECTED\n${bullets}` : '';

                    const prompt = `You are generating three statements for a "Mind Mine" round in a Danganronpa-style class trial.

TRIAL CONTEXT
Topic: ${topic}
Goal: ${goal}
Suspects: ${suspectsList}${bulletsBlock}

Produce THREE distinct, plausible STATEMENTS about the case. Each statement must:
- Be a complete, declarative sentence — NOT a question and NOT prefixed with a label.
- Be between 6 and 14 words long.
- Make a specific claim about the case (an alibi, a piece of evidence, a motive, a timeline detail, an inconsistency, who was where, etc.).
- Be self-contained and read naturally as a continuation of the phrase "A point of relevance is that <statement>".
- Start with a capital letter and end with NO trailing punctuation (no period or question mark).
- Be distinct from the other two — no near-duplicates.

Respond in EXACTLY this format and nothing else:
STATEMENT: <first statement>
STATEMENT: <second statement>
STATEMENT: <third statement>`;

                    const out = await generateTrialDialogue(prompt, { maxTokens: 220, temperature: 0.85 });
                    const matches = [...out.matchAll(/STATEMENT:\s*(.+)/gi)]
                        .map(m => m[1].trim()
                            .replace(/^["']|["']$/g, '')
                            .replace(/[.?!]+\s*$/, ''))
                        .filter(s => s.length >= 6);
                    if (matches.length >= 3) sentences = matches.slice(0, 3);
                } catch (err) {
                    console.warn('[danganronpa] Failed to generate Mind Mine statements, using fallback:', err);
                } finally {
                    window.clearInterval(softInterval);
                    loadingEl?.setProgress?.(1);
                    loadingEl?.hide?.();
                }

                mindMineController.run({
                    sentences,
                    timeLimit: resolveSkillParam("mindMineTimer", 120),
                    penaltyMs: resolveSkillParam("mindMinePenalty", 10) * 1000,
                });
            },
            getEquippedSkillsSnapshot,
            resolveSkillParam,
            rollBiasedEmotion,
            attachDraggablePositioning,
            applyCustomUiPosition,
            awardXp,
            xpRewards: XP_REWARDS,
        });
    } catch (e) {
        console.error(`[${extensionName}] ❌ Trial Manager init failed:`, e);
    }

    // Expose for debugging
    window.DanganExtension = {
        trialManager,
        extensionName,
        extensionSettings: extension_settings,
        eventSource,
        event_types,
        endTrial: () => trialManager?.endTrial(),
    };

    console.log(`[${extensionName}] 🚀 Extension fully loaded.`);

    // Suppress expression VFX/SFX on initial load until the user sends a message.
    setVfxGcpLoadSuppressed(true);
    // Initialize the group chat portrait stage once ST has settled, then lift
    // the VFX suppression after a grace period so initial expression loads don't play SFX.
    setTimeout(async () => {
        await trialManager?.initGroupChatPortraits?.();
        setVfxGcpGroupActive(!!(window.SillyTavern?.getContext?.()?.groupId));
        setTimeout(() => setVfxGcpLoadSuppressed(false), 1500);
    }, 1500);

    try {
        // Hook into multiple events for maximum reliability
        const handleMessage = (mesId) => {
            console.log(`[${extensionName}] 🔊 eventSource trigger:`, mesId);
            const ctx = window.SillyTavern?.getContext?.();
            const chat = ctx?.chat;
            if (!Array.isArray(chat)) return;
            
            const msg = chat[mesId] || chat.find(m => m.mesId === mesId) || chat[chat.length - 1];
            if (msg && (msg.is_user || msg.force_user)) {
                // User sent a message — lift VFX suppression early if still active
                setVfxGcpLoadSuppressed(false);
                console.log(`[${extensionName}] 💬 User message detected: "${msg.mes?.slice(0, 30)}..."`);
                const text = msg.mes;
                setTimeout(() => {
                    if (trialManager) {
                        console.log(`[${extensionName}] 🚀 Calling trialManager.onMessageSent`);
                        trialManager.onMessageSent(text);
                        // Scroll GCP stage to player slot when user speaks
                        const pCtx = window.SillyTavern?.getContext?.();
                        const playerName = pCtx?.name1 || pCtx?.user_name || pCtx?.userName || pCtx?.personaName;
                        if (playerName) trialManager.updateGroupChatSpeaker?.(playerName);
                    } else {
                        console.warn(`[${extensionName}] ⚠️ trialManager not initialized yet.`);
                    }
                    updateSuspectsFromChat();
                }, 250);
            }
        };

        eventSource.on(event_types.MESSAGE_SENT, handleMessage);
        eventSource.on(event_types.USER_MESSAGE_RENDERED, handleMessage);

        // Update group chat portrait stage when a character speaks
        const handleCharacterMessage = (mesId) => {
            const ctx = window.SillyTavern?.getContext?.();
            if (!ctx) return;
            const msg = ctx.chat?.[mesId] ?? ctx.chat?.[ctx.chat.length - 1];
            if (msg && !msg.is_user && msg.name) {
                trialManager?.updateGroupChatSpeaker?.(msg.name);
            }
            updateSuspectsFromChat();
        };
        eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, handleCharacterMessage);

        document.addEventListener('click', e => {
            const btn = e.target.closest('.dangan-suspect-refresh-btn');
            if (!btn) return;
            updateSuspectsFromChat();
        });

        // Re-apply forced outfits to the on-screen sprites. Assigned by
        // setupExpressionMirror below; called after chat entry settles to beat
        // the entry-time race where ST's clone-swap / overworld expression pass
        // overwrites our first outfit set. No-op until the mirror is set up.
        reapplyOutfitToSprites = () => {};

        // On chat change, rebuild the stage (group ↔ 1-on-1 may differ) then snap to latest speaker.
        // Suppress VFX/SFX for the duration of the init + a grace period so the expressions
        // that fire as ST re-renders the chat don't play sounds — then lift automatically.
        eventSource.on(event_types.CHAT_CHANGED, () => {
            setVfxGcpLoadSuppressed(true);
            setVfxGcpGroupActive(false); // reset until new chat's GCP init completes
            try { renderMoveToPanel(); renderMinimap(); } catch (e) { console.warn('[Dangan][moveto-panel] render failed:', e); }
            try { overworldSceneController?.render?.(); } catch (e) { console.warn('[Dangan][overworld] render failed:', e); }
            trialManager?.destroyGroupChatPortraits?.();
            // Reset trial state synchronously. Deferring this used to leave a
            // ~300ms window where trialActive was stale from the previous chat;
            // the trialManager's 1.5s safety poll could fire inside that gap,
            // see trialActive && isGroupChat() as true for the *new* group, and
            // briefly mount the trial frame/badge/sticker before the deferred
            // onChatChanged ran and unmounted them — visible as a flash of the
            // Class Trial UI on Talk-to-the-Room (and other group entries).
            trialManager?.onChatChanged?.();
            // Strip Prome User Sprite from the group's member list if it crept
            // in before that character was added to the system-name filter.
            stripPromeFromCurrentGroup();
            setTimeout(async () => {
                await trialManager?.initGroupChatPortraits?.();
                const ctx = window.SillyTavern?.getContext?.();
                setVfxGcpGroupActive(!!(ctx?.groupId));
                const lastMsg = [...(ctx?.chat || [])].reverse().find(m => !m.is_system && m.name);
                if (lastMsg) {
                    const speakerName = lastMsg.is_user
                        ? (ctx?.name1 || ctx?.user_name || ctx?.userName || ctx?.personaName || lastMsg.name)
                        : lastMsg.name;
                    if (speakerName) trialManager?.updateGroupChatSpeaker?.(speakerName);
                }
                updateSuspectsFromChat();
                // Grace period for ST's post-load expression updates to settle, then re-enable VFX/SFX.
                setTimeout(() => setVfxGcpLoadSuppressed(false), 1500);
            }, 300);
            // Re-apply forced outfits after entry settles — staggered to land after
            // ST's clone-swap fade (~400ms) and the overworld's 350ms expression
            // pass, which otherwise overwrite our first-entry outfit set.
            setTimeout(() => reapplyOutfitToSprites(), 700);
            setTimeout(() => reapplyOutfitToSprites(), 1400);
            setTimeout(() => reapplyOutfitToSprites(), 2500);

            // Dynamic Audio fires its own CHAT_CHANGED handler and restarts #audio_bgm.
            // If we own the BGM (investigationTrackAudio is active), silence DA's element
            // after it settles so only our track plays.
            if (investigationTrackAudio) {
                setTimeout(() => {
                    const daEl = document.getElementById('audio_bgm');
                    if (daEl instanceof HTMLAudioElement && !daEl.paused) daEl.pause();
                }, 500);
            }

            // BGM persists across chat transitions. Only autostart when there
            // is genuinely no track yet — we deliberately do NOT check
            // `.paused`, since that can read true momentarily during the
            // chat-load even though the override-and-listener pair below is
            // already resuming the same element. Restarting via playPhaseTrack
            // here would create a fresh Audio() and force a 1-2 second buffer
            // gap, which is exactly the artefact we're trying to eliminate.
            if (!getMonopadSetting('bgmOutsideChats')) {
                setTimeout(() => {
                    if (!isInCharacterChat()) return;
                    if (investigationTrackAudio) return;
                    playPhaseTrack();
                }, 600);
            }
        });

        console.log(`[${extensionName}] ✅ Chat hooks initialized.`);
    } catch (e) {
        console.error(`[${extensionName}] ❌ Chat hooks failed:`, e);
    }

    // Mirror expression changes to the correct GCP portrait slot.
    // We observe document.body for img.expression mutations — the same scope the VFX
    // system uses — so we catch /emote changes regardless of which container ST places
    // the expression images in (VN wrapper, expression holder, inline in chat, etc.).
    // Group chats: route each src to the matching character's slot via folder comparison.
    // Solo chats:  debounce and apply to the single speaker slot.
    (function setupExpressionMirror() {
        let _pendingExprSrc = null;
        let _exprDebounceTimer = null;

        // When half-sprite mode is on, transform a sprite URL to its -half
        // variant (e.g. `approval.png?t=…` → `approval-half.png?t=…`). The
        // mirror gets the raw URL from ST's img.expression element, which
        // bypasses getSpriteUrl; this helper applies the same -half
        // preference here. Falls back to the original URL via onerror if the
        // -half file doesn't exist on the server. (Forced-outfit prefixing is
        // handled separately in onExpressionChange via the sprites API, since
        // outfit sprites can use a different file extension than the base.)
        function setMirroredSrc(img, src) {
            if (!img || !src) return;
            const halfMode = !!extension_settings[extensionName]?.halfspriteMode;
            if (isTrialUiActive()) {
                const noHalf = src.replace(/-half(\.[a-z0-9]+)/i, '$1');
                img.src = noHalf;
                return;
            }
            if (!halfMode || /-half\.[a-z0-9]+(\?|$)/i.test(src)) {
                img.src = src;
                return;
            }
            const halfSrc = src.replace(/(\.[a-z0-9]+)(\?|$)/i, '-half$1$2');
            const onFail = () => { img.src = src; };
            img.addEventListener('error', onFail, { once: true });
            img.addEventListener('load', () => {
                img.removeEventListener('error', onFail);
            }, { once: true });
            img.src = halfSrc;
        }

        // Forced-outfit resolver for the chat/overworld expression image. Given
        // ST's raw expression `src` (e.g. ".../neutral.png?t=1") and the active
        // outfit prefix, look up the real outfit file via the sprites API and
        // set it on `img`. This matches by filename STEM (like getSpriteUrl), so
        // it finds `pool-neutral.webp` even though the base sprite is a .png —
        // string-rewriting the URL would wrongly keep the .png extension. Leaves
        // `img` on its base sprite when the character has no outfit sprite.
        async function applyOutfitInPlace(img, src, prefix) {
            let folder = '', label = '';
            try {
                const parts = new URL(src, location.href).pathname.split('/').filter(Boolean);
                folder = decodeURIComponent(parts[parts.length - 2] || '');
                label = decodeURIComponent(parts[parts.length - 1] || '')
                    .replace(/\.[^.]+$/, '').replace(/-half$/i, '');
            } catch { return; }
            if (!folder || !label) return;
            let sprites;
            try {
                const resp = await fetch(`/api/sprites/get?name=${encodeURIComponent(folder)}`);
                if (!resp.ok) return;
                sprites = await resp.json();
            } catch { return; }
            const halfMode = !!extension_settings[extensionName]?.halfspriteMode && !isTrialUiActive();
            const url = pickForcedOutfitSprite(sprites, prefix, label, halfMode);
            if (window.__DREX_OUTFIT_DEBUG) console.log('[DREX-outfit] applyOutfitInPlace', { folder, label, prefix, resolved: url });
            // The resolved filename starts with the prefix, so the observer
            // re-fire it triggers is short-circuited by the guard in onExpressionChange.
            if (url && img) img.src = url;
        }

        // Sweep every visible expression sprite and force the active outfit onto
        // any that aren't already wearing it. Used as an entry-time safety net
        // (see CHAT_CHANGED) since the live observer can lose the first-entry
        // race against ST's sprite mount.
        reapplyOutfitToSprites = () => {
            const prefix = getActiveOutfitPrefix();
            if (!prefix) return;
            const imgs = document.querySelectorAll('#visual-novel-wrapper img.expression, #expression-image, .expression-holder img');
            const lcPrefix = prefix.toLowerCase();
            imgs.forEach(img => {
                const src = img.src;
                if (!src || src === location.href) return;
                try {
                    const fn = decodeURIComponent(new URL(src, location.href).pathname.split('/').pop() || '');
                    if (fn.toLowerCase().startsWith(lcPrefix)) return; // already wearing the outfit
                } catch { return; }
                applyOutfitInPlace(img, src, prefix);
            });
        };

        function flushExpression() {
            const src = _pendingExprSrc;
            _pendingExprSrc = null;
            if (!src) return;
            const speakerImg = trialManager?.getGcpSpeakerImg?.();
            if (!speakerImg) return;
            if (speakerImg.parentElement?.classList.contains('gcp-dead')) return;
            setMirroredSrc(speakerImg, src);
        }

        function onExpressionChange(imgEl) {
            // Guard: skip if src attribute isn't set yet (element just added to DOM),
            // or if src resolves to the page URL (browsers return location.href when
            // the src attribute is absent, which would load the whole ST page as an image).
            const srcAttr = imgEl.getAttribute?.('src');
            if (!srcAttr) return;
            const src = imgEl.src;
            if (!src || src === location.href) return;

            if (window.__DREX_OUTFIT_DEBUG) console.log('[DREX-outfit] onExpressionChange', { src, prefix: getActiveOutfitPrefix(), curLoc: getCurrentLocationId(), cls: imgEl.className, id: imgEl.id, parent: imgEl.parentElement?.className });

            // Forced-outfit recursion guard: ST only ever emits base emotion
            // filenames (neutral.png, surprised.png …). A "<prefix>…" filename
            // can only be our own in-place rewrite below, re-firing the observer
            // — skip it (the visible sprite is set; mirror/VFX already ran).
            const activeOutfit = getActiveOutfitPrefix();
            if (activeOutfit) {
                try {
                    const fn = decodeURIComponent(new URL(src, location.href).pathname.split('/').pop() || '');
                    if (fn.toLowerCase().startsWith(activeOutfit.toLowerCase())) return;
                } catch { /* ignore bad src */ }
            }

            // Prome user sprite → player slot
            if (imgEl.closest?.('#expression-prome-user')) {
                const playerImg = trialManager?.getGcpPlayerImg?.();
                if (playerImg) setMirroredSrc(playerImg, src);
                return;
            }

            // Force the per-location outfit onto the ST-managed expression image
            // ITSELF (the on-screen chat / overworld conversation sprite). In plain
            // chat / overworld this element IS what's visible and nothing else
            // rewrites it. Resolved via the sprites API (handles a differing file
            // extension, e.g. base neutral.png vs pool-neutral.webp); the resulting
            // prefixed src re-fires the observer and is caught by the guard above.
            if (activeOutfit) applyOutfitInPlace(imgEl, src, activeOutfit);

            // Group chat: match to the specific character's slot by URL folder.
            // We fire VFX/SFX here directly via triggerVfxOnElement so that:
            //   a) the animation targets the correct portrait (not just gcpCurrentFloat), and
            //   b) /emote works even when it only updates src and not data-expression
            //      (which would leave the vfxSystem's data-expression observer silent).
            const isGroup = !!(window.SillyTavern?.getContext?.()?.groupId);
            if (isGroup) {
                const targetImg = trialManager?.getGcpImgForExpressionSrc?.(src);
                if (targetImg) {
                    if (!targetImg.closest('.dangan-gcp-slot')?.classList.contains('gcp-dead')) {
                        setMirroredSrc(targetImg, src);
                        // ST's setImage does a clone-swap in VN mode: the original img is
                        // removed and a clone gets the new src but inherits the OLD
                        // data-expression. Reading data-expression here would give "neutral"
                        // (stale) even when the src is "fear.png". Use the src filename
                        // as the primary expression source; fall back to data-expression.
                        let expression = '';
                        try {
                            const fname = new URL(src, location.href).pathname.split('/').pop() || '';
                            expression = fname.replace(/\.[^.]+$/, '').toLowerCase();
                        } catch { /* ignore bad src */ }
                        if (!expression) {
                            expression = (imgEl.getAttribute?.('data-expression') || '').toLowerCase();
                        }
                        if (expression) triggerVfxOnElement(expression, targetImg);
                    }
                    return;
                }
                // targetImg is null — either GCP not yet initialised, or Monokuma whose
                // overlay img doesn't exist yet.  In either case, if this src belongs to
                // Monokuma skip it entirely (the overlay handles his expressions directly).
                try {
                    const _parts = new URL(src, location.href).pathname.split('/').filter(Boolean);
                    if (_parts.length >= 2 && decodeURIComponent(_parts[_parts.length - 2]).toLowerCase() === 'monokuma') return;
                } catch { /* ignore bad src */ }
                // targetImg is null → GCP not yet initialised; fall through to debounce
                // so the expression is buffered and applied once the stage is ready.
            }

            // Solo chat: debounce
            _pendingExprSrc = src;
            clearTimeout(_exprDebounceTimer);
            _exprDebounceTimer = setTimeout(flushExpression, 80);
        }

        new MutationObserver(mutations => {
            // Deduplicate: collect each changed img.expression once per batch so we
            // always read final attribute values (src + data-expression both settled).
            const changedImgs = new Set();
            for (const m of mutations) {
                if (m.type === 'childList') {
                    for (const node of m.addedNodes) {
                        if (node.nodeType === 1 && node.matches?.('img.expression')) {
                            changedImgs.add(/** @type {HTMLImageElement} */ (node));
                        }
                    }
                } else if (m.type === 'attributes' && m.target.matches?.('img.expression')) {
                    changedImgs.add(/** @type {HTMLImageElement} */ (m.target));
                }
            }
            for (const imgEl of changedImgs) onExpressionChange(imgEl);
        }).observe(document.body, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ['data-expression', 'src'],
        });
    })();

    bdaCinematicEditor = createBdaCinematicEditor({
        extensionFolderPath,
        getCinematics: () => getMonopadSetting("bdaCinematics") || [],
        saveCinematics: (data) => {
            setMonopadSetting("bdaCinematics", data);
            saveSettingsDebounced();
        },
    });

    $(document).on("click", "#dangan_configure_deaths", () => {
        bdaCinematicEditor?.open();
    });

    executionCinematicEditor = createExecutionCinematicEditor({
        getCinematics: () => getMonopadSetting("executionCinematics") || [],
        saveCinematics: (data) => {
            setMonopadSetting("executionCinematics", data);
            saveSettingsDebounced();
        },
    });

    $(document).on("click", "#dangan_configure_executions", () => {
        executionCinematicEditor?.open();
    });

    votingScreenController = createVotingScreenController({
        extensionFolderPath,
        getCharacters: getVotingRosterCharacters,
        getUserAvatarUrl: getActiveUserAvatarUrl,
        getSpriteUrl: (charName, label = 'neutral') => getSpriteUrl(charName, label),
        getPlayerName: getActivePersonaName,
        generateVotes: async (livingNames, playerName) => {
            const npcs = livingNames.filter(n => n !== playerName);
            if (!npcs.length) return {};

            // Include recent chat context so the AI can make an informed vote
            const ctx = window.SillyTavern?.getContext?.();
            const recentLines = Array.isArray(ctx?.chat)
                ? ctx.chat.slice(-10)
                    .filter(m => !m.is_system && m.mes)
                    .map(m => `${m.name || 'Unknown'}: ${String(m.mes || '').replace(/\n/g, ' ').slice(0, 250)}`)
                    .join('\n')
                : '';

            const candidates = livingNames.join(', ');
            const contextBlock = recentLines ? `\n[Recent trial discussion]\n${recentLines}\n` : '';
            const prompt = `[Class Trial – Voting Time]${contextBlock}\nStudents casting votes: ${npcs.join(', ')}\nCandidates for blackened: ${candidates}\n\nBased on the evidence, each student casts exactly one vote. List every student's vote:\n${npcs.map(n => `${n}:`).join('\n')}\n`;

            try {
                const raw = await generateTrialDialogue(prompt, {
                    maxTokens: 400,
                    temperature: 0.8,
                    stop: ['\n\n\n', '---'],
                });
                const tally = {};
                for (const line of raw.split('\n')) {
                    const m = line.match(/^([^:]+):\s*(.+)/);
                    if (!m) continue;
                    const voter    = m[1].trim();
                    const votedRaw = m[2].trim().replace(/["""'']/g, '').split(/[,.(]/)[0].trim();
                    // Only count lines where the voter is an NPC
                    const isNpc = npcs.some(n =>
                        n.toLowerCase() === voter.toLowerCase() ||
                        voter.toLowerCase().includes(n.toLowerCase()));
                    if (!isNpc) continue;
                    const found = livingNames.find(n =>
                        n.toLowerCase() === votedRaw.toLowerCase() ||
                        votedRaw.toLowerCase().includes(n.toLowerCase()) ||
                        n.toLowerCase().includes(votedRaw.toLowerCase()));
                    if (found) tally[found] = (tally[found] || 0) + 1;
                }
                return tally;
            } catch (e) {
                console.warn('[VotingScreen] generateVotes failed:', e);
                return {};
            }
        },
    });

    voteResultsController = createVoteResultsController({
        extensionFolderPath,
        getCustomGameMasterName,
        getCustomVoteFace: () => {
            const mode = getMonopadSetting('customVoteFaceMode');
            const data = getMonopadSetting('customVoteFaceData');
            return (mode === 'custom' && data) ? data : null;
        },
        getCustomCoin: () => {
            const mode = getMonopadSetting('customCoinMode');
            const data = getMonopadSetting('customCoinData');
            return (mode === 'custom' && data) ? data : null;
        },
        isBrandingHidden: () => !!getMonopadSetting('hideHopesPeakBranding'),
        getCharacters: getVotingRosterCharacters,
        getUserAvatarUrl: getActiveUserAvatarUrl,
        getSpriteUrl: async (charName) => {
            let folder = charName;
            const stChars = window.characters;
            if (Array.isArray(stChars)) {
                const stChar = stChars.find(c => c.name === charName);
                if (stChar?.avatar) folder = stChar.avatar.replace(/\.[^.]+$/, "");
            }
            try {
                const resp = await fetch(`/api/sprites/get?name=${encodeURIComponent(folder)}`);
                if (!resp.ok) return null;
                const sprites = await resp.json();
                return sprites.find(s => s.label === "neutral")?.path ?? null;
            } catch { return null; }
        },
    });

    const getPlayerSpriteUrl = async (emotion) => {
        const prome = extension_settings?.['Prome-VN-Extension'];
        if (!prome?.enableUserSprite || !prome?.userSprite) return null;
        return getSpriteUrl(prome.userSprite, emotion).catch(() => null);
    };
    // #region debug-point A:controller-init-enter
    reportFullscreenOverlayDebug("A", "index.js:create-minigame-controllers", "About to initialize fullscreen minigame controllers", {
        hasCreateQuestionTimeController: typeof createQuestionTimeController === "function",
        hasCreateQuestionTruthController: typeof createQuestionTruthController === "function",
        hasCreateHangmansGambitController: typeof createHangmansGambitController === "function",
    });
    // #endregion
    questionTimeController   = createQuestionTimeController({ extensionFolderPath, awardMonocoins, deductMonocoins, restoreTheme: applyDynamicTheme, getPlayerSpriteUrl });
    questionTruthController  = createQuestionTruthController({ extensionFolderPath, getTruthBullets: getTruthBulletsSnapshot, awardMonocoins, deductMonocoins, restoreTheme: applyDynamicTheme, getPlayerSpriteUrl });
    const tutorialPromptDeps = {
        isTutorialPromptEnabled: () => getMonopadSetting('minigameTutorialsEnabled') !== false,
        disableTutorialPrompt:   () => setMonopadSetting('minigameTutorialsEnabled', false),
    };
    hangmansGambitController  = createHangmansGambitController({ extensionFolderPath, awardMonocoins, deductMonocoins, restoreTheme: applyDynamicTheme, pauseDynamicAudio: fadeOutAndPauseBgm, resumeDynamicAudio: resumeBgmAfterHG, playBgm: playHGBgm, getPlayerSpriteUrl, ...tutorialPromptDeps });
    // #region debug-point A:controller-init
    reportFullscreenOverlayDebug("A", "index.js:create-minigame-controllers", "Initialized fullscreen minigame controllers", {
        hangmansGambitController: Boolean(hangmansGambitController),
        questionTimeController: Boolean(questionTimeController),
        questionTruthController: Boolean(questionTruthController),
    });
    // #endregion
    argumentArmamentController = createArgumentArmamentController({ extensionFolderPath, awardMonocoins, deductMonocoins, restoreTheme: applyDynamicTheme, getPlayerSpriteUrl, ...tutorialPromptDeps });
    mindMineController        = createMindMineController({
        extensionFolderPath,
        pauseCurrentBgm: fadeOutAndPauseBgm,
        resumeCurrentBgm: resumeBgmAfterHG,
        playBgm: playMindMineBgm,
        onWin: onMindMineWin,
        getPlayerSpriteUrl,
        onStart: () => {
            document.getElementById('dangan-trial-context-panel')?.style.setProperty('display', 'none');
            document.getElementById('dangan_monopad_button')?.style.setProperty('display', 'none');
        },
        onEnd: () => {
            document.getElementById('dangan-trial-context-panel')?.style.removeProperty('display');
            document.getElementById('dangan_monopad_button')?.style.removeProperty('display');
            trialManager?.resumeAfterActivity?.();
        },
    });
    scrumDebateController     = createScrumDebateController({ extensionFolderPath, awardMonocoins, deductMonocoins, getTruthBullets: getTruthBulletsSnapshot, pauseCurrentBgm: fadeOutAndPauseBgm, resumeCurrentBgm: resumeBgmAfterHG, getScrumTracks: () => extension_settings[extensionName]?.trialScrumTracks ?? [], playBgm: playBgmForScrum, getFinalPushTrack: () => findBgmTrackByName('Class Trial - Insurrection'), onWin: onScrumDebateWin, getSpriteUrl, isCharacterDead: (name) => characters.get(normalizeName(name))?.dead === true, getPlayerSpriteUrl, getPlayerName: getActivePersonaName, getCharacterHeightCm, getCustomGameMasterName });
    rebuttalShowdownController = createRebuttalShowdownController({
        extensionFolderPath, getTruthBullets: getTruthBulletsSnapshot,
        awardMonocoins, deductMonocoins, getSpriteUrl,
        getUserAvatarUrl: getActiveUserAvatarUrl,
        getPromeSpritePack: () => {
            const prome = extension_settings?.['Prome-VN-Extension'];
            return (prome?.enableUserSprite && prome?.userSprite) ? prome.userSprite : null;
        },
        getCharacterHeightCm,
        onWin: () => trialManager?.showCounterBanner?.(),
    });
    interjectionRunner = createInterjectionCinematicRunner({ extensionFolderPath, getSpriteUrl });
    chooseCharacterController    = createChooseCharacterController({ extensionFolderPath, getLecternUrl, getSpriteUrl, getPlayerSpriteUrl, playSfx, getSfx: () => sfx });
    introduceCharacterController = createIntroduceCharacterController({ extensionFolderPath });
    chapterEndRosterController   = createChapterEndRosterController({
        extensionFolderPath,
        getCharacters:        () => characters,
        getSpriteUrl,
        getCharacterHeightCm,
        getPlayerSpriteUrl,
        getPlayerName:        getActivePersonaName,
        findBgmTrackByName,
        fadeOutAndPauseBgm,
        playBgmPath,
        getMonopadVolume:     () => getMonopadSetting('monopadVolume') ?? 50,
    });
    } catch (error) {
        bootstrapDebugUi();
        console.error(`[${extensionName}] ❌ Load failed:`, error);
        reportFullscreenOverlayDebug("A", "index.js:boot", "Extension boot try block threw", {
            message: String(error?.message || error || ""),
            stack: String(error?.stack || ""),
        });
    }
});

// ── Slash Commands ──────────────────────────────────────────────────────────

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'introduce',
    callback: async (args) => {
        const name = trialManager?.getGcpSpeakerName?.() ?? null;
        if (!name) return '';
        const ultimate  = args?.ultimate ?? lookupUltimateFromLorebook(name);
        const spriteUrl = await getSpriteUrl(name, 'neutral').catch(() => null);
        await introduceCharacterController?.run({ name, ultimate, spriteUrl });
        // Remember that this character has now been introduced so subsequent
        // UI labels (overworld hover, minimap pins, trial sticker, …) stop
        // masking them as "???". Persists across page reloads via settings.
        markCharacterIntroduced(name);
        try { overworldSceneController?.render?.(); } catch (_) {}
        try { renderMinimap(); } catch (_) {}
        return '';
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'ultimate',
            description: 'Override the Ultimate title (e.g. ultimate=Gymnast)',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: false,
        }),
    ],
    helpString: 'Shows a 4-second character introduction screen for the current speaker.',
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'nextchapter',
    callback: () => {
        const current = Number(getMonopadSetting('chapterIndex') ?? 0);
        if (current < 9) {
            setMonopadSetting('chapterIndex', current + 1);
            saveSettingsDebounced();
            updateChapterDisplay();
        }
        return '';
    },
    helpString: 'Advances the chapter: PROLOGUE → CHAPTER 1 → CHAPTER 2 → … → CHAPTER 9.',
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'endchapter',
    callback: async () => {
        const current   = Number(getMonopadSetting('chapterIndex') ?? 0);
        const fromLabel = getChapterJournalLabel(current);
        const toLabel   = getChapterJournalLabel(current + 1);
        await chapterEndRosterController?.run({ fromLabel, toLabel });
        if (current < 9) {
            setMonopadSetting('chapterIndex', current + 1);
            saveSettingsDebounced();
            updateChapterDisplay();
        }
        return '';
    },
    helpString: 'Shows the chapter-end survivor roster screen with Trial End music, then advances the chapter.',
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'epiloguechapter',
    callback: () => {
        setMonopadSetting('chapterIndex', 10);
        saveSettingsDebounced();
        updateChapterDisplay();
        return '';
    },
    helpString: 'Sets the chapter display to EPILOGUE.',
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'suspectchoosing',
    callback: async () => {
        const info = await trialManager?.getGcpInfo?.() ?? { characters: [], currentIndex: 0 };
        await chooseCharacterController?.run({ characters: info.characters, startIdx: info.currentIndex });
        return '';
    },
    helpString: 'Opens the character selection screen. Navigate with arrow keys, confirm with Enter.',
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'setclasstrialgoal',
    callback: (_, value) => {
        const goal = (value ?? '').trim();
        trialManager?.setTrialContext?.(undefined, goal, undefined);
        return '';
    },
    helpString: 'Sets the overall goal displayed in the Trial Context panel (e.g. <tt>/setclasstrialgoal Who killed Byakuya?</tt>).',
    unnamedArgumentList: [SlashCommandArgument.fromProps({ description: 'The trial goal text', typeList: [ARGUMENT_TYPE.STRING], isRequired: true })],
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'endtrial',
    callback: async () => {
        console.log('[Dangan] Manual trial termination requested.');
        trialManager?.endTrial();
        return '';
    },
    helpString: 'Immediately ends the current Class Trial and clears persistent state.',
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'nonstopdebate',
    callback: async (args, value) => {
        const lines = [];
        for (let i = 1; i <= 8; i++) {
            const arg = args[`s${i}-q`];
            if (arg) lines.push(arg);
        }
        if (!lines.length && value) {
            lines.push(value);
        }
        if (lines.length) {
            trialManager?.debugStartNonStopDebateWithLines(lines);
            return '';
        }
        toastr.info('Please provide at least one line: /nonstopdebate s1-q="Your line"');
        return '';
    },
    namedArguments: [
        SlashCommandNamedArgument.fromProps({ name: 's1-q', description: 'Section 1 Dialogue', typeList: [ARGUMENT_TYPE.STRING] }),
        SlashCommandNamedArgument.fromProps({ name: 's2-q', description: 'Section 2 Dialogue', typeList: [ARGUMENT_TYPE.STRING] }),
        SlashCommandNamedArgument.fromProps({ name: 's3-q', description: 'Section 3 Dialogue', typeList: [ARGUMENT_TYPE.STRING] }),
        SlashCommandNamedArgument.fromProps({ name: 's4-q', description: 'Section 4 Dialogue', typeList: [ARGUMENT_TYPE.STRING] }),
        SlashCommandNamedArgument.fromProps({ name: 's5-q', description: 'Section 5 Dialogue', typeList: [ARGUMENT_TYPE.STRING] }),
        SlashCommandNamedArgument.fromProps({ name: 's6-q', description: 'Section 6 Dialogue', typeList: [ARGUMENT_TYPE.STRING] }),
        SlashCommandNamedArgument.fromProps({ name: 's7-q', description: 'Section 7 Dialogue', typeList: [ARGUMENT_TYPE.STRING] }),
        SlashCommandNamedArgument.fromProps({ name: 's8-q', description: 'Section 8 Dialogue', typeList: [ARGUMENT_TYPE.STRING] }),
    ],
    helpString: 'Force start a Non-stop Debate with specific lines for debugging.',
}));

// Shared line pool for all NSD test commands (24 lines, one per max section)
// whiteNoise: string or string[] of unique reactions spawned over weak-point lines (null = none)
const NSD_TEST_LINES = [
    { text: "There's no way anyone could have entered the room without a key!", whiteNoise: null },
    { text: "[[The security footage clearly shows the door was locked all night.]]", whiteNoise: ["Static interference detected...", "That can't be right!", "No way...", "I don't believe it"] },
    { text: "I was with someone the entire time — I have a perfect alibi!", whiteNoise: null },
    { text: "None of you were even near the scene when it happened...", whiteNoise: null },
    { text: "The evidence you're pointing to doesn't prove anything at all!", whiteNoise: null },
    { text: "That's a complete lie and you know it!", whiteNoise: null },
    { text: "The body wasn't discovered until after the morning announcement.", whiteNoise: null },
    { text: "[[Someone must have tampered with the investigation before we got there.]]", whiteNoise: ["SIGNAL LOST — SIGNAL LOST", "Stop lying!!", "Who would do that?!", "This is wrong..."] },
    { text: "I heard a noise coming from the hallway around that time — ((and I know you heard it too))!", whiteNoise: null },
    { text: "It's impossible for one person to have done all of this alone.", whiteNoise: null },
    { text: "The motive doesn't make any sense for any of us!", whiteNoise: null },
    { text: "Why would anyone risk exposure like that so carelessly?", whiteNoise: null },
    { text: "There were two sets of footprints leading away from the scene.", whiteNoise: null },
    { text: "[[The weapon was never found, which changes everything!]]", whiteNoise: ["White Noise — do not trust this", "That changes everything!", "Oh no...", "Wait, what?!"] },
    { text: "I saw someone near the [[storage room]] just before the body was found.", whiteNoise: null },
    { text: "That testimony completely contradicts what the others said earlier.", whiteNoise: null },
    { text: "None of the windows were broken — so how did they escape?", whiteNoise: null },
    { text: "The time of death puts everything you're saying in question.", whiteNoise: null },
    { text: "I never touched the door handle — check for fingerprints if you want!", whiteNoise: null },
    { text: "((Someone is lying to protect themselves right now in this very room.))", whiteNoise: null },
    { text: "[[That argument only works if you ignore what happened before noon!]]", whiteNoise: ["╳ ╳ ╳  interference  ╳ ╳ ╳", "Shut up already!", "Grr...", "I can't take this!"] },
    { text: "There's a witness — someone saw the whole thing and stayed quiet.", whiteNoise: null },
    { text: "The real killer is trying to frame an innocent person in this room!", whiteNoise: null },
    { text: "[[Everything points to the fact that this murder was planned in advance.]]", whiteNoise: ["ERROR — DATA CORRUPTED", "This is terrifying...", "I knew it!", "We're all doomed"] },
];

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'startNonStopDebateTest',
    callback: async (args) => {
        const entries = NSD_TEST_LINES.map((line, i) => ({
            text: line.text,
            whiteNoise: line.whiteNoise || null,
            speaker: String(args[`speaker${i + 1}`] || '').trim(),
        }));
        trialManager?.debugStartNonStopDebateWithLines(entries);
        return '';
    },
    namedArguments: Array.from({ length: 24 }, (_, i) =>
        SlashCommandNamedArgument.fromProps({
            name: `speaker${i + 1}`,
            description: `Speaker for line ${i + 1} (leave blank to pick randomly from current characters)`,
            typeList: [ARGUMENT_TYPE.STRING],
        })
    ),
    helpString: 'Start a Non-stop Debate with 24 stubbed test lines for debugging. Optionally set speaker1 through speaker24 to assign specific speakers per line.',
}));

function makeNsdTestCommand(name, lineCount, helpSuffix) {
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name,
        callback: async (args) => {
            const entries = NSD_TEST_LINES.slice(0, lineCount).map((line, i) => ({
                text: line.text,
                whiteNoise: line.whiteNoise || null,
                speaker: String(args[`speaker${i + 1}`] || '').trim(),
            }));
            trialManager?.debugStartNonStopDebateWithLines(entries);
            return '';
        },
        namedArguments: Array.from({ length: lineCount }, (_, i) =>
            SlashCommandNamedArgument.fromProps({
                name: `speaker${i + 1}`,
                description: `Speaker for line ${i + 1}`,
                typeList: [ARGUMENT_TYPE.STRING],
            })
        ),
        helpString: `Start a Non-stop Debate with ${lineCount} test lines (${helpSuffix}). Optionally set speaker1–speaker${lineCount}.`,
    }));
}

makeNsdTestCommand('startNonStopDebateTestSmall',      4,  'Small: 1–5 sections, 3 bullets');
makeNsdTestCommand('startNonStopDebateTestMedium',     9,  'Medium: 6–11 sections, 5 bullets');
makeNsdTestCommand('startNonStopDebateTestLarge',      14, 'Large: 12–17 sections, 7 bullets');
makeNsdTestCommand('startNonStopDebateTestExtraLarge', 20, 'Extra-large: 18+ sections, full bullet list');

// ── Mass Panic Debate slash commands ────────────────────────────────────────

/**
 * Build a scenario array from flat named args.
 * sc1-c1-q / sc1-c2-q / sc1-c3-q ... sc8-c3-q
 * The weak-spot column is inferred from [[...]] markup.
 */
function buildMpdScenariosFromArgs(args, maxScenarios = 8) {
    const scenarios = [];
    for (let s = 1; s <= maxScenarios; s++) {
        const texts = [];
        for (let c = 1; c <= 3; c++) {
            const t = String(args[`sc${s}-c${c}-q`] || '').trim();
            if (t) texts.push({ text: t, speaker: String(args[`sc${s}-c${c}-speaker`] || '').trim() });
        }
        if (texts.length === 3) scenarios.push({ texts });
        else if (texts.length > 0 && texts.length < 3) {
            // Pad to 3 with empty strings
            while (texts.length < 3) texts.push({ text: '...', speaker: '' });
            scenarios.push({ texts });
        }
    }
    return scenarios;
}

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'masspanicdebate',
    callback: async (args) => {
        const scenarios = buildMpdScenariosFromArgs(args, 8);
        if (!scenarios.length) {
            toastr.info('Provide at least one full scenario: /masspanicdebate sc1-c1-q="..." sc1-c2-q="..." sc1-c3-q="..."');
            return '';
        }
        trialManager?.startMassPanicDebate(scenarios);
        return '';
    },
    namedArguments: Array.from({ length: 8 }, (_, s) =>
        [1, 2, 3].map(c => [
            SlashCommandNamedArgument.fromProps({ name: `sc${s + 1}-c${c}-q`,      description: `Scenario ${s + 1} column ${c} text`,    typeList: [ARGUMENT_TYPE.STRING] }),
            SlashCommandNamedArgument.fromProps({ name: `sc${s + 1}-c${c}-speaker`, description: `Scenario ${s + 1} column ${c} speaker`, typeList: [ARGUMENT_TYPE.STRING] }),
        ])
    ).flat(2),
    helpString: 'Start a Mass Panic Debate. Each scenario needs three text columns (c1/c2/c3). Mark one weak spot per scenario with [[brackets]].',
}));

function makeMpdTestCommand(name, scenarioCount, helpSuffix) {
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name,
        callback: async () => {
            trialManager?.startMassPanicDebate(MPD_TEST_SCENARIOS.slice(0, scenarioCount));
            return '';
        },
        helpString: `Start a Mass Panic Debate test (${helpSuffix}) with ${scenarioCount} scenarios.`,
    }));
}

makeMpdTestCommand('startMassPanicDebateTestSmall',      3,  'SM');
makeMpdTestCommand('startMassPanicDebateTestMedium',     6,  'MD');
makeMpdTestCommand('startMassPanicDebateTestLarge',      9,  'LG');
makeMpdTestCommand('startMassPanicDebateTestExtraLarge', 12, 'XL');

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'scrumdebate',
    callback: async () => {
        await scrumDebateController?.run({
            timerMs: resolveSkillParam("scrumTimer", 180000),
            playerHp: resolveSkillParam("scrumHealth", 3),
        });
        return '';
    },
    helpString: 'Starts the Scrum Debate minigame. Two teams clash over contradictory theories; match each opposing key point with the correct rebuttal, then mash to finish each exchange.',
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'mindmine',
    callback: async (args) => {
        const raw  = String(args?.sentence ?? args?._ ?? '').trim();
        const sArr = raw ? raw.split('|').map(s => s.trim()).filter(Boolean) : [];
        const time = parseInt(args?.time, 10) || 120;
        await mindMineController?.run({
            sentences: sArr,
            timeLimit: resolveSkillParam("mindMineTimer", time),
            penaltyMs: resolveSkillParam("mindMinePenalty", 10) * 1000,
        });
        return '';
    },
    helpString: 'Starts the Mind Mine block-clearing puzzle. Optional named args: sentence="s1|s2|s3" (pipe-separated sentences to uncover), time=120 (seconds).',
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({ name: 'sentence', description: 'Pipe-separated sentences the player must uncover', typeList: [ARGUMENT_TYPE.STRING], isRequired: false }),
        SlashCommandNamedArgument.fromProps({ name: 'time',     description: 'Time limit in seconds (default 120)',               typeList: [ARGUMENT_TYPE.NUMBER], isRequired: false }),
    ],
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'bodydiscovery',
    callback: async (args) => {
        const bgName = String(args.bg || '').trim();
        const cinematicName = String(args.cinematic || '').trim();

        // Look up named cinematic (if requested), or default to the first configured cinematic.
        // If bg= is explicitly provided without cinematic=, skip auto-selection so the bg switch runs.
        const allCinematics = getMonopadSetting('bdaCinematics') || [];
        const cinematic = cinematicName
            ? allCinematics.find(c => c.name?.toLowerCase() === cinematicName.toLowerCase()) ?? null
            : bgName ? null : (allCinematics[0] ?? null);

        // Switch the background underneath the static overlay so the transition is hidden
        const switchBackground = () => {
            if (!bgName || cinematic) return;
            const bgElements = Array.from(document.querySelectorAll('.bg_example'));
            const lower = bgName.toLowerCase();
            const match = bgElements.find(el => el.getAttribute('bgfile')?.toLowerCase().includes(lower));
            if (match instanceof HTMLElement) match.click();
        };

        // 1. Static + vignette overlay (despair noise) — swap BG at peak while hidden
        //    If a named cinematic is given, pass it so the controller uses custom playback.
        const overlayPromise = monokumaAnnouncementController?.triggerAsync('BODY_DISCOVERY', { cinematic });
        if (!cinematic) setTimeout(switchBackground, 220);
        await overlayPromise;

        // 2. Body Discovery Announcement (BDA)
        await monokumaAnnouncementController?.triggerAsync('BDA');

        // 3. Investigation banner + SFX + dynamic theme
        investigationStartController.trigger();
        applyDynamicTheme();
        return '';
    },
    helpString: 'Plays the body discovery vignette, then the BDA, then triggers Investigation. Optional: bg=&lt;name&gt; to switch background under static; cinematic=&lt;name&gt; to use a configured BDA cinematic.',
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'bg',
            description: 'Background image to switch to under the static effect (partial name match)',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: false,
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'cinematic',
            description: 'Name of a configured body discovery cinematic to play instead of the default sequence',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: false,
        }),
    ],
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'punishmenttime',
    callback: async (args) => {
        const charName = String(args.name || '').trim();
        if (!charName) return '';

        const allCinematics = getMonopadSetting('executionCinematics') || [];
        const cinematic = allCinematics.find(c => c.name?.toLowerCase() === charName.toLowerCase()) ?? null;

        await runExecutionCinematic(cinematic, charName);

        // Mark character as dead after execution
        for (const [, char] of characters) {
            if (normalizeName(char.name) === normalizeName(charName)) {
                char.dead = true;
                saveCharacters();
                break;
            }
        }
        return '';
    },
    helpString: 'Plays an execution cinematic for the named character, then marks them as dead.',
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'name',
            description: 'Character name — must match an execution cinematic and a registered character',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
        }),
    ],
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'passtime',
    callback: async () => { await passTimeToNight({ source: 'slash_command' }); return ''; },
    helpString: 'Triggers the nighttime announcement, shows a Night Time Start banner, then switches to the Night theme.',
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'gotosleep',
    callback: async () => { await sleepToNextDay({ source: 'slash_command' }); return ''; },
    helpString: 'Advances to the next day, plays the daytime announcement, shows a Free Time Start banner, then switches to the Day theme.',
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'givetruthbullet',
    callback: (args, description) => {
        const name = String(args.name || '').trim();
        const desc = String(description || '').trim();
        if (!name) return 'Error: name is required.';
        const added = handleTruthBullet(name, desc);
        if (!added) return `Truth Bullet "${name}" already exists.`;
        return '';
    },
    helpString: 'Creates a Truth Bullet. Use quotes around the name if it contains spaces: name="Bloody Knife". The description is everything after the named args.',
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'name',
            description: 'The name of the Truth Bullet (quote if it contains spaces)',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'The description of the Truth Bullet',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
        }),
    ],
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'votingtime',
    callback: async (args) => {
        const guess  = String(args.guess  || '').trim() || null;
        const result = String(args.result || '').trim() || null;
        await voteResultsController?.run({ guess, result });
        return '';
    },
    helpString: 'Spins the class trial vote roulette. guess=&lt;name&gt; is who was voted for. result=&lt;name&gt; is the actual blackened (optional, random if omitted). Fails if guess ≠ result.',
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'guess',
            description: 'The character that was voted for (partial name match)',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: false,
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'result',
            description: 'The actual blackened character (partial name match). Random if omitted.',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: false,
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'characters',
            description: 'Comma-separated list of all characters in the vote (informational)',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: false,
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'votes',
            description: 'Vote tally, e.g. "Name:2,OtherName:1" (informational)',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: false,
        }),
    ],
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'questiontime',
    callback: async (args) => {
        const title   = String(args.title   || '').trim();
        const time    = Math.max(1, Number(args.time)   || 30);
        const correct = Math.min(4, Math.max(1, Number(args.correct) || 1));
        const answers = [
            String(args.a1 || '').trim(),
            String(args.a2 || '').trim(),
            String(args.a3 || '').trim(),
            String(args.a4 || '').trim(),
        ];
        if (!title || answers.some(a => !a)) {
            console.warn('[QuestionTime] title and all four answers are required.');
            return '';
        }
        // #region debug-point C:qtime-slash-entry
        reportFullscreenOverlayDebug("C", "index.js:/questiontime", "Entered Question Time slash command", {
            questionTimeController: Boolean(questionTimeController),
            answersCount: answers.length,
            correct,
        });
        // #endregion
        const won = await questionTimeController?.run({ title, time: resolveSkillParam("qttTimer", time), answers, correct });
        // #region debug-point C:qtime-slash-run
        reportFullscreenOverlayDebug("C", "index.js:/questiontime", "Question Time slash command completed run()", {
            won: Boolean(won),
        });
        // #endregion
        if (won) awardXp(XP_REWARDS.questionTime ?? 8, 'question time completed');
        return '';
    },
    helpString: 'Displays a Danganronpa-style question with four answers and a countdown timer. Correct answer triggers GOT IT banner.',
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({ name: 'title',   description: 'The question to display',     typeList: [ARGUMENT_TYPE.STRING], isRequired: true }),
        SlashCommandNamedArgument.fromProps({ name: 'time',    description: 'Time limit in seconds',       typeList: [ARGUMENT_TYPE.NUMBER], isRequired: true }),
        SlashCommandNamedArgument.fromProps({ name: 'a1',      description: 'Answer option 1',             typeList: [ARGUMENT_TYPE.STRING], isRequired: true }),
        SlashCommandNamedArgument.fromProps({ name: 'a2',      description: 'Answer option 2',             typeList: [ARGUMENT_TYPE.STRING], isRequired: true }),
        SlashCommandNamedArgument.fromProps({ name: 'a3',      description: 'Answer option 3',             typeList: [ARGUMENT_TYPE.STRING], isRequired: true }),
        SlashCommandNamedArgument.fromProps({ name: 'a4',      description: 'Answer option 4',             typeList: [ARGUMENT_TYPE.STRING], isRequired: true }),
        SlashCommandNamedArgument.fromProps({ name: 'correct', description: 'Correct answer number (1–4)', typeList: [ARGUMENT_TYPE.NUMBER], isRequired: true }),
    ],
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'questiontruth',
    callback: async (args) => {
        const question = String(args.question || '').trim();
        const answer   = String(args.answer   || '').trim();
        if (!question || !answer) {
            console.warn('[QuestionTruth] question and answer are required.');
            return '';
        }
        const time = args.time ? Number(args.time) : 0;
        // #region debug-point D:qtruth-slash-entry
        reportFullscreenOverlayDebug("D", "index.js:/questiontruth", "Entered Question Truth slash command", {
            questionTruthController: Boolean(questionTruthController),
            questionLength: question.length,
            answerLength: answer.length,
        });
        // #endregion
        const won = await questionTruthController?.run({ question, answer, time: resolveSkillParam("qthTimer", time), playerHp: resolveSkillParam("qthHealth", 5) });
        // #region debug-point D:qtruth-slash-run
        reportFullscreenOverlayDebug("D", "index.js:/questiontruth", "Question Truth slash command completed run()", {
            won: Boolean(won),
        });
        // #endregion
        if (won) awardXp(XP_REWARDS.questionTruth ?? 10, 'question truth completed');
        return '';
    },
    helpString: 'Displays the Truth Bullet list and asks the player to select the correct one. Correct answer gives 5 monocoins and the GOT IT banner.',
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({ name: 'question', description: 'The statement to answer',           typeList: [ARGUMENT_TYPE.STRING], isRequired: true }),
        SlashCommandNamedArgument.fromProps({ name: 'answer',   description: 'Name of the correct Truth Bullet',  typeList: [ARGUMENT_TYPE.STRING], isRequired: true }),
        SlashCommandNamedArgument.fromProps({ name: 'time',     description: 'Optional time limit in seconds',    typeList: [ARGUMENT_TYPE.NUMBER], isRequired: false }),
    ],
}));

// /moveto — moves the player between connected rooms / areas / sub-areas, updates
// the chat background to the destination pin's BG, and remembers the current
// location across reloads.
function getCurrentLocationId() {
    return extension_settings[extensionName]?.map?.currentLocationId || null;
}
function setCurrentLocationId(locationId) {
    const root = extension_settings[extensionName] ??= {};
    root.map ??= {};
    const prev = root.map.currentLocationId || null;
    root.map.currentLocationId = locationId || null;
    saveSettingsDebounced();
    // When the room changes, drop any drag-overrides so the character pins fall
    // back to the default ring around the *new* room on the next render.
    if (prev !== root.map.currentLocationId) {
        _minimapCharPositions.clear();
        _minimapSig = null;
    }
    updateCurrentRoomDisplay();
}

// Slim transparent slab under the level bar that displays the player's current
// room name. Styled to match the BGM panel's controls strip (transparent
// skewed slab) with the same blue italic uppercase label used by
// "PHASES - DAYTIME" (the .dbgm-playlist-label colour).
function ensureCurrentRoomPanel() {
    let panel = document.getElementById('dangan-current-room');
    if (panel) return panel;
    const wrapper = document.getElementById('dangan-hud-topright');
    if (!wrapper) return null; // level bar / hud not built yet — retry next call
    panel = document.createElement('div');
    panel.id = 'dangan-current-room';
    const label = document.createElement('span');
    label.className = 'dangan-current-room-label';
    panel.appendChild(label);
    wrapper.appendChild(panel);
    return panel;
}

function updateCurrentRoomDisplay() {
    const panel = ensureCurrentRoomPanel();
    if (!panel) return;
    const label = panel.querySelector('.dangan-current-room-label');
    if (!label) return;
    const id = getCurrentLocationId();
    if (!id) { label.textContent = '—'; return; }
    const pin = mapPanelController?.getPinByLocationId?.(id);
    if (pin?.label) { label.textContent = pin.label; return; }
    if (id.startsWith('area:'))    { label.textContent = id.slice(5); return; }
    if (id.startsWith('subarea:')) { label.textContent = id.slice(8); return; }
    label.textContent = id;
}

// Arrive at a map pin behind a fade-to-black wash. The sfx plays in sync
// with the fade-in; once we're fully black we do the actual room swap
// (location id, chat bg, pin BGM, overworld notify, side panels). The
// visible transition (fade-in + black hold + fade-out) is DECOUPLED from
// the sfx length — the sfx plays in the background and is allowed to
// outlive the fade. This keeps the screen-in-black time short.
//
// Timing reference (t=0 is the moment the sfx starts):
//   t=0        → fade-in begins (ROOM_FADE_IN_MS inline override)
//   t~200ms    → fully black; room-change side effects fire here
//   t~470ms    → unfade begins (ROOM_BLACK_HOLD_MS past swap)
//   t~1070ms   → fully unfaded; overlay removed
//   sfx ends whenever its duration says, independently of the visual.
const ROOM_FADE_IN_MS = 200;
const ROOM_BLACK_HOLD_MS = 250; // black-hold past the swap so it settles
const ROOM_FADE_OUT_MS = 600;
function performPinArrivalWithFade(pin) {
    if (!pin) return;
    const audio = sfx?.change_rooms;

    const fade = document.createElement('div');
    fade.className = 'dangan-ow-fadeout';
    // Override the shared 280ms CSS transition with the snappier fade-in.
    fade.style.transition = `opacity ${ROOM_FADE_IN_MS}ms ease`;
    document.body.appendChild(fade);

    // Double-rAF so the initial opacity:0 is committed before flipping .on —
    // otherwise the transition would skip and we'd cut straight to black.
    requestAnimationFrame(() => requestAnimationFrame(() => {
        fade.classList.add('on');
        document.body.classList.add('dangan-ow-fading');
        if (audio) playSfx(audio);
    }));

    // After the fade-in completes, the screen is fully covered — perform the
    // visible room-change steps behind the black wash. Small buffer past the
    // fade-in commit so the swap definitely happens behind full opacity.
    const swapAtMs = ROOM_FADE_IN_MS + 20;
    setTimeout(() => {
        setCurrentLocationId(pin.locationId);
        if (pin.bg)  mapPanelController.switchChatBackground?.(pin.bg);
        if (pin.bgm) mapPanelController.playPinBgm?.(pin.bgm);
        mapPanelController.highlightPinByLocationId?.(pin.locationId);
        // Companion characters (1-on-1 partner or group members) follow the
        // player into the new room so their overworld presence stays accurate.
        overworldSceneController?.notifyPlayerMovedTo?.(pin.locationId);
        renderMoveToPanel();
        renderMinimap();
        overworldSceneController?.render?.();
    }, swapAtMs);

    // Unfade right after the black-hold — independent of sfx duration so the
    // total room-change feels snappy even when the sfx tail is long.
    const unfadeStartMs = swapAtMs + ROOM_BLACK_HOLD_MS;
    setTimeout(() => {
        fade.style.transition = `opacity ${ROOM_FADE_OUT_MS}ms ease`;
        fade.classList.remove('on');
        document.body.classList.remove('dangan-ow-fading');
    }, unfadeStartMs);

    setTimeout(() => { fade.remove(); }, unfadeStartMs + ROOM_FADE_OUT_MS + 100);
}

// Resolve a destination string (label/ref/value) against the current pin's
// connection list and execute the move. Shared by /moveto and the side panel
// buttons so they behave identically.
function moveToDestination(raw) {
    if (!mapPanelController) return false;
    const currentId = getCurrentLocationId();
    if (!currentId) return false;
    const conns = mapPanelController.getConnectionsForLocationId?.(currentId) ?? [];
    const lcRaw = String(raw || '').trim().toLowerCase();
    if (!lcRaw) return false;
    const dest = conns.find(c => c.label?.toLowerCase() === lcRaw)
              || conns.find(c => c.ref?.toLowerCase() === lcRaw)
              || conns.find(c => c.value?.toLowerCase() === lcRaw);
    if (!dest) return false;

    if (dest.kind === 'pin') {
        const pin = mapPanelController.getPinByLocationId?.(dest.value);
        if (!pin) return false;
        // Helper handles fade, sfx, room swap, and all the panel re-renders —
        // return early so we don't re-render before the fade has even started.
        performPinArrivalWithFade(pin);
        return true;
    } else if (dest.kind === 'area') {
        mapPanelController.navigateToArea?.(dest.value);
        setCurrentLocationId(`area:${dest.value}`);
    } else if (dest.kind === 'subarea') {
        mapPanelController.navigateToArea?.(dest.areaKey, dest.floorKey);
        setCurrentLocationId(`subarea:${dest.areaKey}/${dest.floorKey}`);
    }
    renderMoveToPanel();
    renderMinimap();
    overworldSceneController?.render?.();
    return true;
}

// Fixed left-side panel listing every connection from the current location as
// a "Move to <name>" button. NEVER renders during any Class Trial phase. Always
// rendered otherwise (with an empty-state hint when the current pin has no
// connections, or when no current location is set yet) so the player can see
// the panel exists.
let _moveToPanelSig = null;
let _minimapSig = null;
// Pan offset for the minimap, persisted across re-renders. Reset whenever the
// underlying floor image changes (so each new floor starts un-panned).
let _minimapPan = { tx: 0, ty: 0, imageSrc: null };
let _minimapZoom = 1.0;
const MINIMAP_ZOOM_MIN  = 1.0;
const MINIMAP_ZOOM_MAX  = 2.5;
const MINIMAP_ZOOM_STEP = 0.25;

// Rotated-square minimap rendered bottom-right outside Class Trials.
// Mirrors the moveTo panel's visibility gates: hides during any trial phase and
// while the Monopad is open. Shows only the current sub-area's floor + location
// pins (rooms / monomachines / trials) — no evidence, no bodies, no hover.
function renderMinimap() {
    const existing = document.getElementById('dangan-minimap');
    const removeIt = () => { if (existing) { existing.remove(); _minimapSig = null; } };

    if (isTrialUiActive()) { removeIt(); return; }
    const monopad = document.getElementById('dangan_monopad_panel');
    if (monopad?.classList.contains('open')) { removeIt(); return; }

    // Pass the player's current location so the minimap shows THAT floor, not
    // whatever the Map panel happened to be displaying last.
    const data = mapPanelController?.getMinimapState?.(getCurrentLocationId());
    if (!data?.imageSrc) { removeIt(); return; }

    const pinSig = data.pins.map(p => `${p.id}:${p.x}:${p.y}`).join(';');
    // Include the current location + recent speaker + group composition in the
    // signature so character pins update when the conversation moves.
    const ctxSnap = window.SillyTavern?.getContext?.();
    const lastSpeaker = ctxSnap?.chat
        ? [...ctxSnap.chat].reverse().find(m => m && !m.is_system && m.name && !m.is_user)?.name
        : null;
    const groupSig = ctxSnap?.groupId
        ? (Array.isArray(ctxSnap.groups) ? ctxSnap.groups : []).find(g => String(g.id) === String(ctxSnap.groupId))?.members?.join(',') || ''
        : (ctxSnap?.name2 || '');
    // Include the overworld occupant list so randomization / movement that
    // shuffles people in/out of the current room rebuilds the pins.
    const owSig = (() => {
        const currentId = getCurrentLocationId();
        if (!currentId) return '';
        const list = overworldSceneController?.getCharactersInRoom?.(currentId) || [];
        return list.map(c => `${c.name}/${c.groupId || ''}`).join(',');
    })();
    const sig = `${data.areaKey}/${data.floorKey}|${data.imageSrc}|${pinSig}|cur:${getCurrentLocationId() || ''}|spk:${lastSpeaker || ''}|grp:${groupSig}|ow:${owSig}`;
    if (existing && sig === _minimapSig) return;
    _minimapSig = sig;

    const root = existing || document.createElement('div');
    root.id = 'dangan-minimap';
    root.innerHTML = '';

    const square = document.createElement('div');
    square.className = 'dangan-minimap-square';

    // Image lives inside an aspect-ratio-matched wrapper so the pin %-coords
    // (which live in the floor image's coordinate space) align with the image
    // pixels even though the diamond outer frame is square.
    const mapWrap = document.createElement('div');
    mapWrap.className = 'dangan-minimap-map';
    mapWrap.style.aspectRatio = `${data.mapWidth} / ${data.mapHeight}`;

    const img = document.createElement('img');
    img.className = 'dangan-minimap-image';
    img.src = data.imageSrc;
    img.alt = '';
    img.draggable = false;
    mapWrap.appendChild(img);

    const pinLayer = document.createElement('div');
    pinLayer.className = 'dangan-minimap-pin-layer';
    const currentId = getCurrentLocationId();
    const currentPin = (currentId && !currentId.startsWith('area:') && !currentId.startsWith('subarea:'))
        ? mapPanelController?.getPinByLocationId?.(currentId)
        : null;
    for (const p of data.pins) {
        const isCurrent = currentPin && p.id === currentPin.id;
        const pin = document.createElement('div');
        pin.className = `dangan-minimap-pin dangan-minimap-pin-${p.type}${isCurrent ? ' dangan-minimap-pin-current' : ''}`;
        pin.style.left = `${(p.x / data.mapWidth) * 100}%`;
        pin.style.top  = `${(p.y / data.mapHeight) * 100}%`;
        if (p.iconUrl) {
            const i = document.createElement('img');
            i.src = p.iconUrl;
            i.alt = '';
            i.draggable = false;
            pin.appendChild(i);
        }
        pinLayer.appendChild(pin);
    }
    mapWrap.appendChild(pinLayer);

    // Character/location-marker layer — gold pulsing circle for the player's
    // current room, plus per-character pins (player / speaker / group members).
    renderMinimapCharacterLayer(mapWrap, data, currentPin);

    square.appendChild(mapWrap);

    root.appendChild(square);

    // Zoom controls — two small rotated-square buttons on the right.
    const zoomCol = document.createElement('div');
    zoomCol.className = 'dangan-minimap-zoom';
    const zoomIn  = document.createElement('button');
    zoomIn.type = 'button';
    zoomIn.className = 'dangan-minimap-zoom-btn dangan-minimap-zoom-in';
    zoomIn.title = 'Zoom in';
    zoomIn.innerHTML = '<span>+</span>';
    const zoomOut = document.createElement('button');
    zoomOut.type = 'button';
    zoomOut.className = 'dangan-minimap-zoom-btn dangan-minimap-zoom-out';
    zoomOut.title = 'Zoom out';
    zoomOut.innerHTML = '<span>−</span>';
    zoomCol.appendChild(zoomIn);
    zoomCol.appendChild(zoomOut);

    // Flat-render toggle — diamond on the LEFT side of the minimap, mirroring
    // the zoom column on the right. Lit when the current room is in flat mode.
    const flatCol = document.createElement('div');
    flatCol.className = 'dangan-minimap-flat-toggle-col';
    const flatBtn = document.createElement('button');
    flatBtn.type = 'button';
    flatBtn.className = 'dangan-minimap-zoom-btn dangan-minimap-flat-toggle';
    const playerRoomId = getCurrentLocationId();
    const isFlat = playerRoomId ? overworldSceneController?.isRoomFlat?.(playerRoomId) : false;
    if (isFlat) flatBtn.classList.add('is-active');
    flatBtn.title = isFlat
        ? 'Perspective locked (flat rendering) — click to unlock and restore perspective.'
        : 'Lock this room to flat rendering (disable perspective).';
    flatBtn.innerHTML = `<span><i class="fa-solid ${isFlat ? 'fa-lock' : 'fa-lock-open'}"></i></span>`;
    flatBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        overworldSceneController?.toggleCurrentRoomFlat?.();
        _minimapSig = null;
        renderMinimap();
    });
    flatBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
    flatCol.appendChild(flatBtn);

    root.appendChild(flatCol);
    root.appendChild(zoomCol);

    // UI-hide toggle — diamond button at the BOTTOM of the minimap, mirroring
    // the flat-toggle column at the top. Hides every visible UI element so
    // the scene background can be appreciated; clicking anywhere on the
    // screen while hidden brings the UI back.
    const hideCol = document.createElement('div');
    hideCol.className = 'dangan-minimap-ui-toggle-col';
    const hideBtn = document.createElement('button');
    hideBtn.type = 'button';
    hideBtn.className = 'dangan-minimap-zoom-btn dangan-minimap-ui-toggle';
    hideBtn.title = 'Photo Mode — hide the UI (click anywhere to restore)';
    hideBtn.innerHTML = '<span><i class="fa-solid fa-camera"></i></span>';
    hideBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.body.classList.add('dangan-ui-hidden');
    });
    hideBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
    hideCol.appendChild(hideBtn);
    root.appendChild(hideCol);

    // One-shot global listener that restores the UI on any click while hidden.
    // Capture phase + stopPropagation so the click that restores the UI doesn't
    // accidentally trigger something underneath (e.g. a chat message).
    if (!window._danganUIHideRestoreBound) {
        window._danganUIHideRestoreBound = true;
        window.addEventListener('click', (e) => {
            if (!document.body.classList.contains('dangan-ui-hidden')) return;
            e.stopPropagation();
            e.preventDefault();
            document.body.classList.remove('dangan-ui-hidden');
        }, true);
    }

    // Reset pan + zoom if the floor changed; otherwise preserve the player's view.
    if (_minimapPan.imageSrc !== data.imageSrc) {
        _minimapPan = { tx: 0, ty: 0, imageSrc: data.imageSrc };
        _minimapZoom = 1.0;
    }
    applyMinimapTransform(mapWrap);

    zoomIn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (_minimapZoom >= MINIMAP_ZOOM_MAX) return;
        _minimapZoom = Math.min(MINIMAP_ZOOM_MAX, Math.round((_minimapZoom + MINIMAP_ZOOM_STEP) * 100) / 100);
        applyMinimapTransform(root.querySelector('.dangan-minimap-map'));
    });
    zoomOut.addEventListener('click', (e) => {
        e.stopPropagation();
        if (_minimapZoom <= MINIMAP_ZOOM_MIN) return;
        _minimapZoom = Math.max(MINIMAP_ZOOM_MIN, Math.round((_minimapZoom - MINIMAP_ZOOM_STEP) * 100) / 100);
        applyMinimapTransform(root.querySelector('.dangan-minimap-map'));
    });
    // Prevent button presses from initiating the diamond drag.
    zoomIn.addEventListener('pointerdown',  (e) => e.stopPropagation());
    zoomOut.addEventListener('pointerdown', (e) => e.stopPropagation());

    if (!existing) {
        document.body.appendChild(root);
        // Drag is attached to the outer root, not the rotated square — the square's
        // clip + rotation made hit-testing flaky at high zoom levels. Zoom buttons
        // and character pins both stop propagation on pointerdown so they remain
        // independently interactive without triggering a pan.
        attachMinimapDrag(root);
    }
}

// Distinct colours assigned by index to group-chat members other than the
// player and the active speaker. Cycles when the group is larger than the list.
const MINIMAP_OTHER_COLORS = [
    '#56e2ff', '#b366ff', '#8cff66', '#ffb14d', '#ff66bb', '#ffe05a', '#5a9bff', '#9fff5a',
];

// Per-character drag-override positions for the minimap, keyed by character name.
// { xPct, yPct } — survives re-renders so the player's manual placement sticks,
// and is rehydrated from extension_settings on each room render so it also
// survives page reloads. The on-disk store is partitioned by room id so each
// room keeps its own arrangement: switching rooms drops the in-memory map and
// the next render reloads positions for the new room (or starts fresh).
const _minimapCharPositions = new Map();
// Per-character teardrop rotation in degrees, keyed by character name. Cached
// once per character so the teardrop point doesn't change direction on every
// re-render (which would look chaotic).
const _minimapCharRotations = new Map();

// Lazy accessor for the persisted store. Shape:
//   extension_settings[extensionName].map.charPositions = {
//     [roomId]: { [charName]: { xPct, yPct } },
//     ...
//   }
function getMinimapCharPositionsStore() {
    const root = extension_settings[extensionName] ??= {};
    root.map ??= {};
    root.map.charPositions ??= {};
    return root.map.charPositions;
}

// Rehydrate the in-memory Map from settings for the given room id.  Called
// at the top of each renderMinimapCharacterLayer pass before pins are placed
// so a fresh page load (or returning to a previously-visited room) shows the
// player's saved arrangement instead of falling back to the default ring.
function loadMinimapCharPositions(roomId) {
    _minimapCharPositions.clear();
    if (!roomId) return;
    const store = getMinimapCharPositionsStore();
    const forRoom = store[roomId];
    if (!forRoom || typeof forRoom !== 'object') return;
    for (const [name, pos] of Object.entries(forRoom)) {
        if (pos && Number.isFinite(pos.xPct) && Number.isFinite(pos.yPct)) {
            _minimapCharPositions.set(name, { xPct: pos.xPct, yPct: pos.yPct });
        }
    }
}

// Persist a single drag-end position to settings under the current room id.
// Updates the in-memory Map so subsequent re-renders pick up the change
// immediately, then debounces a settings save.
function saveMinimapCharPosition(roomId, name, pos) {
    if (!roomId || !name || !pos) return;
    _minimapCharPositions.set(name, pos);
    const store = getMinimapCharPositionsStore();
    store[roomId] ??= {};
    store[roomId][name] = { xPct: pos.xPct, yPct: pos.yPct };
    saveSettingsDebounced();
}

function renderMinimapCharacterLayer(mapWrap, data, currentPin) {
    // Without a known room pin we have nowhere to draw character markers.
    if (!currentPin) return;
    // Rehydrate any drag-saved positions for this room from settings before
    // we read _minimapCharPositions in the loop below.
    loadMinimapCharPositions(currentPin.id);
    const xPct = (currentPin.x / data.mapWidth) * 100;
    const yPct = (currentPin.y / data.mapHeight) * 100;

    const charLayer = document.createElement('div');
    charLayer.className = 'dangan-minimap-char-layer';

    const playerName = getActivePersonaName?.() || 'You';

    // ── Determine speaker + group members from SillyTavern context ───────
    const ctx = window.SillyTavern?.getContext?.();
    const lastMsg = ctx?.chat
        ? [...ctx.chat].reverse().find(m => m && !m.is_system && m.name && !m.is_user)
        : null;
    const speakerName = (lastMsg?.name && lastMsg.name !== playerName) ? lastMsg.name : null;

    // Substrings (case-insensitive) used to skip names when building the
    // character-pin list. A substring match catches name variants with
    // suffixes like "Prome User Sprite (Do Not Click)".
    const EXCLUDED_PIN_SUBSTRINGS = [
        'prome user sprite',
        'narrator',
        'assistant',
        'sillytavern system',
    ];
    const isExcludedPinName = (name) => {
        if (!name) return true;
        const lc = String(name).toLowerCase();
        return EXCLUDED_PIN_SUBSTRINGS.some(s => lc.includes(s));
    };

    let memberNames = [];
    if (ctx?.groupId) {
        const group = (Array.isArray(ctx.groups) ? ctx.groups : []).find(g => String(g.id) === String(ctx.groupId));
        if (group?.members?.length && Array.isArray(ctx.characters)) {
            memberNames = group.members
                .map(avatar => ctx.characters.find(c => c?.avatar === avatar)?.name)
                .filter(n => n && n !== playerName && !isExcludedPinName(n));
        }
    } else if (ctx?.name2 && !isExcludedPinName(ctx.name2) && ctx.name2 !== playerName) {
        memberNames = [ctx.name2];
    }
    // Always merge in overworld characters at the player's current room — so
    // that when the sprites layer is hidden (in a chat), their minimap pins
    // remain. Dedup against whoever is already in memberNames from the chat.
    if (currentPin?.locationId) {
        const overworldChars = overworldSceneController?.getCharactersInRoom?.(currentPin.locationId) || [];
        for (const c of overworldChars) {
            const n = c?.name;
            if (!n || n === playerName || isExcludedPinName(n)) continue;
            if (!memberNames.includes(n)) memberNames.push(n);
        }
    }
    // Also drop the speaker if it's a narrator/assistant — the chat's last
    // "speaker" can be the Narrator and we don't want a red pin for them.
    const filteredSpeaker = (speakerName && !isExcludedPinName(speakerName)) ? speakerName : null;

    // Build the list of character pins to render around the room.
    const chars = [];
    if (playerName) chars.push({ name: playerName, kind: 'player' });
    if (filteredSpeaker) chars.push({ name: filteredSpeaker, kind: 'speaker' });
    let otherIdx = 0;
    for (const name of memberNames) {
        if (name === filteredSpeaker) continue;
        if (name === playerName) continue;
        chars.push({ name, kind: 'other', color: MINIMAP_OTHER_COLORS[otherIdx++ % MINIMAP_OTHER_COLORS.length] });
    }

    // Arrange around the room in a small ring so they don't all stack — but
    // honour any drag-override saved in _minimapCharPositions first.
    const RING_RADIUS_PCT = 9;
    chars.forEach((c, i) => {
        const angle = (i / Math.max(1, chars.length)) * Math.PI * 2 - Math.PI / 2;
        const stored = _minimapCharPositions.get(c.name);
        const px = stored ? stored.xPct : xPct + Math.cos(angle) * RING_RADIUS_PCT;
        const py = stored ? stored.yPct : yPct + Math.sin(angle) * RING_RADIUS_PCT;
        const pin = document.createElement('div');
        pin.className = `dangan-minimap-char-pin dangan-minimap-char-pin-${c.kind}`;
        pin.style.left = `${px}%`;
        pin.style.top  = `${py}%`;
        // CSS draws the hover tooltip via `content: attr(data-name)`, so feed
        // the masked display name (??? when uintroduced). The underlying c.name
        // identity is preserved via the drag handler's `name` argument.
        pin.dataset.name = getCharacterDisplayName(c.name);
        if (c.color) pin.style.setProperty('--char-color', c.color);
        // Teardrop point rotation — random per character, cached so it stays
        // stable across re-renders. Rotation is applied to a child shape so
        // the pin wrapper (and its tooltip) stay axis-aligned.
        let rot = _minimapCharRotations.get(c.name);
        if (rot === undefined) {
            rot = Math.floor(Math.random() * 360);
            _minimapCharRotations.set(c.name, rot);
        }
        const shape = document.createElement('div');
        shape.className = 'dangan-minimap-char-pin-shape';
        shape.style.setProperty('--pin-angle', `${rot}deg`);
        pin.appendChild(shape);
        attachCharPinDrag(pin, c.name, currentPin.id);
        charLayer.appendChild(pin);
    });

    mapWrap.appendChild(charLayer);
}

// Per-pin drag inside the minimap. Independent of the diamond pan handler.
//
// Coordinate math: the parent square is rotate(45°) and the map wrapper is
// translate(tx,ty) rotate(-45°) scale(zoom). The parent rotation and the
// child counter-rotation cancel out for the *linear* part of the transform,
// so the only thing that scales the screen delta into wrapper-local coords is
// the zoom factor:
//   local_dx = dx / zoom
//   local_dy = dy / zoom
// That delta is then converted to a % of the wrapper's natural CSS dimensions.
function attachCharPinDrag(pin, name, roomId) {
    pin.style.cursor = 'grab';
    pin.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        const mapWrap = pin.closest('.dangan-minimap-map');
        if (!mapWrap) return;
        // clientWidth / clientHeight are layout (unzoomed) dimensions.
        const W = mapWrap.clientWidth;
        const H = mapWrap.clientHeight;
        if (!W || !H) return;
        const startX = e.clientX;
        const startY = e.clientY;
        let lastX = startX;
        let lastY = startY;
        let posX = parseFloat(pin.style.left) || 0;
        let posY = parseFloat(pin.style.top)  || 0;
        let moved = false;
        const CLICK_THRESHOLD = 4;  // px before a press becomes a drag
        try { pin.setPointerCapture?.(e.pointerId); } catch {}

        const onMove = (em) => {
            const dx = em.clientX - lastX;
            const dy = em.clientY - lastY;
            if (!moved) {
                const totalDx = em.clientX - startX;
                const totalDy = em.clientY - startY;
                if (Math.hypot(totalDx, totalDy) >= CLICK_THRESHOLD) {
                    moved = true;
                    pin.style.cursor = 'grabbing';
                } else {
                    return;
                }
            }
            lastX = em.clientX;
            lastY = em.clientY;
            const inv = 1 / _minimapZoom;
            posX += (dx * inv) * 100 / W;
            posY += (dy * inv) * 100 / H;
            pin.style.left = `${posX}%`;
            pin.style.top  = `${posY}%`;
        };
        const endDrag = (eu) => {
            pin.removeEventListener('pointermove', onMove);
            pin.removeEventListener('pointerup', endDrag);
            pin.removeEventListener('pointercancel', endDrag);
            pin.style.cursor = 'grab';
            try { pin.releasePointerCapture?.(eu.pointerId); } catch {}
            if (moved) {
                saveMinimapCharPosition(roomId, name, { xPct: posX, yPct: posY });
            } else {
                selectMinimapPin(pin, name);
            }
        };
        pin.addEventListener('pointermove', onMove);
        pin.addEventListener('pointerup', endDrag);
        pin.addEventListener('pointercancel', endDrag);
    });
}

// ── Pin selection + keyboard rotation ─────────────────────────────────────
// Click a pin to select it; press 1 / 2 to rotate its teardrop point in
// 15° steps. Esc or a click anywhere else deselects.
let _selectedPinName = null;
const PIN_ROTATION_STEP_DEG = 15;

function selectMinimapPin(pin, name) {
    // Clear any previously-selected pin's outline.
    document.querySelectorAll('.dangan-minimap-char-pin.selected').forEach(el => el.classList.remove('selected'));
    pin.classList.add('selected');
    _selectedPinName = name;
}
function deselectMinimapPin() {
    if (!_selectedPinName) return;
    document.querySelectorAll('.dangan-minimap-char-pin.selected').forEach(el => el.classList.remove('selected'));
    _selectedPinName = null;
}
// Document-level handlers (registered once at module load).
(function installPinSelectionHandlers() {
    document.addEventListener('keydown', (e) => {
        if (!_selectedPinName) return;
        if (e.key === 'Escape') { e.preventDefault(); deselectMinimapPin(); return; }
        // Ignore the keys when the user is typing in an input/textarea.
        const tag = (e.target?.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return;
        // '1' = rotate left (counter-clockwise), '2' = rotate right (clockwise).
        let delta = 0;
        if (e.key === '1') delta = -PIN_ROTATION_STEP_DEG;
        else if (e.key === '2') delta = PIN_ROTATION_STEP_DEG;
        else return;
        e.preventDefault();
        const cur = _minimapCharRotations.get(_selectedPinName) ?? 0;
        const next = ((cur + delta) % 360 + 360) % 360;
        _minimapCharRotations.set(_selectedPinName, next);
        // Live-update only the currently-selected pin's shape child; no need
        // to re-render the whole minimap.
        const selectedPin = document.querySelector(`.dangan-minimap-char-pin.selected[data-name="${CSS.escape(_selectedPinName)}"]`);
        const shape = selectedPin?.querySelector('.dangan-minimap-char-pin-shape');
        if (shape) shape.style.setProperty('--pin-angle', `${next}deg`);
    });
    // Any click outside a char-pin deselects.
    document.addEventListener('pointerdown', (e) => {
        if (!_selectedPinName) return;
        if (e.target.closest?.('.dangan-minimap-char-pin')) return;
        deselectMinimapPin();
    });
})();

function applyMinimapTransform(mapWrap) {
    if (!mapWrap) return;
    // Counter-rotate the inner content so it stays axis-aligned even though the
    // parent square is rotated 45°. translate(tx, ty) is applied AFTER the
    // rotation so screen-space drag deltas map straight to (tx, ty).
    mapWrap.style.transform =
        `translate(${_minimapPan.tx}px, ${_minimapPan.ty}px) rotate(-45deg) scale(${_minimapZoom})`;
    // Expose the current zoom so descendants (e.g. character-name tooltips) can
    // counter-scale by 1/zoom and stay a constant on-screen size instead of
    // ballooning with the map.
    mapWrap.style.setProperty('--minimap-zoom', _minimapZoom);
}

// Drag-to-pan + pinch-to-zoom handler. The map wrapper's translate happens
// INSIDE the rotated square's coord system, so a (tx, ty) translate is then
// rotated 45° on screen by the parent. To make a horizontal drag move the
// map horizontally, the screen-space delta (dx, dy) is first rotated by -45°
// before being added:
//   tx += (dx + dy) / √2
//   ty += (dy - dx) / √2
//
// Pinch: when two pointers are active we switch from drag to pinch mode and
// scale _minimapZoom by the ratio of current-to-initial finger distance.
// Trackpad pinch on desktop arrives as a wheel event with ctrlKey set.
function attachMinimapDrag(target) {
    const INV_SQRT2 = 1 / Math.SQRT2;
    const root = target.closest('#dangan-minimap') || target;
    // pointerId → { x, y }. Multi-pointer gestures (pinch) compare two entries.
    const pointers = new Map();
    // Drag state — only meaningful while exactly one pointer is down.
    let dragging = false;
    let lastX = 0, lastY = 0;
    // Pinch state — captured on the second pointerdown, replayed each move.
    let pinching = false;
    let pinchStartDist = 0;
    let pinchStartZoom = 1;

    const mapEl = () => target.querySelector('.dangan-minimap-map');

    function clampZoom(z) {
        return Math.max(MINIMAP_ZOOM_MIN, Math.min(MINIMAP_ZOOM_MAX, z));
    }

    function pointerDistance() {
        const pts = [...pointers.values()];
        if (pts.length < 2) return 0;
        const [a, b] = pts;
        return Math.hypot(b.x - a.x, b.y - a.y);
    }

    target.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        try { target.setPointerCapture?.(e.pointerId); } catch {}

        if (pointers.size === 1) {
            // Start a drag from the single finger.
            dragging = true;
            pinching = false;
            lastX = e.clientX;
            lastY = e.clientY;
            root.classList.add('dragging');
        } else if (pointers.size === 2) {
            // Promote to a pinch — drop the in-progress drag so a second
            // finger landing doesn't yank the pan a frame before the pinch
            // takes over.
            dragging = false;
            pinching = true;
            pinchStartDist = pointerDistance() || 1;
            pinchStartZoom = _minimapZoom;
        }
        e.preventDefault();
    });

    target.addEventListener('pointermove', (e) => {
        const tracked = pointers.get(e.pointerId);
        if (!tracked) return;
        tracked.x = e.clientX;
        tracked.y = e.clientY;

        if (pinching && pointers.size >= 2) {
            const dist = pointerDistance();
            if (!dist) return;
            const next = clampZoom(pinchStartZoom * (dist / pinchStartDist));
            if (next !== _minimapZoom) {
                _minimapZoom = next;
                applyMinimapTransform(mapEl());
            }
            return;
        }

        if (dragging && pointers.size === 1) {
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            lastX = e.clientX;
            lastY = e.clientY;
            _minimapPan.tx += (dx + dy) * INV_SQRT2;
            _minimapPan.ty += (dy - dx) * INV_SQRT2;
            applyMinimapTransform(mapEl());
        }
    });

    const releasePointer = (e) => {
        if (!pointers.has(e.pointerId)) return;
        pointers.delete(e.pointerId);
        try { target.releasePointerCapture?.(e.pointerId); } catch {}

        if (pointers.size === 1) {
            // One finger lifted mid-pinch — resume drag from the remaining
            // finger's current position so we don't jump on the next move.
            pinching = false;
            dragging = true;
            const [remaining] = pointers.values();
            lastX = remaining.x;
            lastY = remaining.y;
        } else if (pointers.size === 0) {
            dragging = false;
            pinching = false;
            root.classList.remove('dragging');
        }
    };
    target.addEventListener('pointerup', releasePointer);
    target.addEventListener('pointercancel', releasePointer);

    // Trackpad pinch on desktop / mouse wheel zoom. Browsers expose trackpad
    // pinch as a wheel event with ctrlKey: true. Plain wheel over the map
    // also zooms — the minimap is a small isolated widget, so any wheel
    // gesture targeted at it should be zoom rather than page scroll.
    // deltaY > 0 = pinch out / wheel down → zoom out. The 0.0035 factor tunes
    // how quickly a trackpad pinch traverses the zoom range.
    target.addEventListener('wheel', (e) => {
        e.preventDefault();
        const next = clampZoom(_minimapZoom * Math.exp(-e.deltaY * 0.0035));
        if (next !== _minimapZoom) {
            _minimapZoom = next;
            applyMinimapTransform(mapEl());
        }
    }, { passive: false });

    // Touch CSS rule prevents the browser from claiming the gesture for
    // native page zoom — we need every move event so the pinch tracks the
    // user's fingers, not the page underneath.
    target.style.touchAction = 'none';
}

// True when the Class Trial UI is actually mounted on the page. This is the
// reliable "we're in a trial" signal — it's set by trialManager only on real
// group-chat trials, so a stale persisted pre_debate state on an Assistant /
// Narrator chat doesn't falsely hide the Move To panel and Minimap.
function isTrialUiActive() {
    return document.body.classList.contains('dangan-trial-active');
}

function renderMoveToPanel() {
    const existing = document.getElementById('dangan-moveto-panel');

    // Hide whenever the Class Trial UI is on screen.
    if (isTrialUiActive()) {
        if (existing) { existing.remove(); _moveToPanelSig = null; }
        return;
    }

    // Also hide while the Monopad is open — it's a full-screen panel and the
    // Move To panel would render on top of it otherwise.
    const monopad = document.getElementById('dangan_monopad_panel');
    if (monopad?.classList.contains('open')) {
        if (existing) { existing.remove(); _moveToPanelSig = null; }
        return;
    }

    const currentId = getCurrentLocationId();
    const rawConns = currentId
        ? (mapPanelController?.getConnectionsForLocationId?.(currentId) ?? [])
        : [];
    // Dedupe by kind:value — the upstream list occasionally repeats the same
    // destination (e.g. a pin connection listed twice in the pin's data),
    // which surfaces as duplicate "Move to <X>" buttons in the panel.
    const conns = [];
    const seenConnKeys = new Set();
    for (const c of rawConns) {
        const key = `${c.kind}:${c.value}`;
        if (seenConnKeys.has(key)) continue;
        seenConnKeys.add(key);
        conns.push(c);
    }

    // Dirty-check signature — short-circuit when nothing observable has changed.
    // The poll calls this every 2s; without this guard each call would rebuild
    // the DOM and trigger a visible flicker.
    const sig = `${currentId || ''}|${conns.map(c => `${c.kind}:${c.value}:${c.label}`).join(';')}`;
    if (existing && sig === _moveToPanelSig) return;
    _moveToPanelSig = sig;

    const panel = existing || document.createElement('div');
    panel.id = 'dangan-moveto-panel';
    panel.innerHTML = '';

    const title = document.createElement('div');
    title.className = 'dangan-moveto-title';
    title.textContent = 'MOVE TO';
    panel.appendChild(title);

    const list = document.createElement('div');
    list.className = 'dangan-moveto-list';
    if (!currentId) {
        const empty = document.createElement('div');
        empty.className = 'dangan-moveto-empty';
        empty.textContent = 'Use /setlocation to set your current location.';
        list.appendChild(empty);
    } else if (!conns.length) {
        const empty = document.createElement('div');
        empty.className = 'dangan-moveto-empty';
        empty.textContent = 'No connected rooms from here. Edit the current pin to add some.';
        list.appendChild(empty);
    } else {
        for (const c of conns) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `dangan-moveto-btn dangan-moveto-kind-${c.kind}`;
            btn.textContent = c.label;
            btn.title = c.kind === 'pin' ? `Pin (${c.value})`
                      : c.kind === 'area' ? `Area (${c.value})`
                      : `Sub-area (${c.value})`;
            btn.addEventListener('click', () => moveToDestination(c.label));
            list.appendChild(btn);
        }
    }
    panel.appendChild(list);

    if (!existing) document.body.appendChild(panel);
}

// Module-level early-load polling. Runs OUTSIDE the jQuery init callback so
// rendering retries fire even if the jQuery callback's awaits are still pending
// (which happens during Assistant / Narrator chat first-load, when CHAT_LOADED
// has fired before our listeners get a chance to register inside the callback).
// Each tick is cheap: it just calls the idempotent renderers, which bail out
// quickly when mapPanelController isn't ready yet or when nothing has changed.
(function bootstrapMinimapAndMoveToRender() {
    let elapsed = 0;
    const STEP = 250;
    const DURATION = 12000;
    const tick = () => {
        try { renderMoveToPanel(); } catch (e) { console.warn('[Dangan][moveto-panel] bootstrap render failed:', e); }
        try { renderMinimap();    } catch (e) { console.warn('[Dangan][minimap] bootstrap render failed:', e); }
        // Current-room panel hangs off #dangan-hud-topright, which the reward
        // system creates lazily. Re-tick keeps the label correct once the
        // wrapper materialises and once mapPanelController has its pins.
        try { updateCurrentRoomDisplay(); } catch (e) { console.warn('[Dangan][current-room] bootstrap render failed:', e); }
        elapsed += STEP;
        if (elapsed < DURATION) setTimeout(tick, STEP);
    };
    // Kick off on the next tick so the function declarations are guaranteed hoisted
    // and SillyTavern has at least started bootstrapping the DOM.
    setTimeout(tick, 0);

    // Belt-and-braces — also listen for the DOMContentLoaded event in case the
    // module loaded before the DOM was ready.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            try { renderMoveToPanel(); renderMinimap(); } catch {}
        }, { once: true });
    }
})();

function buildMoveToEnumOptions() {
    if (!mapPanelController) return [];
    const currentId = getCurrentLocationId();
    if (!currentId) return [];   // No current location → no connected destinations to offer.
    const conns = mapPanelController.getConnectionsForLocationId?.(currentId) ?? [];
    const seen = new Map();
    for (const c of conns) {
        if (!c?.label || seen.has(c.label)) continue;
        const desc = c.kind === 'pin' ? `Pin (${c.value})`
                   : c.kind === 'area' ? `Area (${c.value})`
                   : `Sub-area (${c.value})`;
        seen.set(c.label, new SlashCommandEnumValue(c.label, desc));
    }
    return [...seen.values()];
}

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'moveto',
    callback: async (args) => {
        if (!mapPanelController) {
            console.warn('[Dangan][moveto] Map controller unavailable.');
            return '';
        }
        const raw = String(args.location || args._ || '').trim();
        if (!raw) {
            console.warn('[Dangan][moveto] Provide location=<pin label / area name / sub-area>.');
            return '';
        }

        if (!getCurrentLocationId()) {
            console.warn('[Dangan][moveto] No current location set. Use /setlocation first.');
            return '';
        }
        if (!moveToDestination(raw)) {
            console.warn('[Dangan][moveto] Destination is not connected to the current location:', raw);
            return '';
        }
        return raw;
    },
    helpString: 'Moves the player to a connected room/area/sub-area. Updates the chat background to the destination room\'s BG and remembers the current location.',
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'location',
            description: 'Destination — picked from connected rooms / sub-areas / areas of the current room.',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
            enumProvider: () => buildMoveToEnumOptions(),
        }),
    ],
}));

// /setlocation — directly set the player's current location by ID, regardless of
// any "Connected To" graph. Accepts a pin locationId, an area key, or a sub-area
// key in the form "<areaKey>/<floorKey>". Switches the chat background when the
// resolved target has one.
function buildSetLocationEnumOptions() {
    if (!mapPanelController) return [];
    const out = [];
    // Only navigable location pins — exclude evidence ('truth-bullet') and body pins.
    const LOCATION_PIN_TYPES = new Set(['room', 'monomachine', 'trial']);
    for (const p of (mapPanelController.getAllPins?.() ?? [])) {
        if (!p?.locationId) continue;
        if (!LOCATION_PIN_TYPES.has(p.type)) continue;
        out.push(new SlashCommandEnumValue(p.locationId, `Pin — ${p.label || p.locationId}`));
    }
    for (const a of (mapPanelController.getAllAreas?.() ?? [])) {
        out.push(new SlashCommandEnumValue(a.key, `Area — ${a.label}`));
        for (const f of (a.floors || [])) {
            out.push(new SlashCommandEnumValue(`${a.key}/${f.key}`, `Sub-area — ${a.label} › ${f.label}`));
        }
    }
    return out;
}

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'setlocation',
    callback: async (args) => {
        if (!mapPanelController) {
            console.warn('[Dangan][setlocation] Map controller unavailable.');
            return '';
        }
        const raw = String(args.id || args._ || '').trim();
        if (!raw) {
            console.warn('[Dangan][setlocation] Provide id=<pin locationId | areaKey | areaKey/floorKey>.');
            return '';
        }

        // 1) Pin lookup by locationId first.
        const pin = mapPanelController.getPinByLocationId?.(raw);
        if (pin) {
            // Helper handles fade, sfx, room swap, and panel/minimap re-renders.
            performPinArrivalWithFade(pin);
            return pin.label || pin.locationId;
        }

        // 2) Sub-area: "<areaKey>/<floorKey>".
        if (raw.includes('/')) {
            const d = mapPanelController.describeConnectionRef?.(`subarea:${raw}`);
            if (d?.kind === 'subarea') {
                mapPanelController.navigateToArea?.(d.areaKey, d.floorKey);
                setCurrentLocationId(`subarea:${d.areaKey}/${d.floorKey}`);
                renderMoveToPanel();
                renderMinimap();
                return d.label;
            }
        }

        // 3) Area key.
        const a = mapPanelController.describeConnectionRef?.(`area:${raw}`);
        if (a?.kind === 'area') {
            mapPanelController.navigateToArea?.(a.value);
            setCurrentLocationId(`area:${a.value}`);
            renderMoveToPanel();
            renderMinimap();
            return a.label;
        }

        console.warn('[Dangan][setlocation] Could not resolve id:', raw);
        return '';
    },
    helpString: 'Sets the player\'s current location to the given pin, area, or sub-area ID — bypassing the "Connected To" check. Switches the chat background when the target pin has one.',
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'id',
            description: 'A pin locationId, an areaKey, or a sub-area key (areaKey/floorKey).',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
            enumProvider: () => buildSetLocationEnumOptions(),
        }),
    ],
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'hangmansgambit',
    callback: async (args) => {
        const question   = String(args.question   || '').trim();
        const answer     = String(args.answer     || '').trim();
        const time       = resolveSkillParam("hangmanTimer",  Math.max(120, Number(args.time)   || 120));
        const health     = resolveSkillParam("hangmanHealth", Math.max(1,   Number(args.health) || 7));
        const difficulty = Math.min(5, Math.max(1, Number(args.difficulty) || 2));
        if (!question || !answer) {
            console.warn('[HangmansGambit] question and answer are required.');
            return '';
        }
        const spotlightScale = resolveSkillParam("hangmanSpotlight", 1);
        const resolveSpeed = (base) => resolveSkillParam("hangmanSpeed", base);
        const concDrain = resolveSkillParam("hangmanConcDrain", 1 / 3);
        const concRegen = resolveSkillParam("hangmanConcRegen", 1 / 10);
        // #region debug-point B:hangman-slash-entry
        reportFullscreenOverlayDebug("B", "index.js:/hangmansgambit", "Entered Hangman's Gambit slash command", {
            hangmansGambitController: Boolean(hangmansGambitController),
            questionLength: question.length,
            answerLength: answer.length,
        });
        // #endregion
        const won = await hangmansGambitController?.run({ question, answer, time, health, difficulty, spotlightScale, resolveSpeed, concDrain, concRegen });
        // #region debug-point B:hangman-slash-run
        reportFullscreenOverlayDebug("B", "index.js:/hangmansgambit", "Hangman's Gambit slash command completed run()", {
            won: Boolean(won),
        });
        // #endregion
        if (won) awardXp(XP_REWARDS.hangmansGambit ?? 15, "hangman's gambit completed");
        return '';
    },
    helpString: 'Displays a Danganronpa-style Hangman\'s Gambit minigame. Letters scroll across the screen; pick a letter into your Stock, then click the same letter to match it against the current target character in the anagram. Correct matches reveal letters; wrong picks or timeout deduct health.',
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({ name: 'question',   description: 'Title/prompt shown to the player',             typeList: [ARGUMENT_TYPE.STRING], isRequired: true }),
        SlashCommandNamedArgument.fromProps({ name: 'answer',     description: 'The word/phrase to unscramble (the anagram)',   typeList: [ARGUMENT_TYPE.STRING], isRequired: true }),
        SlashCommandNamedArgument.fromProps({ name: 'time',       description: 'Time limit in seconds (default 60)',            typeList: [ARGUMENT_TYPE.NUMBER], isRequired: false }),
        SlashCommandNamedArgument.fromProps({ name: 'health',     description: 'Number of health points (default 3)',           typeList: [ARGUMENT_TYPE.NUMBER], isRequired: false }),
        SlashCommandNamedArgument.fromProps({ name: 'difficulty', description: 'Difficulty 1–5: controls speed, bubble count, and letter variety (default 2)', typeList: [ARGUMENT_TYPE.NUMBER], isRequired: false }),
    ],
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'rebuttalshowdown',
    callback: async () => {
        await rebuttalShowdownController?.run();
        return '';
    },
    helpString: 'Starts a Rebuttal Showdown minigame with two phases: cut through scrolling statements with left-click slashes, then right-click the weak point using the correct Truth Blade.',
}));

// ── Interject command ────────────────────────────────────────────────────────

// After the interjection cinematic, force the interjecting character to reply immediately.
// This makes the interjection feel like a sudden, live outburst — the character cuts in and
// speaks before anyone else gets a turn.
async function triggerInterjectorResponse(characterName) {
    const cmd = characterName ? `/trigger await=false ${characterName}` : '/trigger await=false';
    try {
        await executeSlashCommandsWithOptions(cmd, { handleParserErrors: true });
    } catch (err) {
        console.warn('[danganronpa] triggerInterjectorResponse failed:', err);
    }
}

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'interjection',
    callback: async (args) => {
        const ctx  = window.SillyTavern?.getContext?.();
        const chat = Array.isArray(ctx?.chat) ? ctx.chat : [];
        const last = [...chat].reverse().find(m => !m.is_user && !m.is_system && m.name);
        const lastSpeakerName = last ? String(last.name || '').trim() || null : null;
        const characterName   = String(args.character || '').trim() || lastSpeakerName || null;

        // If the interjecting character isn't the current speaker, scroll the GCP stage to focus them
        if (characterName && characterName !== lastSpeakerName) {
            trialManager?.updateGroupChatSpeaker(characterName);
        }

        // Force Dynamic Audio to play New Classmates of the Dead
        const bgmPath = `${(extensionFolderPath || '').replace(/\\/g, '/')}/assets/bgm/New Classmates of the Dead.mp3`;
        const $bgmSelect = $('#audio_bgm_select');
        if ($bgmSelect.length) {
            if (!$bgmSelect.find(`option[value="${bgmPath}"]`).length) {
                $bgmSelect.append(new Option('asset: New Classmates of the Dead', bgmPath));
            }
            $bgmSelect.val(bgmPath).trigger('change');
        }

        await interjectionRunner?.run({ characterName });
        await triggerInterjectorResponse(characterName);
        return '';
    },
    namedArguments: [
        SlashCommandNamedArgument.fromProps({ name: 'character', description: 'Character name for the interjection sprite (defaults to last speaker)', typeList: [ARGUMENT_TYPE.STRING] }),
    ],
    helpString: 'Plays a rebuttal interjection cinematic and switches BGM to New Classmates of the Dead. Use <code>character="Name"</code> to specify who interjects (defaults to the last speaker). If the character differs from the last speaker, the seating plan scrolls to focus on them.',
}));

// ── Rebuttal Showdown sized commands ────────────────────────────────────────

function rsGetContext(args) {
    const ctx  = window.SillyTavern?.getContext?.();
    const chat = Array.isArray(ctx?.chat) ? ctx.chat : [];
    const last = [...chat].reverse().find(m => !m.is_user && !m.is_system && m.name);
    const opponentName = String(args.opponent || '').trim() || (last ? String(last.name || '').trim() : null) || null;
    const playerName   = String(args.player   || '').trim() || null;
    return { opponentName, playerName };
}

function rsSplitStatement(text, numChunks = 3) {
    const words = String(text || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [text];
    if (words.length <= numChunks) return words;
    const perChunk = Math.ceil(words.length / numChunks);
    const chunks = [];
    for (let i = 0; i < words.length; i += perChunk) {
        chunks.push(words.slice(i, i + perChunk).join(' '));
    }
    return chunks;
}

function rsBuildPhaseOneLines(args, maxLines) {
    const lines = [];
    for (let i = 1; i <= maxLines; i++) {
        const phrase = String(args[`s${i}-q`] || '').trim();
        if (phrase) lines.push(rsSplitStatement(phrase));
    }
    return lines.length ? lines : null;
}

const RS_SIZES = {
    small:      { suffix: 'small',      maxLines:  4, maxBullets:  3, initialTimeMs: 20000, cutTarget:  6, label: 'Small'       },
    medium:     { suffix: 'medium',     maxLines:  6, maxBullets:  5, initialTimeMs: 30000, cutTarget:  9, label: 'Medium'      },
    large:      { suffix: 'large',      maxLines:  8, maxBullets:  7, initialTimeMs: 45000, cutTarget: 14, label: 'Large'       },
    extralarge: { suffix: 'extralarge', maxLines: 12, maxBullets: 10, initialTimeMs: 60000, cutTarget: 20, label: 'Extra Large' },
};

for (const cfg of Object.values(RS_SIZES)) {
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: `rebuttalshowdown-${cfg.suffix}`,
        callback: async (args) => {
            const { opponentName, playerName } = rsGetContext(args);
            const phaseOneLines = rsBuildPhaseOneLines(args, cfg.maxLines);
            await rebuttalShowdownController?.run({
                opponentName,
                playerName,
                phaseOneLines,
                initialTimeMs: cfg.initialTimeMs,
                cutTarget: cfg.cutTarget,
                maxBullets: cfg.maxBullets,
            });
            return '';
        },
        namedArguments: [
            SlashCommandNamedArgument.fromProps({ name: 'opponent', description: 'Opponent character name (defaults to last speaker)', typeList: [ARGUMENT_TYPE.STRING] }),
            SlashCommandNamedArgument.fromProps({ name: 'player',   description: 'Player character name',                              typeList: [ARGUMENT_TYPE.STRING] }),
            ...Array.from({ length: cfg.maxLines }, (_, i) =>
                SlashCommandNamedArgument.fromProps({
                    name: `s${i + 1}-q`,
                    description: `Statement ${i + 1} (full phrase, auto-split into chunks)`,
                    typeList: [ARGUMENT_TYPE.STRING],
                })
            ),
        ],
        helpString: `Starts a ${cfg.label} Rebuttal Showdown (up to ${cfg.maxLines} statements, ${cfg.initialTimeMs / 1000}s timer, ${cfg.cutTarget}-cut target).`,
    }));
}

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'argumentarmament',
    callback: async (args) => {
        const enemyHp  = resolveSkillParam("aaEnemyHp",  Math.max(1, Number(args.enemyHp)  || 100));
        const playerHp = resolveSkillParam("aaPlayerHp", Math.max(1, Number(args.playerHp) || 100));
        const phases   = Math.min(3, Math.max(1, Number(args.phases) || 3));
        const dialogs  = ['A','B','C','D','E','F','G','H','I','J','K']
            .map(l => String(args[`dialog${l}`] || args[`Dialog${l}`] || '').trim())
            .filter(Boolean);
        const NSolution    = String(args.nSolution    || args.NSolution    || '').trim();
        const SSolution    = String(args.sSolution    || args.SSolution    || '').trim();
        const ESolution    = String(args.eSolution    || args.ESolution    || '').trim();
        const WSolution    = String(args.wSolution    || args.WSolution    || '').trim();
        const FinalSolution      = String(args.finalSolution      || args.FinalSolution      || '').trim().toUpperCase();
        const FinalSolutionQuote = String(args.finalSolutionQuote || args.FinalSolutionQuote || '').trim();
        const bgArg = String(args.bg || args.BG || '').trim();
        let BG = '';
        if (bgArg) {
            const lower = bgArg.toLowerCase();
            const match = Array.from(document.querySelectorAll('.bg_example'))
                .find(el => el.getAttribute('bgfile')?.toLowerCase().includes(lower));
            if (match) {
                const bgfile   = match.getAttribute('bgfile') || '';
                const isCustom = match.getAttribute('custom') === 'true';
                const bgUrl    = isCustom
                    ? encodeURI(bgfile)
                    : `backgrounds/${encodeURIComponent(bgfile)}`;
                BG = bgUrl;
            }
        }
        if (dialogs.length === 0) {
            console.warn('[AA] At least one dialog (dialogA–dialogK) is required.');
            return '';
        }
        const clairvoyance = getEquippedSkillsSnapshot().includes('shop_skill_clairvoyance');

        // Resolve character-specific AA sprites
        let mainSprite = null;
        let defeatSprite = null;
        const aaCtx = window.SillyTavern?.getContext?.();
        // name2 is the current character's display name in SillyTavern context;
        // fall back to window.characters[window.this_chid] for reliability
        const aaCharName = String(
            aaCtx?.name2 ||
            (window.this_chid != null && Array.isArray(window.characters)
                ? window.characters[window.this_chid]?.name
                : '') ||
            ''
        ).trim();
        if (aaCharName) {
            // Resolve the sprite folder (avatar filename without extension)
            let aaFolder = aaCharName;
            if (Array.isArray(window.characters)) {
                const stChar = window.characters.find(c => c.name === aaCharName);
                if (stChar?.avatar) aaFolder = stChar.avatar.replace(/\.[^.]+$/, '');
            }
            try {
                const resp = await fetch(`/api/sprites/get?name=${encodeURIComponent(aaFolder)}`);
                if (resp.ok) {
                    const sprites = await resp.json();
                    // Only use a sprite explicitly named 'argumentarmament' — no neutral fallback
                    const aaSprite = sprites.find(s => String(s.label || '').toLowerCase() === 'argumentarmament');
                    if (aaSprite?.path) {
                        mainSprite = aaSprite.path;
                        defeatSprite = aaSprite.path;
                    }
                }
            } catch { /* fall through to tester images */ }
        }

        const ammoMax  = resolveSkillParam("aaAmmo",       6);
        const reloadMs = resolveSkillParam("aaReloadTime", 500);
        const timerMs  = resolveSkillParam("aaTimer",      90000);
        const damage   = resolveSkillParam("aaDamage",     1);
        const damageTakenMult = resolveSkillParam("aaDamageTaken", 1);
        const won = await argumentArmamentController?.run({ enemyHp, playerHp, phases, dialogs, NSolution, SSolution, ESolution, WSolution, FinalSolution, FinalSolutionQuote, BG, clairvoyance, mainSprite, defeatSprite, ammoMax, reloadMs, timerMs, damage, damageTakenMult });
        if (won) awardXp(XP_REWARDS.argumentArmament ?? 18, 'argument armament completed');
        return '';
    },
    helpString: 'Displays a Danganronpa-style Argument Armament minigame. Dialog pieces appear on a 3×3 grid and zoom in — shoot them with mouse clicks or arrow keys + Space before they expire. Orange text damages the opponent; pink text hurts you when broken; blue text needs two hits. Defeat the opponent to enter the Final Argument phase.',
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({ name: 'enemyHp',      description: 'Opponent starting HP (default 100)',                         typeList: [ARGUMENT_TYPE.NUMBER], isRequired: false }),
        SlashCommandNamedArgument.fromProps({ name: 'playerHp',     description: 'Player starting HP (default 100)',                           typeList: [ARGUMENT_TYPE.NUMBER], isRequired: false }),
        SlashCommandNamedArgument.fromProps({ name: 'phases',       description: 'Number of battle phases 1–3 (default 3)',                    typeList: [ARGUMENT_TYPE.NUMBER], isRequired: false }),
        SlashCommandNamedArgument.fromProps({ name: 'dialogA',      description: 'Dialog piece A (required)',                                  typeList: [ARGUMENT_TYPE.STRING], isRequired: true  }),
        SlashCommandNamedArgument.fromProps({ name: 'dialogB',      description: 'Dialog piece B',                                            typeList: [ARGUMENT_TYPE.STRING], isRequired: false }),
        SlashCommandNamedArgument.fromProps({ name: 'dialogC',      description: 'Dialog piece C',                                            typeList: [ARGUMENT_TYPE.STRING], isRequired: false }),
        SlashCommandNamedArgument.fromProps({ name: 'dialogD',      description: 'Dialog piece D',                                            typeList: [ARGUMENT_TYPE.STRING], isRequired: false }),
        SlashCommandNamedArgument.fromProps({ name: 'dialogE',      description: 'Dialog piece E',                                            typeList: [ARGUMENT_TYPE.STRING], isRequired: false }),
        SlashCommandNamedArgument.fromProps({ name: 'dialogF',      description: 'Dialog piece F',                                            typeList: [ARGUMENT_TYPE.STRING], isRequired: false }),
        SlashCommandNamedArgument.fromProps({ name: 'dialogG',      description: 'Dialog piece G',                                            typeList: [ARGUMENT_TYPE.STRING], isRequired: false }),
        SlashCommandNamedArgument.fromProps({ name: 'dialogH',      description: 'Dialog piece H',                                            typeList: [ARGUMENT_TYPE.STRING], isRequired: false }),
        SlashCommandNamedArgument.fromProps({ name: 'dialogI',      description: 'Dialog piece I',                                            typeList: [ARGUMENT_TYPE.STRING], isRequired: false }),
        SlashCommandNamedArgument.fromProps({ name: 'dialogJ',      description: 'Dialog piece J',                                            typeList: [ARGUMENT_TYPE.STRING], isRequired: false }),
        SlashCommandNamedArgument.fromProps({ name: 'dialogK',      description: 'Dialog piece K',                                            typeList: [ARGUMENT_TYPE.STRING], isRequired: false }),
        SlashCommandNamedArgument.fromProps({ name: 'nSolution',         description: 'Text shown above the up-arrow button',                      typeList: [ARGUMENT_TYPE.STRING], isRequired: false }),
        SlashCommandNamedArgument.fromProps({ name: 'sSolution',         description: 'Text shown below the down-arrow button',                    typeList: [ARGUMENT_TYPE.STRING], isRequired: false }),
        SlashCommandNamedArgument.fromProps({ name: 'eSolution',         description: 'Text shown beside the right-arrow button',                  typeList: [ARGUMENT_TYPE.STRING], isRequired: false }),
        SlashCommandNamedArgument.fromProps({ name: 'wSolution',         description: 'Text shown beside the left-arrow button',                   typeList: [ARGUMENT_TYPE.STRING], isRequired: false }),
        SlashCommandNamedArgument.fromProps({ name: 'finalSolution',     description: 'Correct 4-key press order using N/S/E/W (e.g. "WNES")',    typeList: [ARGUMENT_TYPE.STRING], isRequired: false }),
        SlashCommandNamedArgument.fromProps({ name: 'finalSolutionQuote',description: 'Pink zooming text shown in the centre during the Final Argument phase', typeList: [ARGUMENT_TYPE.STRING], isRequired: false }),
        SlashCommandNamedArgument.fromProps({ name: 'bg',                description: 'Background name from SillyTavern\'s BG list (partial match)',           typeList: [ARGUMENT_TYPE.STRING], isRequired: false }),
        // Legacy uppercase aliases
        SlashCommandNamedArgument.fromProps({ name: 'NSolution',         description: '(alias) Text shown above the up-arrow button',            typeList: [ARGUMENT_TYPE.STRING], isRequired: false }),
        SlashCommandNamedArgument.fromProps({ name: 'SSolution',         description: '(alias) Text shown below the down-arrow button',          typeList: [ARGUMENT_TYPE.STRING], isRequired: false }),
        SlashCommandNamedArgument.fromProps({ name: 'ESolution',         description: '(alias) Text shown beside the right-arrow button',        typeList: [ARGUMENT_TYPE.STRING], isRequired: false }),
        SlashCommandNamedArgument.fromProps({ name: 'WSolution',         description: '(alias) Text shown beside the left-arrow button',         typeList: [ARGUMENT_TYPE.STRING], isRequired: false }),
        SlashCommandNamedArgument.fromProps({ name: 'FinalSolution',     description: '(alias) Correct 4-key press order using N/S/E/W',         typeList: [ARGUMENT_TYPE.STRING], isRequired: false }),
        SlashCommandNamedArgument.fromProps({ name: 'FinalSolutionQuote',description: '(alias) Pink zooming text during the Final Argument phase',typeList: [ARGUMENT_TYPE.STRING], isRequired: false }),
        SlashCommandNamedArgument.fromProps({ name: 'BG',                description: '(alias) Background name from SillyTavern\'s BG list',     typeList: [ARGUMENT_TYPE.STRING], isRequired: false }),
    ],
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'endtrial',
    callback: async () => {
        console.log('[Dangan] Manual trial termination requested.');
        trialManager?.endTrial();
        return '';
    },
    helpString: 'Immediately ends the current Class Trial and clears persistent state.',
}));
