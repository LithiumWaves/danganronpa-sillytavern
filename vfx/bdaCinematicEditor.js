const OVERLAY_ID = "bda-cinematic-editor-overlay";
const SEGMENT_COLORS = ["#c34455", "#3a8a5a", "#3468aa", "#a07030", "#6444a8", "#8a3030", "#338888", "#884488"];

function escHtml(s) {
    return String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
function genId() { return Math.random().toString(36).slice(2, 10); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/**
 * Resolve a CSS background-image url() string for a partial background file name.
 * Checks .bg_example elements in the DOM, falling back to constructing a path from bgfile.
 */
function getBgCssUrl(bgFile) {
    if (!bgFile) return null;
    const lower = bgFile.toLowerCase();
    const match = Array.from(document.querySelectorAll(".bg_example"))
        .find(el => el.getAttribute("bgfile")?.toLowerCase().includes(lower));
    if (!match) return null;

    // jQuery stores the resolved url() in .data('url') — check the HTML data attribute first,
    // then walk the bg_example_img child's computed style, then construct manually.
    const dataUrl = match.dataset?.url || match.getAttribute("data-url");
    if (dataUrl) return dataUrl;

    const imgEl = match.querySelector(".bg_example_img");
    if (imgEl) {
        const computed = window.getComputedStyle(imgEl).backgroundImage;
        if (computed && computed !== "none") return computed;
    }

    // Fallback: construct from bgfile attribute
    const bgfile = match.getAttribute("bgfile") || "";
    const isCustom = match.getAttribute("custom") === "true";
    return isCustom
        ? `url("${bgfile}")`
        : `url("backgrounds/${encodeURIComponent(bgfile)}")`;
}

export function createBdaCinematicEditor({ extensionFolderPath, getCinematics, saveCinematics }) {
    let isOpen = false;
    let cinematics = [];
    let activeCinId = null;
    let selectedPinId = null;
    let selectedSegId = null;
    let timelineDurationMs = 10000;
    let dragging = null;
    let selectedGapId = null; // "leftPinId|rightPinId"
    let timelineZoom = 1; // 1–4
    let previewAudio = null;
    let previewRaf = null;
    let previewPosition = 0; // 0..1, persists across play/stop for scrubbing

    // ── Data ─────────────────────────────────────────────────────────────────

    function getCin() { return cinematics.find(c => c.id === activeCinId) ?? null; }

    function makeNewCin(name = "New Cinematic") {
        return { id: genId(), name, bgSegments: [], pins: [] };
    }

    function loadTimelineDuration() {
        return new Promise(resolve => {
            const audio = new Audio(`${extensionFolderPath}/assets/sfx/etc/despairnoise.mp3`);
            const done = ms => { timelineDurationMs = Math.max(1000, ms); renderTimelineDuration(); resolve(timelineDurationMs); };
            audio.addEventListener("loadedmetadata", () => done(Math.round(audio.duration * 1000)), { once: true });
            audio.addEventListener("error", () => done(10000), { once: true });
            setTimeout(() => done(timelineDurationMs), 5000);
        });
    }

    // ── Overlay accessor ─────────────────────────────────────────────────────

    function getOverlay() { return document.getElementById(OVERLAY_ID); }

    // ── Targeted render helpers ───────────────────────────────────────────────

    function renderCinSelectOptions() {
        const overlay = getOverlay();
        if (!overlay) return;
        const cinSelect = overlay.querySelector("#bda-cin-select");
        if (!cinSelect) return;
        cinSelect.innerHTML = cinematics.length
            ? cinematics.map(c => `<option value="${escHtml(c.id)}" ${c.id === activeCinId ? "selected" : ""}>${escHtml(c.name || "(unnamed)")}</option>`).join("")
            : `<option value="">— no cinematics —</option>`;
    }

    function renderToolbarState() {
        const overlay = getOverlay();
        if (!overlay) return;
        const cin = getCin();
        overlay.querySelector("#bda-cin-name").value = cin?.name ?? "";
        overlay.querySelectorAll(".bda-cin-requires").forEach(el => { el.disabled = !cin; });
    }

    /**
     * Returns the segment that should be "active" in the CG preview given
     * the current selection state, or null if none applies.
     */
    function resolveActiveSeg(cin) {
        if (!cin) return null;

        if (selectedSegId) {
            return cin.bgSegments.find(s => s.id === selectedSegId) ?? null;
        }
        if (selectedPinId) {
            const pin = cin.pins.find(p => p.id === selectedPinId);
            if (pin != null) {
                return cin.bgSegments
                    .filter(s => s.startFrac <= pin.timeFrac && s.endFrac >= pin.timeFrac)
                    .sort((a, b) => b.startFrac - a.startFrac)[0] ?? null;
            }
        }
        return cin.bgSegments.find(s => s.bgFile) ?? null;
    }

    /**
     * Returns the segment that covers a given time fraction (0..1),
     * sorted so the latest-starting covering segment wins.
     */
    function segAtFrac(cin, frac) {
        if (!cin) return null;
        return [...cin.bgSegments]
            .sort((a, b) => b.startFrac - a.startFrac)
            .find(s => s.startFrac <= frac) ?? null;
    }

    /** Returns the segment that covers pin.timeFrac (latest-starting wins). */
    function getSegmentForPin(cin, pin) {
        if (!cin || !pin) return null;
        return [...cin.bgSegments]
            .sort((a, b) => b.startFrac - a.startFrac)
            .find(s => s.startFrac <= pin.timeFrac && s.endFrac >= pin.timeFrac) ?? null;
    }

    /** Returns the sorted index (by startFrac) of a segment, for color lookup. */
    function getSegmentColorIndex(cin, seg) {
        if (!cin || !seg) return 0;
        const sorted = [...cin.bgSegments].sort((a, b) => a.startFrac - b.startFrac);
        const idx = sorted.findIndex(s => s.id === seg.id);
        return idx >= 0 ? idx : 0;
    }

    /** Returns the first pin whose focus window covers the given fraction. */
    function pinAtFrac(cin, frac) {
        if (!cin) return null;
        for (const pin of cin.pins) {
            const endFrac = pin.timeFrac + (pin.focusDurationMs ?? 800) / timelineDurationMs;
            if (frac >= pin.timeFrac && frac <= endFrac) return pin;
        }
        return null;
    }

    /**
     * Apply a zoom/pan CSS transform to the bg layer element for the given pin.
     * progressInFocus is 0..1 (position within the pin's focus window).
     * If pin.connectTo is set the camera transitions from pin A → pin B along
     * a direct line or a smooth quadratic-bezier arc.
     */
    function applyPinAnimation(pin, bgEl, progressInFocus) {
        if (!bgEl) return;
        const t = clamp(progressInFocus, 0, 1);

        if (pin.connectTo) {
            const cin = getCin();
            const pinB = cin?.pins.find(p => p.id === pin.connectTo);
            if (pinB) {
                // Interpolate position along chosen path
                let interpX, interpY;
                if ((pin.pathType ?? "direct") === "smooth") {
                    // Same quadratic bezier control point as the drawn path
                    const mx = (pin.xFrac + pinB.xFrac) / 2;
                    const my = (pin.yFrac + pinB.yFrac) / 2;
                    const dx = pinB.xFrac - pin.xFrac;
                    const dy = pinB.yFrac - pin.yFrac;
                    const len = Math.sqrt(dx * dx + dy * dy) || 0.001;
                    const offset = len * 0.35;
                    const cpx = mx + (-dy / len) * offset;
                    const cpy = my + ( dx / len) * offset;
                    interpX = (1-t)*(1-t)*pin.xFrac + 2*(1-t)*t*cpx + t*t*pinB.xFrac;
                    interpY = (1-t)*(1-t)*pin.yFrac + 2*(1-t)*t*cpy + t*t*pinB.yFrac;
                } else {
                    interpX = pin.xFrac + (pinB.xFrac - pin.xFrac) * t;
                    interpY = pin.yFrac + (pinB.yFrac - pin.yFrac) * t;
                }
                // Zoom follows pin A's own Zoom from → Zoom to (not pinB's zoom)
                const scaleA = pin.baseZoom ?? 1.0;
                const scaleB = pin.zoom ?? 1.3;
                const scale = scaleA + (scaleB - scaleA) * t;
                const tx = (0.5 - interpX) * 100;
                const ty = (0.5 - interpY) * 100;
                bgEl.style.transform = `scale(${scale.toFixed(3)}) translate(${tx.toFixed(2)}%, ${ty.toFixed(2)}%)`;
                return;
            }
        }

        // Unconnected pin: hold camera at pin's position, only zoom changes
        const baseZoom = pin.baseZoom ?? 1.0;
        const zoom = pin.zoom ?? 1.3;
        const scale = baseZoom + (zoom - baseZoom) * t;
        const tx = (0.5 - pin.xFrac) * 100;
        const ty = (0.5 - pin.yFrac) * 100;
        bgEl.style.transform = `scale(${scale.toFixed(3)}) translate(${tx.toFixed(2)}%, ${ty.toFixed(2)}%)`;
    }

    function resolveCgPreviewBg(cin) {
        const seg = resolveActiveSeg(cin);
        if (seg?.bgFile) return getBgCssUrl(seg.bgFile);

        // Last resort: mirror whatever bg1 is currently showing
        const bg1 = document.getElementById("bg1");
        if (bg1) {
            const current = window.getComputedStyle(bg1).backgroundImage;
            if (current && current !== "none") return current;
        }
        return null;
    }

    /**
     * Apply image effects (filter, hue-shift, colorize) to the CG preview
     * based on the given segment (or clear effects if seg is null).
     */
    function applyCgEffects(seg) {
        const bgEl = document.querySelector("#bda-cg-preview .bda-cg-bg");
        const colorizeEl = document.getElementById("bda-cg-colorize");
        if (!bgEl) return;

        if (!seg) {
            bgEl.style.filter = "";
            if (colorizeEl) { colorizeEl.style.background = ""; colorizeEl.style.opacity = "0"; }
            return;
        }

        // CSS filter: hue-rotate + grayscale/sepia
        const filters = [];
        const hue = seg.hueShift ?? 0;
        if (hue !== 0) filters.push(`hue-rotate(${hue}deg)`);
        if (seg.imgFilter === "grayscale") filters.push("grayscale(1)");
        else if (seg.imgFilter === "sepia") filters.push("sepia(1)");
        bgEl.style.filter = filters.join(" ");

        // Color tint overlay
        if (colorizeEl) {
            const color = seg.colorize || "";
            const opacity = seg.colorizeOpacity ?? 0.4;
            if (color) {
                colorizeEl.style.background = color;
                colorizeEl.style.opacity = String(opacity);
            } else {
                colorizeEl.style.background = "";
                colorizeEl.style.opacity = "0";
            }
        }
    }

    /**
     * After moving/resizing a segment, cascade-push overlapping neighbours
     * away from the moved segment so no two segments overlap.
     */
    function resolvePush(cin, movedSegId) {
        const segs = cin.bgSegments.slice().sort((a, b) => a.startFrac - b.startFrac);
        const movedIdx = segs.findIndex(s => s.id === movedSegId);
        if (movedIdx === -1) return;

        const minWidth = 0.02;

        // Push right neighbours
        for (let i = movedIdx + 1; i < segs.length; i++) {
            const prev = segs[i - 1];
            const cur  = segs[i];
            if (cur.startFrac < prev.endFrac) {
                const w = cur.endFrac - cur.startFrac;
                cur.startFrac = prev.endFrac;
                cur.endFrac   = Math.min(1, cur.startFrac + w);
                if (cur.endFrac - cur.startFrac < minWidth) cur.endFrac = Math.min(1, cur.startFrac + minWidth);
            }
        }

        // Push left neighbours
        for (let i = movedIdx - 1; i >= 0; i--) {
            const next = segs[i + 1];
            const cur  = segs[i];
            if (cur.endFrac > next.startFrac) {
                const w = cur.endFrac - cur.startFrac;
                cur.endFrac   = next.startFrac;
                cur.startFrac = Math.max(0, cur.endFrac - w);
                if (cur.endFrac - cur.startFrac < minWidth) cur.startFrac = Math.max(0, cur.endFrac - minWidth);
            }
        }

        // Write resolved positions back
        for (const seg of segs) {
            const orig = cin.bgSegments.find(s => s.id === seg.id);
            if (orig) { orig.startFrac = seg.startFrac; orig.endFrac = seg.endFrac; }
        }
    }

    function renderCgPreview() {
        const overlay = getOverlay();
        if (!overlay) return;
        const preview = overlay.querySelector("#bda-cg-preview");
        if (!preview) return;
        preview.querySelectorAll(".bda-pin").forEach(el => el.remove());
        preview.querySelector(".bda-pin-connections")?.remove();

        const cin = getCin();
        const activeSeg = cin ? resolveActiveSeg(cin) : null;
        const bgEl = preview.querySelector(".bda-cg-bg");

        const bgUrl = resolveCgPreviewBg(cin);
        if (bgEl) {
            bgEl.style.backgroundImage = bgUrl || "";
            bgEl.style.transform = ""; // reset any preview animation transform
        }

        applyCgEffects(activeSeg);

        if (!cin) return;

        // Build set of visible pins (filtered by active segment)
        const visiblePins = cin.pins.filter(pin => {
            const pinSeg = getSegmentForPin(cin, pin);
            return !activeSeg || pinSeg?.id === activeSeg.id;
        });
        const visiblePinIds = new Set(visiblePins.map(p => p.id));

        // ── SVG connection paths ─────────────────────────────────────────────
        // viewBox 0 0 100 100 with preserveAspectRatio="none" maps directly to
        // pin percentage positions (xFrac*100, yFrac*100)
        const NS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(NS, "svg");
        svg.setAttribute("class", "bda-pin-connections");
        svg.setAttribute("viewBox", "0 0 100 100");
        svg.setAttribute("preserveAspectRatio", "none");

        for (const pinA of visiblePins) {
            if (!pinA.connectTo || !visiblePinIds.has(pinA.connectTo)) continue;
            const pinB = cin.pins.find(p => p.id === pinA.connectTo);
            if (!pinB) continue;

            const x1 = pinA.xFrac * 100;
            const y1 = pinA.yFrac * 100;
            const x2 = pinB.xFrac * 100;
            const y2 = pinB.yFrac * 100;
            const colorIdx = getSegmentColorIndex(cin, getSegmentForPin(cin, pinA));
            const color = SEGMENT_COLORS[colorIdx % SEGMENT_COLORS.length];
            const isSmooth = (pinA.pathType ?? "direct") === "smooth";

            let pathEl;
            if (isSmooth) {
                const mx = (x1 + x2) / 2;
                const my = (y1 + y2) / 2;
                const dx = x2 - x1;
                const dy = y2 - y1;
                const len = Math.sqrt(dx * dx + dy * dy) || 0.001;
                const offset = len * 0.35;
                // Control point: perpendicular to the line at the midpoint
                const cpx = mx + (-dy / len) * offset;
                const cpy = my + ( dx / len) * offset;
                pathEl = document.createElementNS(NS, "path");
                pathEl.setAttribute("d", `M${x1},${y1} Q${cpx.toFixed(2)},${cpy.toFixed(2)} ${x2},${y2}`);
                pathEl.setAttribute("fill", "none");
            } else {
                pathEl = document.createElementNS(NS, "line");
                pathEl.setAttribute("x1", x1);
                pathEl.setAttribute("y1", y1);
                pathEl.setAttribute("x2", x2);
                pathEl.setAttribute("y2", y2);
            }
            pathEl.setAttribute("stroke", color);
            pathEl.setAttribute("stroke-width", "1.2");
            pathEl.setAttribute("stroke-opacity", "0.8");
            pathEl.setAttribute("stroke-dasharray", "2.5 2");
            svg.appendChild(pathEl);

            // Small filled circle at pin B end to indicate direction
            const dot = document.createElementNS(NS, "circle");
            dot.setAttribute("cx", x2);
            dot.setAttribute("cy", y2);
            dot.setAttribute("r", "1.8");
            dot.setAttribute("fill", color);
            dot.setAttribute("fill-opacity", "0.85");
            svg.appendChild(dot);
        }

        // Insert SVG before the vignette so it's overlaid by the vignette darkening
        const vignetteEl = preview.querySelector(".bda-cg-vignette");
        if (vignetteEl) {
            preview.insertBefore(svg, vignetteEl);
        } else {
            preview.appendChild(svg);
        }

        // ── Pin dots ────────────────────────────────────────────────────────
        for (const pin of visiblePins) {
            const pinSeg = getSegmentForPin(cin, pin);
            const colorIdx = getSegmentColorIndex(cin, pinSeg);
            const color = SEGMENT_COLORS[colorIdx % SEGMENT_COLORS.length];

            const el = document.createElement("div");
            el.className = `bda-pin${pin.id === selectedPinId ? " selected" : ""}`;
            el.dataset.pinId = pin.id;
            el.textContent = String(pin.num ?? "?").slice(0, 3);
            el.style.left = `${clamp(pin.xFrac * 100, 0, 94)}%`;
            el.style.top = `${clamp(pin.yFrac * 100, 0, 90)}%`;
            el.style.background = color;
            preview.appendChild(el);
        }
    }

    function renderTimeline() {
        const overlay = getOverlay();
        if (!overlay) return;
        const tl = overlay.querySelector("#bda-timeline");
        if (!tl) return;
        tl.innerHTML = "";

        const cin = getCin();
        if (!cin) {
            const placeholder = document.createElement("div");
            placeholder.className = "bda-tl-empty";
            placeholder.textContent = "No cinematic selected.";
            tl.appendChild(placeholder);
            return;
        }

        // Inner scrollable content — width expands with zoom
        const inner = document.createElement("div");
        inner.className = "bda-tl-inner";
        inner.style.width = `${timelineZoom * 100}%`;

        // Duration tick marks — more granular at higher zoom
        const ticks = document.createElement("div");
        ticks.className = "bda-tl-ticks";
        const niceIntervals = [50, 100, 200, 250, 500, 1000, 2000, 5000];
        const targetTicks = Math.round(20 * timelineZoom);
        const rawInterval = timelineDurationMs / targetTicks;
        const interval = niceIntervals.reduce((best, v) =>
            Math.abs(v - rawInterval) < Math.abs(best - rawInterval) ? v : best
        );
        const tickCount = Math.floor(timelineDurationMs / interval);
        for (let i = 0; i <= tickCount; i++) {
            const frac = (i * interval) / timelineDurationMs;
            const t = document.createElement("div");
            t.className = "bda-tl-tick";
            t.style.left = `${frac * 100}%`;
            const lbl = document.createElement("span");
            lbl.textContent = `${(i * interval / 1000).toFixed(interval < 1000 ? 2 : 1)}s`;
            t.appendChild(lbl);
            ticks.appendChild(t);
        }
        inner.appendChild(ticks);

        // BG segment row
        const segRow = document.createElement("div");
        segRow.className = "bda-tl-row bda-tl-segs";
        segRow.dataset.rowType = "segs";

        for (let i = 0; i < cin.bgSegments.length; i++) {
            const seg = cin.bgSegments[i];
            const color = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
            const el = document.createElement("div");
            el.className = `bda-tl-seg${seg.id === selectedSegId ? " selected" : ""}`;
            el.dataset.segId = seg.id;
            el.style.left = `${seg.startFrac * 100}%`;
            el.style.width = `${Math.max(0.02, seg.endFrac - seg.startFrac) * 100}%`;
            el.style.background = color;
            el.innerHTML = `
                <div class="bda-tl-seg-handle" data-seg-id="${seg.id}" data-handle="left"></div>
                <div class="bda-tl-seg-label">${escHtml(seg.bgFile || "?")}</div>
                <div class="bda-tl-seg-handle" data-seg-id="${seg.id}" data-handle="right"></div>
            `;
            segRow.appendChild(el);
        }
        inner.appendChild(segRow);

        // Pins row
        const pinRow = document.createElement("div");
        pinRow.className = "bda-tl-row bda-tl-pins";
        pinRow.dataset.rowType = "pins";

        // Gap areas rendered first so pins sit on top in DOM order.
        // Position uses CSS calc(max(22px, durPct%)) to exactly match the visual
        // right-edge of the left pin (which uses max(22px, ...) for min-width),
        // so the pink zone always fills the truly empty space between pins.
        const sortedPinsForGaps = [...cin.pins].sort((a, b) => a.timeFrac - b.timeFrac);
        for (let i = 0; i < sortedPinsForGaps.length - 1; i++) {
            const left = sortedPinsForGaps[i];
            const right = sortedPinsForGaps[i + 1];
            if (right.timeFrac <= left.timeFrac) continue; // right pin is behind left — no space
            const leftTimePct  = (left.timeFrac * 100).toFixed(4);
            const leftDurPct   = ((left.focusDurationMs ?? 800) / timelineDurationMs * 100).toFixed(4);
            const rightTimePct = (right.timeFrac * 100).toFixed(4);
            const gapId = `${left.id}|${right.id}`;
            const gapEl = document.createElement("div");
            gapEl.className = `bda-tl-gap${selectedGapId === gapId ? " selected" : ""}`;
            gapEl.dataset.gapId = gapId;
            gapEl.dataset.leftPinId = left.id;
            gapEl.dataset.rightPinId = right.id;
            // left = visual right-edge of the left pin (same formula as the pin's width)
            gapEl.style.left  = `calc(${leftTimePct}% + max(22px, ${leftDurPct}%))`;
            // right = distance from the container's right edge to the start of the right pin
            gapEl.style.right = `calc(100% - ${rightTimePct}%)`;
            gapEl.style.width = ""; // let left+right define the size
            gapEl.title = "Null gap — select and press Delete to close";
            pinRow.appendChild(gapEl);
        }

        for (const pin of cin.pins) {
            const pinSeg = getSegmentForPin(cin, pin);
            const colorIdx = getSegmentColorIndex(cin, pinSeg);
            const color = SEGMENT_COLORS[colorIdx % SEGMENT_COLORS.length];
            const durFrac = (pin.focusDurationMs ?? 800) / timelineDurationMs;

            const el = document.createElement("div");
            el.className = `bda-tl-pin${pin.id === selectedPinId ? " selected" : ""}`;
            el.dataset.pinId = pin.id;
            el.style.left = `${pin.timeFrac * 100}%`;
            el.style.width = `max(22px, ${durFrac * 100}%)`;
            el.style.background = color;
            el.title = `Pin #${pin.num} (${pin.focusDurationMs ?? 800}ms)`;
            el.innerHTML = `
                <span class="bda-tl-pin-num">${escHtml(String(pin.num ?? "").slice(0, 2))}</span>
                <div class="bda-tl-pin-dur-handle" data-pin-id="${pin.id}"></div>
            `;
            pinRow.appendChild(el);
        }
        inner.appendChild(pinRow);

        // Ticker — always visible when a cinematic is loaded; draggable to scrub
        const ticker = document.createElement("div");
        ticker.id = "bda-ticker";
        ticker.className = "bda-ticker";
        ticker.style.left = `${previewPosition * 100}%`;
        inner.appendChild(ticker);

        tl.appendChild(inner);
    }

    function renderTimelineDuration() {
        const overlay = getOverlay();
        if (!overlay) return;
        const lbl = overlay.querySelector("#bda-tl-duration-label");
        if (lbl) lbl.textContent = `BDA SFX: ${(timelineDurationMs / 1000).toFixed(1)}s`;
    }

    function renderPinSettings() {
        const overlay = getOverlay();
        if (!overlay) return;
        const panel = overlay.querySelector("#bda-pin-settings");
        if (!panel) return;

        const cin = getCin();
        const pin = cin?.pins.find(p => p.id === selectedPinId) ?? null;

        if (!pin) {
            panel.innerHTML = `<div class="bda-settings-empty">Select a pin to edit its properties.</div>`;
            return;
        }

        const otherPins = cin?.pins.filter(p => p.id !== pin.id) ?? [];
        const hasConnection = !!pin.connectTo;

        panel.innerHTML = `
            <div class="bda-settings-title">PIN #${pin.num}</div>
            <div class="bda-settings-row">
                <label class="bda-lbl">Duration</label>
                <input type="number" id="bda-pin-focus" min="100" max="120000" step="100" value="${pin.focusDurationMs ?? 800}" class="bda-input">
                <span class="bda-unit">ms</span>
            </div>
            <div class="bda-settings-row">
                <label class="bda-lbl">Zoom from:</label>
                <input type="number" id="bda-pin-base-zoom" min="1.0" max="100" step="0.1" value="${(pin.baseZoom ?? 1.0).toFixed(1)}" class="bda-input">
                <span class="bda-unit">×</span>
            </div>
            <div class="bda-settings-row">
                <label class="bda-lbl">Zoom to:</label>
                <input type="number" id="bda-pin-zoom" min="1.0" max="100" step="0.1" value="${(pin.zoom ?? 1.3).toFixed(1)}" class="bda-input">
                <span class="bda-unit">×</span>
            </div>
            <div class="bda-settings-row">
                <label class="bda-lbl">Time</label>
                <input type="number" id="bda-pin-time" min="0" max="${timelineDurationMs}" step="100" value="${Math.round((pin.timeFrac ?? 0) * timelineDurationMs)}" class="bda-input">
                <span class="bda-unit">ms</span>
            </div>
            <div class="bda-settings-divider"></div>
            <div class="bda-settings-row">
                <label class="bda-lbl">Shake</label>
                <input type="range" id="bda-pin-shake" min="0" max="1" step="0.05" value="${pin.shake ?? 0}" class="bda-range">
                <span id="bda-pin-shake-val" class="bda-unit bda-unit-val">${(pin.shake ?? 0).toFixed(2)}</span>
            </div>
            <div class="bda-settings-row">
                <label class="bda-lbl">Static</label>
                <input type="range" id="bda-pin-static" min="0" max="1" step="0.05" value="${pin.staticOpacity ?? 0}" class="bda-range">
                <span id="bda-pin-static-val" class="bda-unit bda-unit-val">${(pin.staticOpacity ?? 0).toFixed(2)}</span>
            </div>
            ${otherPins.length > 0 ? `
            <div class="bda-settings-divider"></div>
            <div class="bda-settings-row">
                <label class="bda-lbl">Connect to</label>
                <select id="bda-pin-connect" class="bda-select">
                    <option value="">— none —</option>
                    ${otherPins.map(p => `<option value="${escHtml(p.id)}" ${pin.connectTo === p.id ? "selected" : ""}>Pin #${escHtml(String(p.num))}</option>`).join("")}
                </select>
            </div>
            <div class="bda-settings-row" id="bda-pin-pathtype-row" ${hasConnection ? "" : 'style="display:none"'}>
                <label class="bda-lbl">Path</label>
                <select id="bda-pin-pathtype" class="bda-select">
                    <option value="direct" ${(pin.pathType ?? "direct") === "direct" ? "selected" : ""}>Direct</option>
                    <option value="smooth" ${pin.pathType === "smooth" ? "selected" : ""}>Smooth arc</option>
                </select>
            </div>
            ` : ""}
            <div class="bda-settings-row" style="margin-top:6px">
                <button type="button" id="bda-pin-delete" class="bda-btn bda-btn-danger" style="width:100%">DELETE PIN</button>
            </div>
        `;

        panel.querySelector("#bda-pin-focus")?.addEventListener("input", e => {
            const p = getCin()?.pins.find(x => x.id === pin.id);
            if (p) p.focusDurationMs = Math.max(100, Number(e.target.value) || 800);
        });
        panel.querySelector("#bda-pin-base-zoom")?.addEventListener("input", e => {
            const p = getCin()?.pins.find(x => x.id === pin.id);
            if (p) p.baseZoom = clamp(Number(e.target.value) || 1.0, 1, 100);
        });
        panel.querySelector("#bda-pin-zoom")?.addEventListener("input", e => {
            const p = getCin()?.pins.find(x => x.id === pin.id);
            if (p) p.zoom = clamp(Number(e.target.value) || 1.3, 1, 100);
        });
        panel.querySelector("#bda-pin-time")?.addEventListener("input", e => {
            const p = getCin()?.pins.find(x => x.id === pin.id);
            if (p) {
                p.timeFrac = clamp(Number(e.target.value) / timelineDurationMs, 0, 1);
                renderTimeline();
            }
        });
        panel.querySelector("#bda-pin-shake")?.addEventListener("input", e => {
            const p = getCin()?.pins.find(x => x.id === pin.id);
            if (p) { p.shake = Number(e.target.value); panel.querySelector("#bda-pin-shake-val").textContent = p.shake.toFixed(2); }
        });
        panel.querySelector("#bda-pin-static")?.addEventListener("input", e => {
            const p = getCin()?.pins.find(x => x.id === pin.id);
            if (p) { p.staticOpacity = Number(e.target.value); panel.querySelector("#bda-pin-static-val").textContent = p.staticOpacity.toFixed(2); }
        });

        panel.querySelector("#bda-pin-connect")?.addEventListener("change", e => {
            const p = getCin()?.pins.find(x => x.id === pin.id);
            if (!p) return;
            p.connectTo = e.target.value || null;
            if (!p.connectTo) p.pathType = undefined;
            // Show/hide path type row
            const row = panel.querySelector("#bda-pin-pathtype-row");
            if (row) row.style.display = p.connectTo ? "" : "none";
            renderCgPreview();
            renderTimeline();
        });

        panel.querySelector("#bda-pin-pathtype")?.addEventListener("change", e => {
            const p = getCin()?.pins.find(x => x.id === pin.id);
            if (p) {
                p.pathType = e.target.value;
                renderCgPreview();
            }
        });

        panel.querySelector("#bda-pin-delete")?.addEventListener("click", () => {
            const c = getCin();
            if (!c) return;
            // Clear any connections TO this pin before removing it
            c.pins.forEach(p => { if (p.connectTo === pin.id) p.connectTo = null; });
            c.pins = c.pins.filter(x => x.id !== pin.id);
            selectedPinId = null;
            renderCgPreview();
            renderTimeline();
            renderPinSettings();
            renderToolbarState();
        });
    }

    function renderSegSettings() {
        const overlay = getOverlay();
        if (!overlay) return;
        const panel = overlay.querySelector("#bda-seg-settings");
        if (!panel) return;

        const cin = getCin();
        const seg = cin?.bgSegments.find(s => s.id === selectedSegId) ?? null;

        if (!seg) {
            panel.innerHTML = `<div class="bda-settings-empty">Select a BG segment to edit its properties.</div>`;
            return;
        }

        const colorizeColor = seg.colorize || "#ff0000";
        const colorizeOpacity = (seg.colorizeOpacity ?? 0.4).toFixed(2);
        const hasColorize = !!seg.colorize;

        panel.innerHTML = `
            <div class="bda-settings-title">BG SEGMENT</div>
            <div class="bda-settings-row">
                <label class="bda-lbl">Background</label>
                <input type="text" id="bda-seg-bg" placeholder="partial name match" value="${escHtml(seg.bgFile || "")}" class="bda-input bda-input-wide">
            </div>
            <div class="bda-settings-row">
                <label class="bda-lbl">Fade In</label>
                <input type="number" id="bda-seg-fadein" min="0" max="5000" step="50" value="${seg.fadeIn ?? 200}" class="bda-input">
                <span class="bda-unit">ms</span>
            </div>
            <div class="bda-settings-row">
                <label class="bda-lbl">Fade Out</label>
                <input type="number" id="bda-seg-fadeout" min="0" max="5000" step="50" value="${seg.fadeOut ?? 200}" class="bda-input">
                <span class="bda-unit">ms</span>
            </div>
            <div class="bda-settings-divider"></div>
            <div class="bda-settings-row">
                <label class="bda-lbl">Hue Shift</label>
                <input type="range" id="bda-seg-hue" min="-180" max="180" step="1" value="${seg.hueShift ?? 0}" class="bda-range">
                <span id="bda-seg-hue-val" class="bda-unit bda-unit-val">${(seg.hueShift ?? 0)}°</span>
            </div>
            <div class="bda-settings-row">
                <label class="bda-lbl">Filter</label>
                <select id="bda-seg-filter" class="bda-select">
                    <option value="none" ${!seg.imgFilter || seg.imgFilter === "none" ? "selected" : ""}>None</option>
                    <option value="grayscale" ${seg.imgFilter === "grayscale" ? "selected" : ""}>Grayscale</option>
                    <option value="sepia" ${seg.imgFilter === "sepia" ? "selected" : ""}>Sepia</option>
                </select>
            </div>
            <div class="bda-settings-divider"></div>
            <div class="bda-settings-row">
                <label class="bda-lbl">Colorize</label>
                <input type="color" id="bda-seg-colorize-color" value="${escHtml(colorizeColor)}" class="bda-color-input">
                <input type="range" id="bda-seg-colorize-opacity" min="0" max="1" step="0.05" value="${hasColorize ? colorizeOpacity : 0}" class="bda-range" style="flex:1">
                <span id="bda-seg-colorize-val" class="bda-unit bda-unit-val">${hasColorize ? colorizeOpacity : "0.00"}</span>
            </div>
            <div class="bda-settings-row" style="margin-top:6px">
                <button type="button" id="bda-seg-delete" class="bda-btn bda-btn-danger" style="width:100%">DELETE SEGMENT</button>
            </div>
        `;

        panel.querySelector("#bda-seg-bg")?.addEventListener("input", e => {
            const s = getCin()?.bgSegments.find(x => x.id === seg.id);
            if (s) { s.bgFile = e.target.value; renderTimeline(); renderCgPreview(); }
        });
        panel.querySelector("#bda-seg-fadein")?.addEventListener("input", e => {
            const s = getCin()?.bgSegments.find(x => x.id === seg.id);
            if (s) s.fadeIn = Math.max(0, Number(e.target.value) || 0);
        });
        panel.querySelector("#bda-seg-fadeout")?.addEventListener("input", e => {
            const s = getCin()?.bgSegments.find(x => x.id === seg.id);
            if (s) s.fadeOut = Math.max(0, Number(e.target.value) || 0);
        });
        panel.querySelector("#bda-seg-hue")?.addEventListener("input", e => {
            const s = getCin()?.bgSegments.find(x => x.id === seg.id);
            if (s) {
                s.hueShift = Number(e.target.value);
                panel.querySelector("#bda-seg-hue-val").textContent = `${s.hueShift}°`;
                applyCgEffects(s);
            }
        });
        panel.querySelector("#bda-seg-filter")?.addEventListener("change", e => {
            const s = getCin()?.bgSegments.find(x => x.id === seg.id);
            if (s) { s.imgFilter = e.target.value === "none" ? undefined : e.target.value; applyCgEffects(s); }
        });
        const syncColorize = () => {
            const s = getCin()?.bgSegments.find(x => x.id === seg.id);
            if (!s) return;
            const color = panel.querySelector("#bda-seg-colorize-color")?.value || "";
            const opacity = Number(panel.querySelector("#bda-seg-colorize-opacity")?.value ?? 0);
            s.colorize = opacity > 0 ? color : "";
            s.colorizeOpacity = opacity;
            panel.querySelector("#bda-seg-colorize-val").textContent = opacity.toFixed(2);
            applyCgEffects(s);
        };
        panel.querySelector("#bda-seg-colorize-color")?.addEventListener("input", syncColorize);
        panel.querySelector("#bda-seg-colorize-opacity")?.addEventListener("input", syncColorize);
        panel.querySelector("#bda-seg-delete")?.addEventListener("click", () => {
            const c = getCin();
            if (!c) return;
            c.bgSegments = c.bgSegments.filter(x => x.id !== seg.id);
            selectedSegId = null;
            renderTimeline();
            renderSegSettings();
            renderToolbarState();
        });
    }

    function renderAll() {
        renderCinSelectOptions();
        renderToolbarState();
        renderCgPreview();
        renderTimeline();
        renderTimelineDuration();
        renderPinSettings();
        renderSegSettings();
    }

    // ── Preview playback ──────────────────────────────────────────────────────

    function setTickerPosition(frac) {
        previewPosition = clamp(frac, 0, 1);
        const ticker = document.getElementById("bda-ticker");
        if (ticker) ticker.style.left = `${previewPosition * 100}%`;
        // Auto-scroll to keep ticker visible when zoomed in
        if (timelineZoom > 1) {
            const tlEl = document.getElementById("bda-timeline");
            if (tlEl) {
                const innerPx = tlEl.clientWidth * timelineZoom;
                const tickerPx = previewPosition * innerPx;
                const margin = tlEl.clientWidth * 0.15;
                if (tickerPx < tlEl.scrollLeft + margin || tickerPx > tlEl.scrollLeft + tlEl.clientWidth - margin) {
                    tlEl.scrollLeft = tickerPx - tlEl.clientWidth / 2;
                }
            }
        }
    }

    function updatePreviewPlayBtn(playing) {
        const btn = document.getElementById("bda-preview-play");
        if (!btn) return;
        btn.classList.toggle("playing", playing);
        btn.title = playing ? "Stop preview" : "Preview BDA cinematic";
        btn.innerHTML = playing
            ? `<svg viewBox="0 0 14 14" width="12" height="12" fill="currentColor"><rect x="2" y="1" width="4" height="12"/><rect x="8" y="1" width="4" height="12"/></svg>`
            : `<svg viewBox="0 0 14 14" width="12" height="12" fill="currentColor"><polygon points="2,1 12,7 2,13"/></svg>`;
    }

    function stopPreview() {
        if (previewRaf) { cancelAnimationFrame(previewRaf); previewRaf = null; }
        if (previewAudio) { previewAudio.pause(); previewAudio = null; }

        updatePreviewPlayBtn(false);
        const bgEl = document.querySelector("#bda-cg-preview .bda-cg-bg");
        if (bgEl) { bgEl.style.transform = ""; bgEl.style.opacity = ""; bgEl.style.animation = ""; }
        const staticEl = document.getElementById("bda-cg-static");
        if (staticEl) staticEl.style.opacity = "0";
        applyCgEffects(null); // clear filter/colorize
        renderCgPreview(); // restore selection-based BG
    }

    function startPreview() {
        if (previewAudio) { stopPreview(); return; }

        const cin = getCin();
        if (!cin) return;

        const audio = new Audio(`${extensionFolderPath}/assets/sfx/etc/despairnoise.mp3`);
        audio.volume = 0.5;
        previewAudio = audio;

        audio.addEventListener("ended", () => {
            setTickerPosition(0);
            // Smooth-scroll the timeline back to the start (mirrors camera zoom-out at BDA end)
            const tlEl = document.getElementById("bda-timeline");
            if (tlEl && tlEl.scrollLeft > 0) tlEl.scrollTo({ left: 0, behavior: "smooth" });
            stopPreview();
        }, { once: true });
        audio.addEventListener("error", stopPreview, { once: true });

        // Seek to current scrub position before playing
        const startFrom = previewPosition;
        audio.addEventListener("loadedmetadata", () => {
            if (startFrom > 0 && Number.isFinite(audio.duration)) {
                audio.currentTime = startFrom * audio.duration;
            }
        }, { once: true });

        audio.play().catch(stopPreview);
        updatePreviewPlayBtn(true);

        // Track last state to avoid redundant DOM updates
        let lastAppliedBg = null;
        let lastAppliedSegId = null;
        let lastAppliedPinId = null;

        function tick() {
            if (!previewAudio || previewAudio.paused || previewAudio.ended) return;

            const duration = Number.isFinite(audio.duration) && audio.duration > 0
                ? audio.duration
                : timelineDurationMs / 1000;
            const frac = audio.currentTime / duration;

            setTickerPosition(frac);

            const activeSeg = segAtFrac(cin, frac);
            const bgFile = activeSeg?.bgFile || null;
            const preview = document.getElementById("bda-cg-preview");
            const bgEl = preview?.querySelector(".bda-cg-bg");

            // BG image switch on segment change
            if (bgFile !== lastAppliedBg) {
                lastAppliedBg = bgFile;
                if (bgEl) {
                    const cssUrl = bgFile ? getBgCssUrl(bgFile) : null;
                    bgEl.style.backgroundImage = cssUrl || "";
                }
            }

            // Segment-level effects (filter, hue, colorize) on segment change
            if (activeSeg?.id !== lastAppliedSegId) {
                lastAppliedSegId = activeSeg?.id ?? null;
                applyCgEffects(activeSeg);
            }

            // Fade in / fade out — computed every frame from position within segment
            if (bgEl && activeSeg) {
                const elapsed   = (frac - activeSeg.startFrac) * duration;
                const remaining = (activeSeg.endFrac - frac) * duration;
                const fadeInSec  = (activeSeg.fadeIn  ?? 0) / 1000;
                const fadeOutSec = (activeSeg.fadeOut ?? 0) / 1000;
                let opacity = 1;
                if (fadeInSec  > 0 && elapsed   < fadeInSec)  opacity = Math.min(opacity, elapsed / fadeInSec);
                if (fadeOutSec > 0 && remaining < fadeOutSec) opacity = Math.min(opacity, remaining / fadeOutSec);
                bgEl.style.opacity = String(clamp(opacity, 0, 1));
            } else if (bgEl) {
                bgEl.style.opacity = "1";
            }

            // Pin zoom/pan
            const activePin = pinAtFrac(cin, frac);
            if (activePin?.id !== lastAppliedPinId) {
                lastAppliedPinId = activePin?.id ?? null;
            }

            if (activePin && bgEl) {
                const pinEndFrac = activePin.timeFrac + (activePin.focusDurationMs ?? 800) / timelineDurationMs;
                const progressInFocus = clamp(
                    (frac - activePin.timeFrac) / Math.max(0.001, pinEndFrac - activePin.timeFrac), 0, 1
                );
                applyPinAnimation(activePin, bgEl, progressInFocus);
            } else if (bgEl) {
                bgEl.style.transform = "";
            }

            // Shake
            if (bgEl) {
                const shakeAmt = activePin?.shake ?? 0;
                if (shakeAmt > 0) {
                    const speed = Math.round(40 + (1 - shakeAmt) * 60);
                    bgEl.style.animation = `bda-shake ${speed}ms steps(4, end) infinite`;
                } else {
                    bgEl.style.animation = "";
                }
            }

            // Static opacity
            const staticEl = document.getElementById("bda-cg-static");
            if (staticEl) {
                staticEl.style.opacity = String(activePin?.staticOpacity ?? 0);
            }

            previewRaf = requestAnimationFrame(tick);
        }

        previewRaf = requestAnimationFrame(tick);
    }

    // ── Drag: CG preview ─────────────────────────────────────────────────────

    function onCgPointerDown(e) {
        const preview = e.currentTarget;
        const pinEl = e.target.closest(".bda-pin");
        if (pinEl) {
            const pinId = pinEl.dataset.pinId;
            selectedPinId = pinId;
            selectedSegId = null;
            selectedGapId = null;
            dragging = { type: "pin-cg", pinId };
            preview.setPointerCapture(e.pointerId);
            e.preventDefault();
            renderCgPreview();
            renderPinSettings();
            renderSegSettings();
            renderTimeline();
            return;
        }
        // Deselect
        selectedPinId = null;
        selectedSegId = null;
        selectedGapId = null;
        renderCgPreview();
        renderPinSettings();
        renderSegSettings();
        renderTimeline();
    }

    function onCgPointerMove(e) {
        if (!dragging || dragging.type !== "pin-cg") return;
        const preview = e.currentTarget;
        const rect = preview.getBoundingClientRect();
        const pin = getCin()?.pins.find(p => p.id === dragging.pinId);
        if (pin) {
            pin.xFrac = clamp((e.clientX - rect.left) / rect.width, 0, 1);
            pin.yFrac = clamp((e.clientY - rect.top) / rect.height, 0, 1);
            renderCgPreview();
        }
    }

    function onCgPointerUp() {
        if (dragging?.type === "pin-cg") dragging = null;
    }

    // ── Drag: timeline ───────────────────────────────────────────────────────

    function onTlPointerDown(e) {
        const tl = e.currentTarget;
        const rect = tl.getBoundingClientRect();
        const frac = clamp((e.clientX - rect.left + tl.scrollLeft) / (rect.width * timelineZoom), 0, 1);

        // Ticker drag — highest priority, checked before segments/pins
        if (e.target.closest(".bda-ticker")) {
            dragging = { type: "ticker" };
            tl.setPointerCapture(e.pointerId);
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        const handle = e.target.closest(".bda-tl-seg-handle");
        if (handle) {
            const segId = handle.dataset.segId;
            const side = handle.dataset.handle;
            selectedSegId = segId;
            selectedPinId = null;
            selectedGapId = null;
            dragging = { type: side === "left" ? "seg-left" : "seg-right", segId };
            tl.setPointerCapture(e.pointerId);
            e.stopPropagation();
            e.preventDefault();
            renderTimeline();
            renderCgPreview();
            renderSegSettings();
            renderPinSettings();
            return;
        }

        const segEl = e.target.closest(".bda-tl-seg");
        if (segEl) {
            const segId = segEl.dataset.segId;
            const cin = getCin();
            const seg = cin?.bgSegments.find(s => s.id === segId);
            if (seg) {
                selectedSegId = segId;
                selectedPinId = null;
                selectedGapId = null;
                dragging = { type: "seg-move", segId, startFrac: frac, segStartFrac: seg.startFrac, segEndFrac: seg.endFrac };
                tl.setPointerCapture(e.pointerId);
                e.preventDefault();
                renderTimeline();
                renderCgPreview();
                renderSegSettings();
                renderPinSettings();
                return;
            }
        }

        const pinDurHandle = e.target.closest(".bda-tl-pin-dur-handle");
        if (pinDurHandle) {
            const pinId = pinDurHandle.dataset.pinId;
            selectedPinId = pinId;
            selectedSegId = null;
            selectedGapId = null;
            dragging = { type: "pin-dur", pinId };
            tl.setPointerCapture(e.pointerId);
            e.preventDefault();
            e.stopPropagation();
            renderTimeline();
            renderCgPreview();
            renderPinSettings();
            renderSegSettings();
            return;
        }

        const pinEl = e.target.closest(".bda-tl-pin");
        if (pinEl) {
            const pinId = pinEl.dataset.pinId;
            const cin2 = getCin();
            const pin = cin2?.pins.find(p => p.id === pinId);
            selectedPinId = pinId;
            selectedSegId = null;
            selectedGapId = null;
            dragging = { type: "pin-timeline", pinId, startFrac: frac, pinTimeFracAtStart: pin?.timeFrac ?? frac };
            tl.setPointerCapture(e.pointerId);
            e.preventDefault();
            renderTimeline();
            renderCgPreview();
            renderPinSettings();
            renderSegSettings();
            return;
        }

        const gapEl = e.target.closest(".bda-tl-gap");
        if (gapEl) {
            selectedGapId = gapEl.dataset.gapId;
            selectedPinId = null;
            selectedSegId = null;
            renderTimeline();
            renderPinSettings();
            renderSegSettings();
            e.preventDefault();
            return;
        }

        selectedSegId = null;
        selectedPinId = null;
        selectedGapId = null;
        renderTimeline();
        renderCgPreview();
        renderPinSettings();
        renderSegSettings();
    }

    function onTlPointerMove(e) {
        if (!dragging) return;
        const tl = e.currentTarget;
        const rect = tl.getBoundingClientRect();
        const frac = clamp((e.clientX - rect.left + tl.scrollLeft) / (rect.width * timelineZoom), 0, 1);
        const cin = getCin();
        if (!cin) return;

        if (dragging.type === "ticker") {
            setTickerPosition(frac);
            if (previewAudio && Number.isFinite(previewAudio.duration)) {
                previewAudio.currentTime = frac * previewAudio.duration;
            }
            const activeSeg = segAtFrac(cin, frac);
            const preview = document.getElementById("bda-cg-preview");
            const bgEl = preview?.querySelector(".bda-cg-bg");
            if (bgEl) {
                const cssUrl = activeSeg?.bgFile ? getBgCssUrl(activeSeg.bgFile) : null;
                bgEl.style.backgroundImage = cssUrl || resolveCgPreviewBg(cin) || "";
                // Fade opacity at scrub position
                if (activeSeg) {
                    const dur = previewAudio && Number.isFinite(previewAudio.duration)
                        ? previewAudio.duration
                        : timelineDurationMs / 1000;
                    const elapsed   = (frac - activeSeg.startFrac) * dur;
                    const remaining = (activeSeg.endFrac - frac) * dur;
                    const fadeInSec  = (activeSeg.fadeIn  ?? 0) / 1000;
                    const fadeOutSec = (activeSeg.fadeOut ?? 0) / 1000;
                    let opacity = 1;
                    if (fadeInSec  > 0 && elapsed   < fadeInSec)  opacity = Math.min(opacity, elapsed / fadeInSec);
                    if (fadeOutSec > 0 && remaining < fadeOutSec) opacity = Math.min(opacity, remaining / fadeOutSec);
                    bgEl.style.opacity = String(clamp(opacity, 0, 1));
                } else {
                    bgEl.style.opacity = "1";
                }
                // Apply pin animation when scrubbing
                const activePin = pinAtFrac(cin, frac);
                if (activePin) {
                    const pinEndFrac = activePin.timeFrac + (activePin.focusDurationMs ?? 800) / timelineDurationMs;
                    const progressInFocus = clamp(
                        (frac - activePin.timeFrac) / Math.max(0.001, pinEndFrac - activePin.timeFrac), 0, 1
                    );
                    applyPinAnimation(activePin, bgEl, progressInFocus);
                } else {
                    bgEl.style.transform = "";
                }
            }
            applyCgEffects(activeSeg);
            return;
        }

        if (dragging.type === "pin-dur") {
            const pin = cin.pins.find(p => p.id === dragging.pinId);
            if (pin) {
                const endFrac = clamp(frac, pin.timeFrac + 0.005, 1);
                pin.focusDurationMs = Math.max(100, Math.round((endFrac - pin.timeFrac) * timelineDurationMs));
                const focusInput = document.querySelector("#bda-pin-focus");
                if (focusInput) focusInput.value = pin.focusDurationMs;
                renderTimeline();
            }
            return;
        }

        if (dragging.type === "pin-timeline") {
            const pin = cin.pins.find(p => p.id === dragging.pinId);
            if (pin) {
                const delta = frac - dragging.startFrac;
                pin.timeFrac = clamp(dragging.pinTimeFracAtStart + delta, 0, 1);
                const timeInput = document.querySelector("#bda-pin-time");
                if (timeInput) timeInput.value = Math.round(pin.timeFrac * timelineDurationMs);
                renderTimeline();
            }
            return;
        }
        if (dragging.type === "seg-left") {
            const seg = cin.bgSegments.find(s => s.id === dragging.segId);
            if (seg) {
                seg.startFrac = clamp(frac, 0, seg.endFrac - 0.02);
                resolvePush(cin, dragging.segId);
                renderTimeline();
            }
            return;
        }
        if (dragging.type === "seg-right") {
            const seg = cin.bgSegments.find(s => s.id === dragging.segId);
            if (seg) {
                seg.endFrac = clamp(frac, seg.startFrac + 0.02, 1);
                resolvePush(cin, dragging.segId);
                renderTimeline();
            }
            return;
        }
        if (dragging.type === "seg-move") {
            const seg = cin.bgSegments.find(s => s.id === dragging.segId);
            if (seg) {
                const delta = frac - dragging.startFrac;
                const width = dragging.segEndFrac - dragging.segStartFrac;
                seg.startFrac = clamp(dragging.segStartFrac + delta, 0, 1 - width);
                seg.endFrac = seg.startFrac + width;
                resolvePush(cin, dragging.segId);
                renderTimeline();
            }
        }
    }

    function onTlPointerUp() {
        dragging = null;
    }

    // ── Build overlay ────────────────────────────────────────────────────────

    function ensureOverlay() {
        const existing = document.getElementById(OVERLAY_ID);
        if (existing) return existing;

        const overlay = document.createElement("div");
        overlay.id = OVERLAY_ID;
        overlay.className = "bda-editor-overlay";
        overlay.setAttribute("aria-hidden", "true");

        overlay.innerHTML = `
            <div class="bda-editor-window" role="dialog" aria-modal="true" aria-labelledby="bda-editor-title">
                <div class="bda-editor-header">
                    <span id="bda-editor-title" class="bda-editor-title">CONFIGURE DEATHS</span>
                    <button type="button" class="bda-editor-close" id="bda-editor-close" aria-label="Close">✕</button>
                </div>

                <div class="bda-editor-toolbar">
                    <select id="bda-cin-select" class="bda-select bda-select-wide"></select>
                    <button type="button" id="bda-cin-new" class="bda-btn">+ NEW</button>
                    <button type="button" id="bda-cin-delete" class="bda-btn bda-btn-danger bda-cin-requires" disabled>DELETE</button>
                    <span class="bda-toolbar-spacer"></span>
                    <label class="bda-toolbar-label" for="bda-cin-name">Name:</label>
                    <input type="text" id="bda-cin-name" class="bda-input bda-cin-requires" placeholder="Cinematic name" disabled>
                </div>

                <div class="bda-editor-body">
                    <div class="bda-editor-col bda-col-cg">
                        <div class="bda-col-title">CG PREVIEW <span class="bda-col-hint">drag pins to reposition</span></div>
                        <div id="bda-cg-preview" class="bda-cg-preview">
                            <div class="bda-cg-bg"></div>
                            <div id="bda-cg-colorize" class="bda-cg-colorize"></div>
                            <div class="bda-cg-vignette"></div>
                            <div class="bda-cg-bda-noise"></div>
                            <div id="bda-cg-static" class="bda-cg-static" style="opacity:0"></div>
                        </div>
                        <div class="bda-cg-actions">
                            <button type="button" id="bda-add-pin" class="bda-btn bda-cin-requires" disabled>+ ADD PIN</button>
                        </div>
                    </div>
                    <div class="bda-editor-col bda-col-pins">
                        <div class="bda-col-title">PIN SETTINGS</div>
                        <div id="bda-pin-settings" class="bda-settings-panel">
                            <div class="bda-settings-empty">Select a pin to edit.</div>
                        </div>
                    </div>
                </div>

                <div class="bda-timeline-section">
                    <div class="bda-timeline-header">
                        <div class="bda-col-title">TIMELINE <span id="bda-tl-duration-label" class="bda-col-hint"></span></div>
                        <div class="bda-tl-zoom-controls" id="bda-tl-zoom-controls">
                            <span class="bda-tl-zoom-label">ZOOM</span>
                            <button type="button" class="bda-tl-zoom-btn active" data-zoom="1">1×</button>
                            <button type="button" class="bda-tl-zoom-btn" data-zoom="2">2×</button>
                            <button type="button" class="bda-tl-zoom-btn" data-zoom="3">3×</button>
                            <button type="button" class="bda-tl-zoom-btn" data-zoom="4">4×</button>
                        </div>
                        <button type="button" id="bda-preview-play" class="bda-preview-play-btn bda-cin-requires" disabled title="Preview BDA cinematic">
                            <svg viewBox="0 0 14 14" width="12" height="12" fill="currentColor"><polygon points="2,1 12,7 2,13"/></svg>
                        </button>
                    </div>
                    <div id="bda-timeline" class="bda-timeline"></div>
                    <div class="bda-timeline-actions">
                        <button type="button" id="bda-add-seg" class="bda-btn bda-cin-requires" disabled>+ ADD BG SEGMENT</button>
                        <span class="bda-col-hint" style="margin-left:8px">drag segment body to move · drag edges to resize</span>
                    </div>
                </div>

                <div class="bda-seg-section">
                    <div class="bda-col-title">BACKGROUND SEGMENT SETTINGS</div>
                    <div id="bda-seg-settings" class="bda-settings-panel bda-seg-settings-panel">
                        <div class="bda-settings-empty">Select a BG segment to edit.</div>
                    </div>
                </div>

                <div class="bda-editor-footer">
                    <div class="bda-footer-note">Triggered via <code>/body-discovered name=&lt;cinematic name&gt;</code></div>
                    <div class="bda-footer-actions">
                        <button type="button" id="bda-save" class="bda-btn bda-btn-primary">SAVE</button>
                        <button type="button" id="bda-cancel" class="bda-btn">CLOSE</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        bindStaticEvents(overlay);
        return overlay;
    }

    function bindStaticEvents(overlay) {
        overlay.querySelector("#bda-editor-close")?.addEventListener("click", close);
        overlay.querySelector("#bda-cancel")?.addEventListener("click", close);
        overlay.addEventListener("click", e => { if (e.target === overlay) close(); });

        overlay.querySelector("#bda-cin-new")?.addEventListener("click", () => {
            const c = makeNewCin("New Cinematic");
            cinematics.push(c);
            activeCinId = c.id;
            selectedPinId = null;
            selectedSegId = null;
            renderAll();
        });

        overlay.querySelector("#bda-cin-delete")?.addEventListener("click", () => {
            if (!activeCinId) return;
            cinematics = cinematics.filter(c => c.id !== activeCinId);
            activeCinId = cinematics.length ? cinematics[cinematics.length - 1].id : null;
            selectedPinId = null;
            selectedSegId = null;
            renderAll();
        });

        overlay.querySelector("#bda-cin-select")?.addEventListener("change", e => {
            activeCinId = e.target.value || null;
            selectedPinId = null;
            selectedSegId = null;
            renderAll();
        });

        overlay.querySelector("#bda-cin-name")?.addEventListener("input", e => {
            const c = getCin();
            if (!c) return;
            c.name = e.target.value;
            const opt = overlay.querySelector(`#bda-cin-select option[value="${c.id}"]`);
            if (opt) opt.textContent = c.name || "(unnamed)";
        });

        overlay.querySelector("#bda-add-pin")?.addEventListener("click", () => {
            const c = getCin();
            if (!c) return;
            const maxNum = c.pins.length ? Math.max(...c.pins.map(p => p.num ?? 0)) : 0;
            const pin = {
                id: genId(), num: maxNum + 1,
                xFrac: 0.5, yFrac: 0.5, timeFrac: 0.5,
                focusDurationMs: 800, zoom: 1.3, zoomDirection: "in",
            };
            c.pins.push(pin);
            selectedPinId = pin.id;
            selectedSegId = null;
            renderCgPreview();
            renderTimeline();
            renderPinSettings();
            renderSegSettings();
            renderToolbarState();
        });

        overlay.querySelector("#bda-add-seg")?.addEventListener("click", () => {
            const c = getCin();
            if (!c) return;
            const lastEnd = c.bgSegments.length ? Math.max(...c.bgSegments.map(s => s.endFrac)) : 0;
            const startFrac = Math.min(lastEnd, 0.95);
            const endFrac = Math.min(startFrac + 0.35, 1);
            const seg = { id: genId(), bgFile: "", startFrac, endFrac, fadeIn: 200, fadeOut: 200 };
            c.bgSegments.push(seg);
            selectedSegId = seg.id;
            selectedPinId = null;
            renderTimeline();
            renderSegSettings();
            renderPinSettings();
            renderToolbarState();
        });

        overlay.querySelector("#bda-tl-zoom-controls")?.addEventListener("click", e => {
            const btn = e.target.closest(".bda-tl-zoom-btn");
            if (!btn) return;
            const z = Number(btn.dataset.zoom);
            if (!z) return;
            const tlEl = overlay.querySelector("#bda-timeline");
            // Preserve the center fraction so the view re-centres after zoom
            const centerFrac = tlEl
                ? (tlEl.scrollLeft + tlEl.clientWidth / 2) / (tlEl.clientWidth * timelineZoom)
                : 0.5;
            timelineZoom = z;
            renderTimeline();
            // Restore scroll so the same region stays centred
            if (tlEl) tlEl.scrollLeft = centerFrac * tlEl.clientWidth * timelineZoom - tlEl.clientWidth / 2;
            overlay.querySelectorAll(".bda-tl-zoom-btn").forEach(b => b.classList.toggle("active", Number(b.dataset.zoom) === timelineZoom));
        });

        overlay.querySelector("#bda-save")?.addEventListener("click", () => {
            saveCinematics([...cinematics]);
        });

        overlay.querySelector("#bda-preview-play")?.addEventListener("click", () => {
            if (previewAudio) stopPreview(); else startPreview();
        });

        // CG pointer events
        const preview = overlay.querySelector("#bda-cg-preview");
        if (preview) {
            preview.addEventListener("pointerdown", onCgPointerDown);
            preview.addEventListener("pointermove", onCgPointerMove);
            preview.addEventListener("pointerup", onCgPointerUp);
            preview.addEventListener("pointercancel", onCgPointerUp);
        }

        // Timeline pointer events
        const timeline = overlay.querySelector("#bda-timeline");
        if (timeline) {
            timeline.addEventListener("pointerdown", onTlPointerDown);
            timeline.addEventListener("pointermove", onTlPointerMove);
            timeline.addEventListener("pointerup", onTlPointerUp);
            timeline.addEventListener("pointercancel", onTlPointerUp);
        }
    }

    function onKeydown(e) {
        if (e.key === "Escape" && isOpen) close();
        if (e.key === "Delete" && selectedGapId && isOpen) {
            const cin = getCin();
            if (cin) {
                const [leftId, rightId] = selectedGapId.split("|");
                const leftPin = cin.pins.find(p => p.id === leftId);
                const rightPin = cin.pins.find(p => p.id === rightId);
                if (leftPin && rightPin) {
                    rightPin.timeFrac = clamp(
                        leftPin.timeFrac + (leftPin.focusDurationMs ?? 800) / timelineDurationMs,
                        0, 1
                    );
                }
            }
            selectedGapId = null;
            renderTimeline();
            renderPinSettings();
            renderSegSettings();
            e.preventDefault();
        }
    }

    // ── Open / close ─────────────────────────────────────────────────────────

    async function open() {
        if (isOpen) return;
        isOpen = true;

        cinematics = structuredClone(getCinematics() || []);
        activeCinId = cinematics.length ? cinematics[0].id : null;
        selectedPinId = null;
        selectedSegId = null;
        selectedGapId = null;
        dragging = null;

        const overlay = ensureOverlay();
        overlay.setAttribute("aria-hidden", "false");
        overlay.classList.add("active");
        document.addEventListener("keydown", onKeydown);

        loadTimelineDuration().then(() => renderAll());
        renderAll();
    }

    function close() {
        if (!isOpen) return;
        isOpen = false;
        dragging = null;
        stopPreview();

        // Reset zoom to 1× and sync button state before hiding
        timelineZoom = 1;
        const overlay = getOverlay();
        if (overlay) {
            overlay.querySelectorAll(".bda-tl-zoom-btn").forEach(b =>
                b.classList.toggle("active", b.dataset.zoom === "1")
            );
            const tlEl = overlay.querySelector("#bda-timeline");
            if (tlEl) tlEl.scrollLeft = 0;
            overlay.classList.remove("active");
            overlay.setAttribute("aria-hidden", "true");
        }
        document.removeEventListener("keydown", onKeydown);
    }

    return { open, close };
}
