import { pushSkippable } from "../core/skip/skipRegistry.js";
import { buildDecagram, crackShard, shatterShard } from "./trustDecagram.js";
import { normalizeTrustCeremonyStyle } from "./ceremonyStyles.js";

// Trust ceremonies: two slanted slabs slash across the screen,
// the character's sprite cuts in from the left, hand-cut lettering pops in
// letter by letter and a slanted rank card (the ten-shard meter and the rank
// number) flips to the new rank. Markup in monopad.html (#trust-rankup-overlay),
// look in styles/systems/trust/ceremony.css (Persona-style), restyled by
// ceremony-dr.css when Settings → Customize picks Danganronpa (ceremonyStyles.js).
//
// Palettes (overlay classes): trust (pink), distrust (red), max (gold), and
// "down" desaturates either one.

let sfx;
let unlockAudio;
let playSfx;
let getSetting;
let getPortraitUrl;

let ceremonyGen = 0;
const timers = [];
const intervals = [];
const listeners = [];

const MODE_CLASSES = ["distrust", "max", "down", "is-drop", "is-shatter", "is-recover", "jolt", "flash", "flip-palette", "dismissable", "show"];

function initTrustAnimations(deps) {
    sfx = deps.sfx;
    unlockAudio = deps.unlockAudio;
    playSfx = deps.playSfx;
    getSetting = deps.getSetting;
    getPortraitUrl = deps.getPortraitUrl;
}

function trustCeremoniesEnabled() {
    return !getSetting || !!getSetting("trustCeremonies");
}

function clearCeremonyWork() {
    while (timers.length) clearTimeout(timers.pop());
    while (intervals.length) clearInterval(intervals.pop());
    while (listeners.length) {
        const { target, type, fn, options } = listeners.pop();
        target.removeEventListener(type, fn, options);
    }
}

function abortCeremony({ hide = true } = {}) {
    ceremonyGen += 1;
    clearCeremonyWork();
    if (hide) hideOverlay(true);
}

function after(ms, action) {
    const gen = ceremonyGen;
    const id = setTimeout(() => {
        if (gen !== ceremonyGen) return;
        action();
    }, ms);
    timers.push(id);
}

function trackListener(target, type, fn, options) {
    target.addEventListener(type, fn, options);
    listeners.push({ target, type, fn, options });
}

function characterName(char) {
    return String(char?.name || "").trim();
}

function sceneElements() {
    const overlay = document.getElementById("trust-rankup-overlay");
    const svg = document.getElementById("trust-decagram");
    if (!overlay || !svg) return null;
    return {
        overlay,
        svg,
        title: overlay.querySelector(".tr-title"),
        card: overlay.querySelector(".tr-card"),
        rankValue: overlay.querySelector(".tr-rank-value"),
        rankCaption: overlay.querySelector(".tr-rank-caption"),
        cardName: overlay.querySelector(".tr-card-name"),
        cutinImg: overlay.querySelector(".tr-cutin-img"),
        cutinFallback: overlay.querySelector(".tr-cutin-fallback"),
        pieces: overlay.querySelector(".tr-pieces"),
    };
}

// Escape ends the ceremony on screen. Trust has already changed by the time
// a ceremony plays, so skipping only hides it and stops its sound.
let releaseCeremonySkip = null;

function registerCeremonySkip() {
    releaseCeremonySkip?.();
    const gen = ceremonyGen;
    releaseCeremonySkip = pushSkippable({
        kind: "sequence",
        skip: () => {
            if (gen !== ceremonyGen) return;
            abortCeremony({ hide: true });
            stopSound(sfx?.trust_max);
            stopSound(sfx?.trust_shatter);
        },
    });
}

function stopSound(audio) {
    if (!audio) return;
    try {
        audio.pause();
        audio.currentTime = 0;
    } catch (_) { /* ignore */ }
}

function hideOverlay(immediate = false) {
    releaseCeremonySkip?.();
    releaseCeremonySkip = null;
    const scene = sceneElements();
    if (!scene) return;
    const { overlay } = scene;
    overlay.classList.remove("show");
    overlay.classList.add("leaving");
    overlay.setAttribute("aria-hidden", "true");

    const strip = () => {
        overlay.classList.remove(...MODE_CLASSES, "leaving");
        delete scene.svg.dataset.mode;
        delete scene.svg.dataset.gold;
        scene.title.innerHTML = "";
        scene.pieces.innerHTML = "";
        scene.card.classList.remove("flip", "slam", "broken", "sag");
        if (scene.cardName) scene.cardName.textContent = "";
    };

    if (immediate) {
        strip();
        return;
    }
    after(360, strip);
}

function playCeremonySfx(sound, volume) {
    if (!sound) return;
    if (typeof volume === "number") sound.volume = volume;
    playSfx?.(sound);
}

function fadeAudio(audio, restoreVolume = 0.5) {
    if (!audio) return;
    const step = setInterval(() => {
        audio.volume = Math.max(0, audio.volume - 0.05);
        if (audio.volume <= 0) {
            clearInterval(step);
            audio.pause();
            audio.currentTime = 0;
            audio.volume = restoreVolume;
        }
    }, 30);
    intervals.push(step);
}

function autoDismiss(delay) {
    after(delay, () => hideOverlay());
}

function clickToDismiss(overlay, delay, onDismiss) {
    const gen = ceremonyGen;
    const dismiss = () => {
        if (gen !== ceremonyGen) return;
        onDismiss?.();
        hideOverlay();
    };
    after(delay, () => {
        overlay.classList.add("dismissable");
        trackListener(overlay, "click", dismiss, { once: true });
    });
}

// ── Pieces ───────────────────────────────────────────────────────────────

// Hand-cut lettering: each letter its own block with a tilt, size and fill
// that cycle through a fixed pattern, so a word always looks the same.
const TILTS = [-7, 4, -3, 6, -5, 3, -2, 7, -6, 2];
const SIZES = [1.08, 0.94, 1.14, 0.98, 1.04, 0.9, 1.12, 1, 0.96, 1.1];
const FILLS = ["w", "k", "a", "w", "k", "w", "a", "k", "w", "a", "k"];
const FONTS = ["f1", "f2", "f1", "f3", "f2", "f1", "f3", "f2"];

function setTitle(scene, text, { delay = 0 } = {}) {
    const { title } = scene;
    title.innerHTML = "";
    let i = 0;
    for (const word of String(text || "").split(" ")) {
        const wordEl = document.createElement("span");
        wordEl.className = "tr-word";
        for (const ch of word) {
            const letter = document.createElement("span");
            letter.className = `tr-letter fill-${FILLS[i % FILLS.length]} ${FONTS[i % FONTS.length]}`;
            letter.textContent = ch;
            letter.style.setProperty("--tilt", `${TILTS[i % TILTS.length]}deg`);
            letter.style.setProperty("--size", String(SIZES[i % SIZES.length]));
            letter.style.setProperty("--delay", `${delay + i * 32}ms`);
            wordEl.appendChild(letter);
            i += 1;
        }
        title.appendChild(wordEl);
    }
    title.setAttribute("aria-label", text);
}

function rankCaption(level, { maxed = false } = {}) {
    if (maxed) return "MAX RANK";
    return level < 0 ? "DISTRUST" : "TRUST";
}

function setRank(scene, level, { flip = false, maxed = false } = {}) {
    const { rankValue, rankCaption: caption, card } = scene;
    const apply = () => {
        rankValue.textContent = String(Math.abs(level));
        caption.textContent = rankCaption(level, { maxed });
    };
    if (!flip) {
        apply();
        return;
    }
    // Half a turn out, swap the number, half a turn back.
    card.classList.remove("flip");
    void card.offsetWidth;
    card.classList.add("flip");
    after(150, apply);
}

function pulseShard(svg, index, variant) {
    const shard = svg.querySelector(`.trust-base-shards .decagram-shard[data-index="${index}"]`)
        || svg.querySelector(`.decagram-shard[data-index="${index}"]`);
    if (!shard) return;
    shard.classList.remove("social-shard-add", "social-shard-remove");
    void shard.getBoundingClientRect();
    shard.classList.add(variant === "add" ? "social-shard-add" : "social-shard-remove");
}

// Index of the shard that holds a level's last rank.
function shardIndexFor(level) {
    return level > 0 ? level - 1 : 10 - Math.abs(level);
}

function setPortrait(scene, char, emotion) {
    const { cutinImg, cutinFallback } = scene;
    const name = characterName(char);
    cutinFallback.textContent = name;
    cutinImg.removeAttribute("src");
    cutinImg.parentElement.classList.remove("has-img");
    if (!name || typeof getPortraitUrl !== "function") return;
    const gen = ceremonyGen;
    Promise.resolve(getPortraitUrl(name, emotion))
        .then((url) => {
            if (gen !== ceremonyGen || !url) return;
            cutinImg.onload = () => {
                if (gen === ceremonyGen) cutinImg.parentElement.classList.add("has-img");
            };
            cutinImg.src = url;
        })
        .catch(() => {});
}

// Glass pieces flying out of the card when trust shatters, or gold flakes
// for MAX. Angular clip-path polygons, each with its own path.
function burstPieces(scene, { count = 14, gold = false } = {}) {
    const { pieces, card } = scene;
    pieces.innerHTML = "";
    const rect = card.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    for (let i = 0; i < count; i++) {
        const piece = document.createElement("span");
        piece.className = `tr-piece${gold ? " gold" : ""}`;
        const angle = (i / count) * Math.PI * 2 + (i % 3) * 0.35;
        const dist = (gold ? 260 : 320) + (i % 4) * 70;
        const size = 28 + (i * 37) % 46;
        piece.style.left = `${cx - size / 2}px`;
        piece.style.top = `${cy - size / 2}px`;
        piece.style.width = `${size}px`;
        piece.style.height = `${size * (0.7 + (i % 3) * 0.25)}px`;
        piece.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
        piece.style.setProperty("--dy", `${Math.sin(angle) * dist + (gold ? 160 : 60)}px`);
        piece.style.setProperty("--rot", `${(i % 2 ? 1 : -1) * (120 + i * 23)}deg`);
        piece.style.setProperty("--clip", PIECE_SHAPES[i % PIECE_SHAPES.length]);
        piece.style.animationDelay = `${(i % 5) * 18}ms`;
        pieces.appendChild(piece);
    }
}

const PIECE_SHAPES = [
    "polygon(0 0, 100% 18%, 62% 100%)",
    "polygon(12% 0, 100% 40%, 40% 100%, 0 58%)",
    "polygon(0 22%, 78% 0, 100% 100%)",
    "polygon(30% 0, 100% 0, 70% 100%, 0 72%)",
    "polygon(0 0, 100% 50%, 0 100%)",
];

// ── Setup ────────────────────────────────────────────────────────────────

function setupCeremony({ char, level, palette = "trust", down = false, emotion = "joy" }) {
    if (!trustCeremoniesEnabled()) return null;
    abortCeremony({ hide: true });
    unlockAudio?.();

    const scene = sceneElements();
    if (!scene) return null;
    const { overlay, svg } = scene;
    if (overlay.parentElement !== document.body) document.body.appendChild(overlay);

    overlay.dataset.style = normalizeTrustCeremonyStyle(getSetting?.("trustCeremonyStyle"));
    overlay.classList.remove(...MODE_CLASSES, "leaving");
    overlay.classList.toggle("distrust", palette === "distrust");
    overlay.classList.toggle("max", palette === "max");
    overlay.classList.toggle("down", down);
    scene.card.classList.remove("flip", "slam", "broken", "sag");
    scene.pieces.innerHTML = "";
    scene.title.innerHTML = "";

    delete svg.dataset.gold;
    if (palette === "distrust") svg.dataset.mode = "distrust";
    else delete svg.dataset.mode;
    buildDecagram(svg, level);
    setRank(scene, level);
    scene.cardName.textContent = characterName(char);
    setPortrait(scene, char, emotion);

    void overlay.offsetWidth;
    const gen = ceremonyGen;
    requestAnimationFrame(() => {
        if (gen !== ceremonyGen) return;
        overlay.classList.add("show");
        overlay.setAttribute("aria-hidden", "false");
    });
    registerCeremonySkip();
    return scene;
}

// ── Ceremonies ───────────────────────────────────────────────────────────

function playTrustRankUp(previous, current, char) {
    const scene = setupCeremony({ char, level: previous, emotion: "joy" });
    if (!scene) return;
    playCeremonySfx(sfx?.trust_up);
    setTitle(scene, "RANK UP!", { delay: 260 });
    after(560, () => {
        buildDecagram(scene.svg, current);
        pulseShard(scene.svg, shardIndexFor(current), "add");
        setRank(scene, current, { flip: true });
    });
    autoDismiss(2100);
}

function playTrustRankDown(previous, current, char) {
    const scene = setupCeremony({ char, level: previous, down: true, emotion: "sad" });
    if (!scene) return;
    playCeremonySfx(sfx?.trust_down || sfx?.monokumasad);
    setTitle(scene, "RANK DOWN...", { delay: 260 });
    const target = shardIndexFor(previous);
    after(480, () => crackShard(scene.svg, target));
    after(660, () => {
        shatterShard(scene.svg, target);
        scene.card.classList.add("sag");
    });
    after(860, () => {
        buildDecagram(scene.svg, current);
        setRank(scene, current, { flip: true });
    });
    autoDismiss(2000);
}

function playDistrustRankDown(previous, current, char) {
    const scene = setupCeremony({ char, level: previous, palette: "distrust", down: true, emotion: "angry" });
    if (!scene) return;
    playCeremonySfx(sfx?.trust_down || sfx?.monokumasad);
    setTitle(scene, "DISTRUST DEEPENS...", { delay: 260 });
    after(600, () => {
        buildDecagram(scene.svg, current);
        pulseShard(scene.svg, shardIndexFor(current), "add");
        setRank(scene, current, { flip: true });
        scene.card.classList.add("sag");
    });
    autoDismiss(2000);
}

function playDistrustRankUp(previous, current, char) {
    const scene = setupCeremony({ char, level: previous, palette: "distrust", emotion: "neutral" });
    if (!scene) return;
    if (sfx?.distrust_recover) playCeremonySfx(sfx.distrust_recover, 0.35);
    setTitle(scene, "DISTRUST EASES", { delay: 260 });
    const target = shardIndexFor(previous);
    after(480, () => crackShard(scene.svg, target));
    after(660, () => shatterShard(scene.svg, target));
    after(860, () => {
        buildDecagram(scene.svg, current);
        setRank(scene, current, { flip: true });
    });
    autoDismiss(2000);
}

// Several ranks at once (SOCIAL_DROP) without leaving trust or distrust:
// the number counts down a rank at a time, a shard cracking on each.
function playTrustDrop(previous, current, char) {
    const distrust = previous < 0;
    const scene = setupCeremony({ char, level: previous, palette: distrust ? "distrust" : "trust", down: true, emotion: distrust ? "angry" : "sad" });
    if (!scene) return;
    scene.overlay.classList.add("is-drop");
    playCeremonySfx(sfx?.trust_down || sfx?.monokumasad);
    setTitle(scene, distrust ? "DISTRUST SURGES..." : "TRUST PLUMMETS...", { delay: 260 });

    let level = previous;
    let t = 520;
    while (level !== current) {
        const from = level;
        const to = from > 0 ? (from - 1 || -1) : from - 1;
        if (to < -10) break;
        const at = t;
        after(at, () => {
            if (from > 0) {
                crackShard(scene.svg, shardIndexFor(from));
                after(90, () => shatterShard(scene.svg, shardIndexFor(from)));
            }
            scene.overlay.classList.remove("jolt");
            void scene.overlay.offsetWidth;
            scene.overlay.classList.add("jolt");
        });
        after(at + 150, () => {
            buildDecagram(scene.svg, to);
            if (to < 0) pulseShard(scene.svg, shardIndexFor(to), "add");
            setRank(scene, to, { flip: true });
        });
        level = to;
        t += 260;
    }
    after(t + 40, () => scene.card.classList.add("sag"));
    autoDismiss(t + 1300);
}

// Trust turning into distrust: a single step from Trust 1, a SOCIAL_DROP
// that runs past it, or a SOCIAL_BREAK. The card freezes, flashes white and
// breaks into glass; the screen turns red and a distrust card slams in.
function playTrustShatter(previous, current, char) {
    const scene = setupCeremony({ char, level: previous, emotion: "angry" });
    if (!scene) return;
    const { overlay, svg, card } = scene;
    overlay.classList.add("is-shatter");
    setTitle(scene, "", {});

    after(520, () => {
        overlay.classList.add("flash");
        card.classList.add("broken");
        burstPieces(scene, { count: 16 });
        if (sfx?.trust_shatter) playCeremonySfx(sfx.trust_shatter);
    });
    after(760, () => {
        overlay.classList.remove("flash");
        overlay.classList.add("flip-palette", "distrust");
        svg.dataset.mode = "distrust";
        buildDecagram(svg, current);
        setRank(scene, current);
        setPortrait(scene, char, "angry");
    });
    after(980, () => {
        card.classList.remove("broken");
        card.classList.add("slam");
        pulseShard(svg, shardIndexFor(current), "add");
        setTitle(scene, "TRUST SHATTERED", { delay: 80 });
    });

    clickToDismiss(overlay, 1100, () => stopSound(sfx?.trust_shatter));
}

function playTrustToDistrustTransition(char) {
    playTrustShatter(1, -1, char);
}

function playDistrustToTrustRecovery(char) {
    const scene = setupCeremony({ char, level: -1, palette: "distrust", emotion: "neutral" });
    if (!scene) return;
    const { overlay, svg } = scene;
    overlay.classList.add("is-recover");
    if (sfx?.trust_up) playCeremonySfx(sfx.trust_up, 0.4);

    after(480, () => {
        crackShard(svg, shardIndexFor(-1));
        after(120, () => shatterShard(svg, shardIndexFor(-1)));
    });
    after(760, () => {
        overlay.classList.add("flash");
    });
    after(900, () => {
        overlay.classList.remove("flash", "distrust");
        overlay.classList.add("flip-palette");
        delete svg.dataset.mode;
        buildDecagram(svg, 1);
        pulseShard(svg, 0, "add");
        setRank(scene, 1, { flip: true });
        setPortrait(scene, char, "joy");
        setTitle(scene, "TRUST REGAINED!", { delay: 60 });
    });

    clickToDismiss(overlay, 600);
}

function playTrustMaxed(char) {
    const scene = setupCeremony({ char, level: 9, palette: "max", emotion: "joy" });
    if (!scene) return;
    const { svg } = scene;
    playCeremonySfx(sfx?.trust_max);
    setTitle(scene, "MAX RANK!!", { delay: 300 });

    after(700, () => {
        buildDecagram(svg, 10);
        pulseShard(svg, 9, "add");
        setRank(scene, 10, { flip: true });
    });
    after(1200, () => {
        svg.dataset.gold = "true";
        buildDecagram(svg, 10);
        const reveal = svg.querySelector("#goldRevealCircle");
        if (reveal) {
            const start = performance.now();
            const duration = 900;
            const gen = ceremonyGen;
            const tick = (now) => {
                if (gen !== ceremonyGen) return;
                const t = Math.min(1, (now - start) / duration);
                reveal.setAttribute("r", String(120 * (1 - Math.pow(1 - t, 3))));
                if (t < 1) requestAnimationFrame(tick);
            };
            reveal.setAttribute("r", "0");
            requestAnimationFrame(tick);
        }
        setRank(scene, 10, { maxed: true });
        burstPieces(scene, { count: 18, gold: true });
    });

    clickToDismiss(scene.overlay, 500, () => fadeAudio(sfx?.trust_max, 0.5));
}

export {
    initTrustAnimations,
    playTrustRankUp,
    playTrustRankDown,
    playTrustMaxed,
    playTrustToDistrustTransition,
    playDistrustRankDown,
    playDistrustRankUp,
    playDistrustToTrustRecovery,
    playTrustDrop,
    playTrustShatter
};
