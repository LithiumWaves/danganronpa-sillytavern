export const TRIAL_PHASES = Object.freeze({
    IDLE: "idle",
    TRIAL_INTRO: "trial_intro",
    DISCUSSION_PRE_DEBATE: "discussion_pre_debate",
    NONSTOP_INTRO_CUTSCENE: "nonstop_intro_cutscene",
    NONSTOP_ACTIVE: "nonstop_active",
    DISCUSSION_POST_DEBATE: "discussion_post_debate",
    MINI_GAME: "mini_game",
    TRIAL_RESULT: "trial_result",
});

const VALID_TRANSITIONS = Object.freeze({
    [TRIAL_PHASES.IDLE]: [TRIAL_PHASES.TRIAL_INTRO],
    [TRIAL_PHASES.TRIAL_INTRO]: [TRIAL_PHASES.DISCUSSION_PRE_DEBATE, TRIAL_PHASES.IDLE],
    [TRIAL_PHASES.DISCUSSION_PRE_DEBATE]: [TRIAL_PHASES.NONSTOP_INTRO_CUTSCENE, TRIAL_PHASES.IDLE],
    [TRIAL_PHASES.NONSTOP_INTRO_CUTSCENE]: [TRIAL_PHASES.NONSTOP_ACTIVE, TRIAL_PHASES.IDLE],
    [TRIAL_PHASES.NONSTOP_ACTIVE]: [TRIAL_PHASES.DISCUSSION_POST_DEBATE, TRIAL_PHASES.IDLE],
    [TRIAL_PHASES.DISCUSSION_POST_DEBATE]: [TRIAL_PHASES.MINI_GAME, TRIAL_PHASES.NONSTOP_INTRO_CUTSCENE, TRIAL_PHASES.TRIAL_RESULT, TRIAL_PHASES.IDLE],
    [TRIAL_PHASES.MINI_GAME]: [TRIAL_PHASES.DISCUSSION_POST_DEBATE, TRIAL_PHASES.TRIAL_RESULT, TRIAL_PHASES.IDLE],
    [TRIAL_PHASES.TRIAL_RESULT]: [TRIAL_PHASES.IDLE],
});

function deepClone(value) {
    if (value == null) return value;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return value;
    }
}

function clampCaseSummary(summary) {
    const normalized = String(summary || "").trim();
    if (!normalized) return "Case summary pending.";
    return normalized.slice(0, 900);
}

export function createTrialController({
    extensionName,
    extension_settings,
    saveSettingsDebounced,
    buildCaseSummary,
    getEquippedSkills,
    getTruthBullets,
    openConfirmDialog,
    onStateChange,
}) {
    const state = {
        phase: TRIAL_PHASES.IDLE,
        session: null,
    };


    function emitStateChange(eventName = "update") {
        try {
            onStateChange?.({
                event: eventName,
                phase: state.phase,
                session: deepClone(state.session),
            });
        } catch (error) {
            console.warn("[Dangan][Trial] State change callback failed:", error);
        }
    }

    function ensureStore() {
        extension_settings[extensionName] ||= {};
        extension_settings[extensionName].trial ||= {};
        extension_settings[extensionName].trialState ||= {
            phase: TRIAL_PHASES.IDLE,
            session: null,
            updatedAt: Date.now(),
        };
        return extension_settings[extensionName].trialState;
    }

    function persistState() {
        const store = ensureStore();
        store.phase = state.phase;
        store.session = deepClone(state.session);
        store.updatedAt = Date.now();
        saveSettingsDebounced?.();
        emitStateChange("persist");
    }

    function initializeFromSettings() {
        const store = ensureStore();
        const persistedPhase = String(store.phase || TRIAL_PHASES.IDLE);
        state.phase = Object.values(TRIAL_PHASES).includes(persistedPhase) ? persistedPhase : TRIAL_PHASES.IDLE;
        state.session = deepClone(store.session) || null;

        if (state.phase !== TRIAL_PHASES.IDLE && !state.session) {
            state.phase = TRIAL_PHASES.IDLE;
        }

        if (state.phase === TRIAL_PHASES.IDLE) {
            state.session = null;
        }

        persistState();
        emitStateChange("init");
    }

    function canTransition(toPhase) {
        const allowed = VALID_TRANSITIONS[state.phase] || [];
        return allowed.includes(toPhase);
    }

    function transitionTo(toPhase, reason = "") {
        if (!Object.values(TRIAL_PHASES).includes(toPhase)) {
            return { ok: false, reason: `Unknown phase: ${toPhase}` };
        }

        if (toPhase === state.phase) {
            return { ok: true, reason: "Already in phase", phase: state.phase };
        }

        if (!canTransition(toPhase)) {
            return { ok: false, reason: `Invalid transition ${state.phase} -> ${toPhase}` };
        }

        state.phase = toPhase;

        if (state.phase === TRIAL_PHASES.IDLE) {
            state.session = null;
        }

        persistState();
        return { ok: true, phase: state.phase, reason };
    }

    function buildSessionSnapshot({ triggerSource = "manual", markerText = "" } = {}) {
        const now = Date.now();
        const truthBullets = Array.isArray(getTruthBullets?.()) ? getTruthBullets() : [];
        const equippedSkills = Array.isArray(getEquippedSkills?.()) ? getEquippedSkills() : [];

        return {
            id: `trial_${now}`,
            startedAt: now,
            triggerSource,
            markerText: String(markerText || ""),
            caseSummary: clampCaseSummary(buildCaseSummary?.()),
            equippedSkills: deepClone(equippedSkills),
            truthBullets: deepClone(truthBullets),
        };
    }

    async function requestStartFromMarker({ markerText = "V3C| TRIAL_START" } = {}) {
        if (state.phase !== TRIAL_PHASES.IDLE) {
            return { started: false, reason: `Trial already active (${state.phase})` };
        }

        const accepted = await openConfirmDialog?.({
            title: "CLASS TRIAL",
            message: "A Trial Start marker was detected. Begin Class Trial now?",
            confirmLabel: "START TRIAL",
            cancelLabel: "NOT YET",
        });

        if (!accepted) {
            return { started: false, reason: "User cancelled" };
        }

        state.session = buildSessionSnapshot({ triggerSource: "marker", markerText });
        state.phase = TRIAL_PHASES.TRIAL_INTRO;
        persistState();

        return { started: true, phase: state.phase, session: deepClone(state.session) };
    }

    function requestStartFromUi({ source = "ui" } = {}) {
        if (state.phase !== TRIAL_PHASES.IDLE) {
            return { started: false, reason: `Trial already active (${state.phase})` };
        }

        state.session = buildSessionSnapshot({ triggerSource: source });
        state.phase = TRIAL_PHASES.TRIAL_INTRO;
        persistState();
        return { started: true, phase: state.phase, session: deepClone(state.session) };
    }

    function cancelTrial() {
        const result = transitionTo(TRIAL_PHASES.IDLE, "cancelled");
        return { ok: !!result.ok, phase: state.phase };
    }

    function getState() {
        return {
            phase: state.phase,
            session: deepClone(state.session),
        };
    }

    initializeFromSettings();

    return {
        phases: TRIAL_PHASES,
        getState,
        canTransition,
        transitionTo,
        requestStartFromMarker,
        requestStartFromUi,
        cancelTrial,
        buildSessionSnapshot,
    };
}
