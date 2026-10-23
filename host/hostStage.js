// The host's entrance: like in the games, Monokuma (or whichever host was
// called) pops up from the bottom of the screen and the music switches to his
// theme. A DISMISS button sends every host back down and brings the earlier
// music back.
//
// Music is the caller's business: onFirstEnter runs when the stage goes from
// empty to occupied, onLastLeave when it empties again.

const ENTER_MS = 520;
const LEAVE_MS = 380;

export function createHostStage({
    getSpriteUrl,          // async (name, label) => url | null
    onFirstEnter,          // () => void | Promise<void>
    onLastLeave,           // () => void | Promise<void>
    onChange,              // () => void — who's on stage changed
    playSfx,               // optional () => void, played on entrance
    document: doc = globalThis.document,
} = {}) {
    // name → { el, img }
    const onStage = new Map();
    let root = null;
    let dismissBtn = null;
    let leaving = null;
    let leavingEls = [];

    function finishLeaving() {
        if (leaving) { clearTimeout(leaving); leaving = null; }
        for (const el of leavingEls) el.remove();
        leavingEls = [];
    }

    function ensureRoot() {
        if (root?.isConnected) return root;
        root = doc.createElement("div");
        root.id = "dangan-host-stage";
        root.setAttribute("aria-live", "polite");
        doc.body.appendChild(root);

        dismissBtn = doc.createElement("button");
        dismissBtn.type = "button";
        dismissBtn.id = "dangan-host-dismiss";
        dismissBtn.textContent = "DISMISS";
        dismissBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            void dismiss();
        });
        doc.body.appendChild(dismissBtn);
        return root;
    }

    function updateDismissLabel() {
        if (!dismissBtn) return;
        const names = [...onStage.keys()];
        dismissBtn.title = names.length ? `Send ${names.join(", ")} away` : "";
        dismissBtn.setAttribute("aria-label", dismissBtn.title || "Dismiss");
    }

    function isOnStage(name) {
        const key = String(name || "").toLowerCase().trim();
        return [...onStage.keys()].some((n) => n.toLowerCase().trim() === key);
    }

    function names() {
        return [...onStage.keys()];
    }

    async function enter(name, { expression = "neutral" } = {}) {
        if (!name || isOnStage(name)) return false;
        const wasEmpty = onStage.size === 0;
        ensureRoot();
        finishLeaving();

        const el = doc.createElement("div");
        el.className = "dangan-host";
        el.dataset.name = name;
        const img = doc.createElement("img");
        img.alt = name;
        img.draggable = false;
        el.appendChild(img);
        root.appendChild(el);
        onStage.set(name, { el, img });
        root.classList.add("is-on");
        dismissBtn.classList.add("is-on");
        updateDismissLabel();
        onChange?.();

        let url = null;
        try { url = await getSpriteUrl?.(name, expression); } catch (_) { url = null; }
        if (!onStage.has(name)) return false; // dismissed while loading
        if (url) img.src = url;
        else el.classList.add("is-missing");

        // Two frames so the start position is painted before the slide.
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        el.classList.add("is-in");
        try { playSfx?.(); } catch (_) {}
        if (wasEmpty) {
            try { await onFirstEnter?.(); } catch (e) { console.warn("[Dangan][Host] entrance music failed:", e); }
        }
        return true;
    }

    // Swap a host's sprite, e.g. when their message changes expression.
    function setSprite(name, src) {
        if (!src) return false;
        const key = String(name || "").toLowerCase().trim();
        for (const [n, entry] of onStage) {
            if (n.toLowerCase().trim() !== key) continue;
            if (entry.img.src !== src) entry.img.src = src;
            entry.el.classList.remove("is-missing");
            return true;
        }
        return false;
    }

    // Slide everyone down. `silent` skips the music hand-back (used when a
    // chat or save switch already changes the music).
    async function dismiss({ silent = false } = {}) {
        if (!onStage.size) return false;
        finishLeaving();
        leavingEls = [...onStage.values()].map((e) => e.el);
        onStage.clear();
        for (const el of leavingEls) el.classList.remove("is-in");
        dismissBtn?.classList.remove("is-on");
        updateDismissLabel();
        onChange?.();
        leaving = setTimeout(() => {
            finishLeaving();
            if (!onStage.size) root?.classList.remove("is-on");
        }, LEAVE_MS);
        if (!silent) {
            try { await onLastLeave?.(); } catch (e) { console.warn("[Dangan][Host] music hand-back failed:", e); }
        }
        return true;
    }

    return { enter, dismiss, setSprite, isOnStage, names, ENTER_MS, LEAVE_MS };
}
