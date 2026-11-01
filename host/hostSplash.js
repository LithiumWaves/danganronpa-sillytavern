// The "Rise and Shine, Ursine!" splash the Monokubs make their entrance with
// in V3: a pink polka-dot bubble pops up in the middle of the screen, a
// scribbled catchphrase slams onto it, doodle stars sparkle round the rim,
// and it vanishes before the hosts come in. Drawn with SVG and CSS
// (host-splash.css), so it needs no image assets.

export const DEFAULT_HOST_SPLASH_TEXT = "Rise and Shine, Ursine—!";

// Played together as the splash appears, relative to the extension folder:
// the splash's jingle, and what the hosts shout (swappable or mutable in
// settings).
export const SPLASH_JINGLE_PATH = "assets/sfx/monokuma/riseandshine.mp3";
export const DEFAULT_SPLASH_VOICE_PATH = "assets/sfx/monokuma/ohakuma.mp3";
// A sound that never reports its end stops holding things up after this.
const SOUNDS_TIMEOUT_MS = 12000;

// Matches the timeline in host-splash.css: the bubble holds until EXIT_AT,
// then pops away.
const EXIT_AT_MS = 2500;
const EXIT_MS = 200;
const REDUCED_MS = 1200;

// Felt-tip colours the letters cycle through.
const LETTER_COLORS = ["#f39a2b", "#e8452f", "#46b04a", "#a443c4", "#f6c81b", "#2fb7c9"];

// Doodles round the rim: [shape, left %, top %, size (em), colour, delay ms].
const DOODLES = [
    ["star", 47, 2, 2.2, "#ffffff", 650],
    ["star", 9, 30, 1.9, "#e5a43a", 720],
    ["star", 4, 66, 2.7, "#35d0d6", 790],
    ["star", 30, 84, 2.6, "#26338f", 860],
    ["star", 62, 78, 1.6, "#ffffff", 930],
    ["star", 82, 22, 1.4, "#c8283a", 700],
    ["star", 22, 14, 1.3, "#2b3fa8", 820],
    ["sun", 34, 12, 2.0, "#e8452f", 760],
    ["heart", 56, 20, 1.0, "#c8283a", 880],
    ["spark", 88, 56, 1.6, "#f6c81b", 960],
    ["spark", 74, 10, 1.2, "#7a3fbf", 1020],
];

const SVG_NS = "http://www.w3.org/2000/svg";

const SHAPES = {
    star: "M50 4 L61 37 L96 38 L68 59 L79 94 L50 73 L21 94 L32 59 L4 38 L39 37 Z",
    heart: "M50 88 C20 66 4 48 10 28 C16 10 40 8 50 28 C60 8 84 10 90 28 C96 48 80 66 50 88 Z",
    spark: "M50 2 L58 42 L98 50 L58 58 L50 98 L42 58 L2 50 L42 42 Z",
};

let current = null;

function svg(doc, tag, attrs = {}) {
    const el = doc.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    return el;
}

// The bubble: a round head with two ear bumps and a few wobbles. Drawn twice,
// a thick black stroke underneath and the dotted fill on top, so the shapes
// merge into one outlined blob.
function buildBubble(doc) {
    const root = svg(doc, "svg", { viewBox: "0 0 400 380", class: "dangan-host-splash-bubble", "aria-hidden": "true" });
    const defs = svg(doc, "defs");
    const pattern = svg(doc, "pattern", { id: "dangan-host-splash-dots", width: 28, height: 28, patternUnits: "userSpaceOnUse", patternTransform: "rotate(12)" });
    pattern.append(
        svg(doc, "rect", { width: 28, height: 28, fill: "#f0577f" }),
        svg(doc, "circle", { cx: 7, cy: 7, r: 4.6, fill: "#fff" }),
        svg(doc, "circle", { cx: 21, cy: 21, r: 4.6, fill: "#fff" }),
    );
    defs.append(pattern);
    root.append(defs);

    const shapes = [
        ["ellipse", { cx: 200, cy: 214, rx: 168, ry: 152 }],
        ["circle", { cx: 98, cy: 74, r: 58 }],
        ["circle", { cx: 300, cy: 66, r: 54 }],
        ["circle", { cx: 54, cy: 214, r: 44 }],
        ["circle", { cx: 352, cy: 182, r: 40 }],
        ["circle", { cx: 150, cy: 336, r: 40 }],
    ];
    const outline = svg(doc, "g", { fill: "#141014", stroke: "#141014", "stroke-width": 14, "stroke-linejoin": "round" });
    const fill = svg(doc, "g", { fill: "url(#dangan-host-splash-dots)" });
    for (const [tag, attrs] of shapes) {
        outline.append(svg(doc, tag, attrs));
        fill.append(svg(doc, tag, attrs));
    }
    root.append(outline, fill);
    return root;
}

function buildDoodle(doc, [shape, left, top, size, color, delay]) {
    const el = svg(doc, "svg", { viewBox: "0 0 100 100", class: `dangan-host-splash-doodle is-${shape}`, "aria-hidden": "true" });
    el.style.left = `${left}%`;
    el.style.top = `${top}%`;
    el.style.width = el.style.height = `${size}em`;
    el.style.animationDelay = `${delay}ms, ${delay + 400}ms`;
    if (shape === "sun") {
        const rays = svg(doc, "g", { stroke: color, "stroke-width": 7, "stroke-linecap": "round" });
        for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2;
            rays.append(svg(doc, "line", {
                x1: 50 + Math.cos(a) * 30, y1: 50 + Math.sin(a) * 30,
                x2: 50 + Math.cos(a) * 46, y2: 50 + Math.sin(a) * 46,
            }));
        }
        el.append(rays, svg(doc, "circle", { cx: 50, cy: 50, r: 20, fill: "#f39a2b", stroke: "#141014", "stroke-width": 5 }));
    } else {
        // A scribbled look: the colour inside, a black pen line round it.
        el.append(svg(doc, "path", { d: SHAPES[shape], fill: color, stroke: "#141014", "stroke-width": 6, "stroke-linejoin": "round" }));
    }
    return el;
}

// Breaks after the first comma, like "Rise and Shine, / Ursine—!", and
// wraps anything longer than a short line at word breaks.
const LINE_CHARS = 18;

function splitLines(text) {
    const cut = text.indexOf(",");
    const parts = cut >= 0 && cut < text.length - 1
        ? [text.slice(0, cut + 1), text.slice(cut + 1).trim()]
        : [text];
    const lines = [];
    for (const part of parts) {
        let line = "";
        for (const word of part.split(/\s+/)) {
            if (line && line.length + 1 + word.length > LINE_CHARS) {
                lines.push(line);
                line = word;
            } else {
                line = line ? `${line} ${word}` : word;
            }
        }
        if (line) lines.push(line);
    }
    return lines;
}

// The catchphrase, one span per letter.
function buildText(doc, text) {
    const wrap = doc.createElement("div");
    wrap.className = "dangan-host-splash-text";
    const lines = splitLines(text);
    wrap.classList.toggle("is-pair", lines.length === 2);
    // Longer and extra lines shrink to stay inside the bubble.
    const longest = Math.max(...lines.map(l => l.length));
    wrap.style.fontSize = `${Math.min(13, 200 / longest, 34 / lines.length).toFixed(2)}cqw`;
    let n = 0;
    for (const line of lines) {
        const row = doc.createElement("div");
        row.className = "dangan-host-splash-line";
        for (const ch of line) {
            const span = doc.createElement("span");
            if (ch === " ") {
                span.className = "is-space";
                span.textContent = " ";
            } else {
                span.textContent = ch;
                span.style.color = LETTER_COLORS[n % LETTER_COLORS.length];
                span.style.rotate = `${((n * 37) % 13) - 6}deg`;
                n++;
            }
            row.append(span);
        }
        wrap.append(row);
    }
    return wrap;
}

// Plays the splash. Resolves true once it has finished (or was clicked
// away), false if cancelHostSplash() pulled it early.
export function playHostSplash({ text = DEFAULT_HOST_SPLASH_TEXT, document: doc = globalThis.document } = {}) {
    cancelHostSplash();
    const phrase = String(text ?? "").trim() || DEFAULT_HOST_SPLASH_TEXT;
    const reduced = !!doc.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

    const overlay = doc.createElement("div");
    overlay.id = "dangan-host-splash";
    overlay.setAttribute("role", "img");
    overlay.setAttribute("aria-label", phrase);
    const stage = doc.createElement("div");
    stage.className = "dangan-host-splash-stage";
    const flash = doc.createElement("div");
    flash.className = "dangan-host-splash-flash";
    stage.append(buildBubble(doc), flash, buildText(doc, phrase), ...DOODLES.map(d => buildDoodle(doc, d)));
    overlay.append(stage);
    doc.body.appendChild(overlay);

    return new Promise((resolve) => {
        const timers = [];
        let done = false;
        const finish = (completed) => {
            if (done) return;
            done = true;
            timers.forEach(clearTimeout);
            doc.removeEventListener("keydown", onKey, true);
            overlay.remove();
            if (current?.overlay === overlay) current = null;
            resolve(completed);
        };
        const leave = () => {
            if (done || overlay.classList.contains("is-leaving")) return;
            overlay.classList.add("is-leaving");
            timers.push(setTimeout(() => finish(true), reduced ? 0 : EXIT_MS));
        };
        const onKey = (e) => {
            if (e.key !== "Escape") return;
            e.stopPropagation();
            leave();
        };
        overlay.addEventListener("click", (e) => {
            e.stopPropagation();
            leave();
        });
        doc.addEventListener("keydown", onKey, true);
        timers.push(setTimeout(leave, reduced ? REDUCED_MS : EXIT_AT_MS));
        current = { overlay, cancel: () => finish(false) };
    });
}

// Pulls the splash off screen at once (a Class Trial starting, a save switch).
export function cancelHostSplash() {
    current?.cancel();
}

// Plays every sound at once. `started` resolves when the first one is
// audibly playing (or they all failed); `done` when they have all ended,
// failed or been blocked; `stop()` cuts them off and resolves both at once.
export function playSplashSounds(urls, { volume = 1 } = {}) {
    const audios = urls.filter(Boolean).map((url) => {
        const audio = new Audio(url);
        audio.volume = Math.max(0, Math.min(1, volume));
        return audio;
    });
    let finish;
    const done = new Promise((resolve) => { finish = resolve; });
    let markStarted;
    const started = new Promise((resolve) => { markStarted = resolve; });
    done.then(() => markStarted());
    let left = audios.length;
    const timer = setTimeout(() => finish(), SOUNDS_TIMEOUT_MS);
    done.then(() => clearTimeout(timer));
    if (!left) finish();
    for (const audio of audios) {
        let settled = false;
        const settle = () => {
            if (settled) return;
            settled = true;
            if (--left <= 0) finish();
        };
        audio.addEventListener("playing", () => markStarted(), { once: true });
        audio.addEventListener("ended", settle, { once: true });
        audio.addEventListener("error", settle, { once: true });
        audio.play().catch(settle);
    }
    return {
        started,
        done,
        stop() {
            for (const audio of audios) audio.pause();
            finish();
        },
    };
}
