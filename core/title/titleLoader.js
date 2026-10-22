import { escapeHtml } from "./titleUtils.js";

// SillyTavern's start-up splash (logo + "Initializing…"). Our stylesheet
// restyles it as soon as it loads; this adds a random chibi on top.
const SPLASH_SELECTOR = "#loader.splash-screen";

// The browser can't list a folder, so these mirror
// assets/images/title/chibisprites/*.png.
export const CHIBI_SPRITES = Object.freeze([
    "K1-B0", "akane", "angie", "aoi", "byakuya", "celes", "chiaki", "chihiro",
    "fuyuhiko", "gonta", "gundham", "hifumi", "himiko", "hiyoko", "ibuki", "junko",
    "kaede", "kaito", "kazuichi", "kirumi", "kiyotaka", "kokichi", "komaru", "korekiyo",
    "kyoko", "leon", "mahiru", "maki", "makoto", "mikan", "miu", "mondo",
    "monodam", "monokid", "monokuma", "monomi", "monophanie", "monosuke", "monotaro", "mukuro",
    "nekomaru", "peko", "rantaro", "ryoma", "sakura", "sayaka", "shuichi", "sonia",
    "tenko", "teruteru", "toko", "tsumugi", "u_i", "yasuhiro",
]);

export function pickChibiSprite(random = Math.random) {
    const index = Math.floor(random() * CHIBI_SPRITES.length);
    return CHIBI_SPRITES[Math.min(Math.max(index, 0), CHIBI_SPRITES.length - 1)];
}

// Returns false when there is no splash to dress (it may already be gone).
export function dressSplashScreen({ extensionFolderPath = "", random = Math.random } = {}) {
    if (typeof document === "undefined") return false;
    const splash = document.querySelector(SPLASH_SELECTOR);
    if (!splash || splash.querySelector(".dgn-loader")) return false;

    const src = `${extensionFolderPath}/assets/images/title/chibisprites/${pickChibiSprite(random)}.png`;
    const art = document.createElement("div");
    art.className = "dgn-loader";
    art.setAttribute("aria-hidden", "true");
    art.innerHTML = `
        <div class="dgn-loader-bg">
            <div class="dgn-title-stripes"></div>
            <div class="dgn-loader-slab dgn-loader-slab-pink"></div>
            <div class="dgn-loader-slab dgn-loader-slab-dark"></div>
            <div class="dgn-title-vignette"></div>
            <div class="dgn-title-scanlines"></div>
        </div>
        <div class="dgn-loader-stage">
            <div class="dgn-loader-chibi-wrap">
                <img class="dgn-loader-chibi" src="${escapeHtml(src)}" alt="" draggable="false">
                <div class="dgn-loader-shadow"></div>
            </div>
            <div class="dgn-loader-label">NOW LOADING<span class="dgn-loader-dots"></span></div>
        </div>
    `;
    // Wait for the sprite so it doesn't pop in half-decoded.
    const img = art.querySelector(".dgn-loader-chibi");
    img.addEventListener("load", () => art.classList.add("is-ready"), { once: true });
    img.addEventListener("error", () => art.classList.add("is-ready", "is-missing"), { once: true });
    splash.appendChild(art);
    return true;
}
