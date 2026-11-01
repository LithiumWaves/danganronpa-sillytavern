// Records the looping clips shown in the minigame tutorials
// (assets/images/minigames/tutorials/*.webp).
//
//   node tools/minigame-captures/capture.mjs [game ...]
//
// Needs Playwright (with Chromium) and ffmpeg built with libwebp. Each game runs
// on capture.html with sample data; a short scripted play-through is recorded,
// trimmed to the marked part and encoded as an animated WebP.
//
// To use your own recording instead, see the README next to the clips.

import { createServer } from "node:http";
import { readFile, mkdir, rm, rename } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../..");
const OUT_DIR = join(REPO, "assets/images/minigames/tutorials");
const EXT_PREFIX = "/scripts/extensions/third-party/danganronpa-extension/";
const VIEW = { width: 1280, height: 720 };
const CLIP = { fps: 12, width: 720, quality: 62 };
// Busier clips get a lower quality or width to stay around 1.5 MB.
const QUALITY = { massPanicDebate: 45, argumentArmament: 56 };
const WIDTH = { massPanicDebate: 640 };

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");

// ── Static server: capture.html at the root, the extension where SillyTavern keeps it ──

const TYPES = {
    ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
    ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif",
    ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".mp3": "audio/mpeg", ".wav": "audio/wav",
    ".ogg": "audio/ogg", ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime",
    ".ttf": "font/ttf", ".otf": "font/otf", ".woff": "font/woff", ".woff2": "font/woff2",
};

function startServer() {
    const server = createServer(async (req, res) => {
        const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
        let file = null;
        if (path === "/" || path === "/capture.html") file = join(HERE, "capture.html");
        else if (path.startsWith(EXT_PREFIX)) file = join(REPO, path.slice(EXT_PREFIX.length));
        if (!file || !file.startsWith(REPO) || !existsSync(file) || statSync(file).isDirectory()) {
            res.writeHead(404).end();
            return;
        }
        res.writeHead(200, { "content-type": TYPES[extname(file).toLowerCase()] || "application/octet-stream" });
        res.end(await readFile(file));
    });
    return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server)));
}

// ── Helpers shared by the game scripts ──

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeTools(page, t0) {
    const marks = {};
    let mouse = { x: VIEW.width / 2, y: VIEW.height / 2 };
    const tools = {
        page,
        sleep,
        mark(name) { marks[name] = (Date.now() - t0) / 1000; },
        marks,
        async glide(x, y, ms = 350) {
            // Each step costs real time under recording, so keep them few.
            const steps = Math.max(3, Math.round(ms / 45));
            await page.mouse.move(x, y, { steps });
            mouse = { x, y };
        },
        async clickAt(x, y, ms) {
            await tools.glide(x, y, ms);
            await page.mouse.down();
            await sleep(40);
            await page.mouse.up();
        },
        // Centre of the first element matching `selector` (and optional filter source).
        async centerOf(selector, filter = "() => true") {
            return page.evaluate(([sel, f]) => {
                const pick = new Function(`return (${f})`)();
                for (const el of document.querySelectorAll(sel)) {
                    const r = el.getBoundingClientRect();
                    if (r.width < 2 || r.height < 2) continue;
                    if (r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) continue;
                    if (!pick(el)) continue;
                    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
                }
                return null;
            }, [selector, filter]);
        },
        async waitFor(selector, timeout = 15000) {
            await page.waitForSelector(selector, { state: "visible", timeout });
        },
        get mouse() { return mouse; },
    };
    return tools;
}

// Runs `step` repeatedly for `ms`.
async function forAbout(ms, step) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
        // eslint-disable-next-line no-await-in-loop
        await step();
    }
}

// ── Scripted play-throughs. Each marks "start" and "end" around the part to keep. ──

const GAMES = {
    async hangmansGambit(t) {
        await t.waitFor(".hg-bubble");
        await t.sleep(800);
        t.mark("start");
        // Bullet Time first: the spheres are dim until it (or a sheen) lights them.
        await t.page.keyboard.down("Shift");
        await t.glide(VIEW.width * 0.45, VIEW.height * 0.5, 600);
        await t.sleep(1600);
        await t.page.keyboard.up("Shift");
        const answer = "AXE"; // matches capture.html
        let revealed = 0;
        await forAbout(11000, async () => {
            if (revealed >= 3) { await t.sleep(200); return; }
            if (!(await t.page.$(".hg-anagram-char.hg-target"))) { revealed = 3; await t.sleep(2200); return; }
            const target = await t.page.evaluate((ans) => {
                const el = document.querySelector(".hg-anagram-char.hg-target");
                return el ? ans[Number(el.dataset.idx)] : null;
            }, answer);
            const found = await t.page.evaluate((letter) => {
                const out = [];
                for (const b of document.querySelectorAll(".hg-bubble")) {
                    if (b.textContent.trim() !== letter) continue;
                    const r = b.getBoundingClientRect();
                    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
                    // The game ignores clicks within 96 px of the top or 100 px of the bottom.
                    if (cy < 104 || cy > innerHeight - 108 || cx < 20 || cx > innerWidth - 20) continue;
                    out.push({ x: cx, y: cy });
                }
                return out;
            }, target);
            if (process.env.CAPTURE_DEBUG) console.log("  hangman:", target, found.length, await t.page.evaluate(() => [...document.querySelectorAll(".hg-bubble")].map((b) => b.textContent.trim()).join("")));
            if (found.length < 2) {
                if (found[0]) await t.glide(found[0].x, found[0].y, 250);
                await t.sleep(150);
                return;
            }
            // Spheres keep moving, so re-read the position right before clicking.
            const nearest = (p) => t.page.evaluate(({ x, y, letter }) => {
                let best = null, bd = 1e9;
                for (const b of document.querySelectorAll(".hg-bubble")) {
                    if (b.textContent.trim() !== letter) continue;
                    const r = b.getBoundingClientRect();
                    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
                    const d = Math.hypot(cx - x, cy - y);
                    if (d < bd) { bd = d; best = { x: cx, y: cy }; }
                }
                return best;
            }, { ...p, letter: target });
            for (const p of found.slice(0, 2)) {
                let at = await nearest(p);
                if (!at) continue;
                await t.glide(at.x, at.y, 160);
                at = await nearest(at);
                if (!at) continue;
                await t.page.mouse.move(at.x, at.y, { steps: 1 });
                await t.page.mouse.down();
                await t.page.mouse.up();
                await t.sleep(320);
            }
            revealed++;
            await t.sleep(700);
        });
        t.mark("end");
    },

    async argumentArmament(t) {
        await t.waitFor(".aa-cell-active", 20000);
        await t.sleep(600);
        t.mark("start");
        let shots = 0;
        await forAbout(7000, async () => {
            const c = await t.centerOf(".aa-cell-active");
            if (!c) { await t.sleep(150); return; }
            await t.clickAt(c.x, c.y, 260);
            shots++;
            if (shots % 5 === 0) { await t.sleep(200); await t.page.keyboard.press("r"); }
            await t.sleep(380);
        });
        t.mark("end");
    },

    async questionTime(t) {
        await t.waitFor(".qt-option");
        await t.sleep(900);
        t.mark("start");
        const opt = (n) => t.centerOf(`.qt-option[data-idx="${n}"]`);
        for (const n of [2, 3]) { const c = await opt(n); await t.glide(c.x, c.y, 420); await t.sleep(350); }
        let c = await opt(3); await t.clickAt(c.x, c.y, 120);
        await t.sleep(1100);
        c = await opt(1); await t.clickAt(c.x, c.y, 500);
        await t.sleep(2600);
        t.mark("end");
    },

    async questionTruth(t) {
        await t.waitFor(".qtt-bullet-item");
        await t.sleep(900);
        t.mark("start");
        const item = (i) => t.centerOf(`.qtt-bullet-item[data-idx="${i}"]`);
        for (const i of [2, 3]) { const c = await item(i); await t.glide(c.x, c.y, 350); await t.sleep(550); }
        const hint = await t.centerOf("#qtt-hint-btn");
        if (hint) { await t.clickAt(hint.x, hint.y, 400); await t.sleep(800); }
        const c = await item(1); await t.glide(c.x, c.y, 400); await t.sleep(450);
        await t.page.mouse.down(); await t.sleep(40); await t.page.mouse.up();
        await t.sleep(2200);
        t.mark("end");
    },

    async mindMine(t) {
        await t.waitFor(".mm-block");
        await t.sleep(900);
        t.mark("start");
        await forAbout(7500, async () => {
            const revealed = await t.centerOf(".mm-sentence-revealed");
            if (revealed) { await t.clickAt(revealed.x, revealed.y, 450); await t.sleep(2200); return; }
            // Biggest same-colour group, the way a player would pick.
            const best = await t.page.evaluate(() => {
                const cells = [...document.querySelectorAll(".mm-block")];
                const COLS = 18;
                const color = cells.map((el) => el.dataset.color);
                const seen = new Set();
                let pick = null;
                for (let i = 0; i < cells.length; i++) {
                    if (seen.has(i) || color[i] === "empty" || color[i] == null) continue;
                    const stack = [i];
                    const group = [];
                    seen.add(i);
                    while (stack.length) {
                        const c = stack.pop();
                        group.push(c);
                        const r = Math.floor(c / COLS), col = c % COLS;
                        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                            const nr = r + dr, nc = col + dc, n = nr * COLS + nc;
                            if (nr < 0 || nc < 0 || nc >= COLS || n >= cells.length || seen.has(n)) continue;
                            if (color[n] !== color[i]) continue;
                            seen.add(n);
                            stack.push(n);
                        }
                    }
                    if (!pick || group.length > pick.size) pick = { cell: group[0], size: group.length };
                }
                if (!pick) return null;
                const r = cells[pick.cell].getBoundingClientRect();
                return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
            });
            if (!best) { await t.sleep(200); return; }
            await t.clickAt(best.x, best.y, 300);
            await t.sleep(380);
        });
        t.mark("end");
    },

    async scrumDebate(t) {
        // Claims slide in from the left; answer once most of one is readable.
        const claimOnScreen = () => t.page.waitForFunction(() => {
            const s = document.querySelector("#sd-statement");
            return s && s.getBoundingClientRect().left > -380;
        }, null, { timeout: 25000 });
        await claimOnScreen();
        t.mark("start");
        const answers = ["Kitchen Equipment", "Gaps in Floorboard", "Fire Door"];
        for (const answer of answers.slice(0, 2)) {
            for (let i = 0; i < 6; i++) {
                const title = await t.page.evaluate(() => document.querySelector("#sd-player-title")?.textContent.trim());
                if (title === answer) break;
                await t.page.keyboard.press("ArrowDown");
                await t.sleep(420);
            }
            await t.sleep(300);
            await t.page.keyboard.press("Enter");
            await t.sleep(1800);
            await claimOnScreen().catch(() => {});
        }
        t.mark("end");
    },

    async rebuttalShowdown(t) {
        await t.waitFor(".rs-intro-item");
        await t.sleep(500);
        t.mark("start");
        await t.page.keyboard.press("ArrowDown");
        await t.sleep(450);
        await t.page.keyboard.press("ArrowDown");
        await t.sleep(450);
        await t.page.keyboard.press("Enter");
        await t.sleep(900);
        await forAbout(6500, async () => {
            const line = await t.page.evaluate(() => {
                let best = null;
                for (const el of document.querySelectorAll(".rs-line:not(.rs-cut)")) {
                    const r = el.getBoundingClientRect();
                    if (r.right < 80 || r.left > innerWidth - 80 || r.width < 4) continue;
                    if (!best || r.right > best.right) best = { x: r.left + r.width / 2, y: r.top + r.height / 2, right: r.right };
                }
                return best;
            });
            if (!line) { await t.sleep(150); return; }
            await t.glide(line.x, line.y, 200);
            await t.page.mouse.down();
            await t.sleep(40);
            await t.page.mouse.up();
            await t.sleep(320);
        });
        t.mark("end");
    },

    async voting(t) {
        await t.waitFor(".vt-tile");
        await t.sleep(900);
        t.mark("start");
        const tiles = await t.page.evaluate(() => [...document.querySelectorAll(".vt-tile")].map((el) => {
            const r = el.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }));
        for (const i of [1, 5, 2]) {
            if (!tiles[i]) continue;
            await t.clickAt(tiles[i].x, tiles[i].y, 420);
            await t.sleep(650);
        }
        const btn = await t.centerOf(".vt-vote-btn");
        if (btn) await t.clickAt(btn.x, btn.y, 500);
        await t.sleep(3500);
        t.mark("end");
    },

    async nonStopDebate(t) { await debate(t, ".dangan-weak-point", "security footage"); },
    async massPanicDebate(t) { await debate(t, ".mpd-weak-point, .dangan-weak-point"); },
};

// Non-Stop / Mass Panic: pick a bullet in the intro, follow the statements,
// clear some White Noise, then shoot the weak point (`weakText` picks which).
async function debate(t, weakSelector, weakText = "") {
    let hit = false;
    t.page.on("console", (m) => { if (m.text().includes("CRITICAL HIT")) hit = true; });
    const wantWeak = `(el) => el.textContent.includes(${JSON.stringify(weakText)})`;
    const liveNoise = "(el) => !el.classList.contains('breaking')";

    await t.waitFor(".dangan-bullet-intro-item", 20000);
    await t.sleep(700);
    t.mark("start");
    await t.page.keyboard.press("ArrowDown");
    await t.sleep(500);
    await t.page.keyboard.press("Enter");
    await t.sleep(1000);
    // White Noise over a weak point blocks the shot, so it all goes first.
    let wnHits = 0;
    await forAbout(16000, async () => {
        if (hit) return;
        // Mass Panic: a column that steals the focus locks the others until
        // Space is mashed inside it.
        const freeCol = await t.centerOf(".mpd-key-col");
        if (freeCol) {
            await t.glide(freeCol.x, freeCol.y, 220);
            for (let i = 0; i < 6; i++) { await t.page.keyboard.press(" "); await t.sleep(110); }
            return;
        }
        const wn = wnHits < 40 ? await t.centerOf(".dangan-white-noise", liveNoise) : null;
        if (wn) {
            // Each noise takes a few silencer shots; weak points don't stay long.
            await t.glide(wn.x, wn.y, 140);
            await t.sleep(50);
            await t.page.keyboard.press(" ");
            wnHits++;
            await t.sleep(140);
            return;
        }
        const weak = await clearSpot(t, weakSelector, weakText);
        if (process.env.CAPTURE_DEBUG) console.log("  debate:", { wnHits, weak: !!weak, noise: await t.page.evaluate(() => document.querySelectorAll(".dangan-white-noise:not(.breaking)").length) });
        if (weak) {
            await t.glide(weak.x, weak.y, 260);
            await t.sleep(120);
            const again = await clearSpot(t, weakSelector, weakText);
            if (again) await t.page.mouse.move(again.x, again.y, { steps: 2 });
            await t.page.mouse.down();
            await t.sleep(40);
            await t.page.mouse.up();
            await t.sleep(900);
            return;
        }
        const stmt = await t.centerOf(".dangan-floating-statement, .mpd-column");
        if (stmt) await t.glide(stmt.x + 30, stmt.y, 300);
        await t.sleep(150);
    });
    if (!hit) console.warn("  no weak-point hit this run; re-run this game for a better clip");
    // Keep the COUNTER banner in the clip.
    if (hit) await t.sleep(2000);
    t.mark("end");
}

// A point on the weak point's text that no White Noise covers (noise on top
// would take the shot instead).
function clearSpot(t, selector, text) {
    return t.page.evaluate(([sel, txt]) => {
        const noise = [...document.querySelectorAll(".dangan-white-noise")].map((el) => el.getBoundingClientRect());
        const covered = (x, y) => noise.some((r) => x > r.left - 10 && x < r.right + 10 && y > r.top - 8 && y < r.bottom + 8);
        for (const el of document.querySelectorAll(sel)) {
            if (txt && !el.textContent.includes(txt)) continue;
            // Statements zoom and tilt, so test points across the box for
            // ones where this text really is under the cursor.
            const r = el.getBoundingClientRect();
            if (r.width < 8 || r.right < 0 || r.left > innerWidth) continue;
            for (const fy of [0.5, 0.35, 0.65, 0.2, 0.8]) {
                for (const fx of [0.5, 0.35, 0.65, 0.2, 0.8, 0.1, 0.9]) {
                    const x = r.left + r.width * fx, y = r.top + r.height * fy;
                    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
                    // The reticle can sit on top, so check the whole stack.
                    if (!document.elementsFromPoint(x, y).some((e) => e.closest(sel))) continue;
                    if (!covered(x, y)) return { x, y };
                }
            }
        }
        return null;
    }, [selector, text]);
}

const externalCache = new Map();
function fetchExternal(url) {
    if (!externalCache.has(url)) {
        externalCache.set(url, execFileSync("curl", ["-sSfL", "--max-time", "20", "-A", "Mozilla/5.0 Chrome/120", url], { maxBuffer: 64 * 1024 * 1024 }));
    }
    return externalCache.get(url);
}

function guessType(url) {
    if (url.includes("fonts.googleapis.com")) return "text/css";
    if (/\.js(\?|$)/.test(url)) return "text/javascript";
    if (/\.woff2(\?|$)/.test(url)) return "font/woff2";
    return TYPES[extname(new URL(url).pathname).toLowerCase()] || "application/octet-stream";
}

// ── Recording + encoding ──

function encode(video, from, to, out, quality = CLIP.quality, width = CLIP.width) {
    const dur = Math.max(1, to - from);
    const tmp = `${out}.tmp.webp`;
    execFileSync("ffmpeg", [
        "-y", "-loglevel", "error",
        "-ss", from.toFixed(2), "-t", dur.toFixed(2), "-i", video,
        "-vf", `fps=${CLIP.fps},scale=${width}:-2:flags=lanczos`,
        "-c:v", "libwebp_anim", "-loop", "0", "-quality", String(quality), "-compression_level", "6",
        "-an", tmp,
    ]);
    return rename(tmp, out);
}

const OUT_NAMES = {
    hangmansGambit: "hangmans-gambit",
    argumentArmament: "argument-armament",
    nonStopDebate: "non-stop-debate",
    massPanicDebate: "mass-panic-debate",
    scrumDebate: "scrum-debate",
    rebuttalShowdown: "rebuttal-showdown",
    questionTruth: "question-truth",
    questionTime: "question-time",
    mindMine: "mind-mine",
    voting: "voting",
};

async function main() {
    const wanted = process.argv.slice(2);
    const games = wanted.length ? wanted : Object.keys(GAMES);
    const server = await startServer();
    const base = `http://127.0.0.1:${server.address().port}`;
    const browser = await chromium.launch({
        ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
        args: ["--autoplay-policy=no-user-gesture-required"],
    });
    const videoDir = join(tmpdir(), `dgn-captures-${Date.now()}`);
    await mkdir(OUT_DIR, { recursive: true });
    try {
        for (const game of games) {
            if (!GAMES[game]) { console.warn(`skip unknown game ${game}`); continue; }
            const context = await browser.newContext({
                viewport: VIEW,
                ignoreHTTPSErrors: true,
                recordVideo: { dir: videoDir, size: VIEW },
            });
            // External files (Google Fonts, jQuery) are fetched with curl, which
            // honours HTTPS_PROXY in sandboxes where the browser can't.
            await context.route(/^https:/, async (route) => {
                try {
                    const body = fetchExternal(route.request().url());
                    await route.fulfill({ status: 200, body, contentType: guessType(route.request().url()) });
                } catch {
                    await route.abort();
                }
            });
            const page = await context.newPage();
            const errors = [];
            page.on("pageerror", (e) => errors.push(e.message));
            const t0 = Date.now();
            const tools = makeTools(page, t0);
            await page.goto(`${base}/capture.html?game=${game}`);
            try {
                await GAMES[game](tools);
            } catch (e) {
                console.warn(`[${game}] script stopped early: ${e.message}`);
                tools.marks.start ??= 1;
                tools.mark("end");
            }
            const video = page.video();
            await context.close();
            const path = await video.path();
            const out = join(OUT_DIR, `${OUT_NAMES[game]}.webp`);
            await encode(path, tools.marks.start, tools.marks.end, out, QUALITY[game], WIDTH[game]);
            const kb = Math.round(statSync(out).size / 1024);
            console.log(`${game}: ${out.replace(REPO + "/", "")} (${(tools.marks.end - tools.marks.start).toFixed(1)} s, ${kb} KB)${errors.length ? `  page errors: ${errors.slice(0, 2).join(" | ")}` : ""}`);
        }
    } finally {
        await browser.close();
        server.close();
        await rm(videoDir, { recursive: true, force: true });
    }
}

await main();
