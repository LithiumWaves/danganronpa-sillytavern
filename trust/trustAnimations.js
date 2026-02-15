import { buildDecagram, crackShard, shatterShard } from "./trustDecagram.js";

let sfx;
let unlockAudio;
let playSfx;
let getSetting;

function initTrustAnimations(deps) {
    sfx = deps.sfx;
    unlockAudio = deps.unlockAudio;
    playSfx = deps.playSfx;
    getSetting = deps.getSetting;
}

function trustCeremoniesEnabled() {
    return !getSetting || !!getSetting("trustCeremonies");
}

function ensureCenteredSocialOverlay(overlay) {
    if (!overlay) return;

    if (overlay.parentElement !== document.body) {
        document.body.appendChild(overlay);
    }

    const isMobile = window.matchMedia?.("(max-width: 700px)")?.matches;
    const topInset = "env(safe-area-inset-top, 0px)";
    const bottomInset = "env(safe-area-inset-bottom, 0px)";

    overlay.style.setProperty("position", "fixed", "important");
    overlay.style.setProperty("top", "0", "important");
    overlay.style.setProperty("left", "0", "important");
    overlay.style.setProperty("width", "100vw", "important");
    overlay.style.setProperty("height", "100dvh", "important");
    overlay.style.setProperty("display", "flex", "important");
    overlay.style.setProperty("align-items", "center", "important");
    overlay.style.setProperty("justify-content", "center", "important");
    overlay.style.setProperty("padding-top", isMobile ? `max(10px, calc(${topInset} + 8px))` : "16px", "important");
    overlay.style.setProperty("padding-bottom", isMobile ? `max(10px, calc(${bottomInset} + 8px))` : "16px", "important");
    overlay.style.setProperty("padding-left", isMobile ? "10px" : "16px", "important");
    overlay.style.setProperty("padding-right", isMobile ? "10px" : "16px", "important");
    overlay.style.setProperty("box-sizing", "border-box", "important");
    overlay.style.setProperty("z-index", "2147483600", "important");

    const core = overlay.querySelector(".trust-rankup-core");
    if (!core) return;

    core.style.setProperty("margin", "0 auto", "important");
    core.style.setProperty("max-width", isMobile ? "94vw" : "min(460px, 96vw)", "important");
}

function waitForSfx(audio) {
    return new Promise(resolve => {
        //  If it's not an audio element, don't wait
        if (!(audio instanceof HTMLAudioElement)) {
            resolve();
            return;
        }

        audio.onended = () => resolve();
    });
}


export {
    initTrustAnimations,
    playTrustRankUp,
    playTrustRankDown,
    playTrustMaxed,
    playDistrustRankDown,
    playDistrustRankUp,
    playDistrustToTrustRecovery
};

function playTrustRankUp(previous, current) {
    if (!trustCeremoniesEnabled()) return;
    unlockAudio();
    const overlay = document.getElementById("trust-rankup-overlay");
    const svg = document.getElementById("trust-decagram");
    const banner = document.getElementById("trust-rankup-banner");

    if (!overlay || !svg || !banner) return;
    ensureCenteredSocialOverlay(overlay);

    overlay.classList.add("show");
    banner.classList.remove("show");

    banner.textContent = "TRUST INCREASED!";

    buildDecagram(svg, previous);

    // SFX here
    playSfx(sfx.trust_up);

    setTimeout(() => {
        buildDecagram(svg, current);
        banner.classList.add("show");
    }, 600);

    setTimeout(() => {
        overlay.classList.remove("show");
        banner.classList.remove("show");
    }, 2000);
}

function playTrustRankDown(previous, current) {
    if (!trustCeremoniesEnabled()) return;
    unlockAudio();

    const overlay = document.getElementById("trust-rankup-overlay");
    const svg = document.getElementById("trust-decagram");
    const banner = overlay?.querySelector(".trust-banner");

    if (!overlay || !svg || !banner) return;
    ensureCenteredSocialOverlay(overlay);

    overlay.classList.add("show");
    banner.classList.remove("show");
    banner.textContent = "TRUST DECREASED...";

    // Draw full previous state
    buildDecagram(svg, previous);

    playSfx(sfx.trust_down || sfx.monokumasad);

    // :boom: Shatter the last filled shard
    setTimeout(() => {
        shatterShard(svg, previous - 1);
    }, 120);

    // Redraw reduced state
    setTimeout(() => {
        buildDecagram(svg, current);
        banner.classList.add("show");
    }, 300);

    // Exit fast
    setTimeout(() => {
        overlay.classList.remove("show");
        banner.classList.remove("show");
    }, 900);
}

function playDistrustRankDown(previous, current) {
    if (!trustCeremoniesEnabled()) return;
    unlockAudio();

    const overlay = document.getElementById("trust-rankup-overlay");
    const svg = document.getElementById("trust-decagram");
    const banner = overlay?.querySelector(".trust-banner");

    if (!overlay || !svg || !banner) return;
    ensureCenteredSocialOverlay(overlay);

    svg.dataset.mode = "distrust";

    overlay.classList.add("show", "distrust");
    banner.classList.remove("show");

    banner.textContent = "DISTRUST INCREASED…";

    // Draw previous state (less red)
    buildDecagram(svg, previous);

    playSfx(sfx.trust_down || sfx.monokumasad);

    // 💥 Shatter one shard OUTWARD (right → left logic)
    const shatteredIndex = 10 - Math.abs(current);

    setTimeout(() => {
        shatterShard(svg, shatteredIndex);
    }, 120);

    // Draw new darker state
    setTimeout(() => {
        buildDecagram(svg, current);
        banner.classList.add("show");
    }, 300);

    // Exit quickly
    setTimeout(() => {
        overlay.classList.remove("show", "distrust");
        banner.classList.remove("show");
        delete svg.dataset.mode;
    }, 900);
}

function playDistrustRankUp(previous, current) {
    if (!trustCeremoniesEnabled()) return;
    unlockAudio();

    const overlay = document.getElementById("trust-rankup-overlay");
    const svg = document.getElementById("trust-decagram");
    const banner = overlay?.querySelector(".trust-banner");

    if (!overlay || !svg || !banner) return;
    ensureCenteredSocialOverlay(overlay);

    svg.dataset.mode = "distrust";

    overlay.classList.add("show", "distrust");
    banner.classList.remove("show");

    banner.textContent = "DISTRUST WEAKENING…";

    // Draw heavier distrust first
    buildDecagram(svg, previous);

    // 🔇 Softer recovery SFX
    if (sfx.distrust_recover) {
        sfx.trust_up.volume = 0.35;
        playSfx(sfx.distrust_recover);
    }

    // Which shard reforms? (right → left logic)
    const reformedIndex = 10 - Math.abs(previous);

    // 🩸 Crack before reform
    setTimeout(() => {
        crackShard(svg, reformedIndex);
    }, 120);

    // 🧬 Rebuild with less red
    setTimeout(() => {
        buildDecagram(svg, current);
        banner.classList.add("show");
    }, 320);

    // Exit
    setTimeout(() => {
        overlay.classList.remove("show", "distrust");
        banner.classList.remove("show");
        delete svg.dataset.mode;
    }, 1000);
}

function playDistrustToTrustRecovery() {
    if (!trustCeremoniesEnabled()) return;
    unlockAudio();

    const overlay = document.getElementById("trust-rankup-overlay");
    const svg = document.getElementById("trust-decagram");
    const banner = overlay?.querySelector(".trust-banner");

    if (!overlay || !svg || !banner) return;
    ensureCenteredSocialOverlay(overlay);

    // Start fully in distrust
    svg.dataset.mode = "distrust";
    delete svg.dataset.gold;

    overlay.classList.add("show");
    banner.classList.remove("show");
    banner.textContent = "";

    // 1️⃣ Draw Distrust Rank -1 (single red shard)
    buildDecagram(svg, -1);

    // 🔇 Low, hopeful sound (reuse trust_up softly)
    if (sfx.trust_up) {
        sfx.trust_up.volume = 0.4;
        playSfx(sfx.trust_up);
    }

    const shards = [...svg.querySelectorAll("path")];
    const lastRed = shards.find(p =>
        p.getAttribute("fill")?.includes("trustRedGradient")
    );

    // 2️⃣ Last red shard fades away
    setTimeout(() => {
        if (lastRed) {
            lastRed.style.transition = "opacity 0.6s ease";
            lastRed.style.opacity = "0";
        }
    }, 400);

    // 3️⃣ Crimson decagram pulse
    setTimeout(() => {
        svg.classList.add("purify-pulse");
    }, 900);

    // 4️⃣ White purification wave
    setTimeout(() => {
        const wave = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        wave.setAttribute("cx", "100");
        wave.setAttribute("cy", "100");
        wave.setAttribute("r", "0");
        wave.setAttribute("fill", "none");
        wave.setAttribute("stroke", "white");
        wave.setAttribute("stroke-width", "3");
        wave.setAttribute("opacity", "0.9");

        svg.appendChild(wave);

        wave.animate(
            [
                { r: 0, opacity: 0.9 },
                { r: 140, opacity: 0 }
            ],
            {
                duration: 900,
                easing: "ease-out",
                fill: "forwards"
            }
        );
    }, 1300);

    // 5️⃣ Purify back to Trust Rank 1
    setTimeout(() => {
        svg.classList.remove("purify-pulse");
        delete svg.dataset.mode;
        buildDecagram(svg, 1);
    }, 1900);

    // 6️⃣ Banner reveal
    setTimeout(() => {
        banner.textContent = "TRUST REGAINED!";
        banner.classList.add("show");
    }, 2100);

    // 🛑 Linger until click
    const dismissOverlay = () => {
        overlay.classList.remove("show");
        banner.classList.remove("show");
        document.removeEventListener("click", dismissOverlay);
    };

    setTimeout(() => {
        document.addEventListener("click", dismissOverlay, { once: true });
    }, 400);
}

export async function playTrustToDistrustTransition() {
    if (!trustCeremoniesEnabled()) return;
    unlockAudio();

    const overlay = document.getElementById("trust-rankup-overlay");
    const svg = document.getElementById("trust-decagram");
    const banner = overlay?.querySelector(".trust-banner");

    if (!overlay || !svg || !banner) return;
    ensureCenteredSocialOverlay(overlay);

    overlay.classList.add("show", "distrust");
    banner.classList.remove("show");
    banner.textContent = "DISTRUST INCREASED...";

    // 1️⃣ Draw Trust Rank 1
    buildDecagram(svg, 1);

    // 🔊 Play sound (DO NOT await)
    if (sfx.trust_shatter) {
        playSfx(sfx.trust_shatter);
    }

    const shards = [...svg.querySelectorAll("path")];
    const lastShard = shards.find(p => p.dataset.index === "0");

    // 2️⃣ Last shard falls
    setTimeout(() => {
        lastShard?.classList.add("trust-fall");
    }, 300);

    // 3️⃣ Spin-up
    setTimeout(() => {
        svg.classList.add("spin-up");
    }, 900);

    // 4️⃣ Full shatter
    setTimeout(() => {
        shards.forEach((_, i) => shatterShard(svg, i));
    }, 1400);

    // 5️⃣ Rebuild as distrust
    setTimeout(() => {
        svg.classList.remove("spin-up");
        svg.innerHTML = "";
        svg.dataset.mode = "distrust";
        buildDecagram(svg, 0);
    }, 1900);

    // 6️⃣ Red shard appears + banner
    setTimeout(() => {
        spawnDistrustShard(svg);
        banner.classList.add("show");
    }, 2300);

    // 🛑 Click to dismiss
    const dismissOverlay = () => {
        overlay.classList.remove("show", "distrust");
        banner.classList.remove("show");

        if (sfx.trust_shatter) {
            sfx.trust_shatter.pause();
            sfx.trust_shatter.currentTime = 0;
        }
    };

    overlay.addEventListener("click", dismissOverlay, { once: true });
}

function spawnDistrustShard(svg) {
    const shard = svg.querySelector(`path[data-index="9"]`);
    if (!shard) return;

    shard.style.transform = "scale(0)";
    shard.style.opacity = "0";

    shard.setAttribute("fill", "url(#trustRedGradient)");

    requestAnimationFrame(() => {
        shard.classList.add("distrust-crystal");
        shard.style.transform = "scale(1)";
        shard.style.opacity = "1";
    });
}

function playTrustMaxed() {
    if (!trustCeremoniesEnabled()) return;
    unlockAudio();

    const overlay = document.getElementById("trust-rankup-overlay");
    const svg = document.getElementById("trust-decagram");
    const banner = overlay?.querySelector(".trust-banner");

    if (!overlay || !svg || !banner) return;
    ensureCenteredSocialOverlay(overlay);

    svg.dataset.gold = "false";

    overlay.classList.add("show");
    banner.classList.remove("show");
    banner.textContent = "";

    // Draw 9 filled shards
    buildDecagram(svg, 9);

    // 🎵 Play max trust song
    playSfx(sfx.trust_max);

    // Pause for drama
    setTimeout(() => {
        const shards = svg.querySelectorAll("path");
        const finalShard = shards[9];

        if (finalShard) {
            finalShard.classList.add("final-shard");
            finalShard.setAttribute("fill", "url(#trustBlueGradient)");
        }
    }, 1200);

    // Turn everything gold
    setTimeout(() => {
        // Switch to gold (still hidden by )
svg.dataset.gold = "true";
buildDecagram(svg, 10);

const reveal = svg.querySelector("#goldRevealCircle");

if (reveal) {
    reveal.setAttribute("r", "0");

    reveal.animate(
        [
            { r: 0 },
            { r: 120 }
        ],
        {
            duration: 1400,
            easing: "ease-out",
            fill: "forwards"
        }
    );
}
    }, 2400);

    // Banner reveal
    setTimeout(() => {
        banner.textContent = "TRUST MAXED!";
        banner.classList.add("show");
    }, 2600);

// 🛑 Linger until user clicks (Rank 10 only)
const dismissOverlay = () => {
    overlay.classList.remove("show");
    banner.classList.remove("show");

    // 🔇 Stop max trust music immediately
    if (sfx.trust_max) {
    const audio = sfx.trust_max;
    const fade = setInterval(() => {
        audio.volume = Math.max(0, audio.volume - 0.05);
        if (audio.volume <= 0) {
            clearInterval(fade);
            audio.pause();
            audio.currentTime = 0;
            audio.volume = 0.5; // reset default
        }
    }, 30);
}

    document.removeEventListener("click", dismissOverlay);
};

// Delay listener slightly so the same click that caused rank up doesn't dismiss it
setTimeout(() => {
    document.addEventListener("click", dismissOverlay, { once: true });
}, 300);

}
