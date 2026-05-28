const CHOOSE_ID       = 'dangan-choose-overlay';
const CHOOSE_STYLE_ID = 'dangan-choose-style';
const HOLDON_STYLE_ID = 'dangan-holdon-style';

const UI_HIDE_SELECTORS = [
    '#top-bar', '#top-settings-holder', '#sheld', '#right-nav-panel',
    '#dangan-vn-overlay', '#dangan-trial-pre-debate-notif',
    '#dangan_monopad_button', '#dangan-level-bar',
    '#dangan-group-chat-stage',
];

function buildChooseStyles() {
    return `
    #${CHOOSE_ID} {
        position: fixed; inset: 0;
        z-index: 2147483640;
        overflow: visible;
        background: transparent;
        pointer-events: auto;
        user-select: none;
    }
    #choose-slot-stage {
        position: absolute;
        inset: 0;
        overflow: hidden;
        pointer-events: none;
        perspective: 1200px;
        perspective-origin: 50% 100%;
    }
    .choose-slot {
        position: absolute;
        bottom: 0; left: 0;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        will-change: transform;
        transition: transform 0.45s cubic-bezier(0.22, 0.61, 0.36, 1);
    }
    .choose-slot img {
        width: 100%; height: 100%;
        object-fit: contain;
        object-position: bottom center;
        display: block;
        filter: drop-shadow(0 0 12px rgba(0,0,0,0.7));
    }
    .choose-slot-horse {
        position: absolute;
        bottom: 0;
        left: 50%;
        transform: translateX(-50%);
        width: 380px !important;
        height: 98px !important;
        object-fit: fill !important;
        filter: drop-shadow(0 4px 12px rgba(0,0,0,0.6)) !important;
        pointer-events: none;
        z-index: 0;
    }
    .choose-slot img:not([class]) {
        position: relative;
        z-index: 1;
        width: auto !important;
        height: 100% !important;
        object-fit: unset !important;
        max-width: none;
    }
    .choose-slot.has-horse > img:not(.choose-slot-horse):not(.choose-slot-lectern) {
        transform: translateY(-98px);
    }
    .choose-slot-lectern {
        position: absolute;
        bottom: 0;
        left: 50%;
        transform: translateX(-50%);
        width: auto !important;
        height: 500px !important;
        object-fit: unset !important;
        filter: drop-shadow(0 4px 12px rgba(0,0,0,0.6)) !important;
        pointer-events: none;
        z-index: 2;
    }
    #choose-reticule {
        position: absolute;
        pointer-events: none;
        z-index: 50;
        transition: left 0.45s cubic-bezier(0.22, 0.61, 0.36, 1),
                    bottom 0.45s cubic-bezier(0.22, 0.61, 0.36, 1);
        filter:
            drop-shadow(0 0 8px #ff6600)
            drop-shadow(0 0 22px #ff4400)
            drop-shadow(0 0 55px #cc2200)
            drop-shadow(0 0 100px #991100);
    }
    #choose-reticule span {
        position: absolute;
        width: 32px; height: 32px;
        border-color: #ff5500;
        border-style: solid;
        border-width: 0;
    }
    #choose-reticule span:nth-child(1) { top: 12px;    left: 12px;  border-top-width: 3.5px; border-left-width: 3.5px;  }
    #choose-reticule span:nth-child(2) { top: 12px;   right: 12px;  border-top-width: 3.5px; border-right-width: 3.5px; }
    #choose-reticule span:nth-child(3) { bottom: 12px; left: 12px;  border-bottom-width: 3.5px; border-left-width: 3.5px; }
    #choose-reticule span:nth-child(4) { bottom: 12px; right: 12px; border-bottom-width: 3.5px; border-right-width: 3.5px; }
    #choose-reticule::before {
        content: '';
        position: absolute;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        width: 48px; height: 48px;
        border-radius: 50%;
        border: 3px solid #ff5500;
    }
    .choose-nav-arrow {
        position: absolute;
        font-size: 76px;
        color: #ffcc00;
        text-shadow:
            0 0 14px rgba(255,180,0,0.95),
            0 0 35px rgba(255,140,0,0.75);
        pointer-events: auto;
        cursor: pointer;
        z-index: 20;
        padding: 0 16px;
        line-height: 1;
        font-family: "Impact", Arial, sans-serif;
        font-style: italic;
        transform: translateY(-50%);
    }
    #choose-name-block {
        position: absolute;
        z-index: 15;
        left: 50%;
        transform: translateX(-50%);
        text-align: center;
        pointer-events: none;
    }
    #choose-name-triangle {
        width: 0; height: 0;
        border-left: 20px solid transparent;
        border-right: 20px solid transparent;
        border-bottom: 24px solid rgba(25,25,35,0.92);
        margin: 0 auto;
    }
    #choose-name-text {
        background: rgba(25,25,35,0.92);
        color: #ffcc00;
        font-family: "Cinzel", "Impact", Georgia, serif;
        font-size: 26px;
        font-weight: bold;
        letter-spacing: 1.5px;
        padding: 10px 36px;
        white-space: nowrap;
        min-width: 220px;
        text-shadow: 0 0 10px rgba(255,180,0,0.6);
    }
    #choose-select-banner {
        position: absolute;
        bottom: 48px; left: 25%; right: 25%;
        height: 48px;
        background: linear-gradient(90deg, transparent 0%, #ee1133 20%, #ee1133 80%, transparent 100%);
        -webkit-mask-image: linear-gradient(90deg, transparent 0%, black 18%, black 82%, transparent 100%);
        mask-image: linear-gradient(90deg, transparent 0%, black 18%, black 82%, transparent 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 20;
    }
    #choose-select-banner span {
        color: #ffffff;
        font-family: "Cinzel", "Impact", Georgia, serif;
        font-size: 24px;
        font-weight: bold;
        letter-spacing: 4px;
        text-shadow: 0 2px 8px rgba(0,0,0,0.6);
    }
    `;
}

function buildHoldOnStyles() {
    return `
    #dangan-holdon-wrap {
        position: fixed; inset: 0;
        z-index: 2147483647;
        pointer-events: none;
        overflow: hidden;
    }
    #dangan-holdon-container {
        position: absolute;
        left: 0; top: 0;
        width: 100%; height: 100vh;
        will-change: transform;
    }
    .holdon-img {
        display: block;
        width: 100%; height: 100%;
        object-fit: cover;
        object-position: top left;
    }
    .holdon-sprite {
        position: absolute;
        bottom: 0; right: 80px;
        height: 130vh; width: auto;
        object-fit: contain;
        object-position: bottom right;
        filter: drop-shadow(0 0 28px rgba(255,180,0,0.8)) drop-shadow(0 0 60px rgba(255,100,0,0.5));
    }
    `;
}

export function createChooseCharacterController({
    extensionFolderPath = '',
    getLecternUrl = null,
    getSpriteUrl = null,
    getPlayerSpriteUrl = null,
    playSfx = null,
    getSfx = null,
} = {}) {
    const base = (extensionFolderPath || '').replace(/\\/g, '/');
    const _getLecternUrl = () => (getLecternUrl ? getLecternUrl() : `${base}/assets/classtrial/lectern.webp`);

    async function playHoldOnCinematic() {
        if (!document.getElementById(HOLDON_STYLE_ID)) {
            const styleEl = document.createElement('style');
            styleEl.id = HOLDON_STYLE_ID;
            styleEl.textContent = buildHoldOnStyles();
            document.head.appendChild(styleEl);
        }

        const wrap = document.createElement('div');
        wrap.id = 'dangan-holdon-wrap';

        const container = document.createElement('div');
        container.id = 'dangan-holdon-container';
        container.style.transform = 'translateY(-110vh)';

        const imgEl = document.createElement('img');
        imgEl.className = 'holdon-img';
        imgEl.src = `${base}/assets/images/minigames/hold-on.png`;
        imgEl.alt = '';
        container.appendChild(imgEl);


        wrap.appendChild(container);
        document.body.appendChild(wrap);

        const SLIDE_IN_MS = 450;
        const HOLD_MS     = 1200;
        const FADE_MS     = 400;

        wrap.style.opacity = '0';
        await new Promise(res => {
            requestAnimationFrame(() => requestAnimationFrame(() => {
                wrap.style.transition       = `opacity ${SLIDE_IN_MS}ms ease`;
                wrap.style.opacity          = '1';
                container.style.transition  = `transform ${SLIDE_IN_MS}ms cubic-bezier(0.22,0.61,0.36,1)`;
                container.style.transform   = 'translateY(0)';
                setTimeout(res, SLIDE_IN_MS + 16);
            }));
        });

        await new Promise(res => setTimeout(res, HOLD_MS));

        await new Promise(res => {
            wrap.style.transition = `opacity ${FADE_MS}ms ease-in`;
            wrap.style.opacity    = '0';
            setTimeout(res, FADE_MS);
        });

        wrap.remove();
    }

    async function run({ characters = [], startIdx = 0 } = {}) {
        if (!characters.length) return null;
        if (document.getElementById(CHOOSE_ID)) return null; // already running

        if (!document.getElementById(CHOOSE_STYLE_ID)) {
            const styleEl = document.createElement('style');
            styleEl.id = CHOOSE_STYLE_ID;
            styleEl.textContent = buildChooseStyles();
            document.head.appendChild(styleEl);
        }

        // Trip the shared minigame-active body class so the trial chrome
        // (frame overlay, FX/BGM panel, badge, speaker mugshot sticker)
        // hides via the existing trial-aesthetic.css rules for the duration
        // of Choosing Time. Removed inside restoreUI() at exit.
        document.body.classList.add('dangan-minigame-active');

        // Hide ST UI
        const hiddenEls = new Map();
        for (const sel of UI_HIDE_SELECTORS) {
            const el = document.querySelector(sel);
            if (!el) continue;
            hiddenEls.set(sel, el.style.cssText);
            el.style.transition = 'opacity 0.3s ease';
            el.style.opacity = '0';
            setTimeout(() => { if (el.style.opacity === '0') el.style.display = 'none'; }, 320);
        }
        function restoreUI() {
            for (const [sel, css] of hiddenEls) {
                const el = document.querySelector(sel);
                if (!el) continue;
                el.style.cssText = css;
                el.style.display = '';
                el.style.opacity = '1';
            }
            hiddenEls.clear();
            document.body.classList.remove('dangan-minigame-active');
        }

        const overlay = document.createElement('div');
        overlay.id = CHOOSE_ID;
        document.body.appendChild(overlay);

        // Isolated perspective stage — mirrors #dangan-group-chat-stage exactly
        const stage = document.createElement('div');
        stage.id = 'choose-slot-stage';
        overlay.appendChild(stage);

        const SLOT_W   = Math.round(window.innerWidth / 3);
        const DEFAULT_H = 720;
        const GAP      = 180;
        const MAX_ROT  = 20;
        const BANNER_H = 48 + 48; // banner height + its bottom offset from screen edge

        function slotTransform(x) {
            const w2   = window.innerWidth / 2;
            const dist = (x + SLOT_W / 2 - w2) / w2;
            return `translateX(${x}px) rotateY(${(-dist * MAX_ROT).toFixed(1)}deg)`;
        }

        function circOffset(i, centerIdx) {
            const n = slots.length;
            let offset = i - centerIdx;
            if (n > 1) {
                if (offset > n / 2)  offset -= n;
                if (offset < -n / 2) offset += n;
            }
            return offset;
        }

        function slotX(offset) {
            return window.innerWidth / 2 - SLOT_W / 2 + offset * (SLOT_W + GAP);
        }

        // Build character slots
        // characters entries are either strings or { name, src, height, hasHorse } objects
        const slots = [];
        for (let i = 0; i < characters.length; i++) {
            const entry    = characters[i];
            const name     = (typeof entry === 'string') ? entry : (entry?.name ?? '');
            const src      = (typeof entry === 'object' && entry?.src)      ? entry.src      : null;
            const height   = (typeof entry === 'object' && entry?.height)   ? entry.height   : DEFAULT_H;
            const hasHorse = (typeof entry === 'object' && entry?.hasHorse) ? entry.hasHorse : false;

            const el = document.createElement('div');
            el.className = 'choose-slot';
            el.style.width  = `${SLOT_W}px`;
            el.style.height = `${height}px`;
            if (hasHorse) {
                el.classList.add('has-horse');
                const horse = document.createElement('img');
                horse.className = 'choose-slot-horse';
                horse.src = `${base}/assets/classtrial/gymnastics-horse.png`;
                horse.alt = '';
                el.appendChild(horse);
            }
            const img = document.createElement('img');
            img.alt = name;
            el.appendChild(img);
            const lectern = document.createElement('img');
            lectern.className = 'choose-slot-lectern';
            lectern.src = _getLecternUrl();
            lectern.alt = '';
            el.appendChild(lectern);
            stage.appendChild(el);
            slots.push({ el, img, name, height });

            if (src) {
                img.src = src;
            } else if (typeof getSpriteUrl === 'function') {
                getSpriteUrl(name, 'neutral').catch(() => null).then(url => { if (url && img) img.src = url; });
            }
        }

        // Reticule — square, SLOT_W × SLOT_W, centered vertically on the character slot
        const RETICULE_SIZE = SLOT_W;
        const reticule = document.createElement('div');
        reticule.id = 'choose-reticule';
        reticule.style.width  = `${RETICULE_SIZE}px`;
        reticule.style.height = `${RETICULE_SIZE}px`;
        for (let i = 0; i < 4; i++) reticule.appendChild(document.createElement('span'));
        overlay.appendChild(reticule);

        // Nav arrows
        const leftArrow = document.createElement('div');
        leftArrow.id = 'choose-arrow-left';
        leftArrow.className = 'choose-nav-arrow';
        leftArrow.innerHTML = '&#10094;';
        overlay.appendChild(leftArrow);

        const rightArrow = document.createElement('div');
        rightArrow.id = 'choose-arrow-right';
        rightArrow.className = 'choose-nav-arrow';
        rightArrow.innerHTML = '&#10095;';
        overlay.appendChild(rightArrow);

        // Name block (triangle + name bar)
        const nameBlock = document.createElement('div');
        nameBlock.id = 'choose-name-block';
        nameBlock.style.bottom = `${BANNER_H + 16}px`;
        const nameTriangle = document.createElement('div');
        nameTriangle.id = 'choose-name-triangle';
        const nameText = document.createElement('div');
        nameText.id = 'choose-name-text';
        nameBlock.appendChild(nameTriangle);
        nameBlock.appendChild(nameText);
        overlay.appendChild(nameBlock);

        // SELECT SOMEONE banner
        const banner = document.createElement('div');
        banner.id = 'choose-select-banner';
        const bannerSpan = document.createElement('span');
        bannerSpan.textContent = 'SELECT SOMEONE';
        banner.appendChild(bannerSpan);
        overlay.appendChild(banner);

        let currentIdx = Math.max(0, Math.min(Math.round(startIdx), characters.length - 1));
        let resolved   = false;

        function updatePositions(animate) {
            const n = slots.length;
            const jumpers = [];

            slots.forEach((slot, i) => {
                const newOff  = circOffset(i, currentIdx);
                const prevOff = slot._circOff ?? newOff;
                slot._circOff = newOff;

                const dist = Math.abs(newOff);
                slot.el.style.zIndex = String(n - dist);

                if (animate && Math.abs(newOff - prevOff) > 1) {
                    // Slot jumped across the ring boundary — teleport to entry side first
                    const farOff = newOff > prevOff ? newOff + n : newOff - n;
                    slot.el.style.transition = 'none';
                    slot.el.style.transform  = slotTransform(slotX(farOff));
                    jumpers.push({ slot, newOff });
                } else {
                    if (!animate) slot.el.style.transition = 'none';
                    else          slot.el.style.transition = '';
                    slot.el.style.transform = slotTransform(slotX(newOff));
                }
            });

            if (jumpers.length) {
                // Force a reflow so the teleport position is committed before animating
                slots[0].el.offsetHeight;
                for (const { slot, newOff } of jumpers) {
                    slot.el.style.transition = '';
                    slot.el.style.transform  = slotTransform(slotX(newOff));
                }
            }

            // Reticule: square, horizontally centered on the center slot,
            // vertically centered within the visible character area (bottom 70px is banner)
            const rx = window.innerWidth / 2 - SLOT_W / 2;
            const visibleH = window.innerHeight - BANNER_H;
            const ry = Math.round((visibleH - RETICULE_SIZE) / 2) + 50;
            if (!animate) reticule.style.transition = 'none';
            else reticule.style.transition = '';
            reticule.style.left = `${rx}px`;
            reticule.style.top  = `${ry}px`;

            // Arrows: vertically centred on the reticule, just outside its edges
            const arrowMidY = ry + Math.round(RETICULE_SIZE / 2);
            leftArrow.style.top  = `${arrowMidY}px`;
            leftArrow.style.left = `${rx - 90}px`;
            rightArrow.style.top  = `${arrowMidY}px`;
            rightArrow.style.left = `${rx + RETICULE_SIZE + 10}px`;

            nameText.textContent = slots[currentIdx]?.name ?? '';
        }

        // Initial positions — no animation
        updatePositions(false);

        let lastHoverTime = 0;
        function playNavigateSfx() {
            const sfx = getSfx?.();
            if (!sfx?.hover || typeof playSfx !== 'function') return;
            const now = Date.now();
            if (now - lastHoverTime < 80) return;
            lastHoverTime = now;
            playSfx(sfx.hover);
        }

        function navigate(dir) {
            if (resolved) return;
            currentIdx = (currentIdx + dir + characters.length) % characters.length;
            updatePositions(true);
            playNavigateSfx();
        }

        function onLeftClick()  { navigate(-1); }
        function onRightClick() { navigate(1); }
        leftArrow.addEventListener('click',  onLeftClick);
        rightArrow.addEventListener('click', onRightClick);

        return new Promise(resolve => {
            function onKey(e) {
                if (resolved) return;
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                }
                if (e.key === 'ArrowLeft')       { navigate(-1); }
                else if (e.key === 'ArrowRight') { navigate(1); }
                else if (e.key === 'Enter') {
                    resolved = true;
                    const chosen = slots[currentIdx]?.name ?? null;
                    new Audio(`${base}/assets/sfx/minigames/final-shot.wav`).play().catch(() => {});
                    cleanup();
                    setTimeout(() => playHoldOnCinematic(), 1000);
                    resolve(chosen);
                }
            }

            function cleanup() {
                window.removeEventListener('keydown', onKey, { capture: true });
                leftArrow.removeEventListener('click',  onLeftClick);
                rightArrow.removeEventListener('click', onRightClick);
                restoreUI();
                overlay.style.transition = 'opacity 0.3s ease';
                overlay.style.opacity    = '0';
                setTimeout(() => overlay.remove(), 320);
            }

            window.addEventListener('keydown', onKey, { capture: true });
        });
    }

    return { run };
}
