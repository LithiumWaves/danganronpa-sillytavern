const PHASES = Object.freeze({
    IDLE: "idle",
    TRIAL_INTRO: "trial_intro",
    DISCUSSION_PRE_DEBATE: "discussion_pre_debate",
    NONSTOP_INTRO_CUTSCENE: "nonstop_intro_cutscene",
    NONSTOP_ACTIVE: "nonstop_active",
    DISCUSSION_POST_DEBATE: "discussion_post_debate",
    MINI_GAME: "mini_game",
    TRIAL_RESULT: "trial_result",
});

const ALLOWED_TRANSITIONS = Object.freeze({
    [PHASES.IDLE]: new Set([PHASES.TRIAL_INTRO]),
    [PHASES.TRIAL_INTRO]: new Set([PHASES.DISCUSSION_PRE_DEBATE, PHASES.IDLE]),
    [PHASES.DISCUSSION_PRE_DEBATE]: new Set([PHASES.NONSTOP_INTRO_CUTSCENE, PHASES.IDLE]),
    [PHASES.NONSTOP_INTRO_CUTSCENE]: new Set([PHASES.NONSTOP_ACTIVE, PHASES.IDLE]),
    [PHASES.NONSTOP_ACTIVE]: new Set([PHASES.DISCUSSION_POST_DEBATE, PHASES.NONSTOP_INTRO_CUTSCENE, PHASES.IDLE]),
    [PHASES.DISCUSSION_POST_DEBATE]: new Set([PHASES.NONSTOP_INTRO_CUTSCENE, PHASES.MINI_GAME, PHASES.TRIAL_RESULT, PHASES.IDLE]),
    [PHASES.MINI_GAME]: new Set([PHASES.DISCUSSION_POST_DEBATE, PHASES.TRIAL_RESULT, PHASES.IDLE]),
    [PHASES.TRIAL_RESULT]: new Set([PHASES.IDLE]),
});

function cloneSerializable(value) {
    if (value == null) return value;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return value;
    }
}

function buildSessionId() {
    return `trial_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createTrialController({
    extensionName,
    extension_settings,
    saveSettingsDebounced,
    buildCaseSummary,
    getEquippedSkills,
    getTruthBullets,
    openConfirmDialog,
} = {}) {
    let state = {
        phase: PHASES.IDLE,
        session: null,
        lastReason: "init",
        updatedAt: Date.now(),
    };

    function persistState() {
        if (!extensionName || !extension_settings) return;
        extension_settings[extensionName] ||= {};
        extension_settings[extensionName].trialState = cloneSerializable(state);
        saveSettingsDebounced?.();
    }

    function setState(next) {
        state = {
            ...next,
            updatedAt: Date.now(),
        };
        persistState();
        return getState();
    }

    function getState() {
        return cloneSerializable(state);
    }

    function canTransition(from, to) {
        return Boolean(ALLOWED_TRANSITIONS[from]?.has(to));
    }

    function transitionTo(nextPhase, reason = "unknown") {
        const currentPhase = state.phase;
        if (!Object.values(PHASES).includes(nextPhase)) {
            return { changed: false, reason: "unknown_phase", state: getState() };
        }

        if (currentPhase === nextPhase) {
            return { changed: false, reason: "already_in_phase", state: getState() };
        }

        if (!canTransition(currentPhase, nextPhase)) {
            return { changed: false, reason: `invalid_transition:${currentPhase}->${nextPhase}`, state: getState() };
        }

        const session = state.session ? { ...state.session } : null;
        if (session) {
            session.history ||= [];
            session.history.push({
                from: currentPhase,
                to: nextPhase,
                reason: String(reason || "unknown"),
                at: Date.now(),
            });
            session.lastPhase = nextPhase;
        }

        setState({
            phase: nextPhase,
            session,
            lastReason: String(reason || "unknown"),
        });

        return { changed: true, phase: nextPhase, state: getState() };
    }

    function createSession(source = "unknown") {
        return {
            id: buildSessionId(),
            source: String(source || "unknown"),
            startedAt: Date.now(),
            caseSummary: String(buildCaseSummary?.() || "Case summary pending."),
            equippedSkills: cloneSerializable(getEquippedSkills?.() || []),
            truthBullets: cloneSerializable(getTruthBullets?.() || []),
            history: [],
            lastPhase: PHASES.TRIAL_INTRO,
        };
    }

    function requestStartFromUi({ source = "ui" } = {}) {
        if (state.phase !== PHASES.IDLE) {
            return { started: false, reason: "trial_already_active", state: getState() };
        }

        setState({
            phase: PHASES.TRIAL_INTRO,
            session: createSession(source),
            lastReason: "start_ui",
        });

        return { started: true, phase: PHASES.TRIAL_INTRO, state: getState() };
    }

    async function requestStartFromMarker({ markerText = "V3C| TRIAL_START" } = {}) {
        if (state.phase !== PHASES.IDLE) {
            return { started: false, reason: "trial_already_active", state: getState() };
        }

        const accepted = await openConfirmDialog?.({
            title: "CLASS TRIAL",
            message: `Start Class Trial?\n\nTrigger: ${String(markerText || "V3C| TRIAL_START")}`,
            confirmLabel: "START TRIAL",
            cancelLabel: "NOT YET",
        });

        if (!accepted) {
            return { started: false, reason: "user_cancelled", state: getState() };
        }

        return requestStartFromUi({ source: "marker" });
    }

    function cancelTrial(reason = "cancelled") {
        if (state.phase === PHASES.IDLE) {
            return { changed: false, reason: "already_idle", state: getState() };
        }

        const session = state.session ? { ...state.session } : null;
        if (session) {
            session.endedAt = Date.now();
            session.endReason = String(reason || "cancelled");
        }

        setState({
            phase: PHASES.IDLE,
            session: null,
            lastReason: String(reason || "cancelled"),
        });

        return { changed: true, phase: PHASES.IDLE, state: getState() };
    }

    function debugSetPhase(phase, { source = "debug" } = {}) {
        if (!Object.values(PHASES).includes(phase)) {
            return { changed: false, reason: "unknown_phase", state: getState() };
        }

        if (!state.session && phase !== PHASES.IDLE) {
            setState({
                phase: PHASES.TRIAL_INTRO,
                session: createSession(source),
                lastReason: "debug_bootstrap",
            });
        }

        if (phase === PHASES.IDLE) return cancelTrial("debug_to_idle");

        if (state.phase === phase) {
            return { changed: false, reason: "already_in_phase", state: getState() };
        }

        if (!canTransition(state.phase, phase)) {
            setState({
                phase,
                session: state.session,
                lastReason: `debug_force:${source}`,
            });
            return { changed: true, forced: true, phase, state: getState() };
        }

        return transitionTo(phase, `debug:${source}`);
    }

    return {
        phases: PHASES,
        getState,
        transitionTo,
        requestStartFromMarker,
        requestStartFromUi,
        cancelTrial,
        debugSetPhase,
    };
}
