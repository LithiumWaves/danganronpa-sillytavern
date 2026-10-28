import { PHASES, createPhaseHistory, derivePhase, getNextStepHint, getPhaseActions, getStatusLine, snapshotPhaseState } from "./phaseState.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

const ids = (actions) => actions.map((a) => a.id);

function run() {
    const day = { day: 3, phase: "day", dayActionUsed: false };
    const night = { day: 3, phase: "night", dayActionUsed: true };

    assert(derivePhase({ timeTracker: day }) === PHASES.DAY, "day");
    assert(derivePhase({ timeTracker: night }) === PHASES.NIGHT, "night");
    assert(derivePhase({ timeTracker: night, investigationUnderway: true }) === PHASES.INVESTIGATION, "investigation beats time");
    assert(derivePhase({ timeTracker: day, investigationUnderway: true, trialActive: true }) === PHASES.TRIAL, "trial beats investigation");

    assert(getStatusLine({ phase: PHASES.INVESTIGATION, day: 4, chapterLabel: "Chapter 2" }) === "CHAPTER 2 · DAY 4 · INVESTIGATION", "status line");
    assert(getStatusLine({ phase: PHASES.DAY, day: 0 }) === "DAY 1 · DAYTIME", "status line clamps day");

    const inv = getPhaseActions({ phase: PHASES.INVESTIGATION, timeTracker: day });
    assert(ids(inv).includes("end-investigation"), "investigation can be ended");
    assert(inv.find((a) => a.id === "end-investigation").confirm, "ending investigation asks first");
    assert(!ids(inv).includes("pass-time"), "no pass time during investigation");

    const dayActions = getPhaseActions({ phase: PHASES.DAY, timeTracker: { ...day, dayActionUsed: true } });
    assert(dayActions.find((a) => a.id === "pass-time").disabled, "pass time disabled once used");
    assert(ids(dayActions).includes("start-investigation"), "investigation can be started by hand");
    assert(ids(dayActions).includes("plan-event") && !ids(inv).includes("plan-event"), "events are planned in daily life");
    assert(!ids(dayActions).includes("flashback") && ids(getPhaseActions({ phase: PHASES.DAY, timeTracker: day, flashbackHeld: true })).includes("flashback"), "a held Flashback Light can be used");
    assert(getPhaseActions({ phase: PHASES.NIGHT, timeTracker: night, finalTrialReady: true }).find((a) => a.id === "final-trial")?.confirm, "the final trial asks first");

    const nightActions = getPhaseActions({ phase: PHASES.NIGHT, timeTracker: night, canUndo: true, undoLabel: "Pass time" });
    assert(ids(nightActions).includes("sleep"), "sleep at night");
    assert(nightActions.find((a) => a.id === "sleep").confirm.message.includes("Day 4"), "sleep names the next day");
    assert(nightActions.at(-1).label === "UNDO: Pass time", "undo is labelled");
    assert(getPhaseActions({ phase: PHASES.TRIAL }).length === 0, "no phase actions during a trial");

    assert(ids(dayActions).includes("motive") && ids(nightActions).includes("motive"), "a motive can be announced in daily life");
    assert(!ids(getPhaseActions({ phase: PHASES.DAY, timeTracker: day, caseOpen: true })).includes("motive"), "one motive at a time");
    assert(!ids(inv).includes("motive"), "no motive during an investigation");
    assert(getNextStepHint({ phase: PHASES.DAY, timeTracker: day, rosterCount: 5, motive: { title: "Videos", deadlineDay: 5 } }).includes("night of Day 5"), "motive deadline hint");
    assert(getNextStepHint({ phase: PHASES.NIGHT, timeTracker: night, rosterCount: 5, motive: { title: "Videos", deadlineDay: 3 } }).includes("tonight"), "deadline tonight");
    assert(getNextStepHint({ phase: PHASES.DAY, timeTracker: { ...day, day: 6 }, rosterCount: 5, motive: { title: "Videos", deadlineDay: 5 } }).includes("passed"), "deadline passed");

    assert(getNextStepHint({ phase: PHASES.DAY, rosterCount: 0 }).includes("NEW GAME"), "empty roster hint");
    assert(getNextStepHint({ phase: PHASES.INVESTIGATION, rosterCount: 5 }).includes("Search rooms"), "no evidence yet");
    assert(getNextStepHint({ phase: PHASES.INVESTIGATION, rosterCount: 5, truthBulletCount: 1 }).includes("1 Truth Bullet."), "singular bullet");
    assert(getNextStepHint({ phase: PHASES.NIGHT, timeTracker: night, rosterCount: 5 }).includes("Day 4"), "night hint names next day");

    const snap = snapshotPhaseState({ timeTracker: day, investigationUnderway: 1 });
    day.day = 99;
    assert(snap.timeTracker.day === 3 && snap.investigationUnderway === true, "snapshot is a copy");

    const history = createPhaseHistory({ limit: 2 });
    history.push({ timeTracker: { day: 1 } }, "a");
    history.push({ timeTracker: { day: 2 } }, "b");
    history.push({ timeTracker: { day: 3 } }, "c");
    assert(history.size === 2, "history is capped");
    assert(history.peek().label === "c", "peek returns newest");
    assert(history.pop().snapshot.timeTracker.day === 3, "pop returns newest");
    assert(history.pop().label === "b" && history.pop() === null, "oldest dropped, empty returns null");

    const withExtra = createPhaseHistory();
    withExtra.push({ timeTracker: day }, "Sleep", { caseFile: { status: "planned" } });
    assert(withExtra.pop().extra.caseFile.status === "planned", "extra comes back on undo");
    assert(ids(getPhaseActions({ phase: PHASES.NIGHT, timeTracker: night, caseOpen: true, caseCancellable: true })).includes("cancel-motive"), "a planned motive can be cancelled");
    assert(ids(getPhaseActions({ phase: PHASES.DAY, timeTracker: day, caseOpen: true, caseCancellable: true })).includes("edit-motive"), "a planned motive can be edited");
    assert(!ids(getPhaseActions({ phase: PHASES.DAY, timeTracker: day, caseOpen: true })).includes("edit-motive"), "not after the murder");
    assert(!ids(getPhaseActions({ phase: PHASES.DAY, timeTracker: day, caseOpen: true })).includes("cancel-motive"), "not after the murder");
    assert(!ids(getPhaseActions({ phase: PHASES.INVESTIGATION, timeTracker: day, caseCancellable: true })).includes("cancel-motive"), "not during an investigation");
    console.log("phaseState tests passed");
}

run();
