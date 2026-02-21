let extension_settings;
let extensionName;
let saveSettingsDebounced;
let characters;
let activeSocialCharacterId;
let itemsPanelController;
let socialPanelController;
let playSfx;
let rewards;
let decreaseTrust;
let increaseTrustWithRewards;
let normalizeName;
let isOpenRouterGenerationEnabled;
let generateWithOpenRouter;

export function configureGiftReactionDeps(deps = {}) {
  extension_settings = deps.extension_settings;
  extensionName = deps.extensionName;
  saveSettingsDebounced = deps.saveSettingsDebounced;
  characters = deps.characters;
  activeSocialCharacterId = deps.activeSocialCharacterId;
  itemsPanelController = deps.itemsPanelController;
  socialPanelController = deps.socialPanelController;
  playSfx = deps.playSfx;
  rewards = deps.rewards;
  decreaseTrust = deps.decreaseTrust;
  increaseTrustWithRewards = deps.increaseTrustWithRewards;
  normalizeName = deps.normalizeName;
  isOpenRouterGenerationEnabled = deps.isOpenRouterGenerationEnabled;
  generateWithOpenRouter = deps.generateWithOpenRouter;
}

export function updateGiftReactionRuntimeDeps(deps = {}) {
  if ('activeSocialCharacterId' in deps) activeSocialCharacterId = deps.activeSocialCharacterId;
  if ('itemsPanelController' in deps) itemsPanelController = deps.itemsPanelController;
  if ('socialPanelController' in deps) socialPanelController = deps.socialPanelController;
  if ('playSfx' in deps) playSfx = deps.playSfx;
  if ('rewards' in deps) rewards = deps.rewards;
  if ('normalizeName' in deps) normalizeName = deps.normalizeName;
  if ('isOpenRouterGenerationEnabled' in deps) isOpenRouterGenerationEnabled = deps.isOpenRouterGenerationEnabled;
  if ('generateWithOpenRouter' in deps) generateWithOpenRouter = deps.generateWithOpenRouter;
}

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

export { getGiftJudgementStore, getStoredGiftJudgement, saveGiftJudgement, setGiftJudgementCollapsed, getActiveSocialCharacter, queueGiftForNextReply, buildMessageSignature, normalizeGiftVerdict, applyGiftOutcome, injectGiftReactionBanner, injectPersistedGiftReactionForMessage };
