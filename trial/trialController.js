const PHASES = [
    { id: "discussion_pre", type: "discussion", label: "DISCUSSION · OPENING" },
    { id: "nonstop_debate", type: "nonstop_debate", label: "NONSTOP DEBATE" },
    { id: "minigame_hangman", type: "minigame", minigame: "hangman", label: "HANGMAN'S GAMBIT" },
    { id: "discussion_post", type: "discussion", label: "DISCUSSION · COUNTERPOINT" },
    { id: "minigame_logic_dive", type: "minigame", minigame: "logic_dive", label: "LOGIC DIVE (PROTOTYPE)" },
    { id: "verdict", type: "discussion", label: "CLOSING ARGUMENT" },
];

const HANGMAN_WORD_BANK = ["mastermind", "alibi", "contradiction", "evidence", "blackened", "verdict"];

function randomInt(min, max) {
    const a = Number(min);
    const b = Number(max);
    const lo = Number.isFinite(a) ? a : 3;
    const hi = Number.isFinite(b) ? b : 8;
    return Math.floor(Math.random() * (Math.max(lo, hi) - Math.min(lo, hi) + 1)) + Math.min(lo, hi);
}

function pickRandomItem(items = []) {
    if (!Array.isArray(items) || !items.length) return null;
    return items[Math.floor(Math.random() * items.length)] || null;
}

export function createTrialController({ getSetting, playSfx, getSfx, extensionFolderPath } = {}) {
    const state = {
        active: false,
        phaseIndex: -1,
        waveLength: 0,
        completedPhases: [],
        nsdLinesShown: 0,
        hangman: null,
        hiddenElements: [],
    };

    const overlayId = "monopad-trial-overlay";

    function isTrialEnabled() {
        if (typeof getSetting !== "function") return true;
        return getSetting("trialEnabled") !== false;
    }

    function buildStatusText() {
        if (!state.active) return "READY";
        const phase = PHASES[state.phaseIndex];
        if (!phase) return "IN PROGRESS";
        return `${phase.label}${phase.type === "nonstop_debate" ? ` · ${state.nsdLinesShown}/${state.waveLength}` : ""}`;
    }

    function getSummary() {
        return {
            active: state.active,
            phaseId: PHASES[state.phaseIndex]?.id || null,
            phaseLabel: PHASES[state.phaseIndex]?.label || "IDLE",
            statusText: buildStatusText(),
            completedPhases: [...state.completedPhases],
        };
    }

    function ensureOverlay() {
        let el = document.getElementById(overlayId);
        if (el) return el;

        el = document.createElement("div");
        el.id = overlayId;
        el.className = "trial-overlay";
        el.setAttribute("aria-hidden", "true");
        el.innerHTML = `
            <div class="trial-overlay__backdrop"></div>
            <div class="trial-overlay__panel" role="dialog" aria-modal="true" aria-label="Class Trial">
                <div class="trial-overlay__head">
                    <div class="trial-overlay__kicker">CLASS TRIAL</div>
                    <div class="trial-overlay__title">IN SESSION</div>
                    <button type="button" class="trial-overlay__close" data-trial-action="exit">EXIT</button>
                </div>
                <div class="trial-overlay__content">
                    <div class="trial-overlay__phase"></div>
                    <div class="trial-overlay__body"></div>
                </div>
                <div class="trial-overlay__actions">
                    <button type="button" class="trial-overlay__btn" data-trial-action="next">NEXT SECTION</button>
                </div>
            </div>
        `;

        document.body.appendChild(el);

        el.querySelector('[data-trial-action="exit"]')?.addEventListener("click", () => endTrial());
        el.querySelector('[data-trial-action="next"]')?.addEventListener("click", () => advancePhase());
        el.querySelector(".trial-overlay__backdrop")?.addEventListener("click", () => endTrial());

        return el;
    }

    function hideSillyTavernInput() {
        const selectors = ["#send_textarea", "#send_form", "#chat_sheld"]; // best effort
        const hidden = [];

        for (const selector of selectors) {
            document.querySelectorAll(selector).forEach(el => {
                if (!(el instanceof HTMLElement)) return;
                hidden.push({ el, display: el.style.display || "" });
                el.style.display = "none";
            });
        }

        state.hiddenElements = hidden;
    }

    function restoreSillyTavernInput() {
        for (const entry of state.hiddenElements) {
            if (!entry?.el) continue;
            entry.el.style.display = entry.display || "";
        }
        state.hiddenElements = [];
    }

    function openOverlay() {
        const overlay = ensureOverlay();
        overlay.classList.add("open");
        overlay.setAttribute("aria-hidden", "false");
        hideSillyTavernInput();
    }

    function closeOverlay() {
        const overlay = document.getElementById(overlayId);
        if (!overlay) return;
        overlay.classList.remove("open");
        overlay.setAttribute("aria-hidden", "true");
        restoreSillyTavernInput();
    }

    function beginHangmanPhase() {
        const word = String(pickRandomItem(HANGMAN_WORD_BANK) || "evidence").toUpperCase();
        state.hangman = {
            word,
            guessed: new Set(),
            attemptsLeft: 6,
            solved: false,
        };
    }

    function getMaskedHangmanWord() {
        const data = state.hangman;
        if (!data) return "";
        return data.word.split("").map(ch => (data.guessed.has(ch) ? ch : "_ ")).join(" ");
    }

    function guessHangman(letter) {
        const data = state.hangman;
        if (!data || data.solved || data.attemptsLeft <= 0) return;

        const char = String(letter || "").slice(0, 1).toUpperCase();
        if (!/[A-Z]/.test(char)) return;
        if (data.guessed.has(char)) return;

        data.guessed.add(char);
        if (!data.word.includes(char)) {
            data.attemptsLeft -= 1;
        }

        const solved = data.word.split("").every(ch => data.guessed.has(ch));
        data.solved = solved;

        renderCurrentPhase();
    }

    function buildNsdLines() {
        const count = randomInt(getSetting?.("trialWaveMin"), getSetting?.("trialWaveMax"));
        state.waveLength = count;
        state.nsdLinesShown = count;

        const lines = [];
        for (let i = 0; i < count; i += 1) {
            lines.push(`<div class="trial-floating-line">\"${i % 2 === 0 ? "No, that doesn't add up" : "Wait, that's impossible"}!\"</div>`);
        }
        return lines.join("");
    }

    function renderDiscussionBody(phase) {
        const before = phase.id.includes("pre");
        return `
            <p class="trial-text">${before ? "Characters discuss the current evidence and establish the battleground before the debate." : "After the debate, everyone regroups, challenges assumptions, and narrows down contradictions."}</p>
            <p class="trial-text trial-text--muted">This section is where free discussion scenes and regular conversation exchanges happen.</p>
        `;
    }

    function renderMinigameBody(phase) {
        if (phase.minigame === "hangman") {
            if (!state.hangman) beginHangmanPhase();
            const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")
                .map(letter => `<button type="button" class="trial-letter-btn" data-hangman-letter="${letter}">${letter}</button>`)
                .join("");

            const status = state.hangman.solved
                ? "Solved!"
                : state.hangman.attemptsLeft <= 0
                    ? `Failed. Word: ${state.hangman.word}`
                    : `Attempts left: ${state.hangman.attemptsLeft}`;

            return `
                <div class="trial-minigame-card">
                    <div class="trial-minigame-title">HANGMAN'S GAMBIT</div>
                    <div class="trial-hangman-word">${getMaskedHangmanWord()}</div>
                    <div class="trial-hangman-status">${status}</div>
                    <div class="trial-letter-grid">${alphabet}</div>
                </div>
            `;
        }

        return `
            <div class="trial-minigame-card">
                <div class="trial-minigame-title">${phase.label}</div>
                <p class="trial-text">Scaffolding created. This slot is ready for a full minigame implementation.</p>
                <ul class="trial-minigame-list">
                    <li>Input handling + HUD</li>
                    <li>Win/lose conditions</li>
                    <li>Rewards/penalties and transition back to discussion</li>
                </ul>
            </div>
        `;
    }

    function renderCurrentPhase() {
        const overlay = ensureOverlay();
        const phase = PHASES[state.phaseIndex];
        const phaseEl = overlay.querySelector(".trial-overlay__phase");
        const bodyEl = overlay.querySelector(".trial-overlay__body");
        const nextBtn = overlay.querySelector('[data-trial-action="next"]');

        if (!phase || !phaseEl || !bodyEl || !nextBtn) return;

        phaseEl.textContent = phase.label;

        if (phase.type === "discussion") {
            bodyEl.innerHTML = renderDiscussionBody(phase);
        } else if (phase.type === "nonstop_debate") {
            bodyEl.innerHTML = `
                <div class="trial-banner">NONSTOP DEBATE</div>
                <div class="trial-floating-lines">${buildNsdLines()}</div>
                <p class="trial-text trial-text--muted">Truth Bullet shooting hooks and weak points can now be attached here.</p>
            `;
        } else {
            bodyEl.innerHTML = renderMinigameBody(phase);
            bodyEl.querySelectorAll("[data-hangman-letter]").forEach(button => {
                button.addEventListener("click", () => {
                    guessHangman(button.getAttribute("data-hangman-letter") || "");
                });
            });
        }

        const isFinal = state.phaseIndex >= PHASES.length - 1;
        nextBtn.textContent = isFinal ? "END TRIAL" : "NEXT SECTION";

        playSfx?.(getSfx?.().click);
    }

    function startTrial() {
        if (state.active || !isTrialEnabled()) return false;
        state.active = true;
        state.phaseIndex = 0;
        state.completedPhases = [];
        state.hangman = null;
        openOverlay();
        renderCurrentPhase();
        return true;
    }

    function advancePhase() {
        if (!state.active) return;

        const phase = PHASES[state.phaseIndex];
        if (phase?.id) state.completedPhases.push(phase.id);

        if (state.phaseIndex >= PHASES.length - 1) {
            endTrial();
            return;
        }

        state.phaseIndex += 1;
        if (PHASES[state.phaseIndex]?.minigame !== "hangman") {
            state.hangman = null;
        }
        renderCurrentPhase();
    }

    function endTrial() {
        if (!state.active) return;
        state.active = false;
        state.phaseIndex = -1;
        state.waveLength = 0;
        state.nsdLinesShown = 0;
        state.hangman = null;
        closeOverlay();
    }

    return {
        startTrial,
        advancePhase,
        endTrial,
        getSummary,
        isTrialEnabled,
    };
}
