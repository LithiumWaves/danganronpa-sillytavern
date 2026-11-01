import {
    TAP_THRESHOLD_MS,
    beginMinigame,
    clearSkippables,
    configureMinigameSessions,
    createSkipKeyHandler,
    createSkipToken,
    getTopSkippable,
    pushSkippable,
    runSkippableSequence,
} from "./skipRegistry.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

const tick = () => new Promise((r) => setTimeout(r, 0));

function keyEvent(type, extra = {}) {
    return {
        key: "Escape",
        repeat: false,
        target: { tagName: "BODY" },
        defaultPrevented: false,
        stopped: false,
        preventDefault() { this.defaultPrevented = true; },
        stopImmediatePropagation() { this.stopped = true; },
        type,
        ...extra,
    };
}

async function run() {
    // Stack order and release
    clearSkippables();
    const calls = [];
    const r1 = pushSkippable({ skip: () => calls.push("a") });
    const r2 = pushSkippable({ skip: () => calls.push("b") });
    assert(getTopSkippable()?.skip, "has a top entry");
    let now = 0;
    const handler = createSkipKeyHandler({ now: () => now });
    const ev = keyEvent("keydown");
    assert(handler.onKeyDown(ev) === true && ev.stopped && ev.defaultPrevented, "sequence Escape is consumed");
    await tick();
    assert(calls.join() === "b", "acts on the most recent entry");
    r2();
    r2();
    handler.onKeyDown(keyEvent("keydown"));
    await tick();
    assert(calls.join() === "b,a", "release removes only its own entry");
    r1();
    assert(getTopSkippable() === null, "empty after release");
    assert(handler.onKeyDown(keyEvent("keydown")) === false, "nothing to skip leaves Escape alone");

    // Ignored targets, owners, inactive entries
    const r3 = pushSkippable({ skip: () => calls.push("c") });
    assert(handler.onKeyDown(keyEvent("keydown", { target: { tagName: "INPUT" } })) === false, "typing in an input is ignored");
    const owned = createSkipKeyHandler({ isEscapeOwned: () => true });
    assert(owned.onKeyDown(keyEvent("keydown")) === false, "a dialog owning Escape wins");
    assert(handler.onKeyDown(keyEvent("keydown", { key: "Enter" })) === false, "other keys are ignored");
    r3();
    const r4 = pushSkippable({ skip: () => calls.push("d"), isActive: () => false });
    assert(handler.onKeyDown(keyEvent("keydown")) === false, "inactive entries are skipped over");
    r4();

    // Tap vs hold for holdEscape entries
    const holds = [];
    const r5 = pushSkippable({ kind: "minigame", holdEscape: true, skip: () => holds.push("abort") });
    const down = keyEvent("keydown");
    now = 1000;
    assert(handler.onKeyDown(down) === false && !down.stopped, "hold entries leave keydown to the game");
    now = 1000 + TAP_THRESHOLD_MS + 50;
    assert(handler.onKeyUp(keyEvent("keyup")) === false, "a hold does not back out");
    now = 5000;
    handler.onKeyDown(keyEvent("keydown"));
    handler.onKeyDown(keyEvent("keydown", { repeat: true }));
    now = 5000 + TAP_THRESHOLD_MS - 50;
    assert(handler.onKeyUp(keyEvent("keyup")) === true, "a tap backs out");
    await tick();
    assert(holds.join() === "abort", "tap called skip once");
    r5();

    // Skip tokens
    const token = createSkipToken();
    let skippedCb = 0;
    token.onSkip(() => skippedCb++);
    const slow = token.delay(10_000);
    const raced = token.race(new Promise(() => {}));
    token.skip();
    token.skip();
    await slow;
    await raced;
    assert(skippedCb === 1, "onSkip runs once");
    assert(token.skipped, "token reports skipped");
    let late = 0;
    token.onSkip(() => late++);
    assert(late === 1, "onSkip after skip runs at once");
    await token.delay(10_000);

    // runSkippableSequence registers while running
    let seen = null;
    const result = await runSkippableSequence(async (t) => {
        seen = getTopSkippable();
        return t.skipped ? "skipped" : "ran";
    });
    assert(result === "ran" && seen && getTopSkippable() === null, "sequence registers and releases");

    // Minigame sessions: snapshot, confirm, abort, restore
    clearSkippables();
    const log = [];
    configureMinigameSessions({
        snapshot: () => ({ coins: 10 }),
        restore: (snap) => log.push(`restore:${snap.coins}`),
        confirm: async (label) => { log.push(`confirm:${label}`); return confirmAnswer; },
    });
    let confirmAnswer = false;
    const end = beginMinigame({ abort: () => log.push("abort"), label: "Test" });
    handler.onKeyDown(keyEvent("keydown"));
    await tick();
    assert(log.join() === "confirm:Test", "declining the confirm keeps playing");
    confirmAnswer = true;
    handler.onKeyDown(keyEvent("keydown"));
    await tick();
    await tick();
    assert(log.join() === "confirm:Test,confirm:Test,abort,restore:10", "accepting aborts then restores the snapshot");
    assert(getTopSkippable() === null, "session released after abort");
    end();

    const end2 = beginMinigame({ abort: () => log.push("never") });
    end2();
    assert(getTopSkippable() === null, "a finished game releases its session");

    console.log("skipRegistry tests passed");
}

run();
