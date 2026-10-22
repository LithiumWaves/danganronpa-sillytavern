import { escapeHtml, isTypingTarget } from "./titleUtils.js";

export const DEFAULT_STORY_CHAT_NAME = "Hope's Peak - Killing Game";
const STEP_ORDER = Object.freeze(["style", "group", "roster", "summary"]);
const STEP_TITLES = Object.freeze({
    style: "HOW DO YOU WANT TO PLAY?",
    group: "CREATE THE STORY CHAT",
    roster: "CLASS ROSTER",
    summary: "READY?",
});

export function stepsFor(mode) {
    return STEP_ORDER.filter((step) => step !== "group" || mode === "single");
}

export function nextStep(state) {
    const steps = stepsFor(state?.mode);
    const idx = steps.indexOf(state?.step);
    return idx >= 0 && idx < steps.length - 1 ? steps[idx + 1] : null;
}

export function prevStep(state) {
    const steps = stepsFor(state?.mode);
    const idx = steps.indexOf(state?.step);
    return idx > 0 ? steps[idx - 1] : null;
}

// Returns an error message for the current step, or "" when it can advance.
export function validateStep(state) {
    switch (state?.step) {
        case "style":
            return state.mode === "single" || state.mode === "multi" ? "" : "Pick a play style.";
        case "group":
            if (!String(state.groupName || "").trim()) return "Give the story chat a name.";
            if ((state.groupMembers?.size ?? 0) < 2) return "Pick at least two members for the story chat.";
            return "";
        case "roster":
            return (state.roster?.size ?? 0) >= 1 ? "" : "Pick at least one classmate.";
        default:
            return "";
    }
}

export function buildFinishPayload(state) {
    return {
        fresh: !!state.fresh,
        mode: state.mode,
        groupName: state.mode === "single" ? String(state.groupName || "").trim() : "",
        groupMembers: state.mode === "single" ? [...state.groupMembers] : [],
        roster: [...state.roster.entries()].map(([name, ultimate]) => ({ name, ultimate: String(ultimate || "").trim() })),
        persona: state.persona || "",
    };
}

function renderCardGrid(candidates, selected, { withUltimate = false, ultimates = null } = {}) {
    if (!candidates.length) {
        return `<div class="dgn-title-empty">NO CHARACTER CARDS FOUND. Import some characters into SillyTavern first.</div>`;
    }
    return candidates.map((c) => {
        const on = selected.has(c.name);
        return `
            <div class="dgn-title-card${on ? " is-on" : ""}" data-name="${escapeHtml(c.name)}">
                <button type="button" class="dgn-title-card-pick" aria-pressed="${on}">
                    <span class="dgn-title-card-img">${c.avatarUrl ? `<img src="${escapeHtml(c.avatarUrl)}" alt="" loading="lazy" draggable="false">` : ""}</span>
                    <span class="dgn-title-card-name">${escapeHtml(c.name)}</span>
                    <span class="dgn-title-card-check" aria-hidden="true"></span>
                </button>
                ${withUltimate && on ? `
                    <input type="text" class="dgn-title-input dgn-title-card-ultimate" placeholder="Ultimate ???"
                        aria-label="${escapeHtml(c.name)}'s Ultimate" value="${escapeHtml(ultimates?.get(c.name) ?? "")}">
                ` : ""}
            </div>`;
    }).join("");
}

export function mountNewGamePanel(container, api) {
    const { services, sfx, confirm, close, back } = api;
    const candidates = (() => {
        try { return services.getCandidates?.() || []; } catch { return []; }
    })();
    const personas = (() => {
        try { return services.getPersonas?.() || { list: [], current: "" }; } catch { return { list: [], current: "" }; }
    })();

    const state = {
        step: "style",
        fresh: false,
        // One Main Chat is the recommended way to play, so it starts selected.
        mode: "single",
        groupName: DEFAULT_STORY_CHAT_NAME,
        groupMembers: new Set(),
        roster: new Map(),
        rosterSeeded: false,
        persona: personas.current || "",
        query: "",
        busy: false,
        error: "",
    };
    const ultimateOf = (name) => candidates.find((c) => c.name === name)?.ultimate || "";

    let disposed = false;
    let ready = false;

    container.innerHTML = `
        <div class="dgn-title-wizard">
            <ol class="dgn-title-steps" aria-label="Progress"></ol>
            <div class="dgn-title-wizard-body"></div>
            <div class="dgn-title-wizard-foot">
                <span class="dgn-title-error" role="alert"></span>
                <button type="button" class="dgn-title-btn" data-nav="prev">BACK</button>
                <button type="button" class="dgn-title-btn is-primary" data-nav="next">NEXT</button>
            </div>
        </div>
    `;
    const stepsEl = container.querySelector(".dgn-title-steps");
    const bodyEl = container.querySelector(".dgn-title-wizard-body");
    const errorEl = container.querySelector(".dgn-title-error");
    const prevBtn = container.querySelector('[data-nav="prev"]');
    const nextBtn = container.querySelector('[data-nav="next"]');

    const seedRoster = () => {
        if (state.rosterSeeded) return;
        state.rosterSeeded = true;
        const names = state.mode === "single"
            ? [...state.groupMembers]
            : (state.fresh ? [] : candidates.filter((c) => c.inRoster).map((c) => c.name));
        names.forEach((name) => state.roster.set(name, ultimateOf(name)));
    };

    const visibleCandidates = () => {
        const q = state.query.trim().toLowerCase();
        return q ? candidates.filter((c) => c.name.toLowerCase().includes(q)) : candidates;
    };

    const renderGridOnly = () => {
        const grid = bodyEl.querySelector(".dgn-title-grid");
        if (!grid) return;
        const selected = state.step === "group" ? state.groupMembers : new Set(state.roster.keys());
        grid.innerHTML = renderCardGrid(visibleCandidates(), selected, {
            withUltimate: state.step === "roster",
            ultimates: state.roster,
        });
        const count = bodyEl.querySelector(".dgn-title-count");
        if (count) count.textContent = `${selected.size} SELECTED`;
    };

    const gridToolbar = () => `
        <div class="dgn-title-toolbar">
            <input type="search" class="dgn-title-input dgn-title-grid-search" placeholder="Search characters…" aria-label="Search characters" value="${escapeHtml(state.query)}">
            <button type="button" class="dgn-title-btn is-small" data-select="all">ALL</button>
            <button type="button" class="dgn-title-btn is-small" data-select="none">NONE</button>
            <span class="dgn-title-count"></span>
        </div>
        <div class="dgn-title-grid"></div>
    `;

    const renderStep = () => {
        const steps = stepsFor(state.mode);
        const current = steps.indexOf(state.step);
        stepsEl.innerHTML = steps.map((s, i) => `
            <li class="${i === current ? "is-current" : ""}${i < current ? " is-done" : ""}">
                <span>${i + 1}</span>${escapeHtml(STEP_TITLES[s])}
            </li>`).join("");
        errorEl.textContent = state.error;
        prevBtn.textContent = current === 0 ? "MENU" : "BACK";
        nextBtn.textContent = state.step === "summary" ? (state.busy ? "STARTING…" : "BEGIN") : "NEXT";
        nextBtn.disabled = state.busy;
        prevBtn.disabled = state.busy;

        if (state.step === "style") {
            bodyEl.innerHTML = `
                <div class="dgn-title-modes">
                    <button type="button" class="dgn-title-mode${state.mode === "single" ? " is-on" : ""}" data-mode="single" aria-pressed="${state.mode === "single"}">
                        <span class="dgn-title-mode-name">ONE MAIN CHAT</span>
                        <span class="dgn-title-mode-tag">RECOMMENDED · SINGLE-CHAT OVERWORLD</span>
                        <span class="dgn-title-mode-text">The main way to play. One group chat is the whole story. Exploring stays in it: whoever is in the room is unmuted, everyone else is muted. Call Student brings people to you. You'll create that chat next.</span>
                    </button>
                    <button type="button" class="dgn-title-mode${state.mode === "multi" ? " is-on" : ""}" data-mode="multi" aria-pressed="${state.mode === "multi"}">
                        <span class="dgn-title-mode-name">SEVERAL CHATS</span>
                        <span class="dgn-title-mode-tag">ALTERNATIVE</span>
                        <span class="dgn-title-mode-text">Talk to the Room, Grab Group, and sprite clicks each open or switch to their own chat. Good for separate 1-on-1s, room threads and trial chats.</span>
                    </button>
                </div>
                <p class="dgn-title-note">You can switch later in Options. Class trials work in both styles.${state.fresh ? " This game gets a new save. Your previous save is kept." : ""}</p>
            `;
        } else if (state.step === "group") {
            bodyEl.innerHTML = `
                <label class="dgn-title-field">
                    <span>CHAT NAME</span>
                    <input type="text" class="dgn-title-input dgn-title-group-name" maxlength="80" value="${escapeHtml(state.groupName)}">
                </label>
                <p class="dgn-title-note">Pick who is in the story chat. They'll be ticked on the class roster next.</p>
                ${gridToolbar()}
            `;
            renderGridOnly();
        } else if (state.step === "roster") {
            const personaOptions = personas.list.map((p) => `
                <button type="button" class="dgn-title-persona${p.key === state.persona ? " is-on" : ""}" data-persona="${escapeHtml(p.key)}" aria-pressed="${p.key === state.persona}">
                    ${p.avatarUrl ? `<img src="${escapeHtml(p.avatarUrl)}" alt="" loading="lazy" draggable="false">` : ""}
                    <span>${escapeHtml(p.name)}</span>
                </button>`).join("");
            bodyEl.innerHTML = `
                ${personas.list.length ? `
                    <div class="dgn-title-field">
                        <span>YOU ARE</span>
                        <div class="dgn-title-personas">${personaOptions}</div>
                    </div>` : ""}
                <p class="dgn-title-note">Tick your classmates and set each one's Ultimate. Blank Ultimates stay "???" until the lorebook or Social tab fills them in.</p>
                ${gridToolbar()}
            `;
            renderGridOnly();
        } else if (state.step === "summary") {
            const payload = buildFinishPayload(state);
            const removed = state.fresh
                ? []
                : candidates.filter((c) => c.inRoster && !state.roster.has(c.name)).map((c) => c.name);
            const personaName = personas.list.find((p) => p.key === state.persona)?.name || "";
            bodyEl.innerHTML = `
                <dl class="dgn-title-summary">
                    <dt>SAVE</dt><dd>${state.fresh ? "New save (your previous save is kept)" : "Current save"}</dd>
                    <dt>PLAY STYLE</dt><dd>${state.mode === "single" ? "One main chat" : "Several chats"}</dd>
                    ${state.mode === "single" ? `<dt>STORY CHAT</dt><dd>${escapeHtml(payload.groupName)} <small>(${payload.groupMembers.length} members)</small></dd>` : ""}
                    ${personaName ? `<dt>YOU</dt><dd>${escapeHtml(personaName)}</dd>` : ""}
                    <dt>CLASS (${payload.roster.length})</dt>
                    <dd><ul class="dgn-title-summary-roster">${payload.roster.map((r) => `<li><strong>${escapeHtml(r.name)}</strong><span>${escapeHtml(r.ultimate ? `Ultimate ${r.ultimate}` : "Ultimate ???")}</span></li>`).join("")}</ul></dd>
                    ${removed.length ? `<dt>LEAVING</dt><dd>${removed.map(escapeHtml).join(", ")} <small>(removed from the roster)</small></dd>` : ""}
                </dl>
            `;
        }
    };

    const go = (step) => {
        state.step = step;
        state.error = "";
        state.query = "";
        if (step === "roster") seedRoster();
        renderStep();
        requestAnimationFrame(() => {
            const first = bodyEl.querySelector(".dgn-title-mode.is-on, .dgn-title-mode, .dgn-title-group-name, .dgn-title-card-pick") || nextBtn;
            first?.focus({ preventScroll: true });
        });
    };

    const finish = async () => {
        if (state.busy) return;
        state.busy = true;
        state.error = "";
        renderStep();
        try {
            const result = await services.finishNewGame?.(buildFinishPayload(state));
            if (disposed) return;
            close(() => result?.afterClose?.());
        } catch (e) {
            console.warn("[Dangan][Title] New game failed:", e);
            if (disposed) return;
            state.busy = false;
            state.error = `Couldn't start: ${e?.message || e}`;
            renderStep();
        }
    };

    const advance = () => {
        if (!ready || state.busy) return;
        const error = validateStep(state);
        if (error) {
            state.error = error;
            errorEl.textContent = error;
            sfx("close");
            return;
        }
        sfx("click");
        if (state.step === "summary") {
            finish();
            return;
        }
        const next = nextStep(state);
        if (next) go(next);
    };

    const retreat = () => {
        if (state.busy) return true;
        const prev = prevStep(state);
        if (!prev) return false;
        sfx("close");
        go(prev);
        return true;
    };

    const toggleName = (name) => {
        if (state.step === "group") {
            if (state.groupMembers.has(name)) state.groupMembers.delete(name);
            else state.groupMembers.add(name);
            // Newly added story-chat members join the class too.
            if (state.rosterSeeded && state.groupMembers.has(name) && !state.roster.has(name)) {
                state.roster.set(name, ultimateOf(name));
            }
        } else if (state.step === "roster") {
            if (state.roster.has(name)) state.roster.delete(name);
            else state.roster.set(name, ultimateOf(name));
        }
        sfx("hover");
        renderGridOnly();
        bodyEl.querySelector(`.dgn-title-card[data-name="${CSS.escape(name)}"] .dgn-title-card-pick`)?.focus({ preventScroll: true });
    };

    const selectAll = (on) => {
        const names = visibleCandidates().map((c) => c.name);
        names.forEach((name) => {
            if (state.step === "group") {
                if (on) state.groupMembers.add(name); else state.groupMembers.delete(name);
            } else if (on) {
                if (!state.roster.has(name)) state.roster.set(name, ultimateOf(name));
            } else {
                state.roster.delete(name);
            }
        });
        sfx("click");
        renderGridOnly();
    };

    container.addEventListener("click", (ev) => {
        const t = ev.target;
        const nav = t.closest?.("[data-nav]");
        if (nav) {
            if (nav.dataset.nav === "next") advance();
            else if (!retreat()) back();
            return;
        }
        const mode = t.closest?.("[data-mode]");
        if (mode) {
            if (state.mode !== mode.dataset.mode) {
                state.mode = mode.dataset.mode;
                state.rosterSeeded = false;
                state.roster.clear();
            }
            sfx("click");
            renderStep();
            advance();
            return;
        }
        const pick = t.closest?.(".dgn-title-card-pick");
        if (pick) {
            toggleName(pick.closest(".dgn-title-card").dataset.name);
            return;
        }
        const sel = t.closest?.("[data-select]");
        if (sel) {
            selectAll(sel.dataset.select === "all");
            return;
        }
        const persona = t.closest?.("[data-persona]");
        if (persona) {
            state.persona = persona.dataset.persona;
            bodyEl.querySelectorAll(".dgn-title-persona").forEach((el) => {
                const on = el.dataset.persona === state.persona;
                el.classList.toggle("is-on", on);
                el.setAttribute("aria-pressed", String(on));
            });
            sfx("click");
        }
    });

    container.addEventListener("input", (ev) => {
        const t = ev.target;
        if (t.classList.contains("dgn-title-group-name")) {
            state.groupName = t.value;
        } else if (t.classList.contains("dgn-title-grid-search")) {
            state.query = t.value;
            renderGridOnly();
        } else if (t.classList.contains("dgn-title-card-ultimate")) {
            const name = t.closest(".dgn-title-card")?.dataset.name;
            if (name && state.roster.has(name)) state.roster.set(name, t.value);
        }
    });

    const moveCardFocus = (ev) => {
        const cards = Array.from(bodyEl.querySelectorAll(".dgn-title-card-pick"));
        const idx = cards.indexOf(ev.target);
        if (idx < 0) return false;
        const top = cards[0].getBoundingClientRect().top;
        const cols = Math.max(1, cards.filter((c) => Math.abs(c.getBoundingClientRect().top - top) < 4).length);
        const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols }[ev.key];
        if (!delta) return false;
        const next = cards[Math.max(0, Math.min(cards.length - 1, idx + delta))];
        if (next !== ev.target) sfx("hover");
        next?.focus({ preventScroll: false });
        return true;
    };

    const start = async () => {
        let fresh = false;
        try {
            if (services.hasProgress?.()) {
                fresh = await confirm({
                    title: "NEW SAVE?",
                    message: "NEW SAVE starts this game in a save of its own when you press BEGIN. Your current progress stays in its save, and CONTINUE can load it again. KEEP CURRENT SAVE sets up chats and the roster in the save you have loaded now.",
                    confirmLabel: "NEW SAVE",
                    cancelLabel: "KEEP CURRENT SAVE",
                });
            }
        } catch { /* keep progress */ }
        if (disposed) return;
        state.fresh = !!fresh;
        ready = true;
        go("style");
    };

    renderStep();
    start();

    return {
        unmount() { disposed = true; },
        onBack: retreat,
        onKey(ev) {
            if (isTypingTarget(ev.target)) {
                if (ev.key === "Enter" && !ev.target.classList.contains("dgn-title-card-ultimate")) {
                    advance();
                    return true;
                }
                return false;
            }
            if (ev.key.startsWith("Arrow")) {
                if (moveCardFocus(ev)) return true;
                const modes = Array.from(bodyEl.querySelectorAll(".dgn-title-mode"));
                const mi = modes.indexOf(ev.target);
                if (mi >= 0) {
                    const next = modes[(mi + 1) % modes.length];
                    sfx("hover");
                    next.focus({ preventScroll: true });
                    return true;
                }
            }
            if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) {
                advance();
                return true;
            }
            return false;
        },
    };
}
