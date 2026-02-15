import { extension_settings } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";
import { initTruthBullets, handleTruthBullet } from "./truth/truthBullets.js";
import { buildDecagram, crackShard, shatterShard } from "./trust/trustDecagram.js";
import { initTrustAnimations, playTrustRankUp, playTrustRankDown, playTrustMaxed, playTrustToDistrustTransition, playDistrustRankDown, playDistrustRankUp, playDistrustToTrustRecovery } from "./trust/trustAnimations.js";
import { increaseTrust, decreaseTrust } from "./trust/trustAPI.js";
import { createItemsPanelController } from "./items/itemsPanel.js";
import { createSocialPanelController } from "./social/socialPanel.js";


const extensionName = "danganronpa-extension";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

const defaultSettings = {
    monopadSounds: true,
    trustCeremonies: true,
    truthBulletAnimations: true,
    crtEffects: true,
    crtIntensity: 35,
    bootAnimations: true
};

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

const truthBullets = [];

const truthBulletQueue = [];
let truthBulletAnimating = false;

/* =========================
   TRUTH BULLET FUNCTIONS
   ========================= */

const processedTruthSignatures = new Set();
const processedSocialSignatures = new Set();

const SOCIAL_REGEX = /V3C\|\s*SOCIAL:\s*([^\n\r]+)/g;

const SOCIAL_DOWN_REGEX = /V3C\|\s*SOCIAL_DOWN:\s*([^\n\r]+)/g;

/* =========================
   SOCIAL / CHARACTER DATA
   ========================= */

const characters = new Map(); 
// key: normalized name → value: character object

function getActiveSocialCharacter() {
    if (!activeSocialCharacterId) return null;

    for (const char of characters.values()) {
        if (char.id === activeSocialCharacterId) {
            return char;
        }
    }

    return null;
}

async function generateIsolated(prompt) {
    if (!window.SillyTavern?.getContext) {
        throw new Error("SillyTavern context unavailable");
    }

    const ctx = SillyTavern.getContext();
    if (!ctx.generateRaw) {
        throw new Error("generateRaw not available");
    }

    const fullPrompt = `
You are an analysis engine.
You do NOT roleplay.
You do NOT write dialogue.
You ONLY output structured analytical reports.

${prompt}
`.trim();

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
for (const match of rawText.matchAll(SOCIAL_REGEX)) {
    const name = match[1]?.trim();
    if (!name) continue;

    const key = normalizeName(name);
    const char = characters.get(key);
    if (!char) continue;

    const signature = `UP||${key}||${rawText}`;

    // 🛑 Already used this message
    if (char.trustHistory.has(signature)) continue;

    char.trustHistory.add(signature);
    increaseTrust(char);
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

        // ---- Marker Cleanup ----
       if (rawText.includes("V3C|")) {
    const walker = document.createTreeWalker(
        msgText,
        NodeFilter.SHOW_TEXT,
        null
    );

    let textNode;
    while ((textNode = walker.nextNode())) {
        if (textNode.nodeValue.includes("V3C|")) {
            textNode.nodeValue = textNode.nodeValue
                .replace(TB_REGEX, "")
                .replace(SOCIAL_REGEX, "")
                .replace(SOCIAL_DOWN_REGEX, "")
                .trimStart();
        }
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

    console.log(`[${extensionName}] [Dangan] V3C marker observer active (swipe-safe)`);
}

function normalizeList(text, max = 5) {
    if (!text || text === "unknown") return text;

    const items = text
        .split(",")
        .map(i => i.trim())
        .filter(Boolean);

    return [...new Set(items)].slice(0, max).join(", ");
}

function extractUltimateFromNotes(notes) {
    if (!notes) return null;

    const match = notes.match(/^ultimate:\s*(.+)$/im);
    if (!match) return null;

    const value = match[1].trim();
    return value !== "unknown" ? value : null;
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

function collectCharactersFromChat() {
    const profiles = [];

    for (const char of characters.values()) {
        if (!char?.name) continue;

        profiles.push({
            id: char.id,
            name: char.name,
            ultimate: char.ultimate,
            trustLevel: char.trustLevel,
            source: char.source,
        });
    }

    return profiles;
}

function normalizeName(name) {
    return name
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}

function isIgnoredCharacter(name) {
    if (!name) return true;

    const n = normalizeName(name);

    return (
        n === "assistant" ||
        n === "system" ||
        n === "narrator" ||
        n === "usami" ||
        n.includes("api") ||
        n.includes("helper") ||
        n.includes("assistant") ||
        n.includes("mono") ||
        n.includes("tool")
    );
}

function lookupUltimateFromLorebook(characterName) {
    const entries = window.world_info?.entries;
    if (!Array.isArray(entries)) return null;

    const normalized = normalizeName(characterName);

    for (const entry of entries) {
        if (!entry?.content) continue;

        const text = entry.content.toLowerCase();

        if (text.includes(normalized)) {
            const match = entry.content.match(/ultimate\s*[:\-]\s*(.+)/i);
            if (match) {
                return match[1].trim();
            }
        }
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

function loadSettings() {
    extension_settings[extensionName] ||= {};
    extension_settings[extensionName] = {
        ...defaultSettings,
        ...extension_settings[extensionName]
    };

}

function getMonopadSetting(key) {
    return extension_settings[extensionName]?.[key];
}

function setMonopadSetting(key, value) {
    extension_settings[extensionName][key] = value;
    saveSettingsDebounced();
}

function applyCrtSettings() {
    const panel = document.getElementById("dangan_monopad_panel");
    if (!panel) return;

    const enabled = !!getMonopadSetting("crtEffects");
    const intensityRaw = Number(getMonopadSetting("crtIntensity"));
    const intensity = Number.isFinite(intensityRaw) ? Math.max(0, Math.min(100, intensityRaw)) : 35;

    panel.classList.toggle("crt-disabled", !enabled);
    panel.style.setProperty("--dangan-crt-opacity", (intensity / 100).toFixed(2));

    $("#dangan_crt_value").text(`${intensity}%`);
}

function applySettingsTabUI() {
    const tab = extension_settings[extensionName];

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

    applyCrtSettings();
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
        bottom: calc(74px + env(safe-area-inset-bottom, 0px)) !important;
        flex-direction: row !important;
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
    controls.style.setProperty("right", "10px", "important");
    controls.style.setProperty("left", "auto", "important");
    controls.style.setProperty("top", "auto", "important");
    controls.style.setProperty("bottom", isMobile ? "calc(env(safe-area-inset-bottom, 0px) + 74px)" : "14px", "important");
    controls.style.setProperty("flex-direction", isMobile ? "row" : "column", "important");
    controls.style.setProperty("gap", isMobile ? "8px" : "6px", "important");
    controls.style.setProperty("align-items", "stretch", "important");

    controls.querySelectorAll("button").forEach(button => {
        button.style.setProperty("display", "inline-flex", "important");
        button.style.setProperty("align-items", "center", "important");
        button.style.setProperty("justify-content", "center", "important");
        button.style.setProperty("background", "#111", "important");
        button.style.setProperty("color", "#fff", "important");
        button.style.setProperty("border", "1px solid #444", "important");
        button.style.setProperty("border-radius", "6px", "important");
        button.style.setProperty("padding", isMobile ? "7px 10px" : "6px 10px", "important");
        button.style.setProperty("min-height", isMobile ? "38px" : "32px", "important");
        button.style.setProperty("min-width", isMobile ? "88px" : "120px", "important");
        button.style.setProperty("font-size", isMobile ? "11px" : "12px", "important");
        button.style.setProperty("cursor", "pointer", "important");
        button.style.setProperty("letter-spacing", "0.06em", "important");
        button.style.setProperty("visibility", "visible", "important");
    });
}

function ensureGlobalDebugUi() {
    const legacyHud = document.getElementById("dangan-debug-hud-host");
    if (legacyHud) legacyHud.remove();

    let controls = document.getElementById("trust-debug-controls");

    if (!controls) {
        controls = document.createElement("div");
        controls.id = "trust-debug-controls";
        controls.innerHTML = `
            <button id="trust-debug-up" type="button">TRUST +</button>
            <button id="trust-debug-down" type="button">TRUST -</button>
            <button id="truth-debug-open" type="button">NEW TRUTH BULLET</button>
        `;
    }

    if (controls.parentElement !== document.body) {
        document.body.appendChild(controls);
    }

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

                <div class="truth-debug-actions">
                    <button id="truth-debug-cancel" class="truth-debug-btn ghost" type="button">CANCEL</button>
                    <button id="truth-debug-acquire" class="truth-debug-btn" type="button">ACQUIRE</button>
                </div>
            </div>
        `;
    }

    if (modal.parentElement !== document.body) {
        document.body.appendChild(modal);
    }

    applyDebugControlsInlineLayout(controls);
}

// =========================
// TRUST DEBUG CONTROLS
// =========================

function closeTruthDebugModal() {
    $("#truth-debug-modal").addClass("hidden").attr("aria-hidden", "true");
}

function playDebugClickSfx() {
    if (sfx?.click) playSfx(sfx.click);
}

function bindDebugControlEvents() {
    $(document).off("click.debugControls");
    $(document).off("click.debugModal");

    $(document).on("click.debugControls", "#truth-debug-open", () => {
        playDebugClickSfx();
        ensureGlobalDebugUi();
        $("#truth-debug-modal").removeClass("hidden").attr("aria-hidden", "false");
        $("#truth-debug-name").trigger("focus");
    });

    $(document).on("click.debugControls", "#truth-debug-cancel", () => {
        playDebugClickSfx();
        closeTruthDebugModal();
    });

    $(document).on("click.debugModal", "#truth-debug-modal", e => {
        if (e.target.id === "truth-debug-modal") {
            closeTruthDebugModal();
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

        increaseTrust(char);
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
}

jQuery(async () => {
    console.log(`[${extensionName}] Loading...`);

    bootstrapDebugUi();
    bindDebugControlEvents();

    try {
        const settingsHtml = await $.get(`${extensionFolderPath}/example.html`);
        $("#extensions_settings2").append(settingsHtml);

        const monopadHtml = await $.get(`${extensionFolderPath}/monopad.html`);
        $("body").append(monopadHtml);
        ensureGlobalDebugUi();

        // SillyTavern may re-mount portions of the DOM after extension load.
        // Re-assert the debug UI a few times to keep controls on the main screen.
        let debugUiRetries = 0;
        const debugUiRetryTimer = setInterval(() => {
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
        
    sfx = {
        open: document.getElementById("monopad_sfx_open"),
        close: document.getElementById("monopad_sfx_close"),
        click: document.getElementById("monopad_sfx_click"),
        hover: document.getElementById("monopad_sfx_hover"),
        monokuma: document.getElementById("monopad_sfx_monokuma"),
        monokumasad: document.getElementById("sfx_monokuma_sad"),
        bullet_get: document.getElementById("bullet_sfx_get"),
        bullet_get_alt: document.getElementById("bullet_sfx_get_alt"),
        trust_up: document.getElementById("trust_sfx_up"),
        trust_down: document.getElementById("trust_sfx_down"),
        trust_max: document.getElementById("trust_sfx_max"),
        trust_shatter: document.getElementById("trust_sfx_shatter"),
        distrust_recover: document.getElementById("distrust_sfx_recover"),
    }

        initTrustAnimations({
    sfx,
    unlockAudio,
    playSfx,
    getSetting: getMonopadSetting
});

        const itemsPanel = createItemsPanelController({
            extensionName,
            extension_settings,
            saveSettingsDebounced,
            playSfx,
            getSfx: () => sfx,
        });
        itemsPanel.bindWindowApi();

        socialPanelController = createSocialPanelController({
            characters,
            saveCharacters,
            increaseTrust,
            decreaseTrust,
            lookupUltimateFromLorebook,
            generateCharacterNotes,
            getActiveSocialCharacterId: () => activeSocialCharacterId,
            setActiveSocialCharacterId: value => {
                activeSocialCharacterId = value;
            },
        });

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

        function triggerMonokuma() {
            if (monokumaCooldown) return;
            monokumaCooldown = true;

            const $mono = $("#monokuma-popup");
            playSfx(sfx.monokuma);
            $mono.addClass("show");

            setTimeout(() => $mono.removeClass("show"), 1800);
            setTimeout(() => (monokumaCooldown = false), 6000);
        }

        $("#dangan_monopad_close").on("click", () => {
            $panel.removeClass("open booting");

            if (getMonopadSetting("bootAnimations")) {
                $panel.addClass("shutting-down");
                playSfx(sfx.close);

                setTimeout(() => {
                    $panel.removeClass("shutting-down").addClass("closed");
                }, 350);
            } else {
                playSfx(sfx.close);
                $panel.addClass("closed");
            }
        });

$(".monopad-icon").on("click", function () {
    playSfx(sfx.click);

    const tab = $(this).data("tab");

    $(".monopad-icon").removeClass("active");
    $(this).addClass("active");

    $(".monopad-panel-content").removeClass("active");
    $(`.monopad-panel-content[data-panel="${tab}"]`).addClass("active");

if (tab === "truth" && window.renderTruthBullets) {
    window.renderTruthBullets();
}

    if (tab === "social") {
        socialPanelController?.renderSocialPanel();
    }

    if (tab === "skills") {
        itemsPanel.renderSkillsItemsPanel();
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
            $panel.removeClass("open closed booting");

            if (!isOpen) {
                if (getMonopadSetting("bootAnimations")) {
                    $panel.addClass("open booting");
                    setTimeout(() => $panel.removeClass("booting"), 450);
                } else {
                    $panel.addClass("open");
                }
                playSfx(sfx.open);
            } else {
                if (getMonopadSetting("bootAnimations")) {
                    $panel.addClass("shutting-down");
                    playSfx(sfx.close);
                    setTimeout(() => $panel.removeClass("shutting-down").addClass("closed"), 350);
                } else {
                    playSfx(sfx.close);
                    $panel.addClass("closed");
                }
            }

        }

        $button.on("click", () => {
            unlockAudio();
            togglePanel();

            monopadSpamCount++;
            clearTimeout(monopadSpamTimer);
            monopadSpamTimer = setTimeout(() => (monopadSpamCount = 0), 700);

            if (monopadSpamCount >= 6) {
                monopadSpamCount = 0;
                triggerMonokuma();
            }
        });


        $(".items-filter-button").on("click", function () {
            playSfx(sfx.click);
            itemsPanel.setFilter(this.dataset.filter || "all");
            itemsPanel.renderSkillsItemsPanel();
        });

        $('input[name="items-sort"]').on("change", function () {
            playSfx(sfx.click);
            itemsPanel.setSort(this.value || "recent");
            itemsPanel.renderSkillsItemsPanel();
        });

        $(document).on("mouseenter", ".items-filter-button, .items-slot, .items-sort-group label, .items-detail-action", function () {
            playHoverWithCooldown();
        });

        $(".settings-toggle").on("click", function () {
            const key = this.dataset.setting;
            if (!key) return;

            const next = !getMonopadSetting(key);
            setMonopadSetting(key, next);
            applySettingsTabUI();
        });

        $("#dangan_crt_slider").on("input", e => {
            const value = Number(e.target.value);
            setMonopadSetting("crtIntensity", Number.isFinite(value) ? value : 35);
            applyCrtSettings();
        });

loadSettings();
itemsPanel.loadInventoryState();
applySettingsTabUI();
loadCharacters();
itemsPanel.renderSkillsItemsPanel();


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
    increaseTrust,
    decreaseTrust,
    startV3CObserver,
    playSfx,
    extension_settings,
    saveSettingsDebounced,
    extensionName,
    getSetting: getMonopadSetting
});

    } catch (error) {
        bootstrapDebugUi();
        console.error(`[${extensionName}] ❌ Load failed:`, error);
    }
});
