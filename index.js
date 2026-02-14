import { extension_settings } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";
import { initTruthBullets, handleTruthBullet } from "./truth/truthBullets.js";
import { buildDecagram, crackShard, shatterShard } from "./trust/trustDecagram.js";
import { initTrustAnimations, playTrustRankUp, playTrustRankDown, playTrustMaxed, playTrustToDistrustTransition, playDistrustRankDown, playDistrustRankUp, playDistrustToTrustRecovery } from "./trust/trustAnimations.js";
import { increaseTrust, decreaseTrust } from "./trust/trustAPI.js";



const extensionName = "danganronpa-extension";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

const defaultSettings = {
    enabled: false,
    fullscreen: false,
    monopadSounds: true,
    trustCeremonies: true,
    truthBulletAnimations: true,
    crtEffects: true,
    crtIntensity: 35,
    bootAnimations: true
};

window.refreshActiveCharacterUI = function () {
    if (!activeSocialCharacterId) return;

    for (const char of characters.values()) {
        if (char.id === activeSocialCharacterId) {
            openCharacterReport(char);
            renderSocialPanel();
            return;
        }
    }
};

let activeSocialCharacterId = null;

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
    renderSocialPanel();
}

function loadSettings() {
    extension_settings[extensionName] ||= {};
    extension_settings[extensionName] = {
        ...defaultSettings,
        ...extension_settings[extensionName]
    };

    $("#dangan_enable_checkbox").prop(
        "checked",
        extension_settings[extensionName].enabled
    );
    $("#dangan_fullscreen_checkbox").prop(
        "checked",
        extension_settings[extensionName].fullscreen
    );
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

function applyFullscreenMode() {
    const isFullscreen = extension_settings[extensionName].fullscreen;
    $("#dangan_monopad_panel").toggleClass("fullscreen", isFullscreen);
}


const itemCatalog = [
    { id: "g_rose_whip", name: "Rose Whip", category: "gift", rarity: "R", description: "A decorative whip popular in stage magic circles.", effect: "Boosts confidence-driven dialogue routes.", character: "Maki" },
    { id: "g_crystal_skull", name: "Crystal Skull", category: "gift", rarity: "SR", description: "A tiny crystal skull with unsettling detail work.", effect: "Increases reaction checks in tense scenes.", character: "Kokichi" },
    { id: "g_monokuma_pin", name: "Monokuma Pin", category: "gift", rarity: "N", description: "A cheaply made pin with suspiciously sharp edges.", effect: "Minor passive boost to social probing.", character: "Monokuma" },
    { id: "s_micro_focus", name: "Micro Focus", category: "skill", rarity: "R", description: "A mental discipline routine used before investigations.", effect: "Insight +1 during evidence review.", character: "Shuichi" },
    { id: "s_false_lead", name: "False Lead", category: "skill", rarity: "SR", description: "A deceptive social rhythm that redirects suspicion.", effect: "Reaction +1 during argument exchanges.", character: "Kokichi" },
    { id: "k_student_profile", name: "Student Profile Chip", category: "key", rarity: "KEY", description: "A protected archive containing restricted student metadata.", effect: "Unlocks dossier-only dialogue branches.", character: "Archive" }
];

let activeItemsFilter = "all";
let activeItemsSort = "recent";
let selectedItemId = null;

function loadInventoryState() {
    const ext = extension_settings[extensionName];
    ext.inventory ||= {};
    ext.inventory.monocoins ??= 0;
    ext.inventory.gifts ||= {};
    ext.inventory.skills ||= {};
    ext.inventory.keyItems ||= {};

    if (!Object.keys(ext.inventory.gifts).length && !Object.keys(ext.inventory.skills).length && !Object.keys(ext.inventory.keyItems).length) {
        ext.inventory.gifts.g_rose_whip = 1;
        ext.inventory.gifts.g_monokuma_pin = 2;
        ext.inventory.skills.s_micro_focus = 1;
        ext.inventory.keyItems.k_student_profile = 1;
    }
}

function getInventoryBucket(category) {
    if (category === "gift") return "gifts";
    if (category === "skill") return "skills";
    return "keyItems";
}

function getItemById(id) {
    return itemCatalog.find(i => i.id === id) || null;
}

function categoryOrder(category) {
    if (category === "gift") return 0;
    if (category === "skill") return 1;
    return 2;
}

function rarityScore(rarity) {
    return { KEY: 4, SR: 3, R: 2, N: 1 }[rarity] || 0;
}

function getOwnedItems() {
    const inv = extension_settings[extensionName].inventory || {};

    const items = itemCatalog
        .map((item, idx) => {
            const bucket = getInventoryBucket(item.category);
            const quantity = Number(inv[bucket]?.[item.id] || 0);
            return { ...item, quantity, catalogIndex: idx };
        })
        .filter(item => item.quantity > 0);

    if (activeItemsFilter !== "all") {
        return sortOwnedItems(items.filter(item => item.category === activeItemsFilter));
    }

    return sortOwnedItems(items);
}

function sortOwnedItems(items) {
    if (activeItemsSort === "rarity") {
        return [...items].sort((a, b) => rarityScore(b.rarity) - rarityScore(a.rarity) || a.name.localeCompare(b.name));
    }

    if (activeItemsSort === "category") {
        return [...items].sort((a, b) => categoryOrder(a.category) - categoryOrder(b.category) || a.name.localeCompare(b.name));
    }

    return [...items].sort((a, b) => b.catalogIndex - a.catalogIndex);
}

function formatCategoryLabel(category) {
    if (category === "gift") return "GIFT";
    if (category === "skill") return "SKILL";
    return "KEY ITEM";
}

function renderItemDetails(item) {
    const $detail = $("#items-detail-panel");
    if (!$detail.length) return;

    if (!item) {
        $detail.html(`
            <div class="items-panel-title">SELECTED ITEM</div>
            <div class="items-detail-placeholder">SELECT AN ITEM SLOT TO LOAD TERMINAL READOUT</div>
        `);
        return;
    }

    $detail.html(`
        <div class="items-panel-title">SELECTED ITEM</div>
        <div class="items-detail-icon">◉</div>
        <div class="items-detail-name">${item.name.toUpperCase()}</div>
        <div class="items-detail-category">CATEGORY: ${formatCategoryLabel(item.category)} · RARITY: ${item.rarity}</div>

        <div class="items-detail-section-label">DESCRIPTION</div>
        <div class="items-detail-description">${item.description}</div>

        <div class="items-detail-section-label">EFFECT</div>
        <div class="items-detail-effect">${item.effect}</div>

        <div class="items-detail-section-label">ASSOCIATED CHARACTER</div>
        <div class="items-detail-character">[ ${item.character} ]</div>

        <div class="items-detail-actions">
            <button class="items-detail-action" disabled>USE</button>
            <button class="items-detail-action" disabled>INSPECT</button>
        </div>
    `);
}

function renderInventoryGrid() {
    const $grid = $("#items-gift-list");
    if (!$grid.length) return;

    const items = getOwnedItems();
    $grid.empty();

    if (!items.length) {
        $grid.append('<div class="items-empty">NO ITEMS IN THIS FILTER</div>');
        renderItemDetails(null);
        return;
    }

    if (!selectedItemId || !items.some(i => i.id === selectedItemId)) {
        selectedItemId = items[0].id;
    }

    items.forEach(item => {
        const active = item.id === selectedItemId ? "active" : "";
        const $slot = $(`
            <button class="items-slot ${active}" data-item-id="${item.id}" data-item-category="${item.category}" title="${item.name}">
                <span class="items-slot-icon">■</span>
                <span class="items-slot-name">${item.name.toUpperCase()}</span>
                <span class="items-slot-qty">x${item.quantity}</span>
            </button>
        `);

        $slot.on("mouseenter", () => renderItemDetails(item));
        $slot.on("click", () => {
            selectedItemId = item.id;
            renderInventoryGrid();
        });

        $grid.append($slot);
    });

    renderItemDetails(items.find(i => i.id === selectedItemId) || items[0]);
}

function renderSkillsItemsPanel() {
    const $panel = $(`.monopad-panel-content[data-panel="skills"]`);
    if (!$panel.length) return;

    const monocoins = Number(extension_settings[extensionName].inventory?.monocoins || 0);
    $("#items-monocoin-value").text(monocoins.toLocaleString());

    $panel.find(".items-filter-button").each((_, el) => {
        const isActive = el.dataset.filter === activeItemsFilter;
        el.classList.toggle("active", isActive);
        el.setAttribute("aria-selected", String(isActive));
    });

    $panel.find('input[name="items-sort"]').each((_, el) => {
        el.checked = el.value === activeItemsSort;
    });

    renderInventoryGrid();
}

window.danganInventory = {
    addGift(itemId, amount = 1) {
        loadInventoryState();
        const item = getItemById(itemId);
        if (!item) return false;

        const bucket = getInventoryBucket(item.category);
        const qty = Number(extension_settings[extensionName].inventory[bucket][itemId] || 0);
        extension_settings[extensionName].inventory[bucket][itemId] = Math.max(0, qty + Number(amount || 0));
        saveSettingsDebounced();
        renderSkillsItemsPanel();
        return true;
    },
    setMonocoins(value = 0) {
        loadInventoryState();
        extension_settings[extensionName].inventory.monocoins = Math.max(0, Number(value || 0));
        saveSettingsDebounced();
        renderSkillsItemsPanel();
    }
};

function renderSocialPanel() {
    const $panel = $(`.monopad-panel-content[data-panel="social"]`);
    if (!$panel.length) return;

    const $listItems = $panel.find(".social-list-items");
    $listItems.empty();

    if (!characters.size) {
        $listItems.append(`<div class="social-empty">NO STUDENTS FOUND</div>`);
        return;
    }

for (const [key, char] of characters.entries()) {
    const $item = $(`
        <div class="social-list-item">
            <span class="social-name">${char.name.toUpperCase()}</span>
            <span class="social-delete" title="Remove">✕</span>
        </div>
    `);

// LEFT CLICK → OPEN REPORT + TRIPLE CLICK → TRUST UP
let clickCount = 0;
let clickTimer = null;

$item.find(".social-name").on("click", () => {
    clickCount++;

    if (clickCount === 1) {
        // Normal single click behavior
        openCharacterReport(char);

        clickTimer = setTimeout(() => {
            clickCount = 0;
        }, 450); // timing window for triple click
    }

    if (clickCount === 3) {
        clearTimeout(clickTimer);
        clickCount = 0;

        increaseTrust(char);
    }
});

// RIGHT CLICK → TRUST DOWN
$item.find(".social-name").on("contextmenu", e => {
    e.preventDefault();
    decreaseTrust(char);
});

    // Delete button
    $item.find(".social-delete").on("click", e => {
        e.stopPropagation();
        removeCharacter(key);
    });

    $listItems.append($item);
}

}

function removeCharacter(key) {
    if (!characters.has(key)) return;

    const name = characters.get(key)?.name;
    characters.delete(key);
    saveCharacters();

    console.log(`[Dangan][Social] Removed character: ${name}`);
    renderSocialPanel();
}

function openCharacterReport(char) {
    activeSocialCharacterId = char.id;
    const $report = $(".social-report");
    if (!$report.length) return;

        const svg = document.getElementById("trust-decagram");
    if (svg) {
        // 🔥 HARD RESET visual state
        delete svg.dataset.mode;
        delete svg.dataset.gold;

        if (char.trustLevel < 0) {
            svg.dataset.mode = "distrust";
        }

        if (char.trustLevel === 10) {
            svg.dataset.gold = "true";
        }
    }

    $report.find(".report-name").text(char.name || "—");
const liveUltimate =
    lookupUltimateFromLorebook(char.name) || char.ultimate || "unknown";

char.ultimate = liveUltimate;
saveCharacters();

$report.find(".report-ultimate").text(
    char.ultimate
        ? `ULTIMATE: ${char.ultimate.toUpperCase()}`
        : "ULTIMATE: —"
);
// Trust bar
const trust = char.trustLevel ?? 1;
const $segments = $report.find(".trust-segment");

$segments.removeClass("filled distrust");

if (trust > 0) {
    // TRUST: fill from left
    $segments.each((i, el) => {
        if (i < trust) el.classList.add("filled");
    });

    $report.find(".trust-value").text(`${trust} / 10`);
    $report.find(".trust-label")
        .text("TRUST LEVEL")
        .removeClass("distrust");

} else {
    // DISTRUST: fill from right
    const abs = Math.abs(trust);

    $segments.each((i, el) => {
        if (i >= 10 - abs) el.classList.add("distrust");
    });

    $report.find(".trust-value").text(`${abs} / 10`);
    $report.find(".trust-label")
        .text("DISTRUST LEVEL")
        .addClass("distrust");
}

    $report.find(".trust-value").text(`${trust} / 10`);

$report.find(".notes-content").text("ANALYZING...");

const openedId = char.id;

generateCharacterNotes(char).then(() => {
    // 🛑 Only update if this character is still selected
    if (activeSocialCharacterId !== openedId) return;

    const profile = char.social?.profile;

    if (!profile) {
        console.warn("[Dangan][Social] Profile missing after generation");
        return;
    }

    $("#stat-height").text(profile.height || "—");
    $("#stat-measurements").text(profile.measurements || "—");
    $("#stat-personality").text(profile.personality || "—");
    $("#stat-likes").text(profile.likes || "—");
    $("#stat-dislikes").text(profile.dislikes || "—");

    $report.find(".notes-content").text("ANALYSIS COMPLETE");
});

}

jQuery(async () => {
    console.log(`[${extensionName}] Loading...`);

    try {
        const settingsHtml = await $.get(`${extensionFolderPath}/example.html`);
        $("#extensions_settings2").append(settingsHtml);

        const monopadHtml = await $.get(`${extensionFolderPath}/monopad.html`);
        $("body").append(monopadHtml);

        setTimeout(() => {
    //registerCharactersFromContext();
    renderSocialPanel();
}, 300);

        const $button = $("#dangan_monopad_button");
        const $panel = $("#dangan_monopad_panel");
        
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


        let lastHoverTime = 0;
        const HOVER_COOLDOWN = 80;

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
                    $panel.removeClass("shutting-down fullscreen").addClass("closed");
                }, 350);
            } else {
                playSfx(sfx.close);
                $panel.removeClass("fullscreen").addClass("closed");
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
        renderSocialPanel();
    }

    if (tab === "skills") {
        renderSkillsItemsPanel();
    }
});

/*$(document).on("chatLoaded", () => {
    //console.log("[Dangan][Social] Chat loaded, registering characters");

    //waitForRealChat(() => {
        //registerCharactersFromContext();
        renderSocialPanel();
    });
});
*/

//*$(document).on("chatChanged", () => {
  //  console.log("[Dangan][Social] Chat changed, registering characters");

   // waitForRealChat(() => {
       // registerCharactersFromContext();
       // renderSocialPanel();
    //});
//});

$(".monopad-icon").on("mouseenter", function () {
    const now = Date.now();
    if (now - lastHoverTime < HOVER_COOLDOWN) return;
    lastHoverTime = now;
    playSfx(sfx.hover);
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

            applyFullscreenMode();
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
            activeItemsFilter = this.dataset.filter || "all";
            renderSkillsItemsPanel();
        });

        $('input[name="items-sort"]').on("change", function () {
            activeItemsSort = this.value || "recent";
            renderSkillsItemsPanel();
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

        $("#dangan_enable_checkbox").on("input", e => {
            extension_settings[extensionName].enabled = e.target.checked;
            saveSettingsDebounced();
        });

        $("#dangan_fullscreen_checkbox").on("input", e => {
            extension_settings[extensionName].fullscreen = e.target.checked;
            saveSettingsDebounced();
            applyFullscreenMode();
        });

loadSettings();
loadInventoryState();
applyFullscreenMode();
applySettingsTabUI();
loadCharacters();
renderSkillsItemsPanel();

// =========================
// TRUST DEBUG CONTROLS
// =========================

function getActiveSocialCharacter() {
    if (!activeSocialCharacterId) return null;

    for (const char of characters.values()) {
        if (char.id === activeSocialCharacterId) {
            return char;
        }
    }
    return null;
}

$("#trust-debug-up").on("click", () => {
    const char = getActiveSocialCharacter();
    if (!char) {
        console.warn("[Dangan][Debug] No active character");
        return;
    }
    increaseTrust(char);
});

$("#trust-debug-down").on("click", () => {
    const char = getActiveSocialCharacter();
    if (!char) {
        console.warn("[Dangan][Debug] No active character");
        return;
    }
    decreaseTrust(char);
});

// 🔴 FORCE REGISTER FROM EXISTING CHAT
//waitForRealChat(() => {
    //registerCharactersFromContext();
    //renderSocialPanel();
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
        console.error(`[${extensionName}] ❌ Load failed:`, error);
    }
});
