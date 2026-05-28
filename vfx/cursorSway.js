// Shared cursor-sway helper used by NSD, MPD, Hangman's Gambit, and Mind Mine.
//
// Tracks the latest mouse position over a container, then on each frame writes
// `translate(x + dx, y + dy)` to the given reticle element where (dx, dy) is a
// small sway offset that alternates between two horizontal patterns:
//   Phase A: a horizontal "infinity" (lemniscate) — smooth sin/sin·2 Lissajous.
//   Phase B: a horizontal "8" with a different rhythm — sin·2/cos Lissajous.
//
// Patterns cycle every `phaseDurMs` (default 4s each → 8s loop).
//
// When `forwardEvents: true`, click / dblclick / contextmenu / pointerdown events
// inside the container are captured at the capture phase, swallowed, and a
// synthetic copy is dispatched on whatever element sits at the swayed reticle
// position. This means the visible reticle is the "real" cursor: with the
// container's native cursor hidden (CSS `cursor: none`), the player sees only
// the swaying reticle and clicks land where it points, not where the OS mouse is.

const DEFAULT_AMPLITUDE   = 9;
const DEFAULT_PHASE_DUR_MS = 4000;

// Only click-like events are forwarded — mouse-move / pointer-move are left alone
// so we don't have to re-synthesise the high-frequency move stream.
const FORWARDED_EVENTS = ["click", "dblclick", "contextmenu"];

export function attachCursorSway(reticleEl, container, options = {}) {
    if (!reticleEl || !container) return () => {};

    const amplitude     = options.amplitude     ?? DEFAULT_AMPLITUDE;
    const phaseDurMs    = options.phaseDurMs    ?? DEFAULT_PHASE_DUR_MS;
    const forwardEvents = options.forwardEvents ?? true;
    const onFrame       = typeof options.onFrame === "function" ? options.onFrame : null;

    let lastX = window.innerWidth  / 2;
    let lastY = window.innerHeight / 2;
    let currentX = lastX;
    let currentY = lastY;
    let rafId = null;
    const startMs = performance.now();

    function calcSway(elapsed) {
        const totalCycle = phaseDurMs * 2;
        const cyclePos   = ((elapsed % totalCycle) + totalCycle) % totalCycle;
        if (cyclePos < phaseDurMs) {
            // Phase A — horizontal ∞ (Lissajous 1:2)
            const t = (cyclePos / phaseDurMs) * Math.PI * 2;
            return { dx: amplitude * Math.sin(t), dy: amplitude * 0.45 * Math.sin(2 * t) };
        }
        // Phase B — horizontal "8" (different Lissajous rhythm)
        const t = ((cyclePos - phaseDurMs) / phaseDurMs) * Math.PI * 2;
        return { dx: amplitude * 0.75 * Math.sin(2 * t), dy: amplitude * 0.55 * Math.cos(t) };
    }

    function onMove(e) {
        lastX = e.clientX;
        lastY = e.clientY;
    }
    container.addEventListener("mousemove", onMove);

    function tick(ms) {
        const sway = calcSway(ms - startMs);
        currentX = lastX + sway.dx;
        currentY = lastY + sway.dy;
        reticleEl.style.transform = `translate(${currentX}px, ${currentY}px) translate(-50%, -50%)`;
        if (onFrame) onFrame(currentX, currentY, lastX, lastY);
        rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    // ── Event forwarding ─────────────────────────────────────────────────
    const SWAY_FLAG = "__danganSwayForwarded__";

    function forwardedHandler(e) {
        if (e[SWAY_FLAG]) return;             // ignore our own re-dispatches
        // The reticle has pointer-events: none, but elementFromPoint walks the
        // full hit-test stack so we'll get the underlying interactive element.
        const target = document.elementFromPoint(currentX, currentY);
        if (!target) return;

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();

        const EventCtor = (typeof PointerEvent !== "undefined" && e instanceof PointerEvent) ? PointerEvent : MouseEvent;
        const init = {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: currentX,
            clientY: currentY,
            screenX: currentX,
            screenY: currentY,
            button:  e.button  ?? 0,
            buttons: e.buttons ?? 0,
            ctrlKey:  e.ctrlKey  || false,
            shiftKey: e.shiftKey || false,
            altKey:   e.altKey   || false,
            metaKey:  e.metaKey  || false,
            pointerType: e.pointerType || "mouse",
        };
        const synthetic = new EventCtor(e.type, init);
        synthetic[SWAY_FLAG] = true;
        target.dispatchEvent(synthetic);
    }

    if (forwardEvents) {
        for (const type of FORWARDED_EVENTS) {
            container.addEventListener(type, forwardedHandler, true);
        }
    }

    function getPosition() {
        return { x: currentX, y: currentY, rawX: lastX, rawY: lastY };
    }

    function detach() {
        if (rafId != null) cancelAnimationFrame(rafId);
        container.removeEventListener("mousemove", onMove);
        if (forwardEvents) {
            for (const type of FORWARDED_EVENTS) {
                container.removeEventListener(type, forwardedHandler, true);
            }
        }
    }

    // Allow callers (NSD/MPD absorb logic) to read the current swayed position
    // without having to wire up their own onFrame callback.
    detach.getPosition = getPosition;

    return detach;
}
