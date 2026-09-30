const EMPTY_COACHES = Object.freeze({});

export const COACH_IDS = Object.freeze([
    "truth",
    "map",
    "skills",
    "social",
    "chapters",
    "trialPrep",
]);

export function createOnboardingState({ getMonopadSetting, setMonopadSetting }) {
    function getCoachesSeen() {
        const raw = getMonopadSetting("onboardingCoachesSeen");
        return raw && typeof raw === "object" ? { ...raw } : { ...EMPTY_COACHES };
    }

    function setCoachesSeen(next) {
        setMonopadSetting("onboardingCoachesSeen", next && typeof next === "object" ? next : {});
    }

    function isWelcomeSeen() {
        return !!getMonopadSetting("welcomeSeen");
    }

    function markWelcomeSeen() {
        if (!isWelcomeSeen()) setMonopadSetting("welcomeSeen", true);
    }

    function clearWelcomeSeen() {
        if (isWelcomeSeen()) setMonopadSetting("welcomeSeen", false);
    }

    function areFeatureCoachesEnabled() {
        return getMonopadSetting("featureCoachesEnabled") !== false;
    }

    function areMinigameTutorialsEnabled() {
        return getMonopadSetting("minigameTutorialsEnabled") !== false;
    }

    function disableMinigameTutorials() {
        setMonopadSetting("minigameTutorialsEnabled", false);
    }

    function isCoachSeen(id) {
        if (!id) return true;
        return !!getCoachesSeen()[id];
    }

    function markCoachSeen(id) {
        if (!id || isCoachSeen(id)) return;
        const next = getCoachesSeen();
        next[id] = true;
        setCoachesSeen(next);
    }

    function markCoachesSeen(ids = []) {
        const next = getCoachesSeen();
        let changed = false;
        for (const id of ids) {
            if (!id || next[id]) continue;
            next[id] = true;
            changed = true;
        }
        if (changed) setCoachesSeen(next);
    }

    function resetCoaches() {
        setCoachesSeen({});
    }

    return {
        COACH_IDS,
        isWelcomeSeen,
        markWelcomeSeen,
        clearWelcomeSeen,
        areFeatureCoachesEnabled,
        areMinigameTutorialsEnabled,
        disableMinigameTutorials,
        isCoachSeen,
        markCoachSeen,
        markCoachesSeen,
        resetCoaches,
        getCoachesSeen,
    };
}
