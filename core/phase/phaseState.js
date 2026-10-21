// One place that answers "what phase is the game in, what can the player do
// from here, and what should they do next". The stored state is still the
// day/night time tracker plus the investigation flag; the phase is derived
// from them so existing code that reads those keys keeps working.

export const PHASES = Object.freeze({
    DAY: "DAY",
    NIGHT: "NIGHT",
    INVESTIGATION: "INVESTIGATION",
    TRIAL: "TRIAL",
});

const PHASE_LABELS = {
    DAY: "DAYTIME",
    NIGHT: "NIGHTTIME",
    INVESTIGATION: "INVESTIGATION",
    TRIAL: "CLASS TRIAL",
};

export function derivePhase({ timeTracker, investigationUnderway = false, trialActive = false } = {}) {
    if (trialActive) return PHASES.TRIAL;
    if (investigationUnderway) return PHASES.INVESTIGATION;
    return timeTracker?.phase === "night" ? PHASES.NIGHT : PHASES.DAY;
}

export function getPhaseLabel(phase) {
    return PHASE_LABELS[phase] || PHASE_LABELS.DAY;
}

export function getStatusLine({ phase, day = 1, chapterLabel = "" } = {}) {
    const parts = [];
    if (chapterLabel) parts.push(String(chapterLabel).toUpperCase());
    parts.push(`DAY ${Math.max(1, Number(day) || 1)}`);
    parts.push(getPhaseLabel(phase));
    return parts.join(" · ");
}

// Actions the player can take from the current phase. Each one names the
// confirmation to show, so the HUD and the Monopad header behave the same.
export function getPhaseActions({ phase, timeTracker, canUndo = false, undoLabel = "" } = {}) {
    const actions = [];

    if (phase === PHASES.INVESTIGATION) {
        actions.push({
            id: "end-investigation",
            label: "END INVESTIGATION",
            confirm: {
                title: "END INVESTIGATION",
                message: "Stop investigating and go back to daily life? Your Truth Bullets are kept.",
                confirmLabel: "END IT",
            },
        });
        actions.push({ id: "start-trial", label: "START CLASS TRIAL" });
    }

    if (phase === PHASES.DAY) {
        const used = Boolean(timeTracker?.dayActionUsed);
        actions.push({
            id: "pass-time",
            label: "PASS TIME",
            disabled: used,
            reason: used ? "Time has already passed today." : "",
            confirm: {
                title: "PASS TIME",
                message: "Skip ahead to nighttime? Monokuma will make the nighttime announcement.",
                confirmLabel: "PASS TIME",
            },
        });
    }

    if (phase === PHASES.NIGHT) {
        actions.push({
            id: "sleep",
            label: "SLEEP",
            confirm: {
                title: "SLEEP",
                message: `Go to sleep and start Day ${Math.max(1, Number(timeTracker?.day) || 1) + 1}?`,
                confirmLabel: "SLEEP",
            },
        });
    }

    if (phase === PHASES.DAY || phase === PHASES.NIGHT) {
        actions.push({
            id: "start-investigation",
            label: "START INVESTIGATION",
            confirm: {
                title: "START INVESTIGATION",
                message: "Begin an investigation now? Use this if a body was found but the investigation didn't start.",
                confirmLabel: "INVESTIGATE",
            },
        });
    }

    if (canUndo) {
        actions.push({ id: "undo", label: undoLabel ? `UNDO: ${undoLabel}` : "UNDO LAST CHANGE" });
    }

    return actions;
}

// A short hint telling the player what usually comes next.
export function getNextStepHint({ phase, timeTracker, truthBulletCount = 0, rosterCount = 0 } = {}) {
    if (phase === PHASES.TRIAL) {
        return "The Class Trial is in session. Use the trial panel to pick a minigame or vote.";
    }
    if (rosterCount === 0) {
        return "No classmates yet. Start a NEW GAME from the title screen, or pick them in the Social tab.";
    }
    if (phase === PHASES.INVESTIGATION) {
        if (truthBulletCount === 0) {
            return "Search rooms and question classmates. Evidence you find becomes Truth Bullets.";
        }
        const noun = truthBulletCount === 1 ? "Truth Bullet" : "Truth Bullets";
        return `You have ${truthBulletCount} ${noun}. Keep looking, or start the Class Trial when you're ready.`;
    }
    if (phase === PHASES.NIGHT) {
        const next = Math.max(1, Number(timeTracker?.day) || 1) + 1;
        return `It's nighttime. Talk to anyone still awake, or Sleep to start Day ${next}.`;
    }
    if (timeTracker?.dayActionUsed) {
        return "Spend time with your classmates. Sleep once night falls.";
    }
    return "Free time: hang out with classmates to build trust, or Pass Time when you're done.";
}

export function snapshotPhaseState({ timeTracker, investigationUnderway = false } = {}) {
    return {
        timeTracker: {
            day: Math.max(1, Number(timeTracker?.day) || 1),
            phase: timeTracker?.phase === "night" ? "night" : "day",
            dayActionUsed: Boolean(timeTracker?.dayActionUsed),
        },
        investigationUnderway: Boolean(investigationUnderway),
    };
}

// A short stack of earlier phase states, so any phase change can be undone.
export function createPhaseHistory({ limit = 10 } = {}) {
    const entries = [];

    return {
        push(snapshot, label = "") {
            entries.push({ snapshot: snapshotPhaseState(snapshot), label: String(label || "") });
            while (entries.length > limit) entries.shift();
        },
        pop() {
            return entries.pop() || null;
        },
        peek() {
            return entries[entries.length - 1] || null;
        },
        clear() {
            entries.length = 0;
        },
        get size() {
            return entries.length;
        },
    };
}
