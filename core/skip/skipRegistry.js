// Escape to skip. While a non-interactive sequence (an announcement, a body
// discovery, an introduction…) or a minigame is on screen it registers here;
// one Escape handler acts on the most recent entry.
//
// - "sequence" entries are skipped at once: their waits resolve early, so the
//   sequence's own cleanup and its caller's follow-up still run.
// - "minigame" entries back out: `confirm` is asked first (if given), then
//   `skip` aborts the game without saving anything it did.
// - `holdEscape` entries (Non-Stop Debate, Mass Panic, Scrum) already use a
//   held Escape to fast-forward, so only a tap (released within
//   TAP_THRESHOLD_MS) backs out, and the keydown is left for the game.

export const TAP_THRESHOLD_MS = 250;

const stack = [];

// `isActive` (optional) says whether Escape should act right now — e.g. not
// while a debate's intro video is up (any key skips that video instead).
export function pushSkippable({ kind = "sequence", skip, confirm = null, holdEscape = false, isActive = null } = {}) {
    const entry = { kind, skip, confirm, holdEscape, isActive, busy: false };
    stack.push(entry);
    let released = false;
    return function release() {
        if (released) return;
        released = true;
        const idx = stack.indexOf(entry);
        if (idx >= 0) stack.splice(idx, 1);
    };
}

export function getTopSkippable() {
    return stack[stack.length - 1] || null;
}

export function clearSkippables() {
    stack.length = 0;
}

// A token a sequence threads through its waits. After skip(), every pending
// and future wait resolves immediately and onSkip callbacks run (to pause
// audio, finish typewriter text…).
export function createSkipToken() {
    let skipped = false;
    const listeners = new Set();
    const token = {
        get skipped() { return skipped; },
        skip() {
            if (skipped) return;
            skipped = true;
            const pending = [...listeners];
            listeners.clear();
            for (const fn of pending) {
                try { fn(); } catch (e) { console.warn("[Dangan][Skip] onSkip failed:", e); }
            }
        },
        // Runs fn on skip (now, if already skipped). Returns an unsubscribe.
        onSkip(fn) {
            if (skipped) {
                fn();
                return () => {};
            }
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
        // Resolves with the promise, or as soon as the token is skipped.
        race(promise) {
            if (skipped) return Promise.resolve();
            return new Promise((resolve) => {
                let off = () => {};
                const done = (value) => {
                    off();
                    resolve(value);
                };
                off = token.onSkip(() => done());
                Promise.resolve(promise).then(done, () => done());
            });
        },
        delay(ms) {
            if (skipped) return Promise.resolve();
            let timer = null;
            return token.race(new Promise((resolve) => { timer = setTimeout(resolve, ms); }))
                .finally(() => clearTimeout(timer));
        },
    };
    return token;
}

// Runs fn(token) as a skippable sequence.
export async function runSkippableSequence(fn) {
    const token = createSkipToken();
    const release = pushSkippable({ kind: "sequence", skip: () => token.skip() });
    try {
        return await fn(token);
    } finally {
        release();
    }
}

// Minigame sessions. index.js supplies how to snapshot and restore the state
// a minigame can change while it runs (Monocoins, XP…) and how to ask before
// leaving; each minigame calls beginMinigame once it is on screen.
let sessionHooks = {
    snapshot: () => null,
    restore: () => {},
    confirm: () => true,
};

export function configureMinigameSessions(hooks = {}) {
    sessionHooks = { ...sessionHooks, ...hooks };
}

// `abort` tears the game down and settles its run() promise with a "no
// result" value (null), so callers skip their win/lose handling. Returns
// end(), which the game calls when it finishes normally.
export function beginMinigame({ abort, holdEscape = false, isActive = null, label = "THIS MINIGAME" } = {}) {
    let snapshot = null;
    try { snapshot = sessionHooks.snapshot(); } catch (e) { console.warn("[Dangan][Skip] snapshot failed:", e); }
    const release = pushSkippable({
        kind: "minigame",
        holdEscape,
        isActive,
        confirm: () => sessionHooks.confirm(label),
        skip: async () => {
            release();
            try { await abort?.(); } catch (e) { console.warn("[Dangan][Skip] abort failed:", e); }
            try { sessionHooks.restore(snapshot); } catch (e) { console.warn("[Dangan][Skip] restore failed:", e); }
        },
    });
    return release;
}

function isEditable(el) {
    if (!el) return false;
    const tag = String(el.tagName || "").toUpperCase();
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !!el.isContentEditable;
}

async function act(entry) {
    if (!entry || entry.busy) return;
    entry.busy = true;
    try {
        if (entry.kind === "minigame" && typeof entry.confirm === "function") {
            const ok = await entry.confirm();
            if (!ok || !stack.includes(entry)) return;
        }
        await entry.skip?.();
    } catch (e) {
        console.warn("[Dangan][Skip] skip failed:", e);
    } finally {
        entry.busy = false;
    }
}

// Key handling, separate from the DOM so it can be tested.
// `isEscapeOwned()` says another dialog is handling Escape right now.
export function createSkipKeyHandler({ isEscapeOwned = () => false, now = () => Date.now() } = {}) {
    let held = null; // { entry, downAt }

    return {
        onKeyDown(ev) {
            if (ev.key !== "Escape") return false;
            const top = getTopSkippable();
            if (!top || isEditable(ev.target) || isEscapeOwned()) return false;
            if (typeof top.isActive === "function" && !top.isActive()) return false;
            if (top.holdEscape) {
                if (!ev.repeat && !held) held = { entry: top, downAt: now() };
                return false; // the game still sees it, for fast-forward
            }
            if (ev.repeat) return true;
            ev.preventDefault?.();
            ev.stopImmediatePropagation?.();
            act(top);
            return true;
        },
        onKeyUp(ev) {
            if (ev.key !== "Escape" || !held) return false;
            const { entry, downAt } = held;
            held = null;
            if (now() - downAt >= TAP_THRESHOLD_MS) return false;
            if (getTopSkippable() !== entry || isEscapeOwned()) return false;
            act(entry);
            return true;
        },
    };
}

let installed = false;

export function installSkipKeyHandler(options = {}) {
    if (installed || typeof document === "undefined") return;
    installed = true;
    const handler = createSkipKeyHandler(options);
    document.addEventListener("keydown", (ev) => handler.onKeyDown(ev), true);
    document.addEventListener("keyup", (ev) => handler.onKeyUp(ev), true);
}
