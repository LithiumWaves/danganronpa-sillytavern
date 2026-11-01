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
export function getPhaseActions({ phase, timeTracker, canUndo = false, undoLabel = "", caseOpen = false, caseCancellable = false, flashbackHeld = false, finalTrialReady = false } = {}) {
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

    // A motive starts the chapter's murder plot; one at a time.
    if ((phase === PHASES.DAY || phase === PHASES.NIGHT) && !caseOpen) {
        actions.push({
            id: "motive",
            label: "MONOKUMA'S MOTIVE",
            confirm: {
                title: "MONOKUMA'S MOTIVE",
                message: "Have Monokuma announce a motive now? Behind the scenes, someone starts planning a murder.",
                confirmLabel: "ANNOUNCE",
            },
        });
    }

    // Until the murder, the motive can be edited (no spoilers) or taken back.
    if ((phase === PHASES.DAY || phase === PHASES.NIGHT) && caseCancellable) {
        actions.push({ id: "edit-motive", label: "EDIT MOTIVE" });
        actions.push({
            id: "cancel-motive",
            label: "CANCEL MOTIVE",
            confirm: {
                title: "CANCEL MOTIVE",
                message: "Have Monokuma take the motive back? The planned murder is cancelled.",
                confirmLabel: "CANCEL IT",
            },
        });
    }

    if (phase === PHASES.DAY || phase === PHASES.NIGHT) {
        actions.push({ id: "plan-event", label: "PLAN EVENT" });
        if (flashbackHeld) actions.push({ id: "flashback", label: "USE FLASHBACK LIGHT" });
        // The mysteries' end: the final trial names the mastermind.
        if (finalTrialReady) {
            actions.push({
                id: "final-trial",
                label: "START FINAL TRIAL",
                confirm: {
                    title: "THE FINAL TRIAL",
                    message: "Gather everyone for the final trial? There's no victim this time: the trial is about the truth of this killing game, and the vote names the mastermind.",
                    confirmLabel: "BEGIN",
                },
            });
        }
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
export function getNextStepHint({ phase, timeTracker, truthBulletCount = 0, rosterCount = 0, motive = null } = {}) {
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
    if (motive?.title && (phase === PHASES.DAY || phase === PHASES.NIGHT)) {
        const day = Math.max(1, Number(timeTracker?.day) || 1);
        const due = Number(motive.deadlineDay) || day;
        if (due < day) return `Monokuma's motive: ${motive.title}. Its deadline has passed.`;
        const when = due === day ? "tonight" : `the night of Day ${due}`;
        return `Monokuma's motive: ${motive.title}. The deadline is ${when}.`;
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
        // `extra` holds anything else the change touched (e.g. the case
        // file a murder updated), handed back as-is on undo.
        push(snapshot, label = "", extra = null) {
            entries.push({ snapshot: snapshotPhaseState(snapshot), label: String(label || ""), extra });
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
