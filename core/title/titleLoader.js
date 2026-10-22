import { escapeHtml } from "./titleUtils.js";

export const LOADING_CURTAIN_ID = "dangan-loading-curtain";

// SillyTavern's start-up splash (logo + "Initializing…"). Our stylesheet
// blanks it as soon as it loads; the curtain then shows through it.
const SPLASH_SELECTOR = "#loader.splash-screen";
// SillyTavern removes #loader before it closes the dialog around it, so the
// dialog gets its own mark to stay hidden until it's gone too.
const SPLASH_DIALOG_CLASS = "dgn-splash-dialog";
const LOADING_CLASS = "dgn-loading";
const EXIT_DURATION_MS = 900;
const SPLASH_POLL_MS = 100;
// Never keep SillyTavern covered if the title screen never reports in.
const FAILSAFE_MS = 60000;

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

let releasing = null;

// Covers the page with the loading screen until releaseLoadingCurtain().
// It sits under SillyTavern's splash dialog (made see-through) and over the
// title screen, so neither the splash closing nor the title screen fading
// in ever shows SillyTavern's own UI. Returns false when there's no splash.
export function showLoadingCurtain({ extensionFolderPath = "", random = Math.random } = {}) {
    if (typeof document === "undefined" || !document.body) return false;
    const splash = document.querySelector(SPLASH_SELECTOR);
    if (!splash || document.getElementById(LOADING_CURTAIN_ID)) return false;

    const src = `${extensionFolderPath}/assets/images/title/chibisprites/${pickChibiSprite(random)}.png`;
    // Both halves carry the same backdrop; they part along the diagonal on exit.
    const half = (side) => `
        <div class="dgn-loader-half dgn-loader-half-${side}">
            <div class="dgn-loader-dots-bg"></div>
            <div class="dgn-loader-band"></div>
            <div class="dgn-title-vignette"></div>
            <div class="dgn-title-scanlines"></div>
        </div>
    `;
    const curtain = document.createElement("div");
    curtain.id = LOADING_CURTAIN_ID;
    curtain.setAttribute("aria-hidden", "true");
    curtain.innerHTML = `
        ${half("top")}
        ${half("bottom")}
        <div class="dgn-loader-seam"></div>
        <div class="dgn-loader-stage">
            <div class="dgn-loader-chibi-wrap">
                <img class="dgn-loader-chibi" src="${escapeHtml(src)}" alt="" draggable="false">
                <div class="dgn-loader-shadow"></div>
            </div>
            <div class="dgn-loader-label">NOW LOADING<span class="dgn-loader-dots"></span></div>
        </div>
    `;
    // Wait for the sprite so it doesn't pop in half-decoded.
    const img = curtain.querySelector(".dgn-loader-chibi");
    img.addEventListener("load", () => curtain.classList.add("is-ready"), { once: true });
    img.addEventListener("error", () => curtain.classList.add("is-ready", "is-missing"), { once: true });
    document.body.appendChild(curtain);
    curtain.style.setProperty("z-index", "2147483647", "important");
    splash.closest("dialog")?.classList.add(SPLASH_DIALOG_CLASS);
    document.body.classList.add(LOADING_CLASS);
    setTimeout(() => releaseLoadingCurtain(), FAILSAFE_MS);
    return true;
}

const isSplashOpen = () => !!document.querySelector(`${SPLASH_SELECTOR}, dialog.${SPLASH_DIALOG_CLASS}`);

// Resolves once SillyTavern's splash and its dialog are gone (or right away
// without one); until then the dialog keeps the page underneath inert.
export async function waitForSplashToClose() {
    if (typeof document === "undefined") return;
    const started = Date.now();
    while (isSplashOpen() && Date.now() - started < FAILSAFE_MS) {
        await new Promise((r) => setTimeout(r, SPLASH_POLL_MS));
    }
}

// Opens the curtain once SillyTavern's splash has closed.
export function releaseLoadingCurtain() {
    if (typeof document === "undefined") return Promise.resolve(false);
    if (releasing) return releasing;
    const curtain = document.getElementById(LOADING_CURTAIN_ID);
    if (!curtain) return Promise.resolve(false);

    releasing = (async () => {
        await waitForSplashToClose();
        curtain.classList.add("is-leaving");
        await new Promise((r) => setTimeout(r, EXIT_DURATION_MS));
        curtain.remove();
        document.body.classList.remove(LOADING_CLASS);
        return true;
    })();
    return releasing;
}
