const INTRO_ID       = 'dangan-intro-overlay';
const INTRO_STYLE_ID = 'dangan-intro-style';
const BAND_ANGLE     = -18; // degrees — must match rotation in CSS
const BAND_HEIGHTS   = [90, 20, 44, 130, 90];

// ── Colour helpers ────────────────────────────────────────────────────────────

function parseRgb(str) {
    const m = String(str).match(/\d+/g);
    return m ? [+m[0], +m[1], +m[2]] : [128, 128, 128];
}

function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l * 100];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        default: h = ((r - g) / d + 4) / 6;
    }
    return [h * 360, s * 100, l * 100];
}

function hslToRgb(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue2 = (t) => {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
    };
    return [Math.round(hue2(h + 1/3) * 255), Math.round(hue2(h) * 255), Math.round(hue2(h - 1/3) * 255)];
}

function css(r, g, b) { return `rgb(${r},${g},${b})`; }

// Darkens a colour string if its lightness exceeds maxL (0–100).
function clampDark(colorStr, maxL = 65) {
    const [r, g, b] = parseRgb(colorStr);
    const [h, s, l] = rgbToHsl(r, g, b);
    if (l <= maxL) return colorStr;
    return css(...hslToRgb(h, s, maxL));
}

// Given 5 extracted dominant colours, derive the full palette for the screen.
function buildPalette(colors) {
    const parsed = colors.map(parseRgb);
    const hsls   = parsed.map(([r, g, b]) => rgbToHsl(r, g, b));

    // Most saturated colour → accent (Ultimate label, dot shadow)
    const accentIdx = hsls.reduce((bi, [, s], i) => s > hsls[bi][1] ? i : bi, 0);
    const [ah, as_]  = hsls[accentIdx];
    const accentRgb  = hslToRgb(ah, Math.min(100, as_ * 1.2), 58);

    // Background: keep hue of accent, but very light and moderately saturated
    const bgRgb      = hslToRgb(ah, Math.min(60, as_ * 0.7), 72);
    const dotRgb     = hslToRgb(ah, Math.min(65, as_ * 0.8), 60);

    return {
        bg:      css(...bgRgb),
        dot:     css(...dotRgb),
        accent:  css(...accentRgb),
        bands:   colors.map(c => clampDark(c, 65)),
    };
}

// ── Style sheet (layout only — colours injected via inline styles) ─────────────

function buildIntroStyles() {
    return `
    #${INTRO_ID} {
        position: fixed; inset: 0;
        z-index: 2147483645;
        pointer-events: none;
        user-select: none;
        overflow: hidden;
    }

    /* Chrome wrap — everything that should be hue-shifted lives here.
       Sprite is intentionally a sibling so it keeps its natural color. */
    #dangan-intro-chrome {
        position: absolute;
        inset: 0;
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
    }

    /* Foreground decoration image — replaces the rendered diagonal stripe bands */
    #dangan-intro-fg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center;
        pointer-events: none;
        z-index: 4;
    }

    /* Revolver cylinder — top-right, spinning clockwise */
    #dangan-intro-cylinder {
        position: absolute;
        top: -18%; right: -10%;
        width: 65%;
        aspect-ratio: 1;
        object-fit: contain;
        opacity: 0.18;
        pointer-events: none;
        animation: dangan-intro-cylinder-spin 12s linear infinite;
    }
    @keyframes dangan-intro-cylinder-spin {
        from { transform: rotate(0deg); }
        to   { transform: rotate(360deg); }
    }

    /* Character sprite */
    #dangan-intro-sprite {
        position: absolute;
        bottom: 0;
        right: calc(66% + 50px);
        height: 94vh;
        width: auto;
        object-fit: contain;
        object-position: bottom right;
        pointer-events: none;
        z-index: 6;
        filter: drop-shadow(0px 0 0px rgba(0,0,0,1));
        animation: dangan-intro-sprite-shadow 4s ease forwards;
    }
    @keyframes dangan-intro-sprite-shadow {
        from { filter: drop-shadow(0px 0 0px rgba(0,0,0,1)); }
        to   { filter: drop-shadow(50px 0 0px rgba(0,0,0,1)); }
    }

    /* Shared text block base */
    .dangan-intro-text-block {
        position: absolute;
        left: 49%;
        transform: translateY(5%) rotate(13deg);
        transform-origin: left center;
        pointer-events: none;
        z-index: 6;
        max-width: 44%;
    }

    /* Name — top portion of the banner */
    #dangan-intro-name-wrap {
        top: 49%;
    }

    /* Ultimate — middle (largest) band */
    #dangan-intro-ultimate-wrap {
        top: 59%;
        left: 48%;
        display: flex;
        flex-direction: row;
        width: auto;
        position: absolute;
    }

    /* Name — uses the Quickend stack with a coloured first letter */
    #dangan-intro-name {
        font-family: "Quickend", "Boldonse", "Orbitron", "Rajdhani", monospace;
        font-size: clamp(32px, 4vw, 58px);
        font-weight: 900;
        color: rgb(255 255 255);
        line-height: 1.1;
        letter-spacing: 2px;
        text-shadow: rgb(255 255 255) 0px 0px 12px;
    }
    #dangan-intro-name::first-letter {
        color: rgb(255, 55, 196);
        text-shadow: 0 0 12px rgba(255, 55, 196, 0.85);
    }

    /* Ultimate label + value — black text with a coloured glow */
    #dangan-intro-ultimate-label,
    #dangan-intro-ultimate {
        font-family: "Limelight", "Cinzel", "Impact", Georgia, serif;
        font-size: clamp(32px, 4vw, 58px);
        font-weight: 900;
        color: #000;
        line-height: 1.1;
        letter-spacing: 2px;
        text-shadow:
            0 0 8px  rgba(255, 55, 196, 0.95),
            0 0 18px rgba(255, 55, 196, 0.65),
            0 0 32px rgba(255, 55, 196, 0.40);
    }
    #dangan-intro-ultimate-label {
        margin-right: 15px;
    }

    `;
}

// ── Colour extraction ─────────────────────────────────────────────────────────

async function extractDominantColors(imgSrc, count = 5) {
    return new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const SIZE = 80;
                const canvas = document.createElement('canvas');
                canvas.width = SIZE; canvas.height = SIZE;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, SIZE, SIZE);
                const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

                const bins = new Map();
                for (let i = 0; i < data.length; i += 4) {
                    if (data[i + 3] < 100) continue;
                    const r = Math.round(data[i]     / 24) * 24;
                    const g = Math.round(data[i + 1] / 24) * 24;
                    const b = Math.round(data[i + 2] / 24) * 24;
                    const k = (r << 16) | (g << 8) | b;
                    bins.set(k, (bins.get(k) || 0) + 1);
                }

                const sorted = [...bins.entries()].sort((a, b) => b[1] - a[1]);
                const picked = [];
                const THRESHOLD = 60;
                for (const [k] of sorted) {
                    if (picked.length >= count) break;
                    const r = (k >> 16) & 0xff, g = (k >> 8) & 0xff, b = k & 0xff;
                    const tooClose = picked.some(([pr, pg, pb]) => {
                        const dr = r - pr, dg = g - pg, db = b - pb;
                        return Math.sqrt(dr*dr + dg*dg + db*db) < THRESHOLD;
                    });
                    if (!tooClose) picked.push([r, g, b]);
                }
                while (picked.length < count) picked.push([80, 80, 80]);
                resolve(picked.map(([r, g, b]) => css(r, g, b)));
            } catch { resolve(null); }
        };
        img.onerror = () => resolve(null);
        img.src = imgSrc;
    });
}

// ── Controller ────────────────────────────────────────────────────────────────

export function createIntroduceCharacterController({ extensionFolderPath = '' } = {}) {
    async function run({ name = '', ultimate = null, spriteUrl = null } = {}) {
        if (document.getElementById(INTRO_ID)) return;

        if (!document.getElementById(INTRO_STYLE_ID)) {
            const styleEl = document.createElement('style');
            styleEl.id = INTRO_STYLE_ID;
            styleEl.textContent = buildIntroStyles();
            document.head.appendChild(styleEl);
        }

        const overlay = document.createElement('div');
        overlay.id = INTRO_ID;
        overlay.style.opacity    = '0';
        overlay.style.transition = 'opacity 0.25s ease';

        // Chrome wrap holds everything that should be hue-shifted (bg, fg,
        // cylinder, text). The sprite sits OUTSIDE this wrap as a sibling so
        // it keeps its natural colors.
        const chromeWrap = document.createElement('div');
        chromeWrap.id = 'dangan-intro-chrome';
        chromeWrap.style.backgroundImage = `url("${extensionFolderPath}/assets/images/ui/intro-bg.png")`;
        // Debug: random hue-shift each invocation so themes are easy to eyeball.
        const introHue = Math.floor(Math.random() * 360);
        chromeWrap.style.filter = `hue-rotate(${introHue}deg)`;
        console.log(`[Dangan][Intro] hue-rotate: ${introHue}deg`);
        overlay.appendChild(chromeWrap);

        // Revolver cylinder (hue-shifted)
        const cylinder = document.createElement('img');
        cylinder.id  = 'dangan-intro-cylinder';
        cylinder.src = `${extensionFolderPath}/assets/images/minigames/revolver-cylinder.png`;
        cylinder.alt = '';
        chromeWrap.appendChild(cylinder);

        // Character sprite (NOT hue-shifted — appended to overlay, not chrome)
        if (spriteUrl) {
            const sprite = document.createElement('img');
            sprite.id  = 'dangan-intro-sprite';
            sprite.src = spriteUrl;
            sprite.alt = name;
            overlay.appendChild(sprite);
        }

        // Foreground decoration image (hue-shifted)
        const fg = document.createElement('img');
        fg.id = 'dangan-intro-fg';
        fg.src = `${extensionFolderPath}/assets/images/ui/intro-fg.png`;
        fg.alt = '';
        chromeWrap.appendChild(fg);

        // Name block — top portion of the banner
        const nameWrap = document.createElement('div');
        nameWrap.id        = 'dangan-intro-name-wrap';
        nameWrap.className = 'dangan-intro-text-block';
        const nameEl = document.createElement('div');
        nameEl.id          = 'dangan-intro-name';
        nameEl.textContent = name;
        nameWrap.appendChild(nameEl);
        chromeWrap.appendChild(nameWrap);

        // Ultimate block — middle portion of the banner
        if (ultimate) {
            const ultimateWrap = document.createElement('div');
            ultimateWrap.id        = 'dangan-intro-ultimate-wrap';
            ultimateWrap.className = 'dangan-intro-text-block';

            const labelEl = document.createElement('div');
            labelEl.id            = 'dangan-intro-ultimate-label';
            labelEl.textContent   = 'Ultimate';
            ultimateWrap.appendChild(labelEl);

            const ultimateEl = document.createElement('div');
            ultimateEl.id          = 'dangan-intro-ultimate';
            ultimateEl.textContent = ultimate;
            ultimateWrap.appendChild(ultimateEl);

            chromeWrap.appendChild(ultimateWrap);
        }

        document.body.appendChild(overlay);

        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

        // Auto-shrink: if the rotated text wraps go off the viewport, drop the
        // font-size one px at a time until they fit (down to a sensible floor).
        const fitToViewport = (textEls, wrapEl, minPx = 18) => {
            if (!wrapEl || !textEls.length) return;
            for (const el of textEls) el.style.whiteSpace = 'nowrap';
            let safety = 80;
            const margin = 20;
            while (safety-- > 0) {
                const rect = wrapEl.getBoundingClientRect();
                const fits =
                    rect.right  <= window.innerWidth  - margin &&
                    rect.left   >= margin &&
                    rect.bottom <= window.innerHeight - margin &&
                    rect.top    >= margin;
                if (fits) break;
                const sizes = textEls.map(el => parseFloat(getComputedStyle(el).fontSize));
                if (Math.min(...sizes) <= minPx) break;
                textEls.forEach((el, i) => {
                    el.style.fontSize = `${Math.max(minPx, sizes[i] - 1)}px`;
                });
            }
        };
        const nameElForFit = overlay.querySelector('#dangan-intro-name');
        const nameWrapForFit = overlay.querySelector('#dangan-intro-name-wrap');
        if (nameElForFit && nameWrapForFit) fitToViewport([nameElForFit], nameWrapForFit);
        const ultLabel = overlay.querySelector('#dangan-intro-ultimate-label');
        const ultValue = overlay.querySelector('#dangan-intro-ultimate');
        const ultWrap  = overlay.querySelector('#dangan-intro-ultimate-wrap');
        if (ultValue && ultWrap) {
            const targets = ultLabel ? [ultLabel, ultValue] : [ultValue];
            fitToViewport(targets, ultWrap);
        }

        overlay.style.opacity = '1';

        const introAudio = new Audio(`${extensionFolderPath}/assets/sfx/ui/introduction.wav`);
        introAudio.play().catch(() => {});

        await new Promise(r => setTimeout(r, 4000));

        overlay.style.transition = 'opacity 0.5s ease';
        overlay.style.opacity    = '0';
        await new Promise(r => setTimeout(r, 500));
        overlay.remove();
    }

    return { run };
}
