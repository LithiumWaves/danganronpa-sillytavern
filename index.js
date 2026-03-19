import { extension_settings } from "../../../extensions.js";
import { saveSettingsDebounced, getRequestHeaders } from "../../../../script.js";
import { SlashCommandParser } from '../../../slash-commands/SlashCommandParser.js';
import { SlashCommand } from '../../../slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from '../../../slash-commands/SlashCommandArgument.js';
import { initTruthBullets, handleTruthBullet, setNextTruthBulletSfxVariant, getTruthBulletByLocationId, showTruthBulletByLocationId, showTruthBulletById, getTruthBullets } from "./truth/truthBullets.js";
import { buildDecagram, crackShard, shatterShard } from "./trust/trustDecagram.js";
import { initTrustAnimations, playTrustRankUp, playTrustRankDown, playTrustMaxed, playTrustToDistrustTransition, playDistrustRankDown, playDistrustRankUp, playDistrustToTrustRecovery } from "./trust/trustAnimations.js";
import { increaseTrust, decreaseTrust } from "./trust/trustAPI.js";
import { createItemsPanelController } from "./items/itemsPanel.js";
import { createRewardSystem } from "./items/rewardSystem.js";
import { createSocialPanelController } from "./social/socialPanel.js";
import { extractUltimateFromNotes, isIgnoredCharacter, lookupUltimateFromLorebook, normalizeList, normalizeName } from "./social/characterUtils.js";
import { createMapPanelController } from "./map/mapPanel.js";
import { getLocationPromptReference, resolveLocationIdFromText } from "./map/locationPresence.js";
import { INVESTIGATION_START_REGEX, MONOCOIN_REWARDS, REWARD_DIFFICULTY_LABELS, REWARD_PROFILES, XP_REWARDS, SOCIAL_DOWN_REGEX, SOCIAL_REGEX, SOCIAL_UP_REGEX, defaultSettings, extensionFolderPath, extensionName } from "./core/constants.js";
import { createOpenRouterSettingsManager } from "./core/openrouterSettings.js";
import { MONOKUMA_LESSON_STEPS, MONOKUMA_LESSON_TITLE } from "./core/monokumaLessonScript.js";
import { createMonokumaAnnouncementController, parseMonokumaAnnouncementMarkers } from "./monokuma/announcementController.js";
import { createClassTrialMenuController } from "./trial/menu/classTrialMenu.js";
import { createTrialManager, TrialPhases } from "./trial/trialManager.js";
import { initVfxSystem, onVfxChatChanged } from "./vfx/vfxSystem.js";
import { createAudioVisualizerController } from "./audio/audioVisualizer.js";
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

function passTimeToNight({ source = "manual" } = {}) {
    const state = ensureTimeTrackerState();
    if (state.phase !== TIME_PHASE_DAY || state.dayActionUsed) return false;

    state.phase = TIME_PHASE_NIGHT;
    state.dayActionUsed = true;

    saveSettingsDebounced();
    renderTimeTrackerUi();
    applyTimeContextToGeneration();
    applyDynamicTheme();
    monokumaAnnouncementController?.trigger("NIGHT_ANNOUN");
    console.log(`[${extensionName}] Time advanced to NIGHT (source: ${source}).`);
    return true;
}

function sleepToNextDay({ source = "manual" } = {}) {
    const state = ensureTimeTrackerState();
    if (state.phase !== TIME_PHASE_NIGHT) return false;

    state.day = Math.max(1, Number(state.day || 1) + 1);
    state.phase = TIME_PHASE_DAY;
    state.dayActionUsed = false;

    saveSettingsDebounced();
    renderTimeTrackerUi();
    applyTimeContextToGeneration();
    applyDynamicTheme();
    monokumaAnnouncementController?.trigger("DAY_ANNOUN");
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
    rewards?.awardMonocoins(amount, reason);
}

function increaseTrustWithRewards(char) {
    rewards?.increaseTrustWithRewards(char);
}

function awardXp(amount = 0, reason = "") {
    rewards?.awardXp(amount, reason);
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
    const CHUNK_SIZE = 300;
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
                <button type="button" class="dangan-vn-control dangan-vn-extra-actions" id="dangan-vn-extra-actions" aria-label="Message actions" title="Message actions">···</button>
                <button type="button" class="dangan-vn-control dangan-vn-edit-message" id="dangan-vn-edit-message" aria-label="Edit current message" title="Edit current message">✏</button>
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

    function parseVnMarkup(text) {
        const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // Process bold/italic within a string, wrapping plain runs in `baseClass`
        const processSpans = (str, baseClass) => {
            const inner = /(\*\*[\s\S]+?\*\*|\*[\s\S]+?\*)/g;
            let out = '';
            let last = 0;
            let m;
            while ((m = inner.exec(str)) !== null) {
                if (m.index > last) {
                    out += `<span class="${baseClass}">${esc(str.slice(last, m.index))}</span>`;
                }
                const r = m[0];
                if (r.startsWith('**')) {
                    out += `<span class="dangan-vn-segment dangan-vn-segment-bold">${esc(r.slice(2, -2))}</span>`;
                } else {
                    out += `<span class="dangan-vn-segment dangan-vn-segment-action">${esc(r.slice(1, -1))}</span>`;
                }
                last = m.index + r.length;
            }
            if (last < str.length) out += `<span class="${baseClass}">${esc(str.slice(last))}</span>`;
            return out || `<span class="${baseClass}">${esc(str)}</span>`;
        };

        const pattern = /(\*\*[\s\S]+?\*\*|\*[\s\S]+?\*|"[^"]*")/g;
        let html = '';
        let lastIndex = 0;
        let hasAction = false;
        let match;

        while ((match = pattern.exec(text)) !== null) {
            if (match.index > lastIndex) {
                html += processSpans(
                    text.slice(lastIndex, match.index),
                    'dangan-vn-segment dangan-vn-segment-narrator'
                );
            }
            const raw = match[0];
            if (raw.startsWith('**')) {
                html += `<span class="dangan-vn-segment dangan-vn-segment-bold">${esc(raw.slice(2, -2))}</span>`;
            } else if (raw.startsWith('*')) {
                hasAction = true;
                html += `<span class="dangan-vn-segment dangan-vn-segment-action">${esc(raw.slice(1, -1))}</span>`;
            } else {
                // Dialogue — process nested bold/italic inside the quotes
                html += processSpans(raw, 'dangan-vn-segment dangan-vn-segment-dialogue');
            }
            lastIndex = match.index + raw.length;
        }
        if (lastIndex < text.length) {
            html += processSpans(
                text.slice(lastIndex),
                'dangan-vn-segment dangan-vn-segment-narrator'
            );
        }
        return { html: html || esc(text), hasAction };
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

        const token = streamToken;
        const step = () => {
            if (token != streamToken || !textEl) return;
            const currentLength = textEl.textContent?.length || 0;
            if (currentLength >= targetText.length) {
                textEl.classList.remove('dangan-vn-text-streaming');
                streamTimerId = null;
                applyVnMarkup(targetText);
                return;
            }

            const remaining = targetText.length - currentLength;
            const delta = remaining > 40 ? 3 : remaining > 18 ? 2 : 1;
            textEl.textContent = targetText.slice(0, currentLength + delta);
            textEl.classList.add('dangan-vn-text-streaming');
            streamTimerId = setTimeout(step, 14);
        };

        textEl.textContent = '';
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
        }).filter(msg => !msg.isUser && !msg.isSystem && msg.text);
    }

    function getDomMessages() {
        return Array.from(document.querySelectorAll('.mes')).map((msgEl, idx) => {
            const isUser = msgEl.getAttribute('is_user') === 'true';
            const isSystem = msgEl.getAttribute('is_system') === 'true';
            const name = String(msgEl.getAttribute('ch_name') || msgEl.getAttribute('name') || '').trim();
            const text = toPlainText(msgEl.querySelector('.mes_text')?.innerHTML || msgEl.querySelector('.mes_text')?.textContent || '');
            return { key: `dom-${idx}`, isUser, isSystem, name, text };
        }).filter(msg => !msg.isUser && !msg.isSystem && msg.text);
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

        const entries = getMessageEntries();
        transcriptBodyEl.innerHTML = '';

        if (!entries.length) {
            const emptyEl = document.createElement('div');
            emptyEl.className = 'dangan-vn-transcript-empty';
            emptyEl.textContent = 'No transcript entries yet.';
            transcriptBodyEl.appendChild(emptyEl);
            return;
        }

        for (const entry of entries) {
            const row = document.createElement('div');
            row.className = 'dangan-vn-transcript-entry';

            const speaker = document.createElement('div');
            speaker.className = 'dangan-vn-transcript-speaker';
            speaker.textContent = entry.name || 'UNKNOWN';

            const message = document.createElement('div');
            message.className = 'dangan-vn-transcript-message';
            message.textContent = stripV3CMarkersFromText(entry.text || '').replace(/\s+/g, ' ').trim() || '...';

            row.appendChild(speaker);
            row.appendChild(message);
            transcriptBodyEl.appendChild(row);
        }
    }

    function splitIntoChunks(text = '') {
        const normalized = String(text || '').replace(/\s+/g, ' ').trim();
        if (!normalized) return [];

        const chunks = [];
        let remaining = normalized;
        const min = CHUNK_SIZE * 0.4;

        while (remaining.length > CHUNK_SIZE) {
            let splitAt = -1;

            // 1. Prefer splitting after a closing " (end of a dialogue line)
            const quoteAt = remaining.lastIndexOf('"', CHUNK_SIZE);
            if (quoteAt >= min) splitAt = quoteAt;

            // 2. Fall back to sentence end (.)
            if (splitAt < min) {
                const dotAt = remaining.lastIndexOf('.', CHUNK_SIZE);
                if (dotAt >= min) splitAt = dotAt;
            }

            // 3. Fall back to last space
            if (splitAt < min) {
                const spaceAt = remaining.lastIndexOf(' ', CHUNK_SIZE);
                if (spaceAt >= 1) splitAt = spaceAt;
            }

            // 4. Hard cut
            if (splitAt < 1) splitAt = CHUNK_SIZE;

            chunks.push(remaining.slice(0, splitAt + 1).trim());
            remaining = remaining.slice(splitAt + 1).trim();
        }

        if (remaining) chunks.push(remaining);
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
        const clean = stripV3CMarkersFromText(entry.text).replace(/\s+/g, ' ').trim();
        const chunks = splitIntoChunks(clean);

        if (!chunks.length) {
            nameEl.textContent = entry.name || 'UNKNOWN';
            renderDialogueText('...');
            updateNavigationState(messages);
            return;
        }

        chunkIndex = Math.max(0, Math.min(chunkIndex, chunks.length - 1));
        nameEl.textContent = entry.name || 'UNKNOWN';
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

    prevBtnEl?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        retreat();
    });

    nextBtnEl?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        advance();
    });

    latestBtnEl?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
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
        if (target instanceof Element && target.closest('.dangan-vn-transcript-toggle')) return;
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

    const observer = new MutationObserver(() => {
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
        } else if (messageIndex >= maxIndex || (wasAtTailBeforeNewMessage && !hadMessageCountChange)) {
            jumpToLatest();
        } else {
            renderCurrent();
        }
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

function playInvestigationTrack() {
    const tracks = getMonopadSetting("investigationTracks") || [];
    if (!tracks.length) return;

    const path = tracks[Math.floor(Math.random() * tracks.length)];
    if (!path) return;

    // Route through Dynamic Audio extension if available — shows in its UI
    const $bgmSelect = $("#audio_bgm_select");
    if ($bgmSelect.length) {
        if (!$bgmSelect.find(`option[value="${CSS.escape ? path : path}"]`).length) {
            const name = path.split("/").pop().replace(/\.[^/.]+$/, "");
            $bgmSelect.append(new Option(`asset: ${name}`, path));
        }
        $bgmSelect.val(path).trigger("change");
        console.log(`[Dangan][Investigation] Handing off to Dynamic Audio: ${path}`);
        return;
    }

    // Fallback: direct audio if Dynamic Audio extension not loaded
    if (investigationTrackAudio) {
        investigationTrackAudio.pause();
        investigationTrackAudio = null;
    }

    investigationTrackAudio = new Audio(path);
    investigationTrackAudio.loop = true;
    investigationTrackAudio.volume = Number(getMonopadSetting("monopadVolume") ?? 50) / 100;
    investigationTrackAudio.play().catch(e =>
        console.warn("[Dangan][Investigation] Track play failed:", e)
    );
    console.log(`[Dangan][Investigation] Playing track (direct): ${path}`);
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

function renderSelectedInvestigationTracks() {
    const $panel = $("#investigation-selected-list");
    if (!$panel.length) return;

    const tracks = getMonopadSetting("investigationTracks") || [];
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

async function renderInvestigationTracks() {
    const $list = $("#investigation-tracks-list");
    if (!$list.length) return;

    $list.empty().append('<div class="investigation-tracks-loading">LOADING TRACKS...</div>');

    let bgmPaths = [];
    try {
        const response = await fetch("/api/assets/get", {
            method: "POST",
            headers: getRequestHeaders({ omitContentType: true }),
        });
        if (response.ok) {
            const data = await response.json();
            bgmPaths = Array.isArray(data.bgm) ? data.bgm.filter(p => p && p.trim()) : [];
        }
    } catch (e) {
        console.warn("[Dangan][Investigation] Failed to fetch BGM list:", e);
    }

    $list.empty();

    if (!bgmPaths.length) {
        $list.append('<div class="investigation-tracks-empty">NO BGM TRACKS FOUND</div>');
        return;
    }

    const selected = new Set(getMonopadSetting("investigationTracks") || []);
    const allSelected = bgmPaths.every(p => selected.has(p));

    const $selectAll = $(`
        <label class="investigation-track-row investigation-track-select-all">
            <input type="checkbox" class="investigation-track-select-all-checkbox" ${allSelected ? "checked" : ""}>
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
                <input type="checkbox" class="investigation-track-checkbox" data-path="${path}" ${checked ? "checked" : ""}>
                <span class="investigation-track-name">${name}</span>
            </label>
        `);
        $list.append($row);
    });

    renderSelectedInvestigationTracks();
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

async function generateIsolated(prompt, { allowDialogue = false } = {}) {
    const fullPrompt = `
You are an analysis engine.
You do NOT roleplay.
${allowDialogue ? "You may include extremely short quoted dialogue only when explicitly requested." : "You do NOT write dialogue."}
You ONLY output structured analytical reports.

${prompt}
`.trim();

    if (isOpenRouterGenerationEnabled()) {
        return generateWithOpenRouter(fullPrompt, {
            maxTokens: 300,
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
        max_tokens: 300,
        temperature: 0.25,
        top_p: 0.9,
        stop: ["USER:", "ASSISTANT:", "###"]
    });

    return (result || "").trim();
}

async function generateTrialDialogue(prompt, { maxTokens = 140, temperature = 0.7, topP = 0.9, stop = ["USER:", "ASSISTANT:", "###"] } = {}) {
    const fullPrompt = String(prompt || "").trim();

    if (!window.SillyTavern?.getContext) {
        if (isOpenRouterGenerationEnabled()) {
            return generateWithOpenRouter(fullPrompt, {
                maxTokens,
                temperature,
                topP,
                stop,
            });
        }
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

    const prompt = `
TASK:
Analyze the character and produce a concise analytical profile.

You are NOT summarizing.
You are NOT copying phrasing.
You are performing trait abstraction.

Rules:
- Do NOT roleplay
- Do NOT quote the source text
- Do NOT reuse wording from the character card
- Use neutral, third-person analytical language
- Combine similar traits into categories
- Remove redundancy

Return the data EXACTLY in this format:

ultimate: <profession or role>
height: <approximate or inferred>
measurements: <approximate or inferred>
personality: <3–5 concise analytical traits>
likes: <short list of interests or motivations>
dislikes: <short list of aversions or conflicts>

Use commas to separate items.
Use neutral psychological descriptors.
If unsure, infer conservatively.

SOURCE DATA:
${sourceText}
`.trim();

    try {
        const result = (await generateIsolated(prompt)) || "";
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
        return "ultimate: unknown\nheight: unknown\nmeasurements: unknown\npersonality: unknown";
    }
}

let sfx = {};
function playSfx(sound) {
    if (!sound) return;
    const volume = Number(extension_settings[extensionName]?.monopadVolume ?? 50) / 100;
    if (volume <= 0) return;
    sound.currentTime = 0;
    sound.volume = volume;
    sound.play().catch(() => {});
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

    const observer = new MutationObserver(() => {
        processAllMessages();
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

function applyImageVisibilitySettings() {
    document.body.classList.toggle("dangan-hide-truth-images", !!getMonopadSetting("hideTruthBulletImages"));
    document.body.classList.toggle("dangan-hide-gift-images", !!getMonopadSetting("hideGiftImages"));
    document.body.classList.toggle("dangan-hide-hopes-peak-branding", !!getMonopadSetting("hideHopesPeakBranding"));
}

function applyDynamicTheme() {
    const body = document.body;
    body.classList.remove("dangan-theme-daily", "dangan-theme-night", "dangan-theme-investigation");

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
        handleTruthBullet("Important Thing!", "Will this show us whodunnit?", { grantMonocoins: false, grantXp: false, image: `${extensionFolderPath}/assets/monokuma_kotodama.png` });
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
    $(".settings-lang-btn").removeClass("active");
    $(`.settings-lang-btn[data-lang="${lang}"]`).addClass("active");

    renderInvestigationTracks();

    const providerSelect = document.getElementById("dangan_generation_provider");
    if (providerSelect) {
        providerSelect.value = tab.generationProvider || defaultSettings.generationProvider;
    }

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

    const showOpenRouterControls = (providerSelect?.value || tab.generationProvider) === "openrouter";
    document.querySelectorAll(".settings-openrouter-only").forEach(el => {
        el.classList.toggle("is-hidden", !showOpenRouterControls);
    });

    applyCrtSettings();
    applyDynamicTheme();
    renderTimeTrackerUi();
    vnModeController?.setEnabled?.(!!tab.vnModeEnabled);
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

    debugUiObserver = new MutationObserver(() => {
        const controls = document.getElementById("trust-debug-controls");
        const modal = document.getElementById("truth-debug-modal");

        if (!controls || controls.parentElement !== document.body || !modal || modal.parentElement !== document.body) {
            ensureGlobalDebugUi();
        }
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
        breachAudio = new Audio(`${extensionFolderPath}/assets/nwo.mp3`);
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
    }

        initTrustAnimations({
    sfx,
    unlockAudio,
    playSfx,
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
            getSpriteUrl: async (charName) => {
                // Determine folder: prefer avatar filename (without ext), fall back to charName itself
                let folder = charName;
                const stChars = window.characters;
                if (Array.isArray(stChars)) {
                    const stChar = stChars.find(c => c.name === charName);
                    if (stChar?.avatar) {
                        folder = stChar.avatar.replace(/\.[^.]+$/, "");
                    }
                }
                console.debug(`[Dangan][Sprite] Looking up neutral for "${charName}", folder="${folder}"`);
                try {
                    const resp = await fetch(`/api/sprites/get?name=${encodeURIComponent(folder)}`);
                    if (!resp.ok) {
                        console.debug(`[Dangan][Sprite] API error ${resp.status} for folder="${folder}"`);
                        return null;
                    }
                    const sprites = await resp.json();
                    console.debug(`[Dangan][Sprite] Got ${sprites.length} sprites:`, sprites.map(s => s.label));
                    const neutral = sprites.find(s => s.label === "neutral");
                    console.debug(`[Dangan][Sprite] Neutral path:`, neutral?.path);
                    return neutral?.path ?? null;
                } catch (e) {
                    console.debug(`[Dangan][Sprite] Fetch error:`, e);
                    return null;
                }
            },
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
            });
            mapPanelController?.renderMapPanel?.();
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
        }

        $("#dangan_monopad_close").on("click", () => {
            closeMonopadPanel();
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
                if (getMonopadSetting("monopadJingleEnabled") !== false) playSfx(sfx.open);
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

        $(document).on("mouseenter", "#monopad-pass-time, #monopad-sleep, #dangan_monopad_close, .truth-item, .truth-archived-item, .truth-remove-button, .truth-reload-button, .truth-delete-button, .truth-image-delete-btn, .truth-image-upload-label", function () {
            if (!this.disabled) playHoverWithCooldown();
        });

        $(document).on("click", ".truth-item, .truth-archived-item, .truth-remove-button, .truth-reload-button, .truth-delete-button, .truth-image-delete-btn, .truth-image-upload-label", function () {
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

        $("#monopad-pass-time").on("click", () => {
            playSfx(sfx.click);
            passTimeToNight({ source: "monopad_button" });
        });

        $("#monopad-sleep").on("click", () => {
            playSfx(sfx.click);
            sleepToNextDay({ source: "monopad_button" });
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
            }
            mapPanelController?.handleSettingsChanged?.();
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
            const track = document.getElementById("monopad_sfx_monochine_track");
            if (track) track.volume = vol / 100;
        });

        $(document).on("click", ".settings-lang-btn", function () {
            const lang = String(this.dataset.lang || "EN");
            setMonopadSetting("monokumaLanguage", lang);
            $(".settings-lang-btn").removeClass("active");
            $(`.settings-lang-btn[data-lang="${lang}"]`).addClass("active");
        });

        $(document).on("change", ".investigation-track-select-all-checkbox", function () {
            const $list = $("#investigation-tracks-list");
            const allPaths = $list.find(".investigation-track-checkbox").map(function () {
                return String($(this).data("path") || "");
            }).get().filter(Boolean);
            if (this.checked) {
                setMonopadSetting("investigationTracks", allPaths);
                $list.find(".investigation-track-checkbox").prop("checked", true);
            } else {
                setMonopadSetting("investigationTracks", []);
                $list.find(".investigation-track-checkbox").prop("checked", false);
            }
            renderSelectedInvestigationTracks();
        });

        $(document).on("change", ".investigation-track-checkbox", function () {
            const path = String($(this).data("path") || "");
            if (!path) return;
            const tracks = new Set(getMonopadSetting("investigationTracks") || []);
            if (this.checked) tracks.add(path);
            else tracks.delete(path);
            setMonopadSetting("investigationTracks", [...tracks]);
            // Sync select-all state
            const $list = $("#investigation-tracks-list");
            const total = $list.find(".investigation-track-checkbox").length;
            const checked = $list.find(".investigation-track-checkbox:checked").length;
            $list.find(".investigation-track-select-all-checkbox").prop("checked", total > 0 && checked === total);
            renderSelectedInvestigationTracks();
        });

        renderInvestigationTracks();

        $("#dangan_generation_provider").on("change", function () {
            setMonopadSetting("generationProvider", this.value || defaultSettings.generationProvider);
            applySettingsTabUI();
            mapPanelController?.handleSettingsChanged?.();
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
});
window.startClassTrial = () => classTrialMenuController?.open?.();

const audioVisualizer = createAudioVisualizerController({
    getAudioElement: () => {
        if (investigationTrackAudio && !investigationTrackAudio.paused) return investigationTrackAudio;
        const bgm = document.getElementById('audio_bgm');
        if (bgm instanceof HTMLAudioElement) return bgm;
        return investigationTrackAudio ?? null;
    },
    assetsBasePath: extensionFolderPath,
    getGameState: () => ({
        isInvestigation: investigationUnderway,
        isNight: ensureTimeTrackerState().phase === TIME_PHASE_NIGHT,
    }),
});
audioVisualizer.init();
rewards?.renderProgressionUi?.();
itemsPanelController.loadInventoryState();
applySettingsTabUI();
applyImageVisibilitySettings();
applyMonopadLaunchControlState(monopadButtonEl, $panel.get(0));
loadCharacters();
itemsPanelController.renderSkillsItemsPanel();


// 🔴 FORCE REGISTER FROM EXISTING CHAT
//waitForRealChat(() => {
    //registerCharactersFromContext();
    //socialPanelController.renderSocialPanel();
//});

debugSTGlobals();
        
        try {
            $("#send_button").on("click", function () {
                const text = $("#send_textarea").val();
                trialManager?.onMessageSent(text);
            });

            $("#send_textarea").on("keydown", function (e) {
                if (e.key === "Enter" && !e.shiftKey) {
                    const text = $(this).val();
                    trialManager?.onMessageSent(text);
                }
            });
        } catch (e) {
            console.error(`[${extensionName}] ❌ Chat hooks failed:`, e);
        }

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
    extension_settings,
    saveSettingsDebounced,
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

    try {
        trialManager = createTrialManager({
            extensionName,
            extensionSettings: extension_settings,
            saveSettingsDebounced,
            vnModeController,
            getTruthBullets,
            generateTrialDialogue,
            getCharacterSourceText,
            getSpriteUrl,
            playSfx,
            getSfx: () => sfx,
            characters,
        });
    } catch (e) {
        console.error(`[${extensionName}] ❌ Trial Manager init failed:`, e);
    }

    } catch (error) {
        bootstrapDebugUi();
        console.error(`[${extensionName}] ❌ Load failed:`, error);
    }
});

// ── Slash Commands ──────────────────────────────────────────────────────────

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'body-discovered',
    callback: async (args) => {
        const bgName = String(args.bg || '').trim();

        // Switch the background underneath the static overlay so the transition is hidden
        const switchBackground = () => {
            if (!bgName) return;
            const bgElements = Array.from(document.querySelectorAll('.bg_example'));
            const lower = bgName.toLowerCase();
            const match = bgElements.find(el => el.getAttribute('bgfile')?.toLowerCase().includes(lower));
            if (match instanceof HTMLElement) match.click();
        };

        // 1. Static + vignette overlay (despair noise) — swap BG at peak while hidden
        const overlayPromise = monokumaAnnouncementController?.triggerAsync('BODY_DISCOVERY');
        setTimeout(switchBackground, 220);
        await overlayPromise;

        // 2. Body Discovery Announcement (BDA)
        await monokumaAnnouncementController?.triggerAsync('BDA');

        // 3. Investigation banner + SFX + dynamic theme
        investigationStartController.trigger();
        applyDynamicTheme();
        return '';
    },
    helpString: 'Plays the body discovery vignette, then the BDA, then triggers Investigation. Optional: bg=&lt;name&gt; to transition to a background under the static.',
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'bg',
            description: 'Background image to switch to under the static effect (partial name match)',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: false,
        }),
    ],
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'pass-time',
    callback: async () => {
        const state = ensureTimeTrackerState();
        state.phase = TIME_PHASE_NIGHT;
        state.dayActionUsed = true;
        saveSettingsDebounced();
        renderTimeTrackerUi();
        applyTimeContextToGeneration();
        // Keep current (day) theme during the announcement
        await monokumaAnnouncementController?.triggerAsync('NIGHT_ANNOUN');
        // Show "Night Time START!" banner + SFX, wait for both to finish
        await nightTimeStartController.triggerAsync();
        // Now switch to the night theme
        applyDynamicTheme();
        return '';
    },
    helpString: 'Triggers the nighttime announcement, shows a Night Time Start banner, then switches to the Night theme.',
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'go-to-sleep',
    callback: async () => {
        const state = ensureTimeTrackerState();
        state.day = Math.max(1, Number(state.day || 1) + 1);
        state.phase = TIME_PHASE_DAY;
        state.dayActionUsed = false;
        saveSettingsDebounced();
        renderTimeTrackerUi();
        applyTimeContextToGeneration();
        // Keep current (night) theme during the announcement
        await monokumaAnnouncementController?.triggerAsync('DAY_ANNOUN');
        // Show "Free Time START!" banner + SFX, wait for both to finish
        await freeTimeStartController.triggerAsync();
        // Now switch to the day theme
        applyDynamicTheme();
        return '';
    },
    helpString: 'Advances to the next day, plays the daytime announcement, shows a Free Time Start banner, then switches to the Day theme.',
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'give-truth-bullet',
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
