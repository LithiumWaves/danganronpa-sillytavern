// V3-style refute sequence for Non-Stop / Mass Panic Debates.
//
// Plays when a Truth Bullet lands on a weak point:
//   1. hit-stop      — white flash, weak point shudders, debate freezes
//   2. shatter       — the statement breaks into flying glyphs
//   3. lightning     — yellow burst + bolts, then a green "alert" grade with red tracer lines
//   4. Counter       — diagonal blue band with speedlines, ink splats, counter.png
//                      lettering and the player's portrait
//   5. glass break   — the cut-in cracks and its shards fly at the camera
//   6. Break         — brushed "Break" on black, revealed like a brush stroke
//
// Skippable (Escape via the skip registry, or click / any key once the
// Counter cut-in has landed). Resolves when everything has been removed.

import { createSkipToken, pushSkippable } from "../core/skip/skipRegistry.js";

const Z = 2147483647;
const BRUSH_FAMILY = "DanganNsdBrush";
let brushFontPromise = null;

function loadBrushFont() {
    if (brushFontPromise) return brushFontPromise;
    try {
        const url = new URL("../assets/fonts/emotion/Spell of Asia.ttf", import.meta.url).href;
        const face = new FontFace(BRUSH_FAMILY, `url("${url}")`);
        brushFontPromise = face.load().then(f => { document.fonts.add(f); return true; }).catch(() => false);
    } catch {
        brushFontPromise = Promise.resolve(false);
    }
    return brushFontPromise;
}

export function preloadRefuteAssets({ counterImgUrl, playerSpriteUrl } = {}) {
    loadBrushFont();
    for (const src of [counterImgUrl, playerSpriteUrl]) {
        if (!src) continue;
        const img = new Image();
        img.decoding = "async";
        img.src = src;
    }
}

function reducedMotion() {
    try { return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true; } catch { return false; }
}

function el(tag, cssText, parent) {
    const node = document.createElement(tag);
    if (cssText) node.style.cssText = cssText;
    if (parent) parent.appendChild(node);
    return node;
}

function rand(a, b) { return a + Math.random() * (b - a); }

// ── 2. Statement → flying glyphs ────────────────────────────────────────────
function shatterStatement(statementEl, impactX, impactY, layer) {
    if (!statementEl || !document.body.contains(statementEl)) return;
    const glyphs = [];
    const walker = document.createTreeWalker(statementEl, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let node;
    while ((node = walker.nextNode()) && glyphs.length < 180) {
        const parent = node.parentElement;
        if (!parent) continue;
        const cs = getComputedStyle(parent);
        const isWeak = !!parent.closest(".dangan-weak-point");
        const text = node.textContent || "";
        for (let i = 0; i < text.length && glyphs.length < 180; i++) {
            const ch = text[i];
            if (!ch.trim()) continue;
            range.setStart(node, i);
            range.setEnd(node, i + 1);
            const r = range.getBoundingClientRect();
            if (!r.width || !r.height) continue;
            glyphs.push({ ch, r, font: cs.font, isWeak });
        }
    }
    statementEl.style.visibility = "hidden";
    for (const g of glyphs) {
        const span = el("div", `position:fixed;left:${g.r.left}px;top:${g.r.top}px;width:${g.r.width}px;height:${g.r.height}px;
            display:flex;align-items:center;justify-content:center;font:${g.font};line-height:1;white-space:pre;
            color:${g.isWeak ? "#ffb21a" : "#fff"};
            text-shadow:${g.isWeak ? "0 0 12px rgba(255,160,0,.9)" : "0 0 8px rgba(120,200,255,.9)"};will-change:transform,opacity;`, layer);
        span.textContent = g.ch;
        const cx = g.r.left + g.r.width / 2;
        const cy = g.r.top + g.r.height / 2;
        let ang = Math.atan2(cy - impactY, cx - impactX);
        if (!Number.isFinite(ang)) ang = rand(0, Math.PI * 2);
        ang += rand(-0.5, 0.5);
        const dist = rand(260, 820);
        span.animate([
            { transform: "translate(0,0) rotate(0deg) scale(1)", opacity: 1, filter: "blur(0px)" },
            { transform: `translate(${Math.cos(ang) * dist * 0.35}px,${Math.sin(ang) * dist * 0.35}px) rotate(${rand(-200, 200)}deg) scale(${rand(1.1, 1.8)})`, opacity: 1, filter: "blur(0px)", offset: 0.25 },
            { transform: `translate(${Math.cos(ang) * dist}px,${Math.sin(ang) * dist}px) rotate(${rand(-720, 720)}deg) scale(${rand(0.2, 0.7)})`, opacity: 0, filter: "blur(3px)" },
        ], { duration: rand(600, 900), easing: "cubic-bezier(.12,.75,.3,1)", fill: "forwards" });
    }
}

// ── 3. Lightning + green alert grade ────────────────────────────────────────
function boltPath(x0, y0, x1, y1) {
    const segs = 9;
    const pts = [[x0, y0]];
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    for (let i = 1; i < segs; i++) {
        const t = i / segs;
        const off = rand(-1, 1) * len * 0.06;
        pts.push([x0 + dx * t + nx * off, y0 + dy * t + ny * off]);
    }
    pts.push([x1, y1]);
    return pts.map(p => p.map(v => v.toFixed(1)).join(",")).join(" ");
}

function lightning(layer, x, y, sceneEl, isMpd) {
    const W = window.innerWidth, H = window.innerHeight;
    const burst = el("div", `position:fixed;inset:0;pointer-events:none;mix-blend-mode:screen;
        background:radial-gradient(circle at ${x}px ${y}px, rgba(255,255,255,1) 0, rgba(255,240,140,.95) 8%, rgba(255,200,40,.55) 24%, rgba(255,170,0,0) 55%);`, layer);
    burst.animate([{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 0.85, offset: 0.5 }, { opacity: 0 }],
        { duration: 700, easing: "ease-out", fill: "forwards" });

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", W);
    svg.setAttribute("height", H);
    svg.style.cssText = "position:fixed;inset:0;pointer-events:none;overflow:visible;filter:drop-shadow(0 0 6px #fff6a0) drop-shadow(0 0 18px #ffc400);";
    const n = 9;
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rand(-0.3, 0.3);
        const r = Math.hypot(W, H) * rand(0.35, 0.7);
        const pl = document.createElementNS(svgNS, "polyline");
        pl.setAttribute("points", boltPath(x, y, x + Math.cos(a) * r, y + Math.sin(a) * r));
        pl.setAttribute("fill", "none");
        pl.setAttribute("stroke", i % 3 === 0 ? "#ffffff" : "#fff3a8");
        pl.setAttribute("stroke-width", String(rand(3, 9)));
        pl.setAttribute("stroke-linejoin", "bevel");
        svg.appendChild(pl);
    }
    layer.appendChild(svg);
    svg.animate([{ opacity: 1 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }], { duration: 520, fill: "forwards" });

    // Green alert grade with red tracer lines converging on the hit.
    if (sceneEl && !isMpd) {
        sceneEl.animate([
            { filter: "none" },
            { filter: "brightness(1.8) saturate(1.6)", offset: 0.12 },
            { filter: "sepia(1) hue-rotate(55deg) saturate(3.2) brightness(.95)", offset: 0.35 },
            { filter: "sepia(1) hue-rotate(55deg) saturate(3.2) brightness(.9)", offset: 0.9 },
            { filter: "none" },
        ], { duration: 1100, easing: "linear" });
    }
    const tracers = document.createElementNS(svgNS, "svg");
    tracers.setAttribute("width", W);
    tracers.setAttribute("height", H);
    tracers.style.cssText = "position:fixed;inset:0;pointer-events:none;filter:drop-shadow(0 0 4px #ff2a2a);";
    for (const [sx, sy] of [[0, H * rand(0.1, 0.4)], [W, H * rand(0.6, 0.95)], [W * rand(0.6, 0.9), 0]]) {
        const ln = document.createElementNS(svgNS, "line");
        ln.setAttribute("x1", sx); ln.setAttribute("y1", sy);
        ln.setAttribute("x2", x); ln.setAttribute("y2", y);
        ln.setAttribute("stroke", "#ff3030");
        ln.setAttribute("stroke-width", "2.5");
        const len = Math.hypot(x - sx, y - sy);
        ln.setAttribute("stroke-dasharray", String(len));
        ln.setAttribute("stroke-dashoffset", String(len));
        ln.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 260, delay: 240, easing: "ease-out", fill: "forwards" });
        tracers.appendChild(ln);
    }
    layer.appendChild(tracers);
    tracers.animate([{ opacity: 1 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }], { duration: 1050, fill: "forwards" });
}

// ── 4. Counter cut-in ───────────────────────────────────────────────────────
const BAND_CLIP = "polygon(0% 22%, 100% 6%, 100% 80%, 0% 96%)";

function inkSplats(svgNS, W, H) {
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;";
    // Clusters along the band's top-left and bottom-right edges, plus a couple of drips.
    const clusters = [
        { x: W * 0.06, y: H * 0.2 }, { x: W * 0.32, y: H * 0.16 }, { x: W * 0.94, y: H * 0.1 },
        { x: W * 0.9, y: H * 0.8 }, { x: W * 0.55, y: H * 0.88 }, { x: W * 0.12, y: H * 0.93 },
    ];
    for (const c of clusters) {
        const n = 4 + Math.floor(Math.random() * 6);
        for (let i = 0; i < n; i++) {
            const circ = document.createElementNS(svgNS, "ellipse");
            const r = i === 0 ? rand(18, 46) : rand(3, 16);
            circ.setAttribute("cx", (c.x + rand(-70, 70)).toFixed(1));
            circ.setAttribute("cy", (c.y + rand(-28, 28)).toFixed(1));
            circ.setAttribute("rx", r.toFixed(1));
            circ.setAttribute("ry", (r * rand(0.6, 1.1)).toFixed(1));
            circ.setAttribute("fill", "#05060c");
            svg.appendChild(circ);
        }
        const drip = document.createElementNS(svgNS, "rect");
        drip.setAttribute("x", (c.x + rand(-30, 30)).toFixed(1));
        drip.setAttribute("y", c.y.toFixed(1));
        drip.setAttribute("width", rand(3, 7).toFixed(1));
        drip.setAttribute("height", rand(30, 90).toFixed(1));
        drip.setAttribute("rx", "3");
        drip.setAttribute("fill", "#05060c");
        svg.appendChild(drip);
    }
    return svg;
}

function buildCutin(layer, { counterImgUrl, playerSpriteUrl, isMpd }) {
    const W = window.innerWidth, H = window.innerHeight;
    const svgNS = "http://www.w3.org/2000/svg";
    const root = el("div", "position:fixed;inset:0;pointer-events:none;overflow:hidden;", layer);

    // Dim the scene behind the band.
    el("div", "position:absolute;inset:0;background:rgba(4,6,20,.55);", root);

    const band = el("div", `position:absolute;inset:0;clip-path:${BAND_CLIP};overflow:hidden;
        background:${isMpd
            ? "linear-gradient(100deg,#5a0010 0%,#c0182c 45%,#ff5a3c 100%)"
            : "linear-gradient(100deg,#062a6e 0%,#0b6fd6 40%,#26c6ff 78%,#9ef0ff 100%)"};`, root);
    band.className = "nsdr-band";
    // Speedlines.
    // Horizontal streaks broken into dashes by a mask, scrolled sideways.
    const speed = el("div", `position:absolute;inset:-10% -30%;opacity:.6;
        background:repeating-linear-gradient(176deg, rgba(255,255,255,0) 0 9px, rgba(255,255,255,.6) 9px 11px, rgba(0,0,30,0) 11px 23px, rgba(0,10,50,.5) 23px 25px);
        -webkit-mask-image:repeating-linear-gradient(90deg,#000 0 190px,transparent 190px 260px);
        mask-image:repeating-linear-gradient(90deg,#000 0 190px,transparent 190px 260px);
        animation:nsdrSpeed .28s linear infinite;`, band);
    speed.className = "nsdr-speed";
    // Diagonal light streaks.
    el("div", `position:absolute;inset:0;mix-blend-mode:screen;
        background:linear-gradient(170deg, transparent 30%, rgba(255,255,255,.35) 46%, transparent 52%),
                   linear-gradient(172deg, transparent 58%, rgba(180,255,255,.25) 64%, transparent 68%);`, band);

    let portrait = null;
    if (playerSpriteUrl) {
        portrait = el("img", `position:absolute;right:-6vw;top:-14vh;height:230vh;width:auto;max-width:none;
            object-fit:contain;object-position:top center;
            filter:drop-shadow(0 0 4px #fff);`, band);
        portrait.className = "nsdr-portrait";
        portrait.src = playerSpriteUrl;
        portrait.alt = "";
        portrait.onerror = () => portrait.remove();
    }

    // counter.png lettering: the art already carries its own band; fit it to
    // the left two-thirds and let it sit over the speedlines.
    const letters = el("img", `position:absolute;left:-4%;top:50%;width:${portrait ? 74 : 100}%;height:auto;
        transform:translateY(-50%) rotate(-4deg);filter:drop-shadow(0 6px 0 rgba(0,0,20,.35));`, band);
    letters.src = counterImgUrl;
    letters.alt = "Counter";

    // Hard edges of the band.
    const edge = document.createElementNS(svgNS, "svg");
    edge.setAttribute("viewBox", "0 0 100 100");
    edge.setAttribute("preserveAspectRatio", "none");
    edge.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;";
    edge.innerHTML = `<polyline points="0,22 100,6" stroke="#fff" stroke-width="6" vector-effect="non-scaling-stroke" fill="none"/>
        <polyline points="0,96 100,80" stroke="#fff" stroke-width="6" vector-effect="non-scaling-stroke" fill="none"/>`;
    root.appendChild(edge);
    root.appendChild(inkSplats(svgNS, W, H));

    return { root, band, letters, portrait };
}

async function animateCutinIn({ root, band, letters, portrait }, token) {
    const reduce = reducedMotion();
    root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 90, fill: "forwards" });
    band.animate(reduce
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [{ transform: "translateX(-105%) skewX(-12deg)" }, { transform: "translateX(3%) skewX(-4deg)", offset: 0.75 }, { transform: "translateX(0) skewX(0deg)" }],
        { duration: 260, easing: "cubic-bezier(.2,.8,.3,1)", fill: "forwards" });
    letters.animate([
        { transform: "translate(-40%,-50%) rotate(-4deg) scale(1.4)", opacity: 0 },
        { transform: "translate(2%,-50%) rotate(-4deg) scale(.98)", opacity: 1, offset: 0.7 },
        { transform: "translate(0,-50%) rotate(-4deg) scale(1)", opacity: 1 },
    ], { duration: 360, delay: 90, easing: "cubic-bezier(.2,.9,.3,1)", fill: "forwards" });
    portrait?.animate([
        { transform: "translateX(40%) scale(1.08)", opacity: 0 },
        { transform: "translateX(-2%) scale(1.02)", opacity: 1, offset: 0.6 },
        { transform: "translateX(0) scale(1)", opacity: 1 },
    ], { duration: 420, delay: 140, easing: "cubic-bezier(.2,.9,.3,1)", fill: "forwards" });
    // Slow push-in while it holds.
    portrait?.animate([{ scale: "1" }, { scale: "1.05" }], { duration: 1600, delay: 560, fill: "forwards" });
    await token.delay(380);
}

// ── 5. Glass shatter ────────────────────────────────────────────────────────
// Jittered grid → two triangles per cell. Shared vertices keep cracks tidy.
export function shardTriangles(cols, rows, W, H, jitter = 0.35, rng = Math.random) {
    const pts = [];
    for (let r = 0; r <= rows; r++) {
        const row = [];
        for (let c = 0; c <= cols; c++) {
            const edgeX = c === 0 || c === cols, edgeY = r === 0 || r === rows;
            const jx = edgeX ? 0 : (rng() * 2 - 1) * jitter * (W / cols);
            const jy = edgeY ? 0 : (rng() * 2 - 1) * jitter * (H / rows);
            row.push([(c * W) / cols + jx, (r * H) / rows + jy]);
        }
        pts.push(row);
    }
    const tris = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const a = pts[r][c], b = pts[r][c + 1], d = pts[r + 1][c], e = pts[r + 1][c + 1];
            if ((r + c) % 2 === 0) { tris.push([a, b, e], [a, e, d]); }
            else { tris.push([a, b, d], [b, e, d]); }
        }
    }
    return tris;
}

async function shatterGlass(layer, cutin, impactX, impactY, playSfx, token) {
    const W = window.innerWidth, H = window.innerHeight;
    const svgNS = "http://www.w3.org/2000/svg";
    // 16 shards: each is a full-viewport clone on its own 3D layer, so keep
    // the count (and the clones' content) modest.
    const tris = shardTriangles(4, 2, W, H);

    // Crack lines first.
    const cracks = document.createElementNS(svgNS, "svg");
    cracks.setAttribute("width", W);
    cracks.setAttribute("height", H);
    cracks.style.cssText = "position:fixed;inset:0;pointer-events:none;filter:drop-shadow(0 0 3px #9fe8ff) drop-shadow(0 0 8px #3fb4ff);";
    const cx = W * 0.62, cy = H * 0.5;
    for (const t of tris) {
        const poly = document.createElementNS(svgNS, "polygon");
        poly.setAttribute("points", t.map(p => p.map(v => v.toFixed(1)).join(",")).join(" "));
        poly.setAttribute("fill", "none");
        poly.setAttribute("stroke", "#fff");
        poly.setAttribute("stroke-width", "2");
        cracks.appendChild(poly);
    }
    // A few radial cracks from the centre of the band.
    for (let i = 0; i < 7; i++) {
        const pl = document.createElementNS(svgNS, "polyline");
        const a = rand(0, Math.PI * 2);
        pl.setAttribute("points", boltPath(cx, cy, cx + Math.cos(a) * W * 0.6, cy + Math.sin(a) * H * 0.6));
        pl.setAttribute("fill", "none");
        pl.setAttribute("stroke", "#e8fbff");
        pl.setAttribute("stroke-width", "1.5");
        cracks.appendChild(pl);
    }
    layer.appendChild(cracks);
    cracks.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 70, fill: "forwards" });
    playSfx?.("trust_shatter");
    await token.delay(170);
    if (token.skipped) return;

    // Shards: clip a clone of the cut-in into each triangle and throw them.
    const shardLayer = el("div", "position:fixed;inset:0;pointer-events:none;perspective:900px;", layer);
    const reduce = reducedMotion();
    for (const t of tris) {
        const shard = el("div", `position:absolute;inset:0;clip-path:polygon(${t.map(p => `${p[0].toFixed(1)}px ${p[1].toFixed(1)}px`).join(",")});will-change:transform,opacity;`, shardLayer);
        // Clones don't carry WAAPI state; every entry animation ends at the
        // element's own static style, so the clone already looks "landed".
        const clone = cutin.root.cloneNode(true);
        clone.style.position = "absolute";
        const clonePortrait = clone.querySelector(".nsdr-portrait");
        if (clonePortrait) { clonePortrait.style.scale = "1.05"; clonePortrait.style.filter = "none"; }
        // The animated, masked speedline layer is the costliest part to paint;
        // freeze it in the clones.
        clone.querySelector(".nsdr-speed")?.style.setProperty("animation", "none");
        clone.querySelectorAll("img").forEach(img => { img.style.filter = "none"; });
        shard.appendChild(clone);
        const mx = (t[0][0] + t[1][0] + t[2][0]) / 3;
        const my = (t[0][1] + t[1][1] + t[2][1]) / 3;
        shard.style.transformOrigin = `${mx}px ${my}px`;
        const ang = Math.atan2(my - cy, mx - cx);
        const dist = rand(120, 420);
        shard.animate(reduce
            ? [{ opacity: 1 }, { opacity: 0 }]
            : [
                { transform: "translate3d(0,0,0) rotate3d(1,1,0,0deg)", opacity: 1 },
                { transform: `translate3d(${Math.cos(ang) * dist * 0.15}px,${Math.sin(ang) * dist * 0.15}px,60px) rotate3d(${rand(-1, 1)},${rand(-1, 1)},${rand(-0.5, 0.5)},${rand(6, 14)}deg)`, opacity: 1, offset: 0.25 },
                { transform: `translate3d(${Math.cos(ang) * dist}px,${Math.sin(ang) * dist + 160}px,${rand(250, 650)}px) rotate3d(${rand(-1, 1)},${rand(-1, 1)},${rand(-1, 1)},${rand(80, 260)}deg)`, opacity: 0 },
            ], { duration: rand(620, 860), delay: Math.hypot(mx - cx, my - cy) / 9, easing: "cubic-bezier(.35,.05,.6,1)", fill: "forwards" });
    }
    cutin.root.remove();
    cracks.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: "forwards" });
}

// ── 6. Break card ───────────────────────────────────────────────────────────
function buildBreakCard(layer, isMpd) {
    const color = isMpd ? "#ff3348" : "#38c4ff";
    const glow = isMpd ? "rgba(255,40,60,.75)" : "rgba(40,170,255,.75)";
    const card = el("div", `position:fixed;inset:0;pointer-events:none;display:flex;align-items:center;justify-content:center;
        background:radial-gradient(ellipse at 50% 55%, ${isMpd ? "#1a0206" : "#020a1c"} 0%, #000 70%);`, layer);
    const word = el("div", `position:relative;font-family:"${BRUSH_FAMILY}","Spell of Asia",cursive;font-size:min(24vw,34vh);
        line-height:1;color:${color};transform:rotate(-6deg) skewX(-8deg);letter-spacing:-.02em;
        text-shadow:0 0 18px ${glow},0 0 46px ${glow},3px 3px 0 rgba(0,0,0,.6);clip-path:inset(-20% 100% -20% -5%);`, card);
    word.textContent = "Break";
    // Dry-brush streak behind the word.
    const streak = el("div", `position:absolute;left:8%;right:8%;top:52%;height:7vh;transform:rotate(-6deg) scaleX(0);transform-origin:left center;
        background:linear-gradient(90deg, transparent, ${color} 12%, ${color} 70%, transparent);opacity:.28;filter:blur(2px);`, card);
    card.insertBefore(streak, word);
    return { card, word, streak };
}

// ── Orchestration ───────────────────────────────────────────────────────────
export async function playRefuteSequence({
    weakPointEl = null,
    statementEl = null,
    sceneEl = null,
    impactX = null,
    impactY = null,
    counterImgUrl,
    playerSpriteUrl = null,
    isMpd = false,
    playSfx = null,
    playVoice = null,
} = {}) {
    loadBrushFont();
    const token = createSkipToken();
    const release = pushSkippable({ kind: "sequence", skip: () => token.skip() });

    const W = window.innerWidth, H = window.innerHeight;
    let x = impactX, y = impactY;
    if ((x == null || y == null) && weakPointEl) {
        const r = weakPointEl.getBoundingClientRect();
        x = r.left + r.width / 2;
        y = r.top + r.height / 2;
    }
    if (!Number.isFinite(x)) x = W / 2;
    if (!Number.isFinite(y)) y = H / 2;

    const layer = el("div", `position:fixed;inset:0;z-index:${Z};pointer-events:auto;cursor:none;overflow:hidden;`, document.body);
    layer.id = "dangan-nsd-refute";
    const stop = (e) => { e.stopPropagation(); e.preventDefault(); };
    layer.addEventListener("mousedown", stop);
    layer.addEventListener("click", stop);

    let skipArmed = false;
    const onSkipInput = (e) => {
        if (!skipArmed) return;
        if (e.type === "keydown" && e.key === "Escape") return; // the registry handles Escape
        token.skip();
    };
    window.addEventListener("keydown", onSkipInput, true);
    layer.addEventListener("pointerdown", onSkipInput);

    try {
        // 1. Hit-stop
        const flash = el("div", "position:fixed;inset:0;background:#fff;pointer-events:none;", layer);
        flash.animate([{ opacity: 0.95 }, { opacity: 0 }], { duration: 160, easing: "ease-out", fill: "forwards" });
        weakPointEl?.animate?.([
            { translate: "0 0" }, { translate: "-6px 3px" }, { translate: "5px -4px" }, { translate: "-3px 2px" }, { translate: "0 0" },
        ], { duration: 160 });
        await token.delay(170);

        // 2 + 3. Shatter + lightning
        if (!token.skipped) {
            if (!reducedMotion()) shatterStatement(statementEl, x, y, layer);
            else if (statementEl) statementEl.style.visibility = "hidden";
            lightning(layer, x, y, sceneEl, isMpd);
            await token.delay(620);
        }

        // 4. Counter cut-in
        let cutin = null;
        if (!token.skipped) {
            playSfx?.("countersfx");
            cutin = buildCutin(layer, { counterImgUrl, playerSpriteUrl, isMpd });
            await animateCutinIn(cutin, token);
            playVoice?.();
            skipArmed = true;
            await token.delay(1050);
        }

        // 6 (beneath) + 5. Break card sits under the shards.
        let breakCard = null;
        if (!token.skipped) {
            breakCard = buildBreakCard(layer, isMpd);
            if (cutin) layer.appendChild(cutin.root); // keep the cut-in above the card
            if (cutin) await shatterGlass(layer, cutin, x, y, playSfx, token);
        }
        if (!token.skipped && breakCard) {
            await brushFontPromise;
            breakCard.streak.animate([{ transform: "rotate(-6deg) scaleX(0)" }, { transform: "rotate(-6deg) scaleX(1)" }],
                { duration: 380, delay: 80, easing: "cubic-bezier(.3,.8,.3,1)", fill: "forwards" });
            breakCard.word.animate([
                { clipPath: "inset(-20% 100% -20% -5%)", transform: "rotate(-6deg) skewX(-8deg) scale(1.08)" },
                { clipPath: "inset(-20% -5% -20% -5%)", transform: "rotate(-6deg) skewX(-8deg) scale(1)" },
            ], { duration: 460, delay: 120, easing: "cubic-bezier(.4,.1,.2,1)", fill: "forwards" });
            await token.delay(1300);
        }
    } finally {
        window.removeEventListener("keydown", onSkipInput, true);
        release();
        layer.style.pointerEvents = "none";
        try {
            await layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: token.skipped ? 160 : 380, fill: "forwards" }).finished;
        } catch { /* element removed */ }
        layer.remove();
    }
}
