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
        bands:   colors,          // original 5 extracted colours
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
        background-size: 7px 7px;
    }

    /* Revolver cylinder — top-right, spinning clockwise */
    #dangan-intro-cylinder {
        position: absolute;
        top: -18%; right: -10%;
        width: 65%;
        aspect-ratio: 1;
        pointer-events: none;
        object-fit: contain;
        opacity: 0.18;
        animation: dangan-intro-cylinder-spin 12s linear infinite;
    }
    @keyframes dangan-intro-cylinder-spin {
        from { transform: rotate(0deg); }
        to   { transform: rotate(360deg); }
    }

    /* Character sprite */
    #dangan-intro-sprite {
        position: absolute;
        bottom: 0; right: calc(6% + 50px);
        height: 94vh;
        width: auto;
        object-fit: contain;
        object-position: bottom right;
        pointer-events: none;
        z-index: 6;
        filter: drop-shadow(-10px 0 24px rgba(0,0,0,0.45));
    }

    /* Text block — left-centre, tilted to match bands */
    #dangan-intro-text {
        position: absolute;
        left: 6%; top: 50%;
        transform: translateY(-50%) rotate(${BAND_ANGLE}deg);
        transform-origin: left center;
        pointer-events: none;
        z-index: 6;
        max-width: 44%;
    }

    #dangan-intro-name {
        font-family: "Cinzel", "Impact", Georgia, serif;
        font-size: clamp(32px, 4vw, 58px);
        font-weight: 900;
        color: #ffffff;
        line-height: 1.1;
        letter-spacing: 2px;
        text-shadow: 3px 3px 0 #000, -2px -2px 0 #000, 5px 5px 14px rgba(0,0,0,0.9);
        margin-bottom: 14px;
        word-break: break-word;
    }

    #dangan-intro-ultimate-label {
        font-family: "Cinzel", "Impact", Georgia, serif;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 4px;
        text-transform: uppercase;
        margin-bottom: 5px;
    }

    #dangan-intro-ultimate {
        font-family: "Cinzel", "Impact", Georgia, serif;
        font-size: clamp(18px, 2.2vw, 30px);
        font-weight: 700;
        color: #ffffff;
        letter-spacing: 1px;
        text-shadow: 2px 2px 0 #000, -1px -1px 0 #000, 0 0 18px rgba(255,255,255,0.45);
        word-break: break-word;
    }

    /* Static diagonal stripe group */
    #dangan-intro-shadow-wrap {
        position: absolute; inset: 0;
        pointer-events: none;
        z-index: 4;
    }
    #dangan-intro-shadow-inner {
        position: absolute;
        top: -80%; left: -20%;
        width: 140%; height: 260%;
        transform: rotate(${BAND_ANGLE}deg);
        transform-origin: center center;
    }
    #dangan-intro-band-group {
        position: absolute;
        top: 50%; left: 0; right: 0;
        transform: translateY(-50%);
        display: flex;
        flex-direction: column;
    }
    .intro-band { flex-shrink: 0; }
    .intro-band:first-child::before,
    .intro-band:last-child::after {
        content: '';
        display: block;
        height: 20px;
        background: inherit;
        clip-path: polygon(
            0% 0%, 2% 55%, 5% 15%, 8% 75%, 12% 28%, 16% 68%, 20% 8%,
            24% 62%, 28% 22%, 32% 72%, 36% 12%, 40% 52%, 44% 5%,
            48% 68%, 52% 18%, 56% 78%, 60% 28%, 64% 62%, 68% 8%,
            72% 72%, 76% 22%, 80% 58%, 84% 8%, 88% 68%, 92% 18%,
            96% 52%, 100% 25%, 100% 100%, 0% 100%
        );
        margin-top: -1px;
    }
    .intro-band:first-child::before { transform: scaleY(-1); }
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

        // Extract colours before building DOM so everything is themed on first paint
        const fallback = ['rgb(13,13,13)', 'rgb(160,30,100)', 'rgb(70,110,160)', 'rgb(230,230,230)', 'rgb(30,30,60)'];
        const extracted = spriteUrl ? (await extractDominantColors(spriteUrl, 5)) : null;
        const palette   = buildPalette(extracted ?? fallback);

        const overlay = document.createElement('div');
        overlay.id = INTRO_ID;
        overlay.style.opacity    = '0';
        overlay.style.transition = 'opacity 0.25s ease';
        overlay.style.backgroundColor = palette.bg;
        overlay.style.backgroundImage =
            `radial-gradient(circle, ${palette.dot} 1.5px, transparent 1.5px)`;

        // Revolver cylinder
        const cylinder = document.createElement('img');
        cylinder.id  = 'dangan-intro-cylinder';
        cylinder.src = `${extensionFolderPath}/assets/images/minigames/revolver-cylinder.png`;
        cylinder.alt = '';
        overlay.appendChild(cylinder);

        // Character sprite
        if (spriteUrl) {
            const sprite = document.createElement('img');
            sprite.id  = 'dangan-intro-sprite';
            sprite.src = spriteUrl;
            sprite.alt = name;
            overlay.appendChild(sprite);
        }

        // Text
        const textEl = document.createElement('div');
        textEl.id = 'dangan-intro-text';

        const nameEl = document.createElement('div');
        nameEl.id          = 'dangan-intro-name';
        nameEl.textContent = name;
        textEl.appendChild(nameEl);

        if (ultimate) {
            const labelEl = document.createElement('div');
            labelEl.id          = 'dangan-intro-ultimate-label';
            labelEl.textContent = 'Ultimate';
            labelEl.style.color     = palette.accent;
            labelEl.style.textShadow = `0 0 12px ${palette.accent}`;
            textEl.appendChild(labelEl);

            const ultimateEl = document.createElement('div');
            ultimateEl.id          = 'dangan-intro-ultimate';
            ultimateEl.textContent = ultimate;
            textEl.appendChild(ultimateEl);
        }

        overlay.appendChild(textEl);

        // Diagonal stripe group
        const shadowWrap  = document.createElement('div');
        shadowWrap.id     = 'dangan-intro-shadow-wrap';
        const shadowInner = document.createElement('div');
        shadowInner.id    = 'dangan-intro-shadow-inner';
        const bandGroup   = document.createElement('div');
        bandGroup.id      = 'dangan-intro-band-group';

        palette.bands.forEach((color, i) => {
            const band = document.createElement('div');
            band.className    = 'intro-band';
            band.style.background = color;
            band.style.height = `${BAND_HEIGHTS[i] ?? 60}px`;
            bandGroup.appendChild(band);
        });

        shadowInner.appendChild(bandGroup);
        shadowWrap.appendChild(shadowInner);
        overlay.appendChild(shadowWrap);

        document.body.appendChild(overlay);

        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        overlay.style.opacity = '1';

        await new Promise(r => setTimeout(r, 4000));

        overlay.style.transition = 'opacity 0.5s ease';
        overlay.style.opacity    = '0';
        await new Promise(r => setTimeout(r, 500));
        overlay.remove();
    }

    return { run };
}
