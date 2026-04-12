const EXEC_OVERLAY_ID = "exec-cinematic-editor-overlay";
const EXEC_SEGMENT_COLORS = ["#c34455", "#3a8a5a", "#3468aa", "#a07030", "#6444a8", "#8a3030", "#338888", "#884488"];

function execEscHtml(s) {
    return String(s || "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function execGenId() { return Math.random().toString(36).slice(2, 10); }
function execClamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/** Read a File as a base64 data URL. */
function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = () => reject(new Error("FileReader error"));
        reader.readAsDataURL(file);
    });
}

export function createExecutionCinematicEditor({ getCinematics, saveCinematics }) {
    let isOpen = false;
    let cinematics = [];
    let activeCinId = null;
    let selectedPinId = null;
    let selectedSegId = null;
    let timelineDurationMs = 10000;
    let dragging = null;
    let selectedGapId = null;
    let timelineZoom = 1;
    let previewAudio = null;
    let previewRaf = null;
    let previewPosition = 0;

    // ── Data ─────────────────────────────────────────────────────────────────

    function getCin() { return cinematics.find(c => c.id === activeCinId) ?? null; }

    function makeNewCin(name = "New Execution") {
        return {
            id: execGenId(), name,
            type: "cinematic",   // "video" | "cinematic"
            // video fields
            videoSrc: null, videoName: null,
            // cinematic fields
            audioSrc: null, audioName: null,
            images: [],          // [{ id, name, src }]
            bgSegments: [], pins: [],
        };
    }

    function getImageById(cin, imgId) {
        if (!cin || !imgId) return null;
        return cin.images?.find(i => i.id === imgId) ?? null;
    }

    function loadTimelineDuration() {
        const cin = getCin();
        const src = cin?.audioSrc ?? null;
        return new Promise(resolve => {
            if (!src) { timelineDurationMs = 10000; renderTimelineDuration(); return resolve(10000); }
            const audio = new Audio(src);
            const done = ms => { timelineDurationMs = Math.max(1000, ms); renderTimelineDuration(); resolve(timelineDurationMs); };
            audio.addEventListener("loadedmetadata", () => done(Math.round(audio.duration * 1000)), { once: true });
            audio.addEventListener("error", () => done(10000), { once: true });
            setTimeout(() => done(timelineDurationMs), 5000);
        });
    }

    function getOverlay() { return document.getElementById(EXEC_OVERLAY_ID); }

    // ── Segment / pin helpers (mirrors BDA editor) ────────────────────────────

    function resolveActiveSeg(cin) {
        if (!cin) return null;
        if (selectedSegId) return cin.bgSegments.find(s => s.id === selectedSegId) ?? null;
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

    function segAtFrac(cin, frac) {
        if (!cin) return null;
        return [...cin.bgSegments].sort((a, b) => b.startFrac - a.startFrac).find(s => s.startFrac <= frac) ?? null;
    }

    function getSegmentForPin(cin, pin) {
        if (!cin || !pin) return null;
        return [...cin.bgSegments].sort((a, b) => b.startFrac - a.startFrac)
            .find(s => s.startFrac <= pin.timeFrac && s.endFrac >= pin.timeFrac) ?? null;
    }

    function getSegmentColorIndex(cin, seg) {
        if (!cin || !seg) return 0;
        const sorted = [...cin.bgSegments].sort((a, b) => a.startFrac - b.startFrac);
        const idx = sorted.findIndex(s => s.id === seg.id);
        return idx >= 0 ? idx : 0;
    }

    function pinAtFrac(cin, frac) {
        if (!cin) return null;
        for (const pin of cin.pins) {
            const endFrac = pin.timeFrac + (pin.focusDurationMs ?? 800) / timelineDurationMs;
            if (frac >= pin.timeFrac && frac <= endFrac) return pin;
        }
        return null;
    }

    function applyPinAnimation(pin, bgEl, progressInFocus) {
        if (!bgEl) return;
        const t = execClamp(progressInFocus, 0, 1);
        if (pin.connectTo) {
            const cin = getCin();
            const pinB = cin?.pins.find(p => p.id === pin.connectTo);
            if (pinB) {
                let interpX, interpY;
                if ((pin.pathType ?? "direct") === "smooth") {
                    const mx = (pin.xFrac + pinB.xFrac) / 2, my = (pin.yFrac + pinB.yFrac) / 2;
                    const dx = pinB.xFrac - pin.xFrac, dy = pinB.yFrac - pin.yFrac;
                    const len = Math.sqrt(dx*dx + dy*dy) || 0.001, offset = len * 0.35;
                    const cpx = mx + (-dy/len)*offset, cpy = my + (dx/len)*offset;
                    interpX = (1-t)*(1-t)*pin.xFrac + 2*(1-t)*t*cpx + t*t*pinB.xFrac;
                    interpY = (1-t)*(1-t)*pin.yFrac + 2*(1-t)*t*cpy + t*t*pinB.yFrac;
                } else {
                    interpX = pin.xFrac + (pinB.xFrac - pin.xFrac) * t;
                    interpY = pin.yFrac + (pinB.yFrac - pin.yFrac) * t;
                }
                const scale = (pin.baseZoom ?? 1.0) + ((pin.zoom ?? 1.3) - (pin.baseZoom ?? 1.0)) * t;
                const tx = (0.5 - interpX) * 100, ty = (0.5 - interpY) * 100;
                bgEl.style.transform = `scale(${scale.toFixed(3)}) translate(${tx.toFixed(2)}%, ${ty.toFixed(2)}%)`;
                return;
            }
        }
        const baseZoom = pin.baseZoom ?? 1.0, zoom = pin.zoom ?? 1.3;
        const scale = baseZoom + (zoom - baseZoom) * t;
        const tx = (0.5 - pin.xFrac) * 100, ty = (0.5 - pin.yFrac) * 100;
        bgEl.style.transform = `scale(${scale.toFixed(3)}) translate(${tx.toFixed(2)}%, ${ty.toFixed(2)}%)`;
    }

    function resolveCgPreviewBg(cin) {
        const seg = resolveActiveSeg(cin);
        if (seg?.bgFile) {
            const img = getImageById(cin, seg.bgFile);
            if (img?.src) return `url("${img.src}")`;
        }
        return null;
    }

    function applyCgEffects(seg) {
        const bgEl = document.querySelector("#exec-cg-preview .bda-cg-bg");
        const colorizeEl = document.getElementById("exec-cg-colorize");
        if (!bgEl) return;
        if (!seg) {
            bgEl.style.filter = "";
            if (colorizeEl) { colorizeEl.style.background = ""; colorizeEl.style.opacity = "0"; }
            return;
        }
        const filters = [];
        const hue = seg.hueShift ?? 0;
        if (hue !== 0) filters.push(`hue-rotate(${hue}deg)`);
        if (seg.imgFilter === "grayscale") filters.push("grayscale(1)");
        else if (seg.imgFilter === "sepia") filters.push("sepia(1)");
        bgEl.style.filter = filters.join(" ");
        if (colorizeEl) {
            const color = seg.colorize || "", opacity = seg.colorizeOpacity ?? 0.4;
            if (color) { colorizeEl.style.background = color; colorizeEl.style.opacity = String(opacity); }
            else { colorizeEl.style.background = ""; colorizeEl.style.opacity = "0"; }
        }
    }

    function resolvePush(cin, movedSegId) {
        const segs = cin.bgSegments.slice().sort((a, b) => a.startFrac - b.startFrac);
        const movedIdx = segs.findIndex(s => s.id === movedSegId);
        if (movedIdx === -1) return;
        const minWidth = 0.02;
        for (let i = movedIdx + 1; i < segs.length; i++) {
            const prev = segs[i-1], cur = segs[i];
            if (cur.startFrac < prev.endFrac) {
                const w = cur.endFrac - cur.startFrac;
                cur.startFrac = prev.endFrac;
                cur.endFrac = Math.min(1, cur.startFrac + w);
                if (cur.endFrac - cur.startFrac < minWidth) cur.endFrac = Math.min(1, cur.startFrac + minWidth);
            }
        }
        for (let i = movedIdx - 1; i >= 0; i--) {
            const next = segs[i+1], cur = segs[i];
            if (cur.endFrac > next.startFrac) {
                const w = cur.endFrac - cur.startFrac;
                cur.endFrac = next.startFrac;
                cur.startFrac = Math.max(0, cur.endFrac - w);
                if (cur.endFrac - cur.startFrac < minWidth) cur.startFrac = Math.max(0, cur.endFrac - minWidth);
            }
        }
        for (const seg of segs) {
            const orig = cin.bgSegments.find(s => s.id === seg.id);
            if (orig) { orig.startFrac = seg.startFrac; orig.endFrac = seg.endFrac; }
        }
    }

    // ── Render ────────────────────────────────────────────────────────────────

    function renderCinSelectOptions() {
        const overlay = getOverlay();
        if (!overlay) return;
        const cinSelect = overlay.querySelector("#exec-cin-select");
        if (!cinSelect) return;
        cinSelect.innerHTML = cinematics.length
            ? cinematics.map(c => `<option value="${execEscHtml(c.id)}" ${c.id === activeCinId ? "selected" : ""}>${execEscHtml(c.name || "(unnamed)")} [${c.type === "video" ? "VIDEO" : "CIN"}]</option>`).join("")
            : `<option value="">— no cinematics —</option>`;
    }

    function renderToolbarState() {
        const overlay = getOverlay();
        if (!overlay) return;
        const cin = getCin();
        overlay.querySelector("#exec-cin-name").value = cin?.name ?? "";
        overlay.querySelectorAll(".exec-cin-requires").forEach(el => { el.disabled = !cin; });
        // Enable image/audio uploads only when a cinematic is loaded
        const imgFile = overlay.querySelector("#exec-img-file");
        if (imgFile) imgFile.disabled = !cin;
        overlay.querySelector("#exec-type-video")?.classList.toggle("active", cin?.type === "video");
        overlay.querySelector("#exec-type-cinematic")?.classList.toggle("active", cin?.type === "cinematic" || !cin?.type);
    }

    function renderModeBody() {
        const overlay = getOverlay();
        if (!overlay) return;
        const cin = getCin();
        const isVideo = cin?.type === "video";
        // Show/hide sections
        overlay.querySelector("#exec-editor-body").style.display = isVideo ? "none" : "";
        overlay.querySelector("#exec-media-panel").style.display = isVideo ? "none" : "";
        overlay.querySelector("#exec-timeline-section").style.display = isVideo ? "none" : "";
        overlay.querySelector("#exec-seg-section").style.display = isVideo ? "none" : "";
        overlay.querySelector("#exec-video-panel").style.display = isVideo ? "" : "none";

        if (isVideo) renderVideoPanel();
        else renderImagePanel();
    }

    function renderVideoPanel() {
        const overlay = getOverlay();
        if (!overlay) return;
        const panel = overlay.querySelector("#exec-video-panel");
        if (!panel) return;
        const cin = getCin();
        const hasSrc = !!cin?.videoSrc;
        panel.innerHTML = `
            <div class="bda-col-title">VIDEO FILE</div>
            <div class="exec-media-upload-row">
                <label class="exec-upload-label bda-btn">
                    ${hasSrc ? "REPLACE VIDEO" : "UPLOAD MP4"}
                    <input type="file" id="exec-video-file" accept="video/mp4,video/*" style="display:none">
                </label>
                ${hasSrc ? `<span class="exec-media-filename">${execEscHtml(cin.videoName || "video.mp4")}</span>` : `<span class="bda-col-hint">No video uploaded</span>`}
                ${hasSrc ? `<button type="button" id="exec-video-clear" class="bda-btn bda-btn-danger">REMOVE</button>` : ""}
            </div>
            ${hasSrc ? `
            <div class="exec-video-preview-wrap">
                <video id="exec-video-preview" src="${cin.videoSrc}" controls class="exec-video-preview"></video>
            </div>` : ""}
        `;
        panel.querySelector("#exec-video-file")?.addEventListener("change", async e => {
            const file = e.target.files?.[0];
            if (!file) return;
            const c = getCin();
            if (!c) return;
            try {
                c.videoSrc = await readFileAsDataUrl(file);
                c.videoName = file.name;
                renderVideoPanel();
            } catch (err) { console.error("[ExecCin] Video read error:", err); }
        });
        panel.querySelector("#exec-video-clear")?.addEventListener("click", () => {
            const c = getCin(); if (!c) return;
            c.videoSrc = null; c.videoName = null;
            renderVideoPanel();
        });
    }

    function renderImagePanel() {
        const overlay = getOverlay();
        if (!overlay) return;
        const panel = overlay.querySelector("#exec-image-list");
        if (!panel) return;
        const cin = getCin();
        const images = cin?.images ?? [];
        panel.innerHTML = images.length
            ? images.map(img => `
                <div class="exec-img-item" data-img-id="${execEscHtml(img.id)}">
                    <img class="exec-img-thumb" src="${img.src}" alt="${execEscHtml(img.name)}">
                    <span class="exec-img-name">${execEscHtml(img.name)}</span>
                    <button type="button" class="bda-btn bda-btn-danger exec-img-delete" data-img-id="${execEscHtml(img.id)}">✕</button>
                </div>`).join("")
            : `<div class="bda-settings-empty">No images uploaded.</div>`;

        panel.querySelectorAll(".exec-img-delete").forEach(btn => {
            btn.addEventListener("click", () => {
                const c = getCin(); if (!c) return;
                const imgId = btn.dataset.imgId;
                c.images = c.images.filter(i => i.id !== imgId);
                c.bgSegments.forEach(s => { if (s.bgFile === imgId) s.bgFile = ""; });
                renderImagePanel(); renderTimeline(); renderCgPreview(); renderSegSettings();
            });
        });
    }

    function renderAudioUpload() {
        const overlay = getOverlay();
        if (!overlay) return;
        const wrap = overlay.querySelector("#exec-audio-upload-row");
        if (!wrap) return;
        const cin = getCin();
        wrap.innerHTML = `
            <label class="exec-upload-label bda-btn exec-cin-requires" ${!cin ? "disabled" : ""}>
                ${cin?.audioSrc ? "REPLACE AUDIO" : "UPLOAD AUDIO"}
                <input type="file" id="exec-audio-file" accept="audio/*" style="display:none" ${!cin ? "disabled" : ""}>
            </label>
            <span class="exec-media-filename">${cin?.audioName ? execEscHtml(cin.audioName) : "No audio uploaded"}</span>
            ${cin?.audioSrc ? `<button type="button" id="exec-audio-clear" class="bda-btn bda-btn-danger">REMOVE</button>` : ""}
        `;
        wrap.querySelector("#exec-audio-file")?.addEventListener("change", async e => {
            const file = e.target.files?.[0];
            if (!file) return;
            const c = getCin(); if (!c) return;
            try {
                c.audioSrc = await readFileAsDataUrl(file);
                c.audioName = file.name;
                renderAudioUpload();
                await loadTimelineDuration();
                renderTimeline();
            } catch (err) { console.error("[ExecCin] Audio read error:", err); }
        });
        wrap.querySelector("#exec-audio-clear")?.addEventListener("click", () => {
            const c = getCin(); if (!c) return;
            c.audioSrc = null; c.audioName = null;
            timelineDurationMs = 10000;
            renderAudioUpload(); renderTimelineDuration();
        });
    }

    function renderCgPreview() {
        const overlay = getOverlay();
        if (!overlay) return;
        const preview = overlay.querySelector("#exec-cg-preview");
        if (!preview) return;
        preview.querySelectorAll(".bda-pin").forEach(el => el.remove());
        preview.querySelector(".bda-pin-connections")?.remove();

        const cin = getCin();
        const activeSeg = cin ? resolveActiveSeg(cin) : null;
        const bgEl = preview.querySelector(".bda-cg-bg");

        const bgUrl = resolveCgPreviewBg(cin);
        if (bgEl) { bgEl.style.backgroundImage = bgUrl || ""; bgEl.style.transform = ""; }
        applyCgEffects(activeSeg);
        if (!cin) return;

        const visiblePins = cin.pins.filter(pin => {
            const pinSeg = getSegmentForPin(cin, pin);
            return !activeSeg || pinSeg?.id === activeSeg.id;
        });
        const visiblePinIds = new Set(visiblePins.map(p => p.id));

        const NS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(NS, "svg");
        svg.setAttribute("class", "bda-pin-connections");
        svg.setAttribute("viewBox", "0 0 100 100");
        svg.setAttribute("preserveAspectRatio", "none");
        for (const pinA of visiblePins) {
            if (!pinA.connectTo || !visiblePinIds.has(pinA.connectTo)) continue;
            const pinB = cin.pins.find(p => p.id === pinA.connectTo);
            if (!pinB) continue;
            const x1 = pinA.xFrac*100, y1 = pinA.yFrac*100, x2 = pinB.xFrac*100, y2 = pinB.yFrac*100;
            const colorIdx = getSegmentColorIndex(cin, getSegmentForPin(cin, pinA));
            const color = EXEC_SEGMENT_COLORS[colorIdx % EXEC_SEGMENT_COLORS.length];
            const isSmooth = (pinA.pathType ?? "direct") === "smooth";
            let pathEl;
            if (isSmooth) {
                const mx=(x1+x2)/2, my=(y1+y2)/2, dx=x2-x1, dy=y2-y1, len=Math.sqrt(dx*dx+dy*dy)||0.001, offset=len*0.35;
                const cpx=mx+(-dy/len)*offset, cpy=my+(dx/len)*offset;
                pathEl = document.createElementNS(NS, "path");
                pathEl.setAttribute("d", `M${x1},${y1} Q${cpx.toFixed(2)},${cpy.toFixed(2)} ${x2},${y2}`);
                pathEl.setAttribute("fill", "none");
            } else {
                pathEl = document.createElementNS(NS, "line");
                pathEl.setAttribute("x1", x1); pathEl.setAttribute("y1", y1);
                pathEl.setAttribute("x2", x2); pathEl.setAttribute("y2", y2);
            }
            pathEl.setAttribute("stroke", color); pathEl.setAttribute("stroke-width", "1.2");
            pathEl.setAttribute("stroke-opacity", "0.8"); pathEl.setAttribute("stroke-dasharray", "2.5 2");
            svg.appendChild(pathEl);
            const dot = document.createElementNS(NS, "circle");
            dot.setAttribute("cx", x2); dot.setAttribute("cy", y2); dot.setAttribute("r", "1.8");
            dot.setAttribute("fill", color); dot.setAttribute("fill-opacity", "0.85");
            svg.appendChild(dot);
        }
        const vignetteEl = preview.querySelector(".bda-cg-vignette");
        if (vignetteEl) preview.insertBefore(svg, vignetteEl); else preview.appendChild(svg);

        for (const pin of visiblePins) {
            const pinSeg = getSegmentForPin(cin, pin);
            const colorIdx = getSegmentColorIndex(cin, pinSeg);
            const color = EXEC_SEGMENT_COLORS[colorIdx % EXEC_SEGMENT_COLORS.length];
            const el = document.createElement("div");
            el.className = `bda-pin${pin.id === selectedPinId ? " selected" : ""}`;
            el.dataset.pinId = pin.id;
            el.textContent = String(pin.num ?? "?").slice(0, 3);
            el.style.left = `${execClamp(pin.xFrac * 100, 0, 94)}%`;
            el.style.top = `${execClamp(pin.yFrac * 100, 0, 90)}%`;
            el.style.background = color;
            preview.appendChild(el);
        }
    }

    function renderTimeline() {
        const overlay = getOverlay();
        if (!overlay) return;
        const tl = overlay.querySelector("#exec-timeline");
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
        const inner = document.createElement("div");
        inner.className = "bda-tl-inner";
        inner.style.width = `${timelineZoom * 100}%`;

        const ticks = document.createElement("div");
        ticks.className = "bda-tl-ticks";
        const niceIntervals = [50,100,200,250,500,1000,2000,5000];
        const targetTicks = Math.round(20 * timelineZoom);
        const rawInterval = timelineDurationMs / targetTicks;
        const interval = niceIntervals.reduce((best, v) => Math.abs(v-rawInterval) < Math.abs(best-rawInterval) ? v : best);
        const tickCount = Math.floor(timelineDurationMs / interval);
        for (let i = 0; i <= tickCount; i++) {
            const frac = (i * interval) / timelineDurationMs;
            const t = document.createElement("div");
            t.className = "bda-tl-tick"; t.style.left = `${frac * 100}%`;
            const lbl = document.createElement("span");
            lbl.textContent = `${(i * interval / 1000).toFixed(interval < 1000 ? 2 : 1)}s`;
            t.appendChild(lbl); ticks.appendChild(t);
        }
        inner.appendChild(ticks);

        const segRow = document.createElement("div");
        segRow.className = "bda-tl-row bda-tl-segs"; segRow.dataset.rowType = "segs";
        for (let i = 0; i < cin.bgSegments.length; i++) {
            const seg = cin.bgSegments[i];
            const color = EXEC_SEGMENT_COLORS[i % EXEC_SEGMENT_COLORS.length];
            const img = getImageById(cin, seg.bgFile);
            const el = document.createElement("div");
            el.className = `bda-tl-seg${seg.id === selectedSegId ? " selected" : ""}`;
            el.dataset.segId = seg.id;
            el.style.left = `${seg.startFrac * 100}%`;
            el.style.width = `${Math.max(0.02, seg.endFrac - seg.startFrac) * 100}%`;
            el.style.background = color;
            el.innerHTML = `
                <div class="bda-tl-seg-handle" data-seg-id="${seg.id}" data-handle="left"></div>
                <div class="bda-tl-seg-label">${execEscHtml(img?.name || seg.bgFile || "?")}</div>
                <div class="bda-tl-seg-handle" data-seg-id="${seg.id}" data-handle="right"></div>
            `;
            segRow.appendChild(el);
        }
        inner.appendChild(segRow);

        const pinRow = document.createElement("div");
        pinRow.className = "bda-tl-row bda-tl-pins"; pinRow.dataset.rowType = "pins";

        const sortedPinsForGaps = [...cin.pins].sort((a, b) => a.timeFrac - b.timeFrac);
        for (let i = 0; i < sortedPinsForGaps.length - 1; i++) {
            const left = sortedPinsForGaps[i], right = sortedPinsForGaps[i+1];
            if (right.timeFrac <= left.timeFrac) continue;
            const leftTimePct = (left.timeFrac * 100).toFixed(4);
            const leftDurPct = ((left.focusDurationMs ?? 800) / timelineDurationMs * 100).toFixed(4);
            const rightTimePct = (right.timeFrac * 100).toFixed(4);
            const gapId = `${left.id}|${right.id}`;
            const gapEl = document.createElement("div");
            gapEl.className = `bda-tl-gap${selectedGapId === gapId ? " selected" : ""}`;
            gapEl.dataset.gapId = gapId;
            gapEl.dataset.leftPinId = left.id; gapEl.dataset.rightPinId = right.id;
            gapEl.style.left = `calc(${leftTimePct}% + max(22px, ${leftDurPct}%))`;
            gapEl.style.right = `calc(100% - ${rightTimePct}%)`;
            gapEl.style.width = "";
            gapEl.title = "Null gap — select and press Delete to close";
            pinRow.appendChild(gapEl);
        }
        for (const pin of cin.pins) {
            const pinSeg = getSegmentForPin(cin, pin);
            const colorIdx = getSegmentColorIndex(cin, pinSeg);
            const color = EXEC_SEGMENT_COLORS[colorIdx % EXEC_SEGMENT_COLORS.length];
            const durFrac = (pin.focusDurationMs ?? 800) / timelineDurationMs;
            const el = document.createElement("div");
            el.className = `bda-tl-pin${pin.id === selectedPinId ? " selected" : ""}`;
            el.dataset.pinId = pin.id;
            el.style.left = `${pin.timeFrac * 100}%`;
            el.style.width = `max(22px, ${durFrac * 100}%)`;
            el.style.background = color;
            el.title = `Pin #${pin.num} (${pin.focusDurationMs ?? 800}ms)`;
            el.innerHTML = `
                <span class="bda-tl-pin-num">${execEscHtml(String(pin.num ?? "").slice(0, 2))}</span>
                <div class="bda-tl-pin-dur-handle" data-pin-id="${pin.id}"></div>
            `;
            pinRow.appendChild(el);
        }
        inner.appendChild(pinRow);

        const ticker = document.createElement("div");
        ticker.id = "exec-ticker"; ticker.className = "bda-ticker";
        ticker.style.left = `${previewPosition * 100}%`;
        inner.appendChild(ticker);
        tl.appendChild(inner);
    }

    function renderTimelineDuration() {
        const overlay = getOverlay();
        if (!overlay) return;
        const lbl = overlay.querySelector("#exec-tl-duration-label");
        const cin = getCin();
        if (lbl) lbl.textContent = cin?.audioName
            ? `${execEscHtml(cin.audioName)}: ${(timelineDurationMs / 1000).toFixed(1)}s`
            : `${(timelineDurationMs / 1000).toFixed(1)}s (no audio)`;
    }

    function renderPinSettings() {
        const overlay = getOverlay();
        if (!overlay) return;
        const panel = overlay.querySelector("#exec-pin-settings");
        if (!panel) return;
        const cin = getCin();
        const pin = cin?.pins.find(p => p.id === selectedPinId) ?? null;
        if (!pin) { panel.innerHTML = `<div class="bda-settings-empty">Select a pin to edit its properties.</div>`; return; }
        const otherPins = cin?.pins.filter(p => p.id !== pin.id) ?? [];
        const hasConnection = !!pin.connectTo;
        panel.innerHTML = `
            <div class="bda-settings-title">PIN #${pin.num}</div>
            <div class="bda-settings-row">
                <label class="bda-lbl">Duration</label>
                <input type="number" id="exec-pin-focus" min="100" max="120000" step="100" value="${pin.focusDurationMs ?? 800}" class="bda-input">
                <span class="bda-unit">ms</span>
            </div>
            <div class="bda-settings-row">
                <label class="bda-lbl">Zoom from:</label>
                <input type="number" id="exec-pin-base-zoom" min="1.0" max="100" step="0.1" value="${(pin.baseZoom ?? 1.0).toFixed(1)}" class="bda-input">
                <span class="bda-unit">×</span>
            </div>
            <div class="bda-settings-row">
                <label class="bda-lbl">Zoom to:</label>
                <input type="number" id="exec-pin-zoom" min="1.0" max="100" step="0.1" value="${(pin.zoom ?? 1.3).toFixed(1)}" class="bda-input">
                <span class="bda-unit">×</span>
            </div>
            <div class="bda-settings-row">
                <label class="bda-lbl">Time</label>
                <input type="number" id="exec-pin-time" min="0" max="${timelineDurationMs}" step="100" value="${Math.round((pin.timeFrac ?? 0) * timelineDurationMs)}" class="bda-input">
                <span class="bda-unit">ms</span>
            </div>
            <div class="bda-settings-divider"></div>
            <div class="bda-settings-row">
                <label class="bda-lbl">Shake</label>
                <input type="range" id="exec-pin-shake" min="0" max="1" step="0.05" value="${pin.shake ?? 0}" class="bda-range">
                <span id="exec-pin-shake-val" class="bda-unit bda-unit-val">${(pin.shake ?? 0).toFixed(2)}</span>
            </div>
            <div class="bda-settings-row">
                <label class="bda-lbl">Static</label>
                <input type="range" id="exec-pin-static" min="0" max="1" step="0.05" value="${pin.staticOpacity ?? 0}" class="bda-range">
                <span id="exec-pin-static-val" class="bda-unit bda-unit-val">${(pin.staticOpacity ?? 0).toFixed(2)}</span>
            </div>
            ${otherPins.length > 0 ? `
            <div class="bda-settings-divider"></div>
            <div class="bda-settings-row">
                <label class="bda-lbl">Connect to</label>
                <select id="exec-pin-connect" class="bda-select">
                    <option value="">— none —</option>
                    ${otherPins.map(p => `<option value="${execEscHtml(p.id)}" ${pin.connectTo === p.id ? "selected" : ""}>Pin #${execEscHtml(String(p.num))}</option>`).join("")}
                </select>
            </div>
            <div class="bda-settings-row" id="exec-pin-pathtype-row" ${hasConnection ? "" : 'style="display:none"'}>
                <label class="bda-lbl">Path</label>
                <select id="exec-pin-pathtype" class="bda-select">
                    <option value="direct" ${(pin.pathType ?? "direct") === "direct" ? "selected" : ""}>Direct</option>
                    <option value="smooth" ${pin.pathType === "smooth" ? "selected" : ""}>Smooth arc</option>
                </select>
            </div>` : ""}
            <div class="bda-settings-row" style="margin-top:6px">
                <button type="button" id="exec-pin-delete" class="bda-btn bda-btn-danger" style="width:100%">DELETE PIN</button>
            </div>
        `;
        panel.querySelector("#exec-pin-focus")?.addEventListener("input", e => {
            const p = getCin()?.pins.find(x => x.id === pin.id);
            if (p) p.focusDurationMs = Math.max(100, Number(e.target.value) || 800);
        });
        panel.querySelector("#exec-pin-base-zoom")?.addEventListener("input", e => {
            const p = getCin()?.pins.find(x => x.id === pin.id);
            if (p) p.baseZoom = execClamp(Number(e.target.value) || 1.0, 1, 100);
        });
        panel.querySelector("#exec-pin-zoom")?.addEventListener("input", e => {
            const p = getCin()?.pins.find(x => x.id === pin.id);
            if (p) p.zoom = execClamp(Number(e.target.value) || 1.3, 1, 100);
        });
        panel.querySelector("#exec-pin-time")?.addEventListener("input", e => {
            const p = getCin()?.pins.find(x => x.id === pin.id);
            if (p) { p.timeFrac = execClamp(Number(e.target.value) / timelineDurationMs, 0, 1); renderTimeline(); }
        });
        panel.querySelector("#exec-pin-shake")?.addEventListener("input", e => {
            const p = getCin()?.pins.find(x => x.id === pin.id);
            if (p) { p.shake = Number(e.target.value); panel.querySelector("#exec-pin-shake-val").textContent = p.shake.toFixed(2); }
        });
        panel.querySelector("#exec-pin-static")?.addEventListener("input", e => {
            const p = getCin()?.pins.find(x => x.id === pin.id);
            if (p) { p.staticOpacity = Number(e.target.value); panel.querySelector("#exec-pin-static-val").textContent = p.staticOpacity.toFixed(2); }
        });
        panel.querySelector("#exec-pin-connect")?.addEventListener("change", e => {
            const p = getCin()?.pins.find(x => x.id === pin.id);
            if (!p) return;
            p.connectTo = e.target.value || null;
            if (!p.connectTo) p.pathType = undefined;
            const row = panel.querySelector("#exec-pin-pathtype-row");
            if (row) row.style.display = p.connectTo ? "" : "none";
            renderCgPreview(); renderTimeline();
        });
        panel.querySelector("#exec-pin-pathtype")?.addEventListener("change", e => {
            const p = getCin()?.pins.find(x => x.id === pin.id);
            if (p) { p.pathType = e.target.value; renderCgPreview(); }
        });
        panel.querySelector("#exec-pin-delete")?.addEventListener("click", () => {
            const c = getCin(); if (!c) return;
            c.pins.forEach(p => { if (p.connectTo === pin.id) p.connectTo = null; });
            c.pins = c.pins.filter(x => x.id !== pin.id);
            selectedPinId = null;
            renderCgPreview(); renderTimeline(); renderPinSettings(); renderToolbarState();
        });
    }

    function renderSegSettings() {
        const overlay = getOverlay();
        if (!overlay) return;
        const panel = overlay.querySelector("#exec-seg-settings");
        if (!panel) return;
        const cin = getCin();
        const seg = cin?.bgSegments.find(s => s.id === selectedSegId) ?? null;
        if (!seg) { panel.innerHTML = `<div class="bda-settings-empty">Select a BG segment to edit its properties.</div>`; return; }
        const colorizeColor = seg.colorize || "#ff0000";
        const colorizeOpacity = (seg.colorizeOpacity ?? 0.4).toFixed(2);
        const hasColorize = !!seg.colorize;
        const images = cin?.images ?? [];

        panel.innerHTML = `
            <div class="bda-settings-title">BG SEGMENT</div>
            <div class="bda-settings-row">
                <label class="bda-lbl">Image</label>
                <select id="exec-seg-bg" class="bda-select bda-select-wide">
                    <option value="">— none —</option>
                    ${images.map(img => `<option value="${execEscHtml(img.id)}" ${seg.bgFile === img.id ? "selected" : ""}>${execEscHtml(img.name)}</option>`).join("")}
                </select>
            </div>
            <div class="bda-settings-row">
                <label class="bda-lbl">Fade In</label>
                <input type="number" id="exec-seg-fadein" min="0" max="5000" step="50" value="${seg.fadeIn ?? 200}" class="bda-input">
                <span class="bda-unit">ms</span>
            </div>
            <div class="bda-settings-row">
                <label class="bda-lbl">Fade Out</label>
                <input type="number" id="exec-seg-fadeout" min="0" max="5000" step="50" value="${seg.fadeOut ?? 200}" class="bda-input">
                <span class="bda-unit">ms</span>
            </div>
            <div class="bda-settings-divider"></div>
            <div class="bda-settings-row">
                <label class="bda-lbl">Hue Shift</label>
                <input type="range" id="exec-seg-hue" min="-180" max="180" step="1" value="${seg.hueShift ?? 0}" class="bda-range">
                <span id="exec-seg-hue-val" class="bda-unit bda-unit-val">${seg.hueShift ?? 0}°</span>
            </div>
            <div class="bda-settings-row">
                <label class="bda-lbl">Filter</label>
                <select id="exec-seg-filter" class="bda-select">
                    <option value="none" ${!seg.imgFilter || seg.imgFilter === "none" ? "selected" : ""}>None</option>
                    <option value="grayscale" ${seg.imgFilter === "grayscale" ? "selected" : ""}>Grayscale</option>
                    <option value="sepia" ${seg.imgFilter === "sepia" ? "selected" : ""}>Sepia</option>
                </select>
            </div>
            <div class="bda-settings-divider"></div>
            <div class="bda-settings-row">
                <label class="bda-lbl">Colorize</label>
                <input type="color" id="exec-seg-colorize-color" value="${execEscHtml(colorizeColor)}" class="bda-color-input">
                <input type="range" id="exec-seg-colorize-opacity" min="0" max="1" step="0.05" value="${hasColorize ? colorizeOpacity : 0}" class="bda-range" style="flex:1">
                <span id="exec-seg-colorize-val" class="bda-unit bda-unit-val">${hasColorize ? colorizeOpacity : "0.00"}</span>
            </div>
            <div class="bda-settings-row" style="margin-top:6px">
                <button type="button" id="exec-seg-delete" class="bda-btn bda-btn-danger" style="width:100%">DELETE SEGMENT</button>
            </div>
        `;
        panel.querySelector("#exec-seg-bg")?.addEventListener("change", e => {
            const s = getCin()?.bgSegments.find(x => x.id === seg.id);
            if (s) { s.bgFile = e.target.value; renderTimeline(); renderCgPreview(); }
        });
        panel.querySelector("#exec-seg-fadein")?.addEventListener("input", e => {
            const s = getCin()?.bgSegments.find(x => x.id === seg.id);
            if (s) s.fadeIn = Math.max(0, Number(e.target.value) || 0);
        });
        panel.querySelector("#exec-seg-fadeout")?.addEventListener("input", e => {
            const s = getCin()?.bgSegments.find(x => x.id === seg.id);
            if (s) s.fadeOut = Math.max(0, Number(e.target.value) || 0);
        });
        panel.querySelector("#exec-seg-hue")?.addEventListener("input", e => {
            const s = getCin()?.bgSegments.find(x => x.id === seg.id);
            if (s) { s.hueShift = Number(e.target.value); panel.querySelector("#exec-seg-hue-val").textContent = `${s.hueShift}°`; applyCgEffects(s); }
        });
        panel.querySelector("#exec-seg-filter")?.addEventListener("change", e => {
            const s = getCin()?.bgSegments.find(x => x.id === seg.id);
            if (s) { s.imgFilter = e.target.value === "none" ? undefined : e.target.value; applyCgEffects(s); }
        });
        const syncColorize = () => {
            const s = getCin()?.bgSegments.find(x => x.id === seg.id);
            if (!s) return;
            const color = panel.querySelector("#exec-seg-colorize-color")?.value || "";
            const opacity = Number(panel.querySelector("#exec-seg-colorize-opacity")?.value ?? 0);
            s.colorize = opacity > 0 ? color : ""; s.colorizeOpacity = opacity;
            panel.querySelector("#exec-seg-colorize-val").textContent = opacity.toFixed(2);
            applyCgEffects(s);
        };
        panel.querySelector("#exec-seg-colorize-color")?.addEventListener("input", syncColorize);
        panel.querySelector("#exec-seg-colorize-opacity")?.addEventListener("input", syncColorize);
        panel.querySelector("#exec-seg-delete")?.addEventListener("click", () => {
            const c = getCin(); if (!c) return;
            c.bgSegments = c.bgSegments.filter(x => x.id !== seg.id);
            selectedSegId = null;
            renderTimeline(); renderSegSettings(); renderToolbarState();
        });
    }

    function renderAll() {
        renderCinSelectOptions();
        renderToolbarState();
        renderModeBody();
        renderCgPreview();
        renderTimeline();
        renderTimelineDuration();
        renderPinSettings();
        renderSegSettings();
        renderAudioUpload();
        renderImagePanel();
    }

    // ── Preview playback ──────────────────────────────────────────────────────

    function setTickerPosition(frac) {
        previewPosition = execClamp(frac, 0, 1);
        const ticker = document.getElementById("exec-ticker");
        if (ticker) ticker.style.left = `${previewPosition * 100}%`;
        if (timelineZoom > 1) {
            const tlEl = document.getElementById("exec-timeline");
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
        const btn = document.getElementById("exec-preview-play");
        if (!btn) return;
        btn.classList.toggle("playing", playing);
        btn.title = playing ? "Stop preview" : "Preview execution cinematic";
        btn.innerHTML = playing
            ? `<svg viewBox="0 0 14 14" width="12" height="12" fill="currentColor"><rect x="2" y="1" width="4" height="12"/><rect x="8" y="1" width="4" height="12"/></svg>`
            : `<svg viewBox="0 0 14 14" width="12" height="12" fill="currentColor"><polygon points="2,1 12,7 2,13"/></svg>`;
    }

    function stopPreview() {
        if (previewRaf) { cancelAnimationFrame(previewRaf); previewRaf = null; }
        if (previewAudio) { previewAudio.pause(); previewAudio = null; }
        updatePreviewPlayBtn(false);
        const bgEl = document.querySelector("#exec-cg-preview .bda-cg-bg");
        if (bgEl) { bgEl.style.transform = ""; bgEl.style.opacity = ""; bgEl.style.animation = ""; }
        const staticEl = document.getElementById("exec-cg-static");
        if (staticEl) staticEl.style.opacity = "0";
        applyCgEffects(null);
        renderCgPreview();
    }

    function startPreview() {
        if (previewAudio) { stopPreview(); return; }
        const cin = getCin();
        if (!cin || !cin.audioSrc) return;

        const audio = new Audio(cin.audioSrc);
        audio.volume = 0.5;
        previewAudio = audio;

        audio.addEventListener("ended", () => {
            setTickerPosition(0);
            const tlEl = document.getElementById("exec-timeline");
            if (tlEl && tlEl.scrollLeft > 0) tlEl.scrollTo({ left: 0, behavior: "smooth" });
            stopPreview();
        }, { once: true });
        audio.addEventListener("error", stopPreview, { once: true });

        const startFrom = previewPosition;
        audio.addEventListener("loadedmetadata", () => {
            if (startFrom > 0 && Number.isFinite(audio.duration)) audio.currentTime = startFrom * audio.duration;
        }, { once: true });

        audio.play().catch(stopPreview);
        updatePreviewPlayBtn(true);

        let lastAppliedBg = null, lastAppliedSegId = null;

        function tick() {
            if (!previewAudio || previewAudio.paused || previewAudio.ended) return;
            const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : timelineDurationMs / 1000;
            const frac = audio.currentTime / duration;
            setTickerPosition(frac);

            const activeSeg = segAtFrac(cin, frac);
            const imgId = activeSeg?.bgFile || null;
            const preview = document.getElementById("exec-cg-preview");
            const bgEl = preview?.querySelector(".bda-cg-bg");

            if (imgId !== lastAppliedBg) {
                lastAppliedBg = imgId;
                if (bgEl) {
                    const img = getImageById(cin, imgId);
                    bgEl.style.backgroundImage = img?.src ? `url("${img.src}")` : "";
                }
            }
            if (activeSeg?.id !== lastAppliedSegId) {
                lastAppliedSegId = activeSeg?.id ?? null;
                applyCgEffects(activeSeg);
            }
            if (bgEl && activeSeg) {
                const elapsed = (frac - activeSeg.startFrac) * duration;
                const remaining = (activeSeg.endFrac - frac) * duration;
                const fadeInSec = (activeSeg.fadeIn ?? 0) / 1000, fadeOutSec = (activeSeg.fadeOut ?? 0) / 1000;
                let opacity = 1;
                if (fadeInSec > 0 && elapsed < fadeInSec) opacity = Math.min(opacity, elapsed / fadeInSec);
                if (fadeOutSec > 0 && remaining < fadeOutSec) opacity = Math.min(opacity, remaining / fadeOutSec);
                bgEl.style.opacity = String(execClamp(opacity, 0, 1));
            } else if (bgEl) { bgEl.style.opacity = "1"; }

            const activePin = pinAtFrac(cin, frac);
            if (activePin && bgEl) {
                const pinEndFrac = activePin.timeFrac + (activePin.focusDurationMs ?? 800) / timelineDurationMs;
                const progressInFocus = execClamp((frac - activePin.timeFrac) / Math.max(0.001, pinEndFrac - activePin.timeFrac), 0, 1);
                applyPinAnimation(activePin, bgEl, progressInFocus);
            } else if (bgEl) { bgEl.style.transform = ""; }

            if (bgEl) {
                const shakeAmt = activePin?.shake ?? 0;
                if (shakeAmt > 0) {
                    const speed = Math.round(40 + (1 - shakeAmt) * 60);
                    bgEl.style.animation = `bda-shake ${speed}ms steps(4, end) infinite`;
                } else { bgEl.style.animation = ""; }
            }
            const staticEl = document.getElementById("exec-cg-static");
            if (staticEl) staticEl.style.opacity = String(activePin?.staticOpacity ?? 0);
            previewRaf = requestAnimationFrame(tick);
        }
        previewRaf = requestAnimationFrame(tick);
    }

    // ── Drag: CG preview ─────────────────────────────────────────────────────

    function onCgPointerDown(e) {
        const preview = e.currentTarget;
        const pinEl = e.target.closest(".bda-pin");
        if (pinEl) {
            selectedPinId = pinEl.dataset.pinId; selectedSegId = null; selectedGapId = null;
            dragging = { type: "pin-cg", pinId: selectedPinId };
            preview.setPointerCapture(e.pointerId); e.preventDefault();
            renderCgPreview(); renderPinSettings(); renderSegSettings(); renderTimeline();
            return;
        }
        selectedPinId = null; selectedSegId = null; selectedGapId = null;
        renderCgPreview(); renderPinSettings(); renderSegSettings(); renderTimeline();
    }

    function onCgPointerMove(e) {
        if (!dragging || dragging.type !== "pin-cg") return;
        const preview = e.currentTarget;
        const rect = preview.getBoundingClientRect();
        const pin = getCin()?.pins.find(p => p.id === dragging.pinId);
        if (pin) {
            pin.xFrac = execClamp((e.clientX - rect.left) / rect.width, 0, 1);
            pin.yFrac = execClamp((e.clientY - rect.top) / rect.height, 0, 1);
            renderCgPreview();
        }
    }

    function onCgPointerUp() { if (dragging?.type === "pin-cg") dragging = null; }

    // ── Drag: timeline ────────────────────────────────────────────────────────

    function onTlPointerDown(e) {
        const tl = e.currentTarget;
        const rect = tl.getBoundingClientRect();
        const frac = execClamp((e.clientX - rect.left + tl.scrollLeft) / (rect.width * timelineZoom), 0, 1);

        if (e.target.closest(".bda-ticker")) {
            dragging = { type: "ticker" };
            tl.setPointerCapture(e.pointerId); e.preventDefault(); e.stopPropagation(); return;
        }
        const handle = e.target.closest(".bda-tl-seg-handle");
        if (handle) {
            const segId = handle.dataset.segId, side = handle.dataset.handle;
            selectedSegId = segId; selectedPinId = null; selectedGapId = null;
            dragging = { type: side === "left" ? "seg-left" : "seg-right", segId };
            tl.setPointerCapture(e.pointerId); e.stopPropagation(); e.preventDefault();
            renderTimeline(); renderCgPreview(); renderSegSettings(); renderPinSettings(); return;
        }
        const segEl = e.target.closest(".bda-tl-seg");
        if (segEl) {
            const segId = segEl.dataset.segId, cin = getCin(), seg = cin?.bgSegments.find(s => s.id === segId);
            if (seg) {
                selectedSegId = segId; selectedPinId = null; selectedGapId = null;
                dragging = { type: "seg-move", segId, startFrac: frac, segStartFrac: seg.startFrac, segEndFrac: seg.endFrac };
                tl.setPointerCapture(e.pointerId); e.preventDefault();
                renderTimeline(); renderCgPreview(); renderSegSettings(); renderPinSettings(); return;
            }
        }
        const pinDurHandle = e.target.closest(".bda-tl-pin-dur-handle");
        if (pinDurHandle) {
            selectedPinId = pinDurHandle.dataset.pinId; selectedSegId = null; selectedGapId = null;
            dragging = { type: "pin-dur", pinId: selectedPinId };
            tl.setPointerCapture(e.pointerId); e.preventDefault(); e.stopPropagation();
            renderTimeline(); renderCgPreview(); renderPinSettings(); renderSegSettings(); return;
        }
        const pinEl = e.target.closest(".bda-tl-pin");
        if (pinEl) {
            const pinId = pinEl.dataset.pinId, cin2 = getCin(), pin = cin2?.pins.find(p => p.id === pinId);
            selectedPinId = pinId; selectedSegId = null; selectedGapId = null;
            dragging = { type: "pin-timeline", pinId, startFrac: frac, pinTimeFracAtStart: pin?.timeFrac ?? frac };
            tl.setPointerCapture(e.pointerId); e.preventDefault();
            renderTimeline(); renderCgPreview(); renderPinSettings(); renderSegSettings(); return;
        }
        const gapEl = e.target.closest(".bda-tl-gap");
        if (gapEl) {
            selectedGapId = gapEl.dataset.gapId; selectedPinId = null; selectedSegId = null;
            renderTimeline(); renderPinSettings(); renderSegSettings(); e.preventDefault(); return;
        }
        selectedSegId = null; selectedPinId = null; selectedGapId = null;
        renderTimeline(); renderCgPreview(); renderPinSettings(); renderSegSettings();
    }

    function onTlPointerMove(e) {
        if (!dragging) return;
        const tl = e.currentTarget;
        const rect = tl.getBoundingClientRect();
        const frac = execClamp((e.clientX - rect.left + tl.scrollLeft) / (rect.width * timelineZoom), 0, 1);
        const cin = getCin(); if (!cin) return;

        if (dragging.type === "ticker") {
            setTickerPosition(frac);
            if (previewAudio && Number.isFinite(previewAudio.duration)) previewAudio.currentTime = frac * previewAudio.duration;
            const activeSeg = segAtFrac(cin, frac);
            const preview = document.getElementById("exec-cg-preview");
            const bgEl = preview?.querySelector(".bda-cg-bg");
            if (bgEl) {
                const img = activeSeg?.bgFile ? getImageById(cin, activeSeg.bgFile) : null;
                bgEl.style.backgroundImage = img?.src ? `url("${img.src}")` : resolveCgPreviewBg(cin) || "";
                if (activeSeg) {
                    const dur = previewAudio && Number.isFinite(previewAudio.duration) ? previewAudio.duration : timelineDurationMs/1000;
                    const elapsed=(frac-activeSeg.startFrac)*dur, remaining=(activeSeg.endFrac-frac)*dur;
                    const fadeInSec=(activeSeg.fadeIn??0)/1000, fadeOutSec=(activeSeg.fadeOut??0)/1000;
                    let opacity=1;
                    if (fadeInSec>0 && elapsed<fadeInSec) opacity=Math.min(opacity, elapsed/fadeInSec);
                    if (fadeOutSec>0 && remaining<fadeOutSec) opacity=Math.min(opacity, remaining/fadeOutSec);
                    bgEl.style.opacity = String(execClamp(opacity, 0, 1));
                } else { bgEl.style.opacity = "1"; }
                const activePin = pinAtFrac(cin, frac);
                if (activePin) {
                    const pinEndFrac = activePin.timeFrac + (activePin.focusDurationMs??800)/timelineDurationMs;
                    const prog = execClamp((frac-activePin.timeFrac)/Math.max(0.001,pinEndFrac-activePin.timeFrac),0,1);
                    applyPinAnimation(activePin, bgEl, prog);
                } else { bgEl.style.transform = ""; }
            }
            applyCgEffects(activeSeg);
            return;
        }
        if (dragging.type === "pin-dur") {
            const pin = cin.pins.find(p => p.id === dragging.pinId);
            if (pin) {
                const endFrac = execClamp(frac, pin.timeFrac + 0.005, 1);
                pin.focusDurationMs = Math.max(100, Math.round((endFrac - pin.timeFrac) * timelineDurationMs));
                const focusInput = document.querySelector("#exec-pin-focus");
                if (focusInput) focusInput.value = pin.focusDurationMs;
                renderTimeline();
            }
            return;
        }
        if (dragging.type === "pin-timeline") {
            const pin = cin.pins.find(p => p.id === dragging.pinId);
            if (pin) {
                pin.timeFrac = execClamp(dragging.pinTimeFracAtStart + (frac - dragging.startFrac), 0, 1);
                const timeInput = document.querySelector("#exec-pin-time");
                if (timeInput) timeInput.value = Math.round(pin.timeFrac * timelineDurationMs);
                renderTimeline();
            }
            return;
        }
        if (dragging.type === "seg-left") {
            const seg = cin.bgSegments.find(s => s.id === dragging.segId);
            if (seg) { seg.startFrac = execClamp(frac, 0, seg.endFrac - 0.02); resolvePush(cin, dragging.segId); renderTimeline(); }
            return;
        }
        if (dragging.type === "seg-right") {
            const seg = cin.bgSegments.find(s => s.id === dragging.segId);
            if (seg) { seg.endFrac = execClamp(frac, seg.startFrac + 0.02, 1); resolvePush(cin, dragging.segId); renderTimeline(); }
            return;
        }
        if (dragging.type === "seg-move") {
            const seg = cin.bgSegments.find(s => s.id === dragging.segId);
            if (seg) {
                const width = dragging.segEndFrac - dragging.segStartFrac;
                seg.startFrac = execClamp(dragging.segStartFrac + (frac - dragging.startFrac), 0, 1 - width);
                seg.endFrac = seg.startFrac + width;
                resolvePush(cin, dragging.segId); renderTimeline();
            }
        }
    }

    function onTlPointerUp() { dragging = null; }

    // ── Build overlay ─────────────────────────────────────────────────────────

    function ensureOverlay() {
        const existing = document.getElementById(EXEC_OVERLAY_ID);
        if (existing) return existing;

        const overlay = document.createElement("div");
        overlay.id = EXEC_OVERLAY_ID;
        overlay.className = "bda-editor-overlay exec-editor-overlay";
        overlay.setAttribute("aria-hidden", "true");

        overlay.innerHTML = `
            <div class="bda-editor-window" role="dialog" aria-modal="true" aria-labelledby="exec-editor-title">
                <div class="bda-editor-header">
                    <span id="exec-editor-title" class="bda-editor-title" style="color:#ff9944">CONFIGURE EXECUTIONS</span>
                    <button type="button" class="bda-editor-close" id="exec-editor-close" aria-label="Close">✕</button>
                </div>

                <div class="bda-editor-toolbar">
                    <select id="exec-cin-select" class="bda-select bda-select-wide"></select>
                    <button type="button" id="exec-cin-new" class="bda-btn">+ NEW</button>
                    <button type="button" id="exec-cin-delete" class="bda-btn bda-btn-danger exec-cin-requires" disabled>DELETE</button>
                    <span class="bda-toolbar-spacer"></span>
                    <span class="bda-toolbar-label">TYPE:</span>
                    <button type="button" id="exec-type-cinematic" class="bda-btn exec-type-btn exec-cin-requires" disabled>CINEMATIC</button>
                    <button type="button" id="exec-type-video" class="bda-btn exec-type-btn exec-cin-requires" disabled>VIDEO</button>
                    <span class="bda-toolbar-spacer"></span>
                    <label class="bda-toolbar-label" for="exec-cin-name">Name:</label>
                    <input type="text" id="exec-cin-name" class="bda-input exec-cin-requires" placeholder="Execution name" disabled>
                </div>

                <!-- VIDEO MODE PANEL -->
                <div id="exec-video-panel" class="exec-video-panel" style="display:none">
                    <div style="padding:12px 14px"><!-- rendered by renderVideoPanel() --></div>
                </div>

                <!-- CINEMATIC MODE: editor body (CG preview + pin settings) -->
                <div id="exec-editor-body" class="bda-editor-body">
                    <div class="bda-editor-col bda-col-cg">
                        <div class="bda-col-title">CG PREVIEW <span class="bda-col-hint">drag pins to reposition</span></div>
                        <div id="exec-cg-preview" class="bda-cg-preview">
                            <div class="bda-cg-bg"></div>
                            <div id="exec-cg-colorize" class="bda-cg-colorize"></div>
                            <div class="bda-cg-vignette"></div>
                            <div class="bda-cg-bda-noise"></div>
                            <div id="exec-cg-static" class="bda-cg-static" style="opacity:0"></div>
                        </div>
                        <div class="bda-cg-actions">
                            <button type="button" id="exec-add-pin" class="bda-btn exec-cin-requires" disabled>+ ADD PIN</button>
                        </div>
                    </div>
                    <div class="bda-editor-col bda-col-pins">
                        <div class="bda-col-title">PIN SETTINGS</div>
                        <div id="exec-pin-settings" class="bda-settings-panel">
                            <div class="bda-settings-empty">Select a pin to edit.</div>
                        </div>
                    </div>
                </div>

                <!-- CINEMATIC MODE: media panel (images + audio) -->
                <div id="exec-media-panel" class="exec-media-panel">
                    <div class="exec-media-col exec-images-col">
                        <div class="bda-col-title">IMAGES <span class="bda-col-hint">used in BG segments</span></div>
                        <div id="exec-image-list" class="exec-image-list">
                            <div class="bda-settings-empty">No images uploaded.</div>
                        </div>
                        <div class="exec-media-actions">
                            <label class="exec-upload-label bda-btn exec-cin-requires" id="exec-img-upload-label">
                                + UPLOAD IMAGE
                                <input type="file" id="exec-img-file" accept="image/*" multiple style="display:none" disabled>
                            </label>
                        </div>
                    </div>
                    <div class="exec-media-col exec-audio-col">
                        <div class="bda-col-title">AUDIO TRACK <span class="bda-col-hint">timeline duration source</span></div>
                        <div id="exec-audio-upload-row" class="exec-audio-upload-row">
                            <!-- rendered by renderAudioUpload() -->
                        </div>
                    </div>
                </div>

                <!-- CINEMATIC MODE: timeline -->
                <div id="exec-timeline-section" class="bda-timeline-section">
                    <div class="bda-timeline-header">
                        <div class="bda-col-title">TIMELINE <span id="exec-tl-duration-label" class="bda-col-hint"></span></div>
                        <div class="bda-tl-zoom-controls" id="exec-tl-zoom-controls">
                            <span class="bda-tl-zoom-label">ZOOM</span>
                            <button type="button" class="bda-tl-zoom-btn active" data-zoom="1">1×</button>
                            <button type="button" class="bda-tl-zoom-btn" data-zoom="2">2×</button>
                            <button type="button" class="bda-tl-zoom-btn" data-zoom="3">3×</button>
                            <button type="button" class="bda-tl-zoom-btn" data-zoom="4">4×</button>
                        </div>
                        <button type="button" id="exec-preview-play" class="bda-preview-play-btn exec-cin-requires" disabled title="Preview execution cinematic">
                            <svg viewBox="0 0 14 14" width="12" height="12" fill="currentColor"><polygon points="2,1 12,7 2,13"/></svg>
                        </button>
                    </div>
                    <div id="exec-timeline" class="bda-timeline"></div>
                    <div class="bda-timeline-actions">
                        <button type="button" id="exec-add-seg" class="bda-btn exec-cin-requires" disabled>+ ADD BG SEGMENT</button>
                        <span class="bda-col-hint" style="margin-left:8px">drag segment body to move · drag edges to resize</span>
                    </div>
                </div>

                <!-- CINEMATIC MODE: segment settings -->
                <div id="exec-seg-section" class="bda-seg-section">
                    <div class="bda-col-title">BACKGROUND SEGMENT SETTINGS</div>
                    <div id="exec-seg-settings" class="bda-settings-panel bda-seg-settings-panel">
                        <div class="bda-settings-empty">Select a BG segment to edit.</div>
                    </div>
                </div>

                <div class="bda-editor-footer">
                    <div class="bda-footer-note">Triggered via <code>/execute name=&lt;name&gt;</code> — marks character dead after playback</div>
                    <div class="bda-footer-actions">
                        <button type="button" id="exec-save" class="bda-btn bda-btn-primary">SAVE</button>
                        <button type="button" id="exec-cancel" class="bda-btn">CLOSE</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        bindStaticEvents(overlay);
        return overlay;
    }

    function bindStaticEvents(overlay) {
        overlay.querySelector("#exec-editor-close")?.addEventListener("click", close);
        overlay.querySelector("#exec-cancel")?.addEventListener("click", close);
        overlay.addEventListener("click", e => { if (e.target === overlay) close(); });

        overlay.querySelector("#exec-cin-new")?.addEventListener("click", () => {
            const c = makeNewCin("New Execution");
            cinematics.push(c); activeCinId = c.id;
            selectedPinId = null; selectedSegId = null;
            renderAll();
        });
        overlay.querySelector("#exec-cin-delete")?.addEventListener("click", () => {
            if (!activeCinId) return;
            cinematics = cinematics.filter(c => c.id !== activeCinId);
            activeCinId = cinematics.length ? cinematics[cinematics.length - 1].id : null;
            selectedPinId = null; selectedSegId = null;
            renderAll();
        });
        overlay.querySelector("#exec-cin-select")?.addEventListener("change", e => {
            activeCinId = e.target.value || null; selectedPinId = null; selectedSegId = null;
            loadTimelineDuration().then(() => renderAll());
            renderAll();
        });
        overlay.querySelector("#exec-cin-name")?.addEventListener("input", e => {
            const c = getCin(); if (!c) return;
            c.name = e.target.value;
            const opt = overlay.querySelector(`#exec-cin-select option[value="${c.id}"]`);
            if (opt) opt.textContent = `${c.name || "(unnamed)"} [${c.type === "video" ? "VIDEO" : "CIN"}]`;
        });

        // Type toggle
        overlay.querySelector("#exec-type-cinematic")?.addEventListener("click", () => {
            const c = getCin(); if (!c) return;
            c.type = "cinematic"; renderAll();
        });
        overlay.querySelector("#exec-type-video")?.addEventListener("click", () => {
            const c = getCin(); if (!c) return;
            c.type = "video"; renderAll();
        });

        // Image upload
        overlay.querySelector("#exec-img-file")?.addEventListener("change", async e => {
            const files = Array.from(e.target.files || []);
            if (!files.length) return;
            const c = getCin(); if (!c) return;
            for (const file of files) {
                try {
                    const src = await readFileAsDataUrl(file);
                    c.images.push({ id: execGenId(), name: file.name, src });
                } catch (err) { console.error("[ExecCin] Image read error:", err); }
            }
            e.target.value = "";
            renderImagePanel(); renderSegSettings(); renderCgPreview();
        });

        // Enable image upload label when a cinematic is selected
        overlay.querySelector("#exec-img-upload-label")?.addEventListener("click", (e) => {
            if (!getCin()) { e.preventDefault(); return; }
        });

        overlay.querySelector("#exec-add-pin")?.addEventListener("click", () => {
            const c = getCin(); if (!c) return;
            const maxNum = c.pins.length ? Math.max(...c.pins.map(p => p.num ?? 0)) : 0;
            const pin = { id: execGenId(), num: maxNum + 1, xFrac: 0.5, yFrac: 0.5, timeFrac: 0.5, focusDurationMs: 800, zoom: 1.3 };
            c.pins.push(pin); selectedPinId = pin.id; selectedSegId = null;
            renderCgPreview(); renderTimeline(); renderPinSettings(); renderSegSettings(); renderToolbarState();
        });
        overlay.querySelector("#exec-add-seg")?.addEventListener("click", () => {
            const c = getCin(); if (!c) return;
            const lastEnd = c.bgSegments.length ? Math.max(...c.bgSegments.map(s => s.endFrac)) : 0;
            const startFrac = Math.min(lastEnd, 0.95), endFrac = Math.min(startFrac + 0.35, 1);
            const seg = { id: execGenId(), bgFile: "", startFrac, endFrac, fadeIn: 200, fadeOut: 200 };
            c.bgSegments.push(seg); selectedSegId = seg.id; selectedPinId = null;
            renderTimeline(); renderSegSettings(); renderPinSettings(); renderToolbarState();
        });
        overlay.querySelector("#exec-tl-zoom-controls")?.addEventListener("click", e => {
            const btn = e.target.closest(".bda-tl-zoom-btn");
            if (!btn) return;
            const z = Number(btn.dataset.zoom); if (!z) return;
            const tlEl = overlay.querySelector("#exec-timeline");
            const centerFrac = tlEl ? (tlEl.scrollLeft + tlEl.clientWidth/2) / (tlEl.clientWidth * timelineZoom) : 0.5;
            timelineZoom = z; renderTimeline();
            if (tlEl) tlEl.scrollLeft = centerFrac * tlEl.clientWidth * timelineZoom - tlEl.clientWidth/2;
            overlay.querySelectorAll(".bda-tl-zoom-btn").forEach(b => b.classList.toggle("active", Number(b.dataset.zoom) === timelineZoom));
        });
        overlay.querySelector("#exec-save")?.addEventListener("click", () => { saveCinematics([...cinematics]); });
        overlay.querySelector("#exec-preview-play")?.addEventListener("click", () => {
            if (previewAudio) stopPreview(); else startPreview();
        });

        const preview = overlay.querySelector("#exec-cg-preview");
        if (preview) {
            preview.addEventListener("pointerdown", onCgPointerDown);
            preview.addEventListener("pointermove", onCgPointerMove);
            preview.addEventListener("pointerup", onCgPointerUp);
            preview.addEventListener("pointercancel", onCgPointerUp);
        }
        const timeline = overlay.querySelector("#exec-timeline");
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
                    rightPin.timeFrac = execClamp(leftPin.timeFrac + (leftPin.focusDurationMs??800)/timelineDurationMs, 0, 1);
                }
            }
            selectedGapId = null;
            renderTimeline(); renderPinSettings(); renderSegSettings();
            e.preventDefault();
        }
    }

    // ── Open / close ──────────────────────────────────────────────────────────

    async function open() {
        if (isOpen) return;
        isOpen = true;
        cinematics = structuredClone(getCinematics() || []);
        activeCinId = cinematics.length ? cinematics[0].id : null;
        selectedPinId = null; selectedSegId = null; selectedGapId = null; dragging = null;

        const overlay = ensureOverlay();
        overlay.setAttribute("aria-hidden", "false");
        overlay.classList.add("active");
        document.addEventListener("keydown", onKeydown);

        if (activeCinId) loadTimelineDuration().then(() => renderAll());
        renderAll();
    }

    function close() {
        if (!isOpen) return;
        isOpen = false; dragging = null;
        stopPreview();
        timelineZoom = 1;
        const overlay = getOverlay();
        if (overlay) {
            overlay.querySelectorAll(".bda-tl-zoom-btn").forEach(b => b.classList.toggle("active", b.dataset.zoom === "1"));
            const tlEl = overlay.querySelector("#exec-timeline");
            if (tlEl) tlEl.scrollLeft = 0;
            overlay.classList.remove("active");
            overlay.setAttribute("aria-hidden", "true");
        }
        document.removeEventListener("keydown", onKeydown);
    }

    return { open, close };
}
