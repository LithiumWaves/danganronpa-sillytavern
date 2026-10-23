// Which hosts are on screen. Like in the games, a called-in host (Monokuma,
// Monomi…) pops up from the bottom and stands in the room like any student;
// the overworld and the chat stage draw them, this only tracks who is here,
// when the slide-in should play, and the DISMISS button that sends them away.
//
// Music is the caller's business: onFirstEnter runs when the stage goes from
// empty to occupied, onLastLeave when it empties again.

export const HOST_ENTER_MS = 600;
// A renderer that only gets round to drawing the host this long after they
// were called in skips the slide-up.
const ENTRANCE_GRACE_MS = 5000;
export const HOST_LEAVE_MS = 380;

const keyOf = (name) => String(name || "").toLowerCase().trim();

export function createHostStage({
    onFirstEnter,          // () => void | Promise<void>
    onLastLeave,           // () => void | Promise<void>
    onChange,              // () => void — who's on stage changed; re-render the room
    beforeLeave,           // optional async (names) => void — play the slide-down
    document: doc = globalThis.document,
    now = () => Date.now(),
} = {}) {
    // key → { name, enteredAt, firstDrawn: Map<renderer, ms> }
    const onStage = new Map();
    let dismissBtn = null;
    let dismissing = false;

    function ensureButton() {
        if (dismissBtn?.isConnected) return dismissBtn;
        dismissBtn = doc.createElement("button");
        dismissBtn.type = "button";
        dismissBtn.id = "dangan-host-dismiss";
        dismissBtn.textContent = "DISMISS";
        dismissBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            void dismiss();
        });
        doc.body.appendChild(dismissBtn);
        return dismissBtn;
    }

    function syncButton() {
        const btn = ensureButton();
        const list = names();
        btn.classList.toggle("is-on", list.length > 0);
        btn.title = list.length ? `Send ${list.join(", ")} away` : "";
        btn.setAttribute("aria-label", btn.title || "Dismiss");
    }

    function names() {
        return [...onStage.values()].map((e) => e.name);
    }

    function isOnStage(name) {
        return onStage.has(keyOf(name));
    }

    // How far into the slide-up a renderer drawing this host is, in ms, or
    // null when it's done. Each renderer (overworld, chat stage) times it from
    // its own first draw, and rebuilding the sprite mid-slide carries on from
    // there instead of starting over.
    function entranceElapsed(name, renderer = "default") {
        const entry = onStage.get(keyOf(name));
        if (!entry) return null;
        const t = now();
        let first = entry.firstDrawn.get(renderer);
        if (first == null) {
            if (t - entry.enteredAt > ENTRANCE_GRACE_MS) return null;
            first = t;
            entry.firstDrawn.set(renderer, first);
        }
        const elapsed = t - first;
        return elapsed < HOST_ENTER_MS ? elapsed : null;
    }

    async function enter(name) {
        const key = keyOf(name);
        if (!key || onStage.has(key) || dismissing) return false;
        const wasEmpty = onStage.size === 0;
        onStage.set(key, { name: String(name).trim(), enteredAt: now(), firstDrawn: new Map() });
        syncButton();
        onChange?.();
        if (wasEmpty) {
            try { await onFirstEnter?.(); } catch (e) { console.warn("[Dangan][Host] entrance music failed:", e); }
        }
        return true;
    }

    // Slide everyone down and out of the room. `silent` skips the slide and
    // the music hand-back (used when a chat or save switch changes both).
    async function dismiss({ silent = false } = {}) {
        if (!onStage.size || dismissing) return false;
        const leaving = names();
        if (!silent) {
            dismissing = true;
            try { await beforeLeave?.(leaving); } catch (e) { console.warn("[Dangan][Host] slide-down failed:", e); }
            dismissing = false;
        }
        onStage.clear();
        syncButton();
        onChange?.();
        if (!silent) {
            try { await onLastLeave?.(); } catch (e) { console.warn("[Dangan][Host] music hand-back failed:", e); }
        }
        return true;
    }

    return { enter, dismiss, isOnStage, entranceElapsed, names };
}
