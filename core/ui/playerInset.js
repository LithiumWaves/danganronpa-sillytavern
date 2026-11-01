// Your sprite in conversations (Settings → Customize → "Your sprite in
// conversations"): a slanted window on the right of the screen, like the
// one Killing Harmony shows the protagonist in, with the player's sprite
// from Prome's user sprite folder. Its expression follows your last message.
//
// index.js decides when it may show (setting on, VN mode, a sprite folder)
// and calls update(); styles/systems/vn/player-inset.css shows the window
// only while a conversation is open and no Class Trial is running.

const INSET_ID = "dangan-player-inset";

// Bounding box of a sprite's visible (non-transparent) pixels, as fractions
// of the image, so any framing (full body, waist-up, padded) can be placed
// head near the top and body down to the window's bottom edge.
const boundsCache = new Map();
function getVisibleBounds(img) {
    const key = img.currentSrc || img.src;
    if (boundsCache.has(key)) return boundsCache.get(key);
    let bounds = { x: 0, y: 0, w: 1, h: 1 };
    try {
        const scale = Math.min(1, 240 / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const g = canvas.getContext("2d", { willReadFrequently: true });
        g.drawImage(img, 0, 0, w, h);
        const data = g.getImageData(0, 0, w, h).data;
        let minX = w, minY = h, maxX = -1, maxY = -1;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (data[(y * w + x) * 4 + 3] < 24) continue;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
        if (maxX >= 0) bounds = { x: minX / w, y: minY / h, w: (maxX - minX + 1) / w, h: (maxY - minY + 1) / h };
    } catch { /* unreadable image: use the whole thing */ }
    boundsCache.set(key, bounds);
    return bounds;
}

// Head 4% from the top; shows at most a waist-up's worth of a tall sprite,
// and always reaches (or runs past) the bottom edge.
function frameSprite(img, win) {
    if (!img.naturalWidth || !win.clientHeight) return;
    const b = getVisibleBounds(img);
    const natW = img.naturalWidth;
    const natH = img.naturalHeight;
    const contentW = b.w * natW;
    const contentH = b.h * natH;
    const visibleH = Math.min(contentH, contentW * 1.7);
    const winH = win.clientHeight;
    const scale = (winH * 0.96) / visibleH;
    const top = winH * 0.04 - b.y * natH * scale;
    const centerX = (b.x + b.w / 2) * natW * scale;
    img.style.height = `${natH * scale}px`;
    img.style.top = `${top}px`;
    img.style.left = `${win.clientWidth * 0.58 - centerX}px`;
}

export function createPlayerInset({ getSpriteUrl, classify, getLastUserMessage, isCollapsed, setCollapsed }) {
    let enabled = false;
    let label = "neutral";
    let token = 0;

    function ensureEl() {
        let el = document.getElementById(INSET_ID);
        if (el) return el;
        el = document.createElement("div");
        el.id = INSET_ID;
        el.setAttribute("aria-hidden", "true");
        el.innerHTML = `
            <div class="dangan-player-inset-frame">
                <div class="dangan-player-inset-window">
                    <img class="dangan-player-inset-sprite" alt="" draggable="false">
                </div>
            </div>
            <button type="button" class="dangan-player-inset-toggle" aria-label="Hide your sprite" title="Hide your sprite" aria-expanded="true">
                <span class="dangan-player-inset-stripes"></span>
            </button>
            <button type="button" class="dangan-player-inset-reopen" aria-label="Show your sprite" title="Show your sprite">
                <span aria-hidden="true">«</span>
            </button>
        `;
        // The stripes tuck the window away; a small tab at the edge brings it back.
        const applyCollapsed = (collapsed) => {
            el.classList.toggle("collapsed", collapsed);
            el.querySelector(".dangan-player-inset-toggle").setAttribute("aria-expanded", String(!collapsed));
            syncBodyState();
        };
        applyCollapsed(!!isCollapsed?.());
        for (const btn of el.querySelectorAll(".dangan-player-inset-toggle, .dangan-player-inset-reopen")) {
            btn.addEventListener("pointerdown", (e) => e.stopPropagation());
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                const next = !el.classList.contains("collapsed");
                applyCollapsed(next);
                setCollapsed?.(next);
            });
        }
        const img = el.querySelector("img");
        const win = el.querySelector(".dangan-player-inset-window");
        img.addEventListener("error", () => { el.classList.remove("has-sprite"); syncBodyState(); });
        img.addEventListener("load", () => {
            el.classList.add("has-sprite");
            syncBodyState();
            // Measure once it's laid out (it's display:none until shown).
            requestAnimationFrame(() => frameSprite(img, win));
        });
        if (typeof ResizeObserver === "function") {
            new ResizeObserver(() => { if (win.clientHeight) frameSprite(img, win); }).observe(win);
        }
        document.body.appendChild(el);
        return el;
    }

    // Lets other HUD pieces (the minimap) make room while the window is out.
    function syncBodyState() {
        const el = document.getElementById(INSET_ID);
        const shown = enabled && !!el?.classList.contains("has-sprite") && !el.classList.contains("collapsed");
        document.body.classList.toggle("dangan-player-inset-shown", shown);
    }

    async function showLabel(next) {
        label = next || "neutral";
        if (!enabled) return;
        const mine = ++token;
        let url = null;
        try { url = await getSpriteUrl(label); } catch { url = null; }
        if (mine !== token || !enabled) return;
        const el = ensureEl();
        const img = el.querySelector("img");
        if (!url) {
            el.classList.remove("has-sprite");
            img.removeAttribute("src");
            syncBodyState();
            return;
        }
        if (img.getAttribute("src") !== url) img.src = url;
        else el.classList.add("has-sprite");
        syncBodyState();
    }

    // The expression of your message, or neutral when it can't be told.
    async function expressionFor(text) {
        const clean = String(text || "").trim();
        if (!clean) return "neutral";
        try { return (await classify(clean)) || "neutral"; } catch { return "neutral"; }
    }

    return {
        setEnabled(on) {
            const next = !!on;
            document.body.classList.toggle("dangan-player-inset-on", next);
            if (next === enabled) return;
            enabled = next;
            syncBodyState();
            if (enabled) {
                ensureEl();
                showLabel(label);
            } else {
                token += 1;
            }
        },
        // A message you just sent: show its expression.
        async onUserMessage(text) {
            if (!enabled) return;
            const mine = ++token;
            const next = await expressionFor(text);
            if (mine !== token) return;
            showLabel(next);
        },
        // A different chat: start from your last message in it.
        async onChatChanged() {
            if (!enabled) return;
            const mine = ++token;
            const next = await expressionFor(getLastUserMessage());
            if (mine !== token) return;
            showLabel(next);
        },
        refresh() {
            if (enabled) showLabel(label);
        },
        // A sprite picked by hand (the expression picker).
        showUrl(url) {
            if (!enabled || !url) return;
            token += 1;
            const img = ensureEl().querySelector("img");
            if (img.getAttribute("src") !== url) img.src = url;
        },
    };
}
