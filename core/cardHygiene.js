const OVERLAY_ID = "dangan-card-hygiene-overlay";
const META_KEY = "danganCardHygiene";
const DEFAULTS = Object.freeze(["ask", "keep", "clean"]);

function getContext() {
    return window.SillyTavern?.getContext?.() || null;
}

function asList(value) {
    if (Array.isArray(value)) return value.map(v => String(v || "").trim()).filter(Boolean);
    const text = String(value || "").trim();
    return text ? [text] : [];
}

function fieldText(char, key) {
    const top = char?.[key];
    const nested = char?.data?.[key];
    if (Array.isArray(top) || Array.isArray(nested)) {
        return [...asList(top), ...asList(nested)].join("\n");
    }
    return String(top || nested || "").trim();
}

function getChatIdentity(ctx) {
    if (!ctx) return "";
    const groupId = ctx.groupId ?? ctx.group_id ?? "";
    const characterId = ctx.characterId ?? ctx.character_id ?? "";
    const chatId = ctx.chatId ?? ctx.chat_id ?? ctx.chatFile ?? "";
    return `${groupId}|${characterId}|${chatId}`;
}

function getChatMetadata(ctx) {
    if (!ctx) return null;
    if (ctx.chatMetadata && typeof ctx.chatMetadata === "object") return ctx.chatMetadata;
    if (ctx.chat_metadata && typeof ctx.chat_metadata === "object") return ctx.chat_metadata;
    if (window.chat_metadata && typeof window.chat_metadata === "object") return window.chat_metadata;
    ctx.chatMetadata = {};
    return ctx.chatMetadata;
}

function readDecision(ctx) {
    const meta = getChatMetadata(ctx);
    const raw = meta?.[META_KEY]?.decision;
    return raw === "keep" || raw === "clean" ? raw : "";
}

function hasUserMessage(chat) {
    return Array.isArray(chat) && chat.some(m => m?.is_user);
}

function getLiveChats(ctx) {
    const lists = [];
    if (Array.isArray(window.chat)) lists.push(window.chat);
    if (Array.isArray(ctx?.chat) && ctx.chat !== window.chat) lists.push(ctx.chat);
    return lists;
}

// A message SillyTavern inserted as a card's greeting, as opposed to anything
// generated since. Replies always carry generation info and are never
// touched, even if their text repeats a greeting. A greeting's text can't
// always be matched (macros like {{user}} are filled in), so any message that
// was never generated counts.
export function isGreetingMessage(m) {
    if (!m || m.is_user || m.is_system) return false;
    if (m.extra?.type === "narrator") return false;
    return !(m.gen_started || m.gen_finished || m.extra?.api || m.extra?.model || m.extra?.gen_id);
}

// Removes the greetings before the first message the player sent. Returns
// how many were removed; `onRemove(index)` hears each one, last first.
export function stripLeadingGreetings(chat, onRemove = null) {
    if (!Array.isArray(chat) || !chat.length) return 0;
    const firstUser = chat.findIndex(m => m?.is_user);
    const end = firstUser === -1 ? chat.length : firstUser;
    let removed = 0;
    for (let i = end - 1; i >= 0; i--) {
        if (!isGreetingMessage(chat[i])) continue;
        chat.splice(i, 1);
        onRemove?.(i);
        removed++;
    }
    return removed;
}

function characterKey(char) {
    return String(char?.avatar || char?.name || "").trim();
}

export function createCardHygieneController({
    extensionName,
    getMonopadSetting,
    setMonopadSetting,
    isIgnoredCharacter,
} = {}) {
    const scenarioSnapshots = new Map();
    let promptInFlight = false;
    let dismissActivePrompt = null;
    let enforcingClean = false;

    function normalizeDefault(value) {
        const v = String(value || "ask").trim().toLowerCase();
        return DEFAULTS.includes(v) ? v : "ask";
    }

    function getParticipantCharacters(ctx) {
        const chars = Array.isArray(ctx?.characters) ? ctx.characters : [];
        const groupId = ctx?.groupId ?? ctx?.group_id ?? "";
        if (groupId !== "" && groupId !== null && groupId !== undefined) {
            const group = (Array.isArray(ctx.groups) ? ctx.groups : []).find(g => String(g.id) === String(groupId));
            const members = Array.isArray(group?.members) ? group.members : [];
            return members
                .map(avatar => chars.find(c => String(c?.avatar) === String(avatar)))
                .filter(Boolean);
        }
        const characterId = ctx?.characterId ?? ctx?.character_id;
        if (characterId !== "" && characterId !== null && characterId !== undefined && chars[characterId]) {
            return [chars[characterId]];
        }
        return [];
    }

    function inspectCharacter(char) {
        const name = String(char?.name || "").trim();
        if (!name || isIgnoredCharacter?.(name)) return null;
        const firstMes = fieldText(char, "first_mes");
        const greetings = [
            ...asList(char?.alternate_greetings),
            ...asList(char?.data?.alternate_greetings),
            ...asList(char?.group_only_greetings),
            ...asList(char?.data?.group_only_greetings),
        ];
        const scenario = fieldText(char, "scenario");
        const hasGreeting = Boolean(firstMes) || greetings.length > 0;
        const hasScenario = Boolean(scenario);
        if (!hasGreeting && !hasScenario) return null;
        return { char, name, hasGreeting, hasScenario };
    }

    function getFlaggedParticipants(ctx) {
        return getParticipantCharacters(ctx).map(inspectCharacter).filter(Boolean);
    }

    function restoreAllScenarios() {
        if (!scenarioSnapshots.size) return;
        const ctx = getContext();
        const chars = Array.isArray(ctx?.characters) ? ctx.characters : [];
        for (const [key, snap] of scenarioSnapshots) {
            const char = chars.find(c => characterKey(c) === key) || null;
            if (!char) continue;
            if (Object.prototype.hasOwnProperty.call(snap, "scenario")) char.scenario = snap.scenario;
            if (char.data && Object.prototype.hasOwnProperty.call(snap, "dataScenario")) {
                char.data.scenario = snap.dataScenario;
            }
        }
        scenarioSnapshots.clear();
    }

    function blankScenarios(chars) {
        for (const char of chars) {
            const key = characterKey(char);
            if (!key) continue;
            if (!scenarioSnapshots.has(key)) {
                scenarioSnapshots.set(key, {
                    scenario: char.scenario,
                    dataScenario: char.data?.scenario,
                });
            }
            char.scenario = "";
            if (char.data) char.data.scenario = "";
        }
    }

    async function persistDecision(ctx, decision) {
        const meta = getChatMetadata(ctx);
        if (!meta) return;
        meta[META_KEY] = { decision };
        if (decision === "clean") meta.tainted = true;
        if (window.chat_metadata && window.chat_metadata !== meta && typeof window.chat_metadata === "object") {
            window.chat_metadata[META_KEY] = { decision };
            if (decision === "clean") window.chat_metadata.tainted = true;
        }
        if (typeof ctx.saveMetadata === "function") {
            try { await ctx.saveMetadata(); } catch {}
        }
    }

    // Takes removed messages off the screen without re-rendering the chat:
    // drops their elements and shifts the ids of the ones after them.
    // `indexes` are in removal order (last first), as stripLeadingGreetings
    // reports them.
    function removeMessageElements(indexes) {
        const container = document.getElementById("chat");
        if (!container) return;
        for (const index of indexes) {
            for (const el of [...container.querySelectorAll(".mes[mesid]")]) {
                const id = Number(el.getAttribute("mesid"));
                if (id === index) el.remove();
                else if (id > index) el.setAttribute("mesid", String(id - 1));
            }
        }
    }

    function syncChatDom(chat) {
        const printer = getContext()?.printMessages || window.printMessages;
        if (typeof printer === "function") {
            try { printer(); return; } catch {}
        }
        const container = document.getElementById("chat");
        if (!container) return;
        const nodes = [...container.querySelectorAll(".mes")];
        if (!Array.isArray(chat) || !chat.length) {
            nodes.forEach(n => n.remove());
            return;
        }
        const extra = nodes.length - chat.length;
        if (extra > 0) nodes.slice(0, extra).forEach(n => n.remove());
        [...container.querySelectorAll(".mes")].forEach((n, i) => n.setAttribute("mesid", String(i)));
    }

    async function saveChatNoReload(ctx) {
        if (typeof ctx?.saveChat === "function") {
            try { await ctx.saveChat(); return; } catch {}
        }
        if (typeof window.saveChatConditional === "function") {
            try { await window.saveChatConditional(); } catch {}
        }
    }

    // `reprint: false` removes the greetings' message elements in place
    // instead of re-rendering the whole chat, for when a reply was just shown.
    async function enforceCleanGreetings(ctx = getContext(), { reprint = true } = {}) {
        if (enforcingClean) return 0;
        if (!ctx || readDecision(ctx) !== "clean") return 0;
        enforcingClean = true;
        try {
            let removed = 0;
            const removedIndexes = [];
            getLiveChats(ctx).forEach((chat, n) => {
                removed += stripLeadingGreetings(chat, n === 0 ? (i) => removedIndexes.push(i) : null);
            });
            if (!removed) return 0;
            console.log(`[${extensionName}] Card hygiene removed ${removed} greeting message(s).`);
            await saveChatNoReload(ctx);
            if (reprint) syncChatDom(getLiveChats(ctx)[0] || ctx.chat || []);
            else removeMessageElements(removedIndexes);
            return removed;
        } finally {
            enforcingClean = false;
        }
    }

    async function applyClean(ctx, flagged) {
        await persistDecision(ctx, "clean");
        blankScenarios((flagged || []).map(f => f.char));
        await enforceCleanGreetings(ctx);
        // 1:1 chats re-inject first_mes when the log is empty; strip again
        // after ST's delayed insert instead of calling reloadCurrentChat.
        for (const wait of [150, 400, 1000]) {
            await new Promise(r => setTimeout(r, wait));
            const live = getContext();
            if (readDecision(live) !== "clean") return;
            await enforceCleanGreetings(live);
        }
    }

    function closeOverlay() {
        document.getElementById(OVERLAY_ID)?.remove();
    }

    function showWarning(flagged) {
        closeOverlay();
        return new Promise(resolve => {
            const overlay = document.createElement("div");
            overlay.id = OVERLAY_ID;
            overlay.className = "dangan-card-hygiene-overlay";
            overlay.setAttribute("role", "dialog");
            overlay.setAttribute("aria-modal", "true");
            overlay.setAttribute("aria-labelledby", "dangan-card-hygiene-title");

            const shell = document.createElement("div");
            shell.className = "dangan-card-hygiene-shell";

            const title = document.createElement("div");
            title.id = "dangan-card-hygiene-title";
            title.className = "dangan-card-hygiene-title";
            title.textContent = "CARD GREETINGS & SCENARIO";

            const message = document.createElement("p");
            message.className = "dangan-card-hygiene-message";
            message.textContent = "These character cards include greeting messages and/or scenario text. Greetings become the first messages in this thread. Scenario is sent to the model on every reply, including during Class Trials. CLEAN removes them from this chat only — the cards themselves are unchanged.";

            const list = document.createElement("ul");
            list.className = "dangan-card-hygiene-list";
            for (const entry of flagged) {
                const li = document.createElement("li");
                const fields = [
                    entry.hasGreeting ? "greeting" : "",
                    entry.hasScenario ? "scenario" : "",
                ].filter(Boolean).join(", ");
                li.textContent = `${entry.name} — ${fields}`;
                list.appendChild(li);
            }

            const rememberLabel = document.createElement("label");
            rememberLabel.className = "dangan-card-hygiene-remember";
            const remember = document.createElement("input");
            remember.type = "checkbox";
            remember.id = "dangan-card-hygiene-remember";
            const rememberText = document.createElement("span");
            rememberText.textContent = "Do this automatically for new chats";
            rememberLabel.append(remember, rememberText);

            const actions = document.createElement("div");
            actions.className = "dangan-card-hygiene-actions";

            const keepBtn = document.createElement("button");
            keepBtn.type = "button";
            keepBtn.className = "dangan-card-hygiene-btn";
            keepBtn.textContent = "KEEP";

            const cleanBtn = document.createElement("button");
            cleanBtn.type = "button";
            cleanBtn.className = "dangan-card-hygiene-btn dangan-card-hygiene-btn-clean";
            cleanBtn.textContent = "CLEAN";

            actions.append(keepBtn, cleanBtn);
            shell.append(title, message, list, rememberLabel, actions);
            overlay.appendChild(shell);
            document.body.appendChild(overlay);

            let settled = false;
            const onKey = (event) => {
                if (event.key === "Escape") finish("keep");
            };
            const finish = (decision) => {
                if (settled) return;
                settled = true;
                dismissActivePrompt = null;
                document.removeEventListener("keydown", onKey);
                overlay.remove();
                resolve({ decision, remember: !!remember.checked });
            };

            dismissActivePrompt = () => finish("keep");
            overlay.addEventListener("click", (event) => {
                if (event.target === overlay) finish("keep");
            });
            keepBtn.addEventListener("click", () => finish("keep"));
            cleanBtn.addEventListener("click", () => finish("clean"));
            document.addEventListener("keydown", onKey);
        });
    }

    async function maybeOfferCardHygiene() {
        restoreAllScenarios();
        if (typeof dismissActivePrompt === "function") dismissActivePrompt();
        await Promise.resolve();

        const ctx = getContext();
        if (!ctx) return;

        const flagged = getFlaggedParticipants(ctx);
        const decision = readDecision(ctx);

        if (decision === "clean") {
            if (flagged.length) blankScenarios(flagged.map(f => f.char));
            await enforceCleanGreetings(ctx);
            return;
        }
        if (decision === "keep") return;
        if (hasUserMessage(ctx.chat)) return;
        if (!flagged.length) return;

        const def = normalizeDefault(getMonopadSetting?.("cardHygieneDefault"));
        if (def === "keep") {
            await persistDecision(ctx, "keep");
            return;
        }
        if (def === "clean") {
            await applyClean(ctx, flagged);
            return;
        }

        if (promptInFlight) return;
        promptInFlight = true;
        const identity = getChatIdentity(ctx);
        try {
            const result = await showWarning(flagged);
            const stillHere = getChatIdentity(getContext()) === identity;
            if (result.remember) {
                setMonopadSetting?.("cardHygieneDefault", result.decision);
                const sel = document.getElementById("dangan_card_hygiene_default");
                if (sel) sel.value = result.decision;
            }
            if (!stillHere) return;
            const liveCtx = getContext();
            if (result.decision === "clean") {
                await applyClean(liveCtx, getFlaggedParticipants(liveCtx));
            } else {
                await persistDecision(liveCtx, "keep");
            }
        } catch (err) {
            console.warn(`[${extensionName}] Card hygiene prompt failed:`, err);
        } finally {
            promptInFlight = false;
        }
    }

    function dismissHygienePrompt() {
        if (typeof dismissActivePrompt === "function") dismissActivePrompt();
        closeOverlay();
    }

    return {
        maybeOfferCardHygiene,
        enforceCleanGreetings,
        dismissHygienePrompt,
    };
}
