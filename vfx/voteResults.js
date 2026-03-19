const OVERLAY_ID = "dangan-vote-results-overlay";
const STYLE_ID   = "dangan-vote-results-style";
const NS         = "http://www.w3.org/2000/svg";

const SEG_COLORS = [
    "#e8449a", "#3ec8b8", "#f5a830", "#8844cc",
    "#44aa55", "#cc4444", "#3388dd", "#e06820",
];

// ── SVG helpers ──────────────────────────────────────────────────────────────

/** Build an arc-sector (donut slice) path. Angles start from top (12 o'clock) and go clockwise. */
function arcPath(cx, cy, rInner, rOuter, startDeg, endDeg) {
    const toRad = d => (d - 90) * Math.PI / 180;
    const a1 = toRad(startDeg), a2 = toRad(endDeg);
    const large = (endDeg - startDeg > 180) ? 1 : 0;
    const c1 = Math.cos(a1), s1 = Math.sin(a1);
    const c2 = Math.cos(a2), s2 = Math.sin(a2);
    const f = v => v.toFixed(2);
    return [
        `M ${f(cx + rOuter*c1)} ${f(cy + rOuter*s1)}`,
        `A ${f(rOuter)} ${f(rOuter)} 0 ${large} 1 ${f(cx + rOuter*c2)} ${f(cy + rOuter*s2)}`,
        `L ${f(cx + rInner*c2)} ${f(cy + rInner*s2)}`,
        `A ${f(rInner)} ${f(rInner)} 0 ${large} 0 ${f(cx + rInner*c1)} ${f(cy + rInner*s1)}`,
        `Z`,
    ].join(" ");
}

function svgEl(tag, attrs = {}) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
}

/** Darken a hex colour by a factor (0 = black, 1 = full colour). */
function dim(hex, factor = 0.22) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.round(r*factor)},${Math.round(g*factor)},${Math.round(b*factor)})`;
}

// ── CSS ──────────────────────────────────────────────────────────────────────

function buildStyles() {
    return `
    #${OVERLAY_ID} {
        position: fixed; inset: 0; z-index: 2147483646;
        background: rgba(6, 0, 18, 0.96);
        display: flex; flex-direction: column;
        align-items: center; justify-content: center; gap: 22px;
        opacity: 0; transition: opacity 350ms ease; pointer-events: none;
    }
    #${OVERLAY_ID}.vr-on { opacity: 1; }

    .vr-wheel-wrap { position: relative; display: inline-block; }

    .vr-title {
        font-family: "Orbitron","Impact",sans-serif;
        font-size: clamp(22px, 5vw, 52px); font-weight: 900; letter-spacing: 5px;
        color: #fff; text-transform: uppercase;
        text-shadow: 0 0 14px #ff2222, 0 0 44px #ff1111, 4px 4px 0 #660000;
        -webkit-text-stroke: 2px #990000;
        animation: vrTG 2.2s ease-in-out infinite;
    }
    @keyframes vrTG {
        0%,100% { text-shadow: 0 0 14px #ff2222, 0 0 44px #ff1111, 4px 4px 0 #660000; }
        50%      { text-shadow: 0 0 28px #ff5555, 0 0 90px #ff0000, 4px 4px 0 #660000; }
    }

    #vr-result {
        position: absolute; inset: 0;
        z-index: 2;
        opacity: 0; transition: opacity 280ms ease; pointer-events: none;
    }
    #vr-result.vr-on { opacity: 1; pointer-events: auto; }
    .vr-rp {
        position: absolute; top: 50%; left: 50%;
        transform: translate(-50%, -50%) scale(0);
        border-radius: 50%; overflow: hidden; border: 3px solid #ffe000;
        box-shadow: 0 0 20px #ffe000, 0 0 40px #ff9900; background: #2a1a4a;
        opacity: 0;
        transition: transform 360ms cubic-bezier(0.34,1.56,0.64,1), opacity 260ms ease;
    }
    .vr-rp.vr-pop { transform: translate(-50%, -50%) scale(1); opacity: 1; }
    .vr-rp img { width: 100%; height: 100%; object-fit: cover; object-position: top center; }
    .vr-rn {
        font-family: "Orbitron","Impact",sans-serif;
        font-size: clamp(16px,3vw,32px); font-weight: 900; letter-spacing: 3px;
        color: #ffe000; text-transform: uppercase;
        text-shadow: 0 0 14px #ff9900, 0 0 30px #ff6600, 3px 3px 0 #663300;
        text-align: center; word-break: break-word;
        transform: translateY(10px); opacity: 0;
        transition: transform 360ms 110ms cubic-bezier(0.34,1.56,0.64,1), opacity 260ms 110ms ease;
    }
    .vr-rn.vr-pop { transform: translateY(0); opacity: 1; }
    .vr-hint {
        font-family: "Orbitron",sans-serif; font-size: 11px; letter-spacing: 2px;
        color: rgba(255,255,255,.44); animation: vrBlink 1.7s ease-in-out infinite;
    }
    @keyframes vrBlink { 0%,100% { opacity:.44; } 50% { opacity:.9; } }
    `;
}

// ── Controller ───────────────────────────────────────────────────────────────

export function createVoteResultsController({ getCharacters, getSpriteUrl, getUserAvatarUrl, extensionFolderPath }) {

    function destroy() {
        document.getElementById(OVERLAY_ID)?.remove();
        document.getElementById(STYLE_ID)?.remove();
    }

    async function run({ guess: guessArg = null, result: resultArg = null } = {}) {
        const allChars = [...(getCharacters?.() ?? [])].filter(c => !c.dead && !c.missing);
        if (allChars.length < 2) { console.warn("[VoteResults] Not enough living characters."); return; }

        const n       = 16; // always 16 slots; spare slots are empty
        const segDeg  = 360 / n;
        const gapDeg  = Math.min(1.5, segDeg * 0.06);

        const charCount = allChars.length;

        // Spinner lands on the actual result — random if not provided
        let targetIdx;
        if (resultArg) {
            const q = resultArg.toLowerCase().trim();
            const f = allChars.findIndex(c => c.name.toLowerCase().includes(q));
            targetIdx = f >= 0 ? f : Math.floor(Math.random() * charCount);
        } else {
            targetIdx = Math.floor(Math.random() * charCount);
        }

        // Guess — who was voted for; fail if it doesn't match result
        let guessIdx = targetIdx; // default: guess matches result (success)
        if (guessArg) {
            const q = guessArg.toLowerCase().trim();
            const f = allChars.findIndex(c => c.name.toLowerCase().includes(q));
            guessIdx = f >= 0 ? f : targetIdx;
        }

        const failed = guessIdx !== targetIdx;

        // Load portraits
        const imageUrls = await Promise.all(allChars.map(async char => {
            try {
                return char.isPlayer
                    ? (getUserAvatarUrl?.() || null)
                    : (await getSpriteUrl?.(char.name) ?? null);
            } catch { return null; }
        }));

        destroy();

        // Dimensions
        const size = Math.min(Math.round(Math.min(window.innerWidth, window.innerHeight) * 0.64), 500);
        const cx = size / 2, cy = size / 2;
        const Ro  = size / 2 - 6;       // outer edge of char ring
        const Rci = Ro   * 0.655;        // inner edge of char ring / outer edge of color ring
        const Rco = Rci;                  // same — share boundary
        const Rin = Ro   * 0.385;        // inner edge of color ring (center radius)

        // Inject styles
        const styleEl = document.createElement("style");
        styleEl.id = STYLE_ID;
        styleEl.textContent = buildStyles();
        document.head.appendChild(styleEl);

        // ── Build SVG ─────────────────────────────────────────────────────────

        const svg = svgEl("svg", {
            viewBox: `0 0 ${size} ${size}`,
            width: size, height: size,
            style: "display:block;overflow:visible",
        });
        const defs = svgEl("defs");
        svg.appendChild(defs);

        // Glow filter
        const fGlow = svgEl("filter", { id:"vr-glow", x:"-50%", y:"-50%", width:"200%", height:"200%" });
        fGlow.innerHTML = `<feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>`;
        defs.appendChild(fGlow);

        // Gold gradient
        const gGold = svgEl("linearGradient", { id:"vr-gold", x1:"0%", y1:"0%", x2:"100%", y2:"100%" });
        gGold.innerHTML = `<stop offset="0%"   stop-color="#b07008"/>
            <stop offset="30%"  stop-color="#f5c842"/>
            <stop offset="60%"  stop-color="#b07008"/>
            <stop offset="100%" stop-color="#f5c842"/>`;
        defs.appendChild(gGold);

        // Center gradient
        const gCentre = svgEl("radialGradient", { id:"vr-cg", cx:"40%", cy:"35%" });
        gCentre.innerHTML = `<stop offset="0%" stop-color="#1a1a1a"/>
            <stop offset="100%" stop-color="#000"/>`;
        defs.appendChild(gCentre);

        // Dark base circle
        svg.appendChild(svgEl("circle", { cx, cy, r: Ro, fill:"#0c0018", stroke:"#28004a", "stroke-width":"2" }));

        // Per-section elements
        const innerPaths = [];  // inner color ring sections
        const outerPaths = [];  // outer character ring sections
        const portBorders = []; // portrait glow borders

        for (let i = 0; i < n; i++) {
            const sA = i * segDeg + gapDeg;
            const eA = (i + 1) * segDeg - gapDeg;
            const midA = (sA + eA) / 2;
            const midRad = (midA - 90) * Math.PI / 180;
            const color = SEG_COLORS[i % SEG_COLORS.length];
            // Outer ring alternates red / near-black
            const outerBase = i % 2 === 0 ? "#7a0a0a" : "#222222";
            const outerLit  = i % 2 === 0 ? "#ff2222" : "#666666";

            // Inner color section
            const ip = svgEl("path", {
                d: arcPath(cx, cy, Rin, Rci, sA, eA),
                fill: "#0a0a0a",
                stroke: "#0c0018", "stroke-width": "1.5",
            });
            svg.appendChild(ip);
            innerPaths.push({ el: ip, color });

            // Outer character section background
            const op = svgEl("path", {
                d: arcPath(cx, cy, Rci, Ro, sA, eA),
                fill: outerBase,
                stroke: "#0c0018", "stroke-width": "1.5",
            });
            svg.appendChild(op);
            outerPaths.push({ el: op, color, outerBase, outerLit });

            // Portrait position
            const midCharR = (Rci + Ro) / 2;
            const pcx = cx + midCharR * Math.cos(midRad);
            const pcy = cy + midCharR * Math.sin(midRad);
            const pr  = (Ro - Rci) * 0.30;

            // Clip path for circular portrait
            const cpId = `vr-cp-${i}`;
            const cp = svgEl("clipPath", { id: cpId });
            cp.appendChild(svgEl("circle", { cx: pcx.toFixed(2), cy: pcy.toFixed(2), r: pr.toFixed(2) }));
            defs.appendChild(cp);

            // Portrait fallback bg (alternates red/black, highlighted when active)
            const portBg = svgEl("circle", {
                cx: pcx.toFixed(2), cy: pcy.toFixed(2), r: pr.toFixed(2),
                fill: outerBase,
            });
            svg.appendChild(portBg);

            // Portrait image or initials (empty slot if no character at this index)
            const char = allChars[i];
            if (char && imageUrls[i]) {
                const imgEl = svgEl("image", {
                    href: imageUrls[i],
                    x: (pcx - pr).toFixed(2), y: (pcy - pr).toFixed(2),
                    width: (pr * 2).toFixed(2), height: (pr * 2).toFixed(2),
                    "clip-path": `url(#${cpId})`,
                    preserveAspectRatio: "xMidYMin slice",
                });
                svg.appendChild(imgEl);
            } else if (char) {
                const tx = svgEl("text", {
                    x: pcx.toFixed(2), y: (pcy + pr * 0.35).toFixed(2),
                    "text-anchor": "middle",
                    "font-family": "Orbitron,sans-serif",
                    "font-size": (pr * 0.75).toFixed(2),
                    "font-weight": "bold", fill: "#fff",
                    "clip-path": `url(#${cpId})`,
                });
                tx.textContent = char.name.slice(0, 2).toUpperCase();
                svg.appendChild(tx);
            }
            // else: empty slot — just shows the dimmed colour background

            // Portrait border ring
            const pb = svgEl("circle", {
                cx: pcx.toFixed(2), cy: pcy.toFixed(2), r: pr.toFixed(2),
                fill: "none", stroke: "rgba(255,255,255,0.45)", "stroke-width": "2",
            });
            svg.appendChild(pb);
            portBorders.push({ bg: portBg, border: pb, outerBase, outerLit });
        }

        // Gold dividing ring (char / color boundary)
        svg.appendChild(svgEl("circle", {
            cx, cy, r: Rci.toFixed(2),
            fill: "none", stroke: "url(#vr-gold)", "stroke-width": "4",
        }));
        // Gold outer ring border
        svg.appendChild(svgEl("circle", {
            cx, cy, r: Ro.toFixed(2),
            fill: "none", stroke: "url(#vr-gold)", "stroke-width": "6",
        }));

        // Centre circle — no fill, image covers it entirely
        svg.appendChild(svgEl("circle", {
            cx, cy, r: (Rin - 2).toFixed(2),
            fill: "#000", stroke: "#c8860a", "stroke-width": "3",
        }));

        // Monokuma in centre — fills the full centre circle
        const monoR = Rin - 4;
        const monoClipId = "vr-mono-cp";
        const mc = svgEl("clipPath", { id: monoClipId });
        mc.appendChild(svgEl("circle", { cx, cy, r: monoR.toFixed(2) }));
        defs.appendChild(mc);
        const monoImg = svgEl("image", {
            href: `${extensionFolderPath}/assets/monokuma/monokuma-vote-face.png`,
            x: (cx - monoR).toFixed(2), y: (cy - monoR).toFixed(2),
            width: (monoR * 2).toFixed(2), height: (monoR * 2).toFixed(2),
            "clip-path": `url(#${monoClipId})`,
            preserveAspectRatio: "xMidYMid meet",
            opacity: "1",
        });
        svg.appendChild(monoImg);
        // Centre ring border (on top)
        svg.appendChild(svgEl("circle", {
            cx, cy, r: (Rin - 2).toFixed(2),
            fill: "none", stroke: "#c8860a", "stroke-width": "3",
        }));

        // ── Build overlay ─────────────────────────────────────────────────────

        const overlay = document.createElement("div");
        overlay.id = OVERLAY_ID;
        overlay.innerHTML = `
            <div class="vr-title">VOTE RESULTS</div>
            <div class="vr-wheel-wrap"></div>
            <div class="vr-rn" id="vr-result-name"></div>
            <div class="vr-hint" id="vr-hint" style="opacity:0;transition:opacity 280ms ease">CLICK ANYWHERE TO DISMISS</div>`;
        const wheelWrap = overlay.querySelector(".vr-wheel-wrap");
        wheelWrap.appendChild(svg);

        // Portrait only lives inside the wheel center
        const rpDiam = Math.round(Rin * 1.8);
        const resultEl = document.createElement("div");
        resultEl.id = "vr-result";
        resultEl.innerHTML = `<div class="vr-rp" style="width:${rpDiam}px;height:${rpDiam}px"></div>`;
        wheelWrap.appendChild(resultEl);

        document.body.appendChild(overlay);

        // ── Lighting helpers ──────────────────────────────────────────────────

        function setLit(idx) {
            for (let j = 0; j < n; j++) {
                const on = j === idx;
                // Inner ring: yellow when lit, pure black otherwise
                innerPaths[j].el.setAttribute("fill",   on ? "#ffe000" : "#0a0a0a");
                innerPaths[j].el.setAttribute("filter", on ? "url(#vr-glow)" : "");
                // Outer ring + portrait: highlight when spinner is on this section
                const { outerBase, outerLit } = outerPaths[j];
                outerPaths[j].el.setAttribute("fill", on ? outerLit : outerBase);
                if (portBorders[j]) {
                    portBorders[j].bg.setAttribute("fill", on ? outerLit : outerBase);
                    portBorders[j].border.setAttribute("stroke",
                        on ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.45)");
                }
            }
        }

        // ── Audio ─────────────────────────────────────────────────────────────
        const tickSrc  = `${extensionFolderPath}/assets/monokuma/vote-tick.wav`;

        // ── Spin animation ────────────────────────────────────────────────────

        // Section 0 starts at top. After k steps clockwise the lit section is k % n.
        // Land on guessIdx so an incorrect guess visually lands on the wrong person.
        const extraSteps  = ((guessIdx % n) + n) % n || n;
        const totalSteps  = 3 * n + extraSteps;
        const slowStart   = totalSteps - 2 * n;   // begin ease-out here
        const fastDelay   = 50;

        function stepDelay(step) {
            if (step < slowStart) return fastDelay;
            const t = (step - slowStart) / Math.max(1, totalSteps - slowStart - 1);
            return fastDelay + t * t * 580;         // 50ms → ~630ms
        }

        setLit(0);
        requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add("vr-on")));

        await new Promise(resolve => {
            let step = 0;
            function tick() {
                step++;
                setLit(step % n);
                // Play tick sound on each highlight
                const tickAudio = new Audio(tickSrc);
                tickAudio.play().catch(() => {});
                if (step < totalSteps) {
                    setTimeout(tick, stepDelay(step));
                } else {
                    setLit(guessIdx);
                    setTimeout(() => showResult(guessIdx, allChars, imageUrls, resultEl, failed, resolve), 500);
                }
            }
            // Play intro, then start spinning after 2.5s
            const introAudio = new Audio(`${extensionFolderPath}/assets/monokuma/vote-intro.wav`);
            introAudio.loop = false;
            introAudio.play().catch(e => console.warn("[VoteResults] intro play failed:", e));
            setTimeout(tick, 2500);
        });
    }

    function showResult(targetIdx, allChars, imageUrls, resultEl, failed, resolve) {
        const overlay = document.getElementById(OVERLAY_ID);

        let resultAudio;
        if (failed) {
            resultAudio = new Audio(`${extensionFolderPath}/assets/monokuma/trial-vote-incorrect.wav`);
            resultAudio.loop = true;
        } else {
            resultAudio = new Audio(`${extensionFolderPath}/assets/monokuma/trial-vote-correct.wav`);
            resultAudio.loop = false;
        }
        resultAudio.play().catch(e => console.warn("[VoteResults] result audio play failed:", e));

        // Monocoins only on success
        let coinTimeout = null;
        const coinStopRef = { stop: false };
        if (!failed) {
            resultAudio.addEventListener("loadedmetadata", () => {
                const stopDelay = Math.max(0, (resultAudio.duration - 8) * 1000);
                setTimeout(() => { coinStopRef.stop = true; }, stopDelay);
            }, { once: true });
            coinTimeout = setTimeout(() => {
                startMonocoinWave(extensionFolderPath, coinStopRef);
            }, 4000);
        }

        const char   = allChars[targetIdx];
        const imgSrc = imageUrls[targetIdx];
        const portEl = resultEl.querySelector(".vr-rp");
        const nameEl = document.getElementById("vr-result-name");

        if (portEl) portEl.innerHTML = imgSrc
            ? `<img src="${imgSrc}" alt="${char.name}">`
            : `<span style="font-size:2em;color:#fff">${char.name.slice(0,2).toUpperCase()}</span>`;
        if (nameEl) nameEl.textContent = char.name.toUpperCase();

        resultEl.classList.add("vr-on");
        requestAnimationFrame(() => requestAnimationFrame(() => {
            portEl?.classList.add("vr-pop");
            nameEl?.classList.add("vr-pop");
            const hintEl = document.getElementById("vr-hint");
            if (hintEl) hintEl.style.opacity = "1";
            if (overlay) overlay.style.pointerEvents = "auto";
            // Pixel X on failure
            if (failed) showFailX(overlay);
        }));

        function dismiss() {
            clearTimeout(coinTimeout);
            coinStopRef.stop = true;
            resultAudio?.pause();
            overlay.style.transition = "opacity 300ms ease";
            overlay.style.opacity = "0";
            setTimeout(destroy, 320);
            resolve();
        }

        if (overlay) {
            overlay.addEventListener("click", dismiss, { once: true });
        } else {
            setTimeout(dismiss, 6000);
        }
    }

    function showFailX(overlay) {
        // Find the wheel SVG to get its bounding box for sizing/positioning
        const wheelWrap = overlay.querySelector(".vr-wheel-wrap");
        const svg = wheelWrap?.querySelector("svg");
        if (!svg) return;

        const rect = svg.getBoundingClientRect();
        const wrapRect = wheelWrap.getBoundingClientRect();
        const size = rect.width;

        // Pixel X drawn as SVG rects — 8×8 grid of squares forming an X
        const GRID = 16;
        const cell = size / GRID;
        // X pattern: squares where |col - row| <= 1 or |col - (GRID-1-row)| <= 1
        const thickness = 2; // cells thick per arm

        const xSvg = document.createElementNS(NS, "svg");
        xSvg.setAttribute("width",  size);
        xSvg.setAttribute("height", size);
        xSvg.setAttribute("viewBox", `0 0 ${size} ${size}`);
        Object.assign(xSvg.style, {
            position: "absolute",
            left: (rect.left - wrapRect.left) + "px",
            top:  (rect.top  - wrapRect.top)  + "px",
            pointerEvents: "none",
            zIndex: "10",
            opacity: "0",
            transition: "opacity 400ms ease",
        });

        // Glow filter
        const xDefs = document.createElementNS(NS, "defs");
        xDefs.innerHTML = `<filter id="vr-x-glow" x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3"  result="blur1"/>
            <feGaussianBlur in="SourceGraphic" stdDeviation="8"  result="blur2"/>
            <feGaussianBlur in="SourceGraphic" stdDeviation="18" result="blur3"/>
            <feColorMatrix in="blur2" type="matrix" values="1 0 0 0 1  0 0 0 0 0  0 0 0 0 0  0 0 0 3 0" result="red2"/>
            <feColorMatrix in="blur3" type="matrix" values="1 0 0 0 1  0 0 0 0 0  0 0 0 0 0  0 0 0 2 0" result="red3"/>
            <feMerge>
                <feMergeNode in="red3"/>
                <feMergeNode in="red2"/>
                <feMergeNode in="blur1"/>
                <feMergeNode in="SourceGraphic"/>
            </feMerge>
        </filter>`;
        // Pulse animation
        const styleId = "vr-x-pulse-style";
        if (!document.getElementById(styleId)) {
            const ps = document.createElement("style");
            ps.id = styleId;
            ps.textContent = `@keyframes vrXPulse {
                0%,100% { opacity:1; filter: brightness(1); }
                50%      { opacity:0.55; filter: brightness(2.4); }
            }
            .vr-x-pulse { animation: vrXPulse 0.7s ease-in-out infinite; }`;
            document.head.appendChild(ps);
        }
        xSvg.appendChild(xDefs);

        const g = document.createElementNS(NS, "g");
        g.setAttribute("filter", "url(#vr-x-glow)");

        for (let row = 0; row < GRID; row++) {
            for (let col = 0; col < GRID; col++) {
                const onDiag1 = Math.abs(col - row)            < thickness;
                const onDiag2 = Math.abs(col - (GRID-1 - row)) < thickness;
                if (!onDiag1 && !onDiag2) continue;
                const r = document.createElementNS(NS, "rect");
                r.setAttribute("x",      (col * cell + 1).toFixed(1));
                r.setAttribute("y",      (row * cell + 1).toFixed(1));
                r.setAttribute("width",  (cell - 2).toFixed(1));
                r.setAttribute("height", (cell - 2).toFixed(1));
                r.setAttribute("fill",   "#ff2222");
                g.appendChild(r);
            }
        }
        xSvg.appendChild(g);
        wheelWrap.appendChild(xSvg);

        requestAnimationFrame(() => requestAnimationFrame(() => {
            xSvg.style.opacity = "1";
            xSvg.classList.add("vr-x-pulse");
        }));
    }

    function startMonocoinWave(folderPath, stopRef) {
        const W = window.innerWidth;
        const H = window.innerHeight;

        const canvas = document.createElement("canvas");
        canvas.width  = W;
        canvas.height = H;
        Object.assign(canvas.style, {
            position: "fixed", inset: "0", zIndex: "2147483647",
            pointerEvents: "none",
        });
        document.body.appendChild(canvas);
        const ctx = canvas.getContext("2d");

        const img = new Image();
        img.src = `${folderPath}/assets/monocoin.png`;

        const COIN_SIZE     = 38;
        const GRAVITY       = 0.45;
        const SPAWN_RATE_MS = 55;   // ms between coins per stream
        const STREAM_SPREAD = 28;   // px horizontal scatter around stream centre
        const coins = [];
        let spawning = true;

        // 4 streams evenly spread across the screen width
        const streamXs = [0,1,2,3,4,5,6,7,8,9,10,11].map(i => W * (i + 0.5) / 12);
        const SWAY_AMP  = W * 0.032; // how far each stream sways side to side
        const SWAY_FREQ = 0.00065;   // radians per ms
        const startTime = performance.now();

        function spawnFromStream(sx, phaseOffset) {
            if (stopRef.stop) { spawning = false; return; }
            const sway = Math.sin((performance.now() - startTime) * SWAY_FREQ + phaseOffset) * SWAY_AMP;
            const x  = sx + sway + (Math.random() - 0.5) * STREAM_SPREAD;
            const vy = -(Math.sqrt(2 * GRAVITY * H * (0.40 + Math.random() * 0.38)));
            coins.push({
                x, y: H + COIN_SIZE,
                vx: (Math.random() - 0.5) * 2.2,
                vy,
                rot: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.20,
            });
            setTimeout(() => spawnFromStream(sx, phaseOffset), SPAWN_RATE_MS + Math.random() * 20);
        }

        function startStreams() {
            const STREAM_STAGGER = 120;
            streamXs.forEach((sx, i) => {
                const phase = (i / streamXs.length) * Math.PI * 2; // spread phases evenly
                setTimeout(() => spawnFromStream(sx, phase), i * STREAM_STAGGER);
            });
        }

        img.onload  = startStreams;
        img.onerror = startStreams;

        let lastT = null;
        function frame(t) {
            if (!lastT) lastT = t;
            const dt = Math.min(t - lastT, 40);
            lastT = t;
            const dtFactor = dt / 16.67; // normalise to 60fps

            ctx.clearRect(0, 0, W, H);

            for (let i = coins.length - 1; i >= 0; i--) {
                const c = coins[i];
                c.vy  += GRAVITY * dtFactor;
                c.x   += c.vx   * dtFactor;
                c.y   += c.vy   * dtFactor;
                c.rot += c.rotSpeed * dtFactor;

                // Remove coins that have fallen fully off bottom
                if (c.y > H + COIN_SIZE * 2) {
                    coins.splice(i, 1);
                    continue;
                }

                ctx.save();
                ctx.translate(c.x, c.y);
                ctx.rotate(c.rot);
                if (img.complete && img.naturalWidth) {
                    ctx.drawImage(img, -COIN_SIZE / 2, -COIN_SIZE / 2, COIN_SIZE, COIN_SIZE);
                } else {
                    // Fallback gold circle
                    ctx.beginPath();
                    ctx.arc(0, 0, COIN_SIZE / 2, 0, Math.PI * 2);
                    ctx.fillStyle = "#f5c842";
                    ctx.fill();
                }
                ctx.restore();
            }

            // Keep looping while coins remain or spawning is still happening
            if (coins.length > 0 || spawning) {
                requestAnimationFrame(frame);
            } else {
                canvas.remove();
            }
        }

        requestAnimationFrame(frame);
    }

    return { run };
}
