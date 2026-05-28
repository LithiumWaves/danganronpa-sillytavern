const ROSTER_ID       = 'dangan-chapter-end-roster';
const ROSTER_STYLE_ID = 'dangan-chapter-end-roster-style';

const BASE_PORTRAIT_PX = 720;
const AVG_HEIGHT_CM    = 170;
const MIN_SCALE        = 0.55;
const MAX_SCALE        = 1.45;
const SLOT_GAP_PX      = 8;
const DEFAULT_ASPECT   = 0.45;

// Two-layer silhouette approach: both layers are the same sprite, but the pink layer
// sits on top with opacity 0 and fades in. This avoids CSS mask cross-origin issues
// and gives a clean black → pink crossfade.
const BLACK_FILTER = 'brightness(0)';
const PINK_FILTER  = 'contrast(0) sepia(1) hue-rotate(300deg) saturate(20) brightness(1.3)';

function getBaseHeightPx(heightCm) {
    if (!heightCm) return BASE_PORTRAIT_PX;
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, heightCm / AVG_HEIGHT_CM));
    return Math.round(BASE_PORTRAIT_PX * scale);
}

function buildRosterStyles() {
    return `
    #${ROSTER_ID} {
        position: fixed; inset: 0;
        z-index: 2147483645;
        display: flex;
        flex-direction: column;
        pointer-events: all;
        user-select: none;
        overflow: hidden;
        background: radial-gradient(ellipse at 50% 80%, #b8b0a2 0%, #787060 45%, #2e2620 100%);
    }

    #cer-roster {
        flex: 1;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        gap: ${SLOT_GAP_PX}px;
        padding: 0 248px;
        overflow: hidden;
        min-height: 0;
    }

    .cer-slot {
        position: relative;
        flex-shrink: 0;
    }

    .cer-sprite {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: contain;
        object-position: bottom center;
    }

    .cer-sprite-black {
        filter: ${BLACK_FILTER};
    }

    .cer-sprite-pink {
        position: absolute;
        inset: 0;
        filter: ${PINK_FILTER};
        opacity: 0;
        transition: opacity 0.5s ease;
    }

    #cer-bottom-bar {
        flex-shrink: 0;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 24px;
        padding: 12px 32px;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
    }

    #cer-survivors-label {
        font-family: "Cinzel", "Times New Roman", Georgia, serif;
        font-size: clamp(14px, 1.8vw, 26px);
        letter-spacing: 0.28em;
        color: #e2dcd4;
    }

    #cer-survivors-count {
        font-family: "Cinzel", "Times New Roman", Georgia, serif;
        font-size: clamp(18px, 2.4vw, 34px);
        font-weight: 700;
        color: #e2dcd4;
        min-width: 2ch;
        text-align: center;
        transition: color 0.2s ease;
    }

    #cer-chapter-banner {
        position: absolute;
        top: 38%;
        left: 50%;
        transform: translate(-50%, -50%);
        opacity: 0;
        transition: opacity 0.9s ease;
        pointer-events: none;
        z-index: 2;
    }

    .cer-chapter-diamond {
        width: min(500px, 42vw);
        height: auto;
        filter: drop-shadow(0 2px 18px rgba(0, 0, 0, 0.7));
        overflow: visible;
    }
    `;
}

// Ornate diamond badge: two concentric rotated-square outlines (no X bands),
// chapter labels and chevron in black Cinzel.
function buildChapterBannerSvg(fromLabel, toLabel) {
    // 400×400 viewBox — larger canvas so the diamonds have more interior area
    // and the text labels sit well clear of the borders.
    // Center: (200,200). Outer diamond touches ~5px from each edge.
    return `
    <div id="cer-chapter-banner">
        <svg class="cer-chapter-diamond" viewBox="0 0 500 500"
             xmlns="http://www.w3.org/2000/svg"
             preserveAspectRatio="xMidYMid meet">
            <!-- Outer rotated-square outline -->
            <polygon points="250,6 494,250 250,494 6,250"
                     fill="none" stroke="rgba(14,11,8,0.92)" stroke-width="4"/>
            <!-- Inner rotated-square outline -->
            <polygon points="250,38 462,250 250,462 38,250"
                     fill="none" stroke="rgba(14,11,8,0.62)" stroke-width="3"/>
            <!-- Previous chapter label -->
            <text x="250" y="205"
                  text-anchor="middle" dominant-baseline="middle"
                  font-family="Cinzel,&quot;Times New Roman&quot;,serif"
                  font-size="26" font-weight="700" letter-spacing="2"
                  fill="rgb(8,6,4)">${fromLabel}</text>
            <!-- Downward chevron -->
            <text x="250" y="250"
                  text-anchor="middle" dominant-baseline="middle"
                  font-family="Cinzel,&quot;Times New Roman&quot;,serif"
                  font-size="22"
                  fill="rgb(8,6,4)">&#x25BC;</text>
            <!-- Upcoming chapter label -->
            <text x="250" y="295"
                  text-anchor="middle" dominant-baseline="middle"
                  font-family="Cinzel,&quot;Times New Roman&quot;,serif"
                  font-size="26" font-weight="700" letter-spacing="2"
                  fill="rgb(8,6,4)">${toLabel}</text>
        </svg>
    </div>`;
}

async function loadImageInfo(src) {
    return new Promise(resolve => {
        const img = new Image();
        img.onload  = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => resolve({ w: 0, h: 0 });
        img.src = src;
    });
}

export function createChapterEndRosterController({
    extensionFolderPath  = '',
    getCharacters        = () => new Map(),
    getSpriteUrl         = null,
    getCharacterHeightCm = null,
    getPlayerSpriteUrl   = null,
    getPlayerName        = () => null,
    findBgmTrackByName   = null,
    fadeOutAndPauseBgm   = null,
    playBgmPath          = null,
    getMonopadVolume     = () => 50,
} = {}) {
    async function run({ fromLabel = '', toLabel = '' } = {}) {
        if (document.getElementById(ROSTER_ID)) return;

        const chars = [...getCharacters().values()].filter(c => c?.name);
        if (!chars.length) return;

        // Prepend the player character (always alive, never dead)
        const playerName = getPlayerName?.();
        if (playerName) {
            chars.push({ name: playerName, dead: false, _isPlayer: true });
        }

        // Sort ascending by height: shortest left, tallest right
        chars.sort((a, b) => {
            const ha = getCharacterHeightCm?.(a.name) ?? AVG_HEIGHT_CM;
            const hb = getCharacterHeightCm?.(b.name) ?? AVG_HEIGHT_CM;
            return ha - hb;
        });

        // Preload sprite URLs and natural image dimensions in parallel
        const charData = await Promise.all(chars.map(async char => {
            const spriteUrl = char._isPlayer
                ? await getPlayerSpriteUrl?.('neutral').catch(() => null) ?? null
                : getSpriteUrl
                    ? await getSpriteUrl(char.name, 'neutral').catch(() => null)
                    : null;
            const heightCm = getCharacterHeightCm?.(char.name) ?? AVG_HEIGHT_CM;
            const baseH    = getBaseHeightPx(heightCm);
            const imgInfo  = spriteUrl ? await loadImageInfo(spriteUrl) : { w: 0, h: 0 };
            const aspect   = imgInfo.h > 0 ? imgInfo.w / imgInfo.h : DEFAULT_ASPECT;
            const baseW    = Math.round(baseH * aspect);
            return { char, spriteUrl, baseH, baseW };
        }));

        // Single uniform scale so the full roster fits the viewport
        const bottomBarH = 64;
        const rosterH    = window.innerHeight - bottomBarH - 16;
        const rosterW    = window.innerWidth  - 496;
        const maxBaseH   = Math.max(...charData.map(d => d.baseH));
        const totalBaseW = charData.reduce((sum, d) => sum + d.baseW, 0)
                           + SLOT_GAP_PX * Math.max(0, charData.length - 1);

        const finalScale = Math.min(0.88, rosterH / maxBaseH, rosterW / totalBaseW);

        // Inject stylesheet once per page lifetime
        if (!document.getElementById(ROSTER_STYLE_ID)) {
            const s = document.createElement('style');
            s.id = ROSTER_STYLE_ID;
            s.textContent = buildRosterStyles();
            document.head.appendChild(s);
        }

        // Build overlay (invisible until fade-in)
        const overlay = document.createElement('div');
        overlay.id = ROSTER_ID;
        overlay.style.opacity    = '0';
        overlay.style.transition = 'opacity 0.8s ease';

        const rosterEl = document.createElement('div');
        rosterEl.id = 'cer-roster';
        rosterEl.style.position = 'relative';
        if (fromLabel && toLabel) {
            rosterEl.insertAdjacentHTML('afterbegin', buildChapterBannerSvg(fromLabel, toLabel));
        }
        overlay.appendChild(rosterEl);

        // Bottom bar — count starts at total and ticks down as deaths are revealed
        const bottomBar = document.createElement('div');
        bottomBar.id = 'cer-bottom-bar';
        const labelEl = document.createElement('span');
        labelEl.id = 'cer-survivors-label';
        labelEl.textContent = 'Surviving Members';
        const countEl = document.createElement('span');
        countEl.id = 'cer-survivors-count';
        countEl.textContent = String(chars.length);
        bottomBar.appendChild(labelEl);
        bottomBar.appendChild(countEl);
        overlay.appendChild(bottomBar);

        // Build character slots — two stacked images per slot for the crossfade
        for (const { char, spriteUrl, baseH, baseW } of charData) {
            const h = Math.round(baseH * finalScale);
            const w = Math.round(baseW * finalScale);

            const slot = document.createElement('div');
            slot.className          = 'cer-slot';
            slot.dataset.isDead     = char.dead    ? '1' : '0';
            slot.dataset.isMissing  = char.missing ? '1' : '0';
            slot.style.width    = `${w}px`;
            slot.style.height   = `${h}px`;

            if (spriteUrl && !char.missing) {
                const blackImg = document.createElement('img');
                blackImg.className = 'cer-sprite cer-sprite-black';
                blackImg.src = spriteUrl;
                blackImg.alt = '';
                slot.appendChild(blackImg);

                const pinkImg = document.createElement('img');
                pinkImg.className = 'cer-sprite cer-sprite-pink';
                pinkImg.src = spriteUrl;
                pinkImg.alt = '';
                slot.appendChild(pinkImg);
            }

            rosterEl.appendChild(slot);
        }

        document.body.appendChild(overlay);

        // Fade out BGM and fade in overlay simultaneously
        await Promise.all([
            fadeOutAndPauseBgm?.(700) ?? Promise.resolve(),
            (async () => {
                await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
                overlay.style.opacity = '1';
                await new Promise(r => setTimeout(r, 900));
            })(),
        ]);

        // Play Trial End BGM
        const trialEndPath = findBgmTrackByName?.('Trial End');
        if (trialEndPath && playBgmPath) playBgmPath(trialEndPath);

        // Brief pause before death reveals
        await new Promise(r => setTimeout(r, 1800));

        // Reveal dead characters one at a time, each with sound and a count decrement
        let currentCount = chars.length;
        const deadSlots = [...rosterEl.querySelectorAll('.cer-slot[data-is-dead="1"]:not([data-is-missing="1"])')];

        for (const slot of deadSlots) {
            const sfx = new Audio(`${extensionFolderPath}/assets/sfx/ui/dead-indicator-noise.wav`);
            sfx.volume = Number(getMonopadVolume()) / 100;
            sfx.play().catch(() => {});

            const pinkImg = slot.querySelector('.cer-sprite-pink');
            if (pinkImg) pinkImg.style.opacity = '1';

            currentCount -= 1;
            countEl.textContent = String(currentCount);

            await new Promise(r => setTimeout(r, 1100));
        }

        // Fade in the chapter transition banner after all death reveals
        const banner = overlay.querySelector('#cer-chapter-banner');
        if (banner) {
            await new Promise(r => setTimeout(r, 300));
            banner.style.opacity = '1';
            await new Promise(r => setTimeout(r, 900));
        } else {
            await new Promise(r => setTimeout(r, 600));
        }

        await new Promise(resolve => {
            overlay.style.cursor = 'pointer';
            const autoTimer = setTimeout(resolve, 20000);
            overlay.addEventListener('click', () => {
                clearTimeout(autoTimer);
                resolve();
            }, { once: true });
        });

        overlay.style.transition = 'opacity 0.6s ease';
        overlay.style.opacity    = '0';
        await new Promise(r => setTimeout(r, 600));
        overlay.remove();
    }

    return { run };
}
