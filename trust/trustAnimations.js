import { buildDecagram, crackShard, shatterShard } from "./trustDecagram.js";

let sfx;
let unlockAudio;
let playSfx;
let getSetting;

const SOCIAL_ANIMATION_SPEED = {
    overlayOut: 300,
    step: 220
};

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

function setupSocialCeremony({ distrust = false } = {}) {
    if (!trustCeremoniesEnabled()) return null;
    unlockAudio();

    const overlay = document.getElementById("trust-rankup-overlay");
    const svg = document.getElementById("trust-decagram");
    const banner = overlay?.querySelector(".trust-banner");

    if (!overlay || !svg || !banner) return null;

    ensureCenteredSocialOverlay(overlay);

    overlay.classList.remove("social-add", "social-remove", "social-surge");
    overlay.classList.toggle("distrust", distrust);
    overlay.classList.add("show");

    banner.classList.remove("show");

    if (distrust) {
        svg.dataset.mode = "distrust";
    } else {
        delete svg.dataset.mode;
    }

    return { overlay, svg, banner };
}

function playShardPulse(svg, index, variant) {
    const shard = svg.querySelector(`path[data-index="${index}"]`);
    if (!shard) return;

    shard.classList.remove("social-shard-add", "social-shard-remove");
    void shard.offsetWidth;
    shard.classList.add(variant === "add" ? "social-shard-add" : "social-shard-remove");
}

function runSocialTimeline(steps) {
    let elapsed = 0;
    steps.forEach(({ at = 0, action }) => {
        const delay = Math.max(0, at + elapsed);
        setTimeout(action, delay);
    });
}

function autoDismiss(overlay, banner, delay) {
    setTimeout(() => {
        overlay.classList.remove("show", "distrust", "social-add", "social-remove", "social-surge");
        banner.classList.remove("show");
    }, delay);
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
    const scene = setupSocialCeremony();
    if (!scene) return;

    const { overlay, svg, banner } = scene;
    overlay.classList.add("social-add");
    banner.textContent = "TRUST INCREASED!";

    buildDecagram(svg, previous);
    playSfx(sfx.trust_up);

    runSocialTimeline([
        {
            at: SOCIAL_ANIMATION_SPEED.step,
            action: () => {
                buildDecagram(svg, current);
                playShardPulse(svg, current - 1, "add");
            }
        },
        {
            at: SOCIAL_ANIMATION_SPEED.step + 180,
            action: () => banner.classList.add("show")
        }
    ]);

    autoDismiss(overlay, banner, 1700);
}

function playTrustRankDown(previous, current) {
    const scene = setupSocialCeremony();
    if (!scene) return;

    const { overlay, svg, banner } = scene;
    overlay.classList.add("social-remove");
    banner.textContent = "TRUST DECREASED...";

    buildDecagram(svg, previous);
    playSfx(sfx.trust_down || sfx.monokumasad);

    runSocialTimeline([
        {
            at: 140,
            action: () => {
                const target = Math.max(0, previous - 1);
                playShardPulse(svg, target, "remove");
                shatterShard(svg, target);
            }
        },
        {
            at: 360,
            action: () => {
                buildDecagram(svg, current);
                banner.classList.add("show");
            }
        }
    ]);

    autoDismiss(overlay, banner, 1300);
}

function playDistrustRankDown(previous, current) {
    const scene = setupSocialCeremony({ distrust: true });
    if (!scene) return;

    const { overlay, svg, banner } = scene;
    overlay.classList.add("social-add");
    banner.textContent = "DISTRUST INCREASED…";

    buildDecagram(svg, previous);
    playSfx(sfx.trust_down || sfx.monokumasad);

    const newAbs = Math.abs(current);
    const targetIndex = 10 - newAbs;

    runSocialTimeline([
        {
            at: 140,
            action: () => {
                buildDecagram(svg, current);
                playShardPulse(svg, targetIndex, "add");
            }
        },
        {
            at: 340,
            action: () => banner.classList.add("show")
        }
    ]);

    autoDismiss(overlay, banner, 1300);
}

function playDistrustRankUp(previous, current) {
    const scene = setupSocialCeremony({ distrust: true });
    if (!scene) return;

    const { overlay, svg, banner } = scene;
    overlay.classList.add("social-remove");
    banner.textContent = "DISTRUST WEAKENING…";

    buildDecagram(svg, previous);

    if (sfx.distrust_recover) {
        sfx.distrust_recover.volume = 0.35;
        playSfx(sfx.distrust_recover);
    }

    const targetIndex = 10 - Math.abs(previous);

    runSocialTimeline([
        {
            at: 120,
            action: () => {
                crackShard(svg, targetIndex);
                playShardPulse(svg, targetIndex, "remove");
            }
        },
        {
            at: 350,
            action: () => {
                buildDecagram(svg, current);
                banner.classList.add("show");
            }
        }
    ]);

    autoDismiss(overlay, banner, 1400);
}

function playDistrustToTrustRecovery() {
    const scene = setupSocialCeremony({ distrust: true });
    if (!scene) return;

    const { overlay, svg, banner } = scene;
    overlay.classList.add("social-surge");
    delete svg.dataset.gold;

    banner.textContent = "";
    buildDecagram(svg, -1);

    if (sfx.trust_up) {
        sfx.trust_up.volume = 0.4;
        playSfx(sfx.trust_up);
    }

    runSocialTimeline([
        {
            at: 380,
            action: () => playShardPulse(svg, 9, "remove")
        },
        {
            at: 900,
            action: () => svg.classList.add("purify-pulse")
        },
        {
            at: 1450,
            action: () => {
                svg.classList.remove("purify-pulse");
                delete svg.dataset.mode;
                buildDecagram(svg, 1);
            }
        },
        {
            at: 1680,
            action: () => {
                banner.textContent = "TRUST REGAINED!";
                banner.classList.add("show");
            }
        }
    ]);

    const dismissOverlay = () => {
        overlay.classList.remove("show", "distrust", "social-surge");
        banner.classList.remove("show");
        document.removeEventListener("click", dismissOverlay);
    };

    setTimeout(() => {
        document.addEventListener("click", dismissOverlay, { once: true });
    }, 400);
}

export async function playTrustToDistrustTransition() {
    const scene = setupSocialCeremony({ distrust: true });
    if (!scene) return;

    const { overlay, svg, banner } = scene;
    overlay.classList.add("social-remove");
    banner.textContent = "DISTRUST INCREASED...";

    buildDecagram(svg, 1);

    if (sfx.trust_shatter) {
        playSfx(sfx.trust_shatter);
    }

    runSocialTimeline([
        {
            at: 260,
            action: () => playShardPulse(svg, 0, "remove")
        },
        {
            at: 640,
            action: () => svg.classList.add("spin-up")
        },
        {
            at: 1050,
            action: () => [...svg.querySelectorAll("path")].forEach((_, i) => shatterShard(svg, i))
        },
        {
            at: 1520,
            action: () => {
                svg.classList.remove("spin-up");
                svg.dataset.mode = "distrust";
                buildDecagram(svg, -1);
                banner.classList.add("show");
            }
        }
    ]);

    const dismissOverlay = () => {
        overlay.classList.remove("show", "distrust", "social-remove");
        banner.classList.remove("show");

        if (sfx.trust_shatter) {
            sfx.trust_shatter.pause();
            sfx.trust_shatter.currentTime = 0;
        }
    };

    overlay.addEventListener("click", dismissOverlay, { once: true });
}

function playTrustMaxed() {
    const scene = setupSocialCeremony();
    if (!scene) return;

    const { overlay, svg, banner } = scene;
    overlay.classList.add("social-surge", "max");
    svg.dataset.gold = "false";

    banner.textContent = "";
    buildDecagram(svg, 9);

    playSfx(sfx.trust_max);

    runSocialTimeline([
        {
            at: 900,
            action: () => {
                buildDecagram(svg, 10);
                playShardPulse(svg, 9, "add");
            }
        },
        {
            at: 1700,
            action: () => {
                svg.dataset.gold = "true";
                buildDecagram(svg, 10);
                const reveal = svg.querySelector("#goldRevealCircle");
                reveal?.animate([{ r: 0 }, { r: 120 }], {
                    duration: 1200,
                    easing: "cubic-bezier(0.2, 0.9, 0.2, 1)",
                    fill: "forwards"
                });
            }
        },
        {
            at: 1950,
            action: () => {
                banner.textContent = "TRUST MAXED!";
                banner.classList.add("show");
            }
        }
    ]);

    const dismissOverlay = () => {
        overlay.classList.remove("show", "social-surge", "max");
        banner.classList.remove("show");

        if (sfx.trust_max) {
            const audio = sfx.trust_max;
            const fade = setInterval(() => {
                audio.volume = Math.max(0, audio.volume - 0.05);
                if (audio.volume <= 0) {
                    clearInterval(fade);
                    audio.pause();
                    audio.currentTime = 0;
                    audio.volume = 0.5;
                }
            }, 30);
        }

        document.removeEventListener("click", dismissOverlay);
    };

    setTimeout(() => {
        document.addEventListener("click", dismissOverlay, { once: true });
    }, 300);
}
