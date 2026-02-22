import { extension_settings } from "../../../../extensions.js";
import { saveSettingsDebounced } from "../../../../../script.js";
import { initTruthBullets, handleTruthBullet, setNextTruthBulletSfxVariant } from "../truth/truthBullets.js";
import { buildDecagram, crackShard, shatterShard } from "../trust/trustDecagram.js";
import { initTrustAnimations, playTrustRankUp, playTrustRankDown, playTrustMaxed, playTrustToDistrustTransition, playDistrustRankDown, playDistrustRankUp, playDistrustToTrustRecovery } from "../trust/trustAnimations.js";
import { increaseTrust, decreaseTrust } from "../trust/trustAPI.js";
import { createItemsPanelController } from "../items/itemsPanel.js";
import { createRewardSystem } from "../items/rewardSystem.js";
import { createSocialPanelController } from "../social/socialPanel.js";
import { extractUltimateFromNotes, isIgnoredCharacter, lookupUltimateFromLorebook, normalizeList, normalizeName } from "../social/characterUtils.js";
import { createMapPanelController } from "../map/mapPanel.js";
import { getLocationPromptReference, resolveLocationIdFromText } from "../map/locationPresence.js";
import { INVESTIGATION_START_REGEX, MONOCOIN_REWARDS, REWARD_DIFFICULTY_LABELS, REWARD_PROFILES, TRIAL_START_REGEX, XP_REWARDS, SOCIAL_DOWN_REGEX, SOCIAL_REGEX, SOCIAL_UP_REGEX, defaultSettings, extensionFolderPath, extensionName } from "../core/constants.js";
import { createOpenRouterSettingsManager } from "../core/openrouterSettings.js";
import { MONOKUMA_LESSON_STEPS, MONOKUMA_LESSON_TITLE } from "../core/monokumaLessonScript.js";
import { createRecentLocationTracker } from "../core/locationPresenceHistory.js";
import { createRewardDifficultyManager } from "../core/rewardDifficulty.js";
import { openMonopadConfirmDialog } from "../core/confirmDialog.js";
import { createTrialController } from "../trial/trialController.js";
import { createMonokumaAnnouncementController, parseMonokumaAnnouncementMarkers } from "../monokuma/announcementController.js";
import { createVnSystem } from "../systems/vn/vnModeController.js";

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
let trialController = null;
let trialIntroUiController = null;
let trialIntroOstController = null;
let trialDiscussionController = null;
let nonstopDebateController = null;
let hasSelectedMonopadTab = false;
let monokumaLessonState = null;
let vnModeController = null;
let monokumaAnnouncementController = null;

const { createVnModeController } = createVnSystem({ extensionName, saveSettingsDebounced });

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

const {
    pushRecentLocationMention,
    buildRecentLocationPresence,
} = createRecentLocationTracker({
    normalizeName,
    getActivePersonaName: () => getActivePersonaName(),
});

window.getMonopadRecentLocationPresence = function () {
    return buildRecentLocationPresence();
};

const {
    clampRewardDifficulty,
    applyRewardDifficultyProfile,
} = createRewardDifficultyManager({
    rewardProfiles: REWARD_PROFILES,
    monocoins: MONOCOIN_REWARDS,
    xp: XP_REWARDS,
});

function awardMonocoins(amount = 0, reason = "") {
    rewards?.awardMonocoins(amount, reason);
}

function increaseTrustWithRewards(char) {
    rewards?.increaseTrustWithRewards(char);
}

function awardXp(amount = 0, reason = "") {
    rewards?.awardXp(amount, reason);
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
const processedTrialStartSignatures = new Set();
const TRIAL_START_PARSE_REGEX = /V3C\s*[|｜]\s*TRIAL(?:\s*[_\-]?\s*)START\b/gi;
const TRIAL_DISCUSSION_START_PARSE_REGEX = /V3C\s*[|｜]\s*TRIAL(?:\s*[_\-]?\s*)DISCUSSION(?:\s*[_\-]?\s*)START\b/gi;
const TRIAL_DISCUSSION_END_PARSE_REGEX = /V3C\s*[|｜]\s*TRIAL(?:\s*[_\-]?\s*)DISCUSSION(?:\s*[_\-]?\s*)END\b/gi;
const processedTrialDiscussionSignatures = new Set();
const processedMonokumaAnnouncementSignatures = new Set();

function normalizeTextToken(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[_\-]+/g, " ")
        .replace(/\s+/g, " ");
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

    const store = getInvestigationMarkerStore();
    store[persistentSignature || `RUNTIME||${signature}`] = Date.now();

    const keys = Object.keys(store);
    const maxEntries = 1200;
    if (keys.length > maxEntries) {
        keys
            .sort((a, b) => Number(store[a] || 0) - Number(store[b] || 0))
            .slice(0, keys.length - maxEntries)
            .forEach((key) => {
                delete store[key];
            });
    }

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

function parseTrialStartMarkers(text) {
    const raw = String(text || "");
    if (!raw) return [];

    const matches = [];
    TRIAL_START_PARSE_REGEX.lastIndex = 0;

    let match;
    while ((match = TRIAL_START_PARSE_REGEX.exec(raw)) !== null) {
        matches.push({
            marker: match[0],
            index: match.index,
            source: "regex",
        });
    }

    if (matches.length) return matches;

    const lines = raw.split(/\r?\n/);
    let cursor = 0;

    for (const line of lines) {
        const canonical = line
            .toUpperCase()
            .replace(/[|｜]/g, "|")
            .replace(/[`*_~:;,.!?\-\s]/g, "");

        if (canonical.includes("V3C|TRIALSTART")) {
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

function parseTrialDiscussionMarkers(text) {
    const raw = String(text || "");
    if (!raw) return { startMarkers: [], endMarkers: [] };

    const startMarkers = [];
    const endMarkers = [];

    TRIAL_DISCUSSION_START_PARSE_REGEX.lastIndex = 0;
    TRIAL_DISCUSSION_END_PARSE_REGEX.lastIndex = 0;

    let match;
    while ((match = TRIAL_DISCUSSION_START_PARSE_REGEX.exec(raw)) !== null) {
        startMarkers.push({ marker: match[0], index: match.index, type: "start" });
    }
    while ((match = TRIAL_DISCUSSION_END_PARSE_REGEX.exec(raw)) !== null) {
        endMarkers.push({ marker: match[0], index: match.index, type: "end" });
    }

    return { startMarkers, endMarkers };
}

function buildTrialStartPersistentSignature(msgEl, marker, idx, rawText = "") {
    const mesId = msgEl?.getAttribute?.("mesid") || msgEl?.dataset?.mesid || "";
    if (!mesId || mesId === "no-id") return "";

    const speaker = msgEl?.getAttribute?.("ch_name") || "unknown";
    const scope = getInvestigationScopeKey();
    if (!scope || scope === "scope:unknown") return "";

    const markerIndex = Number(marker?.index ?? -1);
    const textFingerprint = String(rawText || "").slice(0, 140);

    return `TRIAL_START||${scope}||${mesId}||${speaker}||${markerIndex}||${idx}||${textFingerprint}`;
}

function getTrialStartMarkerStore() {
    extension_settings[extensionName] ||= {};
    extension_settings[extensionName].trialStartMarkers ||= {};
    return extension_settings[extensionName].trialStartMarkers;
}

function hasProcessedTrialStartSignature(signature, persistentSignature = "") {
    if (!signature) return false;
    if (processedTrialStartSignatures.has(signature)) return true;
    if (!persistentSignature) return false;
    return Boolean(getTrialStartMarkerStore()[persistentSignature]);
}

function markTrialStartSignatureProcessed(signature, persistentSignature = "") {
    if (!signature) return;

    processedTrialStartSignatures.add(signature);
    if (!persistentSignature) return;

    const store = getTrialStartMarkerStore();
    store[persistentSignature] = Date.now();

    const keys = Object.keys(store);
    const maxEntries = 1200;
    if (keys.length > maxEntries) {
        keys
            .sort((a, b) => Number(store[a] || 0) - Number(store[b] || 0))
            .slice(0, keys.length - maxEntries)
            .forEach((key) => {
                delete store[key];
            });
    }

    saveSettingsDebounced();
}

function getMonokumaAnnouncementMarkerStore() {
    extension_settings[extensionName] ||= {};
    extension_settings[extensionName].monokumaAnnouncementMarkers ||= {};
    return extension_settings[extensionName].monokumaAnnouncementMarkers;
}

function buildMonokumaAnnouncementPersistentSignature(msgEl, marker, idx, rawText = "") {
    const mesId = msgEl?.getAttribute?.("mesid") || msgEl?.dataset?.mesid || "";
    if (!mesId || mesId === "no-id") return "";

    const speaker = msgEl?.getAttribute?.("ch_name") || "unknown";
    const scope = getInvestigationScopeKey();
    if (!scope || scope === "scope:unknown") return "";

    const markerIndex = Number(marker?.index ?? -1);
    const markerType = String(marker?.type || "UNKNOWN");
    const textFingerprint = String(rawText || "").slice(0, 140);

    return `MONOKUMA_ANNOUN||${scope}||${mesId}||${speaker}||${markerType}||${markerIndex}||${idx}||${textFingerprint}`;
}

function hasProcessedMonokumaAnnouncementSignature(signature, persistentSignature = "") {
    if (!signature) return false;
    if (processedMonokumaAnnouncementSignatures.has(signature)) return true;
    if (!persistentSignature) return false;
    return Boolean(getMonokumaAnnouncementMarkerStore()[persistentSignature]);
}

function markMonokumaAnnouncementSignatureProcessed(signature, persistentSignature = "") {
    if (!signature) return;

    processedMonokumaAnnouncementSignatures.add(signature);

    const store = getMonokumaAnnouncementMarkerStore();
    store[persistentSignature || `RUNTIME||${signature}`] = Date.now();

    const keys = Object.keys(store);
    const maxEntries = 1200;
    if (keys.length > maxEntries) {
        keys
            .sort((a, b) => Number(store[a] || 0) - Number(store[b] || 0))
            .slice(0, keys.length - maxEntries)
            .forEach((key) => {
                delete store[key];
            });
    }

    saveSettingsDebounced();
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

function buildTrialCaseSummary() {
    const bullets = getTruthBulletsSnapshot();
    if (!bullets.length) {
        return "No Truth Bullets logged yet. Review witness statements before opening arguments.";
    }

    const line = bullets
        .slice(-3)
        .map((bullet, index) => `${index + 1}. ${String(bullet?.title || "Unknown Bullet")}`)
        .join(" ");

    return `Current evidence focus: ${line}`;
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

        const didAnything = Boolean(bannerShown || sfxResult?.played || toggled);
        if (!didAnything) {
            console.info("[Dangan][Investigation] Marker detected, but no effect could be shown.");
        }

        return didAnything;
    },
};

function syncTrialForcedVnMode() {
    if (!trialController || !vnModeController) return;
    const phase = trialController.getState?.()?.phase;
    const trialActive = Boolean(phase) && phase !== trialController?.phases?.IDLE;

    if (trialActive) {
        vnModeController.setEnabled?.(true);
        return;
    }

    vnModeController.setEnabled?.(!!getMonopadSetting('vnModeEnabled'));
}

async function triggerTrialStartFromMarker(markerText = "V3C| TRIAL_START") {
    if (!trialController) return false;

    try {
        const result = await trialController.requestStartFromMarker({ markerText });
        trialIntroUiController?.sync?.();
        trialDiscussionController?.sync?.();
        nonstopDebateController?.sync?.();
        syncTrialForcedVnMode();
        if (result?.started) {
            console.log("[Dangan][Trial] Class Trial started from marker.");
            return true;
        }

        if (result?.reason) {
            console.info(`[Dangan][Trial] Trial start not triggered: ${result.reason}`);
        }
    } catch (error) {
        console.warn("[Dangan][Trial] Failed to start trial from marker:", error);
    }

    return false;
}


async function triggerTrialStartFromMapPin() {
    if (!trialController) return false;

    const state = trialController.getState?.();
    if (state?.phase && state.phase !== trialController.phases?.IDLE) {
        console.info(`[Dangan][Trial] Trial already active (${state.phase}).`);
        return false;
    }

    const accepted = await openMonopadConfirmDialog({
        title: "TRIAL GROUNDS",
        message: "Start Class Trial from Trial Grounds?",
        confirmLabel: "START TRIAL",
        cancelLabel: "CANCEL",
    });

    if (!accepted) return false;

    const result = trialController.requestStartFromUi?.({ source: "map_pin" });
    trialIntroUiController?.sync?.();
    trialDiscussionController?.sync?.();
    nonstopDebateController?.sync?.();
    syncTrialForcedVnMode();
    if (result?.started) {
        console.log("[Dangan][Trial] Class Trial started from map pin.");
        return true;
    }

    if (result?.reason) {
        console.info(`[Dangan][Trial] Trial start not triggered: ${result.reason}`);
    }

    return false;
}

function createTrialIntroOstController() {
    const candidateTracks = buildExtensionPathCandidates()
        .map(basePath => `${basePath}/assets/classtrial/trialunderground.mp3`);

    let activeAudio = null;
    let activeTrackIndex = -1;

    function moveToNextTrack() {
        if (!activeAudio) return;
        if (activeTrackIndex >= candidateTracks.length - 1) return;
        activeTrackIndex += 1;
        activeAudio.src = candidateTracks[activeTrackIndex];
        activeAudio.load();
    }

    function stop() {
        if (!activeAudio) return;
        activeAudio.pause();
        activeAudio.currentTime = 0;
    }

    function play() {
        if (!extension_settings[extensionName]?.monopadSounds) return;
        if (!candidateTracks.length) return;

        if (!activeAudio) {
            activeTrackIndex = 0;
            activeAudio = new Audio(candidateTracks[activeTrackIndex]);
            activeAudio.loop = true;
            activeAudio.preload = "auto";
            activeAudio.volume = 0.42;

            activeAudio.addEventListener("error", () => {
                const previousIndex = activeTrackIndex;
                moveToNextTrack();
                if (previousIndex === activeTrackIndex) {
                    console.warn("[Dangan][Trial] Could not load trialunderground.mp3 from any extension path candidate.");
                    return;
                }
                activeAudio.play().catch(() => {});
            });
        }

        activeAudio.play().catch(() => {});
    }

    return {
        play,
        stop,
    };
}

function ensureTrialIntroOverlay() {
    let overlay = document.getElementById("dangan-trial-intro-overlay");
    if (overlay) return overlay;

    overlay = document.createElement("section");
    overlay.id = "dangan-trial-intro-overlay";
    overlay.className = "dangan-trial-intro-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
        <div class="dangan-trial-backdrop" aria-hidden="true">
            <div class="dangan-trial-grid"></div>
            <div class="dangan-trial-cylinder"></div>
            <div class="dangan-trial-cylinder dangan-trial-cylinder-alt"></div>
            <div class="dangan-trial-glow-orb"></div>
        </div>
        <div class="dangan-trial-intro-shell" role="dialog" aria-modal="false" aria-labelledby="dangan-trial-intro-title">
            <header class="dangan-trial-intro-header">
                <div class="dangan-trial-prep-label">Court Preparation</div>
                <h2 id="dangan-trial-intro-title">Class Trial</h2>
                <p>Sharpen your Truth Bullets and ready your opening statement.</p>
            </header>
            <section class="dangan-trial-case-summary" aria-live="polite">
                <div class="dangan-trial-case-summary-label">Case Summary</div>
                <p id="dangan-trial-case-summary-text">Case summary pending.</p>
            </section>
            <div class="dangan-trial-intro-actions">
                <button type="button" class="dangan-trial-intro-skills" id="dangan-trial-intro-skills">Equip Skills</button>
                <button type="button" class="dangan-trial-intro-cancel" id="dangan-trial-intro-cancel">Withdraw</button>
                <button type="button" class="dangan-trial-intro-start" id="dangan-trial-intro-start">Begin Class Trial</button>
            </div>
        </div>
    `;

    const startBtn = overlay.querySelector("#dangan-trial-intro-start");
    startBtn?.addEventListener("click", () => {
        if (!trialController) return;
        const result = trialController.transitionTo?.(trialController.phases.DISCUSSION_PRE_DEBATE, "trial_intro_start");
        if (!result?.ok) {
            console.info("[Dangan][Trial] Could not enter discussion_pre_debate from trial_intro.");
        }
        trialIntroUiController?.sync?.();
        syncTrialForcedVnMode();
    });

    const skillsBtn = overlay.querySelector("#dangan-trial-intro-skills");
    skillsBtn?.addEventListener("click", () => {
        const panel = document.getElementById("dangan_monopad_panel");
        if (panel && !panel.classList.contains("open")) {
            document.getElementById("dangan_monopad_button")?.click();
        }
        setActiveMonopadTab("skills");
        itemsPanelController?.renderSkillsItemsPanel?.();
    });

    const cancelBtn = overlay.querySelector("#dangan-trial-intro-cancel");
    cancelBtn?.addEventListener("click", () => {
        trialController?.cancelTrial?.();
        trialIntroUiController?.sync?.();
        syncTrialForcedVnMode();
    });

    document.body.appendChild(overlay);
    return overlay;
}

function createTrialDiscussionController() {
    const queue = [];
    let lastPhase = null;
    let pollId = null;
    let markerScopedDiscussionActive = false;

    function clearQueue() {
        queue.length = 0;
    }

    function isDiscussionPhase(phase) {
        return phase === trialController?.phases?.DISCUSSION_PRE_DEBATE || phase === trialController?.phases?.DISCUSSION_POST_DEBATE;
    }

    function phaseLabel(phase) {
        if (phase === trialController?.phases?.DISCUSSION_PRE_DEBATE) return "Pre-Debate Discussion";
        if (phase === trialController?.phases?.DISCUSSION_POST_DEBATE) return "Post-Debate Discussion";
        return "Discussion";
    }

    function ensureVnTrialLabel() {
        const frame = document.querySelector('#dangan-vn-overlay .dangan-vn-frame');
        if (!frame) return null;

        let phaseEl = frame.querySelector('#dangan-trial-discussion-phase-inline');
        if (!phaseEl) {
            phaseEl = document.createElement('div');
            phaseEl.id = 'dangan-trial-discussion-phase-inline';
            phaseEl.className = 'dangan-trial-discussion-phase-inline';
            frame.insertBefore(phaseEl, frame.firstChild);
        }

        return phaseEl;
    }

    function renderLine(entry, phase) {
        const phaseEl = ensureVnTrialLabel();
        if (phaseEl) phaseEl.textContent = phaseLabel(phase).toUpperCase();

        const nameEl = document.getElementById('dangan-vn-name');
        const textEl = document.getElementById('dangan-vn-text');
        if (nameEl) nameEl.textContent = String(entry?.speaker || 'UNKNOWN').toUpperCase();
        if (textEl) textEl.textContent = String(entry?.line || '...');
    }

    function enqueue(entries = [], phase = null) {
        if (!Array.isArray(entries) || !entries.length) return;

        // Do not auto-scroll through queued lines; keep VN behavior stable by showing only the latest line.
        const latestEntry = entries[entries.length - 1];
        queue.length = 0;
        queue.push(latestEntry);
        renderLine(latestEntry, phase);
    }

    function extractDiscussionEntries(rawText, fallbackSpeaker = "UNKNOWN") {
        const text = String(rawText || "");
        if (!text.trim()) return [];

        const cleaned = stripV3CMarkersFromText(text);
        if (!cleaned.trim()) return [];

        return cleaned
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean)
            .map(line => ({ speaker: fallbackSpeaker, line }));
    }

    function setDiscussionVisualState(active, phase = null) {
        document.body.classList.toggle('dangan-trial-discussion-vn-active', active);
        const phaseEl = ensureVnTrialLabel();
        if (phaseEl) {
            phaseEl.style.display = active ? 'block' : 'none';
            if (active) phaseEl.textContent = phaseLabel(phase).toUpperCase();
        }
    }

    function ingestMessage({ messageSignature = "", rawText = "", speaker = "UNKNOWN" } = {}) {
        if (!trialController) return;
        const trialState = trialController.getState?.() || {};
        const phase = trialState.phase;
        const sessionId = String(trialState?.session?.id || "no_session");
        if (!isDiscussionPhase(phase)) return;

        const { startMarkers, endMarkers } = parseTrialDiscussionMarkers(rawText);
        const hasStart = startMarkers.length > 0;
        const hasEnd = endMarkers.length > 0;

        if (hasStart) markerScopedDiscussionActive = true;

        const markerSignature = `TRIAL_DISCUSSION||${sessionId}||${messageSignature}||${hasStart}||${hasEnd}`;
        if (processedTrialDiscussionSignatures.has(markerSignature)) return;
        processedTrialDiscussionSignatures.add(markerSignature);

        const shouldEnqueueFallback = !hasStart && !hasEnd && !markerScopedDiscussionActive;
        const shouldEnqueueScoped = markerScopedDiscussionActive || hasStart;

        if (shouldEnqueueFallback || shouldEnqueueScoped) {
            enqueue(extractDiscussionEntries(rawText, speaker), phase);
        }

        if (hasEnd) {
            markerScopedDiscussionActive = false;
            if (phase === trialController?.phases?.DISCUSSION_PRE_DEBATE) {
                trialController?.transitionTo?.(trialController.phases.NONSTOP_INTRO_CUTSCENE, 'discussion_segment_complete');
                nonstopDebateController?.sync?.();
            }
        }
    }

    function sync() {
        if (!trialController) {
            setDiscussionVisualState(false);
            clearQueue();
            lastPhase = null;
            markerScopedDiscussionActive = false;
            return;
        }

        const phase = trialController.getState?.()?.phase;
        const inDiscussion = isDiscussionPhase(phase);
        setDiscussionVisualState(inDiscussion, phase);

        if (!inDiscussion) {
            clearQueue();
            markerScopedDiscussionActive = false;
        }

        lastPhase = phase;
    }

    function startAutoSync() {
        if (pollId) return;
        const tick = () => {
            const phase = trialController?.getState?.()?.phase || null;
            if (phase !== lastPhase) {
                sync();
            }
        };
        pollId = window.setInterval(tick, 250);
    }

    return {
        sync,
        startAutoSync,
        ingestMessage,
    };
}


function createNonstopDebateController() {
    let introTimer = null;
    let phaseTimer = null;
    let roundToken = 0;
    let weakPointCounter = 0;
    let restoredVnAfterNsd = false;
    let lastObservedPhase = null;
    let activeWeakPointIds = new Set();

    function ensureOverlay() {
        let overlay = document.getElementById('dangan-nsd-overlay');
        if (overlay) return overlay;

        overlay = document.createElement('section');
        overlay.id = 'dangan-nsd-overlay';
        overlay.className = 'dangan-nsd-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.innerHTML = `
            <div class="dangan-nsd-cutscene" id="dangan-nsd-cutscene">
                <div class="dangan-nsd-ring"></div>
                <div class="dangan-nsd-banner">NONSTOP DEBATE</div>
            </div>
            <div class="dangan-nsd-active" id="dangan-nsd-active">
                <div class="dangan-nsd-round-label" id="dangan-nsd-round-label">Round 1 · Replies: 0/0</div>
                <div class="dangan-nsd-floating-layer" id="dangan-nsd-floating-layer"></div>
            </div>
        `;

        document.body.appendChild(overlay);
        return overlay;
    }

    function clearTimers() {
        if (introTimer) {
            clearTimeout(introTimer);
            introTimer = null;
        }
        if (phaseTimer) {
            clearTimeout(phaseTimer);
            phaseTimer = null;
        }
    }

    function clearFloating() {
        const overlay = ensureOverlay();
        const layer = overlay.querySelector('#dangan-nsd-floating-layer');
        if (layer) layer.innerHTML = '';
    }

    function extractQuotedSegments(text) {
        const raw = String(text || '');
        const quoteRegex = /"([^"\n\r]+)"/g;
        const segments = [];

        let match = null;
        while ((match = quoteRegex.exec(raw)) !== null) {
            const segment = String(match?.[1] || '').trim();
            if (segment) segments.push(segment);
        }

        return segments;
    }

    function extractField(text, key) {
        const escapedKey = String(key || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`^${escapedKey}\\s*:\\s*(.+)$`, 'im');
        return String(text.match(regex)?.[1] || '').trim();
    }

    function splitWords(value) {
        return String(value || '')
            .replaceAll('\n', ' ')
            .replaceAll('\r', ' ')
            .split(' ')
            .map(word => word.trim())
            .filter(Boolean);
    }

    function chooseWeakPointRange(dialogue) {
        const words = splitWords(dialogue);
        if (!words.length) return { start: 0, end: 0 };

        const span = Math.max(1, Math.min(2, Math.floor(words.length / 5)));
        const maxStart = Math.max(0, words.length - span);
        const start = Math.floor(Math.random() * (maxStart + 1));
        return { start, end: Math.min(words.length - 1, start + span - 1) };
    }

    async function generateDebateReply() {
        const ctx = window.SillyTavern?.getContext?.();
        const prompt = `
TASK:
Write one short Class Trial line from one character.
Return EXACTLY this format:
speaker: <name>
line: "<one dialogue line, max 24 words>"

Rules:
- One single quoted dialogue line.
- No narration.
- No markdown.
- Keep momentum for Nonstop Debate pressure.
`.trim();

        if (ctx?.generateRaw) {
            const result = await ctx.generateRaw({
                prompt,
                max_tokens: 90,
                temperature: 0.8,
                top_p: 0.95,
                stop: ['USER:', 'ASSISTANT:']
            });
            return String(result || '').trim();
        }

        const fallback = await generateIsolated(`${prompt}\nUse short analytical output only.`, { allowDialogue: true });
        return String(fallback || '').trim();
    }

    function renderFloatingLine({ speaker, dialogue, replyIndex, replyTotal, weakPointId, weakRange }) {
        const overlay = ensureOverlay();
        const labelEl = overlay.querySelector('#dangan-nsd-round-label');
        const layer = overlay.querySelector('#dangan-nsd-floating-layer');
        if (!layer) return;

        if (labelEl) labelEl.textContent = `Round 1 · Replies: ${replyIndex}/${replyTotal}`;

        const words = splitWords(dialogue);
        const weakStart = weakRange?.start ?? -1;
        const weakEnd = weakRange?.end ?? -1;

        const phrase = document.createElement('div');
        phrase.className = 'dangan-nsd-floating-line';

        const speakerEl = document.createElement('span');
        speakerEl.className = 'dangan-nsd-floating-speaker';
        speakerEl.textContent = `${String(speaker || 'UNKNOWN').toUpperCase()}:`;
        phrase.appendChild(speakerEl);

        const quoteEl = document.createElement('span');
        quoteEl.className = 'dangan-nsd-floating-quote';
        quoteEl.append(' "');

        words.forEach((word, idx) => {
            if (idx > 0) quoteEl.append(' ');
            if (idx >= weakStart && idx <= weakEnd) {
                const weak = document.createElement('span');
                weak.className = 'dangan-nsd-weak-point';
                weak.textContent = word;
                weak.dataset.weakPointId = String(weakPointId);
                quoteEl.appendChild(weak);
                return;
            }
            quoteEl.append(word);
        });

        quoteEl.append('"');
        phrase.appendChild(quoteEl);

        const driftX = Math.floor(Math.random() * 100) - 50;
        phrase.style.setProperty('--nsd-drift-x', `${driftX}px`);
        phrase.style.setProperty('--nsd-order', String(replyIndex));
        layer.appendChild(phrase);

        const lines = Array.from(layer.querySelectorAll('.dangan-nsd-floating-line'));
        if (lines.length > 7) {
            lines.slice(0, lines.length - 7).forEach(el => el.remove());
        }
    }

    function hideOverlay() {
        const overlay = ensureOverlay();
        overlay.classList.remove('active', 'phase-cutscene', 'phase-active');
        overlay.setAttribute('aria-hidden', 'true');
        clearTimers();
        clearFloating();
        activeWeakPointIds.clear();
        roundToken += 1;
        lastObservedPhase = null;

        document.body.classList.remove('dangan-trial-nsd-active');
        if (!restoredVnAfterNsd && vnModeController) {
            vnModeController.setEnabled?.(true);
        }
        restoredVnAfterNsd = false;
    }

    function startActiveSection(token) {
        if (token !== roundToken) return;
        const state = trialController?.getState?.();
        if (state?.phase !== trialController?.phases?.NONSTOP_ACTIVE) return;

        const overlay = ensureOverlay();
        overlay.classList.add('active', 'phase-active');
        overlay.classList.remove('phase-cutscene');
        overlay.setAttribute('aria-hidden', 'false');

        document.body.classList.add('dangan-trial-nsd-active');
        if (vnModeController) {
            vnModeController.setEnabled?.(true);
            restoredVnAfterNsd = true;
        }

        clearFloating();
        activeWeakPointIds.clear();

        const replyTotal = Math.floor(Math.random() * 6) + 3;
        let replyIndex = 0;
        let stopped = false;

        const runNext = async () => {
            if (stopped || token !== roundToken) return;
            if (trialController?.getState?.()?.phase !== trialController?.phases?.NONSTOP_ACTIVE) return;

            const rawReply = await generateDebateReply().catch(() => '');

            if (stopped || token !== roundToken) return;

            const speaker = extractField(rawReply, 'speaker') || 'UNKNOWN';
            const quotes = extractQuotedSegments(rawReply);
            const dialogue = quotes[0] || '...';

            replyIndex += 1;
            weakPointCounter += 1;
            const weakRange = chooseWeakPointRange(dialogue);
            const weakPointId = `weak_${token}_${weakPointCounter}`;
            activeWeakPointIds.add(weakPointId);

            renderFloatingLine({
                speaker,
                dialogue,
                replyIndex,
                replyTotal,
                weakPointId,
                weakRange,
            });

            if (replyIndex >= replyTotal) {
                phaseTimer = window.setTimeout(() => {
                    if (token !== roundToken) return;
                    runSectionLoop(token);
                }, 1100);
                return;
            }

            phaseTimer = window.setTimeout(() => {
                runNext();
            }, 950);
        };

        runNext();

        window.fireTruthBulletAtWeakPoint = (shotWeakPointId) => {
            if (token !== roundToken) return { hit: false, reason: 'stale' };
            if (!shotWeakPointId) return { hit: false, reason: 'invalid' };
            if (!activeWeakPointIds.has(shotWeakPointId)) return { hit: false, reason: 'miss' };
            stopped = true;
            clearTimers();
            trialController?.transitionTo?.(trialController.phases.DISCUSSION_POST_DEBATE, 'nsd_hit');
            sync();
            return { hit: true, weakPointId: shotWeakPointId };
        };
    }

    function runSectionLoop(token) {
        if (token !== roundToken) return;
        const phase = trialController?.getState?.()?.phase;
        if (phase !== trialController?.phases?.NONSTOP_ACTIVE) return;
        startActiveSection(token);
    }

    function beginCutscene() {
        const state = trialController?.getState?.();
        if (state?.phase !== trialController?.phases?.NONSTOP_INTRO_CUTSCENE) return;

        const overlay = ensureOverlay();
        overlay.classList.add('active', 'phase-cutscene');
        overlay.classList.remove('phase-active');
        overlay.setAttribute('aria-hidden', 'false');

        clearTimers();
        const token = ++roundToken;
        introTimer = window.setTimeout(() => {
            const stillCutscene = trialController?.getState?.()?.phase === trialController?.phases?.NONSTOP_INTRO_CUTSCENE;
            if (!stillCutscene || token !== roundToken) return;
            trialController?.transitionTo?.(trialController.phases.NONSTOP_ACTIVE, 'nsd_cutscene_complete');
            sync();
        }, 2100);
    }

    function sync() {
        const phase = trialController?.getState?.()?.phase;

        if (phase === trialController?.phases?.NONSTOP_INTRO_CUTSCENE) {
            if (lastObservedPhase !== phase) {
                lastObservedPhase = phase;
                beginCutscene();
            }
            return;
        }

        if (phase === trialController?.phases?.NONSTOP_ACTIVE) {
            if (lastObservedPhase !== phase) {
                lastObservedPhase = phase;
                const token = ++roundToken;
                startActiveSection(token);
            }
            return;
        }

        hideOverlay();
    }

    window.fireTruthBulletAtPhrase = () => ({ hit: false, reason: 'use_weak_point' });

    return {
        sync,
    };
}


function createTrialIntroUiController() {
    let isVisible = false;
    let lastPhase = null;
    let pollId = null;

    function applyViewportSafeLayout(overlay) {
        if (!overlay) return;

        const shell = overlay.querySelector('.dangan-trial-intro-shell');
        const visualViewport = window.visualViewport;
        const viewportHeight = Math.max(320, Math.round(visualViewport?.height || window.innerHeight || 0));
        const viewportWidth = Math.max(280, window.innerWidth || 0);
        const viewportOffsetTop = Math.max(0, Math.round(visualViewport?.offsetTop || 0));
        const isMobile = viewportWidth <= 700;

        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.zIndex = '2147483647';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = isMobile ? 'flex-end' : 'center';
        overlay.style.boxSizing = 'border-box';

        if (!shell) return;

        shell.style.boxSizing = 'border-box';
        shell.style.overflow = 'auto';

        if (isMobile) {
            const topPadding = Math.max(10, viewportOffsetTop + 10);
            const sidePadding = 8;
            const bottomPadding = 10;

            overlay.style.padding = `${topPadding}px ${sidePadding}px ${bottomPadding}px`;

            const maxHeight = Math.max(220, viewportHeight - topPadding - bottomPadding);
            shell.style.width = `${Math.max(280, Math.min(540, viewportWidth - 16))}px`;
            shell.style.minHeight = '0';
            shell.style.maxHeight = `${maxHeight}px`;
            shell.style.height = 'auto';
            shell.style.margin = '0 auto';
            shell.style.borderRadius = '12px';
        } else {
            overlay.style.padding = '';
            shell.style.minHeight = '';
            shell.style.maxHeight = `${Math.max(220, viewportHeight - 16)}px`;
            shell.style.height = '';
            shell.style.width = '';
            shell.style.margin = '';
            shell.style.borderRadius = '';
        }
    }

    function setVisible(nextVisible) {
        const overlay = ensureTrialIntroOverlay();
        overlay.classList.toggle("active", nextVisible);
        overlay.setAttribute("aria-hidden", nextVisible ? "false" : "true");
        overlay.style.display = nextVisible ? 'flex' : 'none';
        overlay.style.pointerEvents = nextVisible ? 'auto' : 'none';

        const vnModeOn = !!getMonopadSetting("vnModeEnabled");
        document.body.classList.toggle("dangan-trial-vn-chat-hidden", nextVisible && vnModeOn);

        if (nextVisible) {
            applyViewportSafeLayout(overlay);
        }

        if (nextVisible && !isVisible) {
            trialIntroOstController?.play?.();
        } else if (!nextVisible && isVisible) {
            trialIntroOstController?.stop?.();
        }

        isVisible = nextVisible;
    }

    function sync() {
        if (!trialController) {
            setVisible(false);
            lastPhase = null;
            return;
        }

        const trialState = trialController.getState?.();
        const phase = trialState?.phase || null;
        lastPhase = phase;
        const isTrialIntro = phase === trialController.phases?.TRIAL_INTRO;
        const overlay = ensureTrialIntroOverlay();
        const summaryEl = overlay.querySelector("#dangan-trial-case-summary-text");
        if (summaryEl) {
            summaryEl.textContent = String(trialState?.session?.caseSummary || "Case summary pending.");
        }

        setVisible(isTrialIntro);
    }

    function startAutoSync() {
        if (pollId) return;

        const tick = () => {
            if (!trialController) {
                if (lastPhase !== null) sync();
                return;
            }
            const phase = trialController.getState?.()?.phase || null;
            if (phase !== lastPhase) {
                sync();
                return;
            }

            if (isVisible) {
                applyViewportSafeLayout(document.getElementById('dangan-trial-intro-overlay'));
            }
        };

        pollId = window.setInterval(tick, 250);
        document.addEventListener("visibilitychange", tick);
        window.addEventListener('resize', tick);
        window.addEventListener('orientationchange', tick);
    }

    return {
        sync,
        startAutoSync,
    };
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
    saveCharacters();

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
    if (!extension_settings[extensionName]?.monopadSounds) return;
    sound.currentTime = 0;
    sound.volume = 0.5;
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
        if (canonical.includes("V3C|TRIALSTART")) return false;
        if (canonical.includes("V3C|DAYANNOUN")) return false;
        if (canonical.includes("V3C|NIGHTANNOUN")) return false;
        if (canonical.includes("V3C|BDA")) return false;
        if (canonical.includes("V3C|BODYDISCOVERY")) return false;
        return true;
    });

    return kept.join("\n")
        .replace(/V3C\s*[|｜]\s*TB:\s*([^|\n\r]+)(?:\|\|\s*([^\n\r]+))?/gi, "")
        .replace(/V3C\s*[|｜]\s*SOCIAL:\s*([^\n\r]+)/gi, "")
        .replace(/V3C\s*[|｜]\s*SOCIAL_UP:\s*([^\n\r]+)/gi, "")
        .replace(/V3C\s*[|｜]\s*SOCIAL_DOWN:\s*([^\n\r]+)/gi, "")
        .replace(/V3C\s*[|｜]\s*INVESTIGATION(?:\s*[_\-]?\s*)START\b/gi, "")
        .replace(TRIAL_START_REGEX, "")
        .replace(TRIAL_DISCUSSION_START_PARSE_REGEX, "")
        .replace(TRIAL_DISCUSSION_END_PARSE_REGEX, "")
        .replace(/V3C\s*[|｜]\s*DAY(?:\s*[_\-]?\s*)ANNOUN\b/gi, "")
        .replace(/V3C\s*[|｜]\s*NIGHT(?:\s*[_\-]?\s*)ANNOUN\b/gi, "")
        .replace(/V3C\s*[|｜]\s*BDA\b/gi, "")
        .replace(/V3C\s*[|｜]\s*BODY(?:\s*[_\-]?\s*)DISCOVERY\b/gi, "")
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
    let socialHistoryMutated = false;

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
        trialDiscussionController?.ingestMessage?.({
            messageSignature,
            rawText,
            speaker: speakerName,
        });
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
    socialHistoryMutated = true;
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
    socialHistoryMutated = true;
    decreaseTrust(char);
}

        if (socialHistoryMutated) {
            saveCharacters();
            socialHistoryMutated = false;
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


        // ---- Trial Start ----
        const trialStartMarkers = parseTrialStartMarkers(rawText);
        trialStartMarkers.forEach((marker, idx) => {
            console.debug("[Dangan][Trial] Start marker detected", marker);
            const signature = `TRIAL_START||${messageSignature}||${marker.index}||${idx}`;
            const persistentSignature = buildTrialStartPersistentSignature(msgEl, marker, idx, rawText);
            if (hasProcessedTrialStartSignature(signature, persistentSignature)) return;

            markTrialStartSignatureProcessed(signature, persistentSignature);
            void triggerTrialStartFromMarker(String(marker?.marker || "V3C| TRIAL_START"));
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
            const persistentSignature = buildMonokumaAnnouncementPersistentSignature(msgEl, marker, idx, rawText);
            if (hasProcessedMonokumaAnnouncementSignature(signature, persistentSignature)) return;

            markMonokumaAnnouncementSignatureProcessed(signature, persistentSignature);
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
        handleTruthBullet("Important Thing!", "Will this show us whodunnit?", { grantMonocoins: false, grantXp: false });
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
    vnModeController?.setEnabled?.(!!tab.vnModeEnabled);
    trialIntroUiController?.sync?.();
    trialDiscussionController?.sync?.();
    nonstopDebateController?.sync?.();
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
                <button id="trial-debug-phase-idle" type="button">TRIAL PHASE: IDLE</button>
                <button id="trial-debug-phase-pre" type="button">TRIAL PHASE: PRE-DEBATE</button>
                <button id="trial-debug-phase-nonstop" type="button">TRIAL PHASE: NONSTOP DEBATE</button>
                <button id="trial-debug-phase-post" type="button">TRIAL PHASE: POST-DEBATE</button>
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
                        <span>DAY_ANNOUN</span>
                    </label>
                    <label class="truth-debug-choice">
                        <input type="radio" name="announcement-debug-type" value="NIGHT_ANNOUN" />
                        <span>NIGHT_ANNOUN</span>
                    </label>
                    <label class="truth-debug-choice">
                        <input type="radio" name="announcement-debug-type" value="BDA" />
                        <span>BDA</span>
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

function closeTruthDebugModal() {
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

        handleTruthBullet(title, description);
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

    const setTrialDebugPhase = (phase) => {
        if (!trialController || !phase) return;

        const result = trialController.debugSetPhase?.(phase, { source: "debug_controls" });
        if (!result?.ok) {
            console.warn(`[Dangan][Trial][Debug] Could not switch phase to ${phase}: ${result?.reason || "unknown error"}`);
            return;
        }

        trialIntroUiController?.sync?.();
        trialDiscussionController?.sync?.();
        nonstopDebateController?.sync?.();
        syncTrialForcedVnMode();
    };

    $(document).on("click.debugControls", "#trial-debug-phase-idle", () => {
        playDebugClickSfx();
        setTrialDebugPhase(trialController?.phases?.IDLE);
    });

    $(document).on("click.debugControls", "#trial-debug-phase-pre", () => {
        playDebugClickSfx();
        setTrialDebugPhase(trialController?.phases?.DISCUSSION_PRE_DEBATE);
    });

    $(document).on("click.debugControls", "#trial-debug-phase-nonstop", () => {
        playDebugClickSfx();
        setTrialDebugPhase(trialController?.phases?.NONSTOP_ACTIVE);
    });

    $(document).on("click.debugControls", "#trial-debug-phase-post", () => {
        playDebugClickSfx();
        setTrialDebugPhase(trialController?.phases?.DISCUSSION_POST_DEBATE);
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
            shouldPlayAudio: () => Boolean(extension_settings[extensionName]?.monopadSounds),
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
            playSfx(sfx.hover);
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
                playSfx(sfx.open);
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

        $(document).on("mouseenter", ".items-filter-button, .items-slot, .items-sort-group label, .items-detail-action", function () {
            playHoverWithCooldown();
        });

        $("#dangan_monokuma_lesson_button").on("click", async () => {
            playSfx(sfx.click);
            await startMonokumaLesson();
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
            mapPanelController?.handleSettingsChanged?.();
        });

        $("#dangan_crt_slider").on("input", e => {
            const value = Number(e.target.value);
            setMonopadSetting("crtIntensity", Number.isFinite(value) ? value : 35);
            applyCrtSettings();
        });

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

loadSettings();
const initialRewardDifficulty = applyRewardDifficultyProfile(getMonopadSetting("rewardDifficulty") || defaultSettings.rewardDifficulty);
if (initialRewardDifficulty !== getMonopadSetting("rewardDifficulty")) {
    setMonopadSetting("rewardDifficulty", initialRewardDifficulty);
}
ensureGlobalDebugUi();
trialController = createTrialController({
    extensionName,
    extension_settings,
    saveSettingsDebounced,
    buildCaseSummary: buildTrialCaseSummary,
    getEquippedSkills: getEquippedSkillsSnapshot,
    getTruthBullets: getTruthBulletsSnapshot,
    openConfirmDialog: openMonopadConfirmDialog,
});
trialIntroOstController = createTrialIntroOstController();
trialIntroUiController = createTrialIntroUiController();
trialDiscussionController = createTrialDiscussionController();
nonstopDebateController = createNonstopDebateController();
trialIntroUiController?.startAutoSync?.();
trialDiscussionController?.startAutoSync?.();
trialIntroUiController?.sync?.();
trialDiscussionController?.sync?.();
nonstopDebateController?.sync?.();
syncTrialForcedVnMode();
window.danganTrial = trialController;
window.startClassTrial = () => {
    const result = trialController?.requestStartFromUi?.({ source: "manual" });
    trialIntroUiController?.sync?.();
    trialDiscussionController?.sync?.();
    nonstopDebateController?.sync?.();
    syncTrialForcedVnMode();
    return result;
};
window.cancelClassTrial = () => {
    const result = trialController?.cancelTrial?.();
    trialIntroUiController?.sync?.();
    trialDiscussionController?.sync?.();
    nonstopDebateController?.sync?.();
    syncTrialForcedVnMode();
    return result;
};
rewards?.renderProgressionUi?.();
itemsPanelController.loadInventoryState();
applySettingsTabUI();
applyMonopadLaunchControlState(monopadButtonEl, $panel.get(0));
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
    getSetting: getMonopadSetting
});

    } catch (error) {
        bootstrapDebugUi();
        console.error(`[${extensionName}] ❌ Load failed:`, error);
    }
});
