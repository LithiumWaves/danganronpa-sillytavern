import { buildDecagram, crackShard, shatterShard } from "./trustDecagram.js";

let sfx;
let unlockAudio;
let playSfx;
let getSetting;

let ceremonyGen = 0;
const timers = [];
const intervals = [];
const listeners = [];

function initTrustAnimations(deps) {
    sfx = deps.sfx;
    unlockAudio = deps.unlockAudio;
    playSfx = deps.playSfx;
    getSetting = deps.getSetting;
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

function rankCaption(level, { maxed = false } = {}) {
    if (maxed) return "MAX";
    return level < 0 ? "DISTRUST" : "TRUST";
}

function rankLabel(level) {
    if (level < 0) return String(level);
    return String(level);
}

function mountOverlay(overlay) {
    if (overlay.parentElement !== document.body) {
        document.body.appendChild(overlay);
    }
}

function sceneElements() {
    const overlay = document.getElementById("trust-rankup-overlay");
    const svg = document.getElementById("trust-decagram");
    const banner = overlay?.querySelector(".trust-banner");
    const nameEl = overlay?.querySelector(".trust-char-name");
    const rankValue = overlay?.querySelector(".trust-rank-value");
    const rankCaptionEl = overlay?.querySelector(".trust-rank-caption");
    if (!overlay || !svg || !banner) return null;
    return { overlay, svg, banner, nameEl, rankValue, rankCaptionEl };
}

function hideOverlay(immediate = false) {
    const scene = sceneElements();
    if (!scene) return;
    const { overlay, svg, banner, nameEl, rankValue } = scene;
    overlay.classList.remove("show");
    banner.classList.remove("show");
    nameEl?.classList.remove("show");
    rankValue?.classList.remove("tick");
    svg.classList.remove("purify-pulse", "spin-up");

    const strip = () => {
        overlay.classList.remove("distrust", "social-add", "social-remove", "social-surge", "max");
        delete svg.dataset.mode;
        delete svg.dataset.gold;
        banner.textContent = "";
        if (nameEl) nameEl.textContent = "";
        if (rankValue) rankValue.textContent = "";
        if (scene.rankCaptionEl) scene.rankCaptionEl.textContent = "";
    };

    if (immediate) {
        strip();
        return;
    }

    after(320, strip);
}

function setBanner(banner, text) {
    banner.textContent = text || "";
    banner.classList.remove("show");
}

function setName(nameEl, char) {
    if (!nameEl) return;
    const name = characterName(char);
    nameEl.textContent = name;
    nameEl.classList.toggle("show", !!name);
}

function revealBanner(banner) {
    if (banner.textContent) banner.classList.add("show");
}

function setRankReadout(scene, level, { tick = false, maxed = false } = {}) {
    const { rankValue, rankCaptionEl } = scene;
    if (!rankValue) return;
    rankValue.textContent = rankLabel(level);
    if (rankCaptionEl) rankCaptionEl.textContent = rankCaption(level, { maxed });
    rankValue.classList.remove("tick");
    if (tick) {
        void rankValue.offsetWidth;
        rankValue.classList.add("tick");
    }
}

function playCeremonySfx(sound, volume) {
    if (!sound) return;
    if (typeof volume === "number") {
        sound.volume = volume;
    }
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
        trackListener(overlay, "click", dismiss, { once: true });
    });
}

function playShardPulse(svg, index, variant) {
    const shard = svg.querySelector(`.trust-base-shards .decagram-shard[data-index="${index}"]`)
        || svg.querySelector(`.decagram-shard[data-index="${index}"]`);
    if (!shard) return;
    shard.classList.remove("social-shard-add", "social-shard-remove");
    void shard.getBoundingClientRect();
    shard.classList.add(variant === "add" ? "social-shard-add" : "social-shard-remove");
}

function setupSocialCeremony({ distrust = false, char = null } = {}) {
    if (!trustCeremoniesEnabled()) return null;
    abortCeremony({ hide: true });
    unlockAudio?.();

    const scene = sceneElements();
    if (!scene) return null;

    const { overlay, svg, banner, nameEl } = scene;
    mountOverlay(overlay);

    overlay.classList.remove("social-add", "social-remove", "social-surge", "max", "distrust");
    overlay.classList.toggle("distrust", distrust);
    svg.classList.remove("purify-pulse", "spin-up");
    delete svg.dataset.gold;
    if (distrust) svg.dataset.mode = "distrust";
    else delete svg.dataset.mode;

    setBanner(banner, "");
    setName(nameEl, char);
    overlay.classList.remove("show");
    void overlay.offsetWidth;
    overlay.classList.add("show");

    return scene;
}

function playTrustRankUp(previous, current, char) {
    const scene = setupSocialCeremony({ char });
    if (!scene) return;

    const { overlay, svg, banner } = scene;
    overlay.classList.add("social-add");
    setBanner(banner, "TRUST INCREASED!");
    setRankReadout(scene, previous);
    buildDecagram(svg, previous);
    playCeremonySfx(sfx?.trust_up);

    after(220, () => {
        buildDecagram(svg, current);
        playShardPulse(svg, current - 1, "add");
        setRankReadout(scene, current, { tick: true });
    });
    after(400, () => revealBanner(banner));
    autoDismiss(1700);
}

function playTrustRankDown(previous, current, char) {
    const scene = setupSocialCeremony({ char });
    if (!scene) return;

    const { overlay, svg, banner } = scene;
    overlay.classList.add("social-remove");
    setBanner(banner, "TRUST DECREASED...");
    setRankReadout(scene, previous);
    buildDecagram(svg, previous);
    playCeremonySfx(sfx?.trust_down || sfx?.monokumasad);

    const target = Math.max(0, previous - 1);
    after(120, () => {
        crackShard(svg, target);
        playShardPulse(svg, target, "remove");
    });
    after(300, () => shatterShard(svg, target));
    after(520, () => {
        buildDecagram(svg, current);
        setRankReadout(scene, current, { tick: true });
        revealBanner(banner);
    });
    autoDismiss(1500);
}

function playDistrustRankDown(previous, current, char) {
    const scene = setupSocialCeremony({ distrust: true, char });
    if (!scene) return;

    const { overlay, svg, banner } = scene;
    overlay.classList.add("social-add");
    setBanner(banner, "DISTRUST INCREASED…");
    setRankReadout(scene, previous);
    buildDecagram(svg, previous);
    playCeremonySfx(sfx?.trust_down || sfx?.monokumasad);

    const targetIndex = 10 - Math.abs(current);
    after(180, () => {
        buildDecagram(svg, current);
        playShardPulse(svg, targetIndex, "add");
        setRankReadout(scene, current, { tick: true });
    });
    after(360, () => revealBanner(banner));
    autoDismiss(1500);
}

function playDistrustRankUp(previous, current, char) {
    const scene = setupSocialCeremony({ distrust: true, char });
    if (!scene) return;

    const { overlay, svg, banner } = scene;
    overlay.classList.add("social-remove");
    setBanner(banner, "DISTRUST WEAKENING…");
    setRankReadout(scene, previous);
    buildDecagram(svg, previous);
    if (sfx?.distrust_recover) playCeremonySfx(sfx.distrust_recover, 0.35);

    const targetIndex = 10 - Math.abs(previous);
    after(120, () => {
        crackShard(svg, targetIndex);
        playShardPulse(svg, targetIndex, "remove");
    });
    after(340, () => shatterShard(svg, targetIndex));
    after(540, () => {
        buildDecagram(svg, current);
        setRankReadout(scene, current, { tick: true });
        revealBanner(banner);
    });
    autoDismiss(1500);
}

function playDistrustToTrustRecovery(char) {
    const scene = setupSocialCeremony({ distrust: true, char });
    if (!scene) return;

    const { overlay, svg, banner } = scene;
    overlay.classList.add("social-surge");
    setBanner(banner, "");
    setRankReadout(scene, -1);
    buildDecagram(svg, -1);
    if (sfx?.trust_up) playCeremonySfx(sfx.trust_up, 0.4);

    after(380, () => playShardPulse(svg, 9, "remove"));
    after(900, () => svg.classList.add("purify-pulse"));
    after(1450, () => {
        svg.classList.remove("purify-pulse");
        delete svg.dataset.mode;
        overlay.classList.remove("distrust", "social-surge");
        overlay.classList.add("social-add");
        buildDecagram(svg, 1);
        playShardPulse(svg, 0, "add");
        setRankReadout(scene, 1, { tick: true });
    });
    after(1680, () => {
        setBanner(banner, "TRUST REGAINED!");
        revealBanner(banner);
    });

    clickToDismiss(overlay, 400);
}

function playTrustToDistrustTransition(char) {
    const scene = setupSocialCeremony({ distrust: true, char });
    if (!scene) return;

    const { overlay, svg, banner } = scene;
    overlay.classList.add("social-remove");
    setBanner(banner, "DISTRUST INCREASED...");
    setRankReadout(scene, 1);
    buildDecagram(svg, 1);
    if (sfx?.trust_shatter) playCeremonySfx(sfx.trust_shatter);

    after(260, () => playShardPulse(svg, 0, "remove"));
    after(640, () => svg.classList.add("spin-up"));
    after(1050, () => {
        for (let i = 0; i < 10; i++) shatterShard(svg, i);
    });
    after(1520, () => {
        svg.classList.remove("spin-up");
        svg.dataset.mode = "distrust";
        buildDecagram(svg, -1);
        playShardPulse(svg, 9, "add");
        setRankReadout(scene, -1, { tick: true });
        revealBanner(banner);
    });

    clickToDismiss(overlay, 400, () => {
        if (!sfx?.trust_shatter) return;
        sfx.trust_shatter.pause();
        sfx.trust_shatter.currentTime = 0;
    });
}

function playTrustMaxed(char) {
    const scene = setupSocialCeremony({ char });
    if (!scene) return;

    const { overlay, svg, banner } = scene;
    overlay.classList.add("social-surge", "max");
    delete svg.dataset.gold;
    setBanner(banner, "");
    setRankReadout(scene, 9);
    buildDecagram(svg, 9);
    playCeremonySfx(sfx?.trust_max);

    after(900, () => {
        delete svg.dataset.gold;
        buildDecagram(svg, 10);
        playShardPulse(svg, 9, "add");
        setRankReadout(scene, 10, { tick: true });
    });
    after(1700, () => {
        svg.dataset.gold = "true";
        buildDecagram(svg, 10);
        const reveal = svg.querySelector("#goldRevealCircle");
        if (reveal) {
            const start = performance.now();
            const duration = 1200;
            const gen = ceremonyGen;
            const tick = (now) => {
                if (gen !== ceremonyGen) return;
                const t = Math.min(1, (now - start) / duration);
                const eased = 1 - Math.pow(1 - t, 3);
                reveal.setAttribute("r", String(120 * eased));
                if (t < 1) requestAnimationFrame(tick);
            };
            reveal.setAttribute("r", "0");
            requestAnimationFrame(tick);
        }
        setRankReadout(scene, 10, { tick: true, maxed: true });
    });
    after(1950, () => {
        setBanner(banner, "TRUST MAXED!");
        revealBanner(banner);
    });

    clickToDismiss(overlay, 300, () => fadeAudio(sfx?.trust_max, 0.5));
}

export {
    initTrustAnimations,
    playTrustRankUp,
    playTrustRankDown,
    playTrustMaxed,
    playTrustToDistrustTransition,
    playDistrustRankDown,
    playDistrustRankUp,
    playDistrustToTrustRecovery
};
