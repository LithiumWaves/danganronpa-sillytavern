// The punishment for a grave School Regulation, after Mukuro's in DR1: two
// white flashes over the scene, flat pink splats bursting across it, a pink
// flood pouring down from the top until the screen is pink, then white. It
// ends on the white, where the player can bring up a CG (any of their
// SillyTavern backgrounds) to fade in from it, or just continue.

const STYLE_ID = "dangan-blood-style";
const ROOT_ID = "dangan-blood-splash";
// The pink of the game's blood; splats are drawn slightly see-through so they
// read darker over the scene, as in the game.
export const BLOOD_PINK = "#fc50bb";

// When each beat starts (ms), from the reference.
export const TIMELINE = Object.freeze({
    flash1: 0, flash1End: 100, flash2: 200, flash2End: 300,
    firstSplats: 600, burst: 1300, burstEnd: 1800,
    flood: 2800, floodEnd: 4700, toWhite: 4750, white: 5100, choices: 5300,
});

const CSS = `
#${ROOT_ID} { position: fixed; inset: 0; z-index: 100060; overflow: hidden; pointer-events: auto; cursor: default; }
#${ROOT_ID} .dbs-layer { position: absolute; inset: 0; pointer-events: none; }
#${ROOT_ID} .dbs-flash { background: #fff; opacity: 0; }
#${ROOT_ID} .dbs-splats { width: 100%; height: 100%; opacity: 0.92; }
#${ROOT_ID} .dbs-splat > g { transform-box: fill-box; transform-origin: center; transform: scale(0); }
#${ROOT_ID} .dbs-splat.is-in > g { animation: dbs-pop 0.09s cubic-bezier(0.3, 1.8, 0.5, 1) forwards; }
#${ROOT_ID} .dbs-flood { top: auto; bottom: 100%; height: 140%; inset-inline: 0; }
#${ROOT_ID} .dbs-flood.is-pouring { animation: dbs-pour var(--dbs-flood, 1900ms) linear forwards; }
#${ROOT_ID} .dbs-flood svg { width: 100%; height: 100%; display: block; }
#${ROOT_ID} .dbs-pink { background: ${BLOOD_PINK}; opacity: 0; }
#${ROOT_ID} .dbs-white { background: #fff; opacity: 0; transition: opacity 0.35s ease-in; }
#${ROOT_ID} .dbs-choices {
    position: absolute; left: 0; right: 0; bottom: 12vh; display: flex; justify-content: center; gap: 18px;
    opacity: 0; transition: opacity 0.4s ease; pointer-events: none;
}
#${ROOT_ID}.is-ending .dbs-choices { opacity: 1; pointer-events: auto; }
#${ROOT_ID} .dbs-choices button {
    padding: 10px 26px; border: 2px solid ${BLOOD_PINK}; background: #fff; color: ${BLOOD_PINK};
    font: 600 14px "Rajdhani", "Orbitron", sans-serif; letter-spacing: 0.22em; cursor: pointer;
    clip-path: polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%);
}
#${ROOT_ID} .dbs-choices button:hover, #${ROOT_ID} .dbs-choices button:focus-visible { background: ${BLOOD_PINK}; color: #fff; outline: none; }
#${ROOT_ID} .dbs-choices button:disabled { opacity: 0.5; cursor: wait; }
#${ROOT_ID}.is-leaving { transition: opacity 0.6s ease; opacity: 0; }
@keyframes dbs-pop { to { transform: scale(1); } }
/* The front's position over time, from the game's coverage: fast at first,
   then slowing as the last gaps fill. */
@keyframes dbs-pour {
    0% { transform: translateY(0); }
    5% { transform: translateY(12%); }
    10.5% { transform: translateY(18%); }
    15.8% { transform: translateY(32%); }
    26% { transform: translateY(43%); }
    37% { transform: translateY(55%); }
    53% { transform: translateY(67%); }
    63% { transform: translateY(73%); }
    79% { transform: translateY(80%); }
    89% { transform: translateY(87%); }
    100% { transform: translateY(100%); }
}
}
`;

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}

// A small seeded random generator, so a splat can be drawn again the same.
export function seededRng(seed = 1) {
    let s = (Math.floor(seed) >>> 0) || 1;
    return () => {
        s ^= s << 13; s >>>= 0;
        s ^= s >>> 17;
        s ^= s << 5; s >>>= 0;
        return s / 4294967296;
    };
}

const f = (n) => Math.round(n * 10) / 10;

function circlePath(x, y, r) {
    return `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
}

// One splat around (0, 0), radius r, like the game's: a lumpy round blob
// with rounded lobes bulging out of it, a few stubby spikes, and droplets
// around it. Returns separate SVG paths (drawn one by one, so overlapping
// parts never cut holes).
export function makeSplat(rng = Math.random, r = 50) {
    const paths = [];
    // The blob: radii jittered ±25%, joined with curves through midpoints.
    const n = 16 + Math.floor(rng() * 5);
    const pts = [];
    for (let i = 0; i < n; i += 1) {
        const a = (i / n) * Math.PI * 2 + (rng() - 0.5) * 0.25;
        const rr = r * (0.75 + rng() * 0.5);
        pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    let d = `M${f(mid(pts[n - 1], pts[0])[0])} ${f(mid(pts[n - 1], pts[0])[1])}`;
    for (let i = 0; i < n; i += 1) {
        const p = pts[i];
        const m = mid(p, pts[(i + 1) % n]);
        d += `Q${f(p[0])} ${f(p[1])} ${f(m[0])} ${f(m[1])}`;
    }
    paths.push(`${d}Z`);
    // Lobes: rounded bulges on the edge.
    const lobes = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < lobes; i += 1) {
        const a = rng() * Math.PI * 2;
        const dist = r * (0.7 + rng() * 0.3);
        paths.push(circlePath(Math.cos(a) * dist, Math.sin(a) * dist, r * (0.3 + rng() * 0.25)));
    }
    // Short pointed spikes all around the edge, and a few longer ones.
    const spikes = 9 + Math.floor(rng() * 7);
    for (let i = 0; i < spikes; i += 1) {
        const a = (i / spikes) * Math.PI * 2 + (rng() - 0.5) * 0.5;
        const len = r * (rng() < 0.25 ? 1.35 + rng() * 0.35 : 1.05 + rng() * 0.25);
        const w = r * (0.1 + rng() * 0.12);
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        const bx = cos * r * 0.6;
        const by = sin * r * 0.6;
        const tx = cos * len;
        const ty = sin * len;
        paths.push(`M${f(bx - sin * w)} ${f(by + cos * w)}L${f(tx)} ${f(ty)}L${f(bx + sin * w)} ${f(by - cos * w)}Z`);
        // Now and then a drop at the tip.
        if (rng() < 0.3) paths.push(circlePath(tx, ty, w * 0.7));
    }
    // Droplets flung around it.
    const drops = 4 + Math.floor(rng() * 7);
    for (let i = 0; i < drops; i += 1) {
        const a = rng() * Math.PI * 2;
        const dist = r * (1.15 + rng() * 0.7);
        paths.push(circlePath(Math.cos(a) * dist, Math.sin(a) * dist, r * (0.05 + rng() * 0.12)));
    }
    return paths;
}

// Where the splats land, in a 1600×900 picture: a few small ones first, then
// a burst of mixed sizes over the whole picture, about a quarter of it in
// the end, as in the game.
export function planSplats(rng = Math.random) {
    const out = [];
    const add = (at, x, y, size) => out.push({ at, x: f(x), y: f(y), size: f(size), rotate: Math.round(rng() * 360), seed: Math.floor(rng() * 1e9) });
    const first = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < first; i += 1) {
        add(TIMELINE.firstSplats + i * ((TIMELINE.burst - TIMELINE.firstSplats) / first), 150 + rng() * 1300, 100 + rng() * 700, 0.5 + rng() * 0.6);
    }
    // Big ones spread over the thirds of the picture, mid and small ones
    // anywhere, and many tiny spatters, all landing mixed through the burst.
    const sizes = [
        ...Array.from({ length: 3 }, (_, i) => ({ size: 2 + rng() * 0.5, third: i })),
        ...Array.from({ length: 8 }, () => ({ size: 1.2 + rng() * 0.6 })),
        ...Array.from({ length: 15 }, () => ({ size: 0.35 + rng() * 0.45 })),
        ...Array.from({ length: 28 }, () => ({ size: 0.1 + rng() * 0.18 })),
    ];
    for (let i = sizes.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [sizes[i], sizes[j]] = [sizes[j], sizes[i]];
    }
    sizes.forEach(({ size, third }, i) => {
        const x = third !== undefined ? (third * 1600) / 3 + 120 + rng() * 300 : rng() * 1600;
        const y = third !== undefined ? 250 + rng() * 550 : rng() * 900;
        add(TIMELINE.burst + (i / sizes.length) * (TIMELINE.burstEnd - TIMELINE.burst), x, y, size);
    });
    return out.sort((a, b) => a.at - b.at);
}

// The flood sheet (1600 wide, its body above y = 0): its lower edge is
// splats merging into it, with loose splats ahead of it, like the game's.
// Returns { body, splats: [{ x, y, size, rotate, paths }] }.
export function floodShape(rng = Math.random, { width = 1600, top = -1400 } = {}) {
    const splats = [];
    for (let x = -60; x < width + 100;) {
        // Big and small splats at different depths: a rough, uneven front.
        const big = rng() < 0.35;
        splats.push({ x: f(x), y: f(big ? 40 + rng() * 120 : rng() * 100 - 60), size: f(big ? 2.4 + rng() * 1.6 : 1 + rng() * 1.2), rotate: Math.round(rng() * 360), paths: makeSplat(rng) });
        x += 60 + rng() * 90;
    }
    const loose = 10 + Math.floor(rng() * 8);
    for (let i = 0; i < loose; i += 1) {
        splats.push({ x: f(rng() * width), y: f(150 + rng() * 200), size: f(0.25 + rng() * 0.7), rotate: Math.round(rng() * 360), paths: makeSplat(rng) });
    }
    return { body: `M0 ${top}L${width} ${top}L${width} 0L0 0Z`, splats };
}

function splatGroup(s) {
    return `<g transform="translate(${s.x} ${s.y}) rotate(${s.rotate}) scale(${s.size})">${s.paths.map((d) => `<path d="${d}"/>`).join("")}</g>`;
}

// offerCg: { pick() → Promise<item | null>, show(item) } to let the player
// bring up a CG at the end; without it the splash just fades out.
// Resolves { cg: item | null } once it's over.
export function playBloodSplash({ playSound = null, rng = Math.random, offerCg = null } = {}) {
    ensureStyle();
    document.getElementById(ROOT_ID)?.remove();
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Punishment");

    const splats = planSplats(rng);
    const flood = floodShape(rng);
    const splatSvg = splats.map((s, i) => `<g class="dbs-splat" data-i="${i}" transform="translate(${s.x} ${s.y}) rotate(${s.rotate}) scale(${s.size})"><g>${makeSplat(seededRng(s.seed)).map((p) => `<path d="${p}"/>`).join("")}</g></g>`).join("");
    root.innerHTML = `
        <svg class="dbs-layer dbs-splats" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" fill="${BLOOD_PINK}" aria-hidden="true">${splatSvg}</svg>
        <div class="dbs-layer dbs-flood"><svg viewBox="0 -1400 1600 1800" preserveAspectRatio="none" fill="${BLOOD_PINK}" aria-hidden="true"><path d="${flood.body}"/>${flood.splats.map(splatGroup).join("")}</svg></div>
        <div class="dbs-layer dbs-pink"></div>
        <div class="dbs-layer dbs-flash"></div>
        <div class="dbs-layer dbs-white"></div>
        <div class="dbs-choices">${offerCg ? `<button type="button" class="dbs-cg">SHOW A CG</button>` : ""}<button type="button" class="dbs-continue">CONTINUE</button></div>`;
    document.body.appendChild(root);
    try { playSound?.(); } catch { /* no sound */ }

    const $ = (sel) => root.querySelector(sel);
    const timers = [];
    const at = (ms, fn) => timers.push(setTimeout(fn, ms));
    const T = TIMELINE;

    if (still) {
        $(".dbs-pink").style.transition = "opacity 0.6s ease";
        at(20, () => { $(".dbs-pink").style.opacity = "1"; });
        at(700, () => { $(".dbs-white").style.opacity = "1"; });
        at(1100, () => root.classList.add("is-ending"));
    } else {
        // Two white flashes over the scene.
        const flash = $(".dbs-flash");
        at(T.flash1, () => { flash.style.opacity = "1"; });
        at(T.flash1End, () => { flash.style.opacity = "0"; });
        at(T.flash2, () => { flash.style.opacity = "1"; });
        at(T.flash2End, () => { flash.style.opacity = "0"; });
        // The splats pop in, each at its time.
        root.querySelectorAll(".dbs-splat").forEach((g) => at(splats[Number(g.dataset.i)].at, () => g.classList.add("is-in")));
        // The flood pours down from the top.
        at(T.flood, () => {
            const flood = $(".dbs-flood");
            flood.style.setProperty("--dbs-flood", `${T.floodEnd - T.flood}ms`);
            flood.classList.add("is-pouring");
        });
        // Fully pink, then brightening to white.
        at(T.floodEnd, () => { $(".dbs-pink").style.opacity = "1"; });
        at(T.toWhite, () => { $(".dbs-white").style.opacity = "1"; });
        at(T.choices, () => root.classList.add("is-ending"));
    }

    return new Promise((resolve) => {
        let done = false;
        const finish = (cg = null) => {
            if (done) return;
            done = true;
            timers.forEach(clearTimeout);
            document.removeEventListener("keydown", onKey, true);
            // Fade the white away: over the game, or over the CG now under it.
            if (cg) root.style.zIndex = "2147483647";
            root.classList.remove("is-ending");
            root.classList.add("is-leaving");
            setTimeout(() => { root.remove(); resolve({ cg }); }, 650);
        };
        const onKey = (e) => {
            if (!root.classList.contains("is-ending")) return;
            if (e.key === "Escape" || e.key === "Enter") { e.preventDefault(); finish(null); }
        };
        document.addEventListener("keydown", onKey, true);
        $(".dbs-continue").addEventListener("click", (e) => { e.stopPropagation(); finish(null); });
        $(".dbs-cg")?.addEventListener("click", async (e) => {
            e.stopPropagation();
            const btn = e.currentTarget;
            btn.disabled = true;
            const item = await offerCg.pick().catch(() => null);
            btn.disabled = false;
            if (!item) return;
            offerCg.show(item);
            finish(item);
        });
        // Clicking the white anywhere else continues.
        root.addEventListener("click", () => { if (root.classList.contains("is-ending")) finish(null); });
    });
}
